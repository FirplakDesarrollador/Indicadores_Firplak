/*
  BI Costo actual de producto terminado: tabla de reporte y SP de carga completa.
  Ficha: llm-wiki/bi/costo-actual-pt.md (sección 2).

  Base: bi-origen/bi-costo-actual-pt/query-optimizado.sql, con los cambios aprobados en la fase 1:
    - D9 / P10: se desglosan TODOS los niveles de la lista de materiales (antes, corte en el nivel 4).
    - P2: un artículo marcado como MO (QryGroup39) y CIF (QryGroup40) a la vez NO se costea:
      sus costos quedan en 0 y la línea lleva la alerta 'MO Y CIF A LA VEZ'.
    - Protección de estructura: ciclos en la lista y tope de niveles (@MaxNiveles) se marcan en Alerta.

  Estrategia: carga completa cada hora. El SP arma el resultado en tablas temporales, lo inserta en
  dbo.Informe_costo_pt_Carga y lo intercambia con dbo.Informe_costo_pt con ALTER TABLE ... SWITCH
  (operación de metadatos), para que la API nunca vea la tabla vacía ni quede bloqueada por segundos.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 1) tablas e índices  2) SP  3) primera carga  4) validación  5) job
  El SP lee FIRPLAK_SA (misma instancia ITPLAKINFO) con nombres de tres partes.
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tablas (reporte y carga) ─────────────
   Las dos deben tener exactamente las mismas columnas e índices para que funcione el SWITCH.
   Si cambias una, cambia la otra. */

IF OBJECT_ID(N'dbo.Informe_costo_pt', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_costo_pt (
        CodigoPT          nvarchar(50)   NOT NULL,   -- Producto (nivel 1) al que pertenece la línea (RootCode)
        SortPath          varchar(400)   NOT NULL,   -- Orden jerárquico: CodigoPT.0001.0003...
        Nivel             int            NOT NULL,   -- 1 = producto; 2..n = componentes
        Codigo            nvarchar(50)   NOT NULL,
        Descripcion       nvarchar(200)  NULL,
        UnidadMedida      nvarchar(20)   NULL,
        Bodega            nvarchar(20)   NULL,       -- ITT1.Warehouse (nulo en el nivel 1)
        TieneHijos        bit            NOT NULL,   -- 1 = encabezado (su costo está en sus hijos)
        Clasificacion     varchar(3)     NULL,       -- MP | MO | CIF en las hojas; nulo en encabezados y MO+CIF
        Cantidad          decimal(38, 6) NOT NULL,   -- Cantidad acumulada (producto de las cantidades de sus padres)
        Costo_Unitario    decimal(38, 6) NOT NULL,
        Costo_Mp          decimal(38, 6) NOT NULL,
        Costo_Mo          decimal(38, 6) NOT NULL,
        Costo_Cif         decimal(38, 6) NOT NULL,
        Costo_Total       decimal(38, 6) NOT NULL,
        Alerta            nvarchar(200)  NULL,       -- Texto para el usuario; combina las alertas con ' | '
        AlertaInactivo    bit            NOT NULL,   -- frozenFor = 'Y'
        AlertaSinCosto    bit            NOT NULL,   -- Hoja sin AvgPrice en la bodega de la lista, MP-01 ni PT-01
        AlertaMoCif       bit            NOT NULL,   -- QryGroup39 = 'Y' y QryGroup40 = 'Y' (P2)
        AlertaEstructura  bit            NOT NULL,   -- Ciclo en la lista o tope de niveles alcanzado
        FechaCarga        datetime2(0)   NOT NULL,
        CONSTRAINT PK_Informe_costo_pt PRIMARY KEY CLUSTERED (CodigoPT, SortPath)
    );

    -- Catálogo de productos (filtros Código y Producto) y totales por producto: WHERE Nivel = 1
    CREATE NONCLUSTERED INDEX IX_Informe_costo_pt_Nivel
        ON dbo.Informe_costo_pt (Nivel)
        INCLUDE (Codigo, Descripcion, Costo_Mp, Costo_Mo, Costo_Cif, Costo_Total);
END
GO

IF OBJECT_ID(N'dbo.Informe_costo_pt_Carga', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_costo_pt_Carga (
        CodigoPT          nvarchar(50)   NOT NULL,
        SortPath          varchar(400)   NOT NULL,
        Nivel             int            NOT NULL,
        Codigo            nvarchar(50)   NOT NULL,
        Descripcion       nvarchar(200)  NULL,
        UnidadMedida      nvarchar(20)   NULL,
        Bodega            nvarchar(20)   NULL,
        TieneHijos        bit            NOT NULL,
        Clasificacion     varchar(3)     NULL,
        Cantidad          decimal(38, 6) NOT NULL,
        Costo_Unitario    decimal(38, 6) NOT NULL,
        Costo_Mp          decimal(38, 6) NOT NULL,
        Costo_Mo          decimal(38, 6) NOT NULL,
        Costo_Cif         decimal(38, 6) NOT NULL,
        Costo_Total       decimal(38, 6) NOT NULL,
        Alerta            nvarchar(200)  NULL,
        AlertaInactivo    bit            NOT NULL,
        AlertaSinCosto    bit            NOT NULL,
        AlertaMoCif       bit            NOT NULL,
        AlertaEstructura  bit            NOT NULL,
        FechaCarga        datetime2(0)   NOT NULL,
        CONSTRAINT PK_Informe_costo_pt_Carga PRIMARY KEY CLUSTERED (CodigoPT, SortPath)
    );

    CREATE NONCLUSTERED INDEX IX_Informe_costo_pt_Carga_Nivel
        ON dbo.Informe_costo_pt_Carga (Nivel)
        INCLUDE (Codigo, Descripcion, Costo_Mp, Costo_Mo, Costo_Cif, Costo_Total);
END
GO

/* ───────────── 2. SP de actualización ───────────── */
CREATE OR ALTER PROCEDURE dbo.sp_Actualizar_Informe_costo_pt
    @MaxNiveles int = 15   -- Tope de seguridad. Hoy la lista más profunda llega al nivel 6 (V4b).
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @BodAlt     varchar(20)  = 'MP-01';   -- 2.ª opción del costo unitario
    DECLARE @BodAlt2    varchar(20)  = 'PT-01';   -- 3.ª opción del costo unitario
    DECLARE @Inicio     datetime2(0) = sysdatetime();
    DECLARE @Eliminados int = 0;
    DECLARE @Insertados int = 0;
    DECLARE @Nivel      int = 1;
    DECLARE @Bloqueo    int;

    -- Evita dos cargas simultáneas (por ejemplo, el job y una ejecución manual).
    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Actualizar_Informe_costo_pt', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_costo_pt', N'COMPLETA', @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        /* ── Paso 1. Datos maestros de SAP ── */
        DROP TABLE IF EXISTS #Items, #CostoBodega, #ConLista, #BOM;

        CREATE TABLE #Items (
            ItemCode   varchar(50) COLLATE SQL_Latin1_General_CP850_CI_AS PRIMARY KEY,
            ItemName   varchar(200),
            QryGroup39 char(1),
            QryGroup40 char(1),
            SalUnitMsr varchar(20),
            frozenFor  char(1)
        );
        INSERT INTO #Items (ItemCode, ItemName, QryGroup39, QryGroup40, SalUnitMsr, frozenFor)
        SELECT ItemCode, ItemName, QryGroup39, QryGroup40, SalUnitMsr, frozenFor
        FROM FIRPLAK_SA.dbo.OITM WITH (NOLOCK);

        CREATE TABLE #CostoBodega (
            ItemCode varchar(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
            WhsCode  varchar(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
            AvgPrice decimal(19, 6),
            PRIMARY KEY (ItemCode, WhsCode)
        );
        INSERT INTO #CostoBodega (ItemCode, WhsCode, AvgPrice)
        SELECT ItemCode, WhsCode, AvgPrice
        FROM FIRPLAK_SA.dbo.OITW WITH (NOLOCK)
        WHERE AvgPrice <> 0;

        -- Artículos que tienen lista de materiales (padres en ITT1)
        CREATE TABLE #ConLista (
            ItemCode varchar(50) COLLATE SQL_Latin1_General_CP850_CI_AS PRIMARY KEY
        );
        INSERT INTO #ConLista (ItemCode)
        SELECT DISTINCT Father FROM FIRPLAK_SA.dbo.ITT1 WITH (NOLOCK);

        /* ── Paso 2. Explosión de la lista de materiales, nivel por nivel, sin tope fijo ── */
        CREATE TABLE #BOM (
            ID          int IDENTITY(1, 1) PRIMARY KEY,
            RootCode    varchar(50)   COLLATE SQL_Latin1_General_CP850_CI_AS NOT NULL,
            Codigo      varchar(50)   COLLATE SQL_Latin1_General_CP850_CI_AS NOT NULL,
            Nivel       int           NOT NULL,
            Cantidad    decimal(38, 6) NOT NULL,
            Warehouse   varchar(50)   COLLATE SQL_Latin1_General_CP850_CI_AS NULL,
            TieneHijos  bit           NOT NULL,   -- 1 = se explota (encabezado)
            Ciclo       bit           NOT NULL DEFAULT 0,
            Tope        bit           NOT NULL DEFAULT 0,
            SortPath    varchar(400)  COLLATE SQL_Latin1_General_CP850_CI_AS NOT NULL,
            Ruta        varchar(4000) COLLATE SQL_Latin1_General_CP850_CI_AS NOT NULL,  -- |cod1|cod2|... para detectar ciclos
            INDEX IX_BOM_Nivel (Nivel, TieneHijos)
        );

        -- Nivel 1: artículos activos con lista de materiales (productos terminados y semielaborados, P7)
        INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, SortPath, Ruta)
        SELECT i.ItemCode, i.ItemCode, 1, 1, NULL, 1, i.ItemCode, '|' + i.ItemCode + '|'
        FROM #Items i
        INNER JOIN #ConLista l ON l.ItemCode = i.ItemCode
        WHERE i.frozenFor = 'N';

        WHILE 1 = 1
        BEGIN
            INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, Ciclo, Tope, SortPath, Ruta)
            SELECT
                x.RootCode, x.Code, x.Nivel, x.Cantidad, x.Warehouse,
                CASE WHEN x.TieneLista = 1 AND x.Ciclo = 0 AND x.Nivel < @MaxNiveles THEN 1 ELSE 0 END,
                x.Ciclo,
                CASE WHEN x.TieneLista = 1 AND x.Ciclo = 0 AND x.Nivel >= @MaxNiveles THEN 1 ELSE 0 END,
                x.SortPath, x.Ruta
            FROM (
                SELECT
                    b.RootCode,
                    itt.Code,
                    b.Nivel + 1 AS Nivel,
                    CONVERT(decimal(38, 6), itt.Quantity * b.Cantidad) AS Cantidad,
                    itt.Warehouse,
                    CASE WHEN l.ItemCode IS NULL THEN 0 ELSE 1 END AS TieneLista,
                    CASE WHEN CHARINDEX('|' + itt.Code + '|', b.Ruta) > 0 THEN 1 ELSE 0 END AS Ciclo,
                    b.SortPath + '.' + RIGHT('0000' + CAST(ROW_NUMBER() OVER (PARTITION BY b.ID ORDER BY itt.ChildNum) AS varchar(4)), 4) AS SortPath,
                    b.Ruta + itt.Code + '|' AS Ruta
                FROM #BOM b
                INNER JOIN FIRPLAK_SA.dbo.ITT1 itt WITH (NOLOCK) ON itt.Father = b.Codigo
                LEFT JOIN #ConLista l ON l.ItemCode = itt.Code
                WHERE b.Nivel = @Nivel
                  AND b.TieneHijos = 1
            ) AS x;

            IF @@ROWCOUNT = 0 BREAK;
            SET @Nivel += 1;
        END

        /* ── Paso 3. Costo por línea ──
           Costo unitario (solo hojas): primer AvgPrice > 0 en la bodega de la lista, MP-01 y PT-01.
           Clasificación: QryGroup39 = 'Y' -> MO; QryGroup40 = 'Y' -> CIF; ninguno -> MP; ambos -> sin costo (P2).
           Encabezados: costo 0 (está en sus hijos). Ciclos: costo 0. Nivel 1: suma de sus líneas (paso 4). */
        TRUNCATE TABLE dbo.Informe_costo_pt_Carga;

        ;WITH Lineas AS (
            SELECT
                b.RootCode, b.SortPath, b.Nivel, b.Codigo, b.Warehouse, b.TieneHijos, b.Ciclo, b.Tope,
                b.Cantidad,
                i.ItemName, i.SalUnitMsr,
                CASE WHEN ISNULL(i.frozenFor, 'N') = 'Y' THEN 1 ELSE 0 END AS Inactivo,
                CASE WHEN ISNULL(i.QryGroup39, 'N') = 'Y' AND ISNULL(i.QryGroup40, 'N') = 'Y' THEN 1 ELSE 0 END AS MoCif,
                CASE WHEN ISNULL(i.QryGroup39, 'N') = 'Y' THEN 'MO'
                     WHEN ISNULL(i.QryGroup40, 'N') = 'Y' THEN 'CIF'
                     ELSE 'MP' END AS Clase,
                COALESCE(cBod.AvgPrice, cAlt.AvgPrice, cAlt2.AvgPrice) AS CostoEncontrado,
                CASE WHEN b.Nivel > 1 AND b.TieneHijos = 0 AND b.Ciclo = 0 THEN 1 ELSE 0 END AS EsHoja
            FROM #BOM b
            LEFT JOIN #Items i           ON i.ItemCode     = b.Codigo
            LEFT JOIN #CostoBodega cBod  ON cBod.ItemCode  = b.Codigo AND cBod.WhsCode  = b.Warehouse
            LEFT JOIN #CostoBodega cAlt  ON cAlt.ItemCode  = b.Codigo AND cAlt.WhsCode  = @BodAlt
            LEFT JOIN #CostoBodega cAlt2 ON cAlt2.ItemCode = b.Codigo AND cAlt2.WhsCode = @BodAlt2
        ),
        Costeadas AS (
            SELECT
                l.*,
                CASE WHEN l.EsHoja = 1 AND l.MoCif = 0 THEN ISNULL(l.CostoEncontrado, 0) ELSE 0 END AS CostoU,
                CASE WHEN l.EsHoja = 1 AND l.MoCif = 0 AND l.CostoEncontrado IS NULL THEN 1 ELSE 0 END AS SinCosto,
                CASE WHEN l.Ciclo = 1 OR l.Tope = 1 THEN 1 ELSE 0 END AS Estructura
            FROM Lineas l
        )
        INSERT INTO dbo.Informe_costo_pt_Carga (
            CodigoPT, SortPath, Nivel, Codigo, Descripcion, UnidadMedida, Bodega, TieneHijos, Clasificacion,
            Cantidad, Costo_Unitario, Costo_Mp, Costo_Mo, Costo_Cif, Costo_Total,
            Alerta, AlertaInactivo, AlertaSinCosto, AlertaMoCif, AlertaEstructura, FechaCarga
        )
        SELECT
            c.RootCode,
            c.SortPath,
            c.Nivel,
            c.Codigo,
            NULLIF(LTRIM(RTRIM(c.ItemName)), ''),
            NULLIF(LTRIM(RTRIM(c.SalUnitMsr)), ''),
            c.Warehouse,
            c.TieneHijos,
            CASE WHEN c.EsHoja = 1 AND c.MoCif = 0 THEN c.Clase END,
            c.Cantidad,
            c.CostoU,
            CASE WHEN c.Clase = 'MP'  AND c.MoCif = 0 THEN c.CostoU * c.Cantidad ELSE 0 END,
            CASE WHEN c.Clase = 'MO'  AND c.MoCif = 0 THEN c.CostoU * c.Cantidad ELSE 0 END,
            CASE WHEN c.Clase = 'CIF' AND c.MoCif = 0 THEN c.CostoU * c.Cantidad ELSE 0 END,
            c.CostoU * c.Cantidad,
            NULLIF(STUFF(
                  CASE WHEN c.Nivel > 1 AND c.Inactivo = 1 THEN ' | ITEM INACTIVO' ELSE '' END
                + CASE WHEN c.SinCosto = 1   THEN ' | SIN COSTO EN SAP'  ELSE '' END
                + CASE WHEN c.Nivel > 1 AND c.MoCif = 1 THEN ' | MO Y CIF A LA VEZ' ELSE '' END
                + CASE WHEN c.Ciclo = 1      THEN ' | CICLO EN LISTA DE MATERIALES' ELSE '' END
                + CASE WHEN c.Tope = 1       THEN ' | TOPE DE NIVELES' ELSE '' END,
                1, 3, ''), ''),
            CASE WHEN c.Nivel > 1 THEN c.Inactivo ELSE 0 END,
            c.SinCosto,
            CASE WHEN c.Nivel > 1 THEN c.MoCif ELSE 0 END,
            c.Estructura,
            @Inicio
        FROM Costeadas c;

        /* ── Paso 4. Nivel 1 = suma de sus líneas ── */
        ;WITH Totales AS (
            SELECT CodigoPT,
                   SUM(Costo_Mp) AS Mp, SUM(Costo_Mo) AS Mo, SUM(Costo_Cif) AS Cif
            FROM dbo.Informe_costo_pt_Carga
            WHERE Nivel > 1
            GROUP BY CodigoPT
        )
        UPDATE r SET
            r.Costo_Mp    = t.Mp,
            r.Costo_Mo    = t.Mo,
            r.Costo_Cif   = t.Cif,
            r.Costo_Total = t.Mp + t.Mo + t.Cif
        FROM dbo.Informe_costo_pt_Carga r
        INNER JOIN Totales t ON t.CodigoPT = r.CodigoPT
        WHERE r.Nivel = 1;

        SELECT @Insertados = COUNT(1) FROM dbo.Informe_costo_pt_Carga;
        IF @Insertados = 0
            THROW 50001, N'La explosión no devolvió filas; se conserva la carga anterior.', 1;

        /* ── Paso 5. Intercambio: la tabla de reporte queda vacía solo dentro de la transacción ── */
        BEGIN TRANSACTION;
            SELECT @Eliminados = COUNT(1) FROM dbo.Informe_costo_pt WITH (TABLOCKX);
            TRUNCATE TABLE dbo.Informe_costo_pt;
            ALTER TABLE dbo.Informe_costo_pt_Carga SWITCH TO dbo.Informe_costo_pt;
        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_costo_pt', N'COMPLETA', @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE IF EXISTS #Items, #CostoBodega, #ConLista, #BOM;
        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_costo_pt', @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_costo_pt', N'COMPLETA', @Inicio, sysdatetime(), 0, 0, LEFT(ERROR_MESSAGE(), 4000));

        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_costo_pt', @LockOwner = N'Session';
        THROW;
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_costo_pt;

/* ───────────── 4. Validación (solo lectura) ───────────── */

-- 4.1 Última carga en la bitácora
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_costo_pt' ORDER BY Inicio DESC;

-- 4.2 Volumen por nivel. Esperado: 11.244 productos en el nivel 1 (V2) y niveles hasta el 6 (V4b)
-- SELECT Nivel, COUNT_BIG(1) AS Filas, SUM(Costo_Total) AS Total
-- FROM dbo.Informe_costo_pt GROUP BY Nivel ORDER BY Nivel;

-- 4.3 Coherencia: el nivel 1 debe ser igual a la suma de sus líneas. Esperado: sin filas
-- SELECT p.CodigoPT, p.Costo_Total, SUM(l.Costo_Total) AS SumaLineas
-- FROM dbo.Informe_costo_pt p
-- INNER JOIN dbo.Informe_costo_pt l ON l.CodigoPT = p.CodigoPT AND l.Nivel > 1
-- WHERE p.Nivel = 1
-- GROUP BY p.CodigoPT, p.Costo_Total
-- HAVING ABS(p.Costo_Total - SUM(l.Costo_Total)) > 0.01;

-- 4.4 Alertas por tipo (indicador de P8). Esperado: AlertaMoCif = 0 (V3) y AlertaEstructura = 0
-- SELECT SUM(CAST(AlertaInactivo AS int))   AS Inactivos,
--        SUM(CAST(AlertaSinCosto AS int))   AS SinCosto,
--        SUM(CAST(AlertaMoCif AS int))      AS MoCif,
--        SUM(CAST(AlertaEstructura AS int)) AS Estructura
-- FROM dbo.Informe_costo_pt;

-- 4.5 Productos de V7. Esperado (query optimizado, 2026-11-04):
--     CBAN12-0027-000-0406 = 235.171,705; CBAN05-0001-000-0438 = 9.425,34; CMPD04-0268-000-0000 = 99.590,8988
--     (pueden moverse si cambió el costo promedio en SAP desde entonces)
-- SELECT CodigoPT, Costo_Mp, Costo_Mo, Costo_Cif, Costo_Total
-- FROM dbo.Informe_costo_pt
-- WHERE Nivel = 1 AND CodigoPT IN (N'CBAN12-0027-000-0406', N'CBAN05-0001-000-0438', N'CMPD04-0268-000-0000');

-- 4.6 Comparación completa contra el query optimizado.
--     En la MISMA ventana de SSMS: ejecutar query-optimizado.sql sin su última línea (DROP TABLE ...),
--     para que #Resultado siga disponible, y luego esta consulta.
--     Esperado: diferencias solo en productos con más de 4 niveles (D9, unos 3.421) y en artículos MO+CIF (P2).
-- ;WITH Tabla AS (
--     SELECT CodigoPT, MAX(Nivel) AS NivelMax,
--            SUM(CASE WHEN Nivel = 1 THEN Costo_Total END) AS Total
--     FROM dbo.Informe_costo_pt GROUP BY CodigoPT
-- ), Opt AS (
--     SELECT RootCode, CostoTotal AS Total FROM #Resultado WHERE Nivel = 1
-- )
-- SELECT CASE WHEN t.NivelMax > 4 THEN 'Más de 4 niveles' ELSE 'Hasta 4 niveles' END AS Grupo,
--        COUNT(1) AS Productos,
--        SUM(CASE WHEN ABS(t.Total - o.Total) > 0.01 THEN 1 ELSE 0 END) AS ConDiferencia,
--        SUM(t.Total) AS TotalTabla, SUM(o.Total) AS TotalOptimizado
-- FROM Tabla t
-- INNER JOIN Opt o ON o.RootCode COLLATE DATABASE_DEFAULT = t.CodigoPT
-- GROUP BY CASE WHEN t.NivelMax > 4 THEN 'Más de 4 niveles' ELSE 'Hasta 4 niveles' END;

/* ───────────── 5. Job (lo crea el desarrollador en SQL Server Agent) ───────────── */
-- Nombre:   BI - Costo PT carga completa
-- Paso:     EXEC Planos_Symphony.dbo.sp_Actualizar_Informe_costo_pt;
-- Horario:  cada hora, todos los días (por ejemplo, al minuto 05 para no coincidir con otros jobs en punto)
