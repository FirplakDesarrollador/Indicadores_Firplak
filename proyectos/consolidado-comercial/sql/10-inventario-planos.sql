-- Consolidado comercial SAP: ¿ya existe en Planos_Symphony algo de ofertas, OV o tránsito?
-- Revisa el catálogo antes de crear la tabla de reporte y su SP (decisión 4).
-- Ficha: llm-wiki/proyectos/consolidado-comercial.md
--
-- Servidor ITPLAKINFO. SOLO LECTURA (solo consulta vistas del sistema). Ejecutar todo el
-- archivo (F5) en SSMS; cada consulta va en su propio lote (GO). Pestañas 1 a 5.

USE Planos_Symphony;
SET NOCOUNT ON;

GO

-- 1. Todas las tablas, vistas y procedimientos de la base, con filas y fechas.
SELECT '1_Objetos' AS Consulta, o.type_desc AS Tipo, s.name AS Esquema, o.name AS Objeto,
       (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = o.object_id AND p.index_id IN (0, 1)) AS Filas,
       o.create_date AS Creado, o.modify_date AS Modificado
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U', 'V', 'P', 'FN', 'IF', 'TF')
ORDER BY o.type_desc, o.name;

GO

-- 2. Vistas, procedimientos y funciones cuyo código lee ofertas, OV o entregas de SAP.
SELECT '2_CodigoQueLeeSAP' AS Consulta, o.type_desc AS Tipo, o.name AS Objeto, o.modify_date AS Modificado,
       CASE WHEN m.definition LIKE '%OQUT%' OR m.definition LIKE '%QUT1%' THEN 'Si' ELSE '' END AS Ofertas,
       CASE WHEN m.definition LIKE '%ORDR%' OR m.definition LIKE '%RDR1%' THEN 'Si' ELSE '' END AS OV,
       CASE WHEN m.definition LIKE '%ODLN%' OR m.definition LIKE '%DLN1%' THEN 'Si' ELSE '' END AS Entregas,
       CASE WHEN m.definition LIKE '%OINV%' OR m.definition LIKE '%INV1%' THEN 'Si' ELSE '' END AS Facturas,
       CASE WHEN m.definition LIKE '%U_StatusEntrega%' OR m.definition LIKE '%U_FechaRadFAC%' THEN 'Si' ELSE '' END AS CamposTransito
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%OQUT%' OR m.definition LIKE '%QUT1%'
   OR m.definition LIKE '%ORDR%' OR m.definition LIKE '%RDR1%'
   OR m.definition LIKE '%ODLN%' OR m.definition LIKE '%DLN1%'
ORDER BY o.type_desc, o.name;

GO

-- 3. Objetos con nombres relacionados con el proyecto.
SELECT '3_NombresRelacionados' AS Consulta, o.type_desc AS Tipo, o.name AS Objeto, o.modify_date AS Modificado
FROM sys.objects o
WHERE o.type IN ('U', 'V', 'P')
  AND (o.name LIKE '%ofert%' OR o.name LIKE '%cotiz%' OR o.name LIKE '%orden%' OR o.name LIKE '%pedido%'
    OR o.name LIKE '%visor%' OR o.name LIKE '%transit%' OR o.name LIKE '%entrega%' OR o.name LIKE '%despach%'
    OR o.name LIKE '%consolid%' OR o.name LIKE '%comercial%' OR o.name LIKE '%embudo%' OR o.name LIKE '%pendiente%')
ORDER BY o.name;

GO

-- 4. Columnas de Informe_entregas (ya existe y la usa la API): ¿sirve para C?
SELECT '4_ColumnasInformeEntregas' AS Consulta, c.column_id, c.name AS Columna, t.name AS TipoDato, c.max_length
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.system_type_id AND t.user_type_id = t.system_type_id
WHERE c.object_id = OBJECT_ID('dbo.Informe_entregas')
ORDER BY c.column_id;

GO

-- 5. Jobs del Agente SQL que tocan Planos_Symphony (puede fallar por permisos en msdb; ignorar si falla).
SELECT '5_Jobs' AS Consulta, j.name AS Job, j.enabled AS Habilitado, s.step_id, s.step_name, s.database_name,
       LEFT(s.command, 300) AS Comando
FROM msdb.dbo.sysjobs j
JOIN msdb.dbo.sysjobsteps s ON s.job_id = j.job_id
WHERE s.database_name = 'Planos_Symphony' OR s.command LIKE '%Planos_Symphony%'
ORDER BY j.name, s.step_id;
