-- Consolidado comercial SAP: contraste entre el query "Tránsito" (fuentes/transito.sql)
-- y las reglas propuestas para C. Universo: entregas abiertas (CANCELED = 'N', LineStatus = 'O').
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS: cada
-- consulta va en su propio lote (GO). Compatible con nivel 100.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

GO

-- 1. Valor: el query de Tránsito suma LineTotal completo y repite la línea por cada factura
--    parcial (LEFT JOIN INV1). Nosotros: LineTotal * OpenQty / Quantity, una fila por línea.
SELECT '1_ValorTransito' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       CASE WHEN L.OpenQty < L.Quantity THEN 'Parcial' ELSE 'Completa' END AS Clase,
       COUNT(DISTINCT H.DocEntry) AS Entregas, COUNT(*) AS Lineas,
       SUM(ISNULL(F.FilasFactura, 0)) AS FilasFacturaParcial,
       SUM(L.LineTotal) AS ValorLineTotal,
       SUM(L.LineTotal * CASE WHEN ISNULL(F.FilasFactura, 0) > 1 THEN F.FilasFactura ELSE 1 END) AS ValorComoQueryTransito,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS SaldoNuestro
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN (SELECT BaseEntry, BaseLine, COUNT(*) AS FilasFactura
           FROM INV1 WHERE BaseType = 15
           GROUP BY BaseEntry, BaseLine) F ON F.BaseEntry = L.DocEntry AND F.BaseLine = L.LineNum
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         CASE WHEN L.OpenQty < L.Quantity THEN 'Parcial' ELSE 'Completa' END
ORDER BY Canal, Clase;

GO

-- 2. Filtros de Tránsito: Status entrega x Fecha ProyFAC (U_FechaRadFAC), con el saldo de cada combinación.
SELECT '2_StatusProyFAC' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       ISNULL(CAST(H.U_StatusEntrega AS nvarchar(20)), '(NULL)') AS StatusEntrega,
       CASE WHEN H.U_FechaRadFAC IS NULL THEN 'Vacía'
            WHEN H.U_FechaRadFAC < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN 'Mes anterior o antes'
            WHEN H.U_FechaRadFAC < DATEADD(month, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) THEN 'Mes en curso'
            ELSE 'Mes siguiente o después' END AS FechaProyFAC,
       COUNT(DISTINCT H.DocEntry) AS Entregas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         ISNULL(CAST(H.U_StatusEntrega AS nvarchar(20)), '(NULL)'),
         CASE WHEN H.U_FechaRadFAC IS NULL THEN 'Vacía'
              WHEN H.U_FechaRadFAC < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN 'Mes anterior o antes'
              WHEN H.U_FechaRadFAC < DATEADD(month, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) THEN 'Mes en curso'
              ELSE 'Mes siguiente o después' END
ORDER BY Canal, StatusEntrega, FechaProyFAC;

GO

-- 3. Tipo OV de las entregas abiertas (el encabezado de la entrega trae U_TipoPedidos).
SELECT '3_TipoOVEntregas' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       ISNULL(CAST(H.U_TipoPedidos AS nvarchar(10)), '(NULL)') AS TipoOV,
       COUNT(DISTINCT H.DocEntry) AS Entregas, COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         ISNULL(CAST(H.U_TipoPedidos AS nvarchar(10)), '(NULL)')
ORDER BY Canal, Saldo DESC;

GO

-- 4. Centro de costos: Tránsito usa CogsOcrCod; la regla propuesta usa OcrCode con respaldo del cliente.
SELECT '4_CentroCostosEntregas' AS Consulta,
       CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END AS Canal,
       CASE WHEN ISNULL(L.CogsOcrCod, '') = '' AND ISNULL(L.OcrCode, '') = '' THEN 'Ambos vacíos'
            WHEN ISNULL(L.CogsOcrCod, '') = '' THEN 'Solo OcrCode'
            WHEN ISNULL(L.OcrCode, '') = '' THEN 'Solo CogsOcrCod'
            WHEN L.CogsOcrCod = L.OcrCode THEN 'Iguales'
            ELSE 'Distintos' END AS Comparacion,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END) AS Saldo,
       MIN(L.CogsOcrCod) AS EjemploCogs, MIN(L.OcrCode) AS EjemploOcr, MIN(C.U_CentrodeCtos) AS EjemploCliente
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
LEFT JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN C.GroupCode = 113 THEN 'B2C' ELSE 'Otros' END,
         CASE WHEN ISNULL(L.CogsOcrCod, '') = '' AND ISNULL(L.OcrCode, '') = '' THEN 'Ambos vacíos'
              WHEN ISNULL(L.CogsOcrCod, '') = '' THEN 'Solo OcrCode'
              WHEN ISNULL(L.OcrCode, '') = '' THEN 'Solo CogsOcrCod'
              WHEN L.CogsOcrCod = L.OcrCode THEN 'Iguales'
              ELSE 'Distintos' END
ORDER BY Canal, Lineas DESC;

GO

-- 5. Uso de los campos de fecha y POD en las entregas abiertas B2C.
SELECT '5_CamposEntregaB2C' AS Consulta,
       COUNT(DISTINCT H.DocEntry) AS Entregas,
       SUM(CASE WHEN H.U_FechaDespacho IS NOT NULL THEN 1 ELSE 0 END) AS LineasConFechaDespacho,
       SUM(CASE WHEN H.U_FechaRadFAC IS NOT NULL THEN 1 ELSE 0 END) AS LineasConFechaProyFAC,
       SUM(CASE WHEN H.U_FechaRealEntregaEnt IS NOT NULL THEN 1 ELSE 0 END) AS LineasConFechaRealEnt,
       SUM(CASE WHEN ISNULL(CAST(H.U_POD AS nvarchar(20)), '') <> '' THEN 1 ELSE 0 END) AS LineasConPOD,
       COUNT(*) AS Lineas,
       MIN(H.U_FechaRadFAC) AS ProyFACMin, MAX(H.U_FechaRadFAC) AS ProyFACMax,
       MIN(CAST(H.U_POD AS nvarchar(20))) AS EjemploPOD, MAX(CAST(H.U_POD AS nvarchar(20))) AS OtroEjemploPOD
FROM ODLN H
JOIN DLN1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O' AND C.GroupCode = 113;
