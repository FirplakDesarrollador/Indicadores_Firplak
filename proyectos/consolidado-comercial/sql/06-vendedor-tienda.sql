-- Consolidado comercial SAP: regla de "Vendedor Senior" con tienda.
-- Hipótesis (query de facturas del repositorio, bi-origen/.../Facturas.tmdl):
--   si la línea tiene U_TIENDAS vacío -> vendedor del encabezado (OINV.SlpCode);
--   si no -> vendedor del cliente-tienda (OCRD.SlpCode del CardCode en U_TIENDAS).
-- La consulta 4 de 05-contraste-visor-ov.sql mostró que VendedorSenior coincide a veces con
-- el encabezado y a veces con la línea, nunca con ninguno. Este script lo comprueba.
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO). Compatible con nivel 100.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. ¿La regla reproduce VendedorSenior de Informe_ventas? Facturas de Firplak, mes anterior y en curso.
SELECT '1_ReglaVendedorFacturas' AS Consulta,
       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END AS Tienda,
       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN PH.SlpName ELSE PT.SlpName END AS VendedorRegla_Ejemplo,
       CASE WHEN I.VendedorSenior = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN PH.SlpName ELSE PT.SlpName END
            THEN 'Si' ELSE 'No' END AS CoincideRegla,
       COUNT(*) AS Lineas, SUM(I.ValorTotal) AS Valor
FROM Planos_Symphony.dbo.Informe_ventas I
JOIN INV1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
JOIN OINV H ON H.DocEntry = L.DocEntry
LEFT JOIN OSLP PH ON PH.SlpCode = H.SlpCode
LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
LEFT JOIN OSLP PT ON PT.SlpCode = T.SlpCode
WHERE I.Empresa = 'Firplak' AND I.TipoDocumento = 'Factura'
  AND I.FechaContabilizacion >= DATEADD(month, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
GROUP BY CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END,
         CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN PH.SlpName ELSE PT.SlpName END,
         CASE WHEN I.VendedorSenior = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN PH.SlpName ELSE PT.SlpName END
              THEN 'Si' ELSE 'No' END
ORDER BY CoincideRegla, Lineas DESC;

GO

-- 2. ¿En qué tablas de línea existe el campo U_Tiendas?
SELECT '2_CampoTiendas' AS Consulta, TableID, AliasID, Descr
FROM CUFD
WHERE AliasID = 'Tiendas' AND TableID IN ('QUT1', 'RDR1', 'DLN1', 'INV1', 'RIN1');

GO

-- 3. OV abiertas: líneas con tienda y vendedor según la regla vs. vendedor de la línea.
SELECT '3_OVTienda' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END AS Tienda,
       CASE WHEN L.SlpCode = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END
            THEN 'Igual' ELSE 'Distinto' END AS ReglaVsLinea,
       COUNT(DISTINCT H.DocEntry) AS OV, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END,
         CASE WHEN L.SlpCode = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END
              THEN 'Igual' ELSE 'Distinto' END
ORDER BY Canal, Tienda, ReglaVsLinea;

GO

-- 4. Entregas abiertas: lo mismo. Si la consulta 2 no muestra DLN1, esta falla sola; ignorar el error.
SELECT '4_EntregaTienda' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END AS Tienda,
       CASE WHEN L.SlpCode = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END
            THEN 'Igual' ELSE 'Distinto' END AS ReglaVsLinea,
       COUNT(DISTINCT H.DocEntry) AS Entregas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN 'Sin tienda' ELSE 'Con tienda' END,
         CASE WHEN L.SlpCode = CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END
              THEN 'Igual' ELSE 'Distinto' END
ORDER BY Canal, Tienda, ReglaVsLinea;
