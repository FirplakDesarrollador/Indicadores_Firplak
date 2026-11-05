---
status: en-migracion
fase: 1
updated: 2026-11-04
sources:
  - ../../bi-origen/bi-liberacion/
---

# BI: Liberación

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `PBI liberacion act` ([proyecto .pbip](../../bi-origen/bi-liberacion/PBI%20liberacion%20act.pbip)) |
| Dueño de negocio (valida las cifras) | Logística |
| Desarrollador responsable | Milton Rendón |
| Usuarios y frecuencia de uso | Kevin Julian Hernandez Ramos (`practiplaneacion@firplak.com`), Logística; uso diario |
| Prioridad | Media |
| Rama | `bi/liberacion` (en este repositorio y en `reporting-api`) |

## 1. Análisis

Analizado el 2026-11-03 a partir del proyecto [`PBI liberacion act.pbip`](../../bi-origen/bi-liberacion/PBI%20liberacion%20act.pbip): modelo en [`definition/tables/`](../../bi-origen/bi-liberacion/PBI%20liberacion%20act.SemanticModel/definition/tables/) y visuales en [`definition/pages/`](../../bi-origen/bi-liberacion/PBI%20liberacion%20act.Report/definition/pages/). Sin validación con datos todavía: ver [Consultas de validación](#consultas-de-validación-para-el-desarrollador).

El BI mide si las órdenes de producción (OP) se **liberan a tiempo**: compara la fecha real de liberación con la fecha recomendada y deja que Planeación corrija o justifique cada caso desde un Excel en SharePoint.

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|
| `BD` | `Sql.Database` (import) | Servidor `ITPLAKINFO`, base `Planos_Symphony`: `dbo.Indicador_Liberacion` | Tabla (`USER_TABLE`) creada el 2025-10-07. La escriben los SP `dbo.FPK_INDICADOR_LIBERACION` y `dbo.FPK_INDICADOR_LIBERACION_OPTIMIZADO`, y la menciona el job `Actualizacion Indicador Liberacion.Subplán_1` (plan de mantenimiento). Confirmado: **una fila por `Código OP`** (30 323 filas y 30 323 OP). **Las 23 columnas son `nvarchar`**, incluidas fechas y cantidades. `pendiente`: qué SP ejecuta el job y con qué horario. |
| `RazonesIncumplimiento` | `SharePoint.Files` + `Excel.Workbook` (import) | Sitio `https://firplaksa.sharepoint.com/sites/LOGSTICASEGUIMIENTO`, carpeta `Shared Documents/07. PLANEACIÓN DE PXN Y ABASTECIMIENTO PTC/1. PLANEACIÓN DE PRODUCCIÓN/`, archivo `Razones incumplimiento lib.xlsx`, tabla de Excel `Obs_Plan` | **Riesgo: no es SQL Server.** Lo diligencia Planeación a mano. Columnas: `No Orden`, `OBSERVACIONES PLANEACIÓN`, `COMENTARIOS`, `FECHA` (texto). |
| `Calendario` | Tabla calculada DAX | `CALENDAR(MIN(BD[Fecha Recomendada de Liberación]), DATE(2026,12,31))` | **Termina el 2026-12-31, fijo en el código.** Desde 2027 los segmentadores no tendrán fechas nuevas. Columnas `Mes_Num`, `Año`, `Mes_Text`. No se migra: la API arma años y meses. |
| `Medidas` | Tabla escrita a mano vacía | — | Solo contiene las medidas. |
| `LocalDateTable_*`, `DateTableTemplate_*` | Automáticas de Power BI | — | Jerarquía Año/Trimestre/Mes/Día de las fechas. No se migran. |

`expressions.tmdl` solo tiene 10 consultas "Errores en …" que Power BI crea cuando falla una carga (2022-03-23, 2022-04-04 ×2, 2024-02-05 ×2, 2025-09-16, 2025-10-07 ×2, 2025-10-08 y 2025-11-24). Nueve son del Excel de razones: sus columnas cambiaron varias veces (`Columna1`, `Columna2`, `COMENTARIOS`, `FECHA`). Además, la consulta `RazonesIncumplimiento` está marcada `PBI_ResultType = Exception`: su última evaluación en Power BI Desktop falló. No se migran, pero confirman que **el Excel es la parte frágil** del BI.

<details><summary>SQL original de <code>BD</code></summary>

```sql
Select * from Planos_Symphony.dbo.Indicador_Liberacion
```

</details>

<details><summary>Power Query de <code>RazonesIncumplimiento</code></summary>

```text
Origen       = SharePoint.Files("https://firplaksa.sharepoint.com/sites/LOGSTICASEGUIMIENTO", [ApiVersion = 15])
Filas ordenadas = ordena por Name descendente
Archivo      = fila con Name = "Razones incumplimiento lib.xlsx" y la carpeta "…/07. PLANEACIÓN DE PXN Y ABASTECIMIENTO PTC/1. PLANEACIÓN DE PRODUCCIÓN/"
Libro        = Excel.Workbook(Archivo)
Obs_Plan_Table = tabla de Excel "Obs_Plan"
```

</details>

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|
| `BD` | `Tipo cambiado` | Convierte a fecha (sin hora) las 7 fechas; a entero `Cantidad Total`, `Cantidad Pendiente`, `Cantidad Total Item` y `Cantidad Pendiente Item`; a moneda `Costo Unitario` | Sí: columnas `date` e `int` en la tabla. Las fechas se comparan **sin hora** |
| `RazonesIncumplimiento` | Lectura del Excel | Toma la tabla `Obs_Plan` sin filtros ni limpieza | Depende de la decisión sobre el Excel (pregunta 1) |

Columnas calculadas DAX (lógica por fila):

| Tabla | Columna | DAX original |
|---|---|---|
| `BD` | `Cumplimiento` | `if(CALCULATE(COUNT(RazonesIncumplimiento[No Orden]),RazonesIncumplimiento[OBSERVACIONES PLANEACIÓN]="CUMPLE")>0,"OK",IF(CALCULATE(COUNT(RazonesIncumplimiento[No Orden]),RazonesIncumplimiento[OBSERVACIONES PLANEACIÓN]="NO MEDIR")>0,"NO MEDIR",if(ISBLANK(BD[Fecha Real de Liberación]),IF(BD[Fecha Recomendada de Liberación]<TODAY(),"NO","SIN LIBERAR"),IF(BD[Fecha Real de Liberación]<=BD[Fecha Recomendada de Liberación],"OK","NO"))))` |

La regla de `Cumplimiento`, en orden de prioridad, para cada OP:

1. Si Planeación registró la OP en el Excel con observación **`CUMPLE`** → **OK** (aunque las fechas digan otra cosa).
2. Si no, y la registró con **`NO MEDIR`** → **NO MEDIR** (queda fuera del indicador).
3. Si no tiene fecha real de liberación:
   - fecha recomendada **anterior a hoy** → **NO** (vencida sin liberar);
   - fecha recomendada hoy o futura → **SIN LIBERAR**.
4. Si tiene fecha real: **OK** si es igual o anterior a la recomendada; **NO** si es posterior.

`TODAY()` en una columna calculada se evalúa **al actualizar** el modelo, no al abrir el informe: una OP pasa de SIN LIBERAR a NO solo después de la siguiente actualización.

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `BD[Fecha Recomendada de Liberación]` | `Calendario[Fecha]` | Muchos a uno | Única (el calendario filtra `BD`) |
| `RazonesIncumplimiento[No Orden]` | `BD[Código OP]` | Muchos a uno | Única (`BD` filtra las razones) |
| Las otras 6 fechas de `BD` y `Calendario[Fecha]` | `LocalDateTable_*` | Automáticas | — |

- Todos los segmentadores de fecha usan `Calendario`, así que **el periodo del informe es la `Fecha Recomendada de Liberación`**.
- Una OP puede tener **varias filas** de razones en el Excel; `BD` debe tener una sola fila por OP.
- `No Orden` es numérico (`double`) y `Código OP` es texto (`nvarchar(100)` en SQL). Todos los `Código OP` actuales son numéricos (consulta 3), así que la tabla de reporte puede guardarlo como entero y cruzarlo con las razones sin conversiones implícitas.

### Indicadores (medidas DAX)

| Indicador | Regla de negocio | DAX original | Vivirá en (SP / summary API / frontend) |
|---|---|---|---|
| `Cumplimiento` (estado de cada OP) | OK, NO, SIN LIBERAR o NO MEDIR según la regla anterior | Columna calculada `BD[Cumplimiento]` | En SQL. Como depende de la fecha de hoy y de las razones, se calcula en la consulta de la API o en la carga frecuente del SP (decisión de la fase 2) |
| Cumplimiento (conteo) | Número de OP en cada estado | `COUNT(BD[Cumplimiento])` | Summary API (`COUNT` por estado) |
| TotalCumplimiento | OP medidas en la selección actual | `CALCULATE(COUNTA(BD[Cumplimiento]), ALLSELECTED())` | Summary API |
| **% Cumplimiento** (indicador principal) | OP liberadas a tiempo entre las OP medidas: `OK / (OK + NO)`. Los gráficos filtran solo OK y NO, así que SIN LIBERAR y NO MEDIR quedan fuera | `DIVIDE([Cumplimiento],[TotalCumplimiento])` | Summary API, por día y acumulado por año/trimestre/mes |
| TOTAL_RAZONES | Filas de razones en el Excel | `COUNTROWS(RazonesIncumplimiento)` | Summary API |
| % razones de incumplimiento | Peso de cada razón entre todas las razones de las OP con estado NO en el periodo | Visual: `TOTAL_RAZONES / TOTAL_RAZONES` sin agrupar (porcentaje del total general) | Summary API |
| Tiene razón | Si la OP tiene al menos una fila en el Excel | `IF(COUNT(RazonesIncumplimiento[No Orden])>0,"OK", "NO")` | En SQL (`EXISTS`), para la lista de control |

Medidas sin uso en visuales (no migrar, confirmar):

- Ninguna medida sin uso. Columna `Medidas[Columna1]`: relleno de la tabla, no se migra.
- Columnas cargadas que ningún visual usa: `SKU`, `Destino`, `Fecha Prometida de Entrega`, `Familia de Producción`, `Cantidad Total`, `Cantidad Pendiente`, `Fecha de Actualización`, `Num. Lote`, `Estado`, `Cantidad Total Item`, `Cantidad Pendiente Item`, `Fecha Recomendada de Entrega`, `Color Recomendado`, `Costo Unitario`, `Planta`, y del Excel `COMENTARIOS` y `FECHA`.

### Visuales y filtros

El informe no tiene filtros de informe ni de página. Las 5 páginas tienen el mismo segmentador de fecha (Año › Mes › Día sobre `Calendario`).

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|
| Cumplimiento Liberación | Columnas 100 % apiladas "Indicador de Liberación" | % Cumplimiento | Eje: `Calendario[Fecha]` (día). Serie: `Cumplimiento`. Filtro del visual: `Cumplimiento` en OK o NO |
| Acum Cumplimiento Liberación | Columnas 100 % apiladas "Indicador de Liberación" | % Cumplimiento | Eje con jerarquía Año › Trimestre › Mes › Día (se puede profundizar). Serie: `Cumplimiento`. Mismo filtro OK/NO |
| Razones | Cascada "% RAZONES INCUMPLIMIENTO" | % razones (TOTAL_RAZONES / total) | `OBSERVACIONES PLANEACIÓN`, de mayor a menor. Filtro del visual: `Cumplimiento = NO` |
| Razones | Botón "Atrás" | — | — |
| Razones Día | Cascada "% RAZONES INCUMPLIMIENTO" | Igual a la de Razones | Igual a la de Razones |
| Razones Día | Tabla | — | `Código OP`, `Descripción de SKU`, `OBSERVACIONES PLANEACIÓN`, `Fecha Recomendada de Liberación`, `Tipo`. Filtro: observación distinta de `CUMPLE` (incluye `NO MEDIR`). Orden: descripción de SKU |
| Razones Día | Botón "Atrás" | — | — |
| Control | Tabla | — | `Código OP`, `Descripción de SKU`, `Tipo`, `Linea`, `Fecha de Contabilización`, `Fecha Recomendada de Liberación`, `Fecha Real de Liberación`, `Fecha Prometida de Entrega Ítem`. Filtros: `Cumplimiento = NO` y `Tiene razon = NO`. Orden: fecha recomendada ascendente |

- **Control** es la lista de trabajo de Planeación: las OP incumplidas que todavía no tienen razón en el Excel.
- Los botones "Atrás" solo vuelven a la página anterior; en el portal no hacen falta.

Filtros y segmentadores:

| Filtro | Columna de origen | Valores reales (confirmados) |
|---|---|---|
| Año / Mes / Día (las 5 páginas) | `Calendario[Fecha]` → `BD[Fecha Recomendada de Liberación]` | Del 2025-07-10 al 2026-11-24 (consulta 3). Los arma la API desde la tabla |
| Estado de cumplimiento (fijo en los visuales) | Columna calculada `Cumplimiento` | OK, NO, SIN LIBERAR, NO MEDIR (salen del DAX). Conteos por fechas, sin el Excel, en la consulta 4 |
| Observación de Planeación | Excel, `OBSERVACIONES PLANEACIÓN` | `CUMPLE` y `NO MEDIR` salen del DAX; las demás razones `pendiente` (no se puede leer el Excel desde aquí) |

### Seguridad (RLS)

- ¿Tiene roles? No. El modelo no tiene `role` ni `tablePermission`.
- Reglas: no hay. Todos los usuarios del BI ven todas las OP. En el portal se controla el acceso al informe en `/admin/permisos`.

### Riesgos y preguntas para el dueño de negocio

Riesgos técnicos:

- **El Excel de razones en SharePoint.** Es la fuente de las correcciones (`CUMPLE`), las exclusiones (`NO MEDIR`) y las razones de incumplimiento. La API no puede leer SharePoint, y el archivo ha cambiado de columnas varias veces (ver las consultas de error). Hay que decidir de dónde saldrán estas razones en el portal (pregunta 1). Sin esa decisión no se puede empezar la fase 2.
- **`Indicador_Liberacion` es una tabla con carga propia, pero todo en texto.** Ya existe y la carga un SP desde un job (consultas 1 y 2), pero sus 23 columnas son `nvarchar`: fechas y cantidades incluidas. Filtrar y agrupar por fecha sobre texto obliga a convertir cada fila y no aprovecha índices. Para la fase 2 hay que leer los dos SP (`FPK_INDICADOR_LIBERACION` y `..._OPTIMIZADO`) y decidir si se corrigen los tipos en esa tabla o se crea `Informe_liberacion` con tipos reales.
- **Tipos distintos en el cruce OP–razón.** `No Orden` es número y `Código OP` es texto. Si en algún caso el cruce falla, Power BI no aplica `CUMPLE`/`NO MEDIR` a esa OP y las cifras del portal saldrán distintas en la conciliación. Mitigado: todos los `Código OP` son numéricos.
- **La tabla solo tiene OP desde el 2025-07-10.** `pendiente`: confirmar si el SP borra lo anterior (ventana móvil) o si los datos empiezan ahí. Define cuánta historia tendrá el portal.
- **Calendario fijo hasta 2026-12-31.** El BI actual dejará de mostrar fechas nuevas en enero de 2027. La migración lo corrige, pero conviene terminarla antes.
- **El estado depende de la fecha de hoy.** En Power BI cambia al actualizar el modelo; en el portal cambiará cuando se calcule (en cada consulta o en cada carga del SP). Puede generar diferencias de un día en la conciliación.
- **Archivos con datos.** `.pbi/cache.abf` guarda los datos importados y `.pbi/localSettings.json` guarda configuración local. Se agregó [`bi-origen/bi-liberacion/.gitignore`](../../bi-origen/bi-liberacion/.gitignore) para no subirlos.

Preguntas para el dueño de negocio (Logística):

1. **Excel de razones.** ¿Quién lo diligencia y cada cuánto? Para el portal hay tres opciones: (a) registrar las razones en el portal, en una pantalla para Planeación que guarda en SQL Server; (b) seguir con el Excel y copiarlo a SQL Server con un proceso automático (por ejemplo, Power Automate); (c) seguir con el Excel y que el desarrollador lo cargue a mano. ¿Cuál prefieren?
Respuesta: `pendiente`
2. **Regla de cumplimiento.** ¿Es correcto que una OP cumple si se libera **el mismo día o antes** de la fecha recomendada, y que una OP sin liberar cuente como incumplida desde el día siguiente a la fecha recomendada?
Respuesta: `pendiente`
3. **`CUMPLE` en el Excel.** Planeación puede marcar como cumplida una OP que las fechas dan por incumplida. ¿Se mantiene esa corrección manual? ¿Quién la autoriza?
Respuesta: `pendiente`
4. **`NO MEDIR`.** Las OP marcadas así salen del indicador. ¿Es correcto? ¿En qué casos se usa?
Respuesta: `pendiente`
5. **Cálculo del %.** El % es `OK / (OK + NO)`: las OP sin liberar y no vencidas, y las de `NO MEDIR`, no cuentan. ¿Es correcto?
Respuesta: `pendiente`
6. **Periodo.** El informe filtra por **fecha recomendada de liberación**. ¿Es la fecha correcta, o debería ser la fecha real de liberación?
Respuesta: `pendiente`
7. **Cada OP cuenta 1.** El % cuenta órdenes, no unidades: una OP de 1 unidad pesa lo mismo que una de 500. ¿Es lo esperado?
Respuesta: `pendiente`
8. **Varias razones por OP.** Si una OP tiene varias filas en el Excel, cada fila cuenta en el % de razones. ¿Es correcto, o cada OP debe tener una sola razón?
Respuesta: `pendiente`
9. **Tabla de Razones Día.** Muestra las OP con razón distinta de `CUMPLE`, incluidas las `NO MEDIR`, sin importar su estado. ¿Se mantiene así?
Respuesta: `pendiente`
10. **Columnas sin uso.** ¿Logística necesita filtrar o ver en el detalle alguna columna que hoy no usa ningún visual, como familia de producción, estado, destino, lote o cantidades? (Planta no sirve como filtro: todas las OP son de Firplak.)
Respuesta: `pendiente`
11. **Tipo O y S.** La columna `Tipo` vale `O` para órdenes `STANDARD` (21 755 OP) y `S` para órdenes `STOCK` (8 568), según el SP. ¿Ambas deben medirse juntas en el mismo %, o Logística quiere verlas por separado?
Respuesta: `pendiente`
12. **Historia.** Hoy el BI solo puede mostrar alrededor de un año: el SP descarta las OP con fecha prometida de más de 365 días y recalcula todo cada día, así que el % de un mes ya cerrado puede cambiar. ¿Logística quiere que el portal conserve la historia y congele los meses cerrados? ¿Cuántos meses hacia atrás necesita ver?
Respuesta: `pendiente`
13. **Frecuencia de actualización.** Hoy los datos se actualizan de lunes a viernes a las 5 p. m. Como lo usan a diario, ¿les sirve así o necesitan datos más frescos durante el día (por ejemplo, cada hora)?
Respuesta: `pendiente`
14. **Fecha recomendada de liberación.** El SP la calcula así: para órdenes `STOCK` (tipo S), la fecha de creación de la OP más 1 día hábil; para órdenes `STANDARD` (tipo O), la fecha prometida de entrega menos el amortiguador de la familia (menos 1) en días hábiles. ¿Es la meta correcta? ¿Quién mantiene los amortiguadores en SAP?
Respuesta: `pendiente`

**Validación del dueño de negocio:** Logística — fecha — `pendiente`

### Consultas de validación para el desarrollador

Ejecutar en `ITPLAKINFO` (solo lectura) y pegar los resultados aquí.

```sql
-- 1. Qué es Indicador_Liberacion y quién la carga
USE Planos_Symphony;
SELECT o.name, o.type_desc, o.create_date, o.modify_date
FROM sys.objects o WHERE o.name = 'Indicador_Liberacion';

-- Si es vista, su definición; si es tabla, los SP que la escriben
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.Indicador_Liberacion')) AS DefinicionVista;
SELECT OBJECT_SCHEMA_NAME(m.object_id) AS Esquema, OBJECT_NAME(m.object_id) AS Objeto
FROM sys.sql_modules m WHERE m.definition LIKE '%Indicador_Liberacion%';

-- Jobs que la mencionan
SELECT j.name AS Job, s.step_name, s.database_name
FROM msdb.dbo.sysjobs j JOIN msdb.dbo.sysjobsteps s ON s.job_id = j.job_id
WHERE s.command LIKE '%Indicador_Liberacion%';

-- 2. Columnas y tipos
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Indicador_Liberacion'
ORDER BY ORDINAL_POSITION;

-- 3. Grano y rango de fechas (¿una fila por OP?)
SELECT COUNT(*) AS Filas,
       COUNT(DISTINCT [Código OP]) AS OPs,
       MIN([Fecha Recomendada de Liberación]) AS MinRecomendada,
       MAX([Fecha Recomendada de Liberación]) AS MaxRecomendada,
       SUM(CASE WHEN [Fecha Recomendada de Liberación] IS NULL THEN 1 ELSE 0 END) AS SinRecomendada,
       SUM(CASE WHEN [Fecha Real de Liberación] IS NULL THEN 1 ELSE 0 END) AS SinLiberar,
       SUM(CASE WHEN ISNUMERIC([Código OP]) = 0 THEN 1 ELSE 0 END) AS OPNoNumerica
FROM dbo.Indicador_Liberacion;

-- 4. Estado por fechas (sin las correcciones del Excel), últimos 3 meses
SELECT YEAR([Fecha Recomendada de Liberación]) AS Anio, MONTH([Fecha Recomendada de Liberación]) AS Mes,
       CASE
         WHEN [Fecha Real de Liberación] IS NULL
           THEN CASE WHEN CAST([Fecha Recomendada de Liberación] AS date) < CAST(GETDATE() AS date) THEN 'NO' ELSE 'SIN LIBERAR' END
         WHEN CAST([Fecha Real de Liberación] AS date) <= CAST([Fecha Recomendada de Liberación] AS date) THEN 'OK'
         ELSE 'NO'
       END AS Cumplimiento,
       COUNT(*) AS OPs
FROM dbo.Indicador_Liberacion
WHERE [Fecha Recomendada de Liberación] >= DATEADD(MONTH, -3, CAST(GETDATE() AS date))
GROUP BY YEAR([Fecha Recomendada de Liberación]), MONTH([Fecha Recomendada de Liberación]),
       CASE
         WHEN [Fecha Real de Liberación] IS NULL
           THEN CASE WHEN CAST([Fecha Recomendada de Liberación] AS date) < CAST(GETDATE() AS date) THEN 'NO' ELSE 'SIN LIBERAR' END
         WHEN CAST([Fecha Real de Liberación] AS date) <= CAST([Fecha Recomendada de Liberación] AS date) THEN 'OK'
         ELSE 'NO'
       END
ORDER BY Anio, Mes, Cumplimiento;

-- 5. Valores de las columnas que podrían ser filtros
SELECT 'Tipo' AS Columna, [Tipo] AS Valor, COUNT(*) AS Filas FROM dbo.Indicador_Liberacion GROUP BY [Tipo]
UNION ALL SELECT 'Linea', [Linea], COUNT(*) FROM dbo.Indicador_Liberacion GROUP BY [Linea]
UNION ALL SELECT 'Planta', [Planta], COUNT(*) FROM dbo.Indicador_Liberacion GROUP BY [Planta]
UNION ALL SELECT 'Estado', [Estado], COUNT(*) FROM dbo.Indicador_Liberacion GROUP BY [Estado]
UNION ALL SELECT 'Familia de Producción', [Familia de Producción], COUNT(*) FROM dbo.Indicador_Liberacion GROUP BY [Familia de Producción]
ORDER BY Columna, Filas DESC;
```

#### Resultados (ejecutadas por el desarrollador el 2026-11-04)

1. `Indicador_Liberacion` es `USER_TABLE`, creada y modificada por última vez el 2025-10-07 16:56. `OBJECT_DEFINITION` devuelve `NULL` (no es vista). La mencionan los SP `dbo.FPK_INDICADOR_LIBERACION` y `dbo.FPK_INDICADOR_LIBERACION_OPTIMIZADO`, y el job `Actualizacion Indicador Liberacion.Subplán_1` (paso `Subplán_1`, `database_name` `NULL`: es un subplán de un plan de mantenimiento).
2. Las 23 columnas son `nvarchar(100)` y aceptan nulos, salvo `Descripción de SKU`, que es `nvarchar(150)`. Fechas, cantidades y costo están guardados como texto. No tiene la columna `CumplimientoLiberacion` que aparecía en la consulta de errores de 2022.
3. Grano y fechas:

| Filas | OP | Mín. recomendada | Máx. recomendada | Sin recomendada | Sin liberar | OP no numérica |
|---|---|---|---|---|---|---|
| 30 323 | 30 323 | 2025-07-10 | 2026-11-24 | 0 | 168 | 0 |

4. Estado por fechas, **sin** las correcciones del Excel (el % lo calculó el agente: OK / (OK + NO)):

| Año | Mes | OK | NO | SIN LIBERAR | % OK sin Excel |
|---|---|---|---|---|---|
| 2026 | 8 | 1 630 | 437 | — | 78,9 % |
| 2026 | 9 | 1 637 | 704 | — | 69,9 % |
| 2026 | 10 | 1 738 | 533 | — | 76,5 % |
| 2026 | 11 (al 2026-11-04) | 299 | 7 | 117 | 97,7 % |

El CAST a `date` de las columnas de texto no falló: el formato de las fechas es convertible. Agosto empieza a mitad de mes por el filtro de 3 meses.

5. Valores de las columnas candidatas a filtro:

| Columna | Valores (filas) |
|---|---|
| `Tipo` | O (21 755), S (8 568) |
| `Estado` | Cerrado (29 901), Liberado (252), Planificado (170) |
| `Planta` | Firplak (30 323): un solo valor |
| `Linea` | MBL (12 064), PC (10 319), vacío (2 460), PA (2 384), FV (2 352), RTM (552), ESPGAB (192) |
| `Familia de Producción` | MBL (11 579), PC (10 068), PA (2 369), FVH (1 243), MBL CEFI (1 187), MBLP (773), FV (689), RTM (494), MBLM (493), PFZ-CEMA (485), FVHMP (316), PCM (251), ESPGAB (192), FVM (66), RTMM (58), FVHM (41), PAM (15), FVHMPM (4) |

Resultados de las consultas 6 y 7 (2026-11-04):

6. Los dos SP existen (`CREATE PROCEDURE [dbo].[FPK_INDICADOR_LIBERA…`). La grilla de SSMS corta el texto: `pendiente` el código completo.
7. Job `Actualizacion Indicador Liberacion.Subplán_1`:
   - Activo (`enabled = 1`). Un solo paso, `Subplán_1`, subsistema SSIS: ejecuta el plan de mantenimiento `Actualizacion Indicador Liberacion`. Su tarea T-SQL es `Exec [Planos_Symphony].[dbo].[FPK_INDICADOR_LIBERACION]`, sin parámetros (confirmado en `msdb.dbo.sysssispackages`). La otra instrucción del paquete (`sp_maintplan_open_logentry`) solo abre el registro del plan. **`FPK_INDICADOR_LIBERACION_OPTIMIZADO` no lo ejecuta este job** (`pendiente`: confirmar si se usa en otro lado).
   - Horario activo: semanal (`freq_type = 8`) de **lunes a viernes** (`freq_interval = 62`), **una vez al día a las 17:00** (`freq_subday_type = 1`).
   - Últimas 5 ejecuciones (2026-10-28 a 2026-11-03), todas correctas (`run_status = 1`), de 12 a 15 segundos.

Consecuencias: el dato del día se actualiza a las 5 p. m. y no se actualiza en fines de semana. La carga es corta (unos 15 s), así que no hace falta carga incremental por rendimiento; se puede evaluar una frecuencia mayor en la fase 2.

Consultas siguientes para preparar la fase 2 (solo lectura):

```sql
-- 6. Definición de los dos SP que escriben la tabla
USE Planos_Symphony;
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.FPK_INDICADOR_LIBERACION')) AS SP_Original;
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.FPK_INDICADOR_LIBERACION_OPTIMIZADO')) AS SP_Optimizado;

-- 7. Qué ejecuta el job, si está activo, su horario y su última ejecución
SELECT j.name, j.enabled, s.step_name, s.subsystem, s.command
FROM msdb.dbo.sysjobs j JOIN msdb.dbo.sysjobsteps s ON s.job_id = j.job_id
WHERE j.name LIKE 'Actualizacion Indicador Liberacion%';

SELECT j.name, sc.name AS Horario, sc.enabled, sc.freq_type, sc.freq_interval,
       sc.freq_subday_type, sc.freq_subday_interval, sc.active_start_time, sc.active_end_time
FROM msdb.dbo.sysjobs j
JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
JOIN msdb.dbo.sysschedules sc ON sc.schedule_id = js.schedule_id
WHERE j.name LIKE 'Actualizacion Indicador Liberacion%';

SELECT TOP 5 j.name, h.run_date, h.run_time, h.run_duration, h.run_status
FROM msdb.dbo.sysjobs j JOIN msdb.dbo.sysjobhistory h ON h.job_id = j.job_id
WHERE j.name LIKE 'Actualizacion Indicador Liberacion%' AND h.step_id = 0
ORDER BY h.run_date DESC, h.run_time DESC;
```

Del Excel `Razones incumplimiento lib.xlsx` (tabla `Obs_Plan`), sin copiar el archivo al repositorio:

- Número de filas y de OP distintas.
- Valores distintos de `OBSERVACIONES PLANEACIÓN` con su conteo (en Excel: tabla dinámica sobre esa columna).
- Si hay OP con más de una fila, y si alguna tiene `CUMPLE` y otra razón a la vez.

## 2. Tabla de reporte y carga incremental

Propuesta inicial; se define en la fase 2 con los resultados de las consultas 1 a 3 y la respuesta a la pregunta 1.

| Campo | Valor |
|---|---|
| Tabla | `pendiente` (consultas 6 y 7). `Indicador_Liberacion` ya es una tabla con carga propia, pero toda en texto. Opciones: corregir los tipos en esa tabla y su SP, o crear `Planos_Symphony.dbo.Informe_liberacion` con tipos reales a partir de ella ([ADR-001](../decisions/ADR-001-reporting-table.md)) |
| Grano (una fila por…) | Orden de producción (`Código OP`). Confirmado: 30 323 filas, 30 323 OP |
| Clave | `Código OP` como entero (todos son numéricos), compatible con `No Orden` de las razones |
| Fecha de referencia (filtros por periodo) | `Fecha Recomendada de Liberación` |
| Estrategia incremental | Propuesta: no tocar `FPK_INDICADOR_LIBERACION` (es la regla de Planeación y la usa el Power BI mientras corre en paralelo). Un SP nuevo, después de él, copia `Indicador_Liberacion` a una tabla con tipos reales mediante `MERGE` por `Código OP`: actualiza las OP de la ventana y **conserva** las que salen de ella. Así el portal acumula historia. `pendiente`: aprobación del desarrollador en la fase 2 y respuesta a la pregunta 12 |
| SP | Hoy: `dbo.FPK_INDICADOR_LIBERACION`, el que ejecuta el job. `dbo.FPK_INDICADOR_LIBERACION_OPTIMIZADO` existe pero el job no lo usa |
| Job y horario | Hoy: `Actualizacion Indicador Liberacion.Subplán_1`, plan de mantenimiento, lunes a viernes a las 17:00; dura unos 15 s |
| Índices | `pendiente`; mínimo sobre `Fecha Recomendada de Liberación` y `Código OP` |

Columnas que usa el BI: `Código OP`, `Descripción de SKU`, `Tipo`, `Linea`, `Fecha de Contabilización`, `Fecha Recomendada de Liberación`, `Fecha Real de Liberación`, `Fecha Prometida de Entrega Ítem`, más las que Logística pida en la pregunta 10.

Razones de Planeación: tabla aparte en `Planos_Symphony` (por ejemplo, una fila por OP y razón con observación, comentario y fecha), alimentada según la respuesta a la pregunta 1. El estado `Cumplimiento` se calcula cruzando las dos tablas con la fecha de hoy, en la consulta de la API, para que no dependa de la hora de la última carga.

#### Cómo se carga `Indicador_Liberacion` (código compartido por el desarrollador, 2026-11-04)

`dbo.FPK_INDICADOR_LIBERACION` (`pendiente`: guardar el script en [`bi-origen/bi-liberacion/sql/`](../../bi-origen/bi-liberacion/) para enlazarlo aquí). Lo ejecuta el job de lunes a viernes a las 17:00.

**Carga completa con ventana móvil.** Arma todo en tablas temporales y al final hace `TRUNCATE` + `INSERT` de `Indicador_Liberacion`. No es incremental y no guarda historia: cada día recalcula todo.

**Fuentes** (todas en `Firplak_SA`, SAP Business One, con `NOLOCK`):

| Tabla SAP | Uso |
|---|---|
| `OWOR` | Órdenes de producción: número (`DocNum` → `Código OP`), tipo (`U_Tipo_Orden`), artículo, bodega, fecha de vencimiento (`DueDate` → `Fecha Prometida de Entrega`), fecha de liberación (`RlsDate` → `Fecha Real de Liberación`), cantidades, lote, estado, fecha de creación (`CreateDate` → `Fecha de Contabilización`) |
| `OITM` | Descripción del artículo, línea (`U_Linea`), familia maestra, costo (`LstEvlPric`) |
| `ORDR` / `RDR1` | Pedido de venta que originó la OP (`OWOR.OriginNum = ORDR.DocNum`): tipo de pedido y fecha de entrega de la línea (`ShipDate`) |
| `@FIR_FAM_SYMPH` | Familia de producción según familia maestra y tipo de pedido |
| `@FIR_AMORTIGUADORES` | Días de amortiguador por familia (`U_Amortiguador`) |
| `@FIR_TIPOPEDIDOS` | Días de distribución por tipo de pedido (`U_Dias_Distr`) |
| `@FIR_FECHAS_PROD` | Días **no** laborables: el SP cuenta días hábiles restando estas fechas a los días calendario |

**Filtros:** OP en estado Planificado (`P`), Liberado (`R`) o Cerrado (`L`), nunca Canceladas; bodegas `PT-01`, `PT-02` y `PT-08`; con tipo de orden; con **`DueDate` entre hoy − 365 días y hoy + 25 días**; y con familia de producción (`WHERE Familia IS NOT NULL`).

**Cómo calcula la `Fecha Recomendada de Liberación`** (la meta contra la que se mide el BI):

- **Tipo `S` (orden `STOCK`):** fecha de creación de la OP + 1 día hábil.
- **Tipo `O` (orden `STANDARD`):** fecha prometida de entrega − (amortiguador de la familia − 1) días hábiles. Si la familia no tiene amortiguador, queda en `1900-01-01`. Hoy no hay ninguna (mínimo 2025-07-10), pero si pasa, esa OP siempre saldría NO.
- Los días hábiles se cuentan con `CASE` anidados de hasta 7 a 9 pasos, no con un bucle. Con muchos festivos seguidos el resultado puede quedar corto.

Otras columnas calculadas que el BI no usa en el indicador: `Fecha Recomendada de Entrega` y `Color Recomendado` (semáforo BLACK/RED/YELLOW/GREEN/CYAN según días hábiles hasta la entrega, con reglas por familia).

Hallazgos para la migración:

- **La historia se pierde.** Una OP sale de la tabla cuando su fecha prometida tiene más de 365 días. Por eso no hay datos antes del 2025-07-10, y el Power BI tampoco puede mostrar más de un año.
- **El pasado cambia.** Como todo se recalcula cada día, si cambian los amortiguadores, los días de distribución o los festivos, cambian también las fechas recomendadas, y con ellas el % de meses ya cerrados.
- **`Fecha Prometida de Entrega Ítem` no es confiable.** El paso 5 cruza la OP con **todas** las líneas del pedido de venta, sin filtrar la línea, así que el `UPDATE` toma la fecha de una línea cualquiera. Solo la usa la tabla de Control.
- **`FPK_INDICADOR_LIBERACION_OPTIMIZADO` es una copia de prueba.** El código recibido es igual al original y escribe en `Indicador_Liberacion_Prueba`. No interviene en el BI.

Validación de totales (origen vs. tabla):

| Periodo | Filas origen | Filas tabla | Total origen | Total tabla |
|---|---|---|---|---|

## 3. Contrato del endpoint

`pendiente`

## 4. Endpoint

`pendiente`

## 5. Dashboard

`pendiente`

## 6. Conciliación con Power BI

`pendiente`

## 7. Despliegue y retiro

`pendiente`
