/*
  BI Liberación: conciliación con el Power BI (fase 6). Solo lectura.
  Ficha: llm-wiki/bi/liberacion.md (sección 6).

  Explica cada cifra del portal con la misma regla del endpoint GET /api/v1/liberacion:
    estado = CUMPLE / NO MEDIR de Planeación primero; si no, fecha real frente a la recomendada.
    % = OK / (OK + NO). Periodo por FechaRecomendadaLiberacion.

  Cómo comparar:
    1. Actualizar el Power BI y ejecutar este script el mismo día, ANTES de las 17:00 (a esa hora el SP de
       origen recarga Indicador_Liberacion y a las 17:15 se copia al portal). Así los dos usan las mismas OP.
    2. Las razones del Power BI salen del Excel; las del portal, de Supabase, que hoy se carga desde ese
       mismo Excel. Si alguien editó el Excel después de la última carga a Supabase, habrá diferencias:
       la consulta 5 las ubica.
    3. Una diferencia mayor a una unidad de redondeo es un hallazgo: anotar la causa en la ficha.

  Meses de la conciliación: septiembre y octubre de 2026 (cerrados) y noviembre de 2026 (mes en curso).
  Para otro mes, cambiar @Desde y @Hasta.
*/

USE [Planos_Symphony];
GO

DECLARE @Desde date = '20260901';
DECLARE @Hasta date = '20261201';   -- Exclusivo
DECLARE @Hoy date = CAST(GETDATE() AS date);

IF OBJECT_ID('tempdb..#Estado') IS NOT NULL DROP TABLE #Estado;

SELECT
    l.CodigoOP,
    l.FechaRecomendadaLiberacion,
    YEAR(l.FechaRecomendadaLiberacion) AS Anio,
    MONTH(l.FechaRecomendadaLiberacion) AS Mes,
    l.FechaRealLiberacion,
    r.RazonNormalizada,
    r.Razon,
    CASE
        WHEN r.RazonNormalizada = N'CUMPLE' THEN 'OK'
        WHEN r.RazonNormalizada = N'NO MEDIR' THEN 'NO MEDIR'
        WHEN l.FechaRealLiberacion IS NULL THEN CASE WHEN l.FechaRecomendadaLiberacion < @Hoy THEN 'NO' ELSE 'SIN LIBERAR' END
        WHEN l.FechaRealLiberacion <= l.FechaRecomendadaLiberacion THEN 'OK'
        ELSE 'NO'
    END AS Estado
INTO #Estado
FROM dbo.Informe_liberacion l
LEFT JOIN dbo.Informe_liberacion_razones r ON r.NoOrden = l.CodigoOP
WHERE l.FechaRecomendadaLiberacion >= @Desde AND l.FechaRecomendadaLiberacion < @Hasta;

-- 1. Página "Cumplimiento Liberación" / "Acum": % del mes y conteos por estado.
--    Comparar el % con la columna del mes en "Acum Cumplimiento Liberación" (nivel mes).
SELECT Anio, Mes,
       SUM(CASE WHEN Estado = 'OK' THEN 1 ELSE 0 END) AS OK,
       SUM(CASE WHEN Estado = 'NO' THEN 1 ELSE 0 END) AS NO,
       SUM(CASE WHEN Estado = 'NO MEDIR' THEN 1 ELSE 0 END) AS NoMedir,
       SUM(CASE WHEN Estado = 'SIN LIBERAR' THEN 1 ELSE 0 END) AS SinLiberar,
       CAST(100.0 * SUM(CASE WHEN Estado = 'OK' THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN Estado IN ('OK', 'NO') THEN 1 ELSE 0 END), 0) AS decimal(5, 2)) AS PctCumplimiento
FROM #Estado
GROUP BY Anio, Mes
ORDER BY Anio, Mes;

-- 2. Página "Cumplimiento Liberación": % por día. Comparar tres o cuatro días de cada mes.
SELECT FechaRecomendadaLiberacion AS Fecha,
       SUM(CASE WHEN Estado = 'OK' THEN 1 ELSE 0 END) AS OK,
       SUM(CASE WHEN Estado = 'NO' THEN 1 ELSE 0 END) AS NO,
       CAST(100.0 * SUM(CASE WHEN Estado = 'OK' THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN Estado IN ('OK', 'NO') THEN 1 ELSE 0 END), 0) AS decimal(5, 2)) AS PctCumplimiento
FROM #Estado
WHERE Estado IN ('OK', 'NO')
GROUP BY FechaRecomendadaLiberacion
ORDER BY FechaRecomendadaLiberacion;

-- 3. Páginas "Razones" y "Razones Día": Pareto por mes (razones de las OP que no cumplen).
--    El Power BI agrupa por el texto tal cual (Razon); el portal, por la razón normalizada
--    (decisión A del contrato). Si una barra difiere, comparar las dos columnas.
SELECT Anio, Mes, RazonNormalizada, COUNT_BIG(1) AS Ordenes,
       CAST(100.0 * COUNT_BIG(1) / SUM(COUNT_BIG(1)) OVER (PARTITION BY Anio, Mes) AS decimal(5, 1)) AS PctDelMes,
       COUNT(DISTINCT Razon) AS VariantesDelTexto
FROM #Estado
WHERE Estado = 'NO' AND RazonNormalizada IS NOT NULL
GROUP BY Anio, Mes, RazonNormalizada
ORDER BY Anio, Mes, Ordenes DESC;

-- 4. Página "Control": OP que no cumplen y no tienen razón, por mes.
SELECT Anio, Mes, COUNT_BIG(1) AS OpSinRazon
FROM #Estado
WHERE Estado = 'NO' AND RazonNormalizada IS NULL
GROUP BY Anio, Mes
ORDER BY Anio, Mes;

-- 5. Para ubicar diferencias: el estado de cada OP de un día. Comparar con la tabla de "Control" o con
--    un visual de tabla en el Power BI con Código OP y Cumplimiento filtrado al mismo día.
-- SELECT CodigoOP, FechaRecomendadaLiberacion, FechaRealLiberacion, Razon, RazonNormalizada, Estado
-- FROM #Estado
-- WHERE FechaRecomendadaLiberacion = '20261028'
-- ORDER BY Estado, CodigoOP;

DROP TABLE #Estado;
