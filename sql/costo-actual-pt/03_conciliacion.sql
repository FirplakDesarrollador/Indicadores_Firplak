/*
  BI Costo actual de producto terminado: consultas de conciliación con el Power BI (fase 6).
  Ficha: llm-wiki/bi/costo-actual-pt.md (sección 6).

  SOLO LECTURA: ninguna consulta escribe en Planos_Symphony ni en FIRPLAK_SA.
  Ejecuta el desarrollador, en la misma hora en que toma los valores del Power BI: el costo promedio
  de SAP cambia con cada movimiento y la tabla se recarga cada hora (minuto 05).

  Orden:
    C1. Hora de la carga y totales globales (comparar con las tarjetas del Power BI sin producto elegido).
    C2. Muestra de productos, uno por caso (comparar con las tarjetas del Power BI con cada producto).
    C3. Detalle de un producto, con los costos de SAP por bodega (explica diferencias línea por línea).
    C4. Comparación completa contra el query optimizado: es la validación 4.6 de 01_informe_costo_pt.sql.

  Tolerancia: una diferencia mayor a 0,01 que no tenga causa D1–D9 es un hallazgo y se documenta
  en la ficha antes de seguir.
*/

USE [Planos_Symphony];
GO

/* ───────────── C1. Hora de la carga y totales globales ─────────────
   El Power BI, sin producto elegido, suma todos los productos en "Total Costo" y en "sin CIF".
   Diferencia esperada: productos con más de 4 niveles (D9) y reglas D3/D5. Por eso se separa por grupo. */

SELECT MAX(FechaCarga) AS FechaCarga FROM dbo.Informe_costo_pt;

;WITH Productos AS (
    SELECT CodigoPT,
           MAX(Nivel) AS NivelMax,
           SUM(CASE WHEN Nivel = 1 THEN Costo_Mp    END) AS Mp,
           SUM(CASE WHEN Nivel = 1 THEN Costo_Mo    END) AS Mo,
           SUM(CASE WHEN Nivel = 1 THEN Costo_Cif   END) AS Cif,
           SUM(CASE WHEN Nivel = 1 THEN Costo_Total END) AS Total
    FROM dbo.Informe_costo_pt
    GROUP BY CodigoPT
)
SELECT COALESCE(CASE WHEN NivelMax > 4 THEN 'Más de 4 niveles' ELSE 'Hasta 4 niveles' END, 'TOTAL') AS Grupo,
       COUNT(1)         AS Productos,
       SUM(Mp)          AS Costo_Mp,
       SUM(Mo)          AS Costo_Mo,
       SUM(Cif)         AS Costo_Cif,
       SUM(Total)       AS Costo_Total,
       SUM(Total - Cif) AS Costo_Sin_Cif
FROM Productos
GROUP BY ROLLUP (CASE WHEN NivelMax > 4 THEN 'Más de 4 niveles' ELSE 'Hasta 4 niveles' END);

/* ───────────── C2. Muestra de productos, uno por caso ─────────────
   Para cada fila: en el Power BI, elegir el producto y anotar "Total Costo" y las dos tarjetas "sin CIF";
   en el portal, Costo total y Costo sin CIF. Si hay diferencia, seguir con C3. */

IF OBJECT_ID('tempdb..#Prod') IS NOT NULL DROP TABLE #Prod;

SELECT p.CodigoPT,
       MAX(CASE WHEN p.Nivel = 1 THEN p.Descripcion END)  AS Descripcion,
       MAX(p.Nivel)                                        AS Niveles,
       SUM(CASE WHEN p.Nivel > 1 THEN 1 ELSE 0 END)        AS Lineas,
       SUM(CASE WHEN p.Nivel = 1 THEN p.Costo_Mp    END)   AS Mp,
       SUM(CASE WHEN p.Nivel = 1 THEN p.Costo_Mo    END)   AS Mo,
       SUM(CASE WHEN p.Nivel = 1 THEN p.Costo_Cif   END)   AS Cif,
       SUM(CASE WHEN p.Nivel = 1 THEN p.Costo_Total END)   AS Total,
       MAX(CAST(p.AlertaInactivo AS int))                  AS ConInactivo,
       MAX(CAST(p.AlertaSinCosto AS int))                  AS ConSinCosto,
       MAX(CASE WHEN p.Alerta IS NOT NULL THEN 1 ELSE 0 END) AS ConAlerta
INTO #Prod
FROM dbo.Informe_costo_pt p
GROUP BY p.CodigoPT;

-- D3: hoja de MP del nivel 2 sin costo en la bodega de la lista, pero con costo unitario por la cascada.
IF OBJECT_ID('tempdb..#ConD3') IS NOT NULL DROP TABLE #ConD3;

SELECT DISTINCT l.CodigoPT
INTO #ConD3
FROM dbo.Informe_costo_pt l
LEFT JOIN FIRPLAK_SA.dbo.OITW w WITH (NOLOCK)
       ON w.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo
      AND w.WhsCode  COLLATE DATABASE_DEFAULT = l.Bodega
WHERE l.Nivel = 2
  AND l.Clasificacion = 'MP'
  AND l.Costo_Unitario > 0
  AND ISNULL(w.AvgPrice, 0) = 0;

-- Un producto por caso. Cada caso elige su producto con una subconsulta TOP (1).
SELECT x.Orden, x.Caso, x.CodigoPT, p.Descripcion, p.Niveles, p.Lineas,
       p.Mp AS Costo_Mp, p.Mo AS Costo_Mo, p.Cif AS Costo_Cif,
       p.Total AS Costo_Total, p.Total - p.Cif AS Costo_Sin_Cif
FROM (
    SELECT 1 AS Orden, 'V7: un nivel con MO y CIF' AS Caso, N'CBAN12-0027-000-0406' AS CodigoPT
    UNION ALL SELECT 2, 'V7: diferencia D3', N'CBAN05-0001-000-0438'
    UNION ALL SELECT 3, 'V7: tres niveles, diferencia D3/D5', N'CMPD04-0268-000-0000'
    UNION ALL SELECT 4, 'Un nivel, solo MP, sin alertas', (SELECT TOP (1) CodigoPT FROM #Prod
        WHERE Niveles = 2 AND Mo = 0 AND Cif = 0 AND Total > 0 AND ConAlerta = 0 ORDER BY CodigoPT)
    UNION ALL SELECT 5, 'Hasta 4 niveles, con MO y CIF', (SELECT TOP (1) CodigoPT FROM #Prod
        WHERE Niveles BETWEEN 3 AND 4 AND Mo > 0 AND Cif > 0 ORDER BY Lineas DESC, CodigoPT)
    UNION ALL SELECT 6, 'Más de 4 niveles (D9)', (SELECT TOP (1) CodigoPT FROM #Prod
        WHERE Niveles > 4 ORDER BY Niveles DESC, CodigoPT)
    UNION ALL SELECT 7, 'Hoja de nivel 2 sin costo en su bodega (D3)', (SELECT TOP (1) d.CodigoPT FROM #ConD3 d
        WHERE d.CodigoPT <> N'CBAN05-0001-000-0438' ORDER BY d.CodigoPT)
    UNION ALL SELECT 8, 'Con ítem inactivo', (SELECT TOP (1) CodigoPT FROM #Prod
        WHERE ConInactivo = 1 ORDER BY CodigoPT)
    UNION ALL SELECT 9, 'Con línea SIN COSTO EN SAP', (SELECT TOP (1) CodigoPT FROM #Prod
        WHERE ConSinCosto = 1 AND Total > 0 ORDER BY CodigoPT)
    UNION ALL SELECT 10, 'Semielaborado (componente de otro producto, P7)', (SELECT TOP (1) p2.CodigoPT FROM #Prod p2
        WHERE p2.Niveles > 2 AND p2.CodigoPT <> N'CMPD04-0268-000-0000'
          AND EXISTS (SELECT 1 FROM dbo.Informe_costo_pt c WHERE c.Nivel > 1 AND c.Codigo = p2.CodigoPT)
        ORDER BY p2.CodigoPT)
    UNION ALL SELECT 11, 'El de más líneas', (SELECT TOP (1) CodigoPT FROM #Prod ORDER BY Lineas DESC, CodigoPT)
) x
LEFT JOIN #Prod p ON p.CodigoPT = x.CodigoPT   -- LEFT: un caso sin producto sale con nulos
ORDER BY x.Orden;

/* ───────────── C3. Detalle de un producto ─────────────
   Comparar con la tabla "Lista de Materiales" del Power BI exportada a Excel.
   Las columnas de SAP muestran de dónde sale el costo unitario: bodega de la lista → MP-01 → PT-01
   (el Power BI usa la lista de precios 10 en lugar de PT-01: D2). */

DECLARE @Codigo nvarchar(50) = N'CMPD04-0268-000-0000';   -- cambiar por el producto con diferencia

SELECT l.SortPath, l.Nivel, l.Codigo, l.Descripcion, l.Bodega, l.Clasificacion,
       l.Cantidad, l.Costo_Unitario, l.Costo_Mp, l.Costo_Mo, l.Costo_Cif, l.Costo_Total, l.Alerta,
       wb.AvgPrice AS AvgPrice_Bodega_Lista,
       wm.AvgPrice AS AvgPrice_MP01,
       wp.AvgPrice AS AvgPrice_PT01,
       lp.Price    AS Precio_Lista10,
       i.AvgPrice  AS AvgPrice_Articulo
FROM dbo.Informe_costo_pt l
LEFT JOIN FIRPLAK_SA.dbo.OITW wb WITH (NOLOCK)
       ON wb.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo AND wb.WhsCode COLLATE DATABASE_DEFAULT = l.Bodega
LEFT JOIN FIRPLAK_SA.dbo.OITW wm WITH (NOLOCK)
       ON wm.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo AND wm.WhsCode = 'MP-01'
LEFT JOIN FIRPLAK_SA.dbo.OITW wp WITH (NOLOCK)
       ON wp.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo AND wp.WhsCode = 'PT-01'
LEFT JOIN FIRPLAK_SA.dbo.ITM1 lp WITH (NOLOCK)
       ON lp.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo AND lp.PriceList = 10
LEFT JOIN FIRPLAK_SA.dbo.OITM i WITH (NOLOCK)
       ON i.ItemCode COLLATE DATABASE_DEFAULT = l.Codigo
WHERE l.CodigoPT = @Codigo
ORDER BY l.SortPath;

/* ───────────── C3b. Costo de un componente en todas las bodegas ─────────────
   Sirve para encontrar de qué bodega sacó el Power BI un costo unitario que no coincide con la bodega
   de la lista ni con MP-01. En el SQL original, las hojas del nivel 3 se costean con la bodega guardada
   en @Bodega3_ (línea 331 de query-original-powerbi.sql), que puede venir de otro componente. */

SELECT w.ItemCode, w.WhsCode, w.AvgPrice, w.OnHand
FROM FIRPLAK_SA.dbo.OITW w WITH (NOLOCK)
WHERE w.ItemCode IN (N'COMP02-0033-000-0000', N'COMP02-0027-000-0000', N'COMP02-0036-000-0000', N'CIPR01-0028-000-0000')
  AND w.AvgPrice <> 0
ORDER BY w.ItemCode, w.WhsCode;

/* ───────────── C4. Comparación completa contra el query optimizado ─────────────
   Es la consulta 4.6 de 01_informe_costo_pt.sql. En la MISMA ventana de SSMS: ejecutar
   bi-origen/bi-costo-actual-pt/query-optimizado.sql sin su DROP TABLE final y luego la 4.6.
   Esperado: "Hasta 4 niveles" con ConDiferencia = 0 (salvo artículos MO+CIF, P2, hoy ninguno);
   "Más de 4 niveles" con diferencias por D9. */
