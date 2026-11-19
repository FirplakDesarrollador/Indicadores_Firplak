-- Consolidado comercial SAP: ofertas abiertas del Canal B2C.
-- La solicitante respondió (2026-11-11) que A cuenta "la totalidad del canal B2C",
-- sin filtro de vigencia. Este script mide cuánto es eso y qué contiene.
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO). Compatible con nivel 100 (sin CTE, APPLY ni TRY_CONVERT).
-- Saldo = LineTotal * OpenQty / Quantity (método aprobado en 03-diagnostico-saldo.sql).

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. Ofertas abiertas por canal (todos los grupos, para comparar con el total de 3.796 M).
SELECT '1_OfertasPorCanal' AS Consulta, C.GroupCode, G.GroupName,
       COUNT(DISTINCT H.DocEntry) AS Ofertas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM OQUT H
JOIN QUT1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY C.GroupCode, G.GroupName
ORDER BY Saldo DESC;

GO

-- 2. Ofertas abiertas B2C por año, vigencia, moneda, estado de oferta y subgrupo.
SELECT '2_B2CDetalle' AS Consulta, YEAR(H.DocDate) AS Anio,
       CASE WHEN H.DocDueDate >= CAST(GETDATE() AS date) THEN 'Vigente' ELSE 'Vencida' END AS Vigencia,
       ISNULL(H.DocCur, '(vacía)') AS Moneda,
       ISNULL(CAST(H.U_Estado_Oferta_Venta AS nvarchar(10)), '(vacío)') AS EstadoOferta,
       ISNULL(C.U_SubGroupCode, '(vacío)') AS Subgrupo,
       COUNT(DISTINCT H.DocEntry) AS Ofertas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM OQUT H
JOIN QUT1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O' AND C.GroupCode = 113
GROUP BY YEAR(H.DocDate),
         CASE WHEN H.DocDueDate >= CAST(GETDATE() AS date) THEN 'Vigente' ELSE 'Vencida' END,
         ISNULL(H.DocCur, '(vacía)'),
         ISNULL(CAST(H.U_Estado_Oferta_Venta AS nvarchar(10)), '(vacío)'),
         ISNULL(C.U_SubGroupCode, '(vacío)')
ORDER BY Anio, Vigencia, Subgrupo;

GO

-- 3. Ofertas abiertas B2C por Tipo OV (para saber si la exclusión de Tipo OV las afecta).
SELECT '3_B2CTipoOV' AS Consulta,
       ISNULL(CAST(H.U_TipoPedidos AS nvarchar(10)), '(vacío)') AS TipoOV,
       COUNT(DISTINCT H.DocEntry) AS Ofertas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM OQUT H
JOIN QUT1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O' AND C.GroupCode = 113
GROUP BY ISNULL(CAST(H.U_TipoPedidos AS nvarchar(10)), '(vacío)')
ORDER BY Saldo DESC;
