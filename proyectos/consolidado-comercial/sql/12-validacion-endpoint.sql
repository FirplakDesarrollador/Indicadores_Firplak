-- Consolidado comercial SAP: cifras esperadas del endpoint GET /api/v1/consolidado-comercial (vista default).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA. Ejecutar todo el archivo (F5) en SSMS. Pestañas 1 a 3.
-- Comparar con summary.stages del endpoint llamado en el mismo momento (sin parámetros = mes en curso).

USE Planos_Symphony;
SET NOCOUNT ON;

GO

-- 1. ¿Cómo viene SubgrupoCliente en Informe_ventas para el Canal B2C? (código 106-xx o nombre)
--    El endpoint acepta los dos; si sale otro formato, el segmento de D queda en 'Otro' y el default no lo cuenta.
SELECT '1_SubgrupoD' AS Consulta,
       LTRIM(RTRIM(CONVERT(nvarchar(100), v.SubgrupoCliente))) AS SubgrupoCliente,
       LTRIM(RTRIM(CONVERT(nvarchar(100), v.GrupoCliente))) AS GrupoCliente,
       COUNT(*) AS Lineas, SUM(CONVERT(decimal(38, 6), v.ValorTotal)) AS Neto
FROM dbo.Informe_ventas v
WHERE LTRIM(RTRIM(CONVERT(nvarchar(20), v.Empresa))) = N'Firplak'
  AND v.FechaContabilizacion >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
  AND LTRIM(RTRIM(CONVERT(nvarchar(100), v.GrupoCliente))) IN
      (SELECT DISTINCT Canal FROM dbo.Informe_consolidado_comercial WHERE GrupoCodigo = 113)
GROUP BY LTRIM(RTRIM(CONVERT(nvarchar(100), v.SubgrupoCliente))), LTRIM(RTRIM(CONVERT(nvarchar(100), v.GrupoCliente)))
ORDER BY Neto DESC;

GO

-- 2. D esperada: facturación neta del mes en curso, Canal B2C, Firplak Home + Ecommerce, sin Donaciones.
SELECT '2_DEsperada' AS Consulta,
       COUNT(*) AS Lineas,
       COUNT(DISTINCT CONVERT(nvarchar(60), v.TipoDocumento) + N'|' + CONVERT(nvarchar(30), v.DocNum)) AS Documentos,
       SUM(CONVERT(decimal(38, 6), v.ValorTotal)) AS Neto
FROM dbo.Informe_ventas v
LEFT JOIN (SELECT Subgrupo, MIN(SubgrupoCodigo) AS SubgrupoCodigo
           FROM dbo.Informe_consolidado_comercial WHERE Subgrupo IS NOT NULL GROUP BY Subgrupo) sg
       ON sg.Subgrupo = LTRIM(RTRIM(CONVERT(nvarchar(100), v.SubgrupoCliente)))
WHERE LTRIM(RTRIM(CONVERT(nvarchar(20), v.Empresa))) = N'Firplak'
  AND v.FechaContabilizacion >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
  AND v.FechaContabilizacion < DATEADD(day, 1, CAST(GETDATE() AS date))
  AND LTRIM(RTRIM(CONVERT(nvarchar(100), v.GrupoCliente))) IN
      (SELECT DISTINCT Canal FROM dbo.Informe_consolidado_comercial WHERE GrupoCodigo = 113)
  AND (LTRIM(RTRIM(CONVERT(nvarchar(100), v.SubgrupoCliente))) IN (N'106-01', N'106-02')
       OR sg.SubgrupoCodigo IN (N'106-01', N'106-02'))
  AND ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(30), v.TipoVentas))), N'') <> N'Donaciones';

GO

-- 3. A, B y C esperadas (vista default) y hora de la carga.
SELECT '3_ABCEsperadas' AS Consulta, Etapa,
       COUNT(*) AS Lineas, COUNT(DISTINCT DocEntry) AS Documentos, SUM(Saldo) AS Saldo, MAX(FechaCarga) AS FechaCarga
FROM dbo.Informe_consolidado_comercial
WHERE EnDefault = 1
GROUP BY Etapa
ORDER BY Etapa;
