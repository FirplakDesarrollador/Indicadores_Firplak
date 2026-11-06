---
status: en-migracion
fase: 6
updated: 2026-11-06
sources:
  - ../../bi-origen/bi-costo-actual-pt/
---

# BI: Costo actual de producto terminado

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `BI Costo producto terminado` ([proyecto .pbip](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.pbip)) |
| Dueño de negocio (valida las cifras) | Contabilidad |
| Desarrollador responsable | Daniel Jimenez |
| Usuarios y frecuencia de uso | Contabilidad: alexandra.arbelaez@firplak.com, alexandra.florez@firplak.com; uso diario |
| Prioridad | Alta |
| Rama | `bi/costo-actual-pt` |

## 1. Análisis

Analizado el 2026-11-04 a partir del proyecto [`BI Costo producto terminado.pbip`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.pbip). El modelo está en [`definition/tables/`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.SemanticModel/definition/tables/) y los visuales en [`definition/pages/ReportSection/`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.Report/definition/pages/ReportSection/). Validado con datos por el desarrollador el 2026-11-04 (V1–V7): ver [Resultados](#resultados-ejecutados-por-el-desarrollador-el-2026-11-04). Falta la validación de Contabilidad.

**Decisión del desarrollador (2026-11-04):** la migración **no** usa el SQL del Power BI. Usa el query optimizado [`query-optimizado.sql`](../../bi-origen/bi-costo-actual-pt/query-optimizado.sql), que el desarrollador ya había reescrito sin cursores y con cambios en algunas reglas de negocio. El SQL original queda como referencia en [`query-original-powerbi.sql`](../../bi-origen/bi-costo-actual-pt/query-original-powerbi.sql), extraído literalmente de la partición M de `Maestro`. Como cambian las reglas, **las cifras del portal no van a coincidir exactamente con las del Power BI**: ver [Diferencias de reglas](#diferencias-de-reglas-power-bi-vs-query-optimizado).

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|
| `Maestro` | `Sql.Database` (import) | Servidor `ITPLAKINFO`, base `FIRPLAK_SA` (SAP Business One): `OITM`, `ITT1`, `OITW`, `OPLN` + `ITM1` | Explosión de la lista de materiales de cada artículo con lista: una fila por línea (producto, encabezados y componentes) hasta el nivel 4. Script de 491 líneas con cursores anidados. |
| `Nivel 1` | `Sql.Database` (import) | El mismo SQL de `Maestro` | Se queda solo con las filas `Nivel = 1`, una por producto. Sirve de catálogo para los segmentadores. |
| `DateTableTemplate_…` | Plantilla automática de fechas de Power BI | — | No migrar: el modelo no tiene columnas de fecha. |

Las dos fuentes son SQL Server en `ITPLAKINFO`, la misma instancia de `Planos_Symphony`. Eso quedó confirmado en [notas crédito](notas-credito.md#fuentes-de-datos), así que el SP puede leer `FIRPLAK_SA.dbo.<tabla>` con nombres de tres partes, sin servidor vinculado. No hay fuentes de Excel ni SharePoint.

#### Reglas del query optimizado (base de la migración)

1. **Productos (nivel 1):** artículos de `OITM` que no están inactivos (`frozenFor = 'N'`) y tienen lista de materiales en `ITT1` (`Father`). La cantidad del producto es 1.
2. **Explosión:** niveles 2, 3 y 4 desde `ITT1`, ordenados por `ChildNum`. La cantidad de cada línea se acumula: es la cantidad del componente multiplicada por la de sus padres. Un componente del nivel 4 que tenga su propia lista **no** se explota más: se costea como hoja. **En la migración esto cambia (D9):** el SP explota hasta la última hoja.
3. **Costo por línea:**
   - Las **hojas** (componentes sin lista) cuestan su costo unitario por la cantidad acumulada.
   - Los **encabezados** (componentes con lista, en los niveles 2 y 3) cuestan 0, porque su costo está en sus hijos.
   - El **producto** (nivel 1) cuesta la suma de todas sus líneas.
4. **Costo unitario de una hoja:** es el primer `OITW.AvgPrice` mayor que 0 en este orden: la bodega indicada en la lista (`ITT1.Warehouse`), luego `MP-01` y luego `PT-01`. Si ninguno tiene costo, queda en 0 con la alerta `SIN COSTO EN SAP`.
5. **Clasificación del costo** según las propiedades del artículo en SAP:
   - `QryGroup39 = 'Y'`: mano de obra (`Costo_Mo`).
   - `QryGroup40 = 'Y'`: CIF (`Costo_Cif`).
   - Ninguna de las dos: materia prima (`Costo_Mp`).

   `Costo_Total = Costo_Mp + Costo_Mo + Costo_Cif`.
6. **Alerta** por línea (columna nueva):
   - `ITEM INACTIVO`: el componente tiene `frozenFor = 'Y'`. Aplica a encabezados y hojas.
   - `SIN COSTO EN SAP`: la hoja no tiene costo en ninguna de las tres bodegas.
   - `INACTIVO | SIN COSTO EN SAP`: ambas a la vez.

#### Diferencias de reglas (Power BI vs. query optimizado)

Estas diferencias explican las cifras distintas que van a aparecer en la conciliación (fase 6). Contabilidad debe aceptarlas.

| # | Tema | Power BI (SQL original) | Query optimizado | Efecto esperado |
|---|---|---|---|---|
| D1 | Qué productos entran | `validFor = 'Y'` | `frozenFor = 'N'` | Ninguno: los campos son complementarios (V2, 11.244 productos en ambos). |
| D2 | Tercer recurso del costo unitario | Precio de la **lista de precios 10** (`ITM1.Price`) | `AvgPrice` de la bodega **`PT-01`** | Cambian las hojas sin costo en su bodega ni en `MP-01`. Ver V5. |
| D3 | Costo de materia prima | Varía por nivel: en el nivel 2, `AvgPrice` en la bodega de la lista; en los niveles 3 y 4, el costo unitario (bodega → `MP-01` → lista 10). Si queda en 0, usa `OITM.AvgPrice` cuando el artículo tiene costo estándar (`EvalSystem = 'S'`). | El mismo costo unitario de la regla 4 para MP, MO y CIF. Ya no usa el costo estándar de `OITM`. | Cambian los artículos con costo estándar o sin registro en la bodega de la lista. Ver V6. |
| D4 | Condición de materia prima | `QryGroup39 = 'N' AND QryGroup39 = 'N'` (error: repite el 39) | `QryGroup39 = 'N' AND QryGroup40 = 'N'` | Sin efecto esperado: en el original, los bloques posteriores ya ponían en 0 la materia prima de los artículos CIF. |
| D5 | Cantidades | Fórmulas distintas por nivel. Ejemplos: la hoja del nivel 3 con costo estándar no multiplica por la cantidad del nivel 2 ([línea 356](../../bi-origen/bi-costo-actual-pt/query-original-powerbi.sql)), la hoja del nivel 4 no multiplica por la del nivel 3 (línea 276), y la hoja del nivel 3 busca su costo en la bodega del recorrido anterior (`@Bodega3_`, línea 331). | Siempre costo unitario × cantidad acumulada | Corrige costos de los niveles 3 y 4. |
| D6 | Valores heredados | `SELECT @variable = … WHERE …` sin filas **conserva el valor del componente anterior**. Por ejemplo, una materia prima sin registro en `OITW` para su bodega toma el costo del componente anterior. | Cálculo por conjuntos, sin variables | Corrige costos inflados o desplazados en el original. |
| D7 | Artículo con `QryGroup39 = 'Y'` y `QryGroup40 = 'Y'` | Los dos bloques de limpieza se anulan entre sí: costo 0 | Suma el costo **dos veces**, en `Costo_Mo` y en `Costo_Cif` | Hoy ninguno (V3). **Decisión P2:** el SP no lo costea (costo 0) y lo marca con la alerta `MO Y CIF A LA VEZ`. |
| D8 | Columnas de salida | `linea` (orden) y `Padre` (código del producto, usado en la relación) | Ninguna de las dos. Devuelve `Alerta` y calcula internamente `RootCode` y `SortPath`. | La tabla de reporte debe guardar `RootCode` como código del producto y `SortPath` como orden. Se agrega al SP. |
| D9 | Profundidad de la explosión | Hasta el nivel 4: un componente del nivel 4 con lista se costea como hoja | Igual que el Power BI | **Decisión P10:** el SP desglosa todos los niveles (hoy, hasta el 6, V4b). Cambia la clasificación MP/MO/CIF de 3.421 productos y, en algunos casos, su total, porque el componente se costea con sus hijos y no con su propio `AvgPrice`. El SP debe controlar ciclos en las listas. |

Las dos versiones comparten esto: los encabezados cuestan 0 y el producto suma sus líneas. El portal desglosará todos los niveles (D9).

<details><summary>SQL de cada fuente</summary>

- Base de la migración: [`query-optimizado.sql`](../../bi-origen/bi-costo-actual-pt/query-optimizado.sql).
- Original del Power BI (`Maestro` y `Nivel 1`, idénticos): [`query-original-powerbi.sql`](../../bi-origen/bi-costo-actual-pt/query-original-powerbi.sql).

</details>

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|
| `Maestro` | `Origen` | Ejecuta el SQL contra `ITPLAKINFO` / `FIRPLAK_SA` | Sí, reemplazado por el query optimizado |
| `Nivel 1` | `Filas filtradas` | `Table.SelectRows(Origen, each [Nivel] = 1)`: solo productos | No: el catálogo de productos sale de la tabla con `Nivel = 1` en la API |

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `Maestro.Padre` | `'Nivel 1'.Codigo` | Muchos a uno | Única: el producto elegido en `Nivel 1` filtra sus líneas en `Maestro` |

`Padre` es el código del producto (nivel 1) en todas las líneas de su explosión. En la tabla nueva se reemplaza por la columna `CodigoPT` (`RootCode` del query optimizado), sin necesidad de una segunda tabla.

### Indicadores (medidas DAX)

Todas las tarjetas filtran `Maestro[Nivel] = 1`, es decir, operan sobre los productos y no sobre sus componentes. Con un producto seleccionado, el total y el promedio son iguales al costo de ese producto. Sin selección, operan sobre todos los productos.

| Indicador | Regla de negocio | DAX original | Vivirá en (SP / summary API / frontend) |
|---|---|---|---|
| Total costo | Suma del costo total de los productos seleccionados | `SUM(Maestro[Costo_Total])` (agregación implícita) con filtro `Nivel = 1` | summary API |
| Promedio costo total | Promedio del costo total por producto | `AVERAGE(Maestro[Costo_Total])` (implícita) con filtro `Nivel = 1` | summary API |
| Costo sin CIF | Materia prima + mano de obra de los productos seleccionados | `SUM(Maestro[Costo_Total]) - SUM(Maestro[Costo_Cif])` | summary API |
| Costo sin CIF promedio | Promedio por producto de materia prima + mano de obra | `AVERAGE(Maestro[Costo_Total]) - AVERAGE(Maestro[Costo_Cif])` | summary API |
| Costo por componente | `Costo_Mp` de cada línea de la lista de materiales | Columna `Costo_Mp` (suma implícita) en la tabla | SP (por fila) |
| Composición sin CIF | Costo total por componente (nivel > 1), sin los que tienen "CIF" en la descripción | `SUM(Maestro[Costo_Total])` por `Descripcion` | summary API |

Medidas sin uso en visuales (no migrar, confirmar): ninguna. Las dos medidas del modelo se usan.

### Visuales y filtros

Una página, "Producto Terminado y Lista de Materiales".

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|
| Página 1 | Tarjeta "Total Costo" | Suma de `Costo_Total` | Filtro `Nivel = 1` |
| Página 1 | Tarjeta "Promedio Costo Total" | Promedio de `Costo_Total` | Filtro `Nivel = 1` |
| Página 1 | Tarjeta "Promedio Costo Total sin CIF" (arriba) | `Costo sin CIF` (**suma**, pese al título) | Filtro `Nivel = 1` |
| Página 1 | Tarjeta "Promedio Costo Total sin CIF" (abajo) | `Costo sin CIF Prom` | Filtro `Nivel = 1` |
| Página 1 | Tabla "Lista de Materiales" | Suma de `Costo_Mp`, con la columna titulada **"Total Costo"** | `Nivel`, `Codigo`, `Descripcion`, `Cantidad`, `UnidadMedida` (UM); ordenada por `linea`. Sin filtro de nivel: incluye la fila del producto. |
| Página 1 | Torta "Lista Materiales sin CIF" | Suma de `Costo_Total` | `Maestro[Descripcion]`; filtros `Nivel ≠ 1` y `Descripcion` no contiene "CIF" |
| Página 1 | Logo Firplak y título | Decorativos | — (el portal ya tiene su encabezado) |

Filtros y segmentadores (visual personalizado `AttributeSlicer`):

| Filtro | Columna de origen | Valores reales (confirmados) |
|---|---|---|
| Código | `'Nivel 1'[Codigo]` → `Maestro[Padre]` | Códigos de los productos con lista: `pendiente` de contar (V2) |
| Producto | `'Nivel 1'[Descripcion]` → `Maestro[Padre]` | Descripciones de los mismos productos |

No hay filtros de página ni de informe. Tampoco hay filtro de fecha: el informe muestra el costo **actual**, sin historia.

### Seguridad (RLS)

- ¿Tiene roles? No (no hay `role` en el modelo).
- Reglas: ninguna. En el portal, el acceso se controla con el permiso del informe (`lib/reports.ts` y `/admin/permisos`) para las usuarias de la sección 0.

### Riesgos y preguntas para el dueño de negocio

Riesgos técnicos:

- **Reglas nuevas:** las cifras cambian respecto del Power BI (D1 a D7). La conciliación de la fase 6 debe comparar el dashboard contra el query optimizado y explicar las diferencias con el Power BI producto por producto.
- **Doble clasificación (D7):** hoy no hay casos (V3). Si aparecen artículos con `QryGroup39` y `QryGroup40` en `'Y'`, el query optimizado sumaría su costo dos veces. El SP no los costea y los marca con una alerta (P2).
- **Profundidad:** las listas con más de 4 niveles se truncan en las dos versiones. Afecta a 3.421 productos y 13.214 líneas en el nivel 5 (V4). Solo 1 producto llega al nivel 6 (24 líneas, V4b). Ver P10.
- **Líneas sin costo:** unas 13.000 hojas no tienen costo en ninguna de las tres bodegas (V5). Todas son MP (V5b): 12.055 líneas son de artículos que no son de inventario, y 982 líneas (630 artículos) son de inventario sin costo en SAP. Ver P11.
- **No es incremental:** el costo promedio cambia con cada movimiento de inventario y las listas no tienen una marca de modificación que sirva para recalcular la explosión. Se propone una carga completa programada (sección 2), lo que se aparta del patrón incremental de la skill.
- **Lecturas `NOLOCK`:** el query lee SAP sin bloqueos. Es aceptable para una foto de costos, pero puede leer datos a medio escribir durante una transacción.

Preguntas para Contabilidad:

- **P1.** ¿Aceptan las reglas del query optimizado (D1 a D3, D5 y D6) como las correctas, aunque cambien las cifras respecto del Power BI?
  - **Respuesta (2026-11-04):** sí, se aceptan las reglas corregidas.
- **P2.** Si un artículo es mano de obra y CIF a la vez (D7), ¿a cuál de los dos va su costo? ¿O no debería existir ese caso?
  - **Respuesta (2026-11-04, precisada por el desarrollador):** no debe permitirse. Un artículo con `QryGroup39` y `QryGroup40` en `'Y'` **no se costea**: sus costos quedan en 0, sin clasificación, y la línea lleva la alerta `MO Y CIF A LA VEZ` (`AlertaMoCif = 1`).
- **P3.** En la tabla "Lista de Materiales", la columna "Total Costo" muestra solo la **materia prima**: las líneas de mano de obra y CIF aparecen en 0. ¿Mostramos las columnas MP, MO, CIF y Total por separado?
  - **Respuesta (2026-11-04):** sí. La tabla muestra las columnas MP, MO, CIF y Total por separado.
- **P4.** La torta "sin CIF" excluye los componentes por el **texto** "CIF" en la descripción, no por su clasificación en SAP. ¿La excluimos por clasificación (`QryGroup40`)? ¿La mano de obra debe aparecer en la torta?
  - **Respuesta (2026-11-04):** sí. La torta excluye el CIF por su clasificación en SAP (`QryGroup40 = 'Y'`), no por el texto. La mano de obra se mantiene en la torta (confirmado).
- **P5.** La tarjeta de arriba se titula "Promedio Costo Total sin CIF", pero muestra la **suma**. ¿Se renombra a "Costo total sin CIF"?
  - **Respuesta (2026-11-05):** las cuatro tarjetas se titulan "Costo total", "Costo promedio", "Costo sin CIF" y "Costo promedio sin CIF" (aprobado por el desarrollador con el plan de la fase 5).
  - **Cambio (2026-11-05):** al revisar el dashboard, el desarrollador pidió quitar "Costo promedio" y "Costo promedio sin CIF". Con un solo producto elegido repetían el total. Quedan "Costo total" y "Costo sin CIF".
- **P6.** Sin producto seleccionado, "Total Costo" suma el costo de **todos** los productos, una cifra sin sentido de negocio. ¿Las tarjetas se muestran solo con un producto seleccionado, o se reemplazan por el número de productos y el costo promedio?
  - **Respuesta (2026-11-04):** opción a. Las tarjetas solo se muestran con un producto seleccionado. Sin selección, el dashboard invita a elegir un producto.
- **P7.** El universo incluye todo artículo con lista de materiales, también semielaborados y subensambles. ¿Se limita a producto terminado? Si es así, ¿con qué criterio de SAP (grupo de artículos, propiedad)?
  - **Respuesta (2026-11-04):** se incluyen los semielaborados. El universo es todo artículo activo con lista de materiales, como en el query optimizado.
- **P10.** El 30 % de los productos tiene listas de más de 4 niveles (V4). ¿Explotamos todos los niveles (cambia el desglose MP/MO/CIF de esos productos, no necesariamente su total) o mantenemos el corte en 4 como hoy?
  - **Respuesta (2026-11-04):** se desglosan todos los niveles. Es un cambio respecto del query optimizado: ver **D9**.
- **P11.** Hay unas 13.000 líneas de componentes sin costo en SAP, todas de materia prima (V5b). 12.055 son de 345 artículos que no son de inventario: ¿es correcto que cuesten 0? Las otras 982 líneas son de 630 artículos de inventario sin costo promedio en ninguna bodega: ¿se corrigen en SAP antes de salir a producción, o el portal los muestra con la alerta `SIN COSTO EN SAP`?
  - **Respuesta (2026-11-04):** se dejan como están, en 0. Se controlan con la columna `Alerta`, así que el portal debe mostrarla (responde parte de P8).
- **P8.** ¿Mostramos la columna `Alerta` y un indicador de líneas sin costo o inactivas?
  - **Respuesta (2026-11-04):** sí. Se muestra la columna `Alerta` (P11) y un indicador con el número de líneas con alerta, por tipo, que resalte las de `ITEM INACTIVO`.
- **P9.** ¿Basta con el costo actual, o necesitan guardar una foto mensual para comparar el costo entre meses?
  - **Respuesta (2026-11-04):** solo el costo actual. No se guarda historia: la carga completa reemplaza la foto anterior.

Respuestas transmitidas por el desarrollador el 2026-11-04: P1 a P4 y P6 a P11. P5 (título de la tarjeta) se decide en la fase 5.

**Validación del dueño de negocio:** Contabilidad (por medio de Daniel Jimenez) — 2026-11-04 — reglas aprobadas. Fase 1 cerrada.

### Consultas de validación para el desarrollador

Ejecutar en `ITPLAKINFO.FIRPLAK_SA` (solo lectura) y pegar los resultados aquí.

```sql
-- V1. Tiempo y volumen del query optimizado:
-- ejecutar query-optimizado.sql en SSMS y anotar la duración y las filas devueltas.

-- V2. Productos según el criterio original (validFor) y el nuevo (frozenFor)
SELECT t.validFor, t.frozenFor, COUNT(*) AS productos
FROM OITM t WITH (NOLOCK)
WHERE EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = t.ItemCode)
GROUP BY t.validFor, t.frozenFor;

-- V3. Componentes que son mano de obra y CIF a la vez (D7)
SELECT i.ItemCode, i.ItemName, COUNT(*) AS lineas_bom
FROM OITM i WITH (NOLOCK)
INNER JOIN ITT1 c WITH (NOLOCK) ON c.Code = i.ItemCode
WHERE i.QryGroup39 = 'Y' AND i.QryGroup40 = 'Y'
GROUP BY i.ItemCode, i.ItemName;

-- V4. Listas con más de 4 niveles (las líneas del nivel 5 no se costean)
SELECT COUNT(*) AS lineas_nivel_5, COUNT(DISTINCT a.Father) AS productos_afectados
FROM ITT1 a WITH (NOLOCK)
INNER JOIN OITM r WITH (NOLOCK) ON r.ItemCode = a.Father AND r.frozenFor = 'N'
INNER JOIN ITT1 b WITH (NOLOCK) ON b.Father = a.Code
INNER JOIN ITT1 c WITH (NOLOCK) ON c.Father = b.Code
INNER JOIN ITT1 d WITH (NOLOCK) ON d.Father = c.Code;

-- V5. Hojas sin costo en su bodega ni en MP-01 (D2): cuántas usan PT-01
-- y cuántas tenían precio en la lista 10 y ahora quedan en 0
SELECT
    COUNT(*) AS lineas,
    SUM(CASE WHEN pt.AvgPrice > 0 THEN 1 ELSE 0 END) AS usan_pt01,
    SUM(CASE WHEN ISNULL(pt.AvgPrice, 0) = 0 AND l10.Price > 0 THEN 1 ELSE 0 END) AS antes_lista10_ahora_0,
    SUM(CASE WHEN ISNULL(pt.AvgPrice, 0) = 0 AND ISNULL(l10.Price, 0) = 0 THEN 1 ELSE 0 END) AS sin_costo_en_ambos
FROM ITT1 c WITH (NOLOCK)
LEFT JOIN OITW b  WITH (NOLOCK) ON b.ItemCode  = c.Code AND b.WhsCode  = c.Warehouse
LEFT JOIN OITW mp WITH (NOLOCK) ON mp.ItemCode = c.Code AND mp.WhsCode = 'MP-01'
LEFT JOIN OITW pt WITH (NOLOCK) ON pt.ItemCode = c.Code AND pt.WhsCode = 'PT-01'
LEFT JOIN ITM1 l10 WITH (NOLOCK) ON l10.ItemCode = c.Code AND l10.PriceList = 10
WHERE ISNULL(b.AvgPrice, 0) = 0
  AND ISNULL(mp.AvgPrice, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = c.Code);

-- V6. Hojas con costo estándar (EvalSystem = 'S'), que el original costeaba con OITM.AvgPrice (D3)
SELECT COUNT(DISTINCT c.Code) AS componentes_costo_estandar
FROM ITT1 c WITH (NOLOCK)
INNER JOIN OITM i WITH (NOLOCK) ON i.ItemCode = c.Code
WHERE i.EvalSystem = 'S'
  AND NOT EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = c.Code);
```

V7: Contabilidad elige tres productos representativos (uno simple, uno con 4 niveles y uno con mano de obra y CIF). Se compara su costo total en el Power BI y en el query optimizado, y se explica cada diferencia con la tabla D1–D8.

#### Resultados (ejecutados por el desarrollador el 2026-11-04)

| Consulta | Resultado | Lectura |
|---|---|---|
| V1 | 33 segundos, 449.018 filas | Una carga completa diaria es viable. La tabla queda en un volumen manejable con paginación en la API. |
| V2 | `validFor = 'Y'` / `frozenFor = 'N'`: 11.244 productos; `N` / `Y`: 3.141 | Los dos campos son complementarios: **D1 no cambia el universo** (11.244 productos en las dos versiones). |
| V3 | Sin filas | Hoy no hay artículos que sean MO y CIF a la vez: **D7 no afecta las cifras actuales**. El SP agregará un control por si aparecen (P2). |
| V4 | 13.214 líneas en el nivel 5, en 3.421 productos | **Hallazgo:** el 30 % de los productos tiene listas de más de 4 niveles. En esos casos, el componente del nivel 4 se costea con su propio `AvgPrice` y todo su costo va a una sola clasificación (normalmente MP), aunque incluya MO o CIF por dentro. Pasa igual en el Power BI. Ver P10. |
| V5 | 13.095 hojas sin costo en su bodega ni en `MP-01`: 67 usan `PT-01`, 9 tenían precio en la lista 10 y ahora quedan en 0, y 13.019 no tienen costo en ninguna | D2 afecta poco (76 líneas). **Hallazgo:** hay 13.019 líneas sin costo en SAP, que saldrán con la alerta `SIN COSTO EN SAP`. Falta saber qué son: ver V5b. |
| V6 | 484 componentes con costo estándar | Su costo cambia si `OITW.AvgPrice` difiere de `OITM.AvgPrice`. Se verá en V7. |
| V7 | Productos elegidos: `VHPT09-0006-073-0100`, `CBAN05-0002-000-0438`, `CBAN12-0027-000-0406` | Los dos primeros están inactivos y se reemplazaron por `CBAN05-0001-000-0438` y `CMPD04-0268-000-0000`. `CBAN12` **cuadra exacto**. `CBAN05-0001` difiere en 1.817,70 por **D3** (el query corrige). `CMPD04-0268` difiere en 2.094,88 en cuatro hojas del nivel 3 por **D3/D5**: el original no busca la bodega alternativa (verificado por el desarrollador). Ver la tabla abajo. |
| V4b | 24 líneas en el nivel 6 o más, en 1 producto | La profundidad real llega como mucho a 6 niveles en un caso. Explotar todos los niveles (P10) es viable con una CTE recursiva sin tope práctico. |
| V5b | Todas las hojas sin costo son **MP**: 12.055 líneas (345 artículos) no son de inventario (`InvntItem = 'N'`) y 982 líneas (630 artículos) sí lo son | No hay MO ni CIF sin costo. Las que no son de inventario es esperable que no tengan `AvgPrice`. **Las 982 líneas de artículos de inventario sin costo son el faltante real** que Contabilidad debe revisar en SAP (P11). El total (13.037) difiere en 9 líneas del de V5 (13.019 + 9 de la lista 10 = 13.028); se atribuye a cambios en SAP entre ejecuciones (`pendiente` si importa). |

Consultas de seguimiento (solo lectura, `FIRPLAK_SA`):

```sql
-- V4b. ¿Hasta qué profundidad llegan las listas? (líneas en el nivel 6 o más)
SELECT COUNT(*) AS lineas_nivel_6, COUNT(DISTINCT a.Father) AS productos_afectados
FROM ITT1 a WITH (NOLOCK)
INNER JOIN OITM r WITH (NOLOCK) ON r.ItemCode = a.Father AND r.frozenFor = 'N'
INNER JOIN ITT1 b WITH (NOLOCK) ON b.Father = a.Code
INNER JOIN ITT1 c WITH (NOLOCK) ON c.Father = b.Code
INNER JOIN ITT1 d WITH (NOLOCK) ON d.Father = c.Code
INNER JOIN ITT1 e WITH (NOLOCK) ON e.Father = d.Code;

-- V5b. ¿Qué son las hojas sin costo? Por clasificación y por si son artículos de inventario
SELECT
    CASE WHEN i.QryGroup39 = 'Y' THEN 'MO' WHEN i.QryGroup40 = 'Y' THEN 'CIF' ELSE 'MP' END AS clasificacion,
    i.InvntItem AS de_inventario,
    COUNT(*) AS lineas,
    COUNT(DISTINCT c.Code) AS articulos
FROM ITT1 c WITH (NOLOCK)
INNER JOIN OITM i WITH (NOLOCK) ON i.ItemCode = c.Code
LEFT JOIN OITW b  WITH (NOLOCK) ON b.ItemCode  = c.Code AND b.WhsCode  = c.Warehouse
LEFT JOIN OITW mp WITH (NOLOCK) ON mp.ItemCode = c.Code AND mp.WhsCode = 'MP-01'
LEFT JOIN OITW pt WITH (NOLOCK) ON pt.ItemCode = c.Code AND pt.WhsCode = 'PT-01'
WHERE ISNULL(b.AvgPrice, 0) = 0
  AND ISNULL(mp.AvgPrice, 0) = 0
  AND ISNULL(pt.AvgPrice, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM ITT1 x WITH (NOLOCK) WHERE x.Father = c.Code)
GROUP BY CASE WHEN i.QryGroup39 = 'Y' THEN 'MO' WHEN i.QryGroup40 = 'Y' THEN 'CIF' ELSE 'MP' END, i.InvntItem
ORDER BY lineas DESC;
```

**V7, comparación de los tres productos.** En una copia de `query-optimizado.sql` (solo crea tablas temporales), reemplazar el `SELECT` de "RESULTADO FINAL" por:

```sql
SELECT r.RootCode, r.Nivel, r.Codigo, r.Descripcion, r.Cantidad,
       r.CostoUnitario, r.CostoMp, r.CostoMo, r.CostoCif, r.CostoTotal, r.Alerta
FROM #Resultado r
WHERE r.RootCode IN ('VHPT09-0006-073-0100', 'CBAN05-0002-000-0438', 'CBAN12-0027-000-0406')
ORDER BY r.SortPath;
```

En el Power BI, seleccionar cada producto y anotar "Total Costo" y las dos tarjetas "sin CIF". Si hay diferencia, exportar la tabla "Lista de Materiales" para comparar línea por línea.

| Producto | Fuente | Costo total | Costo sin CIF | MP | MO | CIF | Diferencia y causa (D#) |
|---|---|---|---|---|---|---|---|
| `CBAN05-0001-000-0438` | Power BI | 7.607,64 | 7.607,64 | 7.607,64 | 0 | 0 | −1.817,70: D3 |
| `CBAN05-0001-000-0438` | Query optimizado | 9.425,34 | 9.425,34 | 9.425,34 | 0 | 0 | |
| `CMPD04-0268-000-0000` | Power BI | 101.685,78 | 74.901,78 | 55.941,78 | 18.960 | 26.784 | +2.094,88: D3/D5, sin bodega alternativa en el nivel 3 (verificado) |
| `CMPD04-0268-000-0000` | Query optimizado | 99.590,90 | 72.806,90 | 53.846,90 | 18.960 | 26.784 | |
| `CBAN12-0027-000-0406` | Power BI | 235.171,705 | 124.379,705 | 91.819,705 | 32.560 | 110.792 | Sin diferencia |
| `CBAN12-0027-000-0406` | Query optimizado | 235.171,705 | 124.379,705 | 91.819,705 | 32.560 | 110.792 | Sin diferencia |

`CBAN12-0027-000-0406` (resultado del 2026-11-04): lista de un solo nivel, con 39 componentes, incluidos mano de obra (`PZCO01-0014`, 88 min × 370) y CIF (`PZCO01-0015`, 88 min × 1.259). Las 39 líneas coinciden en cantidad, costo unitario y clasificación. Es lo esperado: D5 y D6 solo aparecen en los niveles 3 y 4, y D3 en el nivel 2 solo afecta a las hojas sin costo en la bodega de la lista. En el Power BI, tres líneas (`CMPD06-0003`, `CMPD06-0008` y `CMPD06-0009`) no tienen unidad de medida. Es un dato de SAP y no afecta el costo.

`VHPT09-0006-073-0100` y `CBAN05-0002-000-0438` están inactivos y no entran al universo. El desarrollador los reemplazó por `CBAN05-0001-000-0438` y `CMPD04-0268-000-0000` (resultado del 2026-11-04):

- **`CBAN05-0001-000-0438`** (un nivel, solo MP): la única diferencia es el `CANTO PVC 19X0,45MM ROBLE CENIZO` (`CMPD06-0003-000-0438`, 7,3 × 249 = 1.817,70). El Power BI muestra el costo unitario de 249, pero pone `Costo_Mp` en 0. En el nivel 2, el original calcula la MP solo con el `AvgPrice` de la bodega de la lista, que aquí es 0, mientras que el costo unitario sí recorre `MP-01` y la lista 10. Es la regla **D3**, y el query optimizado corrige la subvaloración. El `TABLERO ST 15MM` (`CMPD06-0001-000-0438`) sale en 0 en las dos versiones. El query lo marca con `SIN COSTO EN SAP`.
- **`CMPD04-0268-000-0000`** (tres niveles, con MO y CIF): la MO (18.960) y el CIF (26.784) coinciden, y también las hojas del nivel 2. La diferencia de MP (2.094,88) está en cuatro hojas del nivel 3 con distinto costo unitario:

  | Componente | Costo unitario Power BI | Costo unitario query | Efecto en el Power BI |
  |---|---|---|---|
  | `COMP02-0033-000-0000` TUERCA 12MM | 293,14 | 196,74 | +2.313,60 |
  | `COMP02-0027-000-0000` TUBO C18 3/4IN | 2.562,83 | 2.579,18 | −184,43 |
  | `COMP02-0036-000-0000` VARILLA ROSCADA 12MM | 4.508,07 | 4.520,32 | −34,30 |
  | `CIPR01-0028-000-0000` SOLDADURA MIG | 16.134,45 | 16.134,36 | +0,01 |

  **Causa verificada por el desarrollador (2026-11-04):** es un error conocido del SQL original, identificado al escribir el query optimizado. En estas hojas del nivel 3, el original no consulta la bodega alternativa (`MP-01`) y se queda con el costo que tiene el componente en la bodega de la lista de materiales. Corresponde a **D3/D5**, y el query optimizado lo corrige con la cascada de la regla 4.

  **Precisión (2026-11-06, con la consulta C3 de la fase 6):** el efecto es el descrito, pero el mecanismo es otro. El portal usa el costo de la bodega de la lista (`MP-03`). El Power BI usó, en tres de las cuatro hojas, exactamente el costo de `MP-01`: tubo 2.562,83, varilla 4.508,07 y soldadura 16.134,45. En el [SQL original, línea 331](../../bi-origen/bi-costo-actual-pt/query-original-powerbi.sql), la hoja de este nivel se costea con `WhsCode = @Bodega3_`, que es la variable del nivel siguiente, y no con `@Bodega2_`, la bodega de su propia línea. `@Bodega3_` solo cambia cuando el cursor del nivel siguiente lee una fila, así que conserva la bodega de un componente anterior, que puede ser de otro producto. Si el artículo cuesta 0 en esa bodega, el original pasa a `MP-01`. La tuerca (293,14) no coincide con `MP-01` (197,16) y queda `pendiente` de verificar con la consulta C3b. El efecto encaja con D6: valores que se arrastran de otro componente.

  Este artículo es un herraje (semielaborado), no un producto terminado: es un ejemplo de lo que pregunta P7.


## 2. Tabla de reporte y carga incremental

Diseño aprobado por el desarrollador el 2026-11-04, con dos precisiones: P2 (los artículos MO+CIF no se costean) y la carga cada hora.

Script: [`sql/costo-actual-pt/01_informe_costo_pt.sql`](../../sql/costo-actual-pt/01_informe_costo_pt.sql) (ejecutado por el desarrollador el 2026-11-04). Job: [`sql/costo-actual-pt/02_job_costo_pt.sql`](../../sql/costo-actual-pt/02_job_costo_pt.sql), creado por el desarrollador el 2026-11-04 y funcionando. **Fase 2 cerrada.**

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_costo_pt`, más `dbo.Informe_costo_pt_Carga` (misma estructura, se usa para el intercambio) |
| Grano (una fila por…) | Línea de la explosión de un producto: el producto (nivel 1), los encabezados y los componentes. Productos: todo artículo activo con lista de materiales, incluidos los semielaborados (P7) |
| Clave | (`CodigoPT`, `SortPath`) |
| Columnas | `CodigoPT` (`RootCode`), `SortPath`, `Nivel`, `Codigo`, `Descripcion`, `UnidadMedida`, `Bodega` (`ITT1.Warehouse`), `TieneHijos`, `Clasificacion` (`MP` / `MO` / `CIF` en las hojas; nula en encabezados, ciclos y artículos MO+CIF), `Cantidad` (acumulada), `Costo_Unitario`, `Costo_Mp`, `Costo_Mo`, `Costo_Cif`, `Costo_Total`, `Alerta` (texto), `AlertaInactivo`, `AlertaSinCosto`, `AlertaMoCif`, `AlertaEstructura` (bits para el indicador de P8), `FechaCarga` |
| Fecha de referencia (filtros por periodo) | Ninguna: es una foto del costo actual (P9). `FechaCarga` indica cuándo se calculó. |
| Explosión | Nivel por nivel hasta la última hoja (D9), con tope `@MaxNiveles = 15` y detección de ciclos por la ruta de códigos. Una línea que repite un código de sus ancestros no se explota, cuesta 0 y lleva `CICLO EN LISTA DE MATERIALES`. Una línea con lista en el nivel del tope se costea como hoja y lleva `TOPE DE NIVELES`. Las líneas de `ITT1` sin código (por ejemplo, líneas de texto) se excluyen: el query optimizado las dejaba con `Codigo` nulo y costo 0, así que el total no cambia, pero el número de filas sí (corrección del 2026-11-04, tras el error 515 de la primera carga). |
| Alertas | `ITEM INACTIVO`, `SIN COSTO EN SAP`, `MO Y CIF A LA VEZ`, `CICLO EN LISTA DE MATERIALES`, `TOPE DE NIVELES`, combinadas con ` \| `. Cambio menor frente al query optimizado: la combinación de inactivo y sin costo se escribe `ITEM INACTIVO \| SIN COSTO EN SAP` (antes `INACTIVO \| SIN COSTO EN SAP`). |
| Estrategia | **Carga completa** cada hora (no incremental: el costo promedio cambia con cada movimiento y las listas no tienen marca de modificación). El SP arma el resultado en `Informe_costo_pt_Carga` y lo intercambia con `ALTER TABLE … SWITCH` (operación de metadatos), así la API nunca ve la tabla vacía ni queda bloqueada durante la carga. Si la explosión no devuelve filas, falla y conserva la carga anterior. `sp_getapplock` evita dos cargas simultáneas. |
| SP | `dbo.sp_Actualizar_Informe_costo_pt` (`@MaxNiveles int = 15`) |
| Bitácora | `dbo.Cargas_Log`, existente (`Proceso = 'Informe_costo_pt'`, `Modo = 'COMPLETA'`). El SP inserta una fila al terminar, con error o sin él. Tipos y nulabilidad de sus columnas: `pendiente` de verificar (consulta abajo). |
| Job y horario | `BI - Costo PT carga completa`: **cada hora**, todos los días, al minuto 05 (decisión del desarrollador, 2026-11-04). La carga completa toma 32 s (`Cargas_Log` 1238). |
| Índices | Clave primaria agrupada (`CodigoPT`, `SortPath`): sirve para traer la lista de un producto en orden, que es la consulta principal porque las tarjetas solo se muestran con un producto seleccionado (P6). `IX_…_Nivel` (`Nivel`) con `Codigo`, `Descripcion` y los costos incluidos: sirve para el catálogo de productos de los filtros (`Nivel = 1`). |

Antes de ejecutar, verificar la estructura de la bitácora (solo lectura):

```sql
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM Planos_Symphony.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Cargas_Log'
ORDER BY ORDINAL_POSITION;
```

Entrega al desarrollador, en este orden:

1. Ejecutar el script en pruebas, si existe (crea las dos tablas y el SP; no carga datos).
2. Primera carga: `EXEC dbo.sp_Actualizar_Informe_costo_pt;`, anotando la duración.
3. Ejecutar las consultas de validación 4.1 a 4.6 del script y pegar los resultados abajo.
4. Crear el job.

Primera carga (2026-11-04, `dbo.Cargas_Log`):

| Id | Inicio | Duración | Insertados | Nota |
|---|---|---|---|---|
| 1232 | 15:56:28 | 2 s | 0 | Error 515: líneas de `ITT1` sin código. Corregido. |
| 1235 | 15:58:53 | 10 min 34 s | 463.226 | Correcta, pero lenta: join `varchar`/`nvarchar` con `#ConLista`. Corregido con `EXISTS` sobre `ITT1`. |
| 1238 | 16:22:01 | **32 s** | 463.592 | Correcta. Es la versión final del SP. |

Validación (desarrollador, 2026-11-04):

| Consulta | Esperado | Resultado |
|---|---|---|
| 4.1 Bitácora | Una fila sin `Error` | OK: cargas 1235 y 1238 sin error |
| 4.2 Volumen por nivel | 11.244 productos en el nivel 1; niveles hasta el 6 | Nivel 1: 11.253 productos (9 más que en V2, artículos creados o activados desde entonces). Niveles 2 a 6: 141.624 / 202.892 / 94.579 / 13.220 / 24 filas. La suma de los niveles 2 a 6 (7.009.591.851,91) es igual al total del nivel 1. |
| 4.3 Nivel 1 = suma de líneas | Sin filas | OK: sin filas |
| 4.4 Alertas por tipo | `MoCif = 0`, `Estructura = 0` | OK: 0 y 0. Además, 211 líneas con `ITEM INACTIVO` y 16.393 con `SIN COSTO EN SAP`. Son más que las ~13.000 de V5 porque la tabla cuenta cada aparición del componente en la explosión de cada producto (V5 contaba líneas de `ITT1`) e incluye los niveles 5 y 6. |
| 4.5 Productos de V7 | 235.171,705 / 9.425,34 / 99.590,8988 | OK: idénticos en MP, MO, CIF y total |
| 4.6 Comparación con el query optimizado | Sin diferencias en "Hasta 4 niveles" | `pendiente` (opcional: 4.3 y 4.5 ya confirman las reglas) |

## 3. Contrato del endpoint

`GET /api/v1/costo-actual-pt`. Usa el mismo token, el mismo manejo de errores (502 sin detalles internos) y la misma forma general de respuesta que `/api/v1/facturacion-diaria` ([`server.ts`](../../../reporting-api/src/server.ts)).

**Fuente.** `Planos_Symphony.dbo.Informe_costo_pt`, con variables nuevas `REPORT_COSTO_PT_TABLE_SCHEMA=dbo` y `REPORT_COSTO_PT_TABLE=Informe_costo_pt`, como `REPORT_DELIVERIES_TABLE`.

**Diferencias con el patrón de facturación**, porque el informe es una foto del costo de un producto y no una serie en el tiempo:

- **Sin periodo:** no hay `anio`, `mes`, `fechaDesde`, `fechaHasta` ni `years` (P9). En su lugar, `loadedAt` indica la hora de la última carga (`MAX(FechaCarga)`), que el dashboard debe mostrar porque los datos se recalculan cada hora.
- **Sin paginación de `rows`:** se devuelve la lista de materiales completa del producto elegido, en orden jerárquico, para que el frontend pueda armar el árbol. Hoy el promedio es de 41 líneas por producto; la API pone un tope de 5.000 líneas (`truncated: true` si se alcanza). Máximo real: 331 líneas (`VCOC03-0630-000-0001` y `VCOC03-0370-000-0001`, consulta del 2026-11-05), así que el tope deja un margen de 15 veces.
- **Selector de productos por búsqueda:** son 11.253 productos, demasiados para un catálogo completo en cada respuesta. `filterOptions.products` devuelve hasta 50 coincidencias de `search`, como el buscador del `AttributeSlicer` del Power BI.

### Parámetros

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `codigo` | texto | `CodigoPT` | Producto elegido (coincidencia exacta). Sin él, `product`, `rows` y `summary` vuelven vacíos (P6) |
| `search` | texto | `Codigo`, `Descripcion` del nivel 1 | Busca productos para el selector (contiene, sin distinguir mayúsculas). Mínimo 2 caracteres |
| `alerta` | `inactivo` \| `sinCosto` \| `moCif` \| `estructura` | `Alerta…` | Opcional: deja en `rows` solo las líneas con esa alerta. No cambia `summary` |

Reglas de los filtros:

- Todos se aplican en SQL, con parámetros (`request.input`).
- `summary` siempre se calcula sobre el producto completo, aunque se use `alerta`.

### Respuesta

```json
{
  "product": {
    "code": "CBAN12-0027-000-0406",
    "description": "CARB MUEBLE MACAO LVM 63X48 CANTO 2MM CIERRE LENTO AMARETTO",
    "unit": "UN",
    "levels": 2,
    "lines": 39
  },
  "rows": [
    {
      "path": "CBAN12-0027-000-0406.0001",
      "level": 2,
      "code": "CEMP03-0405-000-0000",
      "description": "BOLSA RESELLABLE 30X20CM PARA HERRAJES",
      "unit": "UN",
      "warehouse": "MP-01",
      "hasChildren": false,
      "classification": "MP",
      "quantity": 1,
      "unitCost": 111.48,
      "rawMaterialCost": 111.48,
      "laborCost": 0,
      "overheadCost": 0,
      "totalCost": 111.48,
      "alert": null,
      "alerts": { "inactive": false, "noCost": false, "laborAndOverhead": false, "structure": false }
    }
  ],
  "truncated": false,
  "summary": {
    "rawMaterialCost": 91819.705,
    "laborCost": 32560,
    "overheadCost": 110792,
    "totalCost": 235171.705,
    "costWithoutOverhead": 124379.705,
    "averageCost": 235171.705,
    "averageCostWithoutOverhead": 124379.705,
    "alerts": { "inactive": 0, "noCost": 0, "laborAndOverhead": 0, "structure": 0, "total": 0 },
    "compositionWithoutOverhead": [
      { "code": "CMPD06-0008-000-0406", "description": "TABLERO CARB 15MM 1,53X2,44 DURATEX AMARETTO", "totalCost": 44725.4652 }
    ]
  },
  "filterOptions": {
    "products": [{ "code": "CBAN12-0027-000-0406", "description": "CARB MUEBLE MACAO LVM 63X48 CANTO 2MM CIERRE LENTO AMARETTO" }]
  },
  "source": "sql-server",
  "loadedAt": "2026-11-04T21:22:33.000Z",
  "updatedAt": "2026-11-04T21:30:00.000Z"
}
```

Los valores del ejemplo salen de la validación de `CBAN12-0027-000-0406`; el endpoint solo devuelve datos reales.

Reglas de cada campo:

| Campo | Regla | Visual del BI |
|---|---|---|
| `product` | Fila del nivel 1 de `codigo`: código, descripción, unidad, nivel máximo (`levels`) y número de líneas sin contar el nivel 1 (`lines`). `null` sin `codigo` o si no existe | Segmentadores Código y Producto |
| `rows` | Líneas del nivel 2 en adelante del producto, ordenadas por `SortPath`. `path` permite armar el árbol: el padre de una línea es su `path` sin el último segmento | Tabla "Lista de Materiales" (P3: MP, MO, CIF y Total por separado) |
| `rows[].alert` / `alerts` | Texto de `Alerta` y los cuatro bits | Columna nueva (P8, P11) |
| `summary.rawMaterialCost`, `laborCost`, `overheadCost`, `totalCost` | Costos del nivel 1 del producto | Tarjeta "Total Costo" |
| `summary.costWithoutOverhead` | `totalCost - overheadCost` | Tarjeta "sin CIF" (título según P5) |
| `summary.averageCost`, `averageCostWithoutOverhead` | `AVG(Costo_Total)` y `AVG(Costo_Total - Costo_Cif)` sobre el nivel 1 del producto elegido. Con un solo producto son iguales al total | Tarjetas "Promedio Costo Total" y "Costo sin CIF Prom" |
| `summary.alerts` | Número de líneas del producto con cada alerta, y `total` = líneas con al menos una | Indicador de alertas (P8), resaltando `inactive` |
| `summary.compositionWithoutOverhead` | Hojas del producto con `Clasificacion` `MP` o `MO`, agrupadas por `Codigo` y `Descripcion`, con la suma de `Costo_Total`, de mayor a menor. Sin las de costo 0 | Torta "Lista Materiales sin CIF" (P4: excluye CIF por clasificación, incluye MO) |
| `filterOptions.products` | Hasta 50 productos del nivel 1 cuyo código o descripción contiene `search`, ordenados por código. Vacío sin `search` | Buscador del segmentador |
| `loadedAt` | `MAX(FechaCarga)` de la tabla | — (nuevo) |
| `updatedAt` | Hora de la respuesta, igual que en facturación | — |

**Tarjetas (decisión del desarrollador, 2026-11-05):** se mantienen las cuatro del Power BI, incluidas las de promedio, y solo se muestran con un producto elegido (P6). **Actualización (2026-11-05):** el dashboard solo muestra "Costo total" y "Costo sin CIF". La API sigue devolviendo `averageCost` y `averageCostWithoutOverhead`, que el portal ya no usa.

### Descarga (`GET /api/v1/costo-actual-pt/export`)

Decisión del desarrollador (2026-11-05): un botón "Descargar" en el dashboard.

- **Sin producto elegido:** descarga el informe completo, con todos los productos y sus líneas (unas 463.600 filas, del orden de 90 MB).
- **Con producto elegido:** descarga solo la lista de materiales de ese producto.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `codigo` | texto, opcional | Igual que en el endpoint principal. Sin él, todos los productos. `alerta` y `search` no aplican |

Respuesta:

- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment; filename="costo-actual-pt_<codigo o todos>_<AAAAMMDD-HHmm de loadedAt>.xlsx"`.
- **Formato: libro de Excel (`.xlsx`)**, decidido por el desarrollador el 2026-11-06. En la revisión, Contabilidad tenía que corregir a mano los números del CSV, que salía con coma decimal, y su Excel usa punto decimal. En el `.xlsx` cada número va guardado como número, así que Excel lo muestra con la configuración regional de cada equipo. Se descartó el CSV con punto decimal (`d1c65c2`, nunca desplegado), porque seguía dependiendo de esa configuración.
  - Hoja `Costo PT`, con el encabezado en negrita, la primera fila fija, filtros y anchos de columna.
  - Códigos y descripciones como texto. Nivel como entero. Cantidad y costo unitario con formato `#,##0.00####`, costos MP, MO, CIF y total con `#,##0.00`, y fecha de carga como fecha y hora (`yyyy-mm-dd hh:mm`).
  - Si el informe superara 1.048.575 filas (hoy ~463.600), sigue en una hoja `Costo PT (2)`.
- **Generación:** [`src/xlsx.ts`](../../../reporting-api/src/xlsx.ts) de la API, sin dependencias (XML de la hoja comprimido con `zlib` dentro de un ZIP), para que el despliegue siga siendo copiar `dist\`.
- **Rendimiento medido (2026-11-06, filas sintéticas en el equipo de desarrollo):** 463.600 filas en 6,5 s de CPU, 24,3 MB, frente a ~104 MB del CSV. Excel abrió el archivo en 6,7 s sin pedir reparación. Con datos reales, el tiempo y el tamaño quedan `pendiente` de medir en el servidor.
- **Streaming:** la API lee la tabla con `request.toReadableStream()` de `mssql` y escribe el libro a medida que llegan las filas, sin cargar todo en memoria. Espera la primera fila antes de enviar los encabezados, así que un error de la consulta todavía sale como JSON. El proxy del frontend reenvía el flujo sin acumularlo.
- Orden: `CodigoPT`, `SortPath`. Incluye la fila del nivel 1 de cada producto, con sus totales.

Columnas:

| Encabezado | Columna |
|---|---|
| Código producto | `CodigoPT` |
| Producto | `Descripcion` del nivel 1 del mismo `CodigoPT` |
| Nivel | `Nivel` |
| Código | `Codigo` |
| Descripción | `Descripcion` |
| UM | `UnidadMedida` |
| Bodega | `Bodega` |
| Clasificación | `Clasificacion` |
| Cantidad | `Cantidad` |
| Costo unitario | `Costo_Unitario` |
| Costo MP | `Costo_Mp` |
| Costo MO | `Costo_Mo` |
| Costo CIF | `Costo_Cif` |
| Costo total | `Costo_Total` |
| Alerta | `Alerta` |
| Fecha de carga | `FechaCarga` |

Errores: si la consulta falla antes de la primera fila, 502 como en los demás endpoints. Si falla a mitad del flujo, la API corta la conexión y el navegador marca la descarga como fallida; el error queda en el log de la API.

Consulta de apoyo para fijar el tope de líneas (solo lectura):

```sql
SELECT TOP (5) CodigoPT, COUNT_BIG(1) AS Lineas
FROM Planos_Symphony.dbo.Informe_costo_pt
GROUP BY CodigoPT
ORDER BY Lineas DESC;
```

**Aprobación del contrato:** Daniel Jimenez — 2026-11-05 — aprobado (endpoint principal y descarga).

## 4. Endpoint

Implementado el 2026-11-05 en `reporting-api`, rama `bi/costo-actual-pt`, commit `a28da32`. La rama sale de `bi/notas-credito-2`, que tiene el endpoint de notas crédito ya desplegado y todavía no está en `main`: así el `dist/` nuevo no lo borra.

- Archivos tocados en `reporting-api`: `src/types.ts`, `src/db.ts` (`productCostSource`, `getExportPool`, `getProductCostReport`, `getProductCostExportInfo`, `openProductCostExport`), `src/server.ts` (rutas, `productCostFiltersFrom`, `sendProductCostExport`), `README.md` y `.env.example`.
- Variables nuevas en `.env.example`: `REPORT_COSTO_PT_TABLE_SCHEMA=dbo`, `REPORT_COSTO_PT_TABLE=Informe_costo_pt` y `REPORT_DB_EXPORT_TIMEOUT_MS=600000`.
- Verificación: `npm run build` sin errores. SQL revisado a mano: 8 `SELECT` leídos como recordsets 0 a 7 en el principal y 2 en la información de la descarga. Escapes de `LIKE`, CSV y BOM probados con un script local.
- Paquete: `reporting-api-dist-aeb3f5b.zip` (reemplaza a `a28da32`), en la carpeta padre de los repositorios.
- Prueba contra la base (desarrollador, 2026-11-05, servidor `127.0.0.1:8090`, versión `a28da32`):
  - Búsqueda `search=CBAN12`: devuelve `CBAN12-0027-000-0406`. OK.
  - Producto `CBAN12-0027-000-0406`: 39 líneas. OK. El CSV del producto trae un total de 235.170,505, 1,20 menos que el 2026-11-04 por un cambio del costo promedio en SAP (la carga es horaria).
  - Descarga del producto: encabezado y filas correctos, coma decimal y tildes bien.
  - Descarga completa: 104,1 MB en 16,2 s dentro del servidor.
  - Corrección `aeb3f5b`: `loadedAt` salía en UTC (`15:05:00Z`) por el estilo 127 de `CONVERT`; con el 126 conserva el desfase (`10:05:00-05:00`) y el nombre del archivo usa la hora local. Desplegada y verificada: `2026-11-05T10:05:00-05:00`, resumen 235.170,505 / sin CIF 124.378,505 / promedios iguales al total.

**Fase 4 cerrada** el 2026-11-05.

## 5. Dashboard

Implementado el 2026-11-05 en la rama `bi/costo-actual-pt` de este repositorio.

- Ruta: `/costo-actual-pt` ([`CostoActualPtDashboard.tsx`](../../components/CostoActualPtDashboard.tsx), estilos en [`product-cost.css`](../../app/styles/product-cost.css)).
- Proxys: [`app/api/costo-actual-pt/route.ts`](../../app/api/costo-actual-pt/route.ts) y [`app/api/costo-actual-pt/export/route.ts`](../../app/api/costo-actual-pt/export/route.ts) (streaming, `maxDuration = 300`).
- Catálogo: `costo-actual-pt` en [`lib/reports.ts`](../../lib/reports.ts) y `productCostNavigation` en [`lib/dashboard/navigation.ts`](../../lib/dashboard/navigation.ts). Permisos asignados en `/admin/permisos` (confirmado por el desarrollador el 2026-11-06).
- Componentes reutilizados: `DashboardShell`, `MetricCard`/`MetricSkeleton` y `ShareList`, que se extrajo de notas crédito a `components/dashboard/`.
- Comportamiento:
  - **Buscador de producto:** consulta con la lupa, Enter o "Aplicar filtros", y muestra hasta 50 resultados. Al elegir uno se carga el producto.
  - **Filtro de alerta:** en borrador; se aplica con "Aplicar filtros" o con "Ver líneas" en el panel de alertas.
  - **Sin producto (P6):** se muestra un mensaje para elegirlo y el botón "Descargar todo".
  - **Con producto:** seis tarjetas (P5; se quitaron las de promedio y, el 2026-11-06, el desarrollador pidió separar los componentes): "Costo MP", "Costo MO" y "Costo CIF", cada una con su participación en el total, y "Costo total", "Costo sin CIF" (MP + MO) y "Costo sin MO" (MP + CIF, calculado en el navegador como `totalCost - laborCost`). Tres columnas en escritorio, dos en tableta y una en el celular, el panel de líneas con alerta (P8, con los inactivos resaltados), la composición sin CIF (P4, en barras como en notas crédito), la lista de materiales en árbol con MP, MO, CIF y Total (P3) y el botón "Descargar producto".
  - **Subtotales de los subensambles:** se calculan en el navegador con las líneas ya cargadas, porque en la tabla su costo es 0 (está en sus hijos). Se muestran en cursiva. Con un filtro de alerta, la tabla pierde la jerarquía y los subensambles muestran "—".
  - **Alertas en la tabla:** van debajo de la descripción del componente, no en una columna aparte, para que la tabla quepa a 1440 px.
  - **Pie de página:** hora de la última carga (`loadedAt`).
- Verificación (2026-11-05):
  - `npm run lint` y `npm run build` sin errores ni advertencias.
  - Revisión visual a 375, 820 y 1440 px con una copia temporal sin middleware y una API falsa con los datos de `CMPD04-0268-000-0000` de la validación. Se revisaron el producto, el estado vacío y la búsqueda. Sin desborde horizontal de la página; la tabla se desplaza en su propio contenedor a 375 y 820 px.
  - Probado por el desarrollador en la vista previa de Vercel con sesión y datos reales, incluida la descarga (2026-11-06). PR: [Indicadores_Firplak#2](https://github.com/FirplakDesarrollador/Indicadores_Firplak/pull/2) (portal) y [firplak-reporting-api#3](https://github.com/Firplak/firplak-reporting-api/pull/3) (API, sobre `bi/notas-credito-2`).
- **Fase 5 cerrada el 2026-11-06.**

## 6. Conciliación con Power BI

Plan aprobado por el desarrollador el 2026-11-06. Consultas de solo lectura: [`sql/costo-actual-pt/03_conciliacion.sql`](../../sql/costo-actual-pt/03_conciliacion.sql).

**Qué se demuestra.** El informe muestra solo el costo actual (P9), así que no hay periodos: la comparación va por producto. Por las reglas aprobadas (P1, P10), las cifras **no tienen que coincidir exactas** con el Power BI. La conciliación demuestra dos cosas:

1. El portal aplica las reglas aprobadas: la comparación contra el query optimizado (C4) no tiene diferencias en los productos de hasta 4 niveles.
2. Cada diferencia con el Power BI tiene una causa D1–D9. Una diferencia mayor a 0,01 sin causa conocida es un hallazgo y se documenta aquí antes de seguir.

**Procedimiento (desarrollador):**

1. Esperar a que se actualicen el Power BI y la tabla (job en el minuto 05) y tomar todos los valores en la misma hora. El costo promedio de SAP cambia con cada movimiento: `CBAN12-0027-000-0406` bajó 1,20 entre el 2026-11-04 y el 2026-11-05.
2. Ejecutar C1 y anotar la hora de carga y los totales globales. En el Power BI, sin producto elegido, anotar "Total Costo" y las dos tarjetas "sin CIF".
3. Ejecutar C2. Para cada producto: en el Power BI, anotar "Total Costo" y "sin CIF"; en el portal, "Costo total" y "Costo sin CIF".
4. Si un producto tiene diferencia, ejecutar C3 con su código y compararlo con la tabla "Lista de Materiales" del Power BI exportada a Excel.
5. Ejecutar C4 (la validación 4.6).
6. Presentar la tabla a Contabilidad y registrar la aprobación: quién, cuándo y por qué medio (correo, Teams o reunión).

### Totales globales (C1)

Hora de carga del portal: 2026-11-06 08:05:00. Hora de actualización del Power BI: `pendiente`.

| Grupo | Fuente | Productos | Costo total | Costo sin CIF |
|---|---|---|---|---|
| Hasta 4 niveles | Portal | 7.832 | 4.047.079.421,71 | 3.457.986.218,92 |
| Más de 4 niveles | Portal | 3.444 | 3.018.572.802,94 | 2.542.680.261,28 |
| Total | Portal | 11.276 | 7.065.652.224,66 | 6.000.666.480,20 |
| Total | Power BI | `pendiente` | 6.959.525.480 (tarjeta "6.959.525,48 mil") | 5.918.759.760 (tarjeta "5.918.759,76 mil") |
| **Diferencia** | Portal − Power BI | | **+106.126.744,66 (+1,52 %)** | **+81.906.720,20 (+1,38 %)** |

El CIF del portal (1.064.985.744,46) supera al del Power BI en unos 24.220.024. Las tarjetas del Power BI están redondeadas a 10 pesos.

**Cómo se reparte la diferencia (`pendiente` de C4):** el query optimizado aplica las reglas corregidas, pero corta en el nivel 4, igual que el Power BI. Con su total se separan las dos causas:

- Portal − query optimizado = efecto de desglosar todos los niveles (D9; P2 hoy no tiene artículos).
- Query optimizado − Power BI = efecto de las reglas corregidas (D1–D8, sobre todo D3, D5 y D6).

El universo pasó de 11.244 productos (V2, 2026-11-04) a 11.276: son productos creados en SAP desde entonces.

### Muestra por producto (C2)

Los códigos de los casos 4 a 11 salen de C2.

| # | Caso | Producto | Fuente | Costo total | Costo sin CIF | MP | MO | CIF | Diferencia | Causa (D#) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Un nivel con MO y CIF (V7) | `CBAN12-0027-000-0406` | Portal | 235.170,51 | 124.378,51 | 91.818,51 | 32.560,00 | 110.792,00 | | |
| | | | Power BI | 235.170,51 | 124.378,51 | 91.818,51 | 32.560,00 | 110.792,00 | 0 | Coincide |
| 2 | Diferencia D3 (V7); también tiene `SIN COSTO EN SAP` (caso 9) | `CBAN05-0001-000-0438` | Portal | 9.424,54 | 9.424,54 | 9.424,54 | 0,00 | 0,00 | | |
| | | | Power BI | 7.606,84 | 7.606,84 | 7.606,84 | 0,00 | 0,00 | +1.817,70 | D3: canto `CMPD06-0003-000-0438` (7,3 × 249) con MP 0 en el Power BI |
| 3 | Tres niveles, D3/D5 (V7) | `CMPD04-0268-000-0000` | Portal | 99.590,90 | 72.806,90 | 53.846,90 | 18.960,00 | 26.784,00 | | |
| | | | Power BI | 99.590,90 | 72.806,90 | 53.846,90 | 18.960,00 | 26.784,00 | 0 | Coincide hoy; el 2026-11-04 difería en 2.094,88 (H1) |
| 4 | Un nivel, solo MP, sin alertas | `CBAN19-0001-000-0000` | Portal | 85.696,44 | 85.696,44 | 85.696,44 | 0,00 | 0,00 | | |
| | | | Power BI | 85.696,44 | 85.696,44 | 85.696,44 | 0,00 | 0,00 | 0 | Coincide |
| 5 | Hasta 4 niveles, con MO y CIF (3 niveles, 193 líneas) | `VBAN33-0005-000-1358` | Portal | 3.832.824,00 | 2.672.802,00 | 2.029.533,00 | 643.269,00 | 1.160.022,00 | | |
| | | | Power BI | 3.837.623,75 | 2.677.601,75 | 2.034.332,75 | 643.269,00 | 1.160.022,00 | −4.799,75 (solo MP) | H1, confirmada con C3: en 20 artículos el Power BI usó el costo de `MP-01` y no el de la bodega de la lista (`MP-12` o `MP-05`) |
| 6 | Más de 4 niveles (6 niveles, 261 líneas) | `VHPT05-0015-000-0100` | Portal | 6.196.220,70 | 5.338.016,70 | 4.727.736,20 | 610.280,50 | 858.204,00 | | |
| | | | Power BI | 5.718.784,22 | 5.333.764,22 | 5.061.214,22 | 272.550,00 | 385.020,00 | +477.436,48 (MP −333.478,02; MO +337.730,50; CIF +473.184,00) | D9: el portal desglosa los niveles 5 y 6, que tienen MO y CIF; el Power BI costea los subensambles del nivel 4 como MP |
| 7 | Hoja de nivel 2 sin costo en su bodega (1 línea) | `CEXH01-0008-000-0000` | Portal | 360.000,00 | 360.000,00 | 360.000,00 | 0,00 | 0,00 | | |
| | | | Power BI | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | +360.000,00 | D3: el exhibidor `CEXH01-0004-000-0000` (3 unidades) no tiene costo en su bodega; el portal lo toma de la cascada |
| 8 | Con ítem inactivo | `CMPD04-0130-000-0000` | Portal | 107.435,21 | 107.435,21 | 107.435,21 | 0,00 | 0,00 | | |
| | | | Power BI | 107.435,21 | 107.435,21 | 107.435,21 | 0,00 | 0,00 | 0 | Coincide |
| 10 | Semielaborado (P7, 4 niveles) | `CMPD04-0261-000-0000` | Portal | 146.060,60 | 101.331,32 | 69.668,12 | 31.663,20 | 44.729,28 | | |
| | | | Power BI | 146.060,60 | 101.331,32 | 69.668,12 | 31.663,20 | 44.729,28 | 0 | Coincide |
| 11 | El de más líneas (5 niveles, 330 líneas) | `VCOC03-0370-000-0001` | Portal | 3.652.516,41 | 3.210.354,21 | 3.027.785,21 | 182.569,00 | 442.162,20 | | |
| | | | Power BI | 3.707.286,88 | 3.265.124,68 | 3.082.555,68 | 182.569,00 | 442.162,20 | −54.770,47 (solo MP) | Desglosada con C3: placa de cuarzo `CQUA01-0001` −59.366,50 (`pendiente` de C3b), H1 +5.955,31, D9 −1.334,63 y movimientos de SAP −61,08 |

Valores del Power BI tomados el 2026-11-06 de la tabla "Lista de Materiales" exportada a Excel por el desarrollador (`pbi_LdeM/pbi-lista-materiales.xlsx`, sin versionar). En los 10 productos, la fila de nivel 1 del Power BI es igual a la suma de sus líneas.

**Resumen:** 5 de 10 productos coinciden exactamente (`CBAN12-0027`, `CMPD04-0268`, `CBAN19-0001`, `CMPD04-0130` y `CMPD04-0261`). Tres tienen causas confirmadas: `CBAN05-0001` y `CEXH01-0008` (D3) y `VHPT05-0015` (D9). **`VBAN33-0005` confirmado (2026-11-06, C3 del portal frente a la exportación del Power BI):** con los costos unitarios del portal y las cantidades del Power BI, la materia prima da exactamente 2.029.533,00, igual que el portal, y la diferencia exactamente −4.799,75. En los 20 artículos que difieren, el costo unitario del Power BI es el `AvgPrice` de `MP-01` y el del portal el de la bodega de la lista (`MP-12` en los muebles, `MP-05` en los mesones): es H1. Las diferencias se compensan entre sí. Las mayores son los laterales de cajón `CMPD07-0249` (−18.123,63), la bisagra `CMPD07-0059` (+6.377,10), el tablero Candelaria `CMPD06-0015` (+4.475,82) y la manija `CMPD07-0321` (+3.991,44). Los artículos sin costo en ninguna bodega (`CMPD09-0201` a `CMPD09-0205` y los planos de calidad) valen 0 en las dos fuentes, así que no explican la diferencia: en este producto no actúa D6.

**`VCOC03-0370` desglosado (2026-11-06, C3 del portal `pbi_LdeM/c3-vcoc03.xlsx` frente a la exportación del Power BI).** Con la carga de ese momento, la MP del portal es 3.027.748,77 y la del Power BI 3.082.555,68: −54.806,91. Línea por línea:

| Causa | Efecto | Detalle |
|---|---|---|
| Placa `CQUA01-0001-000-0000` (salpicadero de cuarzo 210X60 blanco polar) | −59.366,50 | El portal usa 279.457,50, el costo de la bodega de la lista (`MP-05`). El Power BI usa 338.824, que no es el costo de `MP-05`, ni el de `MP-01` (272.646,25), ni el de `PT-01` (0), y no aparece en otro artículo de la exportación. `pendiente`: C3b de esa placa en todas las bodegas y en la lista de precios 10. |
| H1: el Power BI usó el costo de `MP-01` | +5.955,31 | Placa `CQUA01-0003` +5.893,92, riel `CMPD07-0037` +1.053,70, platero `CMPD07-0041` −676,35, tablero `CMPD06-0001` −319,09 y otros menores. |
| D9: el portal desglosa la mezcla de carbonato `CMPD02-0011` en el nivel 5 | −1.334,63 | El Power BI la costea como hoja (436,79 × 11,6 = 5.066,76). El portal suma sus dos carbonatos (1.291,72 + 2.440,41). |
| Movimientos de SAP entre la toma del Power BI y la C3 | −61,08 | Cristalán `CMPD01-0020` (−60,20) y dos etiquetas. |

Al pasar la C3 a Excel, la configuración regional leyó el punto decimal como separador de miles: las celdas numéricas quedaron multiplicadas por 1.000.000. Se corrigieron al leerlas. Solo falta la C3b de la placa `CQUA01-0001`. La C4 ya muestra que en los productos de hasta 4 niveles, como `VBAN33-0005`, el portal es idéntico al query optimizado, así que su diferencia con el Power BI viene de una regla corregida y no de un error del portal.

El caso 9 (`SIN COSTO EN SAP`) eligió el mismo producto que el caso 2, así que queda cubierto ahí. Frente a la V7 del 2026-11-04, `CBAN12-0027` sigue en 235.170,505 y `CBAN05-0001` bajó 0,80 (9.425,34 → 9.424,54) por movimientos en SAP.

### Comparación contra el query optimizado (C4)

Ejecutada por el desarrollador el 2026-11-06, con una carga posterior a la de C1 (11.280 productos).

| Grupo | Productos | Con diferencia | Total tabla | Total query optimizado | Diferencia |
|---|---|---|---|---|---|
| Hasta 4 niveles | 7.835 | **0** | 4.048.280.586,06 | 4.048.280.586,06 | 0 |
| Más de 4 niveles | 3.445 | 3.445 | 3.019.086.374,49 | 2.947.103.675,04 | +71.982.699,46 (D9) |

**Conclusión:** en los productos de hasta 4 niveles, la tabla del portal da exactamente lo mismo que el query optimizado aprobado (P1). La única diferencia está en los productos de más de 4 niveles y se debe a que el portal desglosa todos los niveles (D9, P10). No hay artículos MO+CIF (P2) que la alteren.

**Reparto aproximado de la diferencia global con el Power BI (C1, +106.126.744,66).** Es aproximado porque C1 y C4 se tomaron en cargas distintas:

- D9, desglose de todos los niveles: unos +71,98 millones (C4).
- Reglas corregidas del query optimizado (D1–D8 y H1): unos +35,86 millones. Es el total optimizado (6.995.384.261,10) menos el total del Power BI (6.959.525.480).

### Hallazgos

- **H1, actualización (2026-11-06, exportación del Power BI):** hoy el Power BI da para `CMPD04-0268` lo mismo que el portal, con los costos de `MP-03` (tuerca 196,74, tubo 2.579,18, varilla 4.520,32, soldadura 16.134,41). El 2026-11-04 daba 2.094,88 más. Esto confirma el mecanismo: estas hojas son componentes del nivel 3 sin lista propia, así que el original las costea en la rama `Else` (líneas 326 a 331) con la bodega que quedó en `@Bodega3_` del último componente leído, que puede ser de otro producto. El resultado del Power BI depende entonces del orden en que procesa los productos y puede cambiar de una actualización a otra sin que cambie SAP. El portal no tiene este problema.
- **H1 (2026-11-06), causa de la diferencia del nivel 3 de `CMPD04-0268`:** el SQL original costea las hojas de ese nivel con `@Bodega3_`, una bodega que viene de otro componente (línea 331), y no con la de su propia línea. Ver la precisión en la V7. No cambia el portal: aplica la cascada aprobada (bodega de la lista → `MP-01` → `PT-01`). Confirmado con C3b (2026-11-06): la tuerca cuesta 293,14 exactamente en `MP-05`. Ni el tubo ni la varilla tienen costo en `MP-05`, así que el original pasó a `MP-01` (2.562,83 y 4.508,07). La soldadura cuesta en `MP-05` lo mismo que en `MP-01` (16.134,45). Las cuatro cifras del Power BI del 2026-11-04 salen de `@Bodega3_ = 'MP-05'`, una bodega que no es la de la lista (`MP-03`) y que quedó de otro componente.

**Aprobación del dueño de negocio (Contabilidad):** nombre — fecha — medio — `pendiente`

## 7. Despliegue y retiro

- API desplegada (versión / fecha):
- Frontend desplegado (commit / fecha):
- Documentación en VibeWorkFlow (flujo, área, id y fecha de aprobación):
- Power BI retirado (fecha):
- Rollback:
