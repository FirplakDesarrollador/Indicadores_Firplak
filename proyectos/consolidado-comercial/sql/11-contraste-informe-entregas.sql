-- Consolidado comercial SAP: ¿C (tránsito) puede leerse de Planos_Symphony.dbo.Informe_entregas
-- en vez de SAP? Compara la tabla contra las entregas abiertas de SAP línea por línea.
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- La tabla mezcla TipoMovimiento 'Entrega', 'Devolución' y 'Nota crédito devolución' (pestaña 1,
-- 2026-11-13): las pestañas 2 a 5 cruzan solo las filas 'Entrega' para no mezclar DocEntry de otros objetos.
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO). Compatible con nivel 100. Pestañas 1 a 5.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. Frescura y volumen por empresa y tipo de movimiento.
SELECT '1_Frescura' AS Consulta, I.Empresa, I.TipoMovimiento, I.DocumentoBase,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN I.Cancelado = 'N' AND I.EstadoItem = 'O' THEN 1 ELSE 0 END) AS LineasAbiertas,
       MIN(I.FechaCarga) AS PrimeraCarga, MAX(I.FechaCarga) AS UltimaCarga,
       MAX(I.FechaEntrega) AS UltimaEntrega, GETDATE() AS Ahora
FROM Planos_Symphony.dbo.Informe_entregas I
GROUP BY I.Empresa, I.TipoMovimiento, I.DocumentoBase
ORDER BY I.Empresa, Lineas DESC;

GO

-- 2. Estado de cada línea en la tabla vs. estado actual en SAP (solo Firplak).
--    Lo esperado: todas las filas en 'O'/'O' o 'C'/'C'; 'O' en la tabla y 'C' en SAP = tabla desactualizada.
SELECT '2_EstadoTablaVsSAP' AS Consulta,
       I.Cancelado AS CanceladoTabla, H.CANCELED AS CanceladoSAP,
       I.EstadoItem AS EstadoTabla, L.LineStatus AS EstadoSAP,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS SaldoSAP,
       MAX(I.FechaCarga) AS UltimaCargaDelGrupo
FROM Planos_Symphony.dbo.Informe_entregas I
JOIN DLN1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
JOIN ODLN H ON H.DocEntry = L.DocEntry
WHERE I.Empresa = 'Firplak' AND I.TipoMovimiento = 'Entrega'
  AND ((I.Cancelado = 'N' AND I.EstadoItem = 'O') OR (H.CANCELED = 'N' AND L.LineStatus = 'O'))
GROUP BY I.Cancelado, H.CANCELED, I.EstadoItem, L.LineStatus
ORDER BY Lineas DESC;

GO

-- 3. Líneas abiertas en SAP que no están en la tabla.
SELECT '3_AbiertasSAPNoEnTabla' AS Consulta,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo,
       MIN(H.DocDate) AS EntregaMasAntigua, MAX(H.DocDate) AS EntregaMasReciente
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN Planos_Symphony.dbo.Informe_entregas I
       ON I.DocEntry = L.DocEntry AND I.LineNum = L.LineNum AND I.Empresa = 'Firplak' AND I.TipoMovimiento = 'Entrega'
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O' AND I.DocEntry IS NULL;

GO

-- 4. En las líneas abiertas en ambos lados: ¿la tabla da el mismo saldo y los mismos atributos?
--    Saldo de la tabla = ValorSinIVA * (Cantidad - CantidadFacturada) / Cantidad.
SELECT '4_AtributosAbiertas' AS Consulta,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS SaldoSAP,
       SUM(CASE WHEN I.Cantidad <> 0 THEN I.ValorSinIVA * (I.Cantidad - ISNULL(I.CantidadFacturada, 0)) / I.Cantidad ELSE 0 END) AS SaldoTabla,
       SUM(CASE WHEN L.OpenQty <> I.Cantidad - ISNULL(I.CantidadFacturada, 0) THEN 1 ELSE 0 END) AS CantidadAbiertaDistinta,
       SUM(CASE WHEN ABS(L.LineTotal - I.ValorSinIVA) > 1 THEN 1 ELSE 0 END) AS ValorDistinto,
       SUM(CASE WHEN ISNULL(I.StatusEntrega, '') <> ISNULL(CAST(H.U_StatusEntrega AS nvarchar(508)), '') THEN 1 ELSE 0 END) AS StatusDistinto,
       SUM(CASE WHEN ISNULL(I.FechaProyFAC, '19000101') <> ISNULL(CAST(H.U_FechaRadFAC AS date), '19000101') THEN 1 ELSE 0 END) AS ProyFACDistinta,
       SUM(CASE WHEN ISNULL(I.TipoOV, '') <> ISNULL(CAST(H.U_TipoPedidos AS nvarchar(508)), '') THEN 1 ELSE 0 END) AS TipoOVDistinto,
       SUM(CASE WHEN ISNULL(I.SubgrupoCliente, '') NOT IN (ISNULL(C.U_SubGroupCode, ''), ISNULL(S.Name, '')) THEN 1 ELSE 0 END) AS SubgrupoDistinto,
       SUM(CASE WHEN ISNULL(I.CentroCostos, '') <> ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), ''), ISNULL(C.U_CentrodeCtos, '')) THEN 1 ELSE 0 END) AS CentroCostosDistinto,
       SUM(CASE WHEN ISNULL(I.Asesor, '') <> ISNULL(P.SlpName, '') THEN 1 ELSE 0 END) AS AsesorDistinto,
       MIN(I.SubgrupoCliente) AS EjemploSubgrupoTabla, MIN(I.CentroCostos) AS EjemploCentroTabla
FROM Planos_Symphony.dbo.Informe_entregas I
JOIN DLN1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
JOIN ODLN H ON H.DocEntry = L.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
LEFT JOIN OSLP P ON P.SlpCode = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END
WHERE I.Empresa = 'Firplak' AND I.TipoMovimiento = 'Entrega'
  AND I.Cancelado = 'N' AND I.EstadoItem = 'O'
  AND H.CANCELED = 'N' AND L.LineStatus = 'O';

GO

-- 5. Muestra de líneas con diferencias de saldo (si la pestaña 4 muestra alguna).
SELECT TOP 30 '5_MuestraDiferencias' AS Consulta, I.Entrega, I.LineNum, I.FechaCarga,
       L.Quantity, L.OpenQty, I.Cantidad, I.CantidadFacturada, I.NumFacturas,
       L.LineTotal, I.ValorSinIVA,
       CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END AS SaldoSAP,
       CASE WHEN I.Cantidad <> 0 THEN I.ValorSinIVA * (I.Cantidad - ISNULL(I.CantidadFacturada, 0)) / I.Cantidad ELSE 0 END AS SaldoTabla
FROM Planos_Symphony.dbo.Informe_entregas I
JOIN DLN1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
JOIN ODLN H ON H.DocEntry = L.DocEntry
WHERE I.Empresa = 'Firplak' AND I.TipoMovimiento = 'Entrega'
  AND I.Cancelado = 'N' AND I.EstadoItem = 'O'
  AND H.CANCELED = 'N' AND L.LineStatus = 'O'
  AND (L.OpenQty <> I.Cantidad - ISNULL(I.CantidadFacturada, 0) OR ABS(L.LineTotal - I.ValorSinIVA) > 1)
ORDER BY ABS(L.LineTotal * L.OpenQty / NULLIF(L.Quantity, 0)
           - I.ValorSinIVA * (I.Cantidad - ISNULL(I.CantidadFacturada, 0)) / NULLIF(I.Cantidad, 0)) DESC;
