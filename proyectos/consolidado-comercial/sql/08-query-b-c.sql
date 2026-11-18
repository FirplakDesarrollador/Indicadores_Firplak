-- Consolidado comercial SAP: query de B (OV pendientes) y C (tránsito), primer entregable.
-- Versión de validación: SOLO LECTURA sobre SAP; arma una tabla temporal #BC en la sesión
-- y devuelve resúmenes y detalle. Cuando se valide, este SELECT se convierte en el SP que
-- llena la tabla de reporte en Planos_Symphony (decisión 4).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. Ejecutar TODO el archivo (F5) en SSMS. Compatible con nivel 100
-- (sin CTE, APPLY ni TRY_CONVERT). Pestañas 1 a 5.
--
-- Reglas (todas verificadas en los scripts 01 a 07):
--   Granularidad   una fila por línea: Etapa + DocEntry + LineNum.
--   Universo       CANCELED = 'N' y LineStatus = 'O'.
--   Saldo          LineTotal * OpenQty / Quantity (COP, sin IVA).
--   Asesor         sin tienda en la línea -> SlpCode del encabezado; con tienda -> SlpCode del cliente-tienda.
--   Centro costos  OcrCode de la línea; si está vacío, OCRD.U_CentrodeCtos del cliente.
--   Fecha despacho B: RDR1.ShipDate (Visor OV). C: ODLN.U_FechaDespacho, si está vacía ODLN.DocDate.
--   Fecha ProyFAC  C: ODLN.U_FechaRadFAC (query Tránsito).
-- Filtros por defecto (columna EnDefault), sin descartar filas:
--   Canal B2C (113), subgrupo 106-01 Firplak Home o 106-02 Ecommerce (MAC fuera),
--   Tipo OV distinto de 4, 6, 7, 9, 12, 15 (vacío cuenta), tipo de ventas distinto de Donaciones,
--   y solo en C: Status entrega distinto de 3, 4, 9 (vacío cuenta) y Fecha ProyFAC en el mes o vacía.

USE Firplak_SA;
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

IF OBJECT_ID('tempdb..#BC') IS NOT NULL DROP TABLE #BC;

SELECT Y.*,
       CASE WHEN Y.GroupCode = 113 AND Y.Subgrupo IN ('106-01', '106-02')
             AND Y.TipoOVExcluido = 'No' AND Y.Donacion = 'No'
             AND Y.StatusExcluido = 'No' AND Y.ProyFACFueraDeMes = 'No'
            THEN 'Si' ELSE 'No' END AS EnDefault
INTO #BC
FROM (
    SELECT X.*,
           CASE X.Subgrupo WHEN '106-01' THEN 'Firplak Home' WHEN '106-02' THEN 'Ecommerce'
                           WHEN '106-04' THEN 'MAC' ELSE 'Otro' END AS SegmentoB2C,
           CASE WHEN X.TipoOV IN ('4', '6', '7', '9', '12', '15') THEN 'Si' ELSE 'No' END AS TipoOVExcluido,
           CASE WHEN X.StatusEntrega IN ('3', '4', '9') THEN 'Si' ELSE 'No' END AS StatusExcluido,
           CASE WHEN X.FechaProyFAC IS NULL THEN 'No'
                WHEN X.FechaProyFAC >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
                 AND X.FechaProyFAC < DATEADD(month, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) THEN 'No'
                ELSE 'Si' END AS ProyFACFueraDeMes,
           CASE WHEN X.TipoVentas = 'Donaciones' THEN 'Si' ELSE 'No' END AS Donacion
    FROM (
        -- B. OV pendientes
        SELECT 'B_OV' AS Etapa, 17 AS ObjType, H.DocEntry, L.LineNum, H.DocNum, H.DocDate,
               H.CardCode, H.CardName, C.GroupCode, G.GroupName AS Canal,
               C.U_SubGroupCode AS Subgrupo, S.Name AS SubgrupoNombre,
               CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END AS SlpCode,
               ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), ''), C.U_CentrodeCtos) AS CentroCostos,
               CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NULL THEN 'Cliente' ELSE 'Linea' END AS OrigenCentroCostos,
               NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), '') AS TipoOV,
               CAST(NULL AS nvarchar(20)) AS StatusEntrega,
               L.ShipDate AS FechaDespacho,
               CAST(NULL AS datetime) AS FechaProyFAC,
               CAST(H.U_TipoVentas AS nvarchar(30)) AS TipoVentas,
               H.Confirmed AS Autorizada,
               ISNULL(CAST(H.U_Bloqueado AS nvarchar(50)), '') AS BloqueoOV,
               CASE WHEN CAST(L.U_Bloqueado AS nvarchar(10)) = 'SI'
                      OR CAST(L.U_BloqueoLogistica AS nvarchar(10)) = '1'
                      OR CAST(L.U_Comentarios AS nvarchar(200)) LIKE '%NO DESPACHAR%'
                    THEN 'Si' ELSE 'No' END AS BloqueoLinea,
               L.ItemCode, L.Dscription, L.Quantity, L.OpenQty, L.LineTotal,
               CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END AS Saldo
        FROM ORDR H
        JOIN RDR1 L ON L.DocEntry = H.DocEntry
        LEFT JOIN OCRD C ON C.CardCode = H.CardCode
        LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
        LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
        LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
        WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'

        UNION ALL

        -- C. Tránsito (entregado sin facturar)
        SELECT 'C_TRANSITO', 15, H.DocEntry, L.LineNum, H.DocNum, H.DocDate,
               H.CardCode, H.CardName, C.GroupCode, G.GroupName,
               C.U_SubGroupCode, S.Name,
               CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END,
               ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), ''), C.U_CentrodeCtos),
               CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), '') IS NULL THEN 'Cliente' ELSE 'Linea' END,
               NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), ''),
               NULLIF(LTRIM(RTRIM(CAST(H.U_StatusEntrega AS nvarchar(20)))), ''),
               ISNULL(H.U_FechaDespacho, H.DocDate),
               H.U_FechaRadFAC,
               CAST(H.U_TipoVentas AS nvarchar(30)),
               H.Confirmed,
               '',
               'No',
               L.ItemCode, L.Dscription, L.Quantity, L.OpenQty, L.LineTotal,
               CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END
        FROM ODLN H
        JOIN DLN1 L ON L.DocEntry = H.DocEntry
        LEFT JOIN OCRD C ON C.CardCode = H.CardCode
        LEFT JOIN OCRG G ON G.GroupCode = C.GroupCode
        LEFT JOIN [@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
        LEFT JOIN OCRD T ON T.CardCode = L.U_Tiendas
        WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
    ) X
) Y;

GO

-- 1. Embudo: cuánto quita cada filtro por defecto, por etapa.
SELECT '1_Embudo' AS Consulta, Etapa,
       COUNT(*) AS Lineas,
       SUM(Saldo) AS TodosCanales,
       SUM(CASE WHEN GroupCode = 113 THEN Saldo ELSE 0 END) AS B2C,
       SUM(CASE WHEN GroupCode = 113 AND Subgrupo IN ('106-01', '106-02') THEN Saldo ELSE 0 END) AS B2CSinMAC,
       SUM(CASE WHEN GroupCode = 113 AND Subgrupo IN ('106-01', '106-02') AND TipoOVExcluido = 'No' THEN Saldo ELSE 0 END) AS MasTipoOV,
       SUM(CASE WHEN EnDefault = 'Si' THEN Saldo ELSE 0 END) AS Default_,
       SUM(CASE WHEN EnDefault = 'Si' THEN 1 ELSE 0 END) AS LineasDefault,
       SUM(CASE WHEN EnDefault = 'Si' AND Etapa = 'C_TRANSITO' AND StatusEntrega IS NULL THEN Saldo ELSE 0 END) AS DefaultSinStatus,
       SUM(CASE WHEN EnDefault = 'Si' AND TipoOV IS NULL THEN Saldo ELSE 0 END) AS DefaultSinTipo,
       SUM(CASE WHEN EnDefault = 'Si' AND TipoOV IN ('2', '10', '11') THEN Saldo ELSE 0 END) AS DefaultLlenados,
       SUM(CASE WHEN EnDefault = 'Si' AND (BloqueoOV NOT IN ('', 'No Bloqueado') OR BloqueoLinea = 'Si') THEN Saldo ELSE 0 END) AS DefaultBloqueado
FROM #BC
GROUP BY Etapa
ORDER BY Etapa;

GO

-- 2. Default por segmento y asesor.
SELECT '2_DefaultAsesor' AS Consulta, B.Etapa, B.SegmentoB2C, B.SlpCode, P.SlpName AS Asesor,
       COUNT(*) AS Lineas, SUM(B.Saldo) AS Saldo
FROM #BC B
LEFT JOIN OSLP P ON P.SlpCode = B.SlpCode
WHERE B.EnDefault = 'Si'
GROUP BY B.Etapa, B.SegmentoB2C, B.SlpCode, P.SlpName
ORDER BY B.Etapa, B.SegmentoB2C, Saldo DESC;

GO

-- 3. Default por centro de costos.
SELECT '3_DefaultCentroCostos' AS Consulta, B.Etapa, B.CentroCostos, R.OcrName, B.OrigenCentroCostos,
       COUNT(*) AS Lineas, SUM(B.Saldo) AS Saldo
FROM #BC B
LEFT JOIN OOCR R ON R.OcrCode = B.CentroCostos
WHERE B.EnDefault = 'Si'
GROUP BY B.Etapa, B.CentroCostos, R.OcrName, B.OrigenCentroCostos
ORDER BY B.Etapa, Saldo DESC;

GO

-- 4. Controles de calidad (todas las filas, todos los canales). Lo esperado se indica en cada columna.
SELECT '4_Controles' AS Consulta, Etapa,
       COUNT(*) AS Lineas,
       COUNT(*) - COUNT(DISTINCT CAST(DocEntry AS varchar(12)) + '-' + CAST(LineNum AS varchar(12))) AS Duplicados_0,
       SUM(CASE WHEN Quantity = 0 THEN 1 ELSE 0 END) AS CantidadCero,
       SUM(CASE WHEN Saldo < 0 THEN 1 ELSE 0 END) AS SaldoNegativo_0,
       SUM(CASE WHEN SlpCode IS NULL THEN 1 ELSE 0 END) AS SinAsesor_0,
       SUM(CASE WHEN NULLIF(LTRIM(RTRIM(CentroCostos)), '') IS NULL THEN 1 ELSE 0 END) AS SinCentroCostos_0,
       SUM(CASE WHEN GroupCode IS NULL THEN 1 ELSE 0 END) AS SinCanal,
       SUM(CASE WHEN SubgrupoNombre IS NULL THEN 1 ELSE 0 END) AS SinSubgrupo,
       SUM(CASE WHEN TipoVentas IS NULL THEN 1 ELSE 0 END) AS SinTipoVentas
FROM #BC
GROUP BY Etapa
ORDER BY Etapa;

GO

-- 5. Detalle del default, para exportar a Excel y comparar contra el Visor OV y el Tránsito.
SELECT '5_DetalleDefault' AS Consulta, B.Etapa, B.DocNum, B.LineNum, B.DocDate, B.CardCode, B.CardName,
       B.SegmentoB2C, P.SlpName AS Asesor, B.CentroCostos, B.OrigenCentroCostos, B.TipoOV, B.StatusEntrega,
       B.FechaDespacho, B.FechaProyFAC, B.TipoVentas, B.BloqueoOV, B.BloqueoLinea,
       B.ItemCode, B.Dscription, B.Quantity, B.OpenQty, B.LineTotal, B.Saldo
FROM #BC B
LEFT JOIN OSLP P ON P.SlpCode = B.SlpCode
WHERE B.EnDefault = 'Si'
ORDER BY B.Etapa, B.DocNum, B.LineNum;

GO

DROP TABLE #BC;
