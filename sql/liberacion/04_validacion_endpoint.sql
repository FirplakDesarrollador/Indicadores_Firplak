/*
  BI Liberación: la misma consulta que ejecuta GET /api/v1/liberacion, para revisarla en SSMS (solo lectura).
  Generada desde reporting-api (buildReleaseQuery en src/liberacion.ts, rama bi/liberacion) el 2026-11-20.
  Ficha: llm-wiki/bi/liberacion.md (sección 4).

  Parámetros: anio=2026, mes=10, vista=detalle, page=1, pageSize=5.
  Esperado (validado contra el Power BI el 2026-11-20, antes de la carga de las 17:15):
    - Recordset 2 (totales): ok 1989, no 258, notMeasured 8, notReleased 0, total 2255.
    - Recordset 3 (diaria): días de octubre; la suma de ok y no da 1989 y 258.
    - Recordset 4 (mensual 2026): octubre 1989 / 258; agosto 1835 / 313; septiembre 1863 / 475.
    - Recordset 6 (razones): razones de las OP que no cumplen, de mayor a menor.
  Si la carga de las 17:15 ya corrió, los números pueden moverse un poco (OP nuevas o canceladas en el origen).
*/
USE [Planos_Symphony];
GO

DECLARE @year int = 2026;
DECLARE @month int = 10;
DECLARE @monthlyYear int = 2026;
DECLARE @offset int = 0;
DECLARE @pageSize int = 5;
    DECLARE @today date = CAST(GETDATE() AS date);
    DECLARE @year0 int = COALESCE(@monthlyYear, YEAR(@today));

    -- OP del periodo con su razón y su estado
    SELECT
      l.[CodigoOP] AS [orderNumber],
      l.[Tipo] AS [type],
      l.[SKU] AS [sku],
      l.[DescripcionSKU] AS [skuDescription],
      l.[Linea] AS [line],
      l.[FamiliaProduccion] AS [family],
      l.[Estado] AS [status],
      l.[FechaContabilizacion] AS [postingDate],
      l.[FechaRecomendadaLiberacion] AS [recommendedReleaseDate],
      l.[FechaRealLiberacion] AS [actualReleaseDate],
      l.[FechaPrometidaEntregaItem] AS [promisedItemDate],
      r.[RazonNormalizada] AS [reason],
      r.[Razon] AS [reasonOriginal],
      r.[Comentario] AS [reasonComment],
      CAST(COALESCE(r.[CambioFecha], 0) AS bit) AS [dateChanged],
      CASE
      WHEN r.[RazonNormalizada] = N'CUMPLE' THEN 'ok'
      WHEN r.[RazonNormalizada] = N'NO MEDIR' THEN 'noMedir'
      WHEN l.[FechaRealLiberacion] IS NULL THEN CASE WHEN l.[FechaRecomendadaLiberacion] < @today THEN 'no' ELSE 'sinLiberar' END
      WHEN l.[FechaRealLiberacion] <= l.[FechaRecomendadaLiberacion] THEN 'ok'
      ELSE 'no'
    END AS [compliance]
    INTO #ops
    FROM [Planos_Symphony].[dbo].[Informe_liberacion] AS l
    LEFT JOIN [Planos_Symphony].[dbo].[Informe_liberacion_razones] AS r ON r.[NoOrden] = l.[CodigoOP]
    WHERE l.[FechaRecomendadaLiberacion] >= DATEFROMPARTS(@year, @month, 1) AND l.[FechaRecomendadaLiberacion] < DATEADD(month, 1, DATEFROMPARTS(@year, @month, 1));

    SELECT o.[orderNumber], o.[type], o.[sku], o.[skuDescription], o.[line], o.[family], o.[status], o.[postingDate],
      o.[recommendedReleaseDate], o.[actualReleaseDate], o.[promisedItemDate], o.[compliance], o.[reason], o.[reasonOriginal],
      o.[reasonComment], o.[dateChanged],
      ROW_NUMBER() OVER (ORDER BY o.[recommendedReleaseDate] DESC, o.[orderNumber] DESC) AS [rowNumber]
    INTO #rows
    FROM #ops AS o
    WHERE 1 = 1;

    -- 0: página del detalle
    SELECT [orderNumber], [type], [sku], [skuDescription], [line], [family], [status], [postingDate],
      [recommendedReleaseDate], [actualReleaseDate], [promisedItemDate], [compliance], [reason], [reasonOriginal],
      [reasonComment], [dateChanged]
    FROM #rows
    WHERE [rowNumber] > @offset AND [rowNumber] <= (@offset + @pageSize)
    ORDER BY [rowNumber];

    -- 1: total de filas del detalle
    SELECT COUNT_BIG(1) AS [total] FROM #rows;

    -- 2: totales del periodo (sin vista, cumplimiento, razón ni búsqueda)
    SELECT
      COUNT_BIG(1) AS [total],
      SUM(CASE WHEN [compliance] = 'ok' THEN 1 ELSE 0 END) AS [ok],
      SUM(CASE WHEN [compliance] = 'no' THEN 1 ELSE 0 END) AS [no],
      SUM(CASE WHEN [compliance] = 'sinLiberar' THEN 1 ELSE 0 END) AS [notReleased],
      SUM(CASE WHEN [compliance] = 'noMedir' THEN 1 ELSE 0 END) AS [notMeasured],
      SUM(CASE WHEN [compliance] = 'no' AND [reason] IS NULL THEN 1 ELSE 0 END) AS [withoutReason]
    FROM #ops;

    -- 3: serie diaria por fecha recomendada (solo días con OP medidas)
    SELECT [recommendedReleaseDate] AS [date],
      SUM(CASE WHEN [compliance] = 'ok' THEN 1 ELSE 0 END) AS [ok],
      SUM(CASE WHEN [compliance] = 'no' THEN 1 ELSE 0 END) AS [no]
    FROM #ops
    WHERE [compliance] IN ('ok', 'no')
    GROUP BY [recommendedReleaseDate]
    ORDER BY [recommendedReleaseDate];

    -- 4: serie mensual del año completo (sin mes, día ni rango); los 12 meses
    SELECT @year0 AS [year], m.[month], COALESCE(x.[ok], 0) AS [ok], COALESCE(x.[no], 0) AS [no]
    FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)) AS m([month])
    LEFT JOIN (
      SELECT MONTH(y.[date]) AS [month],
        SUM(CASE WHEN y.[compliance] = 'ok' THEN 1 ELSE 0 END) AS [ok],
        SUM(CASE WHEN y.[compliance] = 'no' THEN 1 ELSE 0 END) AS [no]
      FROM (
        SELECT l.[FechaRecomendadaLiberacion] AS [date], CASE
      WHEN r.[RazonNormalizada] = N'CUMPLE' THEN 'ok'
      WHEN r.[RazonNormalizada] = N'NO MEDIR' THEN 'noMedir'
      WHEN l.[FechaRealLiberacion] IS NULL THEN CASE WHEN l.[FechaRecomendadaLiberacion] < @today THEN 'no' ELSE 'sinLiberar' END
      WHEN l.[FechaRealLiberacion] <= l.[FechaRecomendadaLiberacion] THEN 'ok'
      ELSE 'no'
    END AS [compliance]
        FROM [Planos_Symphony].[dbo].[Informe_liberacion] AS l
        LEFT JOIN [Planos_Symphony].[dbo].[Informe_liberacion_razones] AS r ON r.[NoOrden] = l.[CodigoOP]
        WHERE l.[FechaRecomendadaLiberacion] >= DATEFROMPARTS(@year0, 1, 1)
          AND l.[FechaRecomendadaLiberacion] < DATEFROMPARTS(@year0 + 1, 1, 1)
      ) AS y
      GROUP BY MONTH(y.[date])
    ) AS x ON x.[month] = m.[month]
    ORDER BY m.[month];

    -- 5: serie anual de toda la tabla (sin filtros de periodo)
    SELECT YEAR(y.[date]) AS [year],
      SUM(CASE WHEN y.[compliance] = 'ok' THEN 1 ELSE 0 END) AS [ok],
      SUM(CASE WHEN y.[compliance] = 'no' THEN 1 ELSE 0 END) AS [no]
    FROM (
      SELECT l.[FechaRecomendadaLiberacion] AS [date], CASE
      WHEN r.[RazonNormalizada] = N'CUMPLE' THEN 'ok'
      WHEN r.[RazonNormalizada] = N'NO MEDIR' THEN 'noMedir'
      WHEN l.[FechaRealLiberacion] IS NULL THEN CASE WHEN l.[FechaRecomendadaLiberacion] < @today THEN 'no' ELSE 'sinLiberar' END
      WHEN l.[FechaRealLiberacion] <= l.[FechaRecomendadaLiberacion] THEN 'ok'
      ELSE 'no'
    END AS [compliance]
      FROM [Planos_Symphony].[dbo].[Informe_liberacion] AS l
      LEFT JOIN [Planos_Symphony].[dbo].[Informe_liberacion_razones] AS r ON r.[NoOrden] = l.[CodigoOP]
    ) AS y
    GROUP BY YEAR(y.[date])
    ORDER BY [year];

    -- 6: razones de las OP que no cumplen (cascada "% RAZONES INCUMPLIMIENTO")
    SELECT [reason] AS [name], COUNT_BIG(1) AS [orders]
    FROM #ops
    WHERE [compliance] = 'no' AND [reason] IS NOT NULL
    GROUP BY [reason]
    ORDER BY [orders] DESC, [name];

    -- 7: años con fecha recomendada
    SELECT DISTINCT YEAR(l.[FechaRecomendadaLiberacion]) AS [year]
    FROM [Planos_Symphony].[dbo].[Informe_liberacion] AS l
    ORDER BY [year] DESC;

    -- 8: catálogo de razones del periodo
    SELECT DISTINCT [reason] AS [value]
    FROM #ops
    WHERE [reason] IS NOT NULL
    ORDER BY [value];

    -- 9: última carga de OP y última llegada de razones, con el desfase del servidor
    SELECT
      (SELECT CONVERT(varchar(33), TODATETIMEOFFSET(MAX(l.[UltimaCarga]), DATEPART(TZOFFSET, SYSDATETIMEOFFSET())), 126) FROM [Planos_Symphony].[dbo].[Informe_liberacion] AS l) AS [loadedAt],
      (SELECT CONVERT(varchar(33), TODATETIMEOFFSET(MAX(r.[Sincronizado]), DATEPART(TZOFFSET, SYSDATETIMEOFFSET())), 126) FROM [Planos_Symphony].[dbo].[Informe_liberacion_razones] AS r) AS [reasonsSyncedAt];

    DROP TABLE #rows;
    DROP TABLE #ops;
  