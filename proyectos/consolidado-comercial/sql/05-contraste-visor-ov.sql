-- Consolidado comercial SAP: contraste entre el query "Visor OV" de Logística
-- (fuentes/visor-ov.sql) y las reglas propuestas para B.
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO). Compatible con nivel 100 (sin CTE, APPLY ni TRY_CONVERT).

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. OV con encabezado abierto: estado de la línea, autorización y saldo.
--    SaldoNuestro = LineTotal * OpenQty / Quantity (solo cuenta si LineStatus = 'O').
--    SaldoVisor   = LineTotal * (Quantity - DelivrdQty) / Quantity (el Visor no mira LineStatus).
SELECT '1_EstadoLineas' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       H.Confirmed AS Autorizada, L.LineStatus,
       COUNT(DISTINCT H.DocEntry) AS OV, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.OpenQty <> L.Quantity - ISNULL(L.DelivrdQty, 0) THEN 1 ELSE 0 END) AS LineasOpenQtyDistinta,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS SaldoNuestro,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * (L.Quantity - ISNULL(L.DelivrdQty, 0)) / L.Quantity ELSE 0 END) AS SaldoVisor
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND H.DocStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END, H.Confirmed, L.LineStatus
ORDER BY Canal, Autorizada, L.LineStatus;

GO

-- 2. Líneas abiertas que el Visor pierde por sus INNER JOIN
--    (artículo, cliente, grupo, subgrupo y vendedor de la línea).
SELECT '2_PerdidasJoinVisor' AS Consulta,
       COUNT(*) AS LineasAbiertas,
       SUM(CASE WHEN I.ItemCode IS NULL THEN 1 ELSE 0 END) AS SinArticulo,
       SUM(CASE WHEN C.CardCode IS NULL THEN 1 ELSE 0 END) AS SinCliente,
       SUM(CASE WHEN G.GroupCode IS NULL THEN 1 ELSE 0 END) AS SinGrupo,
       SUM(CASE WHEN S.Code IS NULL THEN 1 ELSE 0 END) AS SinSubgrupo,
       SUM(CASE WHEN P.SlpCode IS NULL THEN 1 ELSE 0 END) AS SinVendedorLinea,
       SUM(CASE WHEN I.ItemCode IS NULL OR C.CardCode IS NULL OR G.GroupCode IS NULL OR S.Code IS NULL OR P.SlpCode IS NULL
                THEN CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END ELSE 0 END) AS SaldoPerdido
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OITM I ON I.ItemCode = L.ItemCode
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
LEFT JOIN OSLP P ON P.SlpCode = L.SlpCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O';

GO

-- 3. Vendedor del encabezado vs. vendedor de la línea (el Visor usa el de la línea).
SELECT '3_VendedorOV' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       CASE WHEN H.SlpCode = L.SlpCode THEN 'Igual' ELSE 'Distinto' END AS EncabezadoVsLinea,
       COUNT(DISTINCT H.DocEntry) AS OV, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         CASE WHEN H.SlpCode = L.SlpCode THEN 'Igual' ELSE 'Distinto' END
ORDER BY Canal, EncabezadoVsLinea;

GO

-- 4. ¿VendedorSenior de Informe_ventas es el vendedor del encabezado o el de la línea?
--    Facturas de Firplak del mes anterior y del mes en curso.
SELECT '4_VendedorSeniorFacturas' AS Consulta,
       CASE WHEN PH.SlpName = I.VendedorSenior THEN 'Si' ELSE 'No' END AS IgualEncabezado,
       CASE WHEN PL.SlpName = I.VendedorSenior THEN 'Si' ELSE 'No' END AS IgualLinea,
       COUNT(*) AS Lineas, SUM(I.ValorTotal) AS Valor,
       MIN(I.VendedorSenior) AS EjemploVendedorSenior, MIN(PH.SlpName) AS EjemploEncabezado, MIN(PL.SlpName) AS EjemploLinea
FROM Planos_Symphony.dbo.Informe_ventas I
JOIN INV1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
JOIN OINV H ON H.DocEntry = L.DocEntry
LEFT JOIN OSLP PH ON PH.SlpCode = H.SlpCode
LEFT JOIN OSLP PL ON PL.SlpCode = L.SlpCode
WHERE I.Empresa = 'Firplak' AND I.TipoDocumento = 'Factura'
  AND I.FechaContabilizacion >= DATEADD(month, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
GROUP BY CASE WHEN PH.SlpName = I.VendedorSenior THEN 'Si' ELSE 'No' END,
         CASE WHEN PL.SlpName = I.VendedorSenior THEN 'Si' ELSE 'No' END
ORDER BY Lineas DESC;

GO

-- 5. ¿La tabla de familias del Visor puede duplicar filas? (LEFT JOIN por familia + Tipo OV)
SELECT '5_DuplicadosFamSymph' AS Consulta, U_FIR_FAM_MAES, U_FIR_TIPO_PED, COUNT(*) AS Filas
FROM [@FIR_FAM_SYMPH]
GROUP BY U_FIR_FAM_MAES, U_FIR_TIPO_PED
HAVING COUNT(*) > 1
ORDER BY Filas DESC;
