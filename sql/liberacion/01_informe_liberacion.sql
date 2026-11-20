/*
  BI Liberación: tabla de reporte de las OP con tipos reales y SP que la mantiene al día.
  Ficha: llm-wiki/bi/liberacion.md (sección 2, plan aprobado por el desarrollador el 2026-11-20).

  Origen: Planos_Symphony.dbo.Indicador_Liberacion, que carga dbo.FPK_INDICADOR_LIBERACION
  (job 'Actualizacion Indicador Liberacion', lunes a viernes 17:00). Ese SP NO se toca: el Power BI
  lo sigue usando mientras corran en paralelo.

  Qué hace dbo.sp_Actualizar_Informe_liberacion:
    - Convierte las 23 columnas nvarchar del origen a fechas y números. El SP de origen escribe
      DATE y NUMERIC en columnas nvarchar, así que las fechas quedan 'AAAA-MM-DD' y los números
      con punto decimal ('12.000'). Si algún valor no tiene ese formato, la carga falla, lo deja
      en dbo.Cargas_Log y la tabla conserva los datos anteriores.
    - MERGE por CodigoOP:
        * OP del origen: se insertan o se actualizan (EnOrigen = 1).
        * OP que ya no están en el origen y cuya fecha prometida salió de la ventana de 365 días del
          SP de origen: se CONSERVAN con sus últimos valores (EnOrigen = 0). Así el portal acumula
          historia (pregunta 12).
        * OP que ya no están en el origen y siguen dentro de la ventana: salieron por otra razón
          (cancelada, cambio de bodega o de tipo de orden, familia nula). Se BORRAN, igual que en el
          origen.
    - El estado de cumplimiento (OK / NO / SIN LIBERAR / NO MEDIR) NO se guarda: depende de la fecha
      de hoy y de las razones de Planeación, y lo calcula la API.
    - Protección: si el origen está vacío o trae menos del 50 % de las OP vigentes en la tabla
      (por ejemplo, porque FPK_INDICADOR_LIBERACION está a mitad de su TRUNCATE + INSERT), no carga.

  Compatibilidad: Planos_Symphony está en nivel 100 (SQL Server 2016 SP2).
  Sin CTE, APPLY, TRY_CONVERT, CREATE OR ALTER ni THROW. MERGE sí funciona.
  Bitácora: dbo.Cargas_Log (ya existe). Proceso = 'Informe_liberacion'.
    Insertados = OP nuevas + OP actualizadas; Eliminados = OP borradas por salir del origen.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 0) consultas previas  1) tabla  2) SP  3) primera carga  4) validación
         5) job (03_job_liberacion.sql)

  Rollback:
    DROP PROCEDURE dbo.sp_Actualizar_Informe_liberacion;
    DROP TABLE dbo.Informe_liberacion;
  (No afecta a Indicador_Liberacion ni al Power BI.)
*/

USE [Planos_Symphony];
GO

/* ───────────── 0. Consultas previas (solo lectura) ─────────────
   Ejecutarlas antes del resto y pegar los resultados en la ficha.

-- 0.1 Nombres exactos de las columnas del origen. Esperado: los 23 nombres que usa el SP de abajo,
--     en este orden (el SP de origen inserta sin lista de columnas, por posición).
SELECT c.column_id, c.name, t.name AS tipo, c.max_length
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.Indicador_Liberacion')
ORDER BY c.column_id;

-- 0.2 Formato de fechas y números. Esperado: 0 en todas las columnas "Malas".
SELECT
    COUNT_BIG(1) AS Filas,
    SUM(CASE WHEN [Código OP] IS NULL OR [Código OP] LIKE '%[^0-9]%' OR LEN([Código OP]) > 9 THEN 1 ELSE 0 END) AS CodigoMalo,
    SUM(CASE WHEN [Fecha Recomendada de Liberación] IS NULL
              OR [Fecha Recomendada de Liberación] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1 ELSE 0 END) AS RecomendadaMala,
    SUM(CASE WHEN [Fecha Real de Liberación] IS NOT NULL
              AND [Fecha Real de Liberación] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1 ELSE 0 END) AS RealMala,
    SUM(CASE WHEN [Cantidad Total] IS NOT NULL AND [Cantidad Total] LIKE '%[^0-9.-]%' THEN 1 ELSE 0 END) AS CantidadMala,
    SUM(CASE WHEN [Costo Unitario] IS NOT NULL AND [Costo Unitario] LIKE '%[^0-9.-]%' THEN 1 ELSE 0 END) AS CostoMalo,
    MIN([Fecha Real de Liberación]) AS EjemploFechaReal,
    MIN([Cantidad Total]) AS EjemploCantidad,
    MIN([Costo Unitario]) AS EjemploCosto
FROM dbo.Indicador_Liberacion;

-- 0.3 Longitud máxima de los textos (para confirmar los tamaños de la tabla nueva).
SELECT MAX(LEN([SKU])) AS SKU, MAX(LEN([Destino])) AS Destino, MAX(LEN([Familia de Producción])) AS Familia,
       MAX(LEN([Num. Lote])) AS Lote, MAX(LEN([Descripción de SKU])) AS DescSKU, MAX(LEN([Estado])) AS Estado,
       MAX(LEN([Linea])) AS Linea, MAX(LEN([Color Recomendado])) AS Color, MAX(LEN([Planta])) AS Planta,
       MAX(LEN([Tipo])) AS Tipo
FROM dbo.Indicador_Liberacion;
*/

/* ───────────── 1. Tabla ───────────── */
IF OBJECT_ID(N'dbo.Informe_liberacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_liberacion (
        CodigoOP                   int            NOT NULL,   -- 'Código OP' (OWOR.DocNum); cruza con No Orden de las razones
        Tipo                       nvarchar(2)    NULL,       -- O = STANDARD, S = STOCK
        SKU                        nvarchar(50)   NULL,
        DescripcionSKU             nvarchar(150)  NULL,
        Destino                    nvarchar(25)   NULL,
        FamiliaProduccion          nvarchar(10)   NULL,
        Linea                      nvarchar(6)    NULL,
        Estado                     nvarchar(20)   NULL,       -- Planificado | Liberado | Cerrado
        Planta                     nvarchar(20)   NULL,
        NumLote                    nvarchar(30)   NULL,
        FechaContabilizacion       date           NULL,       -- Creación de la OP
        FechaPrometidaEntrega      date           NULL,       -- OWOR.DueDate: define la ventana de 365 días del origen
        FechaPrometidaEntregaItem  date           NULL,       -- No determinista en el origen (ver ficha)
        FechaRecomendadaLiberacion date           NOT NULL,   -- Fecha de referencia del dashboard (meta)
        FechaRealLiberacion        date           NULL,       -- NULL = sin liberar
        FechaRecomendadaEntrega    date           NULL,
        FechaActualizacion         date           NULL,       -- Día en que corrió el SP de origen
        CantidadTotal              decimal(18, 3) NULL,
        CantidadPendiente          decimal(18, 3) NULL,
        CantidadTotalItem          decimal(18, 3) NULL,
        CantidadPendienteItem      decimal(18, 3) NULL,
        CostoUnitario              decimal(18, 1) NULL,
        ColorRecomendado           nvarchar(20)   NULL,
        EnOrigen                   bit            NOT NULL,   -- 0 = salió de la ventana del origen; se conserva como historia
        PrimeraCarga               datetime2(0)   NOT NULL,
        UltimaCarga                datetime2(0)   NOT NULL,   -- Última vez que la OP llegó en el origen
        CONSTRAINT PK_Informe_liberacion PRIMARY KEY CLUSTERED (CodigoOP)
    );

    -- Resumen, gráficas y detalle por periodo (todos los filtros de periodo van por la fecha recomendada)
    CREATE NONCLUSTERED INDEX IX_Informe_liberacion_FechaRecomendada
        ON dbo.Informe_liberacion (FechaRecomendadaLiberacion)
        INCLUDE (Tipo, Linea, FamiliaProduccion, Estado, FechaRealLiberacion);
END
GO

/* ───────────── 2. SP ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_liberacion', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Informe_liberacion;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Informe_liberacion
    @DiasVentanaOrigen int = 365   -- Ventana de FPK_INDICADOR_LIBERACION sobre la fecha prometida (DueDate)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Inicio       datetime2(0) = sysdatetime();
    DECLARE @Hoy          date = CAST(GETDATE() AS date);
    DECLARE @LimiteVentana date = DATEADD(DAY, -@DiasVentanaOrigen, CAST(GETDATE() AS date));
    DECLARE @FilasOrigen  int;
    DECLARE @Vigentes     int;
    DECLARE @Malas        int;
    DECLARE @Insertados   int = 0;
    DECLARE @Actualizados int = 0;
    DECLARE @Eliminados   int = 0;
    DECLARE @Bloqueo      int;
    DECLARE @Error        nvarchar(4000);
    DECLARE @Cambios TABLE (Accion nvarchar(10) NOT NULL);

    -- Evita dos cargas simultáneas (por ejemplo, el job y una ejecución manual)
    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Actualizar_Informe_liberacion', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion', N'MERGE', @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        IF OBJECT_ID('tempdb..#Origen') IS NOT NULL DROP TABLE #Origen;

        /* ── Paso 1. Validar el formato del origen antes de convertir ── */
        SELECT
            @FilasOrigen = COUNT_BIG(1),
            @Malas = SUM(CASE
                WHEN [Código OP] IS NULL OR [Código OP] = '' OR [Código OP] LIKE '%[^0-9]%' OR LEN([Código OP]) > 9 THEN 1
                WHEN [Fecha Recomendada de Liberación] IS NULL
                  OR [Fecha Recomendada de Liberación] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha Real de Liberación] IS NOT NULL
                 AND [Fecha Real de Liberación] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha Prometida de Entrega] IS NOT NULL
                 AND [Fecha Prometida de Entrega] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha Prometida de Entrega Ítem] IS NOT NULL
                 AND [Fecha Prometida de Entrega Ítem] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha Recomendada de Entrega] IS NOT NULL
                 AND [Fecha Recomendada de Entrega] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha de Contabilización] IS NOT NULL
                 AND [Fecha de Contabilización] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Fecha de Actualización] IS NOT NULL
                 AND [Fecha de Actualización] NOT LIKE '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' THEN 1
                WHEN [Cantidad Total] LIKE '%[^0-9.-]%' OR [Cantidad Pendiente] LIKE '%[^0-9.-]%'
                  OR [Cantidad Total Item] LIKE '%[^0-9.-]%' OR [Cantidad Pendiente Item] LIKE '%[^0-9.-]%'
                  OR [Costo Unitario] LIKE '%[^0-9.-]%' THEN 1
                ELSE 0 END)
        FROM dbo.Indicador_Liberacion;

        IF @Malas > 0
        BEGIN
            SET @Error = N'Indicador_Liberacion tiene ' + CAST(@Malas AS nvarchar(20))
                       + N' filas con código, fecha o número en un formato inesperado (ver consulta 0.2).';
            RAISERROR (@Error, 16, 1);
        END

        SELECT @Vigentes = COUNT_BIG(1) FROM dbo.Informe_liberacion WHERE EnOrigen = 1;
        IF @FilasOrigen = 0 OR (@Vigentes > 0 AND @FilasOrigen < @Vigentes / 2)
        BEGIN
            SET @Error = N'El origen trae ' + CAST(@FilasOrigen AS nvarchar(20)) + N' OP y la tabla tiene '
                       + CAST(@Vigentes AS nvarchar(20)) + N' vigentes. ¿FPK_INDICADOR_LIBERACION está corriendo? No se cargó.';
            RAISERROR (@Error, 16, 1);
        END

        /* ── Paso 2. Origen con tipos reales ── */
        SELECT
            CAST([Código OP] AS int)                                          AS CodigoOP,
            NULLIF(LTRIM(RTRIM([Tipo])), '')                                  AS Tipo,
            NULLIF(LTRIM(RTRIM([SKU])), '')                                   AS SKU,
            NULLIF(LTRIM(RTRIM([Descripción de SKU])), '')                    AS DescripcionSKU,
            NULLIF(LTRIM(RTRIM([Destino])), '')                               AS Destino,
            NULLIF(LTRIM(RTRIM([Familia de Producción])), '')                 AS FamiliaProduccion,
            NULLIF(LTRIM(RTRIM([Linea])), '')                                 AS Linea,
            NULLIF(LTRIM(RTRIM([Estado])), '')                                AS Estado,
            NULLIF(LTRIM(RTRIM([Planta])), '')                                AS Planta,
            NULLIF(LTRIM(RTRIM([Num. Lote])), '')                             AS NumLote,
            CONVERT(date, [Fecha de Contabilización], 23)                     AS FechaContabilizacion,
            CONVERT(date, [Fecha Prometida de Entrega], 23)                   AS FechaPrometidaEntrega,
            CONVERT(date, [Fecha Prometida de Entrega Ítem], 23)              AS FechaPrometidaEntregaItem,
            CONVERT(date, [Fecha Recomendada de Liberación], 23)              AS FechaRecomendadaLiberacion,
            CONVERT(date, [Fecha Real de Liberación], 23)                     AS FechaRealLiberacion,
            CONVERT(date, [Fecha Recomendada de Entrega], 23)                 AS FechaRecomendadaEntrega,
            CONVERT(date, [Fecha de Actualización], 23)                       AS FechaActualizacion,
            CAST(NULLIF([Cantidad Total], '') AS decimal(18, 3))              AS CantidadTotal,
            CAST(NULLIF([Cantidad Pendiente], '') AS decimal(18, 3))          AS CantidadPendiente,
            CAST(NULLIF([Cantidad Total Item], '') AS decimal(18, 3))         AS CantidadTotalItem,
            CAST(NULLIF([Cantidad Pendiente Item], '') AS decimal(18, 3))     AS CantidadPendienteItem,
            CAST(NULLIF([Costo Unitario], '') AS decimal(18, 1))              AS CostoUnitario,
            NULLIF(LTRIM(RTRIM([Color Recomendado])), '')                     AS ColorRecomendado
        INTO #Origen
        FROM dbo.Indicador_Liberacion;

        -- Una fila por OP (consulta 3 de la fase 1). Si se repite, el MERGE fallaría a medias: se corta aquí.
        IF EXISTS (SELECT CodigoOP FROM #Origen GROUP BY CodigoOP HAVING COUNT_BIG(1) > 1)
            RAISERROR (N'Indicador_Liberacion tiene OP repetidas. No se cargó.', 16, 1);

        CREATE UNIQUE CLUSTERED INDEX IX_Origen ON #Origen (CodigoOP);

        /* ── Paso 3. MERGE ── */
        BEGIN TRANSACTION;

        MERGE dbo.Informe_liberacion AS t
        USING #Origen AS s
            ON t.CodigoOP = s.CodigoOP
        WHEN MATCHED THEN UPDATE SET
            t.Tipo = s.Tipo, t.SKU = s.SKU, t.DescripcionSKU = s.DescripcionSKU, t.Destino = s.Destino,
            t.FamiliaProduccion = s.FamiliaProduccion, t.Linea = s.Linea, t.Estado = s.Estado, t.Planta = s.Planta,
            t.NumLote = s.NumLote, t.FechaContabilizacion = s.FechaContabilizacion,
            t.FechaPrometidaEntrega = s.FechaPrometidaEntrega, t.FechaPrometidaEntregaItem = s.FechaPrometidaEntregaItem,
            t.FechaRecomendadaLiberacion = s.FechaRecomendadaLiberacion, t.FechaRealLiberacion = s.FechaRealLiberacion,
            t.FechaRecomendadaEntrega = s.FechaRecomendadaEntrega, t.FechaActualizacion = s.FechaActualizacion,
            t.CantidadTotal = s.CantidadTotal, t.CantidadPendiente = s.CantidadPendiente,
            t.CantidadTotalItem = s.CantidadTotalItem, t.CantidadPendienteItem = s.CantidadPendienteItem,
            t.CostoUnitario = s.CostoUnitario, t.ColorRecomendado = s.ColorRecomendado,
            t.EnOrigen = 1, t.UltimaCarga = @Inicio
        WHEN NOT MATCHED BY TARGET THEN INSERT (
            CodigoOP, Tipo, SKU, DescripcionSKU, Destino, FamiliaProduccion, Linea, Estado, Planta, NumLote,
            FechaContabilizacion, FechaPrometidaEntrega, FechaPrometidaEntregaItem, FechaRecomendadaLiberacion,
            FechaRealLiberacion, FechaRecomendadaEntrega, FechaActualizacion, CantidadTotal, CantidadPendiente,
            CantidadTotalItem, CantidadPendienteItem, CostoUnitario, ColorRecomendado, EnOrigen, PrimeraCarga, UltimaCarga)
        VALUES (
            s.CodigoOP, s.Tipo, s.SKU, s.DescripcionSKU, s.Destino, s.FamiliaProduccion, s.Linea, s.Estado, s.Planta, s.NumLote,
            s.FechaContabilizacion, s.FechaPrometidaEntrega, s.FechaPrometidaEntregaItem, s.FechaRecomendadaLiberacion,
            s.FechaRealLiberacion, s.FechaRecomendadaEntrega, s.FechaActualizacion, s.CantidadTotal, s.CantidadPendiente,
            s.CantidadTotalItem, s.CantidadPendienteItem, s.CostoUnitario, s.ColorRecomendado, 1, @Inicio, @Inicio)
        -- Salió del origen pero su fecha prometida sigue en la ventana: se canceló o dejó de cumplir los
        -- filtros del SP de origen. Se borra, como en el origen.
        WHEN NOT MATCHED BY SOURCE AND (t.FechaPrometidaEntrega IS NULL OR t.FechaPrometidaEntrega >= @LimiteVentana) THEN
            DELETE
        -- Salió por la ventana de 365 días: se conserva como historia.
        WHEN NOT MATCHED BY SOURCE AND t.EnOrigen = 1 THEN
            UPDATE SET t.EnOrigen = 0
        OUTPUT $action INTO @Cambios (Accion);

        COMMIT TRANSACTION;

        SELECT @Insertados   = SUM(CASE WHEN Accion = N'INSERT' THEN 1 ELSE 0 END),
               @Actualizados = SUM(CASE WHEN Accion = N'UPDATE' THEN 1 ELSE 0 END),
               @Eliminados   = SUM(CASE WHEN Accion = N'DELETE' THEN 1 ELSE 0 END)
        FROM @Cambios;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion', N'MERGE', @Inicio, sysdatetime(),
                ISNULL(@Eliminados, 0), ISNULL(@Insertados, 0) + ISNULL(@Actualizados, 0), NULL);

        DROP TABLE #Origen;
        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_liberacion', @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_liberacion', N'MERGE', @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_liberacion', @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_liberacion;

/* ───────────── 4. Validación (solo lectura) ───────────── */

-- 4.1 Última carga en la bitácora. Esperado: Error NULL; en la primera carga Insertados = filas del origen.
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_liberacion' ORDER BY Inicio DESC;

-- 4.2 Mismas OP que el origen. Esperado: SoloEnOrigen = 0, SoloEnTabla = 0 (en la primera carga) y
--     Distintas = 0. Después de días de uso, SoloEnTabla = OP con EnOrigen = 0 (historia).
-- SELECT
--     SUM(CASE WHEN t.CodigoOP IS NULL THEN 1 ELSE 0 END) AS SoloEnOrigen,
--     SUM(CASE WHEN o.[Código OP] IS NULL THEN 1 ELSE 0 END) AS SoloEnTabla,
--     SUM(CASE WHEN o.[Código OP] IS NOT NULL AND t.CodigoOP IS NOT NULL
--               AND (CONVERT(date, o.[Fecha Recomendada de Liberación], 23) <> t.FechaRecomendadaLiberacion
--                    OR ISNULL(CONVERT(date, o.[Fecha Real de Liberación], 23), '19000101') <> ISNULL(t.FechaRealLiberacion, '19000101'))
--              THEN 1 ELSE 0 END) AS Distintas
-- FROM dbo.Indicador_Liberacion o
-- FULL JOIN dbo.Informe_liberacion t ON t.CodigoOP = CAST(o.[Código OP] AS int);

-- 4.3 Estado por mes con la regla del BI, SIN las razones de Planeación. Esperado: igual a la consulta 4
--     de la fase 1 para los mismos meses (ago 2026: 1.630 OK / 437 NO), salvo OP liberadas después del 2026-11-04.
-- SELECT YEAR(FechaRecomendadaLiberacion) AS Anio, MONTH(FechaRecomendadaLiberacion) AS Mes,
--        SUM(CASE WHEN FechaRealLiberacion IS NOT NULL AND FechaRealLiberacion <= FechaRecomendadaLiberacion THEN 1 ELSE 0 END) AS OK,
--        SUM(CASE WHEN (FechaRealLiberacion IS NOT NULL AND FechaRealLiberacion > FechaRecomendadaLiberacion)
--                   OR (FechaRealLiberacion IS NULL AND FechaRecomendadaLiberacion < CAST(GETDATE() AS date)) THEN 1 ELSE 0 END) AS NO,
--        SUM(CASE WHEN FechaRealLiberacion IS NULL AND FechaRecomendadaLiberacion >= CAST(GETDATE() AS date) THEN 1 ELSE 0 END) AS SinLiberar
-- FROM dbo.Informe_liberacion
-- GROUP BY YEAR(FechaRecomendadaLiberacion), MONTH(FechaRecomendadaLiberacion)
-- ORDER BY Anio, Mes;

-- 4.4 Totales de cantidades contra el origen. Esperado: diferencias en 0.
-- SELECT
--     (SELECT SUM(CAST([Cantidad Total] AS decimal(18, 3))) FROM dbo.Indicador_Liberacion)
--       - (SELECT SUM(CantidadTotal) FROM dbo.Informe_liberacion WHERE EnOrigen = 1) AS DifCantidadTotal,
--     (SELECT COUNT_BIG(1) FROM dbo.Indicador_Liberacion)
--       - (SELECT COUNT_BIG(1) FROM dbo.Informe_liberacion WHERE EnOrigen = 1) AS DifFilas;
