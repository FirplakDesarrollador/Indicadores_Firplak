---
status: en-validacion
fase: 5
updated: 2026-11-18
sources:
  - ../../bi-origen/moldes/
  - ../../lib/moldes/service.ts
  - ../../app/api/moldes/route.ts
  - ../../components/MoldesDashboard.tsx
---

# BI: Moldes

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `BI-Moldes.aspx` / `BI Moldes 2025 publicar` ([proyecto .pbip](../../bi-origen/moldes/BI%20Moldes%202025%20publicar.pbip)) |
| Dueño de negocio (valida las cifras) | Alejandro Isaza |
| Desarrollador responsable | Alejandro Isaza |
| Usuarios y frecuencia de uso | `brian.sanchez@firplak.com`, `alejandro.isaza@firplak.com`, `sara.aguilar@firplak.com`, `yury.mar@firplak.com`, `auxingenieria@firplak.com`, `hector.chinchilla@firplak.com`, `jakeline.chaverra@firplak.com`, `oswaldo.rivera@firplak.com` (frecuencia `pendiente`) |
| Prioridad | Media |
| Rama | `bi/moldes` |

> **Nota de origen de datos:** El creador confirmó el 2026-11-17 que **toda la información ya está en Supabase** (`https://vuiuorjzonpyobpelyld.supabase.co`). Aunque en el `.pbip` solo `query_ordenes_fabricacion` apuntaba a Supabase y las otras 6 tablas a SharePoint, la migración consultará directamente ese Supabase.

## 1. Análisis

Analizado el 2026-11-17 a partir de [`BI Moldes 2025 publicar.pbip`](../../bi-origen/moldes/BI%20Moldes%202025%20publicar.pbip): modelo en [`definition/tables/`](../../bi-origen/moldes/BI%20Moldes%202025%20publicar.SemanticModel/definition/tables/), relaciones en [`relationships.tmdl`](../../bi-origen/moldes/BI%20Moldes%202025%20publicar.SemanticModel/definition/relationships.tmdl) y 14 páginas de visuales en [`definition/pages/`](../../bi-origen/moldes/BI%20Moldes%202025%20publicar.Report/definition/pages/pages.json).

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|
| `BD Moldes` | `SharePoint.Tables` (import) | `sites/FPKMoldesModelosyPrototipos` (lista `a064e2d4-68d1-4270-b868-d381c34c5a21`) + append de `Historico BD Moldes` | Órdenes de reparación/fabricación de moldes. `id = 1000000 + Id` (o `Id` del histórico). |
| `Historico BD Moldes` | `SharePoint.Tables` (import) | `sites/FPKMoldesModelosyPrototipos` (lista `b8cf8f16-6708-474c-870e-12c6f4d8ba9a`) | Histórico previo anexado a `BD Moldes` y `BD Moldes (Defectos)`. |
| `BD Moldes (Defectos)` | `SharePoint.Tables` (import) | Misma fuente que `BD Moldes` + `Historico BD Moldes` | Explota `DEFECTOSAREPARAR` por delimitador `", "` (1 fila por defecto y orden). |
| `Listado Moldes` | `SharePoint.Tables` (import) | `sites/FPKMoldesModelosyPrototipos` (lista `c13859a5-a52f-4010-b227-2fba294692db`) | Maestro de moldes (`Número de seri`, `Estado`, `Estado Molde`, `Planta`, `Vueltastotales`, etc.). Excluye `Estado Molde = "Baja"` y nulos en serie. |
| `Defectos Moldes` | `SharePoint.Tables` (import) | `sites/FPKMoldesModelosyPrototipos` (lista `a4dfbe00-5827-4eea-b5f5-d9580ef7dc36`) | Catálogo de defectos (`Title`, `Tiempo`). |
| `Acumulado mes Prog MS` | `SharePoint.Tables` (import) | `sites/FPKPRODUCCIN` (lista `aa02cdc0-96f9-4b35-8062-10f8f3616921`) | Programación mensual MS. Sus columnas casi no se usan en visuales; aloja 4 medidas DAX. |
| `query_ordenes_fabricacion` | `Odbc.DataSource` PostgreSQL (import) | Supabase (`aws-0-us-west-1.pooler.supabase.com:6543`, `public.ordenes_fabricacion`) | Única tabla conectada a Supabase en el `.pbip`. Agrupada por `fecha_entrega_real` sumando `cantidad` donde `pendiente = "0"`. |
| `Calendario` | Tabla calculada DAX | `CALENDARAUTO()` | Dimensión de fechas conectada a `BD Moldes[FECHAENTREGA]` y `query_ordenes_fabricacion[fecha_entrega_real]`. |
| `DateTableTemplate_*`, `LocalDateTable_*` | Automáticas de Power BI | — | Jerarquías automáticas de fechas. No migrar. |

<details><summary>Consultas y particiones M originales</summary>

- `query_ordenes_fabricacion` (PostgreSQL / Supabase): lee `public.ordenes_fabricacion` (`pendiente`, `cantidad`, `fecha_entrega_real`), filtra `pendiente = "0"`, convierte `fecha_entrega_real` a `date`, agrupa sumando `cantidad` por `fecha_entrega_real` y ordena descendente.
- `BD Moldes`, `Historico BD Moldes`, `BD Moldes (Defectos)`, `Listado Moldes`, `Defectos Moldes`, `Acumulado mes Prog MS`: particiones M sobre `SharePoint.Tables(...)` (ApiVersion 15).

</details>

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SQL / API? |
|---|---|---|---|
| `Historico BD Moldes` | `Table.Distinct` (2 veces) | Deduplica por `{Title, Created, CODIGOMOLDE, FECHAENTREGA, DEFECTOSAREPARAR, OBSERVACIONES}` y luego por `{FECHAENTREGA, CODIGOMOLDE, Title, DEFECTOSAREPARAR, Responsable}`. | Sí (si sigue habiendo histórico) |
| `BD Moldes` | `Personalizado` + `Table.Combine` | Suma `1000000` al `Id` actual y lo combina con `Historico BD Moldes` (conservando `id`). | Sí |
| `BD Moldes` | `Table.SelectRows` + `Table.Distinct` | Excluye `DEFECTOSAREPARAR` nulos, `", "` o `", , "` y deduplica (2 pasos `Distinct`). | Sí |
| `BD Moldes (Defectos)` | `Splitter.SplitTextByDelimiter(", ")` + `ExpandListColumn` | Convierte lista separada por `", "` en múltiples filas (una por defecto) y filtra vacíos/nulos. | Sí (vista/unnest o tabla hija) |
| `Listado Moldes` | `Table.SelectRows` + `Table.Distinct` | Excluye `Estado Molde = "Baja"`, deduplica por `Número de seri` y quita `Número de seri` nulos. | Sí |
| `query_ordenes_fabricacion` | `Table.SelectRows` + `Table.Group` | Filtra `pendiente = "0"` y suma `cantidad` por `fecha_entrega_real`. | Sí (consulta directa o vista SQL) |

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `BD Moldes (Defectos)[Id]` | `BD Moldes[id]` | Varios a uno | Única |
| `BD Moldes (Defectos)[DEFECTOSAREPARAR]` | `Defectos Moldes[Title]` | Varios a uno | Bidireccional (`bothDirections`) |
| `BD Moldes (Defectos)[CODIGOMOLDE]` | `Listado Moldes[Número de seri]` | Varios a uno | Única |
| `BD Moldes[FECHAENTREGA]` | `Calendario[Date]` | Varios a uno | Única |
| `query_ordenes_fabricacion[fecha_entrega_real]` | `Calendario[Date]` | Varios a uno | Única |
| `BD Moldes[id]` | `Acumulado mes Prog MS[Id]` | Uno a uno | Bidireccional (`bothDirections`) |

### Columnas calculadas DAX relevantes

| Tabla | Columna | Regla |
|---|---|---|
| `BD Moldes` | `Dias fuera` | `IF(FECHAENTREGA - FECHAENTRADA = 0, 0.5, FECHAENTREGA - FECHAENTRADA)` |
| `BD Moldes` | `Atrasado` | `IF(FECHAENTREGA > FECHAESPERADA, "Atrasado", "A tiempo")` |
| `BD Moldes` | `Tipo de reparación 2` | `"Molde Nuevo"` si `DEFECTOSAREPARAR` contiene `"Molde Nuevo"`; si `Tipodereparacion` está en blanco → `"Especial"`; si no, `Tipodereparacion`. |
| `BD Moldes (Defectos)` | `Fecha entrega 2` | `IF(ISBLANK(FECHAENTREGA), TODAY(), FECHAENTREGA)` |
| `BD Moldes (Defectos)` | `Dias fuera` | Días enteros entre `FECHAENTRADA` y `Fecha entrega 2` (0 → `0.5`), dividido entre la cantidad de defectos del mismo `CODIGOMOLDE` y `FECHAENTRADA` (para no duplicar días al sumar por defecto). |
| `BD Moldes (Defectos)` | `TipoReparacion2` | `"Molde Nuevo"` / `"Modelo nuevo"` según `DEFECTOSAREPARAR`; si `Tipodereparacion` en blanco y responsable es `Bernardo Alfredo Restrepo Calle` o `Yurany Andrea Ortiz Torres` → `"Especial"`; si no `"Rapida"`; si tiene valor, `Tipodereparacion`. |

### Indicadores (medidas DAX)

| Indicador | Regla de negocio | DAX original | Vivirá en (SQL / API / frontend) |
|---|---|---|---|
| `Nivel de servicio RE` | % de reparaciones especiales (sin `"Nuevo"` en defecto) no atrasadas ni en estado `"En espera - Moldes"`. | `(total_RE - (atrasadas_RE + en_espera_RE)) / total_RE * 100` (con denominador `1` si es `0`). | `summary` API / SQL |
| `Nivel de servicio Molde Nuevo` | % de órdenes cuyo defecto contiene `"Nuevo"` que no están atrasadas ni `"En espera - Moldes"`. | `(total_Nuevo - (atrasadas_Nuevo + en_espera_Nuevo)) / total_Nuevo * 100` | `summary` API / SQL |
| `Nivel de servicio RR` | % de reparaciones `"Rapida"` con `FECHAENTREGA <= FECHAESPERADA`. | `cumplidas_RR / total_RR * 100` | `summary` API / SQL |
| `Moldes Nuevos atrasados` | Conteo de órdenes con `"Nuevo"` donde `FECHAENTREGA > FECHAESPERADA` o `ESTADO = "En espera - Moldes"`. | `COUNTROWS(FECHAENTREGA>FECHAESPERADA) + COUNTROWS(ESTADO="En espera - Moldes")` | `summary` API / SQL |
| `Reparaciones especiales atrasadas` | Conteo de `Tipodereparacion = "Especial"` sin `"Nuevo"` con entrega tardía o `"En espera - Moldes"`. | Igual que anterior filtrando `Tipodereparacion = "Especial"` y `NOT CONTAINS("Nuevo")`. | `summary` API / SQL |
| `Reparaciones rapidas atrasadas` | Conteo de `Tipodereparacion = "Rapida"` con `FECHAENTREGA > FECHAESPERADA`. | `COUNTROWS(FECHAENTREGA > FECHAESPERADA && Tipodereparacion = "Rapida")` | `summary` API / SQL |
| `Entrega Moldes` | Cantidad ponderada de entregas: los registros con `DEFECTOSAREPARAR = "Desmanchado,"` valen `1/3` y el resto vale `1`. | `DIVIDE(COUNT(Desmanchado,), 3) + COUNT(<> Desmanchado,)` | `summary` API / SQL |
| `Moldes esperados` | Total de órdenes cuyo `DEFECTOSAREPARAR` contiene `"Nuevo"`. | `COUNTROWS(FILTER('BD Moldes', CONTAINSSTRING(..., "Nuevo")))` | `summary` API / SQL |
| `Reparaciones especiales esperadas` | Total de `Tipodereparacion = "Especial"` sin `"Nuevo"`. | `COUNTROWS(FILTER('BD Moldes', Tipodereparacion="Especial" && NOT CONTAINS("Nuevo")))` | `summary` API / SQL |
| `Vueltas por reparacion` | Promedio de `Vueltastotales` (de `Listado Moldes`) sobre número de órdenes en `BD Moldes`. | `SUM('Listado Moldes'[Vueltastotales]) / COUNTROWS('BD Moldes')` | `summary` API / SQL |
| `Cantidad de moldes` | Conteo de moldes en `Listado Moldes` con `Estado = "Disponible"`. | `COUNTROWS(FILTER('Listado Moldes', [Estado]="Disponible"))` | `summary` API / SQL |
| `dias sin moldes` | Suma de `Dias fuera` en `BD Moldes`. | `SUM('BD Moldes'[Dias fuera])` | `summary` API / SQL |
| `dias` | Conteo de días en `Calendario` en el contexto del filtro. | `COUNTROWS(Calendario)` | `summary` API / SQL |
| `Promedio dias fuera` | Promedio de `Dias fuera` (prorrateado por defecto) en `BD Moldes (Defectos)`. | `DIVIDE(SUM('BD Moldes (Defectos)'[Dias fuera]), COUNT('BD Moldes (Defectos)'[CODIGOMOLDE]))` | `summary` API / SQL |
| `Indice de indisponibilidad de moldes` | `Promedio dias fuera` dividido entre los días del mes de cierre (`DAY(ENDOFMONTH(FECHAENTRADA))`). | `DIVIDE([Promedio dias fuera], DAY(ENDOFMONTH('BD Moldes (Defectos)'[FECHAENTRADA])))` | `summary` API / SQL |

Medidas sin uso en visuales (no migrar, confirmar):

- `BD Moldes[Entrada de moldes]` (`COUNT('BD Moldes'[Title])`)
- `Acumulado mes Prog MS[Medida]` (vacía)

### Visuales y filtros

El reporte tiene **14 páginas visibles**:

| Página | Visuales principales | Filtros / Segmentadores |
|---|---|---|
| 1. `General` | Barras por `FECHAESPERADA` y `ESTADO`, dona de defectos, treemap de `Vueltastotales` por `CODIGOMOLDE` | `Tipodereparacion`, `Listado Moldes` (`Estado`, `Número de seri`, `Title`), `FECHAESPERADA`, `Defectos Moldes[Title]`, `ESTADO` |
| 2. `Defectos` | Dona de defectos, barras agrupadas por mes (`Calendario`) y defecto | `Tipodereparacion`, `Calendario[Date]`, `ESTADO` |
| 3. `Evo defectos` | Gráfico de líneas de defectos en el tiempo (`Calendario`) | `Listado Moldes`, `FECHAESPERADA`, `Defectos Moldes[Title]` |
| 4. `Análisis de vueltas` | Tabla de moldes (`Vueltastotales`, `Vueltas por reparacion`, defecto) | `Estado`, `Estado Molde`, `Número de seri`, `DEFECTOSAREPARAR`, `Created`, `Planta` |
| 5. `Indicadores` | 3 tacómetros (`Nivel de servicio Molde Nuevo / RE / RR`), línea histórica por `FECHAESPERADA`, barras `Entrega Moldes` por `Tipo de reparación 2`, cards de atrasados/esperados/entregados y tabla detalle | `FECHAENTREGA`, `Tipo de reparación 2` (más filtros locales en cards por texto en `DEFECTOSAREPARAR`) |
| 6. `Cantidad de moldes` | Card `Cantidad de moldes` y tabla de `Listado Moldes` | Filtro de página `BD Moldes[FECHAENTREGA]`; slicers `Número de seri`, `Planta`, `Estado` |
| 7. `Programación` | Combo barras+línea: órdenes de `BD Moldes (Defectos)` por `TipoReparacion2` vs `query_ordenes_fabricacion[Cantidad]` en `Calendario` | `Calendario[Año/Mes]`, `Calendario[Date]`, `TipoReparacion2` |
| 8. `Indisponibilidad` | Tabla dinámica con `Dias fuera`, `Promedio dias fuera`, `Indice de indisponibilidad de moldes` por molde y defecto | `DEFECTOSAREPARAR`, `CODIGOMOLDE/Title`, `Calendario` |
| 9. `Análisis disponibilidad` | Cards (`dias`, `Cantidad de moldes`, `dias sin moldes`, `Promedio dias fuera`, `Indice de indisponibilidad`), línea del índice, barras por `ESTADO` y tabla por molde | Filtro de página `BD Moldes[FECHAENTREGA]`; slicers `Calendario`, `Defectos Moldes`, `DEFECTOSAREPARAR`, `Listado Moldes` |
| 10. `Auditoria` | Tabla de auditoría (`id`, `Title`, `FECHAENTRADA`, `FECHAENTREGA`, `Dias fuera`, `DEFECTOSAREPARAR`, índice) | `Listado Moldes` |
| 11. `Moldes nuevos` | Línea temporal filtrada a `ESTADO = "Entregado"` y `Defectos Moldes[Title] IN ("Molde Nuevo", "Modelo nuevo")` | `Calendario` |
| 12. `Historial` | Tabla completa de órdenes (`CODIGOMOLDE`, `Title`, `DEFECTOSAREPARAR`, `ESTADO`, `FECHAENTRADA`, `FECHAENTREGA`, `OBSERVACIONES`, `Tipodereparacion`) | `DEFECTOSAREPARAR`, `CODIGOMOLDE`, `ESTADO`, `Calendario` |
| 13. `Criticidad` | Treemap `Vueltastotales` por `CODIGOMOLDE` y línea de defectos por `FECHAENTRADA` | `FECHAENTRADA`, `Defectos Moldes[Title]` |
| 14. `Moldes activos` | Tabla de códigos de molde | `BD Moldes (Defectos)[ESTADO]`, `BD Moldes (Defectos)[Title]` |

### Seguridad (RLS)

- ¿Tiene roles? **No** (no existe carpeta `roles/` ni definiciones de RLS en el modelo TMDL).

### Riesgos y preguntas para el dueño de negocio

1. **Origen real de datos (SharePoint vs. Supabase):** En el `.pbip`, 6 de las 7 tablas leen listas de SharePoint y solo `query_ordenes_fabricacion` lee de Supabase. Dado que indicaste que este BI consulta `https://vuiuorjzonpyobpelyld.supabase.co`, ¿ya existen en ese Supabase las tablas equivalentes a `BD Moldes`, `Historico BD Moldes`, `Listado Moldes` y `Defectos Moldes`, o debemos seguir consumiendo alguna tabla de SharePoint / sincronizarla primero?
2. **Alcance y consolidación de vistas (14 páginas):** El reporte tiene 14 pestañas con varios solapamientos (p. ej. `General`, `Defectos`, `Evo defectos`, `Criticidad`; `Indisponibilidad` y `Análisis disponibilidad`; `Auditoria` y `Historial`). ¿Migramos las métricas clave en una vista principal + vistas/pestañas temáticas en `/moldes` y `/moldes/detalle`, o se requiere conservar las 14 secciones exactas?
3. **Reglas de negocio a confirmar:**
   - En `Nivel de servicio RE` y `Molde Nuevo`, cuando el denominador es `0`, el DAX usa `1` (lo que arroja `100%` aunque no haya órdenes) y cuenta registros `"En espera - Moldes"` como incumplimiento; en cambio `Nivel de servicio RR` da `0` o error si el denominador es `0` y no resta `"En espera - Moldes"`. ¿Mantenemos esa asimetría o estandarizamos?
   - En `Entrega Moldes`, el factor `1/3` aplica únicamente cuando `DEFECTOSAREPARAR = "Desmanchado,"` (texto exacto con coma final). ¿Sigue vigente esa regla?
   - En `TipoReparacion2` (tabla defectos) hay nombres propios hardcodeados (`Bernardo Alfredo Restrepo Calle`, `Yurany Andrea Ortiz Torres`) para clasificar como `"Especial"`. ¿Se conserva o se reemplaza por un criterio/rol en datos?
   - En las páginas 4, 6, 9 y 10 hay filtros visuales residuales `> 99999999` sobre medidas (aparentemente usados para ocultar filas en tablas). ¿Se deben ignorar al migrar?
   - `BD Moldes[Entrada de moldes]` y `Acumulado mes Prog MS[Medida]` no se usan en visuales: ¿confirmas no migrarlas?
4. **Tabla `Acumulado mes Prog MS`:** Aunque carga una lista de producción MS y tiene relación `1:1` por `Id` con `BD Moldes`, ningún visual usa columnas suyas (solo aloja 4 medidas que apuntan a otras tablas). ¿Confirmas que no se requiere migrar esa fuente?

### Hallazgos profundos del reporte (.pbip)

1. **Tablas ocultas por filtro `> 99999999`:** En las páginas 4 (`Análisis de vueltas`), 6 (`Cantidad de moldes`), 9 (`Análisis disponibilidad`) y 10 (`Auditoria`), las tablas (`tableEx`) tienen un filtro visual `> 99999999` sobre una medida, dejándolas siempre vacías.
2. **Cards con `Min(BD Moldes.Title)` en `Indicadores` (P5):** 4 tarjetas muestran el primer texto alfabético de `Title` (filtradas por `"Molde Nuevo"`, `"Modelo nuevo"`, `"Rapida"`, etc.) en lugar de un conteo.
3. **Etiquetas invertidas o confusas en `Acumulado mes Prog MS` (P6 y P9):** En el `.Report`, `Cantidad de moldes` aparece rotulada como `"Dias calendario"`, `dias sin moldes` como `"Salidas de moldes"` e `Indice de indisponibilidad de moldes` como `"Indice de disponibilidad"`.
4. **Slicer duplicado en `Historial` (P12):** `BD Moldes.DEFECTOSAREPARAR` aparece dos veces.
5. **Inconsistencia en fechas y denominadores:** `Calendario` filtra por `FECHAENTREGA` (excluyendo órdenes abiertas), mientras P1/P3/P13 mezclan `FECHAESPERADA` o `FECHAENTRADA`; `Indice de indisponibilidad` divide por `DAY(ENDOFMONTH(FECHAENTRADA))` (solo último mes en rangos multimensuales); `Vueltas por reparacion` divide `SUM(Vueltastotales)` entre `COUNTROWS(BD Moldes)` sin garantizar relación directa.

### Decisiones de migración (en curso)

- **D1 (2026-11-18):** Consolidar las 14 páginas del `.pbip` en `/moldes` (4 vistas temáticas: Servicio y entregas, Disponibilidad e indisponibilidad, Defectos y criticidad, Vueltas y programación) + `/moldes/detalle` (Historial/Auditoría), descartando las tablas ocultas (`> 99999999`) y la página aislada `Moldes activos`.
- **D2 (2026-11-18):** Convertir las 4 tarjetas `Min(BD Moldes.Title)` de `Indicadores` en conteos reales (`COUNT`) con sus filtros respectivos (Moldes nuevos entregados, Modelos nuevos, Reparaciones rápidas entregadas y Reparaciones totales excluyendo nuevos/destruir).
- **D3 (2026-11-18):** Se adopta `FirplakDesarrollador/App_Moldes` (`src/services/indicators.service.ts`) como referencia principal de negocio en lugar del `.pbip` obsoleto:
  - Deduplicación por `codigo_molde | fecha_entrada` (prioriza `fecha_entrega` y luego mayor `id`).
  - 5 categorías canónicas (`Todos`, `REPARACION_RAPIDA`, `REPARACION_ESPECIAL`, `MOLDE_NUEVO`, `MODELO_NUEVO`).
  - Modo dedicado de **Reparación Rápida** con ponderación `MS ×1`, `FV ×1`, `Desmanchado MS ×⅓`, `Desmanchado FV ×½`, `Brillado ×½`, meta `24/día` y `3.4/operario`.
  - **Índice de Indisponibilidad por referencia** (`nombre_articulo` sobre moldes no destruidos, días solapados en rango).
  - **Pareto de defectos** Top 10 con curva `% acumulado`.

**Validación del dueño de negocio:** Alejandro Isaza — 2026-11-18 — Aprobadas D1, D2, D3, D4, peso `1/3` y unión en solo lectura.

## 2. Tabla de reporte y carga incremental

> **Consultado directamente en `https://vuiuorjzonpyobpelyld.supabase.co` (solo lectura):**
> - No se requieren tablas nuevas ni SPs en SQL Server: los datos viven y se actualizan directamente en Supabase Moldes.
> - **Tablas consultadas:** `BD_moldes` (557 filas), `base_datos_historico_moldes` (48.746 filas), `moldes` (1.495 filas), `planta_moldes` (1.540 filas), `Defectos_moldes` (51 filas) y `ordenes_fabricacion` (`pendiente = false`).
> - **Grano (vista detalle):** una fila por orden deduplicada (`repair_event_id` o clave compuesta M).
> - **Fecha de referencia:** `FECHA ENTRADA` / `fecha_entrada` (órdenes) y `fecha_entrega_real` (`ordenes_fabricacion`).

## 3. Contrato del endpoint

`GET /api/moldes` (Route Handler Next.js en `app/api/moldes/route.ts` consultando `vuiuorjzonpyobpelyld.supabase.co` server-side)

Parámetros: `anio`, `mes`, `planta`, `tipoReparacion`, `estado`, `defecto`, `responsable`, `search`, `page`, `pageSize`.

**Aprobación del contrato:** Alejandro Isaza — 2026-11-18 — Implementado en `lib/moldes/types.ts` y `lib/moldes/service.ts`.

## 4. Endpoint

- Archivos tocados: `lib/moldes/types.ts`, `lib/moldes/supabase.ts`, `lib/moldes/service.ts`, `app/api/moldes/route.ts`.
- Variables nuevas en `.env.example`: `SUPABASE_MOLDES_URL`, `SUPABASE_MOLDES_ANON_KEY`, `SUPABASE_MOLDES_SERVICE_ROLE_KEY`.
- Prueba contra la base: 2026-11-18 — `SERVICE_ROLE_KEY` validada (`200 OK`) contra `vuiuorjzonpyobpelyld.supabase.co`.

## 5. Dashboard

- Rutas: `/moldes` (`app/moldes/page.tsx`) y `/moldes/detalle` (`app/moldes/detalle/page.tsx`).
- Proxy/API: `app/api/moldes/route.ts` (registrado en `lib/reports.ts` y `lib/dashboard/navigation.ts`).
- Componentes reutilizados: `DashboardShell`, `FilterSelect`, `MetricCard`, `MetricSkeleton`, `ShareList`, `TablePager`, `MoldesDashboard`.
- Revisión visual (375 / 820 / 1440 px): `pendiente` de validación del usuario en `localhost:3000`.

## 6. Conciliación con Power BI

| Indicador | Periodo | Dashboard | Power BI | Diferencia | Causa |
|---|---|---|---|---|---|

**Firma del dueño de negocio:** Alejandro Isaza — fecha — `pendiente`

## 7. Despliegue y retiro

- API / Backend desplegado (versión / fecha):
- Frontend desplegado (commit / fecha):
- Documentación en VibeWorkFlow (flujo, área, id y fecha de aprobación):
- Power BI retirado (fecha):
- Rollback:
