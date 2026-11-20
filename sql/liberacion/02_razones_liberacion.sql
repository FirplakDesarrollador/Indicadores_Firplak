/*
  BI Liberación: tabla de razones de Planeación, copia de la app de Logística (Supabase).
  Ficha: llm-wiki/bi/liberacion.md (sección 2, "Razones de Planeación"; decisión del 2026-11-20).

  Flujo:
    Supabase (proyecto Manufactura, schema logistica)
      vista logistica.razones_lib_vigentes  ─ pg_cron cada 15 min, solo si hubo cambios
      │ pg_net: POST https://api.firplak.com:8443/api/v1/liberacion/razones (token propio)
      ▼
    Reporting API ─ EXEC dbo.sp_Cargar_Informe_liberacion_razones @Razones (parámetro de tabla)
      ▼
    dbo.Informe_liberacion_razones (reemplazo completo en una transacción)

  Por qué reemplazo completo: son ~40.500 filas y así las OP eliminadas en la app desaparecen solas.
  Protección: si llegan menos del 90 % de las filas que hay hoy, no carga (evita vaciar la tabla por
  un error en la vista). Para una reducción legítima grande: @Forzar = 1, ejecutado a mano.

  Permisos: la API escribe SOLO a través del SP. El usuario de la API necesita EXECUTE sobre el SP y
  sobre el tipo; no necesita INSERT ni DELETE sobre la tabla (el SP es de dbo: encadenamiento de
  propiedad).

  Compatibilidad: nivel 100 (SQL Server 2016 SP2). Sin OPENJSON (exige nivel 130): por eso la API
  envía las filas como parámetro de tabla.
  Bitácora: dbo.Cargas_Log, Proceso = 'Informe_liberacion_razones'.

  Revisión y ejecución: SOLO el desarrollador.
  Orden: 1) tipo  2) tabla  3) SP  4) permisos  (la primera carga la hace la API al recibir el primer envío)

  Rollback:
    DROP PROCEDURE dbo.sp_Cargar_Informe_liberacion_razones;
    DROP TYPE dbo.TipoRazonLiberacion;
    DROP TABLE dbo.Informe_liberacion_razones;
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tipo de tabla (parámetro del SP) ───────────── */
IF TYPE_ID(N'dbo.TipoRazonLiberacion') IS NULL
    CREATE TYPE dbo.TipoRazonLiberacion AS TABLE (
        NoOrden          bigint         NOT NULL PRIMARY KEY,
        Razon            nvarchar(100)  NOT NULL,
        RazonNormalizada nvarchar(100)  NOT NULL,
        CambioFecha      bit            NOT NULL,
        FechaProgramada  date           NULL,
        FechaTexto       nvarchar(50)   NULL,
        Comentario       nvarchar(4000) NULL,
        Origen           nvarchar(10)   NOT NULL,
        Actualizado      datetime2(0)   NULL
    );
GO

/* ───────────── 2. Tabla ───────────── */
IF OBJECT_ID(N'dbo.Informe_liberacion_razones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_liberacion_razones (
        NoOrden          bigint         NOT NULL,   -- Cruza con Informe_liberacion.CodigoOP
        Razon            nvarchar(100)  NOT NULL,   -- Tal como está en la app ('OBSERVACIONES PLANEACIÓN' del Excel), sin espacios sobrantes
        RazonNormalizada nvarchar(100)  NOT NULL,   -- Razón del catálogo equivalente (agrupa variantes como ERROR DE LIBERACIÓN / ERROR DE LIBERACION)
        CambioFecha      bit            NOT NULL,   -- Cumple con cambio de fecha (casilla del formulario o deducido del comentario)
        FechaProgramada  date           NULL,       -- Fecha programada que registra Logística (pregunta 16)
        FechaTexto       nvarchar(50)   NULL,       -- Valor de FECHA del Excel cuando no es una fecha (p. ej. 09/12/20214)
        Comentario       nvarchar(4000) NULL,
        Origen           nvarchar(10)   NOT NULL,   -- historico | nuevo | editado
        Actualizado      datetime2(0)   NULL,       -- UTC. Último guardado en la app; NULL en las filas del Excel sin editar
        Sincronizado     datetime2(0)   NOT NULL,   -- Hora del servidor en que llegó a SQL Server
        CONSTRAINT PK_Informe_liberacion_razones PRIMARY KEY CLUSTERED (NoOrden)
    );

    -- Filtro y agrupación por razón
    CREATE NONCLUSTERED INDEX IX_Informe_liberacion_razones_Razon
        ON dbo.Informe_liberacion_razones (RazonNormalizada)
        INCLUDE (CambioFecha);
END
GO

/* ───────────── 3. SP ───────────── */
IF OBJECT_ID(N'dbo.sp_Cargar_Informe_liberacion_razones', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Cargar_Informe_liberacion_razones;
GO

CREATE PROCEDURE dbo.sp_Cargar_Informe_liberacion_razones
    @Razones dbo.TipoRazonLiberacion READONLY,
    @Forzar  bit = 0   -- 1 = acepta una reducción mayor al 10 % (solo a mano)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Inicio     datetime2(0) = sysdatetime();
    DECLARE @Recibidas  int;
    DECLARE @Actuales   int;
    DECLARE @Eliminados int;
    DECLARE @Bloqueo    int;
    DECLARE @Error      nvarchar(4000);

    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Cargar_Informe_liberacion_razones', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 30000;   -- Espera hasta 30 s si llega un envío mientras se carga otro
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion_razones', N'COMPLETA', @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RAISERROR (N'Ya hay una carga de razones en curso.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        SELECT @Recibidas = COUNT_BIG(1) FROM @Razones;
        SELECT @Actuales  = COUNT_BIG(1) FROM dbo.Informe_liberacion_razones;

        IF @Recibidas = 0
            RAISERROR (N'El envío no trae razones. No se cargó.', 16, 1);

        IF @Forzar = 0 AND @Actuales > 0 AND @Recibidas < @Actuales * 0.9
        BEGIN
            SET @Error = N'El envío trae ' + CAST(@Recibidas AS nvarchar(20)) + N' razones y la tabla tiene '
                       + CAST(@Actuales AS nvarchar(20)) + N' (baja de más del 10 %). No se cargó; revisar la vista en Supabase o usar @Forzar = 1.';
            RAISERROR (@Error, 16, 1);
        END

        BEGIN TRANSACTION;

        DELETE FROM dbo.Informe_liberacion_razones;
        SET @Eliminados = @@ROWCOUNT;

        INSERT INTO dbo.Informe_liberacion_razones (
            NoOrden, Razon, RazonNormalizada, CambioFecha, FechaProgramada, FechaTexto, Comentario, Origen, Actualizado, Sincronizado)
        SELECT NoOrden, Razon, RazonNormalizada, CambioFecha, FechaProgramada, FechaTexto, Comentario, Origen, Actualizado, @Inicio
        FROM @Razones;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion_razones', N'COMPLETA', @Inicio, sysdatetime(), @Eliminados, @Recibidas, NULL);

        EXEC sp_releaseapplock @Resource = N'sp_Cargar_Informe_liberacion_razones', @LockOwner = N'Session';

        SELECT @Recibidas AS Recibidas, @Eliminados AS Reemplazadas;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion_razones', N'COMPLETA', @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = N'sp_Cargar_Informe_liberacion_razones', @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 4. Permisos del usuario de la API ─────────────
   Reemplazar <usuario_api> por el usuario de base de datos con el que se conecta la Reporting API
   (REPORT_DB_USER en su .env). Solo EXECUTE: la API no puede escribir en ninguna otra tabla.

-- GRANT EXECUTE ON dbo.sp_Cargar_Informe_liberacion_razones TO [<usuario_api>];
-- GRANT EXECUTE ON TYPE::dbo.TipoRazonLiberacion TO [<usuario_api>];

-- Lectura de las dos tablas del informe, si el usuario no tiene db_datareader:
-- GRANT SELECT ON dbo.Informe_liberacion TO [<usuario_api>];
-- GRANT SELECT ON dbo.Informe_liberacion_razones TO [<usuario_api>];
*/

/* ───────────── 5. Validación (solo lectura), después del primer envío desde Supabase ───────────── */

-- 5.1 Últimas cargas. Esperado: Error NULL e Insertados = filas de la vista en Supabase (~40.500).
-- SELECT TOP (10) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_liberacion_razones' ORDER BY Inicio DESC;

-- 5.2 Conteo por razón. Comparar con la misma consulta en Supabase (supabase/migrations de Logística,
--     consulta de validación de la vista). Esperado: mismos números.
-- SELECT RazonNormalizada, COUNT_BIG(1) AS Ordenes, SUM(CAST(CambioFecha AS int)) AS ConCambioFecha
-- FROM dbo.Informe_liberacion_razones
-- GROUP BY RazonNormalizada
-- ORDER BY Ordenes DESC;

-- 5.3 Cruce con las OP del informe (después de 01_informe_liberacion.sql). Cuántas OP del indicador
--     tienen razón, por mes de fecha recomendada.
-- SELECT YEAR(l.FechaRecomendadaLiberacion) AS Anio, MONTH(l.FechaRecomendadaLiberacion) AS Mes,
--        COUNT_BIG(1) AS Ops,
--        SUM(CASE WHEN r.NoOrden IS NOT NULL THEN 1 ELSE 0 END) AS ConRazon,
--        SUM(CASE WHEN r.RazonNormalizada = N'CUMPLE' THEN 1 ELSE 0 END) AS Cumple,
--        SUM(CASE WHEN r.RazonNormalizada = N'NO MEDIR' THEN 1 ELSE 0 END) AS NoMedir
-- FROM dbo.Informe_liberacion l
-- LEFT JOIN dbo.Informe_liberacion_razones r ON r.NoOrden = l.CodigoOP
-- GROUP BY YEAR(l.FechaRecomendadaLiberacion), MONTH(l.FechaRecomendadaLiberacion)
-- ORDER BY Anio, Mes;
