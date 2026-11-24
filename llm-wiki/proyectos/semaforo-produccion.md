---
status: draft
updated: 2026-11-23
sources:
  - ../../proyectos/semaforo-produccion/fuentes/SEMAFORO_original.sql
  - ../../sql/semaforo-produccion/01_informe_semaforo_produccion.sql
  - ../../sql/semaforo-produccion/02_job_semaforo_produccion.sql
  - ../../sql/semaforo-produccion/03_validacion.sql
  - ../../sql/ns-plantas/01_informe_ns_plantas.sql
  - ../bi/ns-plantas.md
---

# Proyecto: Semáforo de producción

Informe nuevo en el portal a partir del SP `Planos_Symphony.dbo.SEMAFORO`. **No es una migración de BI**: no hay `.pbip` y no sigue la skill `migrar-bi`, aunque usa el mismo patrón (tabla de reporte + SP + job, endpoint y dashboard). Rama `proyecto/semaforo-produccion`.

- **Dueño de negocio:** `pendiente` (Manufactura; en NS Plantas dijeron que "los amortiguadores son fijos y están en el semáforo de producción", [respuesta 1](../bi/ns-plantas.md)).
- **Consumidores actuales de `dbo.SEMAFORO`:** `pendiente` (Excel u otros reportes que lo llamen).
- **Estado:** tabla y SP creados y validados contra `dbo.SEMAFORO` el 2026-11-23 (comparación cerrada, sin diferencias sin explicar). Falta: crear el job, validar las correcciones con Manufactura y aprobar el contrato del endpoint.

## Qué calcula

Una fila por orden de fabricación (OP) de `OWOR` en estado planificada (`P`) o liberada (`R`), o cerrada (`L`) en los últimos 30 días, de las bodegas `PT-01`, `PT-02` y `PT-08`, con pedido de venta (`ORDR`), familia en `@FIR_FAM_SYMPH`, amortiguador en `@FIR_AMORTIGUADORES` y molde en `OITM`. Tres semáforos, todos medidos en días hábiles contra el amortiguador de la familia:

| Semáforo | Mide | Fecha meta | Consumo | Colores |
|---|---|---|---|---|
| Liberación | ¿Se liberó la OP a tiempo? | Fecha recomendada de liberación: STOCK = día hábil siguiente a la creación; STANDARD = entrega del lote menos el amortiguador | Días hábiles desde la fecha recomendada hasta la liberación (u hoy) | `>= 100 %` BLACK, `>= 66,6` RED, `>= 33,3` YELLOW, `>= 0` GREEN, negativo CYAN |
| Producción (planta) | ¿La planta cerró dentro del amortiguador? | Fecha ideal = liberación + amortiguador − 1 días hábiles (regla de [NS Plantas](../bi/ns-plantas.md)) | Días hábiles desde la liberación (día 1) hasta el cierre (u hoy) | `> 100` BLACK, `> 66,6` RED, `> 33,3` YELLOW, `>= 0` GREEN |
| Firplak (programa) | ¿Se cumplió la entrega del lote? | `OWOR.DueDate` | Días hábiles de retraso (negativo = faltan días) | `> 0` BLACK, `> −33,3` RED, `> −66,6` YELLOW, `> −100` GREEN, resto CYAN |

Además: cantidad pendiente de la OP y del lote (todas las OP abiertas del mismo `pedido-línea`), disponible en `PT-01`, capacidad del molde (moldes activos en `OSRN` × `U_NumVueltas` × turnos de la planta) y fecha prometida del ítem (`RDR1.ShipDate` menos los días de distribución del tipo de pedido).

## Problemas de lógica del SP original

Corregidos en el SP nuevo (cada uno tiene su causa en la consulta B4 de [`03_validacion.sql`](../../sql/semaforo-produccion/03_validacion.sql)):

| # | Problema | Efecto en el original | Corrección |
|---|---|---|---|
| L1 | La fecha ideal cuenta los días no laborables desde el mismo día de liberación (`BETWEEN @FRealLib AND ...`); NS Plantas cuenta desde el día siguiente. | OP liberada un sábado, domingo o festivo: fecha ideal un día hábil después que en NS Plantas. Los dos informes no coinciden. | Regla de NS Plantas (validada por Manufactura): la liberación siempre es el día 1. |
| L2 | La liberación recomendada STANDARD empieza a buscar en `n = 1`, así que nunca devuelve la fecha de entrega. | Amortiguador 1 (`MBLP`): un día calendario antes de la entrega, que puede ser sábado o domingo. | Amortiguador 1 = la fecha de entrega del lote. |
| L3 | La búsqueda de la liberación STANDARD solo recorre 15 días calendario (`TOP 15 ... sys.objects`). | Amortiguador 13 (`ESPGAB`): necesita 12 días hábiles (~16 calendario) y queda en `NULL`. | Sin límite: se calcula con el calendario. |
| L4 | La fecha centinela `1900-01-01` solo se reemplaza si hay fecha de entrega y amortiguador. | OP STANDARD sin `DueDate`: fecha recomendada 1900-01-01, consumo de ~46.000 días, BLACK y "No cumplió". | Sin centinela: queda sin fecha recomendada (`SIN DATO`). |
| L5 | La liberación STOCK cuenta el día de creación entre los no laborables. | OP STOCK creada un sábado o festivo: recomendada el segundo día hábil, no el primero. | El día hábil siguiente a la creación. |
| L6 | Los días de distribución también empiezan en `n = 1`; si no encuentran fecha en 15 días, restan días calendario. | Tipo de pedido con 0 días: resta 1 día igual. | Días hábiles exactos; 0 = la fecha de envío. |
| L7 | Días de retraso Firplak de una OP **cerrada antes** de la entrega: `BETWEEN FEntLote AND FCierreOP` con los extremos al revés cuenta 0 no laborables. | Días calendario en lugar de hábiles: la OP se ve más adelantada (más GREEN o CYAN). | Días hábiles en los dos sentidos. |
| L8 | Cumplimiento Firplak compara `GETDATE()` (con hora) con la fecha de entrega. | Una OP abierta aparece "No Cumplió" desde las 00:00 del mismo día de entrega. El cumplimiento de planta sí usaba `CAST(GETDATE() AS DATE)`. | Se compara con la fecha de hoy. |
| L9 | Consumo de amortiguador `ELSE 0` para las OP sin liberar. | El color de producción sale GREEN; `SIN LIBERAR` nunca aparece. | Consumo `NULL` y color `SIN LIBERAR`. |
| L10 | El `ELSE` de los colores atrapa los `NULL`. | Sin fecha recomendada o sin fecha de entrega, el color es CYAN ("adelantada"). | Color `SIN DATO`. |
| L11 | El cumplimiento de liberación cae en `ELSE 'Sin liberar'` cuando no hay fecha recomendada. | Una OP **liberada** de tipo distinto a STANDARD/STOCK dice "Sin liberar". Igual con el cumplimiento de planta sin fecha ideal (`NULL`). | `Sin fecha recomendada` y `Sin fecha ideal`. |
| L12 | El lote se arma con `SUBSTRING`/`PATINDEX`: sin dos guiones da `''` o `pedido-`. | Todas las OP con lote vacío o incompleto se suman como un solo lote en la cantidad pendiente del lote. | Lote `NULL` si no tiene el formato `pedido-línea-consecutivo`; no se agrupa. |

Además, con el original:

- **El SP puede fallar completo.** El `UPDATE` de `FPromEntitem` hace `SUBSTRING` con longitud negativa si un lote no tiene dos guiones, y `CONVERT(INT, ...)` si la línea no es numérica. Como el optimizador puede evaluar la expresión antes del filtro, basta un lote mal escrito en `OWOR`. El nuevo valida el formato antes de convertir (consulta A4).
- **OP repetidas.** El `DISTINCT` no garantiza una fila por OP: si `@FIR_FAM_SYMPH` o `@FIR_AMORTIGUADORES` repiten clave, o si dos pedidos comparten `DocNum` (series distintas), la OP sale dos veces y el cursor (`WHERE Codigo = ...`) les pone la misma fecha ideal. El nuevo falla con aviso en `Cargas_Log` y conserva la carga anterior (consultas A1 y A3).
- **Calendario que vence.** `@FIR_FECHAS_PROD` solo tiene fechas del 2025 al 2028-01-01 ([NS Plantas](../bi/ns-plantas.md)). Para fechas anteriores o posteriores, el original cuenta sábados y domingos como hábiles. El nuevo usa `dbo.Calendario_Laboral` (2013–2040).

Se conservan sin cambio, `pendiente` de confirmar con Manufactura:

| # | Comportamiento | Riesgo |
|---|---|---|
| R1 | `INNER JOIN OITM T7` por `U_Molde`: las OP cuyo artículo no tiene molde no salen. | Si hay plantas sin moldes (p. ej. muebles), desaparecen del semáforo sin aviso. Consulta A2, columna `SinMolde`. |
| R2 | Pedido por `OriginNum = DocNum` y no por `OriginAbs = DocEntry`. | Pedido equivocado si se repite el número. Consulta A3. |
| R3 | La cantidad pendiente del lote suma OP abiertas de **todas** las bodegas, no solo `PT-01/02/08`. | Puede ser intencional. |
| R4 | `U_Linea` fuera de `F01`–`F07`, `F09`–`F11` (p. ej. `F08`): planta `NULL`. | Las OP aparecen sin planta. Consulta A2 por `U_Linea`. |
| R5 | Umbrales con `>=` en liberación y `>` en producción y Firplak. | El 100 % exacto es BLACK en liberación y RED en producción. |
| R6 | `WITH (NOLOCK)` en todas las lecturas de SAP. | Lecturas sucias; aceptable para un semáforo que se recarga cada hora. |

## Rendimiento del SP original

| # | Problema | Costo |
|---|---|---|
| P1 | `INNER JOIN RDR1` y `WOR1` sin usar sus columnas, más `DISTINCT`. | Cada OP se multiplica por (líneas del pedido × componentes de la OP) y luego se ordena todo para quitar duplicados. Es el mayor costo de la primera consulta. |
| P2 | Cursor para la fecha ideal, con `UPDATE ... WHERE Codigo = @Codigo` sobre una tabla temporal sin índice. | N iteraciones × (30 conteos sobre `#FechasProd` + recorrido completo de `#TT_INTERFASE`): crece como N². |
| P3 | Subconsultas correlacionadas por fila contra `#FechasProd` (sin índice) en ocho `UPDATE`, y `TOP 15 ... FROM sys.objects` como tabla de números. | Lee el catálogo del sistema por cada fila. |
| P4 | `FPromEntitem` vuelve a unir `OWOR`, `ORDR` y `RDR1` con una expresión de texto en el `ON`. | Lecturas repetidas de SAP; además puede fallar (ver arriba). |
| P5 | La cantidad pendiente del lote agrupa todo `OWOR` abierto por una expresión `SUBSTRING`/`PATINDEX` repetida. | `GROUP BY` sobre una expresión y unión no sargable con `COLLATE` en los dos lados. |
| P6 | Unos 20 `UPDATE` sobre la tabla temporal y `GETDATE()` evaluado en cada uno. | Pasadas extra; "hoy" puede cambiar a medianoche durante la ejecución. |
| P7 | Se ejecuta completo contra SAP cada vez que alguien lo consulta. | Sin caché: cada uso del semáforo es una consulta pesada en producción. |

## Diseño nuevo

Scripts (los revisa y ejecuta el desarrollador):

- [`01_informe_semaforo_produccion.sql`](../../sql/semaforo-produccion/01_informe_semaforo_produccion.sql): tabla `dbo.Informe_semaforo_produccion` y SP `dbo.sp_Actualizar_Informe_semaforo_produccion`.
- [`02_job_semaforo_produccion.sql`](../../sql/semaforo-produccion/02_job_semaforo_produccion.sql): job `BI - Semáforo producción carga`.
- [`03_validacion.sql`](../../sql/semaforo-produccion/03_validacion.sql): consultas previas (parte A) y comparación con `dbo.SEMAFORO` (parte B).

| Tema | Decisión |
|---|---|
| Grano | Una fila por OP. PK `DocEntry`. |
| Alcance | El mismo del original (ver "Qué calcula"). `WOR1` pasa a `EXISTS` para no cambiar qué OP entran. |
| Carga | Recarga completa en cada corrida: el alcance son unas miles de OP. Dentro de una transacción (`TRUNCATE` + `INSERT`), con `sp_getapplock` y bitácora en `dbo.Cargas_Log` (`Proceso = Informe_semaforo_produccion`). Si falla, la tabla conserva la carga anterior. |
| Días hábiles | `dbo.Calendario_Laboral` de [NS Plantas](../bi/ns-plantas.md) (sábados, domingos, festivos de Colombia y `@FIR_FECHAS_PROD`). Con `NumDiaHabil`, los días hábiles entre dos fechas son una resta y cada fecha meta es una unión con el calendario: sin cursor ni subconsultas por fila. Dependencia: el job semanal de NS Plantas reconstruye el calendario; si falta la fecha de hoy, la carga falla con aviso. |
| Valores que dependen de hoy | Consumos, colores y cumplimientos se calculan en la carga con `@Hoy`. Quedan al corte de `FechaCarga`; por eso el job corre también a las 0:05. |
| Job | Todos los días cada hora de 6:00 a 20:00 (15 corridas) y a las 0:05. Decisión del desarrollador el 2026-11-24 (antes se proponía cada 15 minutos). |
| Índices | PK agrupada por `DocEntry`; `IX_..._Planta` por (`Planta`, `FechaRecomendadaEntrega`) con los colores incluidos, para el filtro principal. |
| `dbo.SEMAFORO` | No se modifica. Opcional, después de validar: que lea la tabla con los mismos nombres de columna (sección 5 del script), para que sus consumidores dejen de recalcular contra SAP. |

### Columnas: original → tabla

| Original | Tabla | Notas |
|---|---|---|
| `Originnum`, `Nro OP`, `SKU`, `Descripción Artículo`, `Cliente` | `PedidoOrigen`, `DocNum`, `CodArticulo`, `Articulo`, `Cliente` | |
| `Planta`, `Familia`, `Tipo Orden`, `Estado`, `Destino` | `Planta`, `Familia`, `TipoOrden`, `Estado`, `Bodega` | `TipoOrden` en mayúsculas y sin espacios. |
| `Cant. Pendiente`, `Cant. Pend. Item`, `Cantidad total`, `Disponible PT01` | `CantidadPendiente`, `CantidadPendienteLote`, `CantidadTotal`, `DisponiblePT01` | |
| `Fecha Creación OP`, `Fecha Recomendada Liberación`, `Fecha Real Liberación` | `FechaCreacion`, `FechaLiberacionRecomendada`, `FechaLiberacion` | |
| `Consumo Para Liberar`, `Color Liberación`, `Color Liberación Txt`, `Cumplimiento Liberación` | `ConsumoLiberacion`, `PctLiberacion`, `ColorLiberacion`, `CumplimientoLiberacion` | |
| `Fecha Entrega Lote`, `Fecha Recomendada de Entrega`, `Fecha Cierre OP`, `Fecha Ideal Entrega Producción` | `FechaEntregaLote`, `FechaRecomendadaEntrega`, `FechaCierre`, `FechaIdealProduccion` | |
| `Consumo Amortiguador Planta`, `Color Producción`, `Color Producción Txt`, `Cumplimiento Planta` | `ConsumoAmortiguador`, `PctProduccion`, `ColorProduccion`, `CumplimientoPlanta` | |
| `Dias Retrazo Firplak`, `Color Firplak`, `Color Firplak Txt`, `Cumplimiento Firplak` | `DiasRetrasoFirplak`, `PctFirplak`, `ColorFirplak`, `CumplimientoFirplak` | |
| `Fecha Prometida Entrega Item`, `NumLote`, `Molde`, `Capacidad Molde`, `Fecha Carga Molde`, `Amortiguador` | `FechaPrometidaItem`, `NumLote`, `Molde`, `CapacidadMolde`, `FechaCargaMolde`, `Amortiguador` | `CapacidadMolde` pasa de texto a `decimal`. |
| — | `DocEntry`, `TipoPedido`, `DiasDistribucion`, `Lote`, `CodMolde`, `FechaCarga` | Nuevas, para filtros y trazabilidad. |

## Validación

Orden para el desarrollador:

1. Parte A de [`03_validacion.sql`](../../sql/semaforo-produccion/03_validacion.sql) (solo lectura). Pegar los resultados aquí; definen R1 a R4.
2. Ejecutar [`01_informe_semaforo_produccion.sql`](../../sql/semaforo-produccion/01_informe_semaforo_produccion.sql) (tabla y SP).
3. Parte B en una sola ventana: ejecuta `dbo.SEMAFORO` y el SP nuevo y compara.
   - B0: tiempo del original frente al nuevo.
   - B1 y B2: mismas OP en los dos (esperado: 0 solo en uno u otro, salvo duplicados del original).
   - B3: cantidades, molde, capacidad y amortiguador sin diferencias; fechas y colores con diferencias solo por L1 a L12.
   - B4: cada diferencia con su causa. Las filas `Revisar` se analizan antes de aprobar.
4. Crear el job con [`02_job_semaforo_produccion.sql`](../../sql/semaforo-produccion/02_job_semaforo_produccion.sql).

### Parte A (2026-11-23, desarrollador)

| Consulta | Resultado | Conclusión |
|---|---|---|
| A1 claves repetidas | Ninguna en `@FIR_FAM_SYMPH` ni en `@FIR_AMORTIGUADORES`. | El SP nuevo no debería fallar por duplicados. |
| A2 OP fuera por cada unión | 2.950 OP en el alcance base. 77 sin familia en `@FIR_FAM_SYMPH` (23 de ellas sin pedido; 54 con `U_Linea` vacía). 0 sin amortiguador, 0 sin molde y 0 sin componentes. Todas las líneas presentes (`F01`–`F06`, `F09`–`F11`) tienen planta. | **R1 cerrado:** la unión con el molde no deja OP fuera hoy. **R4 cerrado:** las OP sin `U_Linea` ya salen por no tener familia, así que ninguna queda con planta `NULL`. Las uniones con `WOR1` y `@FIR_AMORTIGUADORES` tampoco excluyen nada. |
| A3 pedido por `DocNum` | 2.924 OP, 0 con `OriginAbs` distinto. | R2 cerrado: la unión por `DocNum` es correcta hoy. |
| A4 formato del lote | 2.924 correctas y 23 vacías; ninguna con formato incompleto. | El fallo por `SUBSTRING` no ocurre hoy, pero puede ocurrir. L12 afecta a las 23 vacías. |
| A5 tipos de pedido | Los 13 tipos (1–4, 6–10, 12–15) tienen `Code`. `U_Dias_Distr` = 1, salvo el tipo 2 = **0** (631 OP) y el tipo 3 = 3 (388 OP). | **L6 afecta a 631 OP**: el original les resta 1 día que no corresponde. |
| A6 tipos de orden | STANDARD 2.251, STOCK 641 y **55 sin tipo** (19 cerradas, 35 planificadas y 1 liberada). | Las 55 no tienen fecha recomendada de liberación: en el original salen CYAN; en el nuevo, `SIN DATO` (L10, L11). |
| A7 calendario | OP abiertas creadas desde el 2013-08-16 y entregas hasta el 2027-11-05; calendario de 2013 a 2040. | Cubierto. Hay OP abiertas de 2013: antes de 2025, el original contaba los fines de semana como días hábiles. |

### Parte B (2026-11-23, desarrollador): comparación cerrada

Segunda corrida completa (la primera se repitió por errores del script de validación: intercalación de `#orig` y alias en el `ORDER BY`).

- **B0:** original 7.307 ms, nuevo 1.559 ms (4,7 veces más rápido). En la primera corrida: 8.579 frente a 1.824 ms.
- **B1/B2:** 2.880 OP en los dos (2.876 en la corrida anterior: OP nuevas entre corridas), ninguna repetida ni solo en un lado.
- **B3:** sin diferencias en fecha recomendada de entrega, fecha de carga del molde, cantidades, cantidad pendiente del lote, disponible PT-01, capacidad del molde ni amortiguador.
- **B5:** todas las diferencias tienen causa; **0 `Revisar`**. B6 sin filas. B4 (primeras 500 filas, `Revisar` primero): 397 L6, 67 L2, 28 L3 y 8 L1.

| Columna | OP | Causa |
|---|---|---|
| Fecha recomendada de liberación | 67 + 28 | L2 amortiguador 1; L3 amortiguador largo |
| Fecha ideal | 8 | L1 liberación en día no laborable |
| Fecha prometida del ítem | 630 | L6 cero días de distribución (tipo de pedido 2) |
| Consumo / color / cumplimiento de liberación | 86 / 53 / 55 | Derivados de la fecha recomendada (L2 a L5) |
| Consumo del amortiguador | 323 + 8 | L9 sin liberar (0 → `NULL`); L1 |
| Color de producción | 323 + 4 | L9 sin liberar; derivado del consumo (L1) |
| Cumplimiento de planta | 1 | L1, por la fecha ideal |
| Días de retraso Firplak | 850 | L7 cierre antes de la entrega |
| Color Firplak | 377 | Derivado de los días de retraso (L7) |
| Cumplimiento Firplak | 17 | L8 entrega hoy |

L4, L5, L10 y L11 no aparecieron en los datos de hoy: el código los cubre, pero ninguna OP cae en esos casos ahora.

**Rollback:** `DROP PROCEDURE dbo.sp_Actualizar_Informe_semaforo_produccion; DROP TABLE dbo.Informe_semaforo_produccion;` y borrar el job (ver el script). `dbo.SEMAFORO` no cambia. **Diagnóstico:** `SELECT TOP (10) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_semaforo_produccion' ORDER BY Inicio DESC;`.

## Contrato propuesto del endpoint

Aprobado por el desarrollador el 2026-11-24, con la descarga en Excel (skill [`crear-endpoint`](../../.claude/skills/crear-endpoint/SKILL.md)). Sigue el patrón de `/api/v1/facturacion-diaria`.

`GET /api/v1/semaforo-produccion` con `Authorization: Bearer <REPORTING_API_TOKEN>`. Variables nuevas en `.env.example` de la API: `REPORT_SEMAFORO_TABLE_SCHEMA=dbo` y `REPORT_SEMAFORO_TABLE=Informe_semaforo_produccion`.

**Parámetros** (todos opcionales; sin periodo, porque el semáforo es el estado actual):

| Parámetro | Columna | Notas |
|---|---|---|
| `page`, `pageSize` | — | Como facturación. Orden fijo: `FechaRecomendadaEntrega`, `DocNum`. |
| `search` | `DocNum`, `PedidoOrigen`, `CodArticulo`, `Articulo`, `Cliente`, `NumLote` | `LIKE` parametrizado. |
| `planta`, `familia`, `tipoOrden`, `estado`, `bodega` | `Planta`, `Familia`, `TipoOrden`, `Estado`, `Bodega` | Igualdad. |
| `colorLiberacion`, `colorProduccion`, `colorFirplak` | `ColorLiberacion`, `ColorProduccion`, `ColorFirplak` | `BLACK`, `RED`, `YELLOW`, `GREEN`, `CYAN`, `SIN DATO`, `SIN LIBERAR`. |
| `cumplimientoLiberacion`, `cumplimientoPlanta`, `cumplimientoFirplak` | Columnas de cumplimiento | Texto exacto de la tabla. |
| `fechaEntregaDesde`, `fechaEntregaHasta` | `FechaEntregaLote` | `YYYY-MM-DD`. |

**Respuesta:**

```json
{
  "rows": [{
    "docEntry": 0, "opNumber": 0, "salesOrder": 0, "customer": "", "orderType": "", "distributionDays": 0,
    "itemCode": "", "itemName": "", "plant": "", "family": "", "workOrderType": "", "status": "", "warehouse": "",
    "lotNumber": "", "lot": "", "moldCode": "", "mold": "", "moldCapacity": 0,
    "plannedQty": 0, "pendingQty": 0, "lotPendingQty": 0, "availablePt01": 0, "buffer": 0,
    "createdAt": "YYYY-MM-DD", "recommendedReleaseDate": "", "releaseDate": "",
    "releaseConsumption": 0, "releasePct": 0, "releaseColor": "", "releaseCompliance": "",
    "lotDueDate": "", "recommendedDeliveryDate": "", "idealProductionDate": "", "closeDate": "",
    "productionConsumption": 0, "productionPct": 0, "productionColor": "", "plantCompliance": "",
    "firplakDelayDays": 0, "firplakPct": 0, "firplakColor": "", "firplakCompliance": "",
    "itemPromisedDate": "", "moldLoadDate": ""
  }],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 0 },
  "summary": {
    "ops": 0, "pendingQty": 0,
    "release":    { "byColor": { "BLACK": 0, "RED": 0, "YELLOW": 0, "GREEN": 0, "CYAN": 0, "SIN DATO": 0 }, "compliant": 0, "nonCompliant": 0, "pct": 0 },
    "production": { "byColor": { "BLACK": 0, "RED": 0, "YELLOW": 0, "GREEN": 0, "SIN LIBERAR": 0, "SIN DATO": 0 }, "compliant": 0, "nonCompliant": 0, "pct": 0 },
    "firplak":    { "byColor": { "BLACK": 0, "RED": 0, "YELLOW": 0, "GREEN": 0, "CYAN": 0, "SIN DATO": 0 }, "compliant": 0, "nonCompliant": 0, "pct": 0 },
    "byPlant": [{ "plant": "", "ops": 0, "black": 0, "red": 0, "yellow": 0, "green": 0 }]
  },
  "filterOptions": { "plantas": [], "familias": [], "tiposOrden": [], "estados": [], "bodegas": [] },
  "source": "sql-server",
  "loadedAt": "MAX(FechaCarga)",
  "updatedAt": "ISO"
}
```

- `summary` se calcula en SQL sobre **todo** el filtro, no sobre la página. `byPlant` usa el color de producción. `pct` = cumplidas / (cumplidas + no cumplidas), sin contar las que siguen en curso.
- `filterOptions` sale de la tabla completa, sin aplicar los filtros (no hay periodo).
- Propuesta adicional: `GET /api/v1/semaforo-produccion/export` en Excel con los mismos filtros, como facturación y entregas (los usuarios del SP probablemente lo consumen en Excel; `pendiente` confirmar).

## Endpoint (implementación)

Repositorio `reporting-api`, rama `proyecto/semaforo-produccion` (desde `main`), 2026-11-24. Sin commit ni despliegue.

- `src/semaforo.ts` (archivo nuevo, para no chocar con las ramas que también cambian `db.ts`): `getSemaforoReport` y `openSemaforoExport`. Filtros parametrizados (`sql.NVarChar(100)`, `sql.Date`), una sola consulta por lotes con 14 recordsets: 0 página, 1 total, 2 totales, 3–5 colores de liberación, producción y Firplak, 6 cumplimientos, 7 por planta, 8–12 catálogos, 13 `loadedAt`.
- `src/db.ts`: solo se exportan helpers existentes (`getPool`, `getExportPool`, `textValue`, `numberValue`, `dateValue`, `nullableNumberValue`, `safeIdentifier`, `required`, `openExportStream`, `dateExportSql`, `decimalExportSql`).
- `src/types.ts`: `SemaforoFilters`, `SemaforoRow`, `SemaforoIndicator`, `SemaforoSummary`, `SemaforoFilterOptions`, `SemaforoApiResponse`.
- `src/server.ts`: `semaforoFiltersFrom`, ruta `/api/v1/semaforo-produccion` y `/api/v1/semaforo-produccion/export` (archivo `semaforo-produccion_<hora>.xlsx`, 45 columnas).
- `.env.example`: `REPORT_SEMAFORO_TABLE_SCHEMA=dbo`, `REPORT_SEMAFORO_TABLE=Informe_semaforo_produccion`. README actualizado.
- Verificación: `npm run build` sin errores. **Sin probar contra SQL Server** (no hay conexión desde el entorno del agente): `pendiente` prueba local del desarrollador.

### Paquete de despliegue (2026-11-24)

- Rama `proyecto/semaforo-produccion` de `reporting-api` rebasada sobre `origin/main` (que ya trae Liberación, PR #6): commit `58654a1`.
- Rama `deploy/2026-11-24` (local, sin push) = `origin/deploy/2026-11-23` (último despliegue: NS Plantas, consolidado comercial, estados financieros, Liberación y PKT) + semáforo. Commit `c8b0a42`. Frente a `deploy/2026-11-23` solo cambia lo del semáforo (`semaforo.ts`, tipos, ruta, `export` de helpers, `.env.example` y README).
- Paquete: `reporting-api-dist-c8b0a42.zip` en la carpeta padre de los repositorios (14 archivos de `dist/`, incluidos `liberacion.js` y `semaforo.js`).
- Verificado: `npm run build` sin errores; arranque local con `/health` = 200; semáforo, `/export`, liberación, PKT y NS Plantas = 401 sin token; ruta inexistente = 404.
- Corrección: un primer paquete (`d4a4d32`, borrado) partía de `deploy/2026-11-19` porque el `fetch` había fallado por credenciales, y no traía Liberación. Con el `fetch` hecho (sesión de `gh`) apareció `deploy/2026-11-23`, que sí trae todo; la alerta sobre el zip de PKT del 2026-11-23 no aplica al despliegue real.
- `pendiente`: instalación en el servidor y prueba con token.

## Preguntas para Manufactura

1. ¿Quién usa hoy el semáforo y desde dónde llama a `dbo.SEMAFORO`?
2. R1: ¿las OP sin molde deben aparecer? (resultado de A2).
3. ¿Aceptan las correcciones L1 a L12? En especial L1, que hace coincidir la fecha ideal con NS Plantas.
4. ¿Les sirve que los datos se actualicen cada hora de 6:00 a 20:00?
5. R3: ¿la cantidad pendiente del lote debe sumar todas las bodegas o solo `PT-01`, `PT-02` y `PT-08`?
