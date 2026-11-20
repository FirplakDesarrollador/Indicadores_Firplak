-- Consultas previas a la fase 2 del BI NS Plantas (llm-wiki/bi/ns-plantas.md, sección 2).
-- Servidor Itplakinfo. Solo lectura sobre Firplak_SA: lo único que se crea es la tabla
-- temporal de sesión #base, que se borra al cerrar la ventana.
-- Ejecutar todo el archivo en la MISMA ventana de consulta (F5).

-- 0. OP que cumplen los filtros del BI, SIN la ventana de 12 meses (historia completa)
IF OBJECT_ID('tempdb..#base') IS NOT NULL DROP TABLE #base;

SELECT
    T0.DocEntry,
    T0.DocNum,
    T0.CreateDate,
    T0.RlsDate,
    T0.CloseDate,
    T0.UpdateDate,
    T0.Status,
    T0.U_U_Razonderetraso
INTO #base
FROM [Firplak_SA].[dbo].[OWOR] T0
    INNER JOIN [Firplak_SA].[dbo].[OITM] T1 ON T0.ItemCode = T1.ItemCode
    INNER JOIN [Firplak_SA].[dbo].[ORDR] T2 ON T0.OriginNum = T2.DocNum
    INNER JOIN [Firplak_SA].[dbo].[@FIR_FAM_SYMPH] T3 ON T1.U_Familia = T3.U_FIR_FAM_MAES
        AND T3.U_FIR_TIPO_PED = T2.U_TipoPedidos
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] T4 ON T3.U_FIR_FAM = T4.Name
    COLLATE SQL_Latin1_General_CP1_CI_AS
WHERE T0.RlsDate IS NOT NULL
    AND T0.Status NOT IN ('C', 'P')
    AND T0.U_NumLote <> ''
    AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08');

-- 1. Volumen de la historia por año de creación
SELECT YEAR(CreateDate) AS anio,
       COUNT(*) AS filas,
       COUNT(DISTINCT DocEntry) AS ops,
       MIN(RlsDate) AS liberacion_min, MAX(RlsDate) AS liberacion_max
FROM #base
GROUP BY YEAR(CreateDate)
ORDER BY anio;

-- 2. ¿DocEntry y DocNum son únicos en toda la historia?
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT DocEntry) AS docentry_distintos,
       COUNT(DISTINCT DocNum) AS docnum_distintos
FROM #base;

-- 3. Cobertura del calendario de días no laborables por año
--    Un año completo tiene unos 104 sábados y domingos; si un año trae muchos menos, falta cargarlo.
SELECT YEAR(U_Fecha) AS anio,
       COUNT(*) AS fechas,
       SUM(CASE WHEN DATEDIFF(DAY, '19000106', U_Fecha) % 7 IN (0, 1) THEN 1 ELSE 0 END) AS sabados_domingos,
       SUM(CASE WHEN DATEDIFF(DAY, '19000106', U_Fecha) % 7 NOT IN (0, 1) THEN 1 ELSE 0 END) AS entre_semana
FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
GROUP BY YEAR(U_Fecha)
ORDER BY anio;

-- 4. ¿UpdateDate se mueve cuando se cierra la OP o se registra la razón de retraso?
SELECT Status,
       COUNT(*) AS ops,
       SUM(CASE WHEN CloseDate IS NOT NULL AND UpdateDate >= CloseDate THEN 1 ELSE 0 END) AS actualizada_al_cerrar_o_despues,
       SUM(CASE WHEN U_U_Razonderetraso IS NOT NULL THEN 1 ELSE 0 END) AS con_razon,
       SUM(CASE WHEN U_U_Razonderetraso IS NOT NULL AND CloseDate IS NOT NULL AND UpdateDate >= CloseDate THEN 1 ELSE 0 END) AS con_razon_actualizada_al_cerrar_o_despues,
       MAX(UpdateDate) AS ultima_actualizacion
FROM #base
GROUP BY Status;

-- 5. Calendario de Colombia vs. @FIR_FECHAS_PROD
--    Decisión del 2026-11-18: los días no laborables salen del calendario de Colombia
--    (sábados, domingos y festivos de ley) y no de @FIR_FECHAS_PROD. Esta consulta compara
--    los dos en el rango que cubre @FIR_FECHAS_PROD, para ver si la tabla de SAP trae días
--    propios de Firplak (p. ej. cierres de fin de año) que el calendario de ley no tiene.
IF OBJECT_ID('tempdb..#festivos') IS NOT NULL DROP TABLE #festivos;

WITH anios AS (
    SELECT YEAR(MIN(U_Fecha)) AS anio, YEAR(MAX(U_Fecha)) AS anio_max
    FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
    UNION ALL
    SELECT anio + 1, anio_max FROM anios WHERE anio < anio_max
),
pascua AS (   -- Domingo de Pascua (algoritmo de Gauss/Meeus para el calendario gregoriano)
    SELECT a.anio,
           DATEFROMPARTS(a.anio, (x.h + x.l - 7 * x.m + 114) / 31, ((x.h + x.l - 7 * x.m + 114) % 31) + 1) AS domingo
    FROM anios a
    CROSS APPLY (SELECT a.anio % 19 AS g, a.anio / 100 AS b, a.anio % 100 AS c) p
    CROSS APPLY (SELECT p.b / 4 AS d, p.b % 4 AS e, (p.b + 8) / 25 AS f, p.c / 4 AS i, p.c % 4 AS k) q
    CROSS APPLY (SELECT (19 * p.g + p.b - q.d - (p.b - q.f + 1) / 3 + 15) % 30 AS h) r
    CROSS APPLY (SELECT r.h, (32 + 2 * q.e + 2 * q.i - r.h - q.k) % 7 AS l) s
    CROSS APPLY (SELECT s.h, s.l, (p.g + 11 * s.h + 22 * s.l) / 451 AS m) x
),
base AS (     -- fecha original y si la ley la corre al lunes siguiente (Ley 51 de 1983)
    SELECT DATEFROMPARTS(a.anio, f.mes, f.dia) AS fecha, f.al_lunes, f.nombre
    FROM anios a
    CROSS JOIN (VALUES
        (1, 1, 0, N'Año Nuevo'), (1, 6, 1, N'Reyes Magos'), (3, 19, 1, N'San José'),
        (5, 1, 0, N'Día del Trabajo'), (6, 29, 1, N'San Pedro y San Pablo'),
        (7, 20, 0, N'Independencia'), (8, 7, 0, N'Batalla de Boyacá'), (8, 15, 1, N'Asunción'),
        (10, 12, 1, N'Día de la Raza'), (11, 1, 1, N'Todos los Santos'),
        (11, 11, 1, N'Independencia de Cartagena'), (12, 8, 0, N'Inmaculada Concepción'),
        (12, 25, 0, N'Navidad')) f(mes, dia, al_lunes, nombre)
    UNION ALL
    SELECT DATEADD(DAY, e.dias, p.domingo), 0, e.nombre
    FROM pascua p
    CROSS JOIN (VALUES
        (-3, N'Jueves Santo'), (-2, N'Viernes Santo'),
        (43, N'Ascensión'), (64, N'Corpus Christi'), (71, N'Sagrado Corazón')) e(dias, nombre)
)
SELECT CASE WHEN al_lunes = 1   -- 1900-01-01 fue lunes: % 7 = 0 es lunes
            THEN DATEADD(DAY, (7 - DATEDIFF(DAY, '19000101', fecha) % 7) % 7, fecha)
            ELSE fecha END AS fecha,
       nombre
INTO #festivos
FROM base
OPTION (MAXRECURSION 200);

WITH rango AS (
    SELECT CAST(MIN(U_Fecha) AS date) AS desde, CAST(MAX(U_Fecha) AS date) AS hasta
    FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
),
dias AS (
    SELECT desde AS fecha, hasta FROM rango
    UNION ALL
    SELECT DATEADD(DAY, 1, fecha), hasta FROM dias WHERE fecha < hasta
),
colombia AS (
    SELECT d.fecha,
           COALESCE(f.nombre, CASE DATEDIFF(DAY, '19000101', d.fecha) % 7 WHEN 5 THEN N'Sábado' ELSE N'Domingo' END) AS motivo
    FROM dias d
    LEFT JOIN #festivos f ON f.fecha = d.fecha
    WHERE f.fecha IS NOT NULL OR DATEDIFF(DAY, '19000101', d.fecha) % 7 IN (5, 6)
),
sap AS (
    SELECT DISTINCT CAST(U_Fecha AS date) AS fecha FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
)
SELECT COALESCE(c.fecha, s.fecha) AS fecha,
       DATENAME(WEEKDAY, COALESCE(c.fecha, s.fecha)) AS dia_semana,
       CASE WHEN c.fecha IS NULL THEN 'Solo en SAP (día propio de Firplak)'
            ELSE 'Solo en el calendario de Colombia' END AS diferencia,
       c.motivo
FROM colombia c
FULL JOIN sap s ON s.fecha = c.fecha
WHERE c.fecha IS NULL OR s.fecha IS NULL
ORDER BY 1
OPTION (MAXRECURSION 0);

-- 6. Limpieza (opcional): las tablas temporales también se borran solas al cerrar esta ventana
IF OBJECT_ID('tempdb..#base') IS NOT NULL DROP TABLE #base;
IF OBJECT_ID('tempdb..#festivos') IS NOT NULL DROP TABLE #festivos;
