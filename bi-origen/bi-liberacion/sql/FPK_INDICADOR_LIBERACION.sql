USE [Planos_Symphony]
GO

/****** Object:  StoredProcedure [dbo].[FPK_INDICADOR_LIBERACION]    Script Date: 4/11/2026 10:04:10 a. m. ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE   PROCEDURE [dbo].[FPK_INDICADOR_LIBERACION]
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @empresa VARCHAR(20) = 'Firplak';
    DECLARE @FechaActual DATE = CONVERT(DATE, GETDATE());

    -- Limpiar tablas temporales si existen
    IF OBJECT_ID('tempdb..#TT_INTERFASE2') IS NOT NULL DROP TABLE #TT_INTERFASE2;
    IF OBJECT_ID('tempdb..#FechasProd') IS NOT NULL DROP TABLE #FechasProd;
    
    -- Crear tabla de fechas de producción
    SELECT U_Fecha
    INTO #FechasProd
    FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
    WHERE U_Fecha BETWEEN DATEADD(YEAR, -2, @FechaActual) AND DATEADD(YEAR, 1, @FechaActual);
    
    CREATE CLUSTERED INDEX IX_FechasProd ON #FechasProd(U_Fecha);

    -- Crear tabla temporal SIN especificar collation (heredará de tempdb)
    CREATE TABLE #TT_INTERFASE2 (
        Codigo NVARCHAR(20),
        Originnum NVARCHAR(20),
        Tipo NVARCHAR(2),
        SKU NVARCHAR(50),
        Destino NVARCHAR(25),
        FPromEnt DATE,
        FRealLib DATE,
        Familia NVARCHAR(10),
        Amort NUMERIC(3,0),
        TipoPed NUMERIC(3,0),
        Ddist NUMERIC(3,0),
        CantTot NUMERIC(18,3),
        CantPen NUMERIC(18,3),
        FAct DATE,
        Lote NVARCHAR(25),
        LinItem NVARCHAR(49), 
        NLote NVARCHAR(30),
        DescSKU NVARCHAR(150),
        Estado NVARCHAR(20),
        FCont DATE,
        CantTotItem NUMERIC(18,3),
        CantPenItem NUMERIC(18,3),
        Linea NVARCHAR(6),
        FPromEntitem DATE,
        FRecoLib DATE,
        FRecoEnt DATE,
        Color NVARCHAR(20),
        Costo NUMERIC(18,1),
        Planta NVARCHAR(20)
    );

    -- Inserción inicial
    INSERT INTO #TT_INTERFASE2 (
        Codigo, Originnum, Tipo, SKU, Destino, FPromEnt, FRealLib, 
        Familia, TipoPed, CantTot, CantPen, FAct, Lote, LinItem, 
        Nlote, DescSKU, Estado, FCont, Linea, Costo, Planta
    )
    SELECT DISTINCT
        T0.DocNum,
        T0.OriginNum,
        CASE T0.U_Tipo_Orden 
            WHEN 'STANDARD' THEN 'O'
            WHEN 'STOCK' THEN 'S'
            ELSE T0.U_Tipo_Orden
        END,
        T0.ItemCode,
        T0.Warehouse,
        CONVERT(DATE, T0.DueDate),
        CONVERT(DATE, T0.RlsDate),
        FAM.U_FIR_FAM,
        T2.U_TipoPedidos,
        T0.PlannedQty,
        T0.PlannedQty - T0.CmpltQty,
        @FechaActual,
        SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote)) + 
            REPLACE(SUBSTRING(SUBSTRING(T0.U_NumLote, LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1, LEN(T0.U_numlote)), 1, 
            PATINDEX('%-%', SUBSTRING(T0.U_NumLote, LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1, LEN(T0.U_numlote)))), '-', ''),
        REPLACE(SUBSTRING(SUBSTRING(T0.U_NumLote, LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1, LEN(T0.U_numlote)), 1, 
            PATINDEX('%-%', SUBSTRING(T0.U_NumLote, LEN(SUBSTRING(T0.U_NumLote, 1, PATINDEX('%-%', T0.U_NumLote))) + 1, LEN(T0.U_numlote)))), '-', ''),
        T0.U_NumLote,
        T1.ItemName,
        CASE T0.Status
            WHEN 'P' THEN 'Planificado'
            WHEN 'R' THEN 'Liberado'
            WHEN 'L' THEN 'Cerrado'
            WHEN 'C' THEN 'Cancelado'
        END,
        CONVERT(DATE, T0.CreateDate),
        CASE T1.U_Linea
            WHEN 'F01' THEN 'FV'
            WHEN 'F02' THEN 'PC'
            WHEN 'F03' THEN 'PA'
            WHEN 'F04' THEN 'RTM'
            WHEN 'F05' THEN 'MBL'
            WHEN 'F06' THEN 'ESPGAB'
            WHEN 'F07' THEN 'PTTM'
        END,
        T1.LstEvlPric,
        @empresa
    FROM [Firplak_SA].[dbo].[OWOR] T0 WITH (NOLOCK)
    INNER JOIN [Firplak_SA].[dbo].[OITM] T1 WITH (NOLOCK) ON T0.ItemCode = T1.ItemCode
    INNER JOIN [Firplak_SA].[dbo].[ORDR] T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
    INNER JOIN [Firplak_SA].[dbo].[RDR1] T3 WITH (NOLOCK) ON T2.DocEntry = T3.DocEntry
    LEFT JOIN [Firplak_SA].[dbo].[@FIR_FAM_SYMPH] FAM WITH (NOLOCK) 
        ON FAM.U_FIR_FAM_MAES = T1.U_Familia 
        AND FAM.U_FIR_TIPO_PED = T2.U_TipoPedidos
    WHERE T0.Status IN ('R', 'P', 'L')
        AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
        AND T0.U_Tipo_Orden IS NOT NULL
        AND T0.DueDate BETWEEN DATEADD(DAY, -365, @FechaActual) AND DATEADD(DAY, 25, @FechaActual);

    -- Crear índices
    CREATE INDEX IX_Familia ON #TT_INTERFASE2(Familia);
    CREATE INDEX IX_TipoPed ON #TT_INTERFASE2(TipoPed);
    CREATE INDEX IX_Codigo ON #TT_INTERFASE2(Codigo);
    CREATE INDEX IX_Lote ON #TT_INTERFASE2(Lote);
    CREATE INDEX IX_OriginLinItem ON #TT_INTERFASE2(Originnum, LinItem);

    -- 1. Actualizar Amortiguadores - USANDO COLLATE en ambos lados
    UPDATE T
    SET T.Amort = A.U_Amortiguador
    FROM #TT_INTERFASE2 T
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] A WITH (NOLOCK)
        ON A.Name COLLATE SQL_Latin1_General_CP1_CI_AS = T.Familia COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- 2. Actualizar Días de Distribución
    UPDATE T
    SET T.Ddist = TP.U_Dias_Distr
    FROM #TT_INTERFASE2 T
    INNER JOIN [Firplak_SA].[dbo].[@FIR_TIPOPEDIDOS] TP WITH (NOLOCK)
        ON TP.Code = T.TipoPed;

    -- 3. Actualizar Cantidad Total Item - USANDO COLLATE solo en strings
    UPDATE T
    SET T.CantTotItem = R.Quantity
    FROM #TT_INTERFASE2 T
    INNER JOIN [Firplak_SA].[dbo].[ORDR] O WITH (NOLOCK) 
        ON CONVERT(NVARCHAR(20), O.DocNum) COLLATE SQL_Latin1_General_CP1_CI_AS = T.Originnum COLLATE SQL_Latin1_General_CP1_CI_AS
    INNER JOIN [Firplak_SA].[dbo].[RDR1] R WITH (NOLOCK) 
        ON R.DocEntry = O.DocEntry 
        AND R.VisOrder + 1 = CONVERT(NUMERIC(3,0), T.LinItem);

    -- 4. Actualizar Cantidad Pendiente Item - USANDO COLLATE
    UPDATE T
    SET T.CantPenItem = ISNULL(W.TotalPlanned, 0)
    FROM #TT_INTERFASE2 T
    LEFT JOIN (
        SELECT 
            SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote)) + 
            REPLACE(SUBSTRING(SUBSTRING(U_NumLote, LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1, LEN(U_numlote)), 1, 
            PATINDEX('%-%', SUBSTRING(U_NumLote, LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1, LEN(U_numlote)))), '-', '') AS Lote,
            SUM(PlannedQty) AS TotalPlanned
        FROM [Firplak_SA].[dbo].[OWOR] WITH (NOLOCK)
        WHERE Status IN ('P', 'R')
            AND U_NumLote IS NOT NULL
            AND PATINDEX('%-%', U_NumLote) > 0
        GROUP BY SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote)) + 
            REPLACE(SUBSTRING(SUBSTRING(U_NumLote, LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1, LEN(U_numlote)), 1, 
            PATINDEX('%-%', SUBSTRING(U_NumLote, LEN(SUBSTRING(U_NumLote, 1, PATINDEX('%-%', U_NumLote))) + 1, LEN(U_numlote)))), '-', '')
    ) W ON W.Lote COLLATE SQL_Latin1_General_CP1_CI_AS = T.Lote COLLATE SQL_Latin1_General_CP1_CI_AS;

    -- 5. Actualizar Fecha Prometida Entrega Item - USANDO COLLATE
    UPDATE T
    SET T.FPromEntitem = R.ShipDate,
        T.LinItem = CASE 
            WHEN LEN(R.VisOrder) < 2 THEN 
                CASE WHEN LEN(CONVERT(NVARCHAR, '0' + CONVERT(NVARCHAR, R.VisOrder + 1))) = 3
                    THEN CONVERT(NVARCHAR, R.VisOrder + 1)
                    ELSE CONVERT(NVARCHAR, '0' + CONVERT(NVARCHAR, R.VisOrder + 1))
                END
            ELSE CONVERT(NVARCHAR, R.VisOrder + 1)
        END
    FROM #TT_INTERFASE2 T
    INNER JOIN [Firplak_SA].[dbo].[ORDR] O WITH (NOLOCK) 
        ON CONVERT(NVARCHAR(20), O.DocNum) COLLATE SQL_Latin1_General_CP1_CI_AS = T.Originnum COLLATE SQL_Latin1_General_CP1_CI_AS
    INNER JOIN [Firplak_SA].[dbo].[RDR1] R WITH (NOLOCK) 
        ON R.DocEntry = O.DocEntry;

    -- 6. Actualizar FPromEntitem considerando días de distribución - ITERATIVO
    IF OBJECT_ID('tempdb..#DiasLaborables') IS NOT NULL DROP TABLE #DiasLaborables;

    CREATE TABLE #DiasLaborables (
        Codigo NVARCHAR(20),
        FechaCalculada DATE
    );

    -- Calcular restando Ddist días laborables desde FPromEntitem
    INSERT INTO #DiasLaborables (Codigo, FechaCalculada)
    SELECT 
        Codigo,
        CASE
            WHEN DATEDIFF(DAY, DATEADD(DAY, -Ddist, FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -Ddist, FPromEntitem) AND FPromEntitem) < Ddist
            THEN CASE 
                WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 1), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 1), FPromEntitem) AND FPromEntitem) < Ddist
                THEN CASE 
                    WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 2), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 2), FPromEntitem) AND FPromEntitem) < Ddist
                    THEN CASE 
                        WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 3), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 3), FPromEntitem) AND FPromEntitem) < Ddist
                        THEN CASE 
                            WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 4), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 4), FPromEntitem) AND FPromEntitem) < Ddist
                            THEN CASE 
                                WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 5), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 5), FPromEntitem) AND FPromEntitem) < Ddist
                                THEN CASE 
                                    WHEN DATEDIFF(DAY, DATEADD(DAY, -(Ddist + 6), FPromEntitem), FPromEntitem) - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Ddist + 6), FPromEntitem) AND FPromEntitem) < Ddist
                                    THEN DATEADD(DAY, -(Ddist + 7), FPromEntitem)
                                    ELSE DATEADD(DAY, -(Ddist + 6), FPromEntitem)
                                END
                                ELSE DATEADD(DAY, -(Ddist + 5), FPromEntitem)
                            END
                            ELSE DATEADD(DAY, -(Ddist + 4), FPromEntitem)
                        END
                        ELSE DATEADD(DAY, -(Ddist + 3), FPromEntitem)
                    END
                    ELSE DATEADD(DAY, -(Ddist + 2), FPromEntitem)
                END
                ELSE DATEADD(DAY, -(Ddist + 1), FPromEntitem)
            END
            ELSE DATEADD(DAY, -Ddist, FPromEntitem)
        END AS FechaCalculada
    FROM #TT_INTERFASE2
    WHERE FPromEntitem IS NOT NULL AND Ddist > 0;

    CREATE CLUSTERED INDEX IX_Codigo ON #DiasLaborables(Codigo);

    UPDATE T
    SET T.FPromEntitem = DL.FechaCalculada
    FROM #TT_INTERFASE2 T
    INNER JOIN #DiasLaborables DL ON DL.Codigo = T.Codigo
    WHERE T.Ddist > 0;

    -- 7. Calcular FRecoLib para órdenes STOCK - ITERATIVO
    IF OBJECT_ID('tempdb..#CalcFRecoLibStock') IS NOT NULL DROP TABLE #CalcFRecoLibStock;
    
    CREATE TABLE #CalcFRecoLibStock (
        Codigo NVARCHAR(20),
        FechaCalculada DATE
    );
    
    -- Calcular iterando día por día para órdenes STOCK
    INSERT INTO #CalcFRecoLibStock (Codigo, FechaCalculada)
    SELECT 
        Codigo,
        CASE 
            WHEN 1 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 1, CONVERT(DATE, FCont))) < 1
            THEN CASE 
                WHEN 2 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 2, CONVERT(DATE, FCont))) < 1
                THEN CASE 
                    WHEN 3 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 3, CONVERT(DATE, FCont))) < 1
                    THEN CASE 
                        WHEN 4 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 4, CONVERT(DATE, FCont))) < 1
                        THEN CASE 
                            WHEN 5 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 5, CONVERT(DATE, FCont))) < 1
                            THEN CASE 
                                WHEN 6 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 6, CONVERT(DATE, FCont))) < 1
                                THEN CASE 
                                    WHEN 7 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 7, CONVERT(DATE, FCont))) < 1
                                    THEN CASE 
                                        WHEN 8 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN CONVERT(DATE, FCont) AND DATEADD(DAY, 8, CONVERT(DATE, FCont))) < 1
                                        THEN DATEADD(DAY, 9, CONVERT(DATE, FCont))
                                        ELSE DATEADD(DAY, 8, CONVERT(DATE, FCont))
                                    END
                                    ELSE DATEADD(DAY, 7, CONVERT(DATE, FCont))
                                END
                                ELSE DATEADD(DAY, 6, CONVERT(DATE, FCont))
                            END
                            ELSE DATEADD(DAY, 5, CONVERT(DATE, FCont))
                        END
                        ELSE DATEADD(DAY, 4, CONVERT(DATE, FCont))
                    END
                    ELSE DATEADD(DAY, 3, CONVERT(DATE, FCont))
                END
                ELSE DATEADD(DAY, 2, CONVERT(DATE, FCont))
            END
            ELSE DATEADD(DAY, 1, CONVERT(DATE, FCont))
        END AS FechaCalculada
    FROM #TT_INTERFASE2
    WHERE Tipo = 'S';
    
    CREATE CLUSTERED INDEX IX_Codigo ON #CalcFRecoLibStock(Codigo);
    
    -- Aplicar cálculo
    UPDATE T
    SET T.FRecoLib = CASE 
        WHEN T.Tipo = 'S' THEN ISNULL(C.FechaCalculada, DATEADD(DAY, 1, CONVERT(DATE, T.FCont)))
        WHEN T.Tipo = 'O' THEN '1900-01-01'
        ELSE NULL
    END
    FROM #TT_INTERFASE2 T
    LEFT JOIN #CalcFRecoLibStock C ON C.Codigo = T.Codigo;
    
    DROP TABLE #CalcFRecoLibStock;

    -- 8. Actualizar FRecoLib considerando amortiguadores - ITERATIVO
    -- Crear tabla temporal para calcular fecha correctamente
    IF OBJECT_ID('tempdb..#CalcFRecoLib') IS NOT NULL DROP TABLE #CalcFRecoLib;
    
    CREATE TABLE #CalcFRecoLib (
        Codigo NVARCHAR(20),
        FechaCalculada DATE
    );
    
    -- Calcular fecha iterando día por día hasta encontrar los días laborables necesarios
    INSERT INTO #CalcFRecoLib (Codigo, FechaCalculada)
    SELECT 
        Codigo,
        CASE
            WHEN Amort - 1 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort - 1), FPromEnt) AND FPromEnt) < Amort - 1
            THEN CASE 
                WHEN Amort - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -Amort, FPromEnt) AND FPromEnt) < Amort - 1
                THEN CASE 
                    WHEN Amort + 1 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 1), FPromEnt) AND FPromEnt) < Amort - 1
                    THEN CASE 
                        WHEN Amort + 2 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 2), FPromEnt) AND FPromEnt) < Amort - 1
                        THEN CASE 
                            WHEN Amort + 3 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 3), FPromEnt) AND FPromEnt) < Amort - 1
                            THEN CASE 
                                WHEN Amort + 4 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 4), FPromEnt) AND FPromEnt) < Amort - 1
                                THEN CASE 
                                    WHEN Amort + 5 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 5), FPromEnt) AND FPromEnt) < Amort - 1
                                    THEN CASE 
                                        WHEN Amort + 6 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN DATEADD(DAY, -(Amort + 6), FPromEnt) AND FPromEnt) < Amort - 1
                                        THEN DATEADD(DAY, -(Amort + 7), FPromEnt)
                                        ELSE DATEADD(DAY, -(Amort + 6), FPromEnt)
                                    END
                                    ELSE DATEADD(DAY, -(Amort + 5), FPromEnt)
                                END
                                ELSE DATEADD(DAY, -(Amort + 4), FPromEnt)
                            END
                            ELSE DATEADD(DAY, -(Amort + 3), FPromEnt)
                        END
                        ELSE DATEADD(DAY, -(Amort + 2), FPromEnt)
                    END
                    ELSE DATEADD(DAY, -(Amort + 1), FPromEnt)
                END
                ELSE DATEADD(DAY, -Amort, FPromEnt)
            END
            ELSE DATEADD(DAY, -(Amort - 1), FPromEnt)
        END AS FechaCalculada
    FROM #TT_INTERFASE2
    WHERE FRecoLib = '1900-01-01' AND Amort IS NOT NULL;
    
    CREATE CLUSTERED INDEX IX_Codigo ON #CalcFRecoLib(Codigo);
    
    -- Aplicar el cálculo
    UPDATE T
    SET T.FRecoLib = C.FechaCalculada
    FROM #TT_INTERFASE2 T
    INNER JOIN #CalcFRecoLib C ON C.Codigo = T.Codigo;
    
    DROP TABLE #CalcFRecoLib;

    -- 9. Calcular FRecoEnt - ITERATIVO
    IF OBJECT_ID('tempdb..#CalcFRecoEnt') IS NOT NULL DROP TABLE #CalcFRecoEnt;
    
    CREATE TABLE #CalcFRecoEnt (
        Codigo NVARCHAR(20),
        FechaCalculada DATE
    );
    
    -- Para registros liberados, calcular desde FRealLib + Amort días laborables
    INSERT INTO #CalcFRecoEnt (Codigo, FechaCalculada)
    SELECT 
        Codigo,
        CASE
            WHEN Amort - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort - 1, FRealLib)) < Amort
            THEN CASE 
                WHEN Amort + 1 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort, FRealLib)) < Amort
                THEN CASE 
                    WHEN Amort + 2 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort + 1, FRealLib)) < Amort
                    THEN CASE 
                        WHEN Amort + 3 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort + 2, FRealLib)) < Amort
                        THEN CASE 
                            WHEN Amort + 4 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort + 3, FRealLib)) < Amort
                            THEN CASE 
                                WHEN Amort + 5 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort + 4, FRealLib)) < Amort
                                THEN CASE 
                                    WHEN Amort + 6 - (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRealLib AND DATEADD(DAY, Amort + 5, FRealLib)) < Amort
                                    THEN DATEADD(DAY, Amort + 6, FRealLib)
                                    ELSE DATEADD(DAY, Amort + 5, FRealLib)
                                END
                                ELSE DATEADD(DAY, Amort + 4, FRealLib)
                            END
                            ELSE DATEADD(DAY, Amort + 3, FRealLib)
                        END
                        ELSE DATEADD(DAY, Amort + 2, FRealLib)
                    END
                    ELSE DATEADD(DAY, Amort + 1, FRealLib)
                END
                ELSE DATEADD(DAY, Amort, FRealLib)
            END
            ELSE DATEADD(DAY, Amort - 1, FRealLib)
        END AS FechaCalculada
    FROM #TT_INTERFASE2
    WHERE Estado = 'Liberado' AND FRealLib IS NOT NULL AND Amort IS NOT NULL;
    
    CREATE CLUSTERED INDEX IX_Codigo ON #CalcFRecoEnt(Codigo);
    
    -- Aplicar cálculo
    UPDATE T
    SET T.FRecoEnt = CASE 
        WHEN T.Estado = 'Planificado' THEN T.FPromEnt
        WHEN T.Estado = 'Liberado' THEN ISNULL(C.FechaCalculada, T.FPromEnt)
        ELSE '1900-01-01'
    END
    FROM #TT_INTERFASE2 T
    LEFT JOIN #CalcFRecoEnt C ON C.Codigo = T.Codigo;
    
    DROP TABLE #CalcFRecoEnt;

    -- 10. Ajustar FRecoEnt para liberados
    UPDATE T
    SET T.FRecoEnt = CASE 
        WHEN T.FRealLib IS NULL THEN T.FPromEnt
        WHEN T.FPromEnt < T.FRecoEnt THEN T.FPromEnt 
        ELSE T.FRecoEnt 
    END
    FROM #TT_INTERFASE2 T
    WHERE T.Estado = 'Liberado';

    -- 11. Calcular Color
    IF OBJECT_ID('tempdb..#Colores') IS NOT NULL DROP TABLE #Colores;

    CREATE TABLE #Colores (
        Codigo NVARCHAR(20),
        DiferenciaDias INT,
        EsFuturo BIT
    );

    INSERT INTO #Colores (Codigo, DiferenciaDias, EsFuturo)
    SELECT 
        Codigo,
        CASE 
            WHEN FRecoEnt < @FechaActual THEN
                DATEDIFF(DAY, FRecoEnt, @FechaActual) - 
                (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN FRecoEnt AND @FechaActual)
            ELSE
                DATEDIFF(DAY, FRecoEnt, @FechaActual) + 
                (SELECT COUNT(*) FROM #FechasProd WHERE U_Fecha BETWEEN @FechaActual AND FRecoEnt)
        END AS DiferenciaDias,
        CASE WHEN FRecoEnt >= @FechaActual THEN 1 ELSE 0 END AS EsFuturo
    FROM #TT_INTERFASE2
    WHERE FRecoEnt IS NOT NULL AND FRecoEnt <> '1900-01-01';

    CREATE CLUSTERED INDEX IX_Codigo ON #Colores(Codigo);

    UPDATE T
    SET T.Color = CASE 
        WHEN C.DiferenciaDias > 0 THEN 'BLACK'
        WHEN C.DiferenciaDias = 0 THEN 'RED'
        WHEN T.Familia IN ('PC', 'PA', 'RTM') THEN
            CASE 
                WHEN C.DiferenciaDias = -1 THEN 'YELLOW'
                WHEN C.DiferenciaDias = -2 THEN 'GREEN'
                WHEN C.DiferenciaDias <= -3 THEN 'CYAN'
            END
        WHEN T.Familia IN ('FV', 'FVH') THEN
            CASE 
                WHEN C.DiferenciaDias = -1 THEN 'RED'
                WHEN C.DiferenciaDias = -2 THEN 'YELLOW'
                WHEN C.DiferenciaDias = -3 THEN 'GREEN'
                WHEN C.DiferenciaDias <= -4 THEN 'CYAN'
            END
        WHEN T.Familia IN ('FVHMP', 'FVHMPM') THEN
            CASE 
                WHEN C.DiferenciaDias = -1 THEN 'RED'
                WHEN C.DiferenciaDias BETWEEN -3 AND -2 THEN 'YELLOW'
                WHEN C.DiferenciaDias BETWEEN -5 AND -4 THEN 'GREEN'
                WHEN C.DiferenciaDias <= -6 THEN 'CYAN'
            END
        ELSE 
            CASE 
                WHEN C.DiferenciaDias = -1 THEN 'YELLOW'
                WHEN C.DiferenciaDias < -1 THEN 'CYAN'
            END
    END
    FROM #TT_INTERFASE2 T
    INNER JOIN #Colores C ON C.Codigo = T.Codigo;
    
    -- CORRECCIÓN: Asignar BLACK a todos los registros cerrados sin color (FRecoEnt = '1900-01-01')
    UPDATE T
    SET T.Color = 'BLACK'
    FROM #TT_INTERFASE2 T
    WHERE T.Estado = 'Cerrado' 
      AND (T.Color IS NULL OR T.FRecoEnt = '1900-01-01');

    -- Inserción final
    TRUNCATE TABLE [Planos_Symphony].[dbo].[Indicador_Liberacion];

    INSERT INTO [Planos_Symphony].[dbo].[Indicador_Liberacion]
    SELECT
        Codigo AS 'Código OP',
        Tipo AS 'Tipo',
        SKU AS 'SKU',
        Destino AS 'Destino',
        FPromEnt AS 'Fecha Prometida de Entrega',
        FRealLib AS 'Fecha Real de Liberación',
        Familia AS 'Familia de Producción',
        ISNULL(CantTot, 0) AS 'Cantidad Total',
        ISNULL(CantPen, 0) AS 'Cantidad Pendiente',
        FAct AS 'Fecha de Actualización',
        NLote AS 'Num. Lote',
        DescSKU AS 'Descripción de SKU',
        Estado AS 'Estado',
        FCont AS 'Fecha de Contabilización',
        ISNULL(CantTotItem, 0) AS 'Cantidad Total Item',
        ISNULL(CantPenItem, 0) AS 'Cantidad Pendiente Item',
        Linea AS 'Linea',
        FPromEntitem AS 'Fecha Prometida de Entrega Ítem',
        FRecoLib AS 'Fecha Recomendada de Liberación',
        FRecoEnt AS 'Fecha Recomendada de Entrega',
        Color AS 'Color Recomendado',
        Costo AS 'Costo Unitario',
        Planta AS 'Planta'
    FROM #TT_INTERFASE2
    WHERE Familia IS NOT NULL;

    -- Limpiar todas las tablas temporales
    IF OBJECT_ID('tempdb..#TT_INTERFASE2') IS NOT NULL DROP TABLE #TT_INTERFASE2;
    IF OBJECT_ID('tempdb..#FechasProd') IS NOT NULL DROP TABLE #FechasProd;
    IF OBJECT_ID('tempdb..#DiasLaborables') IS NOT NULL DROP TABLE #DiasLaborables;
    IF OBJECT_ID('tempdb..#Colores') IS NOT NULL DROP TABLE #Colores;
    IF OBJECT_ID('tempdb..#CalcFRecoLibStock') IS NOT NULL DROP TABLE #CalcFRecoLibStock;
    IF OBJECT_ID('tempdb..#CalcFRecoLib') IS NOT NULL DROP TABLE #CalcFRecoLib;
    IF OBJECT_ID('tempdb..#CalcFRecoEnt') IS NOT NULL DROP TABLE #CalcFRecoEnt;

END
GO

