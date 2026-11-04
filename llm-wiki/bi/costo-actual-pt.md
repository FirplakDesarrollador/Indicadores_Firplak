---
status: en-migracion
fase: 1
updated: 2026-11-04
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

Analizado el 2026-11-04 a partir del proyecto [`BI Costo producto terminado.pbip`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.pbip). El modelo está en [`definition/tables/`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.SemanticModel/definition/tables/) y los visuales en [`definition/pages/ReportSection/`](../../bi-origen/bi-costo-actual-pt/BI%20Costo%20producto%20terminado.Report/definition/pages/ReportSection/). Todavía no se ha validado con datos: ver [Consultas de validación](#consultas-de-validación-para-el-desarrollador).

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
2. **Explosión:** niveles 2, 3 y 4 desde `ITT1`, ordenados por `ChildNum`. La cantidad de cada línea se acumula: es la cantidad del componente multiplicada por la de sus padres. Un componente del nivel 4 que tenga su propia lista **no** se explota más: se costea como hoja.
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
| D7 | Artículo con `QryGroup39 = 'Y'` y `QryGroup40 = 'Y'` | Los dos bloques de limpieza se anulan entre sí: costo 0 | Suma el costo **dos veces**, en `Costo_Mo` y en `Costo_Cif` | Hoy ninguno (V3). Queda el control en el SP y la pregunta P2. |
| D8 | Columnas de salida | `linea` (orden) y `Padre` (código del producto, usado en la relación) | Ninguna de las dos. Devuelve `Alerta` y calcula internamente `RootCode` y `SortPath`. | La tabla de reporte debe guardar `RootCode` como código del producto y `SortPath` como orden. Se agrega al SP. |

Las dos versiones comparten esto: la explosión llega solo hasta el nivel 4 (ver V4), los encabezados cuestan 0 y el producto suma sus líneas.

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
- **Doble clasificación (D7):** hoy no hay casos (V3), pero si aparecen artículos con `QryGroup39` y `QryGroup40` en `'Y'`, el query optimizado suma su costo dos veces.
- **Profundidad:** las listas con más de 4 niveles se truncan en las dos versiones. Afecta a 3.421 productos y 13.214 líneas (V4). Ver P10.
- **Líneas sin costo:** 13.019 hojas no tienen costo en ninguna de las tres bodegas (V5). Falta su desglose (V5b).
- **No es incremental:** el costo promedio cambia con cada movimiento de inventario y las listas no tienen una marca de modificación que sirva para recalcular la explosión. Se propone una carga completa programada (sección 2), lo que se aparta del patrón incremental de la skill.
- **Lecturas `NOLOCK`:** el query lee SAP sin bloqueos. Es aceptable para una foto de costos, pero puede leer datos a medio escribir durante una transacción.

Preguntas para Contabilidad:

- **P1.** ¿Aceptan las reglas del query optimizado (D1 a D3, D5 y D6) como las correctas, aunque cambien las cifras respecto del Power BI?
- **P2.** Si un artículo es mano de obra y CIF a la vez (D7), ¿a cuál de los dos va su costo? ¿O no debería existir ese caso?
- **P3.** En la tabla "Lista de Materiales", la columna "Total Costo" muestra solo la **materia prima**: las líneas de mano de obra y CIF aparecen en 0. ¿Mostramos las columnas MP, MO, CIF y Total por separado?
- **P4.** La torta "sin CIF" excluye los componentes por el **texto** "CIF" en la descripción, no por su clasificación en SAP. ¿La excluimos por clasificación (`QryGroup40`)? ¿La mano de obra debe aparecer en la torta?
- **P5.** La tarjeta de arriba se titula "Promedio Costo Total sin CIF", pero muestra la **suma**. ¿Se renombra a "Costo total sin CIF"?
- **P6.** Sin producto seleccionado, "Total Costo" suma el costo de **todos** los productos, una cifra sin sentido de negocio. ¿Las tarjetas se muestran solo con un producto seleccionado, o se reemplazan por el número de productos y el costo promedio?
- **P7.** El universo incluye todo artículo con lista de materiales, también semielaborados y subensambles. ¿Se limita a producto terminado? Si es así, ¿con qué criterio de SAP (grupo de artículos, propiedad)?
- **P10.** El 30 % de los productos tiene listas de más de 4 niveles (V4). ¿Explotamos todos los niveles (cambia el desglose MP/MO/CIF de esos productos, no necesariamente su total) o mantenemos el corte en 4 como hoy?
- **P11.** Hay 13.019 líneas de componentes sin costo en SAP (V5). Según el desglose V5b, ¿es esperado (por ejemplo, artículos que no son de inventario) o hay que corregir costos en SAP?
- **P8.** ¿Mostramos la columna `Alerta` y un indicador de líneas sin costo o inactivas?
- **P9.** ¿Basta con el costo actual, o necesitan guardar una foto mensual para comparar el costo entre meses?

**Validación del dueño de negocio:** Contabilidad — fecha — `pendiente`

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
| V7 | Productos elegidos: `VHPT09-0006-073-0100`, `CBAN05-0002-000-0438`, `CBAN12-0027-000-0406` | Comparación `pendiente`: ver V7 abajo. |

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
| `VHPT09-0006-073-0100` | Power BI | | | | | | |
| `VHPT09-0006-073-0100` | Query optimizado | | | | | | |
| `CBAN05-0002-000-0438` | Power BI | | | | | | |
| `CBAN05-0002-000-0438` | Query optimizado | | | | | | |
| `CBAN12-0027-000-0406` | Power BI | | | | | | |
| `CBAN12-0027-000-0406` | Query optimizado | | | | | | |


## 2. Tabla de reporte y carga incremental

Propuesta de la fase 1. El script se escribe en la fase 2.

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_costo_pt` (nombre propuesto, `pendiente` de confirmar) |
| Grano (una fila por…) | Línea de la explosión de un producto: el producto (nivel 1), los encabezados y los componentes |
| Clave | (`CodigoPT`, `SortPath`) |
| Columnas propuestas | `CodigoPT` (`RootCode`), `Codigo`, `Descripcion`, `UnidadMedida`, `Nivel`, `Cantidad`, `Bodega` (`ITT1.Warehouse`), `TieneHijos`, `Clasificacion` (`MP` / `MO` / `CIF` en las hojas, nulo en los encabezados), `Costo_Unitario`, `Costo_Mp`, `Costo_Mo`, `Costo_Cif`, `Costo_Total`, `Alerta`, `SortPath`, `FechaCarga` |
| Fecha de referencia (filtros por periodo) | Ninguna: es una foto del costo actual. `FechaCarga` indica cuándo se calculó. |
| Estrategia incremental | **Carga completa** (no incremental): el SP calcula la explosión en tablas temporales y reemplaza el contenido dentro de una transacción, para que la API nunca vea la tabla vacía |
| SP | `dbo.sp_Actualizar_Informe_costo_pt` (nombre propuesto) |
| Job y horario | Diario, de madrugada (por ejemplo, 5:00), antes de la consulta diaria de Contabilidad. Horario `pendiente` |
| Índices | Clave primaria (`CodigoPT`, `SortPath`) e índice por `Nivel` con `Descripcion` incluida para el catálogo de productos (`pendiente`) |

Validación de totales (query optimizado vs. tabla):

| Periodo | Filas origen | Filas tabla | Total origen | Total tabla |
|---|---|---|---|---|

## 3. Contrato del endpoint

`GET /api/v1/<tema>`

Parámetros:

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `page`, `pageSize` | entero | — | Paginación |
| `anio`, `mes` | entero | `<FechaReferencia>` | Periodo |

Respuesta:

```json
{
  "rows": [],
  "years": [],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 1 },
  "summary": {},
  "filterOptions": {},
  "source": "sql-server",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Aprobación del contrato:** nombre — fecha — `pendiente`

## 4. Endpoint

- Archivos tocados en `reporting-api`:
- Variables nuevas en `.env.example`:
- Prueba contra la base: fecha — resultado

## 5. Dashboard

- Ruta: `/<tema>`
- Proxy: `app/api/<tema>/route.ts`
- Componentes reutilizados:
- Revisión visual (375 / 820 / 1440 px): fecha

## 6. Conciliación con Power BI

| Indicador | Periodo | Dashboard | Power BI | Diferencia | Causa |
|---|---|---|---|---|---|

**Firma del dueño de negocio:** nombre — fecha — `pendiente`

## 7. Despliegue y retiro

- API desplegada (versión / fecha):
- Frontend desplegado (commit / fecha):
- Documentación en VibeWorkFlow (flujo, área, id y fecha de aprobación):
- Power BI retirado (fecha):
- Rollback:
