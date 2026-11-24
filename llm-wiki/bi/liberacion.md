---
status: en-migracion
fase: 7
updated: 2026-11-24
sources:
  - ../../bi-origen/bi-liberacion/
  - ../../bi-origen/bi-liberacion/sql/FPK_INDICADOR_LIBERACION.sql
  - Proyecto Logística (Desktop/Logistica), supabase/migrations/20261120_logistica_razones_lib*.sql
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
| `RazonesIncumplimiento` | `SharePoint.Files` + `Excel.Workbook` (import) | Sitio `https://firplaksa.sharepoint.com/sites/LOGSTICASEGUIMIENTO`, carpeta `Shared Documents/07. PLANEACIÓN DE PXN Y ABASTECIMIENTO PTC/1. PLANEACIÓN DE PRODUCCIÓN/`, archivo `Razones incumplimiento lib.xlsx`, tabla de Excel `Obs_Plan` | **Riesgo: no es SQL Server.** Lo diligencia Planeación a mano. Columnas: `No Orden`, `OBSERVACIONES PLANEACIÓN`, `COMENTARIOS`, `FECHA` (texto). En el portal se reemplaza por la app de Logística ([decisión del 2026-11-20](#razones-de-planeación-decisión-del-desarrollador-2026-11-20)). |
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

- **El Excel de razones en SharePoint.** Es la fuente de las correcciones (`CUMPLE`), las exclusiones (`NO MEDIR`) y las razones de incumplimiento. La API no puede leer SharePoint, y el archivo ha cambiado de columnas varias veces (ver las consultas de error). **Decidido el 2026-11-20:** las razones salen de la app de Logística (Supabase) y se sincronizan a SQL Server; ver [Razones de Planeación](#razones-de-planeación-decisión-del-desarrollador-2026-11-20).
- **`Indicador_Liberacion` es una tabla con carga propia, pero todo en texto.** Ya existe y la carga un SP desde un job (consultas 1 y 2), pero sus 23 columnas son `nvarchar`: fechas y cantidades incluidas. Filtrar y agrupar por fecha sobre texto obliga a convertir cada fila y no aprovecha índices. Para la fase 2 hay que leer los dos SP (`FPK_INDICADOR_LIBERACION` y `..._OPTIMIZADO`) y decidir si se corrigen los tipos en esa tabla o se crea `Informe_liberacion` con tipos reales.
- **Tipos distintos en el cruce OP–razón.** `No Orden` es número y `Código OP` es texto. Si en algún caso el cruce falla, Power BI no aplica `CUMPLE`/`NO MEDIR` a esa OP y las cifras del portal saldrán distintas en la conciliación. Mitigado: todos los `Código OP` son numéricos.
- **La tabla solo tiene OP desde el 2025-07-10.** `pendiente`: confirmar si el SP borra lo anterior (ventana móvil) o si los datos empiezan ahí. Define cuánta historia tendrá el portal.
- **Calendario fijo hasta 2026-12-31.** El BI actual dejará de mostrar fechas nuevas en enero de 2027. La migración lo corrige, pero conviene terminarla antes.
- **El estado depende de la fecha de hoy.** En Power BI cambia al actualizar el modelo; en el portal cambiará cuando se calcule (en cada consulta o en cada carga del SP). Puede generar diferencias de un día en la conciliación.
- **Archivos con datos.** `.pbi/cache.abf` guarda los datos importados y `.pbi/localSettings.json` guarda configuración local. Se agregó [`bi-origen/bi-liberacion/.gitignore`](../../bi-origen/bi-liberacion/.gitignore) para no subirlos.

Preguntas para el dueño de negocio (Logística):

1. **Excel de razones.** ¿Quién lo diligencia y cada cuánto? Para el portal hay tres opciones: (a) registrar las razones en el portal, en una pantalla para Planeación que guarda en SQL Server; (b) seguir con el Excel y copiarlo a SQL Server con un proceso automático (por ejemplo, Power Automate); (c) seguir con el Excel y que el desarrollador lo cargue a mano. ¿Cuál prefieren?
Respuesta: el desarrollador construyó la app de Logística, que reemplaza el Excel con un formulario y guarda en Supabase (2026-11-20); ver [Razones de Planeación](#razones-de-planeación-decisión-del-desarrollador-2026-11-20). Decisión del desarrollador (2026-11-20): el indicador se construye con Supabase como fuente de las razones, sin esperar a que Logística deje el Excel. Mientras convivan, Supabase se actualiza desde el Excel con el proceso manual de la app de Logística.
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
Respuesta: ya no aplica. El Excel no tiene OP repetidas (40 492 órdenes, 0 duplicados, versión del 2026-11-20) y la app de Logística guarda una sola razón por OP (`no_orden` es la clave; guardar una OP existente la edita).
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
15. **Cumple con cambio de fecha.** La app de Logística distingue las OP que cumplen después de reprogramarse (casilla en el formulario; en el histórico se deduce del comentario: 6 718 de los `CUMPLE`). ¿El indicador las cuenta como cumplidas igual que las demás, o se muestran aparte?
Respuesta: `pendiente`
16. **Fecha programada de la app.** En la app de Logística cada razón lleva una "fecha programada" obligatoria. El BI no la usa: compara contra la fecha recomendada que calcula el SP. ¿Esa fecha debe intervenir en el indicador, o es solo informativa?
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

Plan aprobado por el desarrollador el 2026-11-20. Scripts en [`sql/liberacion/`](../../sql/liberacion/), que ejecuta el desarrollador: [`01_informe_liberacion.sql`](../../sql/liberacion/01_informe_liberacion.sql) (tabla de OP y SP), [`02_razones_liberacion.sql`](../../sql/liberacion/02_razones_liberacion.sql) (tabla de razones y SP de carga que usa la API) y [`03_job_liberacion.sql`](../../sql/liberacion/03_job_liberacion.sql).

La fase 2 avanzó sin la validación de Logística de la fase 1, por decisión del desarrollador: las tablas no guardan reglas de cumplimiento. El cumplimiento se calcula en la API (fase 4), y esa fase sí depende de las respuestas.

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_liberacion`: las 23 columnas de `Indicador_Liberacion` con tipos reales (fechas `date`, cantidades `decimal`) y nombres sin espacios ni tildes (`Código OP` → `CodigoOP`, `Fecha Recomendada de Liberación` → `FechaRecomendadaLiberacion`, etc.), más `EnOrigen`, `PrimeraCarga` y `UltimaCarga` ([ADR-001](../decisions/ADR-001-reporting-table.md)) |
| Grano (una fila por…) | Orden de producción (`Código OP`). Confirmado: 30 323 filas, 30 323 OP |
| Clave | `Código OP` como entero (todos son numéricos), compatible con `No Orden` de las razones |
| Fecha de referencia (filtros por periodo) | `Fecha Recomendada de Liberación` |
| Estrategia incremental | `FPK_INDICADOR_LIBERACION` no se toca. `dbo.sp_Actualizar_Informe_liberacion` hace `MERGE` por `CodigoOP` desde `Indicador_Liberacion`. Inserta y actualiza las OP del origen. Las que salen de la ventana de 365 días sobre la fecha prometida se **conservan** con `EnOrigen = 0` (historia, pregunta 12). Las que salen del origen y siguen dentro de la ventana (canceladas o fuera de los filtros del SP de origen) se borran. No carga si una fecha o un número no tiene el formato esperado, si el origen está vacío o si trae menos del 50 % de las OP vigentes (origen a mitad de su `TRUNCATE` + `INSERT`). Bitácora: `dbo.Cargas_Log`, `Proceso = Informe_liberacion` |
| SP | Nuevo: `dbo.sp_Actualizar_Informe_liberacion`. Origen, sin cambios: `dbo.FPK_INDICADOR_LIBERACION`. `dbo.FPK_INDICADOR_LIBERACION_OPTIMIZADO` existe, pero ningún job lo usa |
| Job y horario | Nuevo: `BI - Liberacion carga`, lunes a viernes a las 17:15, con un reintento a los 10 minutos. Origen: `Actualizacion Indicador Liberacion.Subplán_1`, lunes a viernes a las 17:00 (unos 15 s). Ejecuciones programadas verificadas por el desarrollador (`Cargas_Log`): 2026-11-20 17:15 (3 s, 5 OP borradas por salir del origen dentro de la ventana) y 2026-11-23 17:15 (3 s, 2 borradas), sin error. **Fase 2 cerrada el 2026-11-24** |
| Índices | Clave primaria agrupada por `CodigoOP`, para el cruce con las razones. `IX_Informe_liberacion_FechaRecomendada` sobre `FechaRecomendadaLiberacion`, con `Tipo`, `Linea`, `FamiliaProduccion`, `Estado` y `FechaRealLiberacion` incluidas: todos los filtros de periodo van por esa fecha |

#### Consultas previas de `01_informe_liberacion.sql` (ejecutadas por el desarrollador el 2026-11-20)

- **0.1 Columnas:** las 23 columnas de `Indicador_Liberacion` tienen los nombres exactos y el orden que usa el SP. Todas son `nvarchar(100)`, salvo `Descripción de SKU`, que es `nvarchar(150)` (SSMS muestra `max_length` en bytes: 200 y 300).
- **0.2 Formato:** 29 942 filas, ninguna con un código, una fecha o un número en formato inesperado. Ejemplos: fecha `2025-08-28`, cantidad `1.000`, costo `0.0`.
- **0.3 Longitud máxima de los textos:** SKU 20, Destino 5, Familia 8, Lote 16, Descripción de SKU 100, Estado 11, Línea 6, Color 6, Planta 7, Tipo 1. Todos caben en las columnas de `Informe_liberacion`. Línea llega justo al límite de 6, igual que la tabla temporal del SP de origen.

Conclusión: el SP no necesita cambios.

#### Primera carga y validación de `Informe_liberacion` (desarrollador, 2026-11-20)

- **4.1 Bitácora:** `Cargas_Log` Id 3440, de 12:12:30 a 12:12:33, 29 942 insertadas, `Error` NULL.
- **4.2 OP frente al origen:** `SoloEnOrigen` 0, `SoloEnTabla` 0, `Distintas` 0.
- **4.4 Totales:** diferencia de `Cantidad Total` 0,000 y de filas 0.
- **4.3 Estado por mes**, con la regla del BI y sin las razones:

| Año | Mes | OK | NO | Sin liberar |
|---|---|---|---|---|
| 2025 | 7 | 0 | 1 | 0 |
| 2025 | 10 | 1 | 7 | 0 |
| 2025 | 11 | 871 | 888 | 0 |
| 2025 | 12 | 1 579 | 1 348 | 0 |
| 2026 | 1 | 1 180 | 921 | 0 |
| 2026 | 2 | 1 908 | 662 | 0 |
| 2026 | 3 | 1 957 | 509 | 0 |
| 2026 | 4 | 1 647 | 699 | 0 |
| 2026 | 5 | 1 664 | 648 | 0 |
| 2026 | 6 | 1 518 | 801 | 0 |
| 2026 | 7 | 1 734 | 927 | 0 |
| 2026 | 8 | 1 679 | 469 | 0 |
| 2026 | 9 | 1 637 | 704 | 0 |
| 2026 | 10 | 1 733 | 522 | 0 |
| 2026 | 11 | 1 255 | 232 | 182 |
| 2026 | 12 | 34 | 0 | 25 |

Frente a la consulta 4 de la fase 1 (2026-11-04):

- Septiembre es idéntico.
- Agosto sube porque esa consulta solo traía los últimos 3 meses y agosto empezaba el día 4.
- **Octubre perdió 16 OP** (5 OK y 11 NO) entre el 4 y el 20 de noviembre. Se cancelaron en SAP o el SP de origen recalculó su fecha recomendada. Confirma que, en el origen, los meses cerrados cambian (pregunta 12).
- Julio y octubre de 2025 (1 y 8 OP), y noviembre de 2025 parcial, son el borde de la ventana de 365 días sobre la fecha prometida.
- Diciembre de 2026: 34 OP ya liberadas antes de su fecha recomendada.

Columnas que usa el BI: `Código OP`, `Descripción de SKU`, `Tipo`, `Linea`, `Fecha de Contabilización`, `Fecha Recomendada de Liberación`, `Fecha Real de Liberación`, `Fecha Prometida de Entrega Ítem`, más las que Logística pida en la pregunta 10.

Razones de Planeación: tabla aparte en `Planos_Symphony`, alimentada desde la app de Logística (ver la subsección siguiente). El estado `Cumplimiento` se calcula cruzando las dos tablas con la fecha de hoy, en la consulta de la API, para que no dependa de la hora de la última carga.

#### Razones de Planeación: decisión del desarrollador (2026-11-20)

El Excel `Razones incumplimiento lib.xlsx` se migró a la app de Logística (proyecto aparte, `Desktop/Logistica`, ficha `llm-wiki/excels/razones-incumplimiento-lib.md` de ese proyecto). Las razones viven en Supabase, proyecto Manufactura, schema `logistica`:

| Tabla | Contenido |
|---|---|
| `logistica.razones_lib_historico` | El Excel tal cual (40 492 OP al 2026-11-20). Solo lectura para la app. |
| `logistica.razones_lib_registros` | OP registradas o editadas en el formulario; prevalecen sobre el histórico con el mismo `no_orden`. |
| `logistica.razones_lib_eliminadas` | Borrado lógico: la OP deja de contar. |
| `logistica.razones_lib_catalogo` | Catálogo de razones; un trigger impide guardar una razón fuera de él. |

La razón vigente de cada OP es la del registro, si existe, o la del histórico, sin las eliminadas. Hoy la calcula el servidor de la app (`cargarOrdenes`); no hay una vista en la base.

**Decisión: opción A, sincronizar a SQL Server.** Se descartó que la Reporting API consulte Supabase en cada petición (opción B). B no sería lenta si se cachea, pero el filtro por razón no se podría aplicar en SQL, el indicador dependería de dos bases y la conciliación con Power BI sería más difícil de explicar con consultas.

Diseño (2026-11-20). El desarrollador descartó instalar un driver de PostgreSQL o un servidor vinculado en ITPLAKINFO. Por eso Supabase **empuja** las razones a la Reporting API, y el job de envío se programa en Supabase:

```text
logistica.razones_lib_vigentes (vista)
  │ pg_cron cada 15 min → logistica.liberacion_enviar_razones(): solo envía si cambió la huella (md5)
  ▼ pg_net POST https://api.firplak.com:8443/api/v1/liberacion/razones (token LIBERACION_RAZONES_TOKEN, en Vault)
Reporting API → EXEC dbo.sp_Cargar_Informe_liberacion_razones @Razones (parámetro de tabla dbo.TipoRazonLiberacion)
  ▼
Planos_Symphony.dbo.Informe_liberacion_razones (reemplazo completo en una transacción)
```

1. **Vista** `logistica.razones_lib_vigentes`, creada por la migración `supabase/migrations/20261120_logistica_razones_lib_envio_liberacion.sql` del proyecto Logística. Replica las reglas de la app:
   - El registro prevalece sobre el histórico, y las OP eliminadas no aparecen.
   - `razon_normalizada` se calcula como `normalizarRazon`: agrupa ERROR DE LIBERACIÓN, CAPACIAD DEL DIA FULL y CAMBIO SKU.
   - `cambio_fecha` del histórico se deduce del comentario, como `detectarCambioFecha`.
   - `fecha_programada` solo se llena si `fecha_excel` es una fecha válida; si no, el texto va en `fecha_texto`.

   Se probó con PGlite el 2026-11-20, con un caso por regla. Si las reglas cambian en la app, hay que cambiar la vista.
2. **Envío:** `logistica.liberacion_enviar_razones()`, `security definer`, sin permisos para `anon` ni `authenticated`.
   - Lee la URL y el token de Vault (`liberacion_api_url`, `liberacion_api_token`).
   - Guarda cada envío y su respuesta HTTP en `logistica.liberacion_envios`, durante 30 días.
   - Si el último envío falló, reintenta en la siguiente corrida.
   - Requiere las extensiones `pg_cron` y `pg_net` en Manufactura.
3. **API:** `POST /api/v1/liberacion/razones`, en la rama `bi/liberacion` de `reporting-api` (`src/liberacion.ts`).
   - Usa un token propio, distinto de `REPORTING_API_TOKEN`, para que Supabase no pueda consultar los demás informes.
   - Valida todas las filas. Si una falla, responde 400 con hasta cinco errores y no guarda nada.
   - Acepta cuerpos de hasta 25 MB.
4. **SQL Server:** `dbo.Informe_liberacion_razones`, con clave `NoOrden` (`bigint`) y las columnas `Razon`, `RazonNormalizada`, `CambioFecha`, `FechaProgramada`, `FechaTexto`, `Comentario`, `Origen`, `Actualizado` y `Sincronizado`.
   - El SP rechaza un envío que traiga más de un 10 % menos de filas que la tabla actual.
   - El usuario de la API solo recibe `EXECUTE` sobre el SP y el tipo.
   - Verificado el 2026-11-20: el usuario de la API (`informes`) tiene solo `db_datareader` y `CONNECT`. Necesita los dos `GRANT EXECUTE` de la sección 4 del script; los `SELECT` no, porque `db_datareader` ya los cubre.
   - 2026-11-20: el desarrollador ejecutó `02_razones_liberacion.sql`, los dos `GRANT EXECUTE` a `informes` y `03_job_liberacion.sql` (job `BI - Liberacion carga`).
   - 2026-11-20, primer envío desde Supabase: la API respondió 200 (`received` 40 492). Validación 5.1: `Cargas_Log` Id 3447, 40 492 insertadas en menos de 1 s, sin error. Validación 5.2: el conteo por `RazonNormalizada` en SQL Server es idéntico al de la vista en Supabase: 44 razones, 40 492 OP, 6 798 con cambio de fecha (`CUMPLE` 12 880, de ellas 6 755 con cambio de fecha; `NO MEDIR` 1 339). Las variantes del Excel quedaron agrupadas en su razón del catálogo. Validación 5.3, cruce con las OP del indicador:

| Año | Mes | OP | Con razón | `CUMPLE` | `NO MEDIR` |
|---|---|---|---|---|---|
| 2025 | 7 | 1 | 1 | 0 | 0 |
| 2025 | 10 | 8 | 7 | 1 | 0 |
| 2025 | 11 | 1 759 | 978 | 222 | 0 |
| 2025 | 12 | 2 927 | 1 425 | 389 | 8 |
| 2026 | 1 | 2 101 | 933 | 307 | 2 |
| 2026 | 2 | 2 570 | 665 | 174 | 3 |
| 2026 | 3 | 2 466 | 536 | 361 | 16 |
| 2026 | 4 | 2 346 | 714 | 492 | 10 |
| 2026 | 5 | 2 312 | 664 | 283 | 73 |
| 2026 | 6 | 2 319 | 808 | 404 | 9 |
| 2026 | 7 | 2 661 | 931 | 358 | 21 |
| 2026 | 8 | 2 148 | 486 | 165 | 0 |
| 2026 | 9 | 2 341 | 707 | 228 | 3 |
| 2026 | 10 | 2 255 | 534 | 262 | 8 |
| 2026 | 11 | 1 669 | 231 | 125 | 1 |
| 2026 | 12 | 59 | 0 | 0 | 0 |

     En los meses cerrados, las OP con razón se acercan al número de incumplidas por fechas (4.3; por ejemplo, octubre de 2026: 534 con razón y 522 NO). Noviembre de 2026 está incompleto porque Logística todavía lo diligencia. % de cumplimiento por mes con la regla completa del BI (`CUMPLE` y `NO MEDIR` de las razones primero; si no hay, las fechas), calculado en SQL el 2026-11-20:

| Año | Mes | OK | NO | `NO MEDIR` | Sin liberar | % |
|---|---|---|---|---|---|---|
| 2025 | 7 | 0 | 1 | 0 | 0 | 0,0 |
| 2025 | 10 | 2 | 6 | 0 | 0 | 25,0 |
| 2025 | 11 | 1 028 | 731 | 0 | 0 | 58,4 |
| 2025 | 12 | 1 925 | 994 | 8 | 0 | 65,9 |
| 2026 | 1 | 1 479 | 620 | 2 | 0 | 70,5 |
| 2026 | 2 | 2 080 | 487 | 3 | 0 | 81,0 |
| 2026 | 3 | 2 310 | 140 | 16 | 0 | 94,3 |
| 2026 | 4 | 2 128 | 208 | 10 | 0 | 91,1 |
| 2026 | 5 | 1 934 | 305 | 73 | 0 | 86,4 |
| 2026 | 6 | 1 918 | 392 | 9 | 0 | 83,0 |
| 2026 | 7 | 2 089 | 551 | 21 | 0 | 79,1 |
| 2026 | 8 | 1 835 | 313 | 0 | 0 | 85,4 |
| 2026 | 9 | 1 863 | 475 | 3 | 0 | 79,7 |
| 2026 | 10 | 1 989 | 258 | 8 | 0 | 88,5 |
| 2026 | 11 | 1 379 | 107 | 1 | 182 | 92,8 |
| 2026 | 12 | 34 | 0 | 0 | 25 | 100,0 |

     Ninguna OP se pierde en el cruce: OK + NO + `NO MEDIR` + sin liberar = OP de la 4.3. Las razones suben el % de los meses cerrados: agosto de 78,2 a 85,4; septiembre de 69,9 a 79,7; octubre de 76,9 a 88,5. Comparación con el Power BI (capturas del desarrollador, 2026-11-20), adelanto de la fase 6:

| Mes 2026 | Portal (SQL) | Power BI | Diferencia |
|---|---|---|---|
| Agosto | 1 835 / 2 148 = 85,43 % | 85,43 % | 0 |
| Septiembre | 1 863 / 2 338 = 79,68 % | 79,68 % | 0 |
| Octubre | 1 989 / 2 247 = 88,52 % | 88,45 % antes de actualizar; 88,52 % actualizado | 0 |

     Agosto y septiembre iguales con dos decimales: la regla está bien replicada. **Octubre, resuelto el mismo día:** el desarrollador actualizó el Power BI antes de las 17:00 (mismo `Indicador_Liberacion` que el portal) y dio **88,52 %**, igual al portal; agosto y septiembre siguieron iguales. La diferencia de 0,07 puntos era porque el Power BI tenía una actualización anterior. Los tres meses coinciden con dos decimales. `pendiente`: primera ejecución programada del job (2026-11-20 17:15), que cierra la fase 2.
5. La API cruza `CodigoOP` con `NoOrden` en SQL, como hoy lo hace Power BI.

Pendientes que no dependen de este repositorio:

- Logística sigue diligenciando el Excel en paralelo, y Supabase se actualiza a mano (`excel:traer` → `excel:perfil` → `cargar-supabase`). No bloquea la migración (decisión del 2026-11-20): el portal lee Supabase desde ya y, cuando Logística deje el Excel, no cambia nada en este lado.
- La app de Logística está en fase 4: falta su conciliación y publicarla con URL de producción para que Logística la use.

#### Cómo se carga `Indicador_Liberacion` (código compartido por el desarrollador, 2026-11-04)

`dbo.FPK_INDICADOR_LIBERACION` ([script](../../bi-origen/bi-liberacion/sql/FPK_INDICADOR_LIBERACION.sql)). Lo ejecuta el job de lunes a viernes a las 17:00.

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

Aprobado por el desarrollador el 2026-11-20, con las decisiones A a E. Replica el Power BI tal cual, con la regla validada en la fase 2 (agosto a octubre de 2026 iguales con dos decimales). Si las respuestas de Logística cambian alguna regla (preguntas 11, 15 y 16, entre otras), se ajusta aquí.

`GET /api/v1/liberacion`. Usa el mismo token (`REPORTING_API_TOKEN`), el mismo manejo de errores (502 sin detalles internos) y la misma forma de respuesta que `/api/v1/facturacion-diaria`.

**Fuentes.** `Planos_Symphony.dbo.Informe_liberacion` (OP) cruzada con `dbo.Informe_liberacion_razones` (`CodigoOP = NoOrden`). Variables nuevas: `REPORT_LIBERACION_TABLE_SCHEMA=dbo`, `REPORT_LIBERACION_TABLE=Informe_liberacion` y `REPORT_LIBERACION_RAZONES_TABLE=Informe_liberacion_razones`.

**"Hoy"** es `CAST(GETDATE() AS date)` del SQL Server, en hora de Colombia. El estado se calcula en SQL en cada consulta. En el Power BI, `TODAY()` se evaluaba al actualizar el modelo; en el portal, una OP pasa de "sin liberar" a "no cumple" el mismo día en que vence.

| `compliance` | Regla (en orden de prioridad) | Cuenta en el % |
|---|---|---|
| `ok` | La razón es `CUMPLE`; o tiene fecha real de liberación igual o anterior a la recomendada | Sí, en el numerador |
| `noMedir` | La razón es `NO MEDIR` (si no es `CUMPLE`) | No |
| `no` | Sin fecha real y fecha recomendada anterior a hoy; o fecha real posterior a la recomendada | Sí, en el denominador |
| `sinLiberar` | Sin fecha real y fecha recomendada hoy o futura | No |

Las razones se comparan por `RazonNormalizada`.

### Parámetros

Todos los filtros de periodo van por `FechaRecomendadaLiberacion`, como el segmentador del Power BI (Año › Mes › Día sobre `Calendario`).

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `page`, `pageSize` | entero | — | Paginación de `rows`, igual que en facturación |
| `anio`, `mes`, `dia` | entero | `FechaRecomendadaLiberacion` | Periodo. El dashboard abre en el mes en curso |
| `fechaDesde`, `fechaHasta` | `AAAA-MM-DD` | `FechaRecomendadaLiberacion` | Rango opcional |
| `vista` | `detalle`, `razones` o `control` | Calculada | Qué OP trae `rows` (tabla siguiente). Por omisión, `detalle`. **Solo afecta `rows`** |
| `cumplimiento` | `ok`, `no`, `sinLiberar` o `noMedir` | Calculada | Solo filtra `rows` |
| `razon` | texto | `RazonNormalizada` | Solo filtra `rows`. Sirve para ver las OP de una barra de la cascada |
| `search` | texto | `CodigoOP`, `SKU`, `DescripcionSKU` | Búsqueda libre. Solo filtra `rows` |

| `vista` | OP | Orden | Página del Power BI |
|---|---|---|---|
| `detalle` | Todas las del periodo | Fecha recomendada y OP descendentes | — (nueva: detalle completo) |
| `razones` | Con razón distinta de `CUMPLE` (incluye `NO MEDIR`), sin importar el estado | Descripción de SKU | Tabla de "Razones Día" |
| `control` | Estado `no` y sin razón registrada | Fecha recomendada ascendente | "Control" |

Reglas de los filtros:

- Todos se aplican en SQL, con parámetros (`request.input`).
- `summary` aplica solo el periodo; `vista`, `cumplimiento`, `razon` y `search` no lo cambian, igual que en el Power BI, donde la tabla y las gráficas responden solo al segmentador de fecha.
- `filterOptions` usa solo el periodo.

### Respuesta

```json
{
  "rows": [
    {
      "orderNumber": 22145678,
      "type": "O",
      "sku": "CODIGO-SKU",
      "skuDescription": "Descripción del SKU",
      "line": "MBL",
      "family": "MBL",
      "status": "Cerrado",
      "postingDate": "2026-10-01",
      "recommendedReleaseDate": "2026-10-03",
      "actualReleaseDate": "2026-10-06",
      "promisedItemDate": "2026-10-20",
      "compliance": "no",
      "reason": "CAPACIDAD DEL DIA FULL",
      "reasonOriginal": "CAPACIDAD DEL DIA FULL",
      "reasonComment": null,
      "dateChanged": false
    }
  ],
  "years": [2026, 2025],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 0 },
  "summary": {
    "compliance": 0.885,
    "target": 0.98,
    "total": 0,
    "ok": 0,
    "no": 0,
    "notReleased": 0,
    "notMeasured": 0,
    "withoutReason": 0,
    "daily": [{ "date": "2026-10-01", "ok": 0, "no": 0, "compliance": 0.0 }],
    "monthly": [{ "year": 2026, "month": 10, "ok": 0, "no": 0, "compliance": 0.0 }],
    "yearly": [{ "year": 2026, "ok": 0, "no": 0, "compliance": 0.0 }],
    "reasons": [{ "name": "CAPACIDAD DEL DIA FULL", "orders": 0, "share": 0.0 }]
  },
  "filterOptions": { "reasons": [] },
  "source": "sql-server",
  "loadedAt": "2026-11-20T17:15:04.000-05:00",
  "reasonsSyncedAt": "2026-11-20T12:54:38.000-05:00",
  "updatedAt": "2026-11-20T17:20:00.000Z"
}
```

Los valores del ejemplo son ilustrativos; el endpoint solo devuelve datos reales.

Reglas de cada campo:

| Campo | Regla | Medida o visual del BI |
|---|---|---|
| `rows` | Una fila por OP según `vista` y los filtros de `rows`. Paginada. `reason` es la razón normalizada y `reasonOriginal` el texto tal como se registró; `null` si la OP no tiene razón | Tablas de "Razones Día" y "Control" |
| `summary.compliance` | `ok / (ok + no)`; `null` si `ok + no = 0` | `%Cumplimiento` |
| `summary.target` | Constante `0.98` en la API | Línea "META: 98%" de los dos visuales de cumplimiento |
| `summary.total` | OP del periodo, en cualquier estado | — |
| `summary.ok`, `no`, `notReleased`, `notMeasured` | OP del periodo en cada estado | `Cumplimiento` (conteo) |
| `summary.withoutReason` | OP `no` sin razón registrada (lo que muestra la vista `control`) | Lista de "Control" |
| `summary.daily` | Por fecha recomendada del periodo: `ok`, `no` y `compliance` | Columnas 100 % de "Cumplimiento Liberación" (eje: día) |
| `summary.monthly` | Por mes del año `anio` (o del año en curso), los 12 meses: `ok`, `no`, `compliance`. **No aplica `mes`, `dia` ni el rango** | "Acum Cumplimiento Liberación", nivel mes. El trimestre se suma en el frontend con estos conteos |
| `summary.yearly` | Por año, toda la tabla. **No aplica ningún filtro de periodo** | "Acum Cumplimiento Liberación", nivel año |
| `summary.reasons` | Entre las OP `no` del periodo que tienen razón: OP por `RazonNormalizada`, de mayor a menor; `share = orders / suma de orders` | Cascada "% RAZONES INCUMPLIMIENTO" (filtro `Cumplimiento = NO`) |
| `filterOptions.reasons` | Razones normalizadas de las OP del periodo | Para el filtro `razon` |
| `years` | Años con fecha recomendada en la tabla | Segmentador Año |
| `loadedAt` | `MAX(UltimaCarga)` de `Informe_liberacion`: última carga de OP | — |
| `reasonsSyncedAt` | `MAX(Sincronizado)` de `Informe_liberacion_razones`: última llegada de razones desde Supabase | — |
| `updatedAt` | Hora de la respuesta, igual que en facturación | — |

Decisiones de este contrato (aprobadas el 2026-11-20):

- **A. Razones normalizadas.** El Power BI agrupaba por el texto tal cual, así que las variantes del Excel (`ERROR DE LIBERACIÓN` con tilde, `CAPACIAD DEL DIA FULL`, `CAMBIO SKU`) salían como barras separadas. El portal las suma en su razón del catálogo. El % de cumplimiento no cambia, porque `CUMPLE` y `NO MEDIR` no tienen variantes.
- **B. Una razón por OP.** La cascada cuenta OP, no filas del Excel. Coincide con el Power BI porque el Excel ya no tiene OP repetidas (pregunta 8).
- **C. Estado con la fecha del día.** Se calcula en cada consulta y no al actualizar, como hacía el Power BI. Puede dar diferencias de un día en la conciliación del mes en curso, nunca en meses cerrados.
- **D. Detalle completo nuevo** (`vista = detalle`), con familia, estado y fechas, para la pregunta 10. El Power BI solo tenía las tablas de razones y de control.
- **E. `withoutReason` y `reasonsSyncedAt` nuevos**, para que Planeación vea cuántas OP le falta justificar y desde cuándo no llegan razones.

No se incluyen: los botones "Atrás" del Power BI, `Tipo` o familia como filtros (pendiente de la pregunta 11), "cumple con cambio de fecha" como estado aparte (pregunta 15; por ahora solo viaja en `rows.dateChanged`) ni exportación a Excel (el Power BI no la tenía).

## 4. Endpoint

- Repositorio `reporting-api`, rama `bi/liberacion`, commits `44d7a1f` (endpoint) y `c623a19` (README y `.env.example`).
- Archivos: `src/liberacion.ts` (tipos, `buildReleaseQuery`, `getReleaseReport` y la recepción de razones), `src/server.ts` (`releaseFiltersFrom` y la ruta `/api/v1/liberacion`) y `src/db.ts` (exporta `required`, `numberValue`, `textValue`, `dateValue` y `safeIdentifier`, igual que la rama de Estados Financieros). Va en un módulo aparte, como Estados Financieros, para no chocar con `db.ts` y `types.ts` de las demás ramas.
- Variables nuevas en `.env.example`: `REPORT_LIBERACION_TABLE_SCHEMA`, `REPORT_LIBERACION_TABLE` y `REPORT_LIBERACION_RAZONES_TABLE`. Tienen valores por defecto en el código (`dbo`, `Informe_liberacion`, `Informe_liberacion_razones`), así que el `.env` del servidor funciona sin agregarlas.
- Una sola consulta por lotes: `#ops` (OP del periodo con razón y estado) → `#rows` (vista y filtros del detalle) → 10 recordsets: 0 página, 1 total, 2 totales, 3 serie diaria, 4 serie mensual (12 meses), 5 serie anual, 6 razones, 7 años, 8 catálogo de razones, 9 `loadedAt` y `reasonsSyncedAt`.
- `npm run build` sin errores (2026-11-20). SQL revisado: 10 recordsets comentados, paréntesis balanceados, filtros parametrizados, sin `TRY_CONVERT` ni `SELECT *`.
- Prueba local sin base: `/api/v1/liberacion` responde 401 sin token y con el token de razones; `POST /api/v1/liberacion/razones` responde 401 con el token de consultas. Cada token solo abre su ruta.
- Prueba contra la base. [`sql/liberacion/04_validacion_endpoint.sql`](../../sql/liberacion/04_validacion_endpoint.sql) es la misma consulta del endpoint con `anio=2026`, `mes=10`, `vista=detalle`, generada desde `buildReleaseQuery`, para correrla en SSMS antes de desplegar. Esperado: octubre de 2026 con 1 989 `ok` y 258 `no`.
- Resultado (desarrollador, 2026-11-20, antes de la carga de las 17:15): totales de octubre 1 989 `ok`, 258 `no`, 8 `noMedir`, 2 255 OP y `withoutReason` 0. La serie diaria suma 1 989 y 258. La mensual de 2026 es idéntica a la comparada con el Power BI. La anual es la suma de sus meses: 2025 = 2 955 / 1 732; 2026 = 21 038 / 3 856. La cascada suma 258 (la primera razón es `FALTA O PROBLEMAS DE MP`, con 82). `loadedAt` 12:12:30 y `reasonsSyncedAt` 12:54:38, con desfase −05:00. Consulta validada; `pendiente`: despliegue.
- Paquete de despliegue: `reporting-api-dist-d5a34f6.zip` (en el escritorio, fuera de los repositorios), desde la rama local `deploy/2026-11-20` = `deploy/2026-11-19` + `bi/liberacion`. Conflictos de "ambos agregaron" en `src/server.ts`, resueltos conservando las dos partes; frente a `deploy/2026-11-19` solo cambian las líneas de la ruta nueva. Reemplaza a `reporting-api-dist-2b6f75b.zip`.

## 5. Dashboard

Pedido del desarrollador (2026-11-20): las 5 páginas del Power BI, lo más parecidas posible. Estructura tomada del `.pbip` (posición, tipo y configuración de cada visual) y de las capturas de octubre de 2026.

| Ruta | Página del Power BI | Contenido |
|---|---|---|
| `/liberacion` | Cumplimiento Liberación | Resumen del periodo (% frente a la meta, cumplen, no cumplen con las que no tienen razón, fuera del indicador) y columnas 100 % por fecha recomendada: OK y NO con su % de dos decimales dentro de cada tramo y la línea "META: 98 %" |
| `/liberacion/acumulado` | Acum Cumplimiento Liberación | Las mismas columnas por Año, Trimestre o Mes (botones en lugar de profundizar con clic). Se agrupa la serie diaria del periodo, ya filtrada en SQL, así que con un mes elegido cada nivel muestra solo ese mes, como el Power BI |
| `/liberacion/razones` | Razones | Pareto "% razones de incumplimiento" de las OP `no`: cada razón flota sobre el acumulado, etiquetas sin decimales, barra "Total" y línea "PARETO: 80 %" (la cascada del Power BI tiene esa línea fija en 0,8) |
| `/liberacion/razones-dia` | Razones Día | Tabla (OP, descripción, observación, fecha recomendada, tipo; vista `razones`, ordenada por descripción) y el Pareto lado a lado desde 1 120 px. Filtro de observación en "Filtros" |
| `/liberacion/control` | Control | Las 8 columnas del Power BI (vista `control`), de la fecha recomendada más antigua a la más reciente |

- Archivos: [`components/LiberacionDashboard.tsx`](../../components/LiberacionDashboard.tsx) (las 5 vistas con `mode`), páginas en [`app/liberacion/`](../../app/liberacion/), proxy [`app/api/liberacion/route.ts`](../../app/api/liberacion/route.ts), tipos [`lib/liberacion/types.ts`](../../lib/liberacion/types.ts), estilos [`app/styles/liberacion.css`](../../app/styles/liberacion.css).
- Catálogo: informe `liberacion` en [`lib/reports.ts`](../../lib/reports.ts), área Logística; navegación `releaseNavigation` con las 5 páginas en el orden del Power BI. Nadie lo ve hasta asignarlo en `/admin/permisos` (usuario de la ficha: `practiplaneacion@firplak.com`).
- Filtros en borrador (Aplicar, lupa o Enter; Limpiar vuelve al mes en curso): año, mes y día en la barra, como el segmentador Año › Mes › Día; desde y hasta en "Filtros"; búsqueda en las tablas. Todos viajan a la API.
- Clic o Enter en una OP abre su detalle: tipo, línea, familia, estado, las cuatro fechas, la observación (con el texto original si se normalizó), el comentario y el cambio de fecha. Así se cubre la decisión D del contrato sin una página que el Power BI no tiene.
- Diferencia visual inevitable: los colores. El Power BI usa fondo `#CCC3C3` y azules de Power BI; el portal usa la paleta del manual de identidad (OK en navy, NO en sage, líneas de meta y Pareto en `--danger`, agregado a `lib/brand.ts` como réplica del token).
- Gráficos con muchas columnas se desplazan en horizontal en lugar de comprimirse; las etiquetas se ocultan si la columna es muy angosta y el valor sigue en el tooltip.
- Verificación (2026-11-20): `npm run lint` y `npm run build` sin errores; `/liberacion` sin sesión redirige al login y `/api/liberacion` responde 401. Revisión con datos reales (desarrollador, 2026-11-20, noviembre de 2026, escritorio): las 5 páginas cargan y cuadran con la validación de la fase 2 (92,8 %, 1 379 OK, 107 NO, 7 sin razón). Se corrigieron la posición de las etiquetas de meta y Pareto, el título del eje cortado y el Pareto compacto de Razones por día. `pendiente`, aplazado por el desarrollador: revisión en 375 y 820 px y asignar el permiso en `/admin/permisos`.

## 6. Conciliación con Power BI

Script de solo lectura: [`sql/liberacion/05_conciliacion.sql`](../../sql/liberacion/05_conciliacion.sql) (septiembre a noviembre de 2026: % por mes y por día, Pareto por mes y OP sin razón). Regla para comparar: **actualizar el Power BI y correr el script el mismo día, antes de las 17:00**, porque a esa hora el SP de origen recalcula `Indicador_Liberacion` (y con él meses ya cerrados) y a las 17:15 se copia al portal.

| Indicador | Mes 2026 | Portal | Power BI | Diferencia |
|---|---|---|---|---|
| % cumplimiento | Agosto | 85,43 % | 85,43 % | 0 |
| % cumplimiento | Septiembre | 79,68 % | 79,68 % | 0 |
| % cumplimiento | Octubre | 88,52 % | 88,52 % | 0 |
| % cumplimiento | Noviembre (en curso) | 92,8 % | `pendiente` | |
| % por día | Octubre | 14 de 20 días iguales | Captura del desarrollador | Ver hallazgo |
| Pareto: primera razón | Octubre | `FALTA O PROBLEMAS DE MP`, 82 de 258 (31,8 %) | `FALTA O…` 33 % (captura) | Ver hallazgo |
| OP sin razón (Control) | Octubre | 0 | 0 (tabla vacía en la captura) | 0 |
| OP sin razón (Control) | Noviembre | 7 | `pendiente` | |

**Hallazgo (2026-11-20), `pendiente` de confirmar.** La captura diaria de octubre del Power BI coincide en 14 de 20 días y difiere por 1 a 3 OP en los días 7, 21, 23, 26, 27, 28 y 29 (por ejemplo, el 27: portal 44 OK / 15 NO = 74,58 %; Power BI 73,33 %, que equivale a 44 / 16). El Acum de octubre de esa captura dio 88,31 %, cuando una hora antes había dado 88,52 %, y el Pareto difiere en el mismo sentido. Hipótesis: la captura se tomó con el Power BI actualizado después de la recarga de las 17:00, mientras el portal seguía con la carga de las 12:12. Si es así, octubre cambió en el origen en un solo día, lo que confirma el riesgo de la pregunta 12. Se confirma comparando de nuevo después de la carga del portal de las 17:15.

**Comparación del mismo día (desarrollador, 2026-11-24, antes de las 17:00; portal con la carga del 2026-11-23 17:15):**

| Mes 2026 | Portal (resultado 1 de `05_conciliacion.sql`) | Power BI | Diferencia |
|---|---|---|---|
| Septiembre | 1 863 OK / 475 NO = 79,68 % | 79,68 % | 0 |
| Octubre | 1 989 OK / 257 NO = 88,56 % | 88,56 % | 0 |
| Noviembre (antes de recargar Supabase) | 1 561 OK / 200 NO = 88,64 % | 90,51 % | 1,87 puntos |
| Noviembre (después de recargar Supabase) | 1 593 OK / 167 NO = 90,51 % | 90,51 % | 0 |

- **Hallazgo del 2026-11-20, resuelto:** octubre pasó de 88,52 % (1 989 / 258) a 88,56 % (1 989 / 257) en los dos sistemas. La diferencia diaria venía de comparar fotos de horas distintas, y confirma que en el origen los meses cerrados cambian (pregunta 12).
- **Hallazgo de noviembre, resuelto el mismo día:** con el mismo total, el 90,51 % del Power BI equivale a unas 1 594 OK y 167 NO, unas 33 OP más con `CUMPLE`. Causa probable: el Power BI lee el Excel de razones en vivo y Supabase se cargó desde el Excel por última vez el 2026-11-20 09:55; Logística sigue diligenciando el Excel y lo nuevo no ha llegado al portal. Septiembre y octubre ya estaban justificados antes de esa carga. Confirmado: el Excel del 2026-11-23 12:44 traía 48 OP nuevas (38 `CUMPLE`, 4 `NO MEDIR`) y 1 editada. Se recargó Supabase, Supabase envió las razones al portal a las 9:00 (`Cargas_Log` Id 4010, 40 540 razones) y noviembre quedó en 90,51 %, igual al Power BI.
- **Consecuencia:** mientras Logística use el Excel, el mes en curso del portal se atrasa hasta la siguiente recarga manual de Supabase. Se resuelve cuando Logística registre las razones en la app (Supabase como única fuente) o, mientras tanto, automatizando la recarga del Excel.

**Resultado:** septiembre, octubre y noviembre de 2026 coinciden con el Power BI al decimal, con el Power BI y el portal comparados el mismo día y las razones al día. Las diferencias encontradas se explican por la hora de la foto o por razones del Excel que aún no estaban en Supabase, nunca por la regla.

**Firma del dueño de negocio:** Logística — fecha — `pendiente`.

## 7. Despliegue y retiro

Iniciada el 2026-11-24 por decisión del desarrollador, con la firma de Logística de la fase 6 `pendiente`.

| Pieza | Estado |
|---|---|
| SQL Server | Tablas, SP, permisos y job en producción desde el 2026-11-20 (scripts en [`sql/liberacion/`](../../sql/liberacion/)) |
| Supabase (Manufactura) | Vista, función de envío y job `liberacion-enviar-razones` activos desde el 2026-11-20 |
| Recarga del Excel a Supabase | Automática desde el 2026-11-24: tarea «Logistica - Recarga razones liberacion» en el equipo del desarrollador, lunes a viernes 16:30, con verificación antes de cargar (proyecto Logística, `scripts/recargar-razones.mjs`). Se retira cuando Logística registre las razones en su app |
| Reporting API | Desplegada el 2026-11-20 (`reporting-api-dist-d5a34f6.zip`). Rama `bi/liberacion` subida a GitHub; el merge a `main` lo hace el desarrollador |
| Frontend | Rama `bi/liberacion` subida a GitHub; el merge a `main` lo hace el desarrollador. `pendiente`: despliegue en Vercel con el merge, asignar el permiso `liberacion` en `/admin/permisos` y la revisión en 375 y 820 px |
| Documentación | Ficha, [Reporting API](../components/reporting-api.md), [Frontend](../components/frontend.md) y log al día. VibeWorkFlow: `pendiente` |
| Firma de Logística (fase 6) y respuestas a las 16 preguntas | `pendiente` |
| Retiro del Power BI | `pendiente`: después de la firma y de un periodo en paralelo |

Rollback:

- Frontend: quitar el informe `liberacion` de `lib/reports.ts` o revertir el merge; el Power BI sigue funcionando porque no se tocó nada de su origen.
- API: desplegar el paquete anterior a `reporting-api-dist-2b6f75b.zip`.
- SQL Server: deshabilitar el job `BI - Liberacion carga` y aplicar el rollback de cada script. `FPK_INDICADOR_LIBERACION` e `Indicador_Liberacion` no cambian.
- Supabase: `select cron.unschedule(liberacion-enviar-razones);` y el rollback de la migración.
- Recarga automática: `Unregister-ScheduledTask -TaskName "Logistica - Recarga razones liberacion"`.
