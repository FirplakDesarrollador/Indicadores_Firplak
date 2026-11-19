/*
  BI NS Plantas (nivel de servicio de órdenes de fabricación): calendario laboral, tabla de reporte
  y SP de carga incremental.
  Ficha: llm-wiki/bi/ns-plantas.md (sección 2, diseño aprobado por el desarrollador el 2026-11-18).

  Base: SQL original de la tabla 'Ordenes de Fabricacion' del BI (ficha, fase 1), con los cambios
  aprobados:
    - Toda la historia (sin la ventana de 12 meses del BI). Respuesta 4 de Manufactura.
    - La fecha ideal se calcula por conjuntos contra dbo.Calendario_Laboral, en lugar de la
      subconsulta por fila contra @FIR_FECHAS_PROD. Misma regla:
        amortiguador 1 -> fecha de liberación;
        N > 1          -> el día hábil N - 1 después de la liberación (la liberación cuenta como día 1),
                          si cae dentro de min(30, 3 x N) días calendario; si no, NULL.
    - Calendario laboral: sábados, domingos y festivos de Colombia (Ley 51 de 1983, por fórmula)
      más las fechas de @FIR_FECHAS_PROD (días propios de Firplak). De 2013 a 2040.
    - Cierre en sábado -> viernes (FechaCierreAjustada), como la columna 'Fecha de Cierre Real 2'.
    - El cumplimiento (CUMPLIÓ / INCUMPLIÓ / en curso) NO se guarda: depende de la fecha de hoy y se
      calcula en la API (pregunta 3: solo cuentan las OP con FechaIdealEntrega < hoy).

  Estrategia incremental (consultas previas del 2026-11-18):
    - Cada corrida recarga las OP abiertas (Status = 'R'), las modificadas en los últimos
      @DiasModificadas días (OWOR.UpdateDate se mueve al cerrar) y las que la tabla tiene como
      'Liberado'. Se borran por DocEntry y se vuelven a insertar.
    - Carga completa (@CargaCompleta = 1) el domingo: reconstruye el calendario (recoge días nuevos
      de @FIR_FECHAS_PROD) y recarga toda la historia (~269.000 OP).

  Compatibilidad: Planos_Symphony y Firplak_SA están en nivel 100 (SQL Server 2016 SP2).
  Sin CTE, APPLY, TRY_CONVERT, CREATE OR ALTER ni THROW. DATEFROMPARTS sí funciona.
  SAP solo se lee (SELECT). Bitácora: dbo.Cargas_Log (ya existe).

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 1) tablas e índices  2) SP del calendario  3) SP del informe  4) primera carga
         5) validación  6) job (02_job_ns_plantas.sql)
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tablas ───────────── */

-- 1.1 Calendario laboral: una fila por día, de 2013 a 2040.
--     NumDiaHabil: en los días hábiles, su número de orden (1, 2, 3…); en los no hábiles, el del
--     último día hábil anterior. Así, "día hábil N - 1 después de la liberación" es el día hábil
--     cuyo NumDiaHabil = NumDiaHabil(liberación) + N - 1, también si la liberación fue un sábado.
IF OBJECT_ID(N'dbo.Calendario_Laboral', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Calendario_Laboral (
        Fecha        date          NOT NULL,
        EsLaborable  bit           NOT NULL,
        Motivo       nvarchar(60)  NULL,       -- Festivo de ley, 'Sábado', 'Domingo' o 'Día no laborable Firplak (SAP)'
        NumDiaHabil  int           NOT NULL,
        FechaCarga   datetime2(0)  NOT NULL,
        CONSTRAINT PK_Calendario_Laboral PRIMARY KEY CLUSTERED (Fecha)
    );

    -- Búsqueda de la fecha ideal: día hábil con un NumDiaHabil dado
    CREATE NONCLUSTERED INDEX IX_Calendario_Laboral_NumDiaHabil
        ON dbo.Calendario_Laboral (NumDiaHabil, EsLaborable)
        INCLUDE (Fecha);
END
GO

-- 1.2 Tabla de reporte: una fila por OP.
IF OBJECT_ID(N'dbo.Informe_ns_plantas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_ns_plantas (
        DocEntry             int            NOT NULL,   -- Clave interna de SAP
        DocNum               int            NOT NULL,   -- '# Documento' (único en toda la historia, consulta previa 2)
        FechaCreacion        date           NOT NULL,
        CodArticulo          nvarchar(50)   NOT NULL,
        Articulo             nvarchar(200)  NULL,
        CantidadPlaneada     decimal(19, 6) NULL,       -- El BI la redondeaba a entero
        TipoOrden            nvarchar(30)   NULL,       -- STANDARD | STOCK | NULL
        TipoPedido           nvarchar(30)   NULL,       -- ORDR.U_TipoPedidos
        Bodega               nvarchar(8)    NOT NULL,   -- PT-01 | PT-02 | PT-08
        Estado               nvarchar(20)   NOT NULL,   -- Liberado (R) | Cerrado (L)
        FechaLiberacion      date           NOT NULL,
        FechaCierre          date           NULL,
        FechaCierreAjustada  date           NULL,       -- Cierre en sábado -> viernes
        Familia              nvarchar(30)   NULL,       -- @FIR_FAM_SYMPH.U_FIR_FAM
        Planta               nvarchar(30)   NOT NULL,   -- Agrupación de la familia (8 valores, respuesta 8)
        Amortiguador         smallint       NULL,       -- Días de plazo de la familia
        FechaIdealEntrega    date           NULL,       -- Fecha de referencia del dashboard
        RazonRetraso         nvarchar(100)  NULL,
        RazonRetraso2        nvarchar(100)  NULL,
        FechaCarga           datetime2(0)   NOT NULL,
        CONSTRAINT PK_Informe_ns_plantas PRIMARY KEY CLUSTERED (DocEntry)
    );

    -- Resumen y gráficas por periodo (todos los filtros de periodo van por la fecha ideal)
    CREATE NONCLUSTERED INDEX IX_Informe_ns_plantas_FechaIdeal
        ON dbo.Informe_ns_plantas (FechaIdealEntrega)
        INCLUDE (Planta, FechaCierreAjustada, Estado, RazonRetraso);

    -- Filtro de planta combinado con el periodo
    CREATE NONCLUSTERED INDEX IX_Informe_ns_plantas_Planta
        ON dbo.Informe_ns_plantas (Planta, FechaIdealEntrega)
        INCLUDE (FechaCierreAjustada, Estado, RazonRetraso);
END
GO

/* ───────────── 2. SP del calendario laboral ─────────────
   Reconstruye dbo.Calendario_Laboral completo. Lo llama el SP del informe en la carga completa;
   también se puede ejecutar solo. Tarda menos de un segundo (~10.200 días). */
IF OBJECT_ID(N'dbo.sp_Actualizar_Calendario_Laboral', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Calendario_Laboral;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Calendario_Laboral
    @Desde date = '20130101',
    @Hasta date = '20401231'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF OBJECT_ID('tempdb..#Dias') IS NOT NULL DROP TABLE #Dias;
    IF OBJECT_ID('tempdb..#Anios') IS NOT NULL DROP TABLE #Anios;
    IF OBJECT_ID('tempdb..#Festivos') IS NOT NULL DROP TABLE #Festivos;
    IF OBJECT_ID('tempdb..#Sap') IS NOT NULL DROP TABLE #Sap;
    IF OBJECT_ID('tempdb..#Cal') IS NOT NULL DROP TABLE #Cal;

    -- Días del rango (hasta 100.000 con cinco dígitos)
    CREATE TABLE #Dias (Fecha date NOT NULL PRIMARY KEY);
    INSERT INTO #Dias (Fecha)
    SELECT DATEADD(DAY, n.n, @Desde)
    FROM (
        SELECT a.d + 10 * b.d + 100 * c.d + 1000 * e.d + 10000 * f.d AS n
        FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) a(d)
        CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) b(d)
        CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) c(d)
        CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) e(d)
        CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) f(d)
    ) n
    WHERE n.n <= DATEDIFF(DAY, @Desde, @Hasta);

    -- Domingo de Pascua de cada año (algoritmo de Gauss/Meeus, calendario gregoriano)
    CREATE TABLE #Anios (Anio int NOT NULL PRIMARY KEY, Pascua date NULL);
    INSERT INTO #Anios (Anio)
    SELECT DISTINCT YEAR(Fecha) FROM #Dias;

    UPDATE a
    SET a.Pascua = p.Pascua
    FROM #Anios a
    INNER JOIN (
        SELECT Anio,
               DATEFROMPARTS(Anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1) AS Pascua
        FROM (
            SELECT Anio, h, l, (g + 11 * h + 22 * l) / 451 AS m
            FROM (
                SELECT Anio, g, h, (32 + 2 * e + 2 * i - h - k) % 7 AS l
                FROM (
                    SELECT Anio, g, e, i, k, (19 * g + b - d - (b - f + 1) / 3 + 15) % 30 AS h
                    FROM (
                        SELECT Anio, g, b, b / 4 AS d, b % 4 AS e, (b + 8) / 25 AS f, c / 4 AS i, c % 4 AS k
                        FROM (SELECT Anio, Anio % 19 AS g, Anio / 100 AS b, Anio % 100 AS c FROM #Anios) x1
                    ) x2
                ) x3
            ) x4
        ) x5
    ) p ON p.Anio = a.Anio;

    -- Festivos de Colombia (Ley 51 de 1983). 1900-01-01 fue lunes: DATEDIFF(...) % 7 = 0 es lunes.
    CREATE TABLE #Festivos (Fecha date NOT NULL, Nombre nvarchar(60) NOT NULL);

    -- Fechas fijas; AlLunes = 1: se corre al lunes siguiente si no cae en lunes
    INSERT INTO #Festivos (Fecha, Nombre)
    SELECT CASE WHEN x.AlLunes = 1
                THEN DATEADD(DAY, (7 - DATEDIFF(DAY, '19000101', x.Fecha) % 7) % 7, x.Fecha)
                ELSE x.Fecha END,
           x.Nombre
    FROM (
        SELECT DATEFROMPARTS(a.Anio, f.Mes, f.Dia) AS Fecha, f.AlLunes, f.Nombre
        FROM #Anios a
        CROSS JOIN (VALUES
            (1, 1, 0, N'Año Nuevo'),
            (1, 6, 1, N'Reyes Magos'),
            (3, 19, 1, N'San José'),
            (5, 1, 0, N'Día del Trabajo'),
            (6, 29, 1, N'San Pedro y San Pablo'),
            (7, 20, 0, N'Día de la Independencia'),
            (8, 7, 0, N'Batalla de Boyacá'),
            (8, 15, 1, N'Asunción de la Virgen'),
            (10, 12, 1, N'Día de la Raza'),
            (11, 1, 1, N'Todos los Santos'),
            (11, 11, 1, N'Independencia de Cartagena'),
            (12, 8, 0, N'Inmaculada Concepción'),
            (12, 25, 0, N'Navidad')
        ) f(Mes, Dia, AlLunes, Nombre)
    ) x;

    -- Fechas que dependen de la Pascua (las de 43, 64 y 71 días ya caen en lunes)
    INSERT INTO #Festivos (Fecha, Nombre)
    SELECT DATEADD(DAY, e.Dias, a.Pascua), e.Nombre
    FROM #Anios a
    CROSS JOIN (VALUES
        (-3, N'Jueves Santo'),
        (-2, N'Viernes Santo'),
        (43, N'Ascensión del Señor'),
        (64, N'Corpus Christi'),
        (71, N'Sagrado Corazón')
    ) e(Dias, Nombre);

    -- Días no laborables propios de Firplak, cargados en SAP
    CREATE TABLE #Sap (Fecha date NOT NULL PRIMARY KEY);
    INSERT INTO #Sap (Fecha)
    SELECT DISTINCT CAST(fp.U_Fecha AS date)
    FROM Firplak_SA.dbo.[@FIR_FECHAS_PROD] fp WITH (NOLOCK)
    WHERE fp.U_Fecha IS NOT NULL;

    -- Calendario. Si dos festivos caen el mismo día (p. ej. 2025-06-30), queda uno solo.
    CREATE TABLE #Cal (
        Fecha        date          NOT NULL PRIMARY KEY,
        EsLaborable  bit           NOT NULL,
        Motivo       nvarchar(60)  NULL,
        NumDiaHabil  int           NULL
    );
    INSERT INTO #Cal (Fecha, EsLaborable, Motivo)
    SELECT y.Fecha, CASE WHEN y.Motivo IS NULL THEN 1 ELSE 0 END, y.Motivo
    FROM (
        SELECT d.Fecha,
               COALESCE(
                   (SELECT MIN(f.Nombre) FROM #Festivos f WHERE f.Fecha = d.Fecha),
                   CASE DATEDIFF(DAY, '19000101', d.Fecha) % 7 WHEN 5 THEN N'Sábado' WHEN 6 THEN N'Domingo' END,
                   CASE WHEN EXISTS (SELECT 1 FROM #Sap s WHERE s.Fecha = d.Fecha) THEN N'Día no laborable Firplak (SAP)' END
               ) AS Motivo
        FROM #Dias d
    ) y;

    -- Número de día hábil
    UPDATE c
    SET c.NumDiaHabil = r.Num
    FROM #Cal c
    INNER JOIN (
        SELECT Fecha, ROW_NUMBER() OVER (ORDER BY Fecha) AS Num
        FROM #Cal
        WHERE EsLaborable = 1
    ) r ON r.Fecha = c.Fecha;

    UPDATE c
    SET c.NumDiaHabil = ISNULL((SELECT TOP (1) w.NumDiaHabil
                                FROM #Cal w
                                WHERE w.EsLaborable = 1 AND w.Fecha < c.Fecha
                                ORDER BY w.Fecha DESC), 0)
    FROM #Cal c
    WHERE c.EsLaborable = 0;

    BEGIN TRANSACTION;
        DELETE FROM dbo.Calendario_Laboral;
        INSERT INTO dbo.Calendario_Laboral (Fecha, EsLaborable, Motivo, NumDiaHabil, FechaCarga)
        SELECT Fecha, EsLaborable, Motivo, NumDiaHabil, sysdatetime()
        FROM #Cal;
    COMMIT TRANSACTION;

    DROP TABLE #Dias, #Anios, #Festivos, #Sap, #Cal;
END
GO

/* ───────────── 3. SP del informe ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_ns_plantas', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Informe_ns_plantas;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Informe_ns_plantas
    @CargaCompleta   bit = 0,   -- 1 = calendario + toda la historia (primera carga y domingo)
    @DiasModificadas int = 7    -- Incremental: OP con OWOR.UpdateDate en los últimos N días
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Inicio     datetime2(0) = sysdatetime();
    DECLARE @Modo       nvarchar(20) = CASE WHEN @CargaCompleta = 1 THEN N'COMPLETA' ELSE N'INCREMENTAL' END;
    DECLARE @Desde      date = DATEADD(DAY, -@DiasModificadas, CAST(GETDATE() AS date));
    DECLARE @Eliminados int = 0;
    DECLARE @Insertados int = 0;
    DECLARE @Duplicados int = 0;
    DECLARE @Bloqueo    int;
    DECLARE @Error      nvarchar(4000);

    -- Evita dos cargas simultáneas (por ejemplo, el job y una ejecución manual)
    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Actualizar_Informe_ns_plantas', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_ns_plantas', @Modo, @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        IF OBJECT_ID('tempdb..#Candidatas') IS NOT NULL DROP TABLE #Candidatas;
        IF OBJECT_ID('tempdb..#Base') IS NOT NULL DROP TABLE #Base;

        /* ── Paso 1. Calendario (solo en la carga completa) ── */
        IF @CargaCompleta = 1
            EXEC dbo.sp_Actualizar_Calendario_Laboral;

        /* ── Paso 2. OP que se recargan en la incremental ──
           Abiertas, modificadas en la ventana y las que la tabla tiene abiertas (por si cambiaron de
           estado sin pasar por la ventana). Las que ya no cumplen los filtros (p. ej. canceladas)
           se borran y no se vuelven a insertar. */
        CREATE TABLE #Candidatas (DocEntry int NOT NULL PRIMARY KEY);
        IF @CargaCompleta = 0
        BEGIN
            INSERT INTO #Candidatas (DocEntry)
            SELECT T0.DocEntry
            FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
            WHERE T0.Status = 'R' OR T0.UpdateDate >= @Desde
            UNION
            SELECT i.DocEntry
            FROM dbo.Informe_ns_plantas i
            WHERE i.Estado = N'Liberado';
        END

        /* ── Paso 3. OP de SAP con los filtros y uniones del BI (sin la ventana de 12 meses) ── */
        CREATE TABLE #Base (
            DocEntry          int            NOT NULL,
            DocNum            int            NOT NULL,
            FechaCreacion     date           NOT NULL,
            CodArticulo       nvarchar(50)   NOT NULL,
            Articulo          nvarchar(200)  NULL,
            CantidadPlaneada  decimal(19, 6) NULL,
            TipoOrden         nvarchar(30)   NULL,
            TipoPedido        nvarchar(30)   NULL,
            Bodega            nvarchar(8)    NOT NULL,
            Estado            nvarchar(20)   NOT NULL,
            FechaLiberacion   date           NOT NULL,
            FechaCierre       date           NULL,
            Familia           nvarchar(30)   NULL,
            AmortiguadorSap   decimal(9, 2)  NULL,
            RazonRetraso      nvarchar(100)  NULL,
            RazonRetraso2     nvarchar(100)  NULL
        );

        INSERT INTO #Base (
            DocEntry, DocNum, FechaCreacion, CodArticulo, Articulo, CantidadPlaneada, TipoOrden, TipoPedido,
            Bodega, Estado, FechaLiberacion, FechaCierre, Familia, AmortiguadorSap, RazonRetraso, RazonRetraso2
        )
        SELECT
            T0.DocEntry,
            T0.DocNum,
            CAST(T0.CreateDate AS date),
            LTRIM(RTRIM(T0.ItemCode)),
            NULLIF(LTRIM(RTRIM(T0.ProdName)), N''),
            CONVERT(decimal(19, 6), T0.PlannedQty),
            NULLIF(UPPER(LTRIM(RTRIM(T0.U_Tipo_Orden))), N''),
            NULLIF(LTRIM(RTRIM(T2.U_TipoPedidos)), N''),
            T0.Warehouse,
            CASE T0.Status WHEN 'R' THEN N'Liberado' WHEN 'L' THEN N'Cerrado' END,
            CAST(T0.RlsDate AS date),
            CAST(T0.CloseDate AS date),
            NULLIF(UPPER(LTRIM(RTRIM(T3.U_FIR_FAM))), N''),
            CONVERT(decimal(9, 2), T4.U_Amortiguador),
            NULLIF(LTRIM(RTRIM(T0.U_U_Razonderetraso)), N''),
            NULLIF(LTRIM(RTRIM(T0.U_U_Razonderetraso2)), N'')
        FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
            INNER JOIN Firplak_SA.dbo.OITM T1 WITH (NOLOCK) ON T0.ItemCode = T1.ItemCode
            INNER JOIN Firplak_SA.dbo.ORDR T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
            INNER JOIN Firplak_SA.dbo.[@FIR_FAM_SYMPH] T3 WITH (NOLOCK) ON T1.U_Familia = T3.U_FIR_FAM_MAES
                AND T3.U_FIR_TIPO_PED = T2.U_TipoPedidos
            INNER JOIN Firplak_SA.dbo.[@FIR_AMORTIGUADORES] T4 WITH (NOLOCK) ON T3.U_FIR_FAM = T4.Name
                COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE T0.RlsDate IS NOT NULL
            AND T0.Status NOT IN ('C', 'P')
            AND T0.U_NumLote <> ''
            AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
            AND (@CargaCompleta = 1 OR T0.DocEntry IN (SELECT c.DocEntry FROM #Candidatas c))
        OPTION (RECOMPILE);   -- El plan de la completa y el de la incremental son muy distintos

        -- Las uniones con ORDR, @FIR_FAM_SYMPH y @FIR_AMORTIGUADORES podrían duplicar una OP si cambia
        -- la configuración en SAP. Hoy no pasa (consulta previa 2); si pasa, la carga falla con aviso
        -- y la tabla conserva los datos anteriores.
        SELECT @Duplicados = COUNT(1)
        FROM (SELECT DocEntry FROM #Base GROUP BY DocEntry HAVING COUNT(1) > 1) d;
        IF @Duplicados > 0
        BEGIN
            SET @Error = N'Hay ' + CAST(@Duplicados AS nvarchar(10))
                       + N' OP repetidas por las uniones con ORDR, @FIR_FAM_SYMPH o @FIR_AMORTIGUADORES. Se conserva la carga anterior.';
            RAISERROR (N'%s', 16, 1, @Error);
        END

        IF @CargaCompleta = 1 AND NOT EXISTS (SELECT 1 FROM #Base)
            RAISERROR (N'La carga completa no devolvió filas; se conserva la carga anterior.', 16, 1);

        /* ── Paso 4. Reemplazo en la tabla de reporte ── */
        BEGIN TRANSACTION;

            IF @CargaCompleta = 1
            BEGIN
                SELECT @Eliminados = COUNT(1) FROM dbo.Informe_ns_plantas WITH (TABLOCKX);
                TRUNCATE TABLE dbo.Informe_ns_plantas;
            END
            ELSE
            BEGIN
                DELETE i
                FROM dbo.Informe_ns_plantas i
                INNER JOIN #Candidatas c ON c.DocEntry = i.DocEntry;
                SET @Eliminados = @@ROWCOUNT;
            END

            INSERT INTO dbo.Informe_ns_plantas (
                DocEntry, DocNum, FechaCreacion, CodArticulo, Articulo, CantidadPlaneada, TipoOrden, TipoPedido,
                Bodega, Estado, FechaLiberacion, FechaCierre, FechaCierreAjustada, Familia, Planta, Amortiguador,
                FechaIdealEntrega, RazonRetraso, RazonRetraso2, FechaCarga
            )
            SELECT
                b.DocEntry, b.DocNum, b.FechaCreacion, b.CodArticulo, b.Articulo, b.CantidadPlaneada,
                b.TipoOrden, b.TipoPedido, b.Bodega, b.Estado, b.FechaLiberacion, b.FechaCierre,
                -- 'Fecha de Cierre Real 2': cierre en sábado -> viernes (DATEDIFF(...) % 7 = 5 es sábado)
                CASE WHEN DATEDIFF(DAY, '19000101', b.FechaCierre) % 7 = 5
                     THEN DATEADD(DAY, -1, b.FechaCierre)
                     ELSE b.FechaCierre END,
                b.Familia,
                -- 'Familia Producción (grupos)' del BI
                CASE
                    WHEN b.Familia IN (N'FV', N'FVH', N'FVHM', N'FVHMP', N'FVHMPM', N'FVM') THEN N'FIBRA'
                    WHEN b.Familia IN (N'PA', N'PAM', N'PC', N'PCM')                       THEN N'MARMOL'
                    WHEN b.Familia IN (N'MBL', N'MBLM', N'PTTM')                           THEN N'MUEBLE'
                    WHEN b.Familia IN (N'RTM', N'RTMM')                                    THEN N'RTM'
                    WHEN b.Familia IS NULL                                                 THEN N'(En blanco)'
                    ELSE b.Familia
                END,
                CONVERT(smallint, CONVERT(numeric(4, 0), b.AmortiguadorSap)),
                -- Fecha ideal de entrega
                CASE
                    WHEN b.AmortiguadorSap = 1 THEN b.FechaLiberacion
                    WHEN b.AmortiguadorSap >= 2 AND b.AmortiguadorSap = FLOOR(b.AmortiguadorSap)
                         AND DATEDIFF(DAY, b.FechaLiberacion, c1.Fecha)
                             <= CASE WHEN b.AmortiguadorSap * 3 < 30 THEN b.AmortiguadorSap * 3 ELSE 30 END
                        THEN c1.Fecha
                    ELSE NULL
                END,
                b.RazonRetraso, b.RazonRetraso2,
                @Inicio
            FROM #Base b
                LEFT JOIN dbo.Calendario_Laboral c0 ON c0.Fecha = b.FechaLiberacion
                LEFT JOIN dbo.Calendario_Laboral c1 ON c1.EsLaborable = 1
                    AND c1.NumDiaHabil = c0.NumDiaHabil + CONVERT(int, b.AmortiguadorSap) - 1
                    AND b.AmortiguadorSap >= 2 AND b.AmortiguadorSap = FLOOR(b.AmortiguadorSap)
            OPTION (RECOMPILE);
            SET @Insertados = @@ROWCOUNT;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_ns_plantas', @Modo, @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE #Candidatas, #Base;
        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_ns_plantas', @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_ns_plantas', @Modo, @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_ns_plantas', @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 4. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_ns_plantas @CargaCompleta = 1;

/* ───────────── 5. Validación (solo lectura) ───────────── */

-- 5.1 Última carga en la bitácora. Esperado: Error NULL e Insertados ~268.700
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_ns_plantas' ORDER BY Inicio DESC;

-- 5.2 Calendario: no laborables por año. Un festivo que cae en fin de semana se cuenta en EntreSemana
--     (su Motivo es el nombre del festivo). Esperado: EntreSemana = 18 festivos por año (17 cuando dos
--     caen el mismo lunes, p. ej. 2014-06-30) + días de SAP. Resultado del 2026-11-18: 2025 = 20,
--     2026 = 21, 2027 = 21; FinDeSemana + EntreSemana + Habiles = días del año.
-- SELECT YEAR(Fecha) AS Anio,
--        SUM(CASE WHEN Motivo IN (N'Sábado', N'Domingo') THEN 1 ELSE 0 END) AS FinDeSemana,
--        SUM(CASE WHEN EsLaborable = 0 AND Motivo NOT IN (N'Sábado', N'Domingo') THEN 1 ELSE 0 END) AS EntreSemana,
--        SUM(CASE WHEN EsLaborable = 1 THEN 1 ELSE 0 END) AS Habiles
-- FROM dbo.Calendario_Laboral GROUP BY YEAR(Fecha) ORDER BY Anio;

-- 5.3 Volumen por año de creación. Esperado: igual a la consulta previa 1
--     (2013: 6.962 … 2025: 34.453; 2026: 24.269 al 2026-11-18, más las creadas después)
-- SELECT YEAR(FechaCreacion) AS Anio, COUNT_BIG(1) AS Ops,
--        SUM(CASE WHEN FechaIdealEntrega IS NULL THEN 1 ELSE 0 END) AS SinFechaIdeal
-- FROM dbo.Informe_ns_plantas GROUP BY YEAR(FechaCreacion) ORDER BY Anio;

-- 5.4 Fecha ideal contra el BI. En la MISMA ventana de SSMS: ejecutar primero el paso 0 de
--     bi-origen/bi-ns-plantas/sql/validacion-fase1.sql (crea #ns con el SQL original del BI) y luego esta
--     consulta. Esperado: SoloEnBI = 0 y FechaIdealDistinta = 0 (de 2025 a 2027 los calendarios son iguales).
--     SoloEnTabla > 0 es normal solo si se crearon OP entre la carga y la ejecución del paso 0, o en el
--     día del límite de 12 meses (el BI corta por fecha y hora; aquí, por fecha).
-- SELECT
--     SUM(CASE WHEN t.DocNum IS NULL THEN 1 ELSE 0 END) AS SoloEnBI,
--     SUM(CASE WHEN n.[# Documento] IS NULL THEN 1 ELSE 0 END) AS SoloEnTabla,
--     SUM(CASE WHEN n.[# Documento] IS NOT NULL AND t.DocNum IS NOT NULL
--               AND ISNULL(CAST(n.[Fecha ideal Entrega] AS date), '19000101') <> ISNULL(t.FechaIdealEntrega, '19000101')
--              THEN 1 ELSE 0 END) AS FechaIdealDistinta,
--     SUM(CASE WHEN n.[# Documento] IS NOT NULL AND t.DocNum IS NOT NULL THEN 1 ELSE 0 END) AS EnAmbos
-- FROM #ns n
-- FULL JOIN (SELECT DocNum, FechaIdealEntrega FROM dbo.Informe_ns_plantas
--            WHERE FechaCreacion >= CAST(DATEADD(YEAR, -1, GETDATE()) AS date)) t
--     ON t.DocNum = n.[# Documento];

-- 5.5 Nivel de servicio del mes en curso, con la regla del BI (pregunta 3: solo OP con fecha ideal
--     vencida). Comparar con la tarjeta "NIVEL DE SERVICIO" del BI actualizado el mismo día.
-- SELECT Planta,
--        COUNT_BIG(1) AS Vencidas,
--        SUM(CASE WHEN FechaCierreAjustada <= FechaIdealEntrega THEN 1 ELSE 0 END) AS Cumplio,
--        CAST(100.0 * SUM(CASE WHEN FechaCierreAjustada <= FechaIdealEntrega THEN 1 ELSE 0 END) / COUNT_BIG(1) AS decimal(5, 2)) AS PctCumplimiento
-- FROM dbo.Informe_ns_plantas
-- WHERE FechaIdealEntrega >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
--   AND FechaIdealEntrega < CAST(GETDATE() AS date)
-- GROUP BY Planta WITH ROLLUP
-- ORDER BY Planta;

-- 5.6 Carga incremental (después de la completa). Esperado: Error NULL; Eliminados e Insertados de
--     unos cientos (las ~400 OP abiertas más las modificadas en 7 días); total de filas igual o mayor.
-- EXEC dbo.sp_Actualizar_Informe_ns_plantas;
-- SELECT TOP (2) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_ns_plantas' ORDER BY Inicio DESC;
-- SELECT COUNT_BIG(1) AS Filas FROM dbo.Informe_ns_plantas;

/* ───────────── 6. Job: ver 02_job_ns_plantas.sql ───────────── */
