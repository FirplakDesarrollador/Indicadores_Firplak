USE [Planos_Symphony]
GO
/****** Object:  StoredProcedure [dbo].[SEMAFORO]    Script Date: 23/11/2026 3:36:10 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[SEMAFORO]
AS
BEGIN
    SET NOCOUNT ON;

    -- Crear tabla temporal con índices
    CREATE TABLE #TT_INTERFASE (
        Codigo NVARCHAR(50),
        SKU NVARCHAR(100),
        DescSKU NVARCHAR(200),
        LinItem NVARCHAR(100),
        Familia NVARCHAR(50),
        Tipo NVARCHAR(50),
        CantPen NUMERIC(18,3),
        CantPenItem NUMERIC(18,3),
        CantTot NUMERIC(18,3),
        DPT01 NUMERIC(18,3),
        FCont DATE,
        Estado NVARCHAR(50),
        FRecoLib DATE,
        FRealLib DATE,
        FRecomEnt DATE,
        Amort NUMERIC(3,0),
        FPromEntitem DATE,
        Originnum NVARCHAR(50),
        FEntLote DATE,
        ConsumoLib NUMERIC(18,3),
        ColorLib NUMERIC(10,2),
        ColorLibText NVARCHAR(20),
        Cumplimiento NVARCHAR(50),
        FIdealProduccion DATE,
        FCierreOP DATE,
        ConsumoAmort NUMERIC(18,3),
        ColorConsumoAmort NUMERIC(10,2),
        ColorConsumoAmortText NVARCHAR(20),
        DRetrazoEnt NUMERIC(18,3),
        FCargaMolde DATE,
        NumLote NVARCHAR(50),
        Destino NVARCHAR(50),
        ColorPrograma NUMERIC(18,2),
        ColorProgramaText NVARCHAR(20),
        Molde NVARCHAR(100),
        CapacidadMolde NVARCHAR(100),
        Lote NVARCHAR(50),
        CodMolde NVARCHAR(100),
        CumplimientoPrograma NVARCHAR(50),
        CumplimientoPlanta NVARCHAR(50),
        Cliente NVARCHAR(200),
        Ddist NUMERIC(18,0),
        TipoPed NUMERIC(18,0)
    );

    -- Crear índices en la tabla temporal
    --CREATE INDEX IX_Temp_Codigo ON #TT_INTERFASE(Codigo);
    --CREATE INDEX IX_Temp_Familia ON #TT_INTERFASE(Familia);
    --CREATE INDEX IX_Temp_Lote ON #TT_INTERFASE(Lote);
    --CREATE INDEX IX_Temp_TipoPed ON #TT_INTERFASE(TipoPed);

    -- Tabla temporal para fechas de producción (evitar consultas repetidas)
    SELECT U_Fecha
    INTO #FechasProd
    FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD];

    --CREATE INDEX IX_FechasProd ON #FechasProd(U_Fecha);

    -- Función inline para calcular días hábiles (reemplaza la lógica CASE repetitiva)
    -- Inserción inicial con cálculos directos donde sea posible
    INSERT INTO #TT_INTERFASE (
        Codigo, SKU, DescSKU, LinItem, Familia, Tipo, CantPen, CantTot,
        DPT01, FCont, Estado, Originnum, FRealLib, FEntLote,
        FCierreOP, NumLote, Destino, Molde,
        Lote, CodMolde, Cliente, TipoPed
    )
    SELECT DISTINCT
        T0.DocNum,
        T0.ItemCode,
        T1.ItemName,
        CASE T1.U_Linea
            WHEN 'F01' THEN 'FV'
            WHEN 'F02' THEN 'MS'
            WHEN 'F03' THEN 'MS'
            WHEN 'F04' THEN 'INYECCION'
            WHEN 'F05' THEN 'MBL'
            WHEN 'F06' THEN 'MBL'
            WHEN 'F07' THEN 'MBL'
            WHEN 'F10' THEN 'MBL'
            WHEN 'F09' THEN 'CEFI'
            WHEN 'F11' THEN 'CEFI'
        END,
        T5.U_FIR_FAM,
        T0.U_Tipo_Orden,
        T0.PlannedQty - T0.CmpltQty,
        T0.PlannedQty,
        P0.OnHand - P0.IsCommited,
        T0.CreateDate,
        CASE T0.Status
            WHEN 'P' THEN 'Planificado'
            WHEN 'R' THEN 'Liberado'
            WHEN 'L' THEN 'Cerrado'
            WHEN 'C' THEN 'Cancelado'
        END,
        T0.OriginNum,
        CASE WHEN T0.Status = 'P' THEN NULL ELSE T0.RlsDate END,
        T0.DueDate,
        T0.CloseDate,
        T0.U_NumLote,
        T0.wareHouse,
        T7.ItemName,
        SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote)) +
        REPLACE(SUBSTRING(SUBSTRING(T0.U_NumLote,
            LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1,
            LEN(T0.U_numlote)), 1,
            PATINDEX('%-%', SUBSTRING(T0.U_NumLote,
                LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1,
                LEN(T0.U_numlote)))), '-', ''),
        T1.U_Molde,
        T2.CardName,
        T2.U_TipoPedidos
    FROM [Firplak_SA].[dbo].[OWOR] T0 WITH (NOLOCK)
    INNER JOIN [Firplak_SA].[dbo].[OITM] T1 WITH (NOLOCK) ON T0.ItemCode = T1.ItemCode
    INNER JOIN [Firplak_SA].[dbo].[ORDR] T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
    INNER JOIN [Firplak_SA].[dbo].[RDR1] T3 WITH (NOLOCK) ON T2.DocEntry = T3.DocEntry
    INNER JOIN [Firplak_SA].[dbo].[WOR1] T4 WITH (NOLOCK) ON T0.DocEntry = T4.DocEntry
    INNER JOIN [Firplak_SA].[dbo].[@FIR_FAM_SYMPH] T5 WITH (NOLOCK)
        ON T1.U_Familia COLLATE SQL_Latin1_General_CP1_CI_AS = T5.U_FIR_FAM_MAES COLLATE SQL_Latin1_General_CP1_CI_AS
        AND T5.U_FIR_TIPO_PED = T2.U_TipoPedidos
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] T6 WITH (NOLOCK)
        ON T5.U_FIR_FAM COLLATE SQL_Latin1_General_CP1_CI_AS = T6.Name COLLATE SQL_Latin1_General_CP1_CI_AS
    INNER JOIN [Firplak_SA].[dbo].[OITM] T7 WITH (NOLOCK) ON T1.U_Molde = T7.ItemCode
    LEFT JOIN [Firplak_SA].[dbo].[OITW] P0 WITH (NOLOCK)
        ON P0.ItemCode = T0.ItemCode AND P0.WhsCode = 'PT-01'
    WHERE (T0.Status IN ('R','P') OR (T0.Status = 'L' AND T0.CloseDate >= DATEADD(DAY, -30, GETDATE())))
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08');

    -- Actualizar Amort con JOIN en lugar de cursor
    UPDATE T
    SET T.Amort = A.U_Amortiguador
    FROM #TT_INTERFASE T
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] A WITH (NOLOCK)
        ON T.Familia COLLATE SQL_Latin1_General_CP1_CI_AS = A.Name COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- Calcular FRecoLib para STOCK
    UPDATE #TT_INTERFASE
    SET FRecoLib = CAST(DATEADD(DAY, 1, FCont) AS DATE)
    WHERE Tipo = 'STOCK';

    -- Calcular FRecoLib para STANDARD (valor temporal)
    UPDATE #TT_INTERFASE
    SET FRecoLib = CAST('1900-01-01' AS DATE)
    WHERE Tipo = 'STANDARD';

    -- Calcular FIdealProduccion usando cursor (lógica original que funciona correctamente)
    DECLARE @CodigoFIP NVARCHAR(50), @FRealLibFIP DATE, @AmortFIP NUMERIC(3,0), @FIdealProdFIP DATE;

    DECLARE cFIdealProduccion CURSOR LOCAL FAST_FORWARD FOR
    SELECT Codigo, FRealLib, Amort
    FROM #TT_INTERFASE
    WHERE FRealLib IS NOT NULL AND Amort IS NOT NULL;

    OPEN cFIdealProduccion;
    FETCH NEXT FROM cFIdealProduccion INTO @CodigoFIP, @FRealLibFIP, @AmortFIP;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @FIdealProdFIP = CASE
            WHEN @AmortFIP = 1 THEN @FRealLibFIP
            ELSE DATEADD(DAY,
                (SELECT TOP 1 nums.n
                 FROM (
                     SELECT TOP 30 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                     FROM (VALUES (1),(1),(1),(1),(1)) t1(n)
                     CROSS JOIN (VALUES (1),(1),(1),(1),(1),(1)) t2(n)
                 ) AS nums
                 WHERE nums.n + 1 - (
                         SELECT COUNT(1)
                         FROM #FechasProd fp
                         WHERE fp.U_Fecha BETWEEN @FRealLibFIP
                         AND DATEADD(DAY, nums.n, @FRealLibFIP)
                     ) = @AmortFIP
                 ORDER BY nums.n
                ), @FRealLibFIP)
        END;

        UPDATE #TT_INTERFASE
        SET FIdealProduccion = @FIdealProdFIP
        WHERE Codigo = @CodigoFIP;

        FETCH NEXT FROM cFIdealProduccion INTO @CodigoFIP, @FRealLibFIP, @AmortFIP;
    END

    CLOSE cFIdealProduccion;
    DEALLOCATE cFIdealProduccion;

    -- Actualizar FRecoLib para órdenes STOCK usando lógica simplificada
    UPDATE #TT_INTERFASE
    SET FRecoLib = CAST(DATEADD(DAY,
        (SELECT TOP 1 n
         FROM (SELECT TOP 15 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
               FROM sys.objects) nums
         WHERE n - (SELECT COUNT(*) FROM #FechasProd
                    WHERE U_Fecha BETWEEN FCont AND DATEADD(DAY, n, FCont)) >= 1
         ORDER BY n), FCont) AS DATE)
    WHERE Tipo = 'STOCK' AND FRecoLib IS NOT NULL;

    -- Actualizar FRecoLib para órdenes STANDARD
    UPDATE #TT_INTERFASE
    SET FRecoLib = CAST(DATEADD(DAY,
        -(SELECT TOP 1 n
          FROM (SELECT TOP 15 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                FROM sys.objects) nums
          WHERE n - (SELECT COUNT(*) FROM #FechasProd
                     WHERE U_Fecha BETWEEN DATEADD(DAY, -n, FEntLote) AND FEntLote) >= Amort - 1
          ORDER BY n), FEntLote) AS DATE)
    WHERE FRecoLib = '1900-01-01' AND FEntLote IS NOT NULL AND Amort IS NOT NULL;

    -- Actualizar FPromEntitem con JOIN
    UPDATE T
    SET T.FPromEntitem = R.ShipDate
    FROM #TT_INTERFASE T
    INNER JOIN [Firplak_SA].[dbo].[OWOR] W WITH (NOLOCK) ON T.Codigo = W.DocNum
    INNER JOIN [Firplak_SA].[dbo].[ORDR] O WITH (NOLOCK) ON W.OriginNum = O.DocNum
    INNER JOIN [Firplak_SA].[dbo].[RDR1] R WITH (NOLOCK)
        ON O.DocEntry = R.DocEntry
        AND ISNULL(CONVERT(INT, SUBSTRING(W.U_NumLote,
            CHARINDEX('-', W.U_NumLote) + 1,
            CHARINDEX('-', W.U_NumLote, CHARINDEX('-', W.U_NumLote) + 1) - CHARINDEX('-', W.U_NumLote) - 1)) - 1, 0) = R.VisOrder;

    -- Calcular ConsumoLib (días entre FRecoLib y FRealLib/GETDATE)
    UPDATE #TT_INTERFASE
    SET ConsumoLib = CASE
        WHEN DATEDIFF(DAY, FRecoLib, COALESCE(FRealLib, GETDATE())) < 0
        THEN DATEDIFF(DAY, FRecoLib, COALESCE(FRealLib, GETDATE())) +
             (SELECT COUNT(*) FROM #FechasProd
              WHERE U_Fecha BETWEEN COALESCE(FRealLib, GETDATE()) AND FRecoLib)
        ELSE DATEDIFF(DAY, FRecoLib, COALESCE(FRealLib, GETDATE())) -
             (SELECT COUNT(*) FROM #FechasProd
              WHERE U_Fecha BETWEEN FRecoLib AND COALESCE(FRealLib, GETDATE()))
    END;

    -- Calcular ColorLib, ColorLibText y Cumplimiento
    UPDATE #TT_INTERFASE
    SET ColorLib = (ConsumoLib * 100.0) / NULLIF(Amort, 0);

    UPDATE #TT_INTERFASE
    SET ColorLibText = CASE
        WHEN ColorLib >= 100 THEN 'BLACK'
        WHEN ColorLib >= 66.6 THEN 'RED'
        WHEN ColorLib >= 33.3 THEN 'YELLOW'
        WHEN ColorLib >= 0 THEN 'GREEN'
        ELSE 'CYAN'
    END;

    UPDATE #TT_INTERFASE
    SET Cumplimiento = CASE
        WHEN FRealLib > FRecoLib THEN 'No cumplió'
        WHEN FRealLib <= FRecoLib THEN 'Si cumplió'
        WHEN FRealLib IS NULL AND FRecoLib < CAST(GETDATE() AS DATE) THEN 'No cumplió'
        ELSE 'Sin liberar'
    END;

    -- Calcular ConsumoAmort
    UPDATE #TT_INTERFASE
    SET ConsumoAmort = CASE
        WHEN FRealLib IS NOT NULL
        THEN DATEDIFF(DAY, FRealLib, COALESCE(FCierreOP, GETDATE())) -
             (SELECT COUNT(*) FROM #FechasProd
              WHERE U_Fecha BETWEEN FRealLib AND COALESCE(FCierreOP, GETDATE())) + 1
        ELSE 0
    END;

    -- Calcular ColorConsumoAmort y ColorConsumoAmortText
    UPDATE #TT_INTERFASE
    SET ColorConsumoAmort = (CAST(ConsumoAmort AS NUMERIC(10,2)) * 100.0) / NULLIF(Amort, 0);

    UPDATE #TT_INTERFASE
    SET ColorConsumoAmortText = CASE
        WHEN ColorConsumoAmort > 100 THEN 'BLACK'
        WHEN ColorConsumoAmort > 66.6 THEN 'RED'
        WHEN ColorConsumoAmort > 33.3 THEN 'YELLOW'
        WHEN ColorConsumoAmort >= 0 THEN 'GREEN'
        ELSE 'SIN LIBERAR'
    END;

    -- Calcular DRetrazoEnt
    UPDATE #TT_INTERFASE
    SET DRetrazoEnt = CASE
        WHEN FEntLote > GETDATE() AND FCierreOP IS NULL
        THEN CASE
            WHEN DATEDIFF(DAY, FEntLote, GETDATE()) < 0
            THEN (SELECT COUNT(*) FROM #FechasProd
                  WHERE U_Fecha BETWEEN GETDATE() AND FEntLote) +
                 DATEDIFF(DAY, FEntLote, GETDATE())
            ELSE DATEDIFF(DAY, FEntLote, GETDATE()) -
                 (SELECT COUNT(*) FROM #FechasProd
                  WHERE U_Fecha BETWEEN GETDATE() AND FEntLote)
        END
        ELSE DATEDIFF(DAY, FEntLote, COALESCE(FCierreOP, GETDATE())) -
             (SELECT COUNT(*) FROM #FechasProd
              WHERE U_Fecha BETWEEN FEntLote AND COALESCE(FCierreOP, GETDATE()))
    END;

    -- Calcular FCargaMolde
    UPDATE #TT_INTERFASE
    SET FCargaMolde = CASE
        WHEN FRealLib IS NOT NULL THEN FRealLib
        WHEN FRealLib IS NULL AND FRecoLib > GETDATE() THEN FRecoLib
        ELSE GETDATE()
    END;

    -- Calcular ColorPrograma y ColorProgramaText
    UPDATE #TT_INTERFASE
    SET ColorPrograma = (DRetrazoEnt * 100.0) / NULLIF(Amort, 0);

    UPDATE #TT_INTERFASE
    SET ColorProgramaText = CASE
        WHEN ColorPrograma > 0 THEN 'BLACK'
        WHEN ColorPrograma > -33.3 THEN 'RED'
        WHEN ColorPrograma > -66.6 THEN 'YELLOW'
        WHEN ColorPrograma > -100 THEN 'GREEN'
        ELSE 'CYAN'
    END;

    -- Actualizar CantPenItem
    UPDATE T
    SET T.CantPenItem = W.CantPend
    FROM #TT_INTERFASE T
    INNER JOIN (
        SELECT
            SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote)) +
            REPLACE(SUBSTRING(SUBSTRING(U_NumLote,
                LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1,
                LEN(U_numlote)), 1,
                PATINDEX('%-%', SUBSTRING(U_NumLote,
                    LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1,
                    LEN(U_numlote)))), '-', '') AS Lote,
            ISNULL(SUM(PlannedQty), 0) - ISNULL(SUM(CmpltQty), 0) AS CantPend
        FROM [Firplak_SA].[dbo].[OWOR] WITH (NOLOCK)
        WHERE Status IN ('R','P')
        GROUP BY SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote)) +
                 REPLACE(SUBSTRING(SUBSTRING(U_NumLote,
                     LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1,
                     LEN(U_numlote)), 1,
                     PATINDEX('%-%', SUBSTRING(U_NumLote,
                         LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1,
                         LEN(U_numlote)))), '-', '')
    ) W ON T.Lote COLLATE SQL_Latin1_General_CP1_CI_AS = W.Lote COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- Actualizar Ddist
    UPDATE T
    SET T.Ddist = TP.U_Dias_Distr
    FROM #TT_INTERFASE T
    INNER JOIN [Firplak_SA].[dbo].[@FIR_TIPOPEDIDOS] TP WITH (NOLOCK)
        ON CAST(T.TipoPed AS NVARCHAR(20)) COLLATE SQL_Latin1_General_CP1_CI_AS = TP.Code COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- NOTA: FIdealProduccion ya fue calculado correctamente por el cursor anterior
    -- NO volver a calcularlo aquí para evitar sobreescribir el valor correcto

    -- Actualizar FPromEntitem ajustado por días de distribución
    UPDATE #TT_INTERFASE
    SET FPromEntitem = CAST(DATEADD(DAY,
        -ISNULL((SELECT TOP 1 n
          FROM (SELECT TOP 15 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                FROM sys.objects) nums
          WHERE n - (SELECT COUNT(*) FROM #FechasProd
                     WHERE U_Fecha BETWEEN DATEADD(DAY, -n, FPromEntitem) AND FPromEntitem) >= Ddist
          ORDER BY n), Ddist), FPromEntitem) AS DATE)
    WHERE Ddist IS NOT NULL AND FPromEntitem IS NOT NULL;

    -- Calcular FRecomEnt
    UPDATE #TT_INTERFASE
    SET FRecomEnt = CASE
        WHEN FEntLote > FIdealProduccion THEN FIdealProduccion
        ELSE FEntLote
    END;

    -- Actualizar CapacidadMolde con JOIN
    UPDATE T
    SET T.CapacidadMolde = CAST((M.Moldes * ITM.U_NumVueltas * TU.U_Turnos) AS NVARCHAR(100))
    FROM #TT_INTERFASE T
    INNER JOIN [Firplak_SA].[dbo].[OITM] ITM WITH (NOLOCK)
        ON T.CodMolde COLLATE SQL_Latin1_General_CP1_CI_AS = ITM.ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS
    INNER JOIN (
        SELECT ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS AS ItemCode, COUNT(*) AS Moldes
        FROM [Firplak_SA].[dbo].[OSRN] WITH (NOLOCK)
        WHERE U_EstadoMolde = 'Activo'
        GROUP BY ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS
    ) M ON T.CodMolde COLLATE SQL_Latin1_General_CP1_CI_AS = M.ItemCode
        INNER JOIN [Firplak_SA].[dbo].[OITM] ITM_ART on T.SKU COLLATE SQL_Latin1_General_CP1_CI_AS = ITM_ART.ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS
    INNER JOIN [Firplak_SA].[dbo].[@FIR_FAMILIA] FAM ON ITM_ART.U_Familia = FAM.Code
    INNER JOIN [Firplak_SA].[dbo].[@TURNOS] TU WITH (NOLOCK)
        ON FAM.U_Planta COLLATE SQL_Latin1_General_CP1_CI_AS = TU.Code COLLATE SQL_Latin1_General_CP1_CI_AS;


    -- Calcular CumplimientoPrograma y CumplimientoPlanta
    UPDATE #TT_INTERFASE
    SET CumplimientoPrograma = CASE
        WHEN FCierreOP IS NOT NULL AND FCierreOP <= FEntLote THEN 'Cumplió'
        WHEN FCierreOP IS NOT NULL AND FCierreOP > FEntLote THEN 'No Cumplió'
        WHEN FCierreOP IS NULL AND GETDATE() > FEntLote THEN 'No Cumplió'
        WHEN FCierreOP IS NULL AND FRealLib IS NOT NULL THEN 'Sin Entregar'
        WHEN FCierreOP IS NULL AND FRealLib IS NULL THEN 'Sin Liberar'
    END,
    CumplimientoPlanta = CASE
        WHEN FCierreOP IS NOT NULL AND FCierreOP <= FIdealProduccion THEN 'Cumplió'
        WHEN FCierreOP IS NOT NULL AND FCierreOP > FIdealProduccion THEN 'No Cumplió'
        WHEN FCierreOP IS NULL AND FRealLib IS NOT NULL AND CAST(GETDATE() AS DATE) > FIdealProduccion THEN 'No Cumplió'
        WHEN FCierreOP IS NULL AND FRealLib IS NOT NULL AND CAST(GETDATE() AS DATE) <= FIdealProduccion THEN 'Sin Entregar'
        WHEN FCierreOP IS NULL AND FRealLib IS NULL THEN 'Sin Liberar'
    END;

    -- SELECT final
    SELECT
        Originnum,
        Codigo AS 'Nro OP',
        SKU AS 'SKU',
        DescSKU AS 'Descripción Artículo',
        LinItem AS 'Planta',
        Familia AS 'Familia',
        Tipo AS 'Tipo Orden',
        CantPen AS 'Cant. Pendiente',
        CantPenItem AS 'Cant. Pend. Item',
        CantTot AS 'Cantidad total',
        DPT01 AS 'Disponible PT01',
        FCont AS 'Fecha Creación OP',
        Estado AS 'Estado',
        FRecoLib AS 'Fecha Recomendada Liberación',
        FRealLib AS 'Fecha Real Liberación',
        ConsumoLib AS 'Consumo Para Liberar',
        ColorLibText AS 'Color Liberación Txt',
        ColorLib AS 'Color Liberación',
        Cumplimiento AS 'Cumplimiento Liberación',
        FEntLote AS 'Fecha Entrega Lote',
        FRecomEnt AS 'Fecha Recomendada de Entrega',
        FCierreOP AS 'Fecha Cierre OP',
        FIdealProduccion AS 'Fecha Ideal Entrega Producción',
        ConsumoAmort AS 'Consumo Amortiguador Planta',
        ColorConsumoAmortText AS 'Color Producción Txt',
        ColorConsumoAmort AS 'Color Producción',
        CumplimientoPlanta AS 'Cumplimiento Planta',
        DRetrazoEnt AS 'Dias Retrazo Firplak',
        ColorProgramaText AS 'Color Firplak Txt',
        ColorPrograma AS 'Color Firplak',
        CumplimientoPrograma AS 'Cumplimiento Firplak',
        FPromEntitem AS 'Fecha Prometida Entrega Item',
        Destino AS 'Destino',
        NumLote AS 'NumLote',
        Molde AS 'Molde',
        CapacidadMolde AS 'Capacidad Molde',
        FCargaMolde AS 'Fecha Carga Molde',
        Amort AS 'Amortiguador',
        Cliente AS 'Cliente'
    FROM #TT_INTERFASE
    WHERE Familia IS NOT NULL;

    -- Limpiar
    DROP TABLE #TT_INTERFASE;
    DROP TABLE #FechasProd;

END
