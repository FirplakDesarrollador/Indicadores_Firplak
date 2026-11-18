-- Consultas de validación de la fase 1 del BI NS Plantas (llm-wiki/bi/ns-plantas.md).
-- Servidor Itplakinfo. Solo lectura sobre Firplak_SA: lo único que se crea es la tabla
-- temporal de sesión #ns, que se borra al cerrar la ventana.
-- Ejecutar todo el archivo en la MISMA ventana de consulta (F5). Cada consulta devuelve
-- una pestaña de resultados, numeradas de 1 a 7.

-- 0. Carga el SQL original del BI (sin el ORDER BY) en #ns
IF OBJECT_ID('tempdb..#ns') IS NOT NULL DROP TABLE #ns;

SELECT 
    T0.CreateDate 'Fecha de Creación',
    T0.DocNum '# Documento',
    T0.ItemCode 'Cod Artículo',
    T0.ProdName 'Artículo',
    CONVERT(NUMERIC(18,0), T0.PlannedQty) 'Cantidad Planeada',
    T0.U_Tipo_Orden 'Tipo Orden',
    T0.RlsDate 'Fecha Real de Liberación',
    T0.CloseDate 'Fecha de Cierre Real',
    T3.U_FIR_FAM 'Familia Producción',
    CASE
        When T0.Status = 'R' then 'Liberado'
        When T0.Status = 'P' then 'Planificado'
        When T0.Status = 'L' then 'Cerrado'
    END 'Estado Orden',
    T0.U_U_Razonderetraso 'Razón de Retrazo',
    T0.U_U_Razonderetraso2 'Razón de Retrazo 2',
    convert(numeric(2,0), T4.U_Amortiguador) 'Amortiguador',
    CASE 
        WHEN T4.U_Amortiguador = 1 THEN T0.RlsDate
        ELSE 
            DATEADD(DAY, 
                (
                    SELECT TOP 1 numeros.n
                    FROM (
                        SELECT n, 
                               n + 1 - 
                               (SELECT COUNT(1) 
                                FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD] fp 
                                WHERE fp.U_Fecha BETWEEN DATEADD(DAY, 1, T0.RlsDate) 
                                    AND DATEADD(DAY, n, T0.RlsDate)
                                    -- Agregamos filtro de fecha máxima para optimizar
                                    AND fp.U_Fecha <= DATEADD(DAY, T4.U_Amortiguador * 3, T0.RlsDate)
                               ) as dias_habiles
                        FROM (
                            -- Reducimos a un máximo de días más realista
                            SELECT TOP 30 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                            FROM (VALUES (1),(1),(1),(1),(1)) t1(n)
                            CROSS JOIN (VALUES (1),(1),(1),(1),(1),(1)) t2(n)
                        ) AS nums
                        -- Agregamos filtro para reducir el conjunto de datos
                        WHERE n <= T4.U_Amortiguador * 3
                    ) AS numeros
                    WHERE numeros.dias_habiles = T4.U_Amortiguador
                    ORDER BY numeros.n
                ), 
                T0.RlsDate
            )
    END as 'Fecha ideal Entrega',
    t2.U_TipoPedidos
INTO #ns
FROM 
    [Firplak_SA].[dbo].[OWOR] t0 
    INNER JOIN [Firplak_SA].[dbo].[OITM] t1 ON t0.ItemCode = t1.ItemCode 
    INNER JOIN [Firplak_SA].[dbo].[ORDR] T2 ON T0.OriginNum = T2.DocNum
    INNER JOIN [Firplak_SA].[dbo].[@FIR_FAM_SYMPH] T3 ON t1.U_Familia = t3.U_FIR_FAM_MAES 
        AND t3.U_FIR_TIPO_PED = T2.U_TipoPedidos
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] T4 ON t3.U_FIR_FAM = T4.Name
    Collate SQL_Latin1_General_CP1_CI_AS
WHERE 
    T0.CreateDate >= DATEADD(YEAR, -1, GETDATE())
    AND T0.RlsDate is not null
    AND T0.Status not in ('C','P')
    AND T0.U_NumLote <> ''
    AND T0.Warehouse in ('PT-01','PT-02','PT-08');

-- 1. Volumen, rango de fechas y OP sin fecha ideal
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT [# Documento]) AS ops,
       SUM(CASE WHEN [Fecha ideal Entrega] IS NULL THEN 1 ELSE 0 END) AS sin_fecha_ideal,
       MIN([Fecha de Creación]) AS creacion_min, MAX([Fecha de Creación]) AS creacion_max,
       MIN([Fecha ideal Entrega]) AS ideal_min, MAX([Fecha ideal Entrega]) AS ideal_max
FROM #ns;

-- 2. ¿Hay OP repetidas por las uniones?
SELECT TOP 20 [# Documento], COUNT(*) AS veces
FROM #ns GROUP BY [# Documento] HAVING COUNT(*) > 1 ORDER BY veces DESC;

-- 3. Familias y amortiguadores reales
SELECT [Familia Producción], [Amortiguador], COUNT(*) AS ops
FROM #ns GROUP BY [Familia Producción], [Amortiguador] ORDER BY [Familia Producción];

-- 4. Tipo de orden, tipo de pedido y estado
SELECT [Tipo Orden], U_TipoPedidos, [Estado Orden], COUNT(*) AS ops
FROM #ns GROUP BY [Tipo Orden], U_TipoPedidos, [Estado Orden] ORDER BY ops DESC;

-- 5. Razones de retraso
SELECT [Razón de Retrazo], COUNT(*) AS ops
FROM #ns GROUP BY [Razón de Retrazo] ORDER BY ops DESC;

-- 6. Nivel de servicio por mes, replicando el DAX (base para conciliar con Power BI)
WITH c AS (
    SELECT *,
           CASE WHEN DATEDIFF(DAY, '19000106', [Fecha de Cierre Real]) % 7 = 0  -- sábado
                THEN DATEADD(DAY, -1, [Fecha de Cierre Real]) ELSE [Fecha de Cierre Real] END AS cierre2
    FROM #ns
), e AS (
    SELECT *,
           CASE WHEN cierre2 > [Fecha ideal Entrega] THEN 'INCUMPLIÓ'
                WHEN cierre2 IS NULL AND [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 'INCUMPLIÓ'
                WHEN cierre2 IS NULL THEN ''
                ELSE 'CUMPLIÓ' END AS cumplio
    FROM c
    WHERE [Fecha ideal Entrega] IS NOT NULL
)
SELECT YEAR([Fecha ideal Entrega]) AS anio, MONTH([Fecha ideal Entrega]) AS mes,
       COUNT(*) AS total_op,
       SUM(CASE WHEN cumplio = 'CUMPLIÓ' THEN 1 ELSE 0 END) AS cumplio,
       SUM(CASE WHEN cumplio = 'INCUMPLIÓ' THEN 1 ELSE 0 END) AS incumplio,
       SUM(CASE WHEN cumplio = '' THEN 1 ELSE 0 END) AS en_curso,
       CAST(SUM(CASE WHEN cumplio = 'CUMPLIÓ' AND [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 1.0 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 1 ELSE 0 END), 0) AS decimal(9,4)) AS pct_cumplimiento
FROM e
GROUP BY YEAR([Fecha ideal Entrega]), MONTH([Fecha ideal Entrega])
ORDER BY anio, mes;

-- 7. ¿@FIR_FECHAS_PROD guarda días no laborables? (día de la semana de cada fecha del último año)
SELECT DATENAME(WEEKDAY, U_Fecha) AS dia_semana, COUNT(*) AS fechas
FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
WHERE U_Fecha >= DATEADD(YEAR, -1, GETDATE())
GROUP BY DATENAME(WEEKDAY, U_Fecha) ORDER BY fechas DESC;

-- 8. ¿Hay fechas repetidas en @FIR_FECHAS_PROD? (no necesita #ns)
--    La fórmula de la fecha ideal cuenta filas: una fecha repetida resta dos días en lugar de uno.
SELECT TOP 5 * FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD] ORDER BY U_Fecha DESC;

SELECT COUNT(*) AS filas,
       COUNT(DISTINCT CAST(U_Fecha AS date)) AS fechas_distintas,
       MIN(U_Fecha) AS fecha_min, MAX(U_Fecha) AS fecha_max
FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
WHERE U_Fecha >= DATEADD(YEAR, -1, GETDATE());

SELECT TOP 20 CAST(U_Fecha AS date) AS fecha, COUNT(*) AS veces
FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
WHERE U_Fecha >= DATEADD(YEAR, -1, GETDATE())
GROUP BY CAST(U_Fecha AS date) HAVING COUNT(*) > 1
ORDER BY fecha DESC;

-- 9. Limpieza (opcional): #ns también se borra sola al cerrar esta ventana
IF OBJECT_ID('tempdb..#ns') IS NOT NULL DROP TABLE #ns;
