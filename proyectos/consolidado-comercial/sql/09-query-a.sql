-- Consolidado comercial SAP: query de A (ofertas abiertas).
-- Versión de validación: SOLO LECTURA sobre SAP; arma una tabla temporal #A en la sesión
-- y devuelve resúmenes y detalle. Mismas columnas que 08-query-b-c.sql para unir A, B y C
-- en la tabla de reporte de Planos_Symphony (decisión 4).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. Ejecutar TODO el archivo (F5) en SSMS. Compatible con nivel 100.
-- Pestañas 1 a 5.
--
-- Reglas (verificadas en 01, 03, 04 y 06):
--   Granularidad   una fila por línea: DocEntry + LineNum.
--   Universo       OQUT.CANCELED = 'N' y QUT1.LineStatus = 'O'. Sin filtro de vigencia (decisión 9).
--   Saldo          LineTotal * OpenQty / Quantity (COP, sin IVA).
--   Asesor         misma regla de tienda que B y C (U_Tiendas de la línea).
--   Centro costos  OcrCode de la línea; si está vacío, OCRD.U_CentrodeCtos del cliente.
--   Fecha          FechaDespacho = QUT1.ShipDate (fecha de entrega prevista de la línea).
-- Default (columna EnDefault): Canal B2C, subgrupo 106-01 o 106-02 (MAC fuera), sin Donaciones.
--   No excluye por Tipo OV (en ofertas va vacío en el 26 % del saldo, 04) ni por estado de
--   oferta: canceladas, vencidas y tipo 15 quedan como columnas para filtrar.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

IF OBJECT_ID('tempdb..#A') IS NOT NULL DROP TABLE #A;

SELECT Y.*,
       CASE WHEN Y.GroupCode = 113 AND Y.Subgrupo IN ('106-01', '106-02') AND Y.Donacion = 'No'
            THEN 'Si' ELSE 'No' END AS EnDefault
INTO #A
FROM (
    SELECT X.*,
           CASE X.Subgrupo WHEN '106-01' THEN 'Firplak Home' WHEN '106-02' THEN 'Ecommerce'
                           WHEN '106-04' THEN 'MAC' ELSE 'Otro' END AS SegmentoB2C,
           CASE WHEN X.TipoOV IN ('4', '6', '7', '9', '12', '15') THEN 'Si' ELSE 'No' END AS TipoOVExcluido,
           CASE WHEN X.TipoVentas = 'Donaciones' THEN 'Si' ELSE 'No' END AS Donacion,
           CASE WHEN X.ValidaHasta >= CAST(GETDATE() AS date) THEN 'Vigente' ELSE 'Vencida' END AS Vigencia,
           -- U_Estado_Oferta_Venta guarda '01', '02', '03' (con cero a la izquierda, 04 consulta 2).
           CASE WHEN X.EstadoOferta IN ('1', '01') THEN 'Confirmada'
                WHEN X.EstadoOferta IN ('2', '02') THEN 'Pendiente'
                WHEN X.EstadoOferta IN ('3', '03') THEN 'Cancelada'
                WHEN X.EstadoOferta IS NULL THEN '(sin estado)'
                ELSE 'Otro: ' + X.EstadoOferta END AS EstadoOfertaNombre
    FROM (
        SELECT 'A_OFERTA' AS Etapa, 23 AS ObjType, H.DocEntry, L.LineNum, H.DocNum, H.DocDate,
               H.DocDueDate AS ValidaHasta,
               H.CardCode, H.CardName, C.GroupCode, G.GroupName AS Canal,
               C.U_SubGroupCode AS Subgrupo, S.Name AS SubgrupoNombre,
               CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END AS SlpCode,
               ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), ''), C.U_CentrodeCtos) AS CentroCostos,
               CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NULL THEN 'Cliente' ELSE 'Linea' END AS OrigenCentroCostos,
               NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), '') AS TipoOV,
               NULLIF(LTRIM(RTRIM(CAST(H.U_Estado_Oferta_Venta AS nvarchar(10)))), '') AS EstadoOferta,
               L.ShipDate AS FechaDespacho,
               CAST(H.U_TipoVentas AS nvarchar(30)) AS TipoVentas,
               H.DocCur AS Moneda,
               L.ItemCode, L.Dscription, L.Quantity, L.OpenQty, L.LineTotal,
               CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END AS Saldo
        FROM OQUT H
        JOIN QUT1 L ON L.DocEntry = H.DocEntry
        LEFT JOIN OCRD C ON C.CardCode = H.CardCode
        LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
        LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
        LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
        WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    ) X
) Y;

GO

-- 1. Embudo y composición del default.
SELECT '1_Embudo' AS Consulta,
       COUNT(*) AS Lineas,
       SUM(Saldo) AS TodosCanales,
       SUM(CASE WHEN GroupCode IS NULL THEN Saldo ELSE 0 END) AS SinClienteEnMaestro,
       SUM(CASE WHEN GroupCode = 113 THEN Saldo ELSE 0 END) AS B2C,
       SUM(CASE WHEN GroupCode = 113 AND Subgrupo IN ('106-01', '106-02') THEN Saldo ELSE 0 END) AS B2CSinMAC,
       SUM(CASE WHEN EnDefault = 'Si' THEN Saldo ELSE 0 END) AS Default_,
       SUM(CASE WHEN EnDefault = 'Si' THEN 1 ELSE 0 END) AS LineasDefault,
       COUNT(DISTINCT CASE WHEN EnDefault = 'Si' THEN DocEntry END) AS OfertasDefault,
       SUM(CASE WHEN EnDefault = 'Si' AND Vigencia = 'Vigente' THEN Saldo ELSE 0 END) AS DefaultVigentes,
       SUM(CASE WHEN EnDefault = 'Si' AND EstadoOfertaNombre = 'Cancelada' THEN Saldo ELSE 0 END) AS DefaultCanceladas,
       SUM(CASE WHEN EnDefault = 'Si' AND EstadoOfertaNombre = 'Confirmada' THEN Saldo ELSE 0 END) AS DefaultConfirmadas,
       SUM(CASE WHEN EnDefault = 'Si' AND EstadoOfertaNombre = '(sin estado)' THEN Saldo ELSE 0 END) AS DefaultSinEstado,
       SUM(CASE WHEN EnDefault = 'Si' AND TipoOVExcluido = 'Si' THEN Saldo ELSE 0 END) AS DefaultTipoExcluido,
       SUM(CASE WHEN EnDefault = 'Si' AND TipoOV IS NULL THEN Saldo ELSE 0 END) AS DefaultSinTipo,
       SUM(CASE WHEN EnDefault = 'Si' AND TipoVentas = 'Excluido' THEN Saldo ELSE 0 END) AS DefaultTipoVentasExcluido,
       SUM(CASE WHEN EnDefault = 'Si' AND ISNULL(Moneda, '') NOT IN ('$', 'COP', '') THEN Saldo ELSE 0 END) AS DefaultOtraMoneda
FROM #A;

GO

-- 2. Default por segmento y asesor.
SELECT '2_DefaultAsesor' AS Consulta, A.SegmentoB2C, A.SlpCode, P.SlpName AS Asesor,
       COUNT(DISTINCT A.DocEntry) AS Ofertas, COUNT(*) AS Lineas, SUM(A.Saldo) AS Saldo
FROM #A A
LEFT JOIN OSLP P ON P.SlpCode = A.SlpCode
WHERE A.EnDefault = 'Si'
GROUP BY A.SegmentoB2C, A.SlpCode, P.SlpName
ORDER BY A.SegmentoB2C, Saldo DESC;

GO

-- 3. Default por centro de costos.
SELECT '3_DefaultCentroCostos' AS Consulta, A.CentroCostos, R.OcrName, A.OrigenCentroCostos,
       COUNT(*) AS Lineas, SUM(A.Saldo) AS Saldo
FROM #A A
LEFT JOIN OOCR R ON R.OcrCode = A.CentroCostos
WHERE A.EnDefault = 'Si'
GROUP BY A.CentroCostos, R.OcrName, A.OrigenCentroCostos
ORDER BY Saldo DESC;

GO

-- 4. Controles de calidad (todas las filas). Las columnas _0 deben dar 0.
SELECT '4_Controles' AS Consulta,
       COUNT(*) AS Lineas,
       COUNT(*) - COUNT(DISTINCT CAST(DocEntry AS varchar(12)) + '-' + CAST(LineNum AS varchar(12))) AS Duplicados_0,
       SUM(CASE WHEN Quantity = 0 THEN 1 ELSE 0 END) AS CantidadCero,
       SUM(CASE WHEN Saldo < 0 THEN 1 ELSE 0 END) AS SaldoNegativo_0,
       SUM(CASE WHEN SlpCode IS NULL THEN 1 ELSE 0 END) AS SinAsesor,
       SUM(CASE WHEN NULLIF(LTRIM(RTRIM(CentroCostos)), '') IS NULL THEN 1 ELSE 0 END) AS SinCentroCostos,
       SUM(CASE WHEN GroupCode IS NULL THEN 1 ELSE 0 END) AS SinCanal,
       SUM(CASE WHEN EnDefault = 'Si' AND SlpCode IS NULL THEN 1 ELSE 0 END) AS DefaultSinAsesor_0,
       SUM(CASE WHEN EnDefault = 'Si' AND NULLIF(LTRIM(RTRIM(CentroCostos)), '') IS NULL THEN 1 ELSE 0 END) AS DefaultSinCentroCostos_0
FROM #A;

GO

-- 5. Detalle del default, para exportar a Excel.
SELECT '5_DetalleDefault' AS Consulta, A.DocNum, A.LineNum, A.DocDate, A.ValidaHasta, A.Vigencia,
       A.CardCode, A.CardName, A.SegmentoB2C, P.SlpName AS Asesor, A.CentroCostos, A.OrigenCentroCostos,
       A.TipoOV, A.EstadoOfertaNombre, A.FechaDespacho, A.TipoVentas, A.Moneda,
       A.ItemCode, A.Dscription, A.Quantity, A.OpenQty, A.LineTotal, A.Saldo
FROM #A A
LEFT JOIN OSLP P ON P.SlpCode = A.SlpCode
WHERE A.EnDefault = 'Si'
ORDER BY A.DocNum, A.LineNum;

GO

DROP TABLE #A;
