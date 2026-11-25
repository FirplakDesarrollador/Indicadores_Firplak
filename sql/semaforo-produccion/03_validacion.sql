/*
  Semáforo de producción: validación.
  Ficha: llm-wiki/proyectos/semaforo-produccion.md (sección "Validación").

  Parte A: consultas previas, de solo lectura. Ejecutarlas antes de crear la tabla y pegar los
           resultados en la ficha. Confirman supuestos del original que hoy están `pendiente`.
  Parte B: comparación de dbo.SEMAFORO (original) con dbo.Informe_semaforo_produccion. Ejecutarla en
           una sola ventana de SSMS, después de crear la tabla y el SP. Ejecuta el SP nuevo (escribe en
           la tabla de reporte y en dbo.Cargas_Log); no modifica dbo.SEMAFORO ni SAP.
*/

USE [Planos_Symphony];
GO

/* ═════════════ Parte A. Consultas previas (solo lectura) ═════════════ */

-- A1. Claves repetidas en las tablas de configuración (si hay filas, el SP nuevo falla con aviso y
--     el original devolvía la OP dos veces).
SELECT N'@FIR_FAM_SYMPH' AS Tabla, U_FIR_FAM_MAES AS Clave1, CAST(U_FIR_TIPO_PED AS nvarchar(30)) AS Clave2, COUNT(1) AS Filas
FROM Firplak_SA.dbo.[@FIR_FAM_SYMPH] WITH (NOLOCK)
GROUP BY U_FIR_FAM_MAES, U_FIR_TIPO_PED HAVING COUNT(1) > 1
UNION ALL
SELECT N'@FIR_AMORTIGUADORES', Name, NULL, COUNT(1)
FROM Firplak_SA.dbo.[@FIR_AMORTIGUADORES] WITH (NOLOCK)
GROUP BY Name HAVING COUNT(1) > 1;

-- A2. Alcance base (sin las uniones de configuración) y cuántas OP quedan fuera por cada INNER JOIN.
--     Esperado: decidir con Manufactura si las OP sin molde (SinMolde) deben aparecer en el semáforo.
SELECT
    T1.U_Linea,
    COUNT(1)                                                          AS OpAlcance,
    SUM(CASE WHEN T2.DocEntry IS NULL THEN 1 ELSE 0 END)              AS SinPedido,
    SUM(CASE WHEN T5.U_FIR_FAM IS NULL THEN 1 ELSE 0 END)             AS SinFamiliaSymphony,
    SUM(CASE WHEN T5.U_FIR_FAM IS NOT NULL AND T6.Name IS NULL THEN 1 ELSE 0 END) AS SinAmortiguador,
    SUM(CASE WHEN T7.ItemCode IS NULL THEN 1 ELSE 0 END)              AS SinMolde,
    SUM(CASE WHEN T4.DocEntry IS NULL THEN 1 ELSE 0 END)              AS SinComponentes
FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
    INNER JOIN Firplak_SA.dbo.OITM T1 WITH (NOLOCK) ON T0.ItemCode = T1.ItemCode
    -- SQL Server no admite subconsultas dentro de SUM (error 130): los componentes van como unión
    LEFT JOIN (SELECT DISTINCT w.DocEntry FROM Firplak_SA.dbo.WOR1 w WITH (NOLOCK)) T4 ON T4.DocEntry = T0.DocEntry
    LEFT JOIN Firplak_SA.dbo.ORDR T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
    LEFT JOIN Firplak_SA.dbo.[@FIR_FAM_SYMPH] T5 WITH (NOLOCK)
        ON T1.U_Familia COLLATE SQL_Latin1_General_CP1_CI_AS = T5.U_FIR_FAM_MAES COLLATE SQL_Latin1_General_CP1_CI_AS
        AND T5.U_FIR_TIPO_PED = T2.U_TipoPedidos
    LEFT JOIN Firplak_SA.dbo.[@FIR_AMORTIGUADORES] T6 WITH (NOLOCK)
        ON T5.U_FIR_FAM COLLATE SQL_Latin1_General_CP1_CI_AS = T6.Name COLLATE SQL_Latin1_General_CP1_CI_AS
    LEFT JOIN Firplak_SA.dbo.OITM T7 WITH (NOLOCK) ON T1.U_Molde = T7.ItemCode
WHERE (T0.Status IN ('R', 'P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
GROUP BY T1.U_Linea WITH ROLLUP
ORDER BY T1.U_Linea;

-- A3. ¿El pedido se une bien por DocNum? Si DistintoOriginAbs > 0, OriginNum apunta a otro pedido
--     con el mismo número (series distintas) y conviene unir por OWOR.OriginAbs = ORDR.DocEntry.
SELECT COUNT(1) AS Op,
       SUM(CASE WHEN T0.OriginAbs IS NOT NULL AND T0.OriginAbs <> T2.DocEntry THEN 1 ELSE 0 END) AS DistintoOriginAbs
FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
    INNER JOIN Firplak_SA.dbo.ORDR T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
WHERE (T0.Status IN ('R', 'P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08');

-- A4. Formato del lote (<pedido>-<línea>-<consecutivo>). Las OP con 'Sin dos guiones' o 'Línea no
--     numérica' hacían fallar el UPDATE de FPromEntitem del original; en el nuevo quedan sin fecha del ítem.
SELECT Formato, COUNT(1) AS Op
FROM (
    SELECT CASE
        WHEN NULLIF(LTRIM(RTRIM(T0.U_NumLote)), N'') IS NULL THEN N'Vacío'
        WHEN CHARINDEX(N'-', T0.U_NumLote) = 0 THEN N'Sin guiones'
        WHEN CHARINDEX(N'-', T0.U_NumLote, CHARINDEX(N'-', T0.U_NumLote) + 1) = 0 THEN N'Sin dos guiones'
        WHEN SUBSTRING(T0.U_NumLote, CHARINDEX(N'-', T0.U_NumLote) + 1,
                       CHARINDEX(N'-', T0.U_NumLote, CHARINDEX(N'-', T0.U_NumLote) + 1) - CHARINDEX(N'-', T0.U_NumLote) - 1)
             LIKE N'%[^0-9]%'
             OR CHARINDEX(N'-', T0.U_NumLote, CHARINDEX(N'-', T0.U_NumLote) + 1) = CHARINDEX(N'-', T0.U_NumLote) + 1
            THEN N'Línea no numérica'
        ELSE N'Correcto'
    END AS Formato
    FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
    WHERE (T0.Status IN ('R', 'P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
        AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
) f
GROUP BY Formato ORDER BY Formato;

-- A5. Tipos de pedido y días de distribución. Revisar que cada U_TipoPedidos tenga su Code y que
--     U_Dias_Distr no tenga ceros ni valores mayores a 10 (el original solo buscaba 15 días calendario).
SELECT CAST(T2.U_TipoPedidos AS nvarchar(30)) AS TipoPedido, TP.Code, TP.U_Dias_Distr, COUNT(1) AS Op
FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
    INNER JOIN Firplak_SA.dbo.ORDR T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
    LEFT JOIN Firplak_SA.dbo.[@FIR_TIPOPEDIDOS] TP WITH (NOLOCK)
        ON TP.Code COLLATE SQL_Latin1_General_CP1_CI_AS = CAST(T2.U_TipoPedidos AS nvarchar(30)) COLLATE SQL_Latin1_General_CP1_CI_AS
WHERE (T0.Status IN ('R', 'P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
GROUP BY CAST(T2.U_TipoPedidos AS nvarchar(30)), TP.Code, TP.U_Dias_Distr
ORDER BY TipoPedido;

-- A6. Tipos de orden del alcance (solo STANDARD y STOCK tienen fecha recomendada de liberación).
SELECT T0.U_Tipo_Orden, T0.Status, COUNT(1) AS Op
FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
WHERE (T0.Status IN ('R', 'P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
GROUP BY T0.U_Tipo_Orden, T0.Status ORDER BY T0.U_Tipo_Orden, T0.Status;

-- A7. Cobertura del calendario: fecha mínima de creación de las OP abiertas (debe ser >= 2013-01-01).
SELECT MIN(CAST(T0.CreateDate AS date)) AS CreacionMinima, MAX(CAST(T0.DueDate AS date)) AS EntregaMaxima,
       (SELECT MIN(Fecha) FROM dbo.Calendario_Laboral) AS CalendarioDesde,
       (SELECT MAX(Fecha) FROM dbo.Calendario_Laboral) AS CalendarioHasta
FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
WHERE T0.Status IN ('R', 'P') AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08');
GO

/* ═════════════ Parte B. Comparación con dbo.SEMAFORO ═════════════
   Ejecutar todo el bloque seguido: los valores que dependen de hoy deben calcularse el mismo día. */

IF OBJECT_ID('tempdb..#orig') IS NOT NULL DROP TABLE #orig;
-- COLLATE DATABASE_DEFAULT: tempdb usa SQL_Latin1_General_CP850_CI_AS y Planos_Symphony
-- SQL_Latin1_General_CP1_CI_AS; sin esto, comparar textos con la tabla da el error 451/468.
CREATE TABLE #orig (
    Originnum nvarchar(50) COLLATE DATABASE_DEFAULT, NroOP nvarchar(50) COLLATE DATABASE_DEFAULT,
    SKU nvarchar(100) COLLATE DATABASE_DEFAULT, DescSKU nvarchar(200) COLLATE DATABASE_DEFAULT,
    Planta nvarchar(100) COLLATE DATABASE_DEFAULT, Familia nvarchar(50) COLLATE DATABASE_DEFAULT,
    TipoOrden nvarchar(50) COLLATE DATABASE_DEFAULT, CantPen numeric(18,3), CantPenItem numeric(18,3),
    CantTot numeric(18,3), DPT01 numeric(18,3), FCont date, Estado nvarchar(50) COLLATE DATABASE_DEFAULT,
    FRecoLib date, FRealLib date, ConsumoLib numeric(18,3), ColorLibText nvarchar(20) COLLATE DATABASE_DEFAULT,
    ColorLib numeric(10,2), Cumplimiento nvarchar(50) COLLATE DATABASE_DEFAULT,
    FEntLote date, FRecomEnt date, FCierreOP date, FIdeal date, ConsumoAmort numeric(18,3),
    ColorProdText nvarchar(20) COLLATE DATABASE_DEFAULT, ColorProd numeric(10,2),
    CumplimientoPlanta nvarchar(50) COLLATE DATABASE_DEFAULT, DRetrazo numeric(18,3),
    ColorFirplakText nvarchar(20) COLLATE DATABASE_DEFAULT, ColorFirplak numeric(18,2),
    CumplimientoFirplak nvarchar(50) COLLATE DATABASE_DEFAULT,
    FPromItem date, Destino nvarchar(50) COLLATE DATABASE_DEFAULT, NumLote nvarchar(50) COLLATE DATABASE_DEFAULT,
    Molde nvarchar(100) COLLATE DATABASE_DEFAULT, CapacidadMolde nvarchar(100) COLLATE DATABASE_DEFAULT,
    FCargaMolde date, Amort numeric(3,0), Cliente nvarchar(200) COLLATE DATABASE_DEFAULT
);

-- B0. Ejecutar ambos y medir el tiempo
DECLARE @t0 datetime2(3) = sysdatetime();
INSERT INTO #orig EXEC dbo.SEMAFORO;
DECLARE @t1 datetime2(3) = sysdatetime();
EXEC dbo.sp_Actualizar_Informe_semaforo_produccion;
DECLARE @t2 datetime2(3) = sysdatetime();
SELECT DATEDIFF(MILLISECOND, @t0, @t1) AS MsOriginal, DATEDIFF(MILLISECOND, @t1, @t2) AS MsNuevo;

-- B1. Filas y OP repetidas. Esperado: OpRepetidasOriginal = 0 (si no, ver A1 y A3).
SELECT (SELECT COUNT(1) FROM #orig) AS FilasOriginal,
       (SELECT COUNT(DISTINCT NroOP) FROM #orig) AS OpOriginal,
       (SELECT COUNT(1) FROM (SELECT NroOP FROM #orig GROUP BY NroOP HAVING COUNT(1) > 1) d) AS OpRepetidasOriginal,
       (SELECT COUNT(1) FROM dbo.Informe_semaforo_produccion) AS FilasNuevo;

-- B2. OP que están solo en uno de los dos. Esperado: 0 y 0 (mismo alcance).
SELECT N'Solo en original' AS Lado, o.NroOP AS DocNum, o.Estado, o.Familia
FROM #orig o
WHERE NOT EXISTS (SELECT 1 FROM dbo.Informe_semaforo_produccion t WHERE t.DocNum = CONVERT(int, o.NroOP))
UNION ALL
SELECT N'Solo en nuevo', CAST(t.DocNum AS nvarchar(50)), t.Estado, t.Familia
FROM dbo.Informe_semaforo_produccion t
WHERE NOT EXISTS (SELECT 1 FROM #orig o WHERE CONVERT(int, o.NroOP) = t.DocNum);

-- B3. Diferencias por columna. Las cantidades, el molde, la capacidad y el amortiguador deben dar 0;
--     las fechas y los colores difieren solo por las correcciones L1 a L12 de la ficha (ver B4).
SELECT
    COUNT(1) AS OpEnAmbos,
    SUM(CASE WHEN o.FRecoLib = t.FechaLiberacionRecomendada OR (o.FRecoLib IS NULL AND t.FechaLiberacionRecomendada IS NULL) THEN 0 ELSE 1 END) AS DifFechaRecoLib,
    SUM(CASE WHEN o.FIdeal = t.FechaIdealProduccion OR (o.FIdeal IS NULL AND t.FechaIdealProduccion IS NULL) THEN 0 ELSE 1 END) AS DifFechaIdeal,
    SUM(CASE WHEN o.FRecomEnt = t.FechaRecomendadaEntrega OR (o.FRecomEnt IS NULL AND t.FechaRecomendadaEntrega IS NULL) THEN 0 ELSE 1 END) AS DifFechaRecomEnt,
    SUM(CASE WHEN o.FPromItem = t.FechaPrometidaItem OR (o.FPromItem IS NULL AND t.FechaPrometidaItem IS NULL) THEN 0 ELSE 1 END) AS DifFechaPromItem,
    SUM(CASE WHEN o.FCargaMolde = t.FechaCargaMolde OR (o.FCargaMolde IS NULL AND t.FechaCargaMolde IS NULL) THEN 0 ELSE 1 END) AS DifFechaCargaMolde,
    SUM(CASE WHEN o.ConsumoLib = t.ConsumoLiberacion OR (o.ConsumoLib IS NULL AND t.ConsumoLiberacion IS NULL) THEN 0 ELSE 1 END) AS DifConsumoLib,
    SUM(CASE WHEN o.ColorLibText = t.ColorLiberacion THEN 0 ELSE 1 END) AS DifColorLib,
    SUM(CASE WHEN o.Cumplimiento = t.CumplimientoLiberacion THEN 0 ELSE 1 END) AS DifCumplLib,
    SUM(CASE WHEN o.ConsumoAmort = t.ConsumoAmortiguador OR (o.ConsumoAmort IS NULL AND t.ConsumoAmortiguador IS NULL) THEN 0 ELSE 1 END) AS DifConsumoAmort,
    SUM(CASE WHEN o.ColorProdText = t.ColorProduccion THEN 0 ELSE 1 END) AS DifColorProd,
    SUM(CASE WHEN o.CumplimientoPlanta = t.CumplimientoPlanta OR (o.CumplimientoPlanta IS NULL AND t.CumplimientoPlanta IS NULL) THEN 0 ELSE 1 END) AS DifCumplPlanta,
    SUM(CASE WHEN o.DRetrazo = t.DiasRetrasoFirplak OR (o.DRetrazo IS NULL AND t.DiasRetrasoFirplak IS NULL) THEN 0 ELSE 1 END) AS DifRetrasoFirplak,
    SUM(CASE WHEN o.ColorFirplakText = t.ColorFirplak THEN 0 ELSE 1 END) AS DifColorFirplak,
    SUM(CASE WHEN o.CumplimientoFirplak = t.CumplimientoFirplak OR (o.CumplimientoFirplak IS NULL AND t.CumplimientoFirplak IS NULL) THEN 0 ELSE 1 END) AS DifCumplFirplak,
    SUM(CASE WHEN o.CantPenItem = t.CantidadPendienteLote OR (o.CantPenItem IS NULL AND t.CantidadPendienteLote IS NULL) THEN 0 ELSE 1 END) AS DifCantPendLote,
    SUM(CASE WHEN o.CantPen = t.CantidadPendiente AND o.CantTot = t.CantidadTotal THEN 0 ELSE 1 END) AS DifCantidades,
    SUM(CASE WHEN o.DPT01 = t.DisponiblePT01 OR (o.DPT01 IS NULL AND t.DisponiblePT01 IS NULL) THEN 0 ELSE 1 END) AS DifDisponiblePT01,
    SUM(CASE WHEN CONVERT(decimal(19, 2), o.CapacidadMolde) = t.CapacidadMolde OR (o.CapacidadMolde IS NULL AND t.CapacidadMolde IS NULL) THEN 0 ELSE 1 END) AS DifCapacidadMolde,
    SUM(CASE WHEN o.Amort = t.Amortiguador THEN 0 ELSE 1 END) AS DifAmortiguador
FROM #orig o
INNER JOIN dbo.Informe_semaforo_produccion t ON t.DocNum = CONVERT(int, o.NroOP);

-- B4. Detalle de las OP con diferencias en fechas o colores, con la causa probable.
--     Revisar que toda fila tenga una causa; las que digan 'Revisar' son diferencias no explicadas.
-- (Va en una tabla derivada: SQL Server no admite un alias de columna dentro de una expresión del
--  ORDER BY, error 207.)
SELECT TOP (500) b.*
FROM (
SELECT
    t.DocNum, t.TipoOrden, t.Estado, t.Familia, t.Amortiguador, t.DiasDistribucion,
    t.FechaCreacion, t.FechaLiberacion, t.FechaEntregaLote, t.FechaCierre,
    o.FRecoLib, t.FechaLiberacionRecomendada,
    o.FIdeal, t.FechaIdealProduccion,
    o.FPromItem, t.FechaPrometidaItem,
    o.ColorLibText, t.ColorLiberacion,
    o.ColorProdText, t.ColorProduccion,
    o.ColorFirplakText, t.ColorFirplak,
    o.CumplimientoFirplak, t.CumplimientoFirplak AS CumplimientoFirplakNuevo,
    CASE
        WHEN o.FIdeal <> t.FechaIdealProduccion AND cL.EsLaborable = 0 THEN N'L1 liberación en día no laborable'
        WHEN t.TipoOrden = N'STANDARD' AND t.Amortiguador = 1 AND ISNULL(o.FRecoLib, '19000101') <> ISNULL(t.FechaLiberacionRecomendada, '19000101') THEN N'L2 amortiguador 1'
        WHEN t.TipoOrden = N'STANDARD' AND o.FRecoLib IS NULL AND t.FechaLiberacionRecomendada IS NOT NULL THEN N'L3 amortiguador largo'
        WHEN o.FRecoLib = '19000101' THEN N'L4 fecha centinela 1900'
        WHEN t.TipoOrden = N'STOCK' AND cC.EsLaborable = 0 THEN N'L5 creación en día no laborable'
        WHEN t.DiasDistribucion = 0 AND ISNULL(o.FPromItem, '19000101') <> ISNULL(t.FechaPrometidaItem, '19000101') THEN N'L6 cero días de distribución'
        WHEN t.FechaCierre < t.FechaEntregaLote AND o.DRetrazo <> t.DiasRetrasoFirplak THEN N'L7 cierre antes de la entrega'
        WHEN t.FechaCierre IS NULL AND t.FechaEntregaLote = CAST(GETDATE() AS date) THEN N'L8 entrega hoy'
        WHEN t.FechaLiberacion IS NULL AND o.ColorProdText = N'GREEN' THEN N'L9 sin liberar'
        WHEN o.ColorLibText = N'CYAN' AND t.ColorLiberacion = N'SIN DATO' OR o.ColorFirplakText = N'CYAN' AND t.ColorFirplak = N'SIN DATO' THEN N'L10 sin dato'
        WHEN t.FechaCreacion < '20250101' THEN N'Calendario: antes de 2025 @FIR_FECHAS_PROD no tiene fechas'
        WHEN cE.EsLaborable = 0 OR cF.EsLaborable = 0 THEN N'Entrega o liberación en día no laborable (frontera del conteo)'
        ELSE N'Revisar'
    END AS CausaProbable
FROM #orig o
INNER JOIN dbo.Informe_semaforo_produccion t ON t.DocNum = CONVERT(int, o.NroOP)
LEFT JOIN dbo.Calendario_Laboral cL ON cL.Fecha = t.FechaLiberacion
LEFT JOIN dbo.Calendario_Laboral cC ON cC.Fecha = t.FechaCreacion
LEFT JOIN dbo.Calendario_Laboral cE ON cE.Fecha = t.FechaEntregaLote
LEFT JOIN dbo.Calendario_Laboral cF ON cF.Fecha = o.FRealLib
WHERE ISNULL(o.FRecoLib, '19000101') <> ISNULL(t.FechaLiberacionRecomendada, '19000101')
   OR ISNULL(o.FIdeal, '19000101') <> ISNULL(t.FechaIdealProduccion, '19000101')
   OR ISNULL(o.FPromItem, '19000101') <> ISNULL(t.FechaPrometidaItem, '19000101')
   OR o.ColorLibText <> t.ColorLiberacion
   OR o.ColorProdText <> t.ColorProduccion
   OR o.ColorFirplakText <> t.ColorFirplak
   OR ISNULL(o.CumplimientoFirplak, N'') <> ISNULL(t.CumplimientoFirplak, N'')
) b
ORDER BY CASE WHEN b.CausaProbable = N'Revisar' THEN 0 ELSE 1 END, b.CausaProbable, b.DocNum;


-- B5. Todas las diferencias por columna y causa, sin tope (para pegar en la ficha).
--     Esperado: ninguna fila con Causa = 'Revisar'. Si aparece, B6 lista esas OP.
IF OBJECT_ID('tempdb..#j') IS NOT NULL DROP TABLE #j;
SELECT
    t.DocNum, t.TipoOrden, t.Amortiguador, t.DiasDistribucion,
    t.FechaLiberacion, t.FechaEntregaLote, t.FechaCierre,
    t.CumplimientoLiberacion, t.CumplimientoPlanta, t.CumplimientoFirplak,
    t.ColorLiberacion, t.ColorProduccion, t.ColorFirplak,
    o.FRecoLib, o.ColorLibText, o.ColorProdText, o.ColorFirplakText,
    -- 1 = la columna es distinta entre el original y el nuevo
    CASE WHEN ISNULL(o.FRecoLib, '19000101') <> ISNULL(t.FechaLiberacionRecomendada, '19000101') THEN 1 ELSE 0 END AS dReco,
    CASE WHEN ISNULL(o.FIdeal, '19000101') <> ISNULL(t.FechaIdealProduccion, '19000101') THEN 1 ELSE 0 END AS dIdeal,
    CASE WHEN ISNULL(o.FPromItem, '19000101') <> ISNULL(t.FechaPrometidaItem, '19000101') THEN 1 ELSE 0 END AS dProm,
    CASE WHEN ISNULL(o.ConsumoLib, -99999) <> ISNULL(t.ConsumoLiberacion, -99999) THEN 1 ELSE 0 END AS dConsLib,
    CASE WHEN o.ColorLibText <> t.ColorLiberacion THEN 1 ELSE 0 END AS dColLib,
    CASE WHEN o.Cumplimiento <> t.CumplimientoLiberacion THEN 1 ELSE 0 END AS dCumLib,
    CASE WHEN ISNULL(o.ConsumoAmort, -99999) <> ISNULL(t.ConsumoAmortiguador, -99999) THEN 1 ELSE 0 END AS dConsAmo,
    CASE WHEN o.ColorProdText <> t.ColorProduccion THEN 1 ELSE 0 END AS dColProd,
    CASE WHEN ISNULL(o.CumplimientoPlanta, N'') <> ISNULL(t.CumplimientoPlanta, N'') THEN 1 ELSE 0 END AS dCumPla,
    CASE WHEN ISNULL(o.DRetrazo, -99999) <> ISNULL(t.DiasRetrasoFirplak, -99999) THEN 1 ELSE 0 END AS dRet,
    CASE WHEN o.ColorFirplakText <> t.ColorFirplak THEN 1 ELSE 0 END AS dColFir,
    CASE WHEN ISNULL(o.CumplimientoFirplak, N'') <> ISNULL(t.CumplimientoFirplak, N'') THEN 1 ELSE 0 END AS dCumFir,
    -- Condiciones que explican las diferencias
    CASE WHEN cL.EsLaborable = 0 THEN 1 ELSE 0 END AS LibNoLaboral,
    CASE WHEN cC.EsLaborable = 0 THEN 1 ELSE 0 END AS CreaNoLaboral,
    CASE WHEN cE.EsLaborable = 0 THEN 1 ELSE 0 END AS EntNoLaboral
INTO #j
FROM #orig o
INNER JOIN dbo.Informe_semaforo_produccion t ON t.DocNum = CONVERT(int, o.NroOP)
LEFT JOIN dbo.Calendario_Laboral cL ON cL.Fecha = t.FechaLiberacion
LEFT JOIN dbo.Calendario_Laboral cC ON cC.Fecha = t.FechaCreacion
LEFT JOIN dbo.Calendario_Laboral cE ON cE.Fecha = t.FechaEntregaLote;

IF OBJECT_ID('tempdb..#dif') IS NOT NULL DROP TABLE #dif;
SELECT x.DocNum, x.Columna, x.Causa
INTO #dif
FROM (
    SELECT DocNum, N'01 FechaRecoLib' AS Columna,
           CASE WHEN TipoOrden = N'STANDARD' AND Amortiguador = 1 THEN N'L2 amortiguador 1'
                WHEN TipoOrden = N'STANDARD' AND FRecoLib IS NULL THEN N'L3 amortiguador largo'
                WHEN FRecoLib = '19000101' THEN N'L4 fecha centinela 1900'
                WHEN TipoOrden = N'STOCK' AND CreaNoLaboral = 1 THEN N'L5 creación en día no laborable'
                ELSE N'Revisar' END AS Causa
    FROM #j WHERE dReco = 1
    UNION ALL
    SELECT DocNum, N'02 FechaIdeal',
           CASE WHEN LibNoLaboral = 1 THEN N'L1 liberación en día no laborable' ELSE N'Revisar' END
    FROM #j WHERE dIdeal = 1
    UNION ALL
    SELECT DocNum, N'03 FechaPromItem',
           CASE WHEN DiasDistribucion = 0 THEN N'L6 cero días de distribución' ELSE N'Revisar' END
    FROM #j WHERE dProm = 1
    UNION ALL
    SELECT DocNum, N'04 ConsumoLib',
           CASE WHEN dReco = 1 THEN N'Por la fecha recomendada (L2 a L5)'
                WHEN LibNoLaboral = 1 THEN N'Liberación en día no laborable (frontera del conteo)'
                ELSE N'Revisar' END
    FROM #j WHERE dConsLib = 1
    UNION ALL
    SELECT DocNum, N'05 ColorLib',
           CASE WHEN ColorLibText = N'CYAN' AND ColorLiberacion = N'SIN DATO' THEN N'L10 sin dato'
                WHEN dReco = 1 OR dConsLib = 1 THEN N'Por el consumo de liberación'
                ELSE N'Revisar' END
    FROM #j WHERE dColLib = 1
    UNION ALL
    SELECT DocNum, N'06 CumplLib',
           CASE WHEN CumplimientoLiberacion = N'Sin fecha recomendada' THEN N'L11 liberada sin fecha recomendada'
                WHEN FRecoLib = '19000101' THEN N'L4 fecha centinela 1900'
                WHEN dReco = 1 THEN N'Por la fecha recomendada (L2 a L5)'
                ELSE N'Revisar' END
    FROM #j WHERE dCumLib = 1
    UNION ALL
    SELECT DocNum, N'07 ConsumoAmort',
           CASE WHEN FechaLiberacion IS NULL THEN N'L9 sin liberar (0 -> NULL)'
                WHEN LibNoLaboral = 1 THEN N'L1 liberación en día no laborable'
                ELSE N'Revisar' END
    FROM #j WHERE dConsAmo = 1
    UNION ALL
    SELECT DocNum, N'08 ColorProd',
           CASE WHEN FechaLiberacion IS NULL THEN N'L9 sin liberar'
                WHEN dConsAmo = 1 THEN N'Por el consumo del amortiguador'
                ELSE N'Revisar' END
    FROM #j WHERE dColProd = 1
    UNION ALL
    SELECT DocNum, N'09 CumplPlanta',
           CASE WHEN CumplimientoPlanta = N'Sin fecha ideal' THEN N'L11 sin fecha ideal'
                WHEN dIdeal = 1 THEN N'L1 por la fecha ideal'
                ELSE N'Revisar' END
    FROM #j WHERE dCumPla = 1
    UNION ALL
    SELECT DocNum, N'10 RetrasoFirplak',
           CASE WHEN FechaCierre < FechaEntregaLote THEN N'L7 cierre antes de la entrega'
                WHEN EntNoLaboral = 1 THEN N'Entrega en día no laborable (frontera del conteo)'
                WHEN FechaEntregaLote IS NULL THEN N'Sin fecha de entrega'
                ELSE N'Revisar' END
    FROM #j WHERE dRet = 1
    UNION ALL
    SELECT DocNum, N'11 ColorFirplak',
           CASE WHEN ColorFirplakText = N'CYAN' AND ColorFirplak = N'SIN DATO' THEN N'L10 sin dato'
                WHEN dRet = 1 THEN N'Por los días de retraso'
                ELSE N'Revisar' END
    FROM #j WHERE dColFir = 1
    UNION ALL
    SELECT DocNum, N'12 CumplFirplak',
           CASE WHEN FechaCierre IS NULL AND FechaEntregaLote = CAST(GETDATE() AS date) THEN N'L8 entrega hoy'
                ELSE N'Revisar' END
    FROM #j WHERE dCumFir = 1
) x;

SELECT Columna, Causa, COUNT(1) AS Op
FROM #dif
GROUP BY Columna, Causa
ORDER BY Columna, Causa;

-- B6. OP con diferencias no explicadas (Causa = 'Revisar'), con los valores de los dos lados.
SELECT d.Columna, j.*
FROM #dif d
INNER JOIN #j j ON j.DocNum = d.DocNum
WHERE d.Causa = N'Revisar'
ORDER BY d.Columna, d.DocNum;
