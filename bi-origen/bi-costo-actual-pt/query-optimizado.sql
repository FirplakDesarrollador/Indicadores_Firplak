/* ============================================================================
   EXPLOSIÓN BOM CON COSTOS - VERSIÓN DEFINITIVA
   ============================================================================

   Objetivo: Mostrar el costo desglosado (MP, MO, CIF) de todos los
   artículos de la compañía, explotando su lista de materiales hasta
   4 niveles de profundidad.

   Mejoras vs query original:
   ─────────────────────────────────────────────────────────────────────
   ✓ Sin cursores         → Set-based, ejecución < 2 minutos
   ✓ Tablas temporales    → Seguro para ejecución concurrente
   ✓ Bug QryGroup39 fijo  → Original decía QryGroup39='N' AND QryGroup39='N'
                             Corregido a QryGroup39='N' AND QryGroup40='N'
   ✓ Fórmulas unificadas  → CostoU × CantidadAcumulada en todos los niveles
   ✓ Variables limpias     → Set-based elimina herencia entre iteraciones

   Clasificación de costos:
   ─────────────────────────────────────────────────────────────────────
   QryGroup39='Y'                → Mano de Obra   (CostoMo)
   QryGroup40='Y'                → CIF             (CostoCif)
   QryGroup39='N' Y QryGroup40='N' → Materia Prima (CostoMp)
   ============================================================================ */

-- Parámetros
DECLARE @BodAlt  VARCHAR(20) = 'MP-01';   -- Bodega alternativa 1
DECLARE @BodAlt2 VARCHAR(20) = 'PT-01';   -- Bodega alternativa 2

SET NOCOUNT ON;

-- ============================================================================
-- PASO 1: CACHEAR DATOS MAESTROS
-- Indexados en memoria para evitar miles de lookups repetidos a SAP
-- ============================================================================

-- Maestro de artículos
DROP TABLE IF EXISTS #Items;
CREATE TABLE #Items (
    ItemCode VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS PRIMARY KEY,
    ItemName VARCHAR(200),
    QryGroup39 CHAR(1),
    QryGroup40 CHAR(1),
    EvalSystem CHAR(1),
    AvgPrice DECIMAL(18,6),
    SalUnitMsr VARCHAR(20),
    frozenFor CHAR(1)
);
INSERT INTO #Items
SELECT ItemCode, ItemName, QryGroup39, QryGroup40, EvalSystem, AvgPrice, SalUnitMsr, frozenFor
FROM OITM WITH (NOLOCK);

-- Costos por bodega (solo registros con precio)
DROP TABLE IF EXISTS #CostoBodega;
CREATE TABLE #CostoBodega (
    ItemCode VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
    WhsCode  VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
    AvgPrice DECIMAL(18,6),
    PRIMARY KEY (ItemCode, WhsCode)
);
INSERT INTO #CostoBodega
SELECT ItemCode, WhsCode, AvgPrice FROM OITW WITH (NOLOCK);

-- ============================================================================
-- PASO 2: CONSTRUIR ESTRUCTURA BOM (4 NIVELES)
-- Cada nivel se inserta de una sola vez usando JOINs
-- ============================================================================

DROP TABLE IF EXISTS #BOM;
CREATE TABLE #BOM (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    RootCode    VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
    Codigo      VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
    Nivel       INT,
    Cantidad    DECIMAL(18,6),   -- Cantidad acumulada (producto de cantidades padre)
    Warehouse   VARCHAR(50) COLLATE SQL_Latin1_General_CP850_CI_AS,
    TieneHijos  BIT DEFAULT 0,
    ParentID    INT NULL,
    SortPath    VARCHAR(100) COLLATE SQL_Latin1_General_CP850_CI_AS,
    INDEX IX_BOM_Root  (RootCode),
    INDEX IX_BOM_Nivel (Nivel)
);

-- Nivel 1: Productos terminados (padres que tienen BOM en ITT1)
INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, ParentID, SortPath)
SELECT DISTINCT
    t0.ItemCode, t0.ItemCode, 1, 1, NULL, 1, NULL, t0.ItemCode
FROM OITM t0 WITH (NOLOCK)
WHERE t0.frozenFor = 'N'
  AND EXISTS (SELECT 1 FROM ITT1 WITH (NOLOCK) WHERE Father = t0.ItemCode);

-- Nivel 2: Componentes directos (con secuencia para orden jerárquico)
;WITH L2 AS (
    SELECT
        b.RootCode, b.ID AS ParentID, b.SortPath AS ParentPath,
        itt.Code, itt.Quantity, itt.Warehouse,
        CASE WHEN EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = itt.Code)
             THEN 1 ELSE 0 END AS TieneHijos,
        ROW_NUMBER() OVER (PARTITION BY b.ID ORDER BY itt.ChildNum) AS Seq
    FROM #BOM b
    INNER JOIN ITT1 itt WITH (NOLOCK) ON itt.Father = b.Codigo
    WHERE b.Nivel = 1
)
INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, ParentID, SortPath)
SELECT
    RootCode, Code, 2, Quantity, Warehouse, TieneHijos, ParentID,
    ParentPath + '.' + RIGHT('0000' + CAST(Seq AS VARCHAR(4)), 4)
FROM L2;

-- Nivel 3: Sub-componentes (con secuencia para orden jerárquico)
;WITH L3 AS (
    SELECT
        b.RootCode, b.ID AS ParentID, b.SortPath AS ParentPath,
        itt.Code, itt.Quantity * b.Cantidad AS CantAcum, itt.Warehouse,
        CASE WHEN EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = itt.Code)
             THEN 1 ELSE 0 END AS TieneHijos,
        ROW_NUMBER() OVER (PARTITION BY b.ID ORDER BY itt.ChildNum) AS Seq
    FROM #BOM b
    INNER JOIN ITT1 itt WITH (NOLOCK) ON itt.Father = b.Codigo
    WHERE b.Nivel = 2
      AND b.TieneHijos = 1
)
INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, ParentID, SortPath)
SELECT
    RootCode, Code, 3, CantAcum, Warehouse, TieneHijos, ParentID,
    ParentPath + '.' + RIGHT('0000' + CAST(Seq AS VARCHAR(4)), 4)
FROM L3;

-- Nivel 4: Sub-sub-componentes (último nivel, con secuencia)
;WITH L4 AS (
    SELECT
        b.RootCode, b.ID AS ParentID, b.SortPath AS ParentPath,
        itt.Code, itt.Quantity * b.Cantidad AS CantAcum, itt.Warehouse,
        ROW_NUMBER() OVER (PARTITION BY b.ID ORDER BY itt.ChildNum) AS Seq
    FROM #BOM b
    INNER JOIN ITT1 itt WITH (NOLOCK) ON itt.Father = b.Codigo
    WHERE b.Nivel = 3
      AND b.TieneHijos = 1
)
INSERT INTO #BOM (RootCode, Codigo, Nivel, Cantidad, Warehouse, TieneHijos, ParentID, SortPath)
SELECT
    RootCode, Code, 4, CantAcum, Warehouse, 0, ParentID,
    ParentPath + '.' + RIGHT('0000' + CAST(Seq AS VARCHAR(4)), 4)
FROM L4;

-- ============================================================================
-- PASO 3: CALCULAR COSTOS
--
-- Reglas:
--   • Nivel 1 (padre):     Costos = suma de todos sus descendientes
--   • Encabezado (con hijos): Costos = 0 (vienen de los hijos)
--   • Hoja (sin hijos):    Costos = CostoUnitario × CantidadAcumulada
--
-- CostoUnitario (prioridad):
--   1. OITW → precio promedio en la bodega específica del BOM
--   2. OITW → precio promedio en bodega MP-01
--   3. OITW → precio promedio en bodega PT-01
--   4. Si nada → 0 + ALERTA 'SIN COSTO EN SAP'
--
-- Clasificación:
--   QryGroup39='Y'              → todo va a CostoMo
--   QryGroup40='Y'              → todo va a CostoCif
--   QryGroup39='N' Y QryGroup40='N' → todo va a CostoMp
-- ============================================================================

DROP TABLE IF EXISTS #Resultado;
CREATE TABLE #Resultado (
    ID             INT,
    RootCode       VARCHAR(50),
    Codigo         VARCHAR(50),
    Descripcion    VARCHAR(200),
    UnidadMedida   VARCHAR(20),
    Nivel          INT,
    Cantidad       DECIMAL(18,6),
    CostoUnitario  DECIMAL(18,6),
    CostoMp        DECIMAL(18,6),
    CostoMo        DECIMAL(18,6),
    CostoCif       DECIMAL(18,6),
    CostoTotal     DECIMAL(18,6),
    Alerta         VARCHAR(50),
    SortPath       VARCHAR(100),
    INDEX IX_Res_Root (RootCode)
);

INSERT INTO #Resultado
SELECT
    b.ID,
    b.RootCode,
    b.Codigo,
    i.ItemName,
    i.SalUnitMsr,
    b.Nivel,
    b.Cantidad,

    -- ── CostoUnitario ──────────────────────────────────────────────
    -- Solo para hojas (sin hijos). Encabezados y nivel 1 = 0
    CASE
        WHEN b.Nivel = 1      THEN 0
        WHEN b.TieneHijos = 1 THEN 0
        ELSE COALESCE(
            NULLIF(cBod.AvgPrice, 0),      -- 1° Bodega del BOM
            NULLIF(cAlt.AvgPrice, 0),      -- 2° MP-01
            NULLIF(cAlt2.AvgPrice, 0),     -- 3° PT-01
            0
        )
    END AS CostoUnitario,

    -- ── CostoMp (Materia Prima) ────────────────────────────────────
    -- Solo si QryGroup39='N' Y QryGroup40='N' (no es MO ni CIF)
    CASE
        WHEN b.Nivel = 1      THEN 0
        WHEN b.TieneHijos = 1 THEN 0
        WHEN ISNULL(i.QryGroup39, 'N') = 'Y' THEN 0   -- Es MO
        WHEN ISNULL(i.QryGroup40, 'N') = 'Y' THEN 0   -- Es CIF
        ELSE COALESCE(
            NULLIF(cBod.AvgPrice, 0),
            NULLIF(cAlt.AvgPrice, 0),
            NULLIF(cAlt2.AvgPrice, 0),
            0
        ) * b.Cantidad
    END AS CostoMp,

    -- ── CostoMo (Mano de Obra) ────────────────────────────────────
    -- Solo si QryGroup39='Y'
    CASE
        WHEN b.Nivel = 1      THEN 0
        WHEN b.TieneHijos = 1 THEN 0
        WHEN ISNULL(i.QryGroup39, 'N') = 'Y'
            THEN COALESCE(
                NULLIF(cBod.AvgPrice, 0),
                NULLIF(cAlt.AvgPrice, 0),
                NULLIF(cAlt2.AvgPrice, 0),
                0
            ) * b.Cantidad
        ELSE 0
    END AS CostoMo,

    -- ── CostoCif (Costos Indirectos de Fabricación) ────────────────
    -- Solo si QryGroup40='Y'
    CASE
        WHEN b.Nivel = 1      THEN 0
        WHEN b.TieneHijos = 1 THEN 0
        WHEN ISNULL(i.QryGroup40, 'N') = 'Y'
            THEN COALESCE(
                NULLIF(cBod.AvgPrice, 0),
                NULLIF(cAlt.AvgPrice, 0),
                NULLIF(cAlt2.AvgPrice, 0),
                0
            ) * b.Cantidad
        ELSE 0
    END AS CostoCif,

    0 AS CostoTotal,

    -- ── Alerta ──────────────────────────────────────────────────────
    -- Avisos: item inactivo (frozenFor='Y') y/o sin costo en bodegas
    CASE
        WHEN b.Nivel = 1 THEN NULL
        -- Encabezados: solo aplica alerta de inactivo
        WHEN b.TieneHijos = 1 AND ISNULL(i.frozenFor, 'N') = 'Y'
            THEN 'ITEM INACTIVO'
        WHEN b.TieneHijos = 1 THEN NULL
        -- Hojas: pueden tener ambas alertas
        WHEN ISNULL(i.frozenFor, 'N') = 'Y'
         AND COALESCE(NULLIF(cBod.AvgPrice, 0), NULLIF(cAlt.AvgPrice, 0), NULLIF(cAlt2.AvgPrice, 0)) IS NULL
            THEN 'INACTIVO | SIN COSTO EN SAP'
        WHEN ISNULL(i.frozenFor, 'N') = 'Y'
            THEN 'ITEM INACTIVO'
        WHEN COALESCE(NULLIF(cBod.AvgPrice, 0), NULLIF(cAlt.AvgPrice, 0), NULLIF(cAlt2.AvgPrice, 0)) IS NULL
            THEN 'SIN COSTO EN SAP'
        ELSE NULL
    END AS Alerta,
    b.SortPath

FROM #BOM b
LEFT JOIN #Items i         ON i.ItemCode  = b.Codigo
LEFT JOIN #CostoBodega cBod ON cBod.ItemCode = b.Codigo AND cBod.WhsCode = b.Warehouse
LEFT JOIN #CostoBodega cAlt  ON cAlt.ItemCode  = b.Codigo AND cAlt.WhsCode  = @BodAlt
LEFT JOIN #CostoBodega cAlt2 ON cAlt2.ItemCode = b.Codigo AND cAlt2.WhsCode = @BodAlt2;

-- CostoTotal por línea
UPDATE #Resultado
SET CostoTotal = ISNULL(CostoMp, 0) + ISNULL(CostoMo, 0) + ISNULL(CostoCif, 0);

-- ============================================================================
-- PASO 4: CONSOLIDAR TOTALES EN NIVEL 1
-- El costo del producto terminado = suma de todos sus componentes
-- ============================================================================

;WITH Totales AS (
    SELECT
        RootCode,
        SUM(ISNULL(CostoMp,  0)) AS TotalMp,
        SUM(ISNULL(CostoMo,  0)) AS TotalMo,
        SUM(ISNULL(CostoCif, 0)) AS TotalCif
    FROM #Resultado
    WHERE Nivel > 1
    GROUP BY RootCode
)
UPDATE r SET
    r.CostoMp    = t.TotalMp,
    r.CostoMo    = t.TotalMo,
    r.CostoCif   = t.TotalCif,
    r.CostoTotal = t.TotalMp + t.TotalMo + t.TotalCif
FROM #Resultado r
INNER JOIN Totales t ON r.RootCode = t.RootCode
WHERE r.Nivel = 1;

-- ============================================================================
-- RESULTADO FINAL
-- ============================================================================

SELECT
    r.Codigo,
    r.Descripcion,
    r.UnidadMedida,
    r.Nivel,
    r.Cantidad,
    r.CostoUnitario  AS Costo_Unitario,
    r.CostoMp        AS Costo_Mp,
    r.CostoMo        AS Costo_Mo,
    r.CostoCif        AS Costo_Cif,
    r.CostoTotal      AS Costo_Total,
    r.Alerta
FROM #Resultado r
ORDER BY r.SortPath;

-- Limpieza
DROP TABLE IF EXISTS #Items, #CostoBodega, #BOM, #Resultado;
