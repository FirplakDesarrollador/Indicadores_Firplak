-- Consolidado comercial SAP: consultas de descubrimiento (paso 1 y 2 de la guía).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA: no crea tablas, vistas ni temporales.
-- Ejecutar todo el archivo en una misma ventana (F5). Cada consulta devuelve una
-- pestaña de resultados numerada (1 a 14). Pegar los resultados en el chat; ninguna
-- consulta devuelve nombres de personas, solo códigos, conteos y sumas.
--
-- Tipos de objeto SAP B1: 23 oferta, 17 orden de venta, 15 entrega, 13 factura,
-- 14 nota crédito, 16 devolución, -1 sin documento base.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; -- no bloquear SAP

-- 1. Campos de usuario (UDF) de los documentos de venta, clientes y asesores.
--    Sirve para encontrar Status entrega, Tipo OV, Fecha ProyFAC, fecha de despacho,
--    tienda, canal y subgrupo, que la guía nombra pero no identifica.
SELECT '1_UDF' AS Consulta, F.TableID, 'U_' + F.AliasID AS Campo, F.Descr, F.TypeID, F.EditType,
       F.SizeID, F.RTable AS TablaVinculada,
       (SELECT COUNT(*) FROM UFD1 V WHERE V.TableID = F.TableID AND V.FieldID = F.FieldID) AS ValoresValidos
FROM CUFD F
WHERE F.TableID IN ('OQUT','QUT1','ORDR','RDR1','ODLN','DLN1','OINV','INV1','OCRD','OSLP')
ORDER BY F.TableID, F.AliasID;

-- 2. Valores válidos de los UDF con lista cerrada (códigos de Status entrega, Tipo OV, etc.).
SELECT '2_ValoresUDF' AS Consulta, F.TableID, 'U_' + F.AliasID AS Campo, F.Descr AS DescrCampo,
       V.FldValue AS Codigo, V.Descr AS Significado
FROM CUFD F
JOIN UFD1 V ON V.TableID = F.TableID AND V.FieldID = F.FieldID
WHERE F.TableID IN ('OQUT','QUT1','ORDR','RDR1','ODLN','DLN1','OCRD')
ORDER BY F.TableID, F.AliasID, V.IndexID;

-- 3. Volumen y valor abierto por etapa (estado actual).
--    Compara OpenSum (saldo abierto que calcula SAP, moneda local) contra el cálculo
--    proporcional de la guía (LineTotal * OpenQty / Quantity). Si coinciden, se usa OpenSum.
SELECT '3_Abierto' AS Consulta, Etapa, COUNT(*) AS Lineas, COUNT(DISTINCT DocEntry) AS Documentos,
       SUM(OpenSum) AS SumaOpenSum,
       SUM(CASE WHEN Quantity <> 0 THEN LineTotal * OpenQty / Quantity ELSE 0 END) AS SumaProporcional,
       SUM(CASE WHEN OpenQty < Quantity THEN 1 ELSE 0 END) AS LineasParciales,
       MIN(DocDate) AS FechaMasAntigua
FROM (
    SELECT 'A_OFERTA' AS Etapa, L.DocEntry, L.OpenSum, L.LineTotal, L.OpenQty, L.Quantity, H.DocDate
    FROM OQUT H JOIN QUT1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'B_OV', L.DocEntry, L.OpenSum, L.LineTotal, L.OpenQty, L.Quantity, H.DocDate
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'C_ENTREGA', L.DocEntry, L.OpenSum, L.LineTotal, L.OpenQty, L.Quantity, H.DocDate
    FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry
    WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
) X
GROUP BY Etapa
ORDER BY Etapa;

-- 4. Moneda y descuento de encabezado en documentos abiertos.
--    Si hay moneda extranjera o DiscPrcnt de encabezado, el valor de línea no basta.
SELECT '4_MonedaDescuento' AS Consulta, Etapa, DocCur,
       COUNT(*) AS Documentos,
       SUM(CASE WHEN DiscPrcnt <> 0 THEN 1 ELSE 0 END) AS ConDescuentoEncabezado,
       SUM(CASE WHEN TotalExpns <> 0 THEN 1 ELSE 0 END) AS ConFletesGastos
FROM (
    SELECT 'A_OFERTA' AS Etapa, DocCur, DiscPrcnt, TotalExpns FROM OQUT
    WHERE CANCELED = 'N' AND DocStatus = 'O'
    UNION ALL
    SELECT 'B_OV', DocCur, DiscPrcnt, TotalExpns FROM ORDR
    WHERE CANCELED = 'N' AND DocStatus = 'O'
    UNION ALL
    SELECT 'C_ENTREGA', DocCur, DiscPrcnt, TotalExpns FROM ODLN
    WHERE CANCELED = 'N' AND DocStatus = 'O'
) X
GROUP BY Etapa, DocCur
ORDER BY Etapa, DocCur;

-- 5. Trazabilidad de OV abiertas: ¿vienen de oferta o son directas?
SELECT '5_OrigenOV' AS Consulta, L.BaseType, COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto
FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY L.BaseType
ORDER BY L.BaseType;

-- 6. Trazabilidad de entregas abiertas: base OV, directa o factura de reserva (13).
--    Las que tienen base 13 ya están facturadas: contarlas en C y en D sería doble conteo.
SELECT '6_OrigenEntrega' AS Consulta, L.BaseType, COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto
FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY L.BaseType
ORDER BY L.BaseType;

-- 7. Origen de las facturas de los últimos 12 meses y facturas de reserva (isIns = 'Y').
SELECT '7_OrigenFactura' AS Consulta, H.isIns AS FacturaReserva, L.BaseType,
       COUNT(*) AS Lineas, SUM(L.LineTotal) AS Valor
FROM OINV H JOIN INV1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND H.DocDate >= DATEADD(MONTH, -12, CAST(GETDATE() AS date))
GROUP BY H.isIns, L.BaseType
ORDER BY H.isIns, L.BaseType;

-- 8. Ofertas abiertas por antigüedad y vigencia (DocDueDate = válida hasta).
--    Define si las ofertas vencidas deben salir del indicador A.
SELECT '8_OfertasVigencia' AS Consulta, YEAR(H.DocDate) AS Anio,
       CASE WHEN H.DocDueDate < CAST(GETDATE() AS date) THEN 'Vencida' ELSE 'Vigente' END AS Vigencia,
       COUNT(DISTINCT H.DocEntry) AS Documentos, SUM(L.OpenSum) AS SaldoAbierto
FROM OQUT H JOIN QUT1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY YEAR(H.DocDate), CASE WHEN H.DocDueDate < CAST(GETDATE() AS date) THEN 'Vencida' ELSE 'Vigente' END
ORDER BY Anio, Vigencia;

-- 9. Asesor: ¿la línea trae su propio asesor distinto al del encabezado?
SELECT '9_AsesorLinea' AS Consulta, Etapa,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN LinSlp <> HdrSlp THEN 1 ELSE 0 END) AS LineasConAsesorDistinto,
       COUNT(DISTINCT HdrSlp) AS AsesoresEncabezado
FROM (
    SELECT 'A_OFERTA' AS Etapa, H.SlpCode AS HdrSlp, L.SlpCode AS LinSlp
    FROM OQUT H JOIN QUT1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'B_OV', H.SlpCode, L.SlpCode
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'C_ENTREGA', H.SlpCode, L.SlpCode
    FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
) X
GROUP BY Etapa
ORDER BY Etapa;

-- 10. Grupo de cliente (OCRG) de las OV abiertas: candidato para Canal (B2C).
SELECT '10_GrupoCliente' AS Consulta, C.GroupCode, G.GroupName,
       COUNT(DISTINCT H.DocEntry) AS OVAbiertas, SUM(L.OpenSum) AS SaldoAbierto
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY C.GroupCode, G.GroupName
ORDER BY SaldoAbierto DESC;

-- 11. Centro de costos (norma de reparto 1) de las líneas de OV abiertas.
SELECT '11_CentroCostos' AS Consulta, L.OcrCode, R.OcrName,
       COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OOCR R ON R.OcrCode = L.OcrCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY L.OcrCode, R.OcrName
ORDER BY SaldoAbierto DESC;

-- 12. Informe_ventas (fuente acordada para D): columnas disponibles.
SELECT '12_ColumnasInformeVentas' AS Consulta, COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION
FROM Planos_Symphony.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Informe_ventas'
ORDER BY ORDINAL_POSITION;

-- 13. Informe_ventas del mes en curso por empresa, tipo de documento y tipo de ventas.
SELECT '13_InformeVentasMes' AS Consulta, Empresa, TipoDocumento, TipoVentas,
       COUNT(*) AS Lineas, SUM(ValorTotal) AS Valor
FROM Planos_Symphony.dbo.Informe_ventas
WHERE FechaContabilizacion >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
GROUP BY Empresa, TipoDocumento, TipoVentas
ORDER BY Empresa, TipoDocumento, TipoVentas;

-- 14. Viventta: ¿tiene ofertas, OV o entregas abiertas? (decide si entra en A, B y C).
IF DB_ID('DBViventta') IS NOT NULL
    EXEC('
    SELECT ''14_Viventta'' AS Consulta, Etapa, COUNT(*) AS Lineas, SUM(OpenSum) AS SaldoAbierto
    FROM (
        SELECT ''A_OFERTA'' AS Etapa, L.OpenSum FROM DBViventta.dbo.OQUT H
            JOIN DBViventta.dbo.QUT1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = ''N'' AND L.LineStatus = ''O''
        UNION ALL
        SELECT ''B_OV'', L.OpenSum FROM DBViventta.dbo.ORDR H
            JOIN DBViventta.dbo.RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = ''N'' AND L.LineStatus = ''O''
        UNION ALL
        SELECT ''C_ENTREGA'', L.OpenSum FROM DBViventta.dbo.ODLN H
            JOIN DBViventta.dbo.DLN1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = ''N'' AND L.LineStatus = ''O''
    ) X
    GROUP BY Etapa ORDER BY Etapa;');
ELSE
    SELECT '14_Viventta' AS Consulta, 'No existe la base DBViventta en este servidor' AS Resultado;
