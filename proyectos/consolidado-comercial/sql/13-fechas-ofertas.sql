-- Consolidado comercial SAP: ¿qué fecha usar para filtrar las ofertas abiertas por periodo?
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md (filtro de periodo para ofertas, OV y tránsito).
-- Hallazgo 2026-11-24: QUT1.ShipDate (fecha de entrega de la línea) viene vacía en las 237 ofertas abiertas.
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS. Pestañas 1 a 3.

USE Firplak_SA;
SET NOCOUNT ON;

GO

-- 1. Campos de usuario de tipo fecha en el encabezado (OQUT) y en las líneas (QUT1) de las ofertas.
SELECT '1_UDFFecha' AS Consulta, TableID AS Tabla, 'U_' + AliasID AS Campo, Descr AS Descripcion
FROM dbo.CUFD
WHERE TableID IN ('OQUT', 'QUT1') AND TypeID = 'D'
ORDER BY TableID, AliasID;

GO

-- 2. Fechas estándar en las líneas abiertas de ofertas: cuántas tienen valor y su rango.
SELECT '2_FechasEstandar' AS Consulta,
       COUNT(*) AS LineasAbiertas,
       SUM(CASE WHEN L.ShipDate IS NOT NULL THEN 1 ELSE 0 END) AS ConShipDateLinea,
       SUM(CASE WHEN H.DocDueDate IS NOT NULL THEN 1 ELSE 0 END) AS ConDocDueDate,
       SUM(CASE WHEN H.ReqDate IS NOT NULL THEN 1 ELSE 0 END) AS ConReqDate,
       SUM(CASE WHEN H.TaxDate IS NOT NULL THEN 1 ELSE 0 END) AS ConTaxDate,
       MIN(H.DocDueDate) AS MinDocDueDate, MAX(H.DocDueDate) AS MaxDocDueDate,
       MIN(H.ReqDate) AS MinReqDate, MAX(H.ReqDate) AS MaxReqDate,
       SUM(CASE WHEN H.ReqDate IS NOT NULL AND H.ReqDate <> H.DocDueDate THEN 1 ELSE 0 END) AS ReqDateDistintaDeDocDueDate
FROM dbo.OQUT H
JOIN dbo.QUT1 L ON L.DocEntry = H.DocEntry
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O';

GO

-- 3. Cuántas líneas abiertas tienen valor en cada campo de usuario de tipo fecha (los de la pestaña 1).
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + CASE WHEN @sql = N'' THEN N'' ELSE N' UNION ALL ' END
    + N'SELECT ''3_UDFLleno'' AS Consulta, ''' + TableID + N''' AS Tabla, ''U_' + AliasID + N''' AS Campo, '
    + N'SUM(CASE WHEN ' + CASE TableID WHEN 'OQUT' THEN N'H' ELSE N'L' END + N'.[U_' + AliasID + N'] IS NOT NULL THEN 1 ELSE 0 END) AS LineasConValor, '
    + N'MIN(' + CASE TableID WHEN 'OQUT' THEN N'H' ELSE N'L' END + N'.[U_' + AliasID + N']) AS Minimo, '
    + N'MAX(' + CASE TableID WHEN 'OQUT' THEN N'H' ELSE N'L' END + N'.[U_' + AliasID + N']) AS Maximo '
    + N'FROM dbo.OQUT H JOIN dbo.QUT1 L ON L.DocEntry = H.DocEntry WHERE H.CANCELED = ''N'' AND L.LineStatus = ''O'''
FROM dbo.CUFD
WHERE TableID IN ('OQUT', 'QUT1') AND TypeID = 'D';

IF @sql = N''
    SELECT '3_UDFLleno' AS Consulta, 'Sin campos de usuario de tipo fecha en ofertas' AS Resultado;
ELSE
    EXEC sp_executesql @sql;
