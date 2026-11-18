-- Consolidado comercial SAP: diagnóstico de la diferencia entre OpenSum y el cálculo
-- proporcional (LineTotal * OpenQty / Quantity), detectada en la consulta 3 de
-- 01-descubrimiento.sql (ofertas: 4.598 M vs 3.796 M).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO), así que un error en una no detiene las demás.
-- Pestañas numeradas de 1 a 6. Solo devuelve DocEntry, cantidades y valores.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. ¿Dónde está la diferencia? Por etapa, línea parcial o completa y moneda.
SELECT '1_DondeDiferencia' AS Consulta, Etapa, Clase, Currency,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN ABS(OpenSum - Proporcional) > 1 THEN 1 ELSE 0 END) AS LineasConDiferencia,
       SUM(OpenSum) AS SumaOpenSum, SUM(Proporcional) AS SumaProporcional,
       SUM(OpenSum - Proporcional) AS Diferencia,
       SUM(CASE WHEN OpenSum > LineTotal + 1 THEN 1 ELSE 0 END) AS LineasOpenSumMayorQueTotal,
       SUM(CASE WHEN NumPerMsr <> 1 THEN 1 ELSE 0 END) AS LineasConFactorUnidad
FROM (
    SELECT X.*,
           CASE WHEN X.Quantity <> 0 THEN X.LineTotal * X.OpenQty / X.Quantity ELSE 0 END AS Proporcional,
           CASE WHEN X.OpenQty < X.Quantity THEN 'Parcial' ELSE 'Completa' END AS Clase
    FROM (
    SELECT 'A_OFERTA' AS Etapa, H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM OQUT H JOIN QUT1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'B_OV', H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'C_ENTREGA', H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    ) X
) C
GROUP BY Etapa, Clase, Currency
ORDER BY Etapa, Clase, Currency;
GO

-- 2. Las 30 líneas con mayor diferencia (para revisarlas en SAP con DocEntry + LineNum).
SELECT TOP 30 '2_TopDiferencias' AS Consulta, Etapa, DocNum, DocEntry, LineNum,
       Quantity, OpenQty, NumPerMsr, Price, LineTotal, OpenSum, Proporcional,
       OpenSum - Proporcional AS Diferencia, Currency, Rate, OpenSumFC
FROM (
    SELECT X.*,
           CASE WHEN X.Quantity <> 0 THEN X.LineTotal * X.OpenQty / X.Quantity ELSE 0 END AS Proporcional
    FROM (
    SELECT 'A_OFERTA' AS Etapa, H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM OQUT H JOIN QUT1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'B_OV', H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'C_ENTREGA', H.DocNum, L.DocEntry, L.LineNum, L.Quantity, L.OpenQty, L.NumPerMsr,
           L.Price, L.LineTotal, L.OpenSum, L.Currency, L.Rate, L.OpenSumFC
    FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    ) X
) C
ORDER BY ABS(OpenSum - Proporcional) DESC;
GO

-- 3. Ofertas parciales: ¿lo convertido aparece en OV? Compara la cantidad ya copiada
--    (Quantity - OpenQty) con la suma de líneas de OV que apuntan a esa línea de oferta.
SELECT '3_OfertaVsOV' AS Consulta,
       COUNT(*) AS LineasOfertaParciales,
       SUM(CASE WHEN ABS((Q.Quantity - Q.OpenQty) - ISNULL(O.CantOV, 0)) < 0.001 THEN 1 ELSE 0 END) AS CuadranConOV,
       SUM(CASE WHEN O.CantOV IS NULL THEN 1 ELSE 0 END) AS SinOVDestino,
       SUM(Q.Quantity - Q.OpenQty) AS CantConvertida, SUM(ISNULL(O.CantOV, 0)) AS CantEnOV
FROM OQUT H
INNER JOIN QUT1 Q ON Q.DocEntry = H.DocEntry
LEFT JOIN (
    SELECT R.BaseEntry, R.BaseLine, SUM(R.Quantity) AS CantOV
    FROM RDR1 R
    INNER JOIN ORDR RH ON RH.DocEntry = R.DocEntry
    WHERE R.BaseType = 23 AND RH.CANCELED = 'N'
    GROUP BY R.BaseEntry, R.BaseLine
) O ON O.BaseEntry = Q.DocEntry AND O.BaseLine = Q.LineNum
WHERE H.CANCELED = 'N' AND Q.LineStatus = 'O' AND Q.OpenQty < Q.Quantity;
GO

-- 4. Posible doble conteo A–B: OV directas (sin oferta base) abiertas cuyo cliente y
--    artículo también tienen una oferta abierta. Es un indicio, no una prueba: puede ser
--    una venta nueva legítima. Si el número es alto, la solicitante decide la regla.
--    Valores con el método proporcional (LineTotal * OpenQty / Quantity).
SELECT '4_OfertaYOVDirecta' AS Consulta,
       COUNT(*) AS LineasOVDirectas,
       COUNT(DISTINCT R.DocEntry) AS OV,
       SUM(CASE WHEN R.Quantity <> 0 THEN R.LineTotal * R.OpenQty / R.Quantity ELSE 0 END) AS SaldoOV,
       SUM(Q.SaldoOferta) AS SaldoOfertaMismoClienteArticulo,
       SUM(CASE WHEN Q.FechaOferta <= RH.DocDate THEN 1 ELSE 0 END) AS OfertaAnteriorALaOV,
       SUM(CASE WHEN Q.VigenteHasta >= CAST(GETDATE() AS date) THEN 1 ELSE 0 END) AS ConOfertaVigente
FROM ORDR RH
INNER JOIN RDR1 R ON R.DocEntry = RH.DocEntry
INNER JOIN (
    SELECT QH.CardCode, QL.ItemCode,
           SUM(CASE WHEN QL.Quantity <> 0 THEN QL.LineTotal * QL.OpenQty / QL.Quantity ELSE 0 END) AS SaldoOferta,
           MIN(QH.DocDate) AS FechaOferta, MAX(QH.DocDueDate) AS VigenteHasta
    FROM OQUT QH
    INNER JOIN QUT1 QL ON QL.DocEntry = QH.DocEntry
    WHERE QH.CANCELED = 'N' AND QL.LineStatus = 'O'
    GROUP BY QH.CardCode, QL.ItemCode
) Q ON Q.CardCode = RH.CardCode AND Q.ItemCode = R.ItemCode
WHERE RH.CANCELED = 'N' AND R.LineStatus = 'O' AND R.BaseType = -1;
GO

-- 5. Posible doble conteo B–D: OV abiertas cuyo cliente y artículo tienen una factura
--    directa (sin documento base) en los últimos 90 días, posterior a la OV.
--    Indicio, no prueba: puede ser otra venta del mismo artículo.
SELECT '5_OVYFacturaDirecta' AS Consulta,
       COUNT(*) AS LineasOVAbiertas,
       COUNT(DISTINCT R.DocEntry) AS OV,
       SUM(CASE WHEN R.Quantity <> 0 THEN R.LineTotal * R.OpenQty / R.Quantity ELSE 0 END) AS SaldoOV,
       SUM(F.ValorFactura) AS ValorFacturaDirectaMismoClienteArticulo
FROM ORDR RH
INNER JOIN RDR1 R ON R.DocEntry = RH.DocEntry
INNER JOIN (
    SELECT IH.CardCode, IL.ItemCode, SUM(IL.LineTotal) AS ValorFactura, MAX(IH.DocDate) AS UltimaFactura
    FROM OINV IH
    INNER JOIN INV1 IL ON IL.DocEntry = IH.DocEntry
    WHERE IH.CANCELED = 'N' AND IL.BaseType = -1
      AND IH.DocDate >= DATEADD(DAY, -90, CAST(GETDATE() AS date))
    GROUP BY IH.CardCode, IL.ItemCode
) F ON F.CardCode = RH.CardCode AND F.ItemCode = R.ItemCode AND F.UltimaFactura >= RH.DocDate
WHERE RH.CANCELED = 'N' AND R.LineStatus = 'O';
GO

-- 6. Detalle de la consulta 5, una fila por línea de OV abierta: ¿la factura directa
--    parece la misma venta (misma cantidad, días después) o compras recurrentes
--    (muchas facturas, cantidades distintas)? Solo códigos, sin nombres.
SELECT '6_DetalleOVFacturaDirecta' AS Consulta,
       G.GroupName AS Canal, RH.DocNum AS OV, R.LineNum, RH.CardCode, R.ItemCode,
       CONVERT(varchar(10), RH.DocDate, 23) AS FechaOV,
       R.Quantity AS CantOV, R.OpenQty AS CantAbiertaOV,
       CASE WHEN R.Quantity <> 0 THEN R.LineTotal * R.OpenQty / R.Quantity ELSE 0 END AS SaldoOV,
       F.Facturas, F.CantFacturada, F.ValorFactura,
       CONVERT(varchar(10), F.PrimeraFactura, 23) AS PrimeraFactura,
       CONVERT(varchar(10), F.UltimaFactura, 23) AS UltimaFactura,
       CASE WHEN F.CantFacturada = R.OpenQty THEN 'Misma cantidad abierta'
            WHEN F.CantFacturada = R.Quantity THEN 'Misma cantidad de la OV'
            ELSE 'Cantidad distinta' END AS Comparacion
FROM ORDR RH
INNER JOIN RDR1 R ON R.DocEntry = RH.DocEntry
INNER JOIN OCRD C ON C.CardCode = RH.CardCode
LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
INNER JOIN (
    SELECT IH.CardCode, IL.ItemCode,
           COUNT(DISTINCT IH.DocEntry) AS Facturas, SUM(IL.Quantity) AS CantFacturada,
           SUM(IL.LineTotal) AS ValorFactura,
           MIN(IH.DocDate) AS PrimeraFactura, MAX(IH.DocDate) AS UltimaFactura
    FROM OINV IH
    INNER JOIN INV1 IL ON IL.DocEntry = IH.DocEntry
    WHERE IH.CANCELED = 'N' AND IL.BaseType = -1
      AND IH.DocDate >= DATEADD(DAY, -90, CAST(GETDATE() AS date))
    GROUP BY IH.CardCode, IL.ItemCode
) F ON F.CardCode = RH.CardCode AND F.ItemCode = R.ItemCode AND F.UltimaFactura >= RH.DocDate
WHERE RH.CANCELED = 'N' AND R.LineStatus = 'O'
ORDER BY SaldoOV DESC;
GO
