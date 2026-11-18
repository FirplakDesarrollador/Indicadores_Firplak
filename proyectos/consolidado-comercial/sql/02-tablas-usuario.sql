-- Consolidado comercial SAP: tablas de usuario y uso de campos candidatos.
-- Complementa 01-descubrimiento.sql con lo que salió de la consulta 1.
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5).
-- Pestañas numeradas de 1 a 9. No devuelve nombres de personas.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- 1. Tipo OV: códigos de @FIR_TIPOPEDIDOS (la guía excluye 4, 6, 7, 9, 12, 15).
SELECT '1_TipoPedidos' AS Consulta, Code, Name FROM [@FIR_TIPOPEDIDOS] ORDER BY Code;

-- 2. Subgrupo de cliente (Firplak Home, Ecommerce).
SELECT '2_SubgrupoCliente' AS Consulta, Code, Name FROM [@FIR_SUBGRUPOCLIENTE] ORDER BY Code;

-- 3. Segmento del pedido y tipo de ventas.
SELECT '3_Segmentacion' AS Consulta, Code, Name FROM [@FIR_SEGMENTACION] ORDER BY Code;
SELECT '3_TipoVentas' AS Consulta, Code, Name FROM [@FIR_TIPOVENTAS] ORDER BY Code;

-- 4. Estrategia de cliente.
SELECT '4_EstrategiaCliente' AS Consulta, Code, Name FROM [@FIR_ESTRATEG_CLIENT] ORDER BY Code;

-- 5. OV abiertas por Tipo OV y Status entrega (valores reales, incluidos los no numéricos).
--    Firplak_SA no acepta TRY_CONVERT (nivel de compatibilidad < 110, ver consulta 5b):
--    se valida con LIKE que el texto tenga solo dígitos.
SELECT '5_OV_Tipo_Status' AS Consulta, H.U_TipoPedidos AS TipoOV, H.U_StatusEntrega AS StatusEntrega,
       CASE WHEN H.U_StatusEntrega IS NULL THEN 'NULL'
            WHEN LTRIM(RTRIM(H.U_StatusEntrega)) = '' THEN 'VACIO'
            WHEN LTRIM(RTRIM(H.U_StatusEntrega)) LIKE '%[^0-9]%'
                 OR LEN(LTRIM(RTRIM(H.U_StatusEntrega))) > 9 THEN 'NO_NUMERICO'
            ELSE 'NUMERICO' END AS ClaseStatus,
       COUNT(DISTINCT H.DocEntry) AS OV, COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto
FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY H.U_TipoPedidos, H.U_StatusEntrega
ORDER BY H.U_TipoPedidos, H.U_StatusEntrega;

-- 5c. Entregas abiertas por Status entrega, Despachado y Tipo facturación.
--     En las OV abiertas U_StatusEntrega viene siempre NULL (consulta 5): se revisa
--     si se diligencia en la entrega, que es donde aplicaría el filtro de la guía.
SELECT '5c_Entrega_Status' AS Consulta, H.U_StatusEntrega AS StatusEntrega,
       CASE WHEN H.U_StatusEntrega IS NULL THEN 'NULL'
            WHEN LTRIM(RTRIM(H.U_StatusEntrega)) = '' THEN 'VACIO'
            WHEN LTRIM(RTRIM(H.U_StatusEntrega)) LIKE '%[^0-9]%'
                 OR LEN(LTRIM(RTRIM(H.U_StatusEntrega))) > 9 THEN 'NO_NUMERICO'
            ELSE 'NUMERICO' END AS ClaseStatus,
       H.U_Despachado AS Despachado, H.U_TipoFacturacion AS TipoFacturacion,
       COUNT(DISTINCT H.DocEntry) AS Entregas, COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto
FROM ODLN H JOIN DLN1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY H.U_StatusEntrega, H.U_Despachado, H.U_TipoFacturacion
ORDER BY H.U_StatusEntrega, H.U_Despachado, H.U_TipoFacturacion;

-- 5b. Nivel de compatibilidad y versión: define qué funciones T-SQL se pueden usar
--     en cada base (TRY_CONVERT requiere nivel 110 o superior).
SELECT '5b_Compatibilidad' AS Consulta, name AS BaseDatos, compatibility_level AS NivelCompatibilidad,
       CAST(SERVERPROPERTY('ProductVersion') AS varchar(30)) AS VersionServidor
FROM sys.databases
WHERE name IN ('Firplak_SA', 'Planos_Symphony', 'DBViventta');

-- 6. Uso de los campos candidatos a Fecha ProyFAC, fecha de despacho, tienda y centro
--    de costos en las líneas de OV abiertas: cuántas los tienen llenos y rango de fechas.
SELECT '6_UsoCampos' AS Consulta, Campo, Llenos, Total, Minimo, Maximo
FROM (
    SELECT 'ORDR.U_HBT_PerFacturacion' AS Campo, COUNT(H.U_HBT_PerFacturacion) AS Llenos, COUNT(*) AS Total,
           CONVERT(varchar(10), MIN(H.U_HBT_PerFacturacion), 23) AS Minimo, CONVERT(varchar(10), MAX(H.U_HBT_PerFacturacion), 23) AS Maximo
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'ORDR.U_FechaIniPlanDespOV', COUNT(H.U_FechaIniPlanDespOV), COUNT(*),
           CONVERT(varchar(10), MIN(H.U_FechaIniPlanDespOV), 23), CONVERT(varchar(10), MAX(H.U_FechaIniPlanDespOV), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'ORDR.U_FechaaSodimac', COUNT(H.U_FechaaSodimac), COUNT(*),
           CONVERT(varchar(10), MIN(H.U_FechaaSodimac), 23), CONVERT(varchar(10), MAX(H.U_FechaaSodimac), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'ORDR.U_Fecha_Plan_Ent_Cliente', COUNT(H.U_Fecha_Plan_Ent_Cliente), COUNT(*),
           CONVERT(varchar(10), MIN(H.U_Fecha_Plan_Ent_Cliente), 23), CONVERT(varchar(10), MAX(H.U_Fecha_Plan_Ent_Cliente), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'ORDR.U_FechaDespacho', COUNT(H.U_FechaDespacho), COUNT(*),
           CONVERT(varchar(10), MIN(H.U_FechaDespacho), 23), CONVERT(varchar(10), MAX(H.U_FechaDespacho), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'ORDR.U_FRequeridaDesp', COUNT(H.U_FRequeridaDesp), COUNT(*),
           CONVERT(varchar(10), MIN(H.U_FRequeridaDesp), 23), CONVERT(varchar(10), MAX(H.U_FRequeridaDesp), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'RDR1.U_FechaIniPlanDesp', COUNT(L.U_FechaIniPlanDesp), COUNT(*),
           CONVERT(varchar(10), MIN(L.U_FechaIniPlanDesp), 23), CONVERT(varchar(10), MAX(L.U_FechaIniPlanDesp), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'RDR1.ShipDate (estándar)', COUNT(L.ShipDate), COUNT(*),
           CONVERT(varchar(10), MIN(L.ShipDate), 23), CONVERT(varchar(10), MAX(L.ShipDate), 23)
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'RDR1.U_Tiendas', SUM(CASE WHEN NULLIF(LTRIM(RTRIM(L.U_Tiendas)), '') IS NOT NULL THEN 1 ELSE 0 END), COUNT(*), NULL, NULL
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'RDR1.U_CentroCostos', SUM(CASE WHEN NULLIF(LTRIM(RTRIM(L.U_CentroCostos)), '') IS NOT NULL THEN 1 ELSE 0 END), COUNT(*), NULL, NULL
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    UNION ALL
    SELECT 'RDR1.OcrCode (estándar)', SUM(CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NOT NULL THEN 1 ELSE 0 END), COUNT(*), NULL, NULL
    FROM ORDR H JOIN RDR1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
) X;

-- 6b. Respaldo del centro de costos: para las líneas de OV abiertas sin OcrCode,
--     ¿lo trae U_CentroCostos de la línea o U_CentrodeCtos del cliente? ¿Coinciden
--     cuando ambos están llenos?
SELECT '6b_RespaldoCentroCostos' AS Consulta,
       CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NOT NULL THEN 'Con OcrCode' ELSE 'Sin OcrCode' END AS OcrCode,
       CASE WHEN NULLIF(LTRIM(RTRIM(L.U_CentroCostos)), '') IS NULL THEN 'U_CentroCostos vacío'
            WHEN L.U_CentroCostos = L.OcrCode THEN 'U_CentroCostos = OcrCode'
            ELSE 'U_CentroCostos distinto' END AS UDFLinea,
       CASE WHEN NULLIF(LTRIM(RTRIM(C.U_CentrodeCtos)), '') IS NULL THEN 'Cliente vacío'
            WHEN C.U_CentrodeCtos = L.OcrCode THEN 'Cliente = OcrCode'
            ELSE 'Cliente distinto' END AS UDFCliente,
       COUNT(*) AS Lineas, SUM(L.OpenSum) AS SaldoAbierto,
       MIN(L.U_CentroCostos) AS EjemploUDFLinea, MIN(C.U_CentrodeCtos) AS EjemploUDFCliente
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NOT NULL THEN 'Con OcrCode' ELSE 'Sin OcrCode' END,
         CASE WHEN NULLIF(LTRIM(RTRIM(L.U_CentroCostos)), '') IS NULL THEN 'U_CentroCostos vacío'
              WHEN L.U_CentroCostos = L.OcrCode THEN 'U_CentroCostos = OcrCode'
              ELSE 'U_CentroCostos distinto' END,
         CASE WHEN NULLIF(LTRIM(RTRIM(C.U_CentrodeCtos)), '') IS NULL THEN 'Cliente vacío'
              WHEN C.U_CentrodeCtos = L.OcrCode THEN 'Cliente = OcrCode'
              ELSE 'Cliente distinto' END
ORDER BY OcrCode, Lineas DESC;

-- 7. OV abiertas por subgrupo de cliente y segmento del pedido.
SELECT '7_Subgrupo_Segmento' AS Consulta, C.U_SubGroupCode AS Subgrupo, S.Name AS NombreSubgrupo,
       H.U_Segmentacion AS Segmento, COUNT(DISTINCT H.DocEntry) AS OV, SUM(L.OpenSum) AS SaldoAbierto
FROM ORDR H
JOIN RDR1 L ON L.DocEntry = H.DocEntry
JOIN OCRD C ON C.CardCode = H.CardCode
LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
GROUP BY C.U_SubGroupCode, S.Name, H.U_Segmentacion
ORDER BY SaldoAbierto DESC;

-- 8. Informe_ventas del mes: ¿GrupoCliente usa los mismos nombres que OCRG (canal)?
--    ¿CentroCostos trae el código (GV-...) o el nombre?
SELECT '8_InformeVentasCanal' AS Consulta, I.Empresa, I.GrupoCliente,
       CASE WHEN G.GroupName IS NOT NULL THEN 'Coincide con OCRG' ELSE 'No coincide' END AS ContraOCRG,
       COUNT(*) AS Lineas, SUM(I.ValorTotal) AS Valor,
       MIN(I.CentroCostos) AS EjemploCentroCostos, MAX(I.CentroCostos) AS OtroEjemploCentroCostos
FROM Planos_Symphony.dbo.Informe_ventas I
LEFT JOIN OCRG G ON G.GroupName = I.GrupoCliente
WHERE I.FechaContabilizacion >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
GROUP BY I.Empresa, I.GrupoCliente, CASE WHEN G.GroupName IS NOT NULL THEN 'Coincide con OCRG' ELSE 'No coincide' END
ORDER BY Valor DESC;

-- 9. ¿ValorTotal es sin IVA? Compara las facturas del mes en Informe_ventas contra
--    INV1.LineTotal (sin IVA) y INV1.GTotal (con IVA) por DocEntry + LineNum.
SELECT '9_ValorTotalVsSAP' AS Consulta,
       COUNT(*) AS Lineas,
       SUM(CASE WHEN L.DocEntry IS NULL THEN 1 ELSE 0 END) AS SinLineaEnSAP,
       SUM(I.ValorTotal) AS SumaValorTotal,
       SUM(L.LineTotal) AS SumaLineTotalSinIVA,
       SUM(L.GTotal) AS SumaGTotalConIVA,
       SUM(CASE WHEN ABS(I.ValorTotal - L.LineTotal) <= 1 THEN 1 ELSE 0 END) AS LineasIgualSinIVA,
       SUM(CASE WHEN ABS(I.ValorTotal - L.GTotal) <= 1 THEN 1 ELSE 0 END) AS LineasIgualConIVA,
       SUM(CASE WHEN H.SlpCode IS NOT NULL THEN 1 ELSE 0 END) AS LineasConSlpCodeRecuperable
FROM Planos_Symphony.dbo.Informe_ventas I
LEFT JOIN INV1 L ON L.DocEntry = I.DocEntry AND L.LineNum = I.LineNum
LEFT JOIN OINV H ON H.DocEntry = L.DocEntry
WHERE I.Empresa = 'Firplak' AND I.TipoDocumento = 'Factura'
  AND I.FechaContabilizacion >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
