---
status: draft
updated: 2026-11-18
sources:
  - ../../proyectos/consolidado-comercial/fuentes/Guia_Proyecto_PowerBI_Ventas_SAP_Firplak_Claude.docx
  - ../../proyectos/consolidado-comercial/sql/01-descubrimiento.sql
  - ../../proyectos/consolidado-comercial/sql/04-ofertas-b2c.sql
  - ../../sql/consolidado-comercial/01_informe_consolidado_comercial.sql
  - ../architecture/data-flow.md
---

# Proyecto: Consolidado comercial SAP

Proyecto nuevo; **no es una migración de BI**. No sigue la skill `migrar-bi` y se trabaja en la rama `proyecto/consolidado-comercial`, aparte de los BI en migración.

- **Solicitante:** Daniela Castro Correa (Comercial).
- **Especificación:** [guía funcional y técnica](../../proyectos/consolidado-comercial/fuentes/Guia_Proyecto_PowerBI_Ventas_SAP_Firplak_Claude.docx) del 2026-11-10 (estado: propuesta). Las cifras de la guía son ficticias.
- **Estado:** paso 1 (descubrimiento). [`01-descubrimiento.sql`](../../proyectos/consolidado-comercial/sql/01-descubrimiento.sql) , [`02-tablas-usuario.sql`](../../proyectos/consolidado-comercial/sql/02-tablas-usuario.sql) y [`03-diagnostico-saldo.sql`](../../proyectos/consolidado-comercial/sql/03-diagnostico-saldo.sql) ejecutados completos el 2026-11-10. La solicitante respondió el cuestionario el 2026-11-11 ([respuestas](#respuestas-de-la-solicitante-2026-11-11)). [`04-ofertas-b2c.sql`](../../proyectos/consolidado-comercial/sql/04-ofertas-b2c.sql) ejecutado el 2026-11-11. Faltan: los queries de Logística (Visor OV y Tránsito) y las preguntas de seguimiento.

## Objetivo

Un tablero que consolide, en una fecha de corte, el embudo comercial de SAP Business One (`ITPLAKINFO`, base `Firplak_SA`):

| Componente | Qué mide | Fuente |
|---|---|---|
| A. Ofertas | Saldo abierto de ofertas aún no convertido en OV | `OQUT` / `QUT1` |
| B. OV | Saldo de órdenes de venta aún no entregado ni facturado | `ORDR` / `RDR1` |
| C. Tránsito | Saldo entregado pendiente de facturar | `ODLN` / `DLN1` |
| D. Facturación neta | Facturas menos notas crédito del período | `Planos_Symphony.dbo.Informe_ventas` (decisión 2) |
| Total comercial | A + B + C + D | No es ingreso contable |

Desglose por asesor, canal, subgrupo, tienda física / ecommerce, centro de costos y fecha de despacho.

## Decisiones tomadas

| # | Decisión | Fecha | Quién |
|---|---|---|---|
| 1 | El entregable es el **portal de Indicadores** (tabla en `Planos_Symphony` o vista, endpoint en la Reporting API, dashboard Next.js), no un `.pbix` como propone la guía. | 2026-11-10 | Desarrollador |
| 2 | D se toma de `Informe_ventas` (ya cargada cada 15 min y usada por el portal), no de `OINV`/`ORIN` directo. | 2026-11-10 | Desarrollador |
| 3 | ~~No hay queries fuente: se construyen desde cero.~~ **Revisada el 2026-11-11:** la solicitante confirma que existen los queries “Visor OV” y “Tránsito” (los mantiene Logística), “Ofertas de venta” y “Facturación detallada”. Se piden y se toman como referencia de reglas y campos; lo ya descubierto sirve para validarlos. | 2026-11-11 | Solicitante |
| 4 | **Patrón estándar del portal:** los objetos SQL viven en `Planos_Symphony` (tabla de reporte + SP que la llena, sin tocar SAP); el script T-SQL se versiona en este repositorio (`sql/consolidado-comercial/`); el portal consulta mediante un endpoint de `reporting-api`. A–C no son incrementales: el SP borra y recarga las líneas abiertas en cada corrida. D sigue en `Informe_ventas`. TI crea los objetos, programa el job y da permisos de lectura a la API. | 2026-11-11 | Desarrollador |
| 5 | Solo **Firplak**; Viventta queda fuera (D filtra `Empresa = 'Firplak'`). | 2026-11-11 | Solicitante |
| 6 | Valores **sin IVA**. | 2026-11-11 | Solicitante |
| 7 | Corte = **estado al momento de la consulta**; no se guardan fotos diarias. | 2026-11-11 | Solicitante |
| 8 | Actualización cada 30 min, de 6:00 a 20:00, todos los días (job `BI - Consolidado comercial carga completa`). | 2026-11-17 | Solicitante / desarrollador (TI) |
| 9 | A = **todas las ofertas abiertas del Canal B2C**, sin filtro de vigencia. Las canceladas (`U_Estado_Oferta_Venta = 3`) quedan como opción de filtro. Magnitud: `pendiente` [`04-ofertas-b2c.sql`](../../proyectos/consolidado-comercial/sql/04-ofertas-b2c.sql). | 2026-11-11 | Solicitante |
| 10 | B (Visor OV) solo filtra **Tipo OV**. Status entrega y Fecha ProyFAC filtran **C** (Tránsito). | 2026-11-11 | Solicitante |
| 11 | Se excluye Tipo de ventas **Donaciones**. | 2026-11-11 | Solicitante |
| 12 | **MAC (106-04) no se incluye.** Tienda física / Ecommerce se clasifica por **subgrupo**; el centro de costos queda como filtro aparte. | 2026-11-11 | Solicitante |
| 13 | Fecha de despacho = la del Visor OV; Fecha ProyFAC = la del query de Tránsito (campos `pendiente` hasta recibir los queries). | 2026-11-11 | Solicitante |
| 14 | Asesor = **vendedor del documento** (el “Vendedor Senior” de facturación detallada; “Vendedor” en Visor OV, Tránsito y Ofertas). Sin restricción por cartera. | 2026-11-11 | Solicitante |
| 15 | Asesor y centro de costos son filtros **sin valor por defecto**. | 2026-11-11 | Solicitante |
| 16 | **Nada se cierra en SAP:** el tablero solo visualiza. Las OV abiertas cuentan tal como están, incluidas las 3 con facturación directa (riesgo de hasta 25,7 M asumido). | 2026-11-11 | Solicitante |
| 17 | **C se lee de SAP** (`ODLN`/`DLN1`) en la misma carga que A y B, no de `Informe_entregas`: esa tabla deja abiertas durante el día entregas ya facturadas (doble conteo C–D) y no aplica las reglas de asesor y centro de costos (`11`). | 2026-11-13 | Desarrollador |

## Inventario de insumos (sección 14 de la guía)

| Insumo | Estado |
|---|---|
| SQL de ofertas abiertas | Existe “Ofertas de venta” (decisión 3). `pendiente`: pedir el SQL |
| SQL / Excel del Visor OV de logística | Existen “Visor OV” y “Tránsito”, los mantiene Logística. `pendiente`: pedir el SQL |
| SQL de facturación y NC detallada | Reemplazado por `Informe_ventas` (decisión 2); existe “Facturación detallada”, útil para conciliar |
| Catálogo de Status entrega / Tipo OV | `pendiente`: consultas 1 y 2 del script |
| Reglas de canal B2C y subgrupos | `pendiente`: consulta 10 y cuestionario |
| Ejemplo conciliado de un mes y asesor | `pendiente`: la solicitante no entendió la pregunta; se reformula |
| Fecha de corte y latencia | Estado actual; 15–30 min según TI (decisiones 7 y 8) |
| Permisos de lectura en `ITPLAKINFO` | El usuario `FIRPLAK\milton.rendon` no tiene acceso (prueba del 2026-11-10); los scripts los ejecuta el desarrollador |

## Matriz de reglas de negocio (borrador)

Reglas propuestas con la semántica estándar de SAP B1; todas `pendiente` hasta ver los resultados del script.

| Regla | Propuesta | Riesgo que cubre | Se valida con |
|---|---|---|---|
| Granularidad | Una fila por línea (`DocEntry` + `LineNum` + tipo de objeto). Nunca unir por `DocNum`. | Doble conteo, colisión de numeración entre series | — |
| Saldo abierto | **`LineTotal * OpenQty / Quantity`** (método de la guía). `OpenSum` se descarta: en líneas parciales SAP lo deja igual a `LineTotal` (consultas 1 y 2 de `03-diagnostico-saldo.sql`). | Conversiones y entregas parciales | Consulta 3, diagnóstico 1 y 2 |
| A. Ofertas | `OQUT.CANCELED = 'N'`, `QUT1.LineStatus = 'O'`. Al copiar a OV, SAP baja `OpenQty` y cierra la línea, así que el saldo no se repite en B. **Decisión 9:** todas las ofertas abiertas de B2C, sin filtro de vigencia; canceladas como opción de filtro. En todos los canales el 96 % del saldo abierto está vencido (consulta 8); en B2C `pendiente` (`04`). | Doble conteo A–B, ofertas abandonadas | Consultas 3, 5, 8 |
| B. OV | `ORDR.CANCELED = 'N'`, `RDR1.LineStatus = 'O'`. `OpenQty` baja con entregas y con facturas directas. | Doble conteo B–C y B–D | Consultas 3, 5 |
| C. Tránsito | `ODLN.CANCELED = 'N'`, `DLN1.LineStatus = 'O'`. `OpenQty` baja con factura y devolución. Excluir entregas con base factura de reserva (`BaseType = 13`), ya facturadas; hoy no hay ninguna (consulta 6), queda como validación. | Doble conteo C–D | Consultas 6, 7 |
| D. Facturación | `Informe_ventas`: facturas en positivo y **NC ya negativas en `ValorTotal`** (consulta 13). Neta = `SUM(ValorTotal)`; no restar las NC otra vez. Fecha: `FechaContabilizacion` del período. | Signos (la guía supone NC positivas) | Consulta 13 |
| Filtros del Visor OV | Status entrega aplica a **C** (solo se llena en `ODLN`, consultas 5 y 5c); los `NULL` (25 % del tránsito) se tratan de forma explícita, nunca con `NOT IN` a secas. `Estado Item = O`; `Status entrega` (`U_StatusEntrega`, texto; convertir validando que solo tenga dígitos, porque `Firplak_SA` no acepta `TRY_CONVERT`, y registrar los no convertibles) excluye 3, 4, 9; `Tipo OV` (`U_TipoPedidos`, confirmado) excluye 4, 6, 7, 9, 12, 15; `Fecha ProyFAC` en el mes o en blanco (`NULL` o `''`). **Decisión 10:** B solo filtra Tipo OV; C filtra Status entrega y Fecha ProyFAC (Tipo OV en C `pendiente`). Fecha ProyFAC y los tratamientos de `NULL` salen del query de Tránsito (`pendiente`). | Filtros sobre el campo equivocado | Consultas 1, 2 |
| Descuento de encabezado y fletes | Hoy ningún documento abierto los tiene (consulta 4). Se usa el valor de línea y se deja una validación que avise si aparecen. | Valor inflado | Consulta 4 |
| Moneda e IVA | Valores en COP **sin IVA** en todas las etapas (`OpenSum` en A–C; `ValorTotal` = `LineTotal` en D, verificado línea a línea en la consulta 9 de `02`). Sin IVA aprobado (decisión 6). 138 de 215 ofertas abiertas están en USD: tasa del documento o del día `pendiente` (puede no aplicar si las ofertas B2C son en COP, `04`). | Diferencias por tasa de cambio; mezclar con y sin IVA | Consulta 4, `02` consulta 9, diagnóstico 1 |
| Asesor | `SlpCode` del encabezado (coincide con la línea en el 95–100 %, consulta 9). En D, `Informe_ventas` no tiene `SlpCode` (solo nombres): obtenerlo uniendo con `OINV`/`ORIN` por `DocEntry` + `LineNum`. **Decisión 14:** vendedor del documento, sin seguridad por cartera. | Asignación inconsistente entre A–C y D | Consultas 9, 12 |
| Canal / subgrupo | Canal = grupo de cliente `OCRD.GroupCode` → `OCRG.GroupName` (confirmado, consulta 10; B2C = 113). Subgrupo: `OCRD.U_SubGroupCode` → `@FIR_SUBGRUPOCLIENTE`; B2C = subgrupos 106-xx (cuadre exacto, consulta 7 de `02`); Firplak Home = `106-01`, e-commerce = `106-02`, MAC = `106-04`. **Decisión 12:** Tienda física / Ecommerce por subgrupo; MAC fuera. | Filtrar D con otro campo | Consultas 10, 13 |
| Centro de costos | `OcrCode` de la línea → `OOCR.OcrName` (consulta 11). El 12,7 % de las líneas de OV abiertas no lo tiene: respaldo con `OCRD.U_CentrodeCtos` del cliente, que cubre el 100 % (consulta 6b); `U_CentroCostos` de la línea se descarta. Firplak Home = `GV-FHMED`, `GV-FHBOG`, `GV-FHCAL`. | Líneas sin centro de costos fuera de los filtros | Consulta 11, `02` consulta 6 |
| Fecha de corte | Estado al momento de la consulta (decisión 7); no hay histórico de A, B y C. | Reconstrucción histórica imposible | Cuestionario |

## Resultados del descubrimiento

### Consulta 1: campos de usuario (ejecutada por el desarrollador el 2026-11-10)

1.360 UDF: 224 en cada encabezado (`OQUT`, `ORDR`, `ODLN`, `OINV`), 102 en cada línea (`QUT1`, `RDR1`, `DLN1`, `INV1`), 55 en `OCRD` y ninguno en `OSLP`. Oferta, OV, entrega y factura comparten los mismos UDF, porque SAP los copia de un documento al siguiente.

| Concepto de la guía | Campo candidato | Tipo | Estado |
|---|---|---|---|
| Status entrega | `U_StatusEntrega` (encabezado) | Alfanumérico 25, 11 valores válidos | Coincide con la guía (texto, se convierte con `TRY_CONVERT`). Códigos en la consulta 2 |
| Tipo OV | `U_TipoPedidos` (encabezado), tabla `@FIR_TIPOPEDIDOS` | Alfanumérico 30 | Candidato; códigos en [`02-tablas-usuario.sql`](../../proyectos/consolidado-comercial/sql/02-tablas-usuario.sql) |
| Fecha ProyFAC | Ningún UDF se llama así. Candidatos: `U_HBT_PerFacturacion` (periodo de facturación inicial), `U_FechaIniPlanDespOV`, `U_FechaaSodimac` (FechaFinPlanDespOV), `U_Fecha_Plan_Ent_Cliente` | Fecha | `pendiente`: preguntar a Logística/solicitante; uso en `02-tablas-usuario.sql` |
| Fecha despacho | `U_FechaDespacho` (encabezado), `U_FRequeridaDesp` (Fecha real de despacho), `U_FechaIniPlanDesp` (línea) | Fecha | `pendiente` |
| Tienda | `U_Tiendas` y `U_DescTiendas` (línea) | Alfanumérico | Candidato |
| Centro de costos | `U_CentroCostos` (línea, UDF), `OcrCode` (estándar) o `OCRD.U_CentrodeCtos` (cliente) | Alfanumérico | `pendiente`: consulta 11 y uso en `02-tablas-usuario.sql` |
| Subgrupo (Firplak Home, Ecommerce) | `OCRD.U_SubGroupCode`, tabla `@FIR_SUBGRUPOCLIENTE` | Alfanumérico 30 | Candidato fuerte |
| Canal (Grupo B2C) | Grupo de cliente `OCRD.GroupCode` → `OCRG` (consulta 10) | Estándar | Candidato |
| Otros posibles | `U_Segmentacion` (`@FIR_SEGMENTACION`), `U_TipoVentas` (`@FIR_TIPOVENTAS`), `OCRD.U_tipo_cliente`, `OCRD.U_estrategia_cliente` | — | Para revisar |
| Asesor junior | `OCRD.U_VendedorJunior` y `U_VendedorJuniorFact` del documento | — | Para revisar |

### Consulta 2: valores válidos de los UDF (ejecutada por el desarrollador el 2026-11-10)

1.490 valores; la mayoría son de la localización (`U_HBT_*`: medios de pago, responsabilidad fiscal). Los relevantes:

**`U_StatusEntrega`** (igual en oferta, OV y entrega). La guía excluye 3, 4 y 9: novedad, redireccionada y rechazada.

| Código | Significado | Guía |
|---|---|---|
| 1 | En Embarque | Incluye |
| 2 | En Tránsito | Incluye |
| 3 | En Novedad | **Excluye** |
| 4 | Redireccionada | **Excluye** |
| 5 | Cita Programada | Incluye |
| 6 | Cliente Recoge | Incluye |
| 7 | Entregada | Incluye |
| 8 | Entregada con Novedad | Incluye |
| 9 | Rechazada | **Excluye** |
| 10 | Novedad en Sln | Incluye (`pendiente` confirmar: también es novedad) |
| 11 | Pago Pendiente | Incluye |

**Otros campos con impacto en las reglas:**

| Campo | Valores | Impacto |
|---|---|---|
| `U_Estado_Oferta_Venta` | 1 Confirmada, 2 Pendiente, 3 Cancelada | **A:** una oferta puede estar abierta en SAP (`DocStatus = 'O'`) pero cancelada en este campo. `pendiente`: ¿excluir la 3? |
| `ORDR.U_Bloqueado` | Bloqueado, No Bloqueado, Bloqueo Comercial, Bloqueado Logistica, Bloqueado para Despacho | B: ¿una OV bloqueada cuenta como pendiente? `pendiente` |
| `RDR1.U_Bloqueado` (SI/NO), `RDR1.U_BloqueoLogistica` (1 SI, 2 NO), `RDR1.U_Comentarios` (NO DESPACHAR, NC NO DESPACHAR) | — | B: líneas que no se van a despachar. `pendiente` |
| `U_Despachado` | Si, No | C: posible marca de tránsito. `pendiente` |
| `U_TipoFacturacion` | Sin POD, POD Parcial, POD Total | C: la factura puede depender de la prueba de entrega (POD). `pendiente` |
| `OCRD.U_tipo_cliente` | 1 A, 2 B, 3 C, 4 C+, 5 D | Clasificación de cliente; no parece canal |

`U_TipoPedidos` (Tipo OV) no tiene valores aquí porque usa la tabla `@FIR_TIPOPEDIDOS` (consulta 1 de [`02-tablas-usuario.sql`](../../proyectos/consolidado-comercial/sql/02-tablas-usuario.sql)).

### Consulta 3: saldo abierto por etapa (ejecutada por el desarrollador el 2026-11-10)

Estado actual, sin filtros de negocio (no son cifras del indicador):

| Etapa | Líneas | Documentos | `OpenSum` | Proporcional | Diferencia | Líneas parciales | Más antigua |
|---|---|---|---|---|---|---|---|
| A. Ofertas | 1.315 | 215 | 4.598.372.218 | 3.796.306.329 | **802.065.889 (21 %)** | 475 (36 %) | 2016-03-03 |
| B. OV | 1.652 | 352 | 2.944.643.584 | 2.923.943.974 | 20.699.610 (0,7 %) | 16 | 2025-06-03 |
| C. Entregas | 702 | 279 | 451.227.559 | 447.492.155 | 3.735.404 (0,8 %) | 6 | 2026-06-26 |

Lectura:

- **Ofertas:** `OpenSum` supera al cálculo proporcional en 802 M y una de cada tres líneas abiertas está parcialmente convertida. Hay ofertas abiertas desde 2016, así que la vigencia (consulta 8) y `U_Estado_Oferta_Venta` pesarán mucho en A. No se elige método de saldo hasta ver [`03-diagnostico-saldo.sql`](../../proyectos/consolidado-comercial/sql/03-diagnostico-saldo.sql).
- **OV y entregas:** los dos métodos casi coinciden; la diferencia está en pocas líneas (`pendiente`: consultas 1 y 2 del diagnóstico).
- **Entregas:** la más antigua es de junio de 2026, así que el tránsito se factura en pocos meses.

### Consulta 4: moneda, descuento de encabezado y fletes (ejecutada por el desarrollador el 2026-11-10)

| Etapa | COP (`$`) | USD | Con descuento de encabezado | Con fletes / gastos |
|---|---|---|---|---|
| A. Ofertas | 77 | **138 (64 %)** | 0 | 0 |
| B. OV | 343 | 9 | 0 | 0 |
| C. Entregas | 277 | 2 | 0 | 0 |

Lectura:

- **No hay descuento de encabezado ni fletes** en documentos abiertos: el valor de línea basta. La regla se deja como control (si aparecen, se registran en una consulta de validación).
- **Casi dos de cada tres ofertas abiertas están en dólares**, contra 9 OV y 2 entregas. Se sospechó que explicaban la diferencia de 802 M de la consulta 3; **descartado** en la consulta 1 de `03-diagnostico-saldo.sql`: la diferencia está en las líneas parciales, no en la moneda.
- Las ofertas en USD son probablemente de exportación; si el canal de la guía es B2C nacional, quizá queden fuera por el filtro de canal. `pendiente`.

### Consulta 5: origen de las OV abiertas (ejecutada por el desarrollador el 2026-11-10)

| Origen (`BaseType`) | Líneas | Saldo abierto |
|---|---|---|
| -1 Directa (sin oferta) | 829 | 1.301.080.024,53 |
| 23 Desde oferta | 823 | 1.643.563.559,66 |
| **Total** | **1.652** | **2.944.643.584,19** (cuadra con la consulta 3) |

Lectura:

- La mitad de las líneas de OV viene de una oferta (56 % del saldo). Cuando la OV se copia desde la oferta, SAP baja `OpenQty` de la oferta y no hay doble conteo A–B; lo confirma la consulta 3 de `03-diagnostico-saldo.sql`.
- **Riesgo:** la otra mitad son OV directas. Si un asesor creó la OV a mano sin copiarla de la oferta, la oferta queda abierta y la venta se cuenta en A y en B. `pendiente`: consulta 4 de `03-diagnostico-saldo.sql` (mismo cliente y artículo con oferta abierta y OV directa abierta).

### Consulta 6: origen de las entregas abiertas (ejecutada por el desarrollador el 2026-11-10)

| Origen (`BaseType`) | Líneas | Saldo abierto |
|---|---|---|
| -1 Directa (sin OV) | 13 | 1.408.561,71 |
| 17 Desde OV | 689 | 449.818.997,52 |
| 13 Desde factura de reserva | 0 | 0 |
| **Total** | **702** | **451.227.559,23** (cuadra con la consulta 3) |

Lectura:

- **No hay entregas abiertas que vengan de factura de reserva**: hoy no existe doble conteo C–D por esa vía. Se deja una validación para detectarlo si aparece.
- El 99,7 % del tránsito viene de OV; las 13 líneas directas suman 1,4 M y no afectan el cuadre.

### Consulta 7: origen de las facturas de los últimos 12 meses (ejecutada por el desarrollador el 2026-11-10)

Solo `OINV` de `Firplak_SA`, sin restar notas crédito:

| Origen (`BaseType`) | Factura de reserva | Líneas | Valor | % |
|---|---|---|---|---|
| 15 Desde entrega | N | 71.086 | 65.187.807.292,22 | 93,4 % |
| -1 Directa | N | 3.903 | 4.251.865.521,76 | 6,1 % |
| 17 Desde OV (sin entrega) | N | 1.998 | 343.681.030,60 | 0,5 % |
| 23 Desde oferta | N | 5 | 514.949,38 | 0,0 % |
| **Total** | | **76.992** | **69.783.868.794** (≈ 5.815 M por mes) | |

Lectura:

- **No hubo facturas de reserva** (`isIns = 'Y'`) en 12 meses: se confirma lo de la consulta 6.
- El flujo normal es OV → entrega → factura (93 %). Las facturas desde OV o desde oferta cierran el saldo de origen en SAP, así que no duplican.
- **Riesgo B–D:** el 6 % se factura directo. Si existía una OV para esa venta y no se copió, la OV queda abierta y la venta se cuenta en B y en D. `pendiente`: consulta 5 de `03-diagnostico-saldo.sql`.

### Consulta 8: ofertas abiertas por antigüedad y vigencia (ejecutada por el desarrollador el 2026-11-10)

Vigencia según `OQUT.DocDueDate` (válida hasta) contra la fecha de ejecución:

| Año de la oferta | Vigencia | Documentos | Saldo abierto (`OpenSum`) |
|---|---|---|---|
| 2016 | Vencida | 12 | 481.314.993,26 |
| 2017 | Vencida | 16 | 557.587.134,72 |
| 2018 | Vencida | 48 | 1.573.779.578,85 |
| 2019 | Vencida | 51 | 1.176.821.665,83 |
| 2020 | Vencida | 7 | 196.170.712,91 |
| 2024 | Vencida | 1 | 47.726.555,15 |
| 2025 | Vencida | 23 | 319.237.634,45 |
| 2026 | Vencida | 23 | 73.566.722,76 |
| 2026 | **Vigente** | **34** | **172.167.220,55** |
| **Total** | | **215** | **4.598.372.218,48** (cuadra con la consulta 3) |

Lectura:

- **Solo el 3,7 % del saldo de ofertas (172 M, 34 documentos) está vigente.** Las ofertas de 2016 a 2020 suman 3.986 M (87 %): son ofertas abandonadas que nadie cerró en SAP.
- Sin un filtro de vigencia o de antigüedad, A queda dominado por ofertas muertas y el total comercial se infla en casi 4.400 M.
- Propuesta: A = ofertas **vigentes** (`DocDueDate >= fecha de corte`), excluyendo `U_Estado_Oferta_Venta = 3` (cancelada). **Rechazada el 2026-11-11:** la solicitante pidió la totalidad del Canal B2C, sin filtro de vigencia (decisión 9).
- Recomendación operativa (fuera del alcance del tablero): que Comercial cierre en SAP las 192 ofertas vencidas.

### Consulta 9: asesor de encabezado vs. asesor de línea (ejecutada por el desarrollador el 2026-11-10)

| Etapa | Líneas | Líneas con asesor distinto al del encabezado | Asesores (encabezado) |
|---|---|---|---|
| A. Ofertas | 1.315 | 1 (0,1 %) | 23 |
| B. OV | 1.652 | 35 (2,1 %) | 23 |
| C. Entregas | 702 | 38 (5,4 %) | 20 |

Lectura:

- El asesor se toma del **encabezado** (`SlpCode` del documento): coincide con la línea en el 95–100 % de los casos y es lo que muestran las pantallas de SAP.
- Las 74 líneas con asesor distinto se dejan en una consulta de validación; si la solicitante quiere el asesor por línea, el cambio es una columna.
- **Riesgo de consistencia con D:** `Informe_ventas` trae `VendedorSenior` y `VendedorJunior`, no necesariamente el `SlpCode`. Para filtrar A–D por el mismo asesor hay que saber cómo se arma `VendedorSenior` en `SP_Generar_Informe_Ventas`. `pendiente`: consulta 12.

### Consulta 10: grupo de cliente de las OV abiertas (ejecutada por el desarrollador el 2026-11-10)

| `GroupCode` | Grupo (`OCRG.GroupName`) | OV abiertas | Saldo abierto | % |
|---|---|---|---|---|
| 104 | Canal Constructores | 88 | 1.839.909.453,89 | 62,5 % |
| 105 | Canal Distribución | 163 | 633.187.527,16 | 21,5 % |
| **113** | **Canal B2C** | **64** | **445.557.849,46** | **15,1 %** |
| 108 | Ventas Especiales | 3 | 15.801.428,05 | 0,5 % |
| 109 | Servicios | 33 | 10.187.324,63 | 0,3 % |
| 110 | Otros | 1 | 1,00 | 0,0 % |
| | **Total** | **352** | **2.944.643.584,19** (cuadra con la consulta 3) | |

Lectura:

- **Confirmado:** el “Canal” de la guía es el grupo de cliente de SAP (`OCRD.GroupCode` → `OCRG.GroupName`); “Grupo B2C” = `GroupCode = 113` “Canal B2C”.
- Con el default de la guía (solo B2C), B baja de 2.945 M a 446 M. El default cambia mucho la cifra: hay que mostrar siempre qué canal está filtrado.
- `Informe_ventas` tiene `GrupoCliente`; si sale del mismo `OCRG`, D se filtra con el mismo campo. `pendiente`: consulta 13.
- La OV de “Otros” vale 1 peso: posible documento de prueba. Se deja en validación.

### Consulta 11: centro de costos de las líneas de OV abiertas (ejecutada por el desarrollador el 2026-11-10)

`RDR1.OcrCode` (norma de reparto 1) → `OOCR.OcrName`. 25 valores; suman 1.652 líneas y 2.944,6 M (cuadra con la consulta 3). Agrupados por tipo:

| Grupo (lectura del nombre) | Centros de costos | Líneas | Saldo abierto |
|---|---|---|---|
| Obras (regionales) | `GV-CAOBR` Costa Atlántica, `GV-COBR1` Cundinamarca, `GV-SUOBR` Suroccidente, `GV-EJOBR` Eje Cafetero, `GV-AOBR1` Antioquia, `GV-TGOBR` Tolima Grande | 231 | 1.661,6 M |
| Distribución (regionales) | `GV-CDIS1` Cundinamarca, `GV-TGDIS` Tolima Grande, `GV-CADIS` Costa Atlántica, `GV-ADIS1` Antioquia, `GV-SUDIS` Suroccidente, `GV-EJDIS` Eje Cafetero, `GV-SDER1` Santanderes, `GV-CORSU` Córdoba, Sucre y Urabá | 844 | 489,0 M |
| **Firplak Home** | `GV-FHMED` Medellín (124 líneas, 92,3 M), `GV-FHBOG` Bogotá (46, 43,5 M), `GV-FHCAL` Cali (18, 18,0 M) | 188 | 153,8 M |
| Nacional y servicios | `GV-SOPTE` Soporte Nacional, `GV-OSER1` Otros Servicios, `GV-CEFI1` Gastos Ventas CEFI | 121 | 281,6 M |
| Exportación | `GV-JAMAI` Jamaica, `GV-RSURA` Resto Suramérica, `GV-PANAM` Panamá, `GV-RCENA` Resto Centroamérica | 58 | 38,0 M |
| **Sin centro de costos** | `NULL` | **210 (12,7 %)** | **320,5 M (10,9 %)** |

Lectura:

- **“Firplak Home” es un centro de costos, no (solo) un subgrupo:** tres tiendas físicas (Medellín, Bogotá, Cali). Es el candidato más fuerte para el segmentador “Tienda física”. No aparece un centro de costos de Ecommerce entre las OV abiertas. `pendiente`: comparar con `OCRD.U_SubGroupCode` (consulta 7 de `02-tablas-usuario.sql`) y con `RDR1.U_Tiendas`.
- El nombre del centro de costos combina región y línea de negocio (Obras, Distribución, Home, Exportación); sirve de desglose aunque no exista una tabla de jerarquía. La agrupación de arriba es una lectura de los nombres, `pendiente` de confirmar con la solicitante.
- **210 líneas (321 M) no tienen centro de costos en `OcrCode`.** Para que no caigan fuera de todo filtro hay que buscar respaldo en `RDR1.U_CentroCostos` o en `OCRD.U_CentrodeCtos` (cliente). `pendiente`: consulta 6 de `02-tablas-usuario.sql`.

### Consulta 12: columnas de `Informe_ventas` (ejecutada por el desarrollador el 2026-11-10)

46 columnas. Mapeo contra el contrato común de la guía (sección 8) y las dimensiones de A–C:

| Concepto del consolidado | Columna en `Informe_ventas` | En A–C (SAP) | Observación |
|---|---|---|---|
| Clave | `Empresa` + `TipoDocumento` + `DocEntry` + `LineNum` | Tipo de objeto + `DocEntry` + `LineNum` | `DocNum` también está, pero no es clave |
| Fecha | `FechaContabilizacion` (date) | `DocDate` | — |
| Valor | `ValorTotal` (decimal) | `OpenSum` | No hay columna de moneda ni de IVA: `pendiente` confirmar que es COP sin IVA (`LineTotal`) |
| Asesor | `VendedorSenior`, `VendedorJunior` (**nvarchar, nombres**) | `SlpCode` (código) | **No hay `SlpCode`.** Ver abajo |
| Canal | `GrupoCliente` | `OCRG.GroupName` | `pendiente`: consulta 13 |
| Subgrupo | `SubgrupoCliente` | `OCRD.U_SubGroupCode` | — |
| Centro de costos | `CentroCostos` | `OcrCode` → `OOCR` | `pendiente`: ¿código o nombre? |
| Tienda | `CodigoPuntoVenta`, `DescripcionPuntoVenta` | `U_Tiendas`, `U_DescTiendas` | Parece el mismo concepto |
| Segmento, estrategia, tipo de cliente | `SegmentoCliente`, `EstrategiaCliente`, `TipoCliente` | UDF equivalentes | Filtros opcionales |
| Cliente, artículo | `CodCliente`, `NombreCliente`, `CodigoArticulo`, `DescripcionArticulo`, `GrupoArticulo`, `Familia` | `CardCode`, `ItemCode` | — |
| Frescura | `FechaCarga` (datetime2) | Hora de consulta | Sirve para mostrar “actualizado a las…” |
| Fecha despacho, Fecha ProyFAC, Status entrega, Tipo OV | No existen | UDF | Solo aplican a B y C |

Además trae costo y margen (`Costo`, `CostoTotal`, `UtilidadBruta`, `MargenBruta`, `Costo_MO`, `Costo_CIF`), que el consolidado no necesita.

**Asesor en D:** filtrar por nombre (`VendedorSenior` contra `OSLP.SlpName`) es frágil por tildes, cambios de nombre y homónimos. Propuesta: obtener el `SlpCode` de D uniendo `Informe_ventas` con `OINV`/`ORIN` por `DocEntry` + `LineNum` según `TipoDocumento` (solo `Empresa = 'Firplak'`; Viventta necesitaría lo mismo contra `DBViventta`). `pendiente`: confirmar con `SP_Generar_Informe_Ventas` de qué campo sale `VendedorSenior`.

### Consulta 13: `Informe_ventas` del mes en curso (ejecutada por el desarrollador el 2026-11-10)

Noviembre de 2026, del 1 al 10:

| Empresa | Tipo de documento | Tipo de ventas | Líneas | Valor |
|---|---|---|---|---|
| Firplak | Factura | Exterior | 63 | 167.080.193,59 |
| Firplak | Factura | Nacional | 656 | 498.758.772,22 |
| Firplak | Nota Crédito | Exterior | 63 | −170.009.476,06 |
| Firplak | Nota Crédito | Nacional | 64 | −37.079.066,18 |
| | | **Facturación neta** | | **458.750.423,57** |

Lectura:

- **Las notas crédito ya vienen negativas en `ValorTotal`.** La facturación neta es `SUM(ValorTotal)`; la bruta, la suma de las facturas, y las NC, el valor absoluto. Difiere del supuesto de la guía (NC en positivo y restadas en DAX): si se aplicara literal, las NC se sumarían.
- **Exportación neta negativa (−2,9 M):** 63 líneas de NC por 170,0 M contra 63 líneas de factura por 167,1 M. Parece una anulación y refacturación de un mismo pedido de exportación (mismo número de líneas). `pendiente`: confirmar con la solicitante o con Cartera; si es así, la neta del mes es correcta, pero la bruta y las NC quedan infladas.
- **Este mes no hay filas de Viventta.** La decisión de compañías sigue `pendiente`.
- `TipoVentas` es Nacional/Exterior, no el canal. El canal debe salir de `GrupoCliente`; se valida en la consulta 8 de `02-tablas-usuario.sql`.
- Con IVA o sin IVA: se valida en la consulta 9 de `02-tablas-usuario.sql`, comparando `ValorTotal` contra `INV1.LineTotal`.

### Consulta 14: Viventta (ejecutada por el desarrollador el 2026-11-10)

`DBViventta` existe en el servidor. Solo tiene **OV abiertas: 15 líneas por 2.559.829** (0,09 % del saldo de OV de Firplak). Sin ofertas ni entregas abiertas, y sin facturas en noviembre (consulta 13).

Lectura: incluir o excluir Viventta no mueve A, B ni C hoy. Si la solicitante la incluye, el objeto de reporte necesita un `UNION` contra `DBViventta` con la columna `Empresa`, igual que `Informe_ventas`.

### Resumen del primer script

| Tema | Resultado |
|---|---|
| Doble conteo por factura de reserva | No hay (consultas 6 y 7) |
| Descuento de encabezado y fletes | No hay (consulta 4) |
| Signo de NC en D | Ya negativas en `Informe_ventas` (consulta 13) |
| Canal | Grupo de cliente `OCRG`; B2C = 113 (consulta 10) |
| Firplak Home | Centros de costos `GV-FHMED`, `GV-FHBOG`, `GV-FHCAL` (consulta 11) |
| Asesor | `SlpCode` del encabezado (consulta 9); en D hay que recuperarlo desde SAP (consulta 12) |
| **Ofertas** | **96 % del saldo abierto está vencido** (consulta 8); 64 % de los documentos en USD (consulta 4) |
| Riesgos abiertos | Doble conteo A–B y B–D por documentos directos (`03-diagnostico-saldo.sql`, consultas 4 y 5); 11 % del saldo de OV sin centro de costos (consulta 11) |

### `02-tablas-usuario.sql`, consulta 1: Tipo OV (`@FIR_TIPOPEDIDOS`) (ejecutada por el desarrollador el 2026-11-10)

Confirma que **Tipo OV = `U_TipoPedidos`**: los códigos que excluye la guía son movimientos que no son venta.

| Código | Tipo de pedido | Guía | Lectura |
|---|---|---|---|
| 1 | Normal | Incluye | Venta |
| 2 | Llenado Stock | Incluye | ¿Venta? Parece abastecimiento (`pendiente`) |
| 3 | Exportacion | Incluye | Venta |
| 4 | Muestras y exhibiciones | **Excluye** | No es venta |
| 5 | Servicios | Incluye | Venta |
| 6 | Reposicion Producto | **Excluye** | Garantía / reposición |
| 7 | Atención | **Excluye** | Servicio posventa |
| 8 | Muestra Facturable | Incluye | Venta |
| 9 | FulFillment | **Excluye** | ¿Logística de terceros o marketplace? (`pendiente`) |
| 10 | Llenado Eventos | Incluye | ¿Venta? Parece abastecimiento (`pendiente`) |
| 11 | Llenado Ferias | Incluye | ¿Venta? Parece abastecimiento (`pendiente`) |
| 12 | Reposicion Repuesto | **Excluye** | Garantía / reposición |
| 13 | **Firplak.com** | Incluye | **Candidato a Ecommerce** |
| 14 | Cliente Final | Incluye | Candidato a venta en tienda física |
| 15 | Rebastecimiento Firplak Home | **Excluye** | Traslado interno a tiendas |

Lectura:

- “Ecommerce” puede identificarse por **Tipo OV 13 (Firplak.com)**, lo que explica por qué no hay un centro de costos de ecommerce (consulta 11). `pendiente`: cruzar con el subgrupo de cliente (consulta 7).
- La exclusión de la guía (4, 6, 7, 9, 12, 15) se aplica a B y C. `pendiente`: ¿también a A? Las ofertas tienen el mismo campo.
- Los tipos 2, 10 y 11 (“Llenado …”) parecen movimientos de abastecimiento, como el 15, pero la guía los incluye. `pendiente`: confirmar.

### `02-tablas-usuario.sql`, consulta 2: subgrupo de cliente (`@FIR_SUBGRUPOCLIENTE`) (ejecutada por el desarrollador el 2026-11-10)

30 subgrupos. El prefijo del código parece ser el grupo de cliente (`OCRG.GroupCode`):

| Prefijo | Grupo (consulta 10) | Subgrupos |
|---|---|---|
| 104 | Canal Constructores | 01 Obras Residenciales, 02 Reformas Vivienda Nueva, 03 Obras de Infraestructura (Inhabilitado) |
| 105 | Canal Distribución | 01 Autoservicio, 02 Detallistas Nacional, 03 Detallistas Regional, 04 Mayoristas, 05 Marketplace Comisionista, 06 Marketplace Puro |
| **106** | **No aparece en la consulta 10** | **01 Firplak Home, 02 e-commerce**, 03 Ventas Mercado Libre (Inhabilitado), 04 MAC |
| 107 | No aparece | 01 Ventas Ferias (Inhabilitado), 02 otros (Inhabilitado) |
| 108 | Ventas Especiales | 01 Ventas a Empleados, 02 Ventas Convenios, 03 Liquidaciones y Exhibiciones |
| 109 | Servicios | 01 Ventas de Servicios |
| 110 | Otros | 01 Otros Nacional |
| 111 | No aparece | 01 Detallista del Exterior, 02 Mayorista Obras Exterior, 03 Mayorista Exterior, 04 Autoservicio Exterior, 05 e-commerce internacional, 06 Marketplace Exterior, 07 Obras Estrato Alto, 08 Obras Estrato Medio, 09 Reforma Vivienda, 10 Reforma Estrato Medio-Bajo |
| — | **113 Canal B2C** | Ningún subgrupo empieza por 113 |

Lectura:

- **El filtro de la guía “Subgrupo = Firplak Home y Ecommerce” corresponde a `106-01` y `106-02`.** Lo más probable es que 106 sea el código anterior del canal B2C (hoy 113) y que el prefijo del subgrupo no se actualizara. `pendiente`: confirmar con la consulta 7 que los clientes del grupo 113 tienen subgrupo 106-xx.
- Hay tres formas de marcar tienda física y ecommerce: subgrupo (106-01 / 106-02), centro de costos (`GV-FH*`, consulta 11) y Tipo OV (13 Firplak.com). `pendiente`: la consulta 7 dirá si coinciden; si no, la solicitante elige una.
- El prefijo 111 mezcla exportación (01–06) con obras y reformas por estrato (07–10), que parecen nacionales. `pendiente`.
- Hay subgrupos de marketplace en Distribución (105-05, 105-06) y en exterior (111-06). `pendiente`: ¿cuentan como ecommerce?

### `02-tablas-usuario.sql`, consulta 3: segmento del pedido y tipo de ventas (ejecutada por el desarrollador el 2026-11-10)

**Segmento del pedido (`U_Segmentacion` → `@FIR_SEGMENTACION`):** 0001 Obras Estrato Alto, 0002 Obras Vis/Vip, 0003 Institucional, 0004 Reforma de Vivienda, 0005 Inversionista Inmobiliario, 0006 Hoteleria, 0007 Marketplace, 0008 Obras Estrato Medio, 0009 Reforma Vis/Vip, 0010 N/A.

**Tipo de ventas (`U_TipoVentas` → `@FIR_TIPOVENTAS`):** Donaciones, Excluido, Exterior, Nacional, Zona Franca.

Lectura:

- El segmento describe el tipo de proyecto (sobre todo de Constructores). La guía no lo pide; puede ser un filtro opcional. No sirve para tienda física / ecommerce, salvo 0007 Marketplace.
- **Tipo de ventas filtra igual en A–C y en D:** el campo está en el encabezado de oferta, OV y entrega, y `Informe_ventas` tiene la columna `TipoVentas` con los mismos valores.
- **Donaciones y Excluido no parecen venta comercial.** La guía no los menciona. `pendiente`: ¿se excluyen del consolidado? En noviembre, `Informe_ventas` solo tiene Nacional y Exterior (consulta 13).

### `02-tablas-usuario.sql`, consulta 4: estrategia de cliente (`@FIR_ESTRATEG_CLIENT`) (ejecutada por el desarrollador el 2026-11-10)

Un solo valor: `01` “Prueba”. El campo no está en uso y **se descarta** como dimensión del consolidado (aunque `Informe_ventas` tenga la columna `EstrategiaCliente`).

### `02-tablas-usuario.sql`, consulta 5: error `TRY_CONVERT` (2026-11-10)

Primera ejecución: `Mens. 195: 'TRY_CONVERT' no es un nombre de función integrada reconocido`. `TRY_CONVERT` exige nivel de compatibilidad 110 o superior.

**Consulta 5b (ejecutada por el desarrollador el 2026-11-10):**

| Base | Nivel de compatibilidad | Versión del servidor |
|---|---|---|
| `Firplak_SA` | **100** (SQL Server 2008) | 13.0.5108.50 (SQL Server 2016 SP2) |
| `Planos_Symphony` | **100** (SQL Server 2008) | Igual |
| `DBViventta` | 130 (SQL Server 2016) | Igual |

**Restricción para todo el SQL del proyecto:** el servidor es 2016, pero `Firplak_SA` y `Planos_Symphony` se comportan como SQL Server 2008. Confirmado que falla `TRY_CONVERT`; también quedan fuera las funciones que exigen nivel 130, como `STRING_SPLIT`. Confirmado que `DATEFROMPARTS` funciona (consulta 13 del primer script). Cualquier otra función posterior a 2008 se prueba antes de usarla en un objeto definitivo. No se cambia el nivel de compatibilidad de ninguna base: es una decisión de TI y puede afectar a SAP y a los demás procesos.

La regla de la guía “tipificar Status entrega con `TRY_CONVERT(int, campo)`” se implementa así: se valida que el texto solo tenga dígitos (`NOT LIKE '%[^0-9]%'`, longitud de 1 a 9) y luego se aplica `CAST`. Los valores no convertibles se registran, no se descartan. Aplica también si el objeto de reporte vive en `Planos_Symphony`.

### `02-tablas-usuario.sql`, consulta 5: OV abiertas por Tipo OV y Status entrega (ejecutada por el desarrollador el 2026-11-10, versión sin `TRY_CONVERT`)

**`U_StatusEntrega` es `NULL` en el 100 % de las OV abiertas.** El filtro de la guía “Status entrega excluye 3, 4, 9” no puede aplicarse a B. Lo más probable es que Logística lo llene en la entrega, así que aplicaría a C. `pendiente`: consulta 5c.

| Tipo OV | OV | Líneas | Saldo abierto | Guía |
|---|---|---|---|---|
| 1 Normal | 203 | 1.112 | 2.211.790.875,59 | Incluye |
| 13 Firplak.com | 15 | 52 | 270.883.599,48 | Incluye |
| 14 Cliente Final | 64 | 196 | 195.562.795,67 | Incluye |
| 10 Llenado Eventos | 6 | 36 | 119.318.838,05 | Incluye (`pendiente`) |
| 8 Muestra Facturable | 9 | 69 | 60.210.892,37 | Incluye |
| 3 Exportacion | 9 | 31 | 28.418.802,90 | Incluye |
| 5 Servicios | 22 | 30 | 7.233.122,63 | Incluye |
| 9 FulFillment | 4 | 11 | 22.974.920,00 | Excluye |
| 15 Rebastecimiento Firplak Home | 8 | 59 | 17.884.513,71 | Excluye |
| 6 Reposicion Producto | 3 | 3 | 4.382.186,00 | Excluye |
| 4 Muestras y exhibiciones | 7 | 33 | 3.208.278,87 | Excluye |
| 7 Atención | 3 | 15 | 2.145.638,67 | Excluye |
| 12 Reposicion Repuesto | 5 | 5 | 629.120,25 | Excluye |
| **Total** | | **1.652** | **2.944.643.584** (cuadra con la consulta 3) | |

Lectura:

- **El filtro de Tipo OV de la guía saca 126 líneas y 51,2 M (1,7 %)** del saldo de OV. Quedan 2.893,4 M.
- Los tipos 2 (Llenado Stock) y 11 (Llenado Ferias) no tienen OV abiertas. El 10 (Llenado Eventos) suma 119 M: es lo que está en juego con la pregunta de los “Llenado”.
- **13 Firplak.com + 14 Cliente Final = 466,4 M**, cerca de los 445,6 M del grupo Canal B2C (consulta 10). Indica que B2C es sobre todo ecommerce más venta a cliente final. `pendiente`: cruce en la consulta 7.
- La columna OV suma 358 contra 352 documentos de la consulta 3, aunque líneas y saldo cuadran exacto. Cada OV tiene un solo Tipo OV, así que debería sumar 352. Lo más probable es un error de lectura de la captura (en la 5c los documentos sí cuadran: 279). `pendiente`: confirmar con el desarrollador.

### `02-tablas-usuario.sql`, consulta 5c: entregas abiertas por Status entrega (ejecutada por el desarrollador el 2026-11-10)

Confirma que **`U_StatusEntrega` se diligencia en la entrega (`ODLN`)**: el filtro de la guía aplica a C, no a B. Totales: 279 entregas, 702 líneas, 451.227.559 (cuadra con la consulta 3).

| Status entrega | Entregas | Líneas | Saldo abierto | Guía |
|---|---|---|---|---|
| `NULL` (sin status) | 16 | 52 | 114.311.310,88 (25 %) | **`pendiente`** |
| 1 En Embarque | 35 | 157 | 67.140.005,83 | Incluye |
| 2 En Tránsito | 138 | 338 | 229.228.638,80 | Incluye |
| 3 En Novedad | 3 | 3 | 2.405.610,90 | **Excluye** |
| 6 Cliente Recoge | 4 | 5 | 974.250,85 | Incluye |
| 7 Entregada | 73 | 119 | 26.468.047,74 | Incluye |
| 8 Entregada con Novedad | 4 | 6 | 6.075.649,23 | Incluye |
| 9 Rechazada | 6 | 22 | 4.624.045,00 | **Excluye** |

Por tipo de facturación: POD Total 275,1 M, Sin POD 159,4 M, POD Parcial 15,4 M, `NULL` 1,3 M. `U_Despachado` es “No” en todas las entregas abiertas: **el campo no se usa** y se descarta.

Lectura:

- **El filtro de la guía (3, 4, 9) saca 25 líneas y 7,0 M (1,6 %)** del tránsito. No hay entregas con status 4, 5, 10 ni 11.
- **Trampa de SQL con los `NULL`:** 114 M (una cuarta parte del tránsito) no tienen status. Un filtro escrito como `CAST(U_StatusEntrega AS int) NOT IN (3, 4, 9)` los descarta en silencio, porque `NULL NOT IN (…)` no es verdadero. El query debe incluir explícitamente los `NULL` (o excluirlos, si así lo decide la solicitante) y mostrarlos como “Sin status” en la validación.
- Status 7 (Entregada) con saldo abierto = entregado al cliente y aún no facturado: es justamente el tránsito pendiente de facturar.
- Los 3 documentos sin status ni tipo de facturación (1,3 M) se dejan en validación.

### `02-tablas-usuario.sql`, consulta 6: uso de los campos candidatos en las 1.652 líneas de OV abiertas (ejecutada por el desarrollador el 2026-11-10)

| Campo | Llenos | % | Rango |
|---|---|---|---|
| `ORDR.U_HBT_PerFacturacion` | 0 | 0 % | — |
| `ORDR.U_FechaIniPlanDespOV` | 0 | 0 % | — |
| `ORDR.U_FechaaSodimac` (FechaFinPlanDespOV) | 85 | 5,1 % | 2026-11-04 a 2026-11-11 |
| `ORDR.U_Fecha_Plan_Ent_Cliente` | 1.376 | 83,3 % | 2025-06-04 a 2028-02-04 |
| `ORDR.U_FechaDespacho` | 0 | 0 % | — |
| `ORDR.U_FRequeridaDesp` | 0 | 0 % | — |
| `RDR1.U_FechaIniPlanDesp` | 0 | 0 % | — |
| `RDR1.ShipDate` (estándar, fecha de entrega de la línea) | 1.652 | 100 % | 2025-06-04 a 2028-02-01 |
| `RDR1.U_Tiendas` | 62 | 3,8 % | — |
| `RDR1.U_CentroCostos` | 1.406 | 85,1 % | — |
| `RDR1.OcrCode` (estándar) | 1.442 | 87,3 % | — (cuadra con las 210 líneas sin centro de costos de la consulta 11) |

Lectura:

- **Se descartan seis campos vacíos:** `U_HBT_PerFacturacion`, `U_FechaIniPlanDespOV`, `U_FechaDespacho`, `U_FRequeridaDesp`, `U_FechaIniPlanDesp` y, para OV, `U_Despachado` (consulta 5c).
- **Fecha despacho:** propuesta `RDR1.ShipDate` (llena en el 100 %, es la fecha de entrega por línea de SAP). Alternativa: `U_Fecha_Plan_Ent_Cliente` (83 %, encabezado). `pendiente`: confirmar con la solicitante.
- **Fecha ProyFAC:** no hay un campo con ese nombre. El único candidato con datos que encaja con la regla de la guía (“mes en curso **o en blanco**”) es `U_FechaaSodimac` (FechaFinPlanDespOV): vacío en el 95 % y con fechas solo de esta semana, como un plan de despacho. Hipótesis, no confirmada: puede que el Visor OV la calcule en vez de leerla de un campo. `pendiente`: Logística.
- **Tienda:** `U_Tiendas` está lleno solo en el 3,8 %. **No sirve** para tienda física / ecommerce; se usa el subgrupo, el centro de costos o el Tipo OV (consultas 2, 11 y 1).
- **Centro de costos:** `OcrCode` (87 %) y `U_CentroCostos` (85 %) tienen cobertura parecida. La consulta 6b dirá si el UDF o el del cliente llenan los huecos de `OcrCode`.

### `02-tablas-usuario.sql`, consulta 6b: respaldo del centro de costos (ejecutada por el desarrollador el 2026-11-10)

| `OcrCode` de la línea | `U_CentroCostos` de la línea | `U_CentrodeCtos` del cliente | Líneas | Saldo abierto |
|---|---|---|---|---|
| Lleno | Igual | Igual | 1.366 | 2.575.522.902,28 |
| Lleno | Igual | Distinto | 40 | 15.607.142,94 |
| Lleno | Vacío | Igual | 35 | 32.875.836,11 |
| Lleno | Vacío | Distinto | 1 | 102.857,00 |
| **Vacío** | **Vacío** | **Lleno** (p. ej. `GV-ADIS1`) | **210** | **320.534.845,86** |
| | | **Total** | **1.652** | **2.944.643.584** |

Lectura:

- **`U_CentroCostos` de la línea no aporta nada:** cuando está lleno es igual a `OcrCode`, y está vacío justo donde falta `OcrCode`. Se descarta.
- **El centro de costos del cliente (`OCRD.U_CentrodeCtos`) está lleno en todos los casos** y coincide con `OcrCode` en 1.401 de 1.442 líneas (97 %).
- **Regla:** centro de costos = `OcrCode` de la línea; si está vacío, `U_CentrodeCtos` del cliente. Con eso el 100 % del saldo de OV queda con centro de costos. Se agrega una columna `OrigenCentroCostos` (`Linea` / `Cliente`) para que la validación muestre cuánto viene del respaldo.
- Precaución: el del cliente es el valor **actual** del maestro, no el que tenía al crear el documento. Si al cliente le cambian el centro de costos, sus OV viejas sin `OcrCode` cambian de grupo. Para saldos abiertos el efecto es menor. `pendiente`: validar que los códigos del cliente existan en `OOCR`.

### `02-tablas-usuario.sql`, consulta 7: OV abiertas por subgrupo y segmento (ejecutada por el desarrollador el 2026-11-10)

26 combinaciones; suman 352 OV y 2.944,6 M (cuadra con la consulta 3). Agrupado por subgrupo:

| Subgrupo | OV | Saldo abierto |
|---|---|---|
| 104-01 Obras Residenciales (segmentos 0001, 0002, 0006, 0008, 0009, 0010) | 83 | 1.831.244.336,41 |
| 104-02 Reformas Vivienda Nueva | 2 | 2.336.153,28 |
| 105-01 Autoservicio | 41 | 173.466.147,43 |
| 105-02 Detallistas Nacional | 32 | 102.991.366,93 |
| 105-03 Detallistas Regional | 80 | 261.051.283,83 |
| 105-05 Marketplace Comisionista | 3 | 1.116.557,62 |
| 105-06 Marketplace Puro | 1 | 768.943,00 |
| **106-01 Firplak Home** | **44** | **169.562.313,88** |
| **106-02 e-commerce** | **17** | **273.553.687,58** |
| **106-04 MAC** | **3** | **2.441.848,00** |
| 108-01 Ventas a Empleados | 1 | 376.809,05 |
| 108-02 Ventas Convenios | 2 | 15.424.619,00 |
| 109-01 Ventas de Servicios | 33 | 10.187.324,63 |
| 111-01 Detallista del Exterior | 5 | 93.688.956,75 |
| 111-02 Mayorista Obras Exterior | 3 | 6.328.934,22 |
| 111-04 Autoservicio Exterior | 1 | 104.271,60 |
| Sin subgrupo | 1 | 1,00 |

Lectura:

- **Confirmado: Canal B2C (grupo 113) = subgrupos 106-xx.** 106-01 + 106-02 + 106-04 suman 64 OV y 445.557.849,46, exactamente lo mismo que el grupo 113 de la consulta 10. El prefijo 106 es un código anterior que no se renumeró.
- **Los tres marcadores de tienda física / ecommerce no coinciden del todo:**

  | Concepto | Subgrupo | Centro de costos (consulta 11) | Tipo OV (consulta 5) |
  |---|---|---|---|
  | Tienda física | 106-01 Firplak Home: 169,6 M | `GV-FH*`: 153,8 M | 14 Cliente Final: 195,6 M |
  | Ecommerce | 106-02 e-commerce: 273,6 M | No existe | 13 Firplak.com: 270,9 M |

- **Propuesta: usar el subgrupo de cliente** para el segmentador “Tienda física / Ecommerce”. Es lo que nombra la guía (“Subgrupo = Firplak Home y Ecommerce”), cuadra exacto con el canal y existe también en `Informe_ventas` (`SubgrupoCliente`), así que D se filtra igual. El centro de costos y el Tipo OV quedan como filtros aparte. `pendiente`: aprobación de la solicitante.
- **Default de la guía (Canal B2C + Firplak Home + Ecommerce): 443,1 M en OV**; queda fuera MAC (2,4 M). `pendiente`: ¿qué es MAC y si entra?
- El segmento solo se usa en Constructores (104-01) y en Autoservicio (105-01, segmento 0007 Marketplace); en el resto es 0010 N/A.
- Los marketplaces (105-05, 105-06) suman 1,9 M: la duda de si son ecommerce casi no mueve la cifra.

### `02-tablas-usuario.sql`, consulta 8: canal y centro de costos en `Informe_ventas` (ejecutada por el desarrollador el 2026-11-10)

Noviembre de 2026 (1 al 10), facturas y NC netas:

| Grupo de cliente | ¿Existe en `OCRG`? | Líneas | Valor neto | Centro de costos (mínimo – máximo) |
|---|---|---|---|---|
| Canal Distribución | Sí | 607 | 334.860.099,68 | `GV-ADIS1` – `GV-TGDIS` |
| Canal B2C | Sí | 185 | 61.129.885,97 | **`GV-BHCAL`** – `GV-SOPTE` |
| Canal Constructores | Sí | 38 | 49.742.314,17 | `GV-AOBR1` – `GV-SUOBR` |
| Servicios | Sí | 12 | 12.522.535,30 | `GV-OSER1` |
| Ventas Especiales | Sí | 4 | 495.588,45 | `GV-SOPTE` |
| **Total** | | **846** | **458.750.423,57** (cuadra con la consulta 13) | |

Lectura:

- **Confirmado: `Informe_ventas.GrupoCliente` usa los mismos nombres que `OCRG.GroupName`.** El filtro de canal se aplica igual en A–C y en D (en A–C por nombre o por `GroupCode`; en D por nombre).
- **`CentroCostos` trae el código (`GV-…`)**, igual que `OcrCode`: el filtro de centro de costos también es homogéneo.
- **Centro de costos nuevo: `GV-BHCAL`** aparece en facturas de B2C y no estaba en las OV abiertas (consulta 11, donde Cali es `GV-FHCAL`). Puede ser otro centro de Cali o un cambio de código. `pendiente`: confirmar su nombre en `OOCR` antes de definir “Firplak Home = `GV-FH*`”.
- La facturación de exportación (Exterior) del mes queda repartida dentro de estos grupos; no existe un grupo de exportación en `OCRG`.

### `02-tablas-usuario.sql`, consulta 9: `ValorTotal` contra SAP (ejecutada por el desarrollador el 2026-11-10)

Facturas de Firplak de noviembre (1 al 10) en `Informe_ventas`, unidas con `INV1` por `DocEntry` + `LineNum`:

| Medida | Resultado |
|---|---|
| Líneas | 719 (cuadra con las 63 + 656 de la consulta 13) |
| Sin línea en SAP | 0 |
| `SUM(ValorTotal)` | 665.838.965,81 |
| `SUM(INV1.LineTotal)` (sin IVA) | **665.838.965,81 (idéntico)** |
| `SUM(INV1.GTotal)` (con IVA) | 760.796.794,08 |
| Líneas iguales a `LineTotal` | **719 de 719** |
| Líneas iguales a `GTotal` | 63 (probablemente las de exportación, exentas de IVA) |
| Líneas con `SlpCode` recuperable desde `OINV` | **719 de 719** |

Lectura:

- **Confirmado: `ValorTotal` = `LineTotal`, en COP y sin IVA.** A–C usan `OpenSum`, que también es sin IVA: **el consolidado es homogéneo sin IVA**. Si la solicitante lo pide con IVA, habría que cambiar A–C y D a la vez (en D, con `GTotal` desde SAP).
- **La unión `Informe_ventas` → `OINV` por `DocEntry` + `LineNum` funciona al 100 %:** el `SlpCode` del asesor se puede recuperar para todas las facturas de Firplak, como se propuso en la consulta 12. `pendiente`: comprobar lo mismo para NC contra `ORIN`/`RIN1`, y para Viventta si entra.

### Resumen de `02-tablas-usuario.sql`

| Tema | Resultado |
|---|---|
| Tipo OV | `U_TipoPedidos` (`@FIR_TIPOPEDIDOS`); la exclusión de la guía saca 51,2 M de B (1,7 %) |
| Status entrega | Solo se llena en entregas: el filtro aplica a C, saca 7,0 M; 114 M de tránsito sin status (`pendiente`) |
| Canal | `OCRG`; mismos nombres en `Informe_ventas` |
| Tienda física / ecommerce | Subgrupo de cliente 106-01 / 106-02 (propuesta); B2C = 106-xx, cuadre exacto |
| Centro de costos | `OcrCode` con respaldo en el cliente: 100 % de cobertura; mismo formato en `Informe_ventas` |
| Fecha despacho | `RDR1.ShipDate` (100 % lleno), propuesta |
| Fecha ProyFAC | Sin confirmar; hipótesis `U_FechaaSodimac` |
| Valores | Sin IVA en todas las etapas |
| Compatibilidad | `Firplak_SA` y `Planos_Symphony` en nivel 100: sin `TRY_CONVERT` |

### `03-diagnostico-saldo.sql`, consulta 1: dónde está la diferencia `OpenSum` vs. proporcional (ejecutada por el desarrollador el 2026-11-10)

La primera ejecución falló (`Mens. 102 … cerca de ')'`, en el cierre de una CTE). Se reescribió sin CTE y con un lote (`GO`) por consulta.

| Etapa | Clase | Moneda | Líneas | Con diferencia | `OpenSum` | Proporcional | Diferencia |
|---|---|---|---|---|---|---|---|
| A. Ofertas | Completa | `NULL` / vacía | 278 | 0 | 0 | 0 | 0 |
| A. Ofertas | Completa | `$` | 214 | 0 | 345.845.574,52 | 345.845.574,52 | 0 |
| A. Ofertas | Completa | USD | 348 | 0 | 1.165.647.429,57 | 1.165.647.429,57 | 0 |
| A. Ofertas | Parcial | vacía | 71 | 0 | 0 | 0 | 0 |
| A. Ofertas | **Parcial** | **USD** | **404** | **404** | **3.086.879.214,39** | **2.284.813.324,95** | **802.065.889,44** |
| B. OV | Completa | `NULL` | 527 | 0 | 0 | 0 | 0 |
| B. OV | Completa | `$` | 1.056 | 0 | 2.811.901.245,06 | 2.811.901.245,06 | 0 |
| B. OV | Completa | USD | 54 | 0 | 97.662.777,29 | 97.662.777,29 | 0 |
| B. OV | Parcial | `NULL` | 4 | 0 | 0 | 0 | 0 |
| B. OV | **Parcial** | `$` | **11** | **11** | 34.207.126,56 | 15.743.321,58 | 18.463.804,98 |
| B. OV | **Parcial** | USD | **1** | **1** | 2.459.385,28 | 223.580,48 | 2.235.804,80 |
| C. Entregas | Completa | `NULL` | 187 | 0 | 0 | 0 | 0 |
| C. Entregas | Completa | `$` | 506 | **6** | 424.864.675,24 | 425.473.268,45 | −608.593,21 |
| C. Entregas | Completa | USD | 2 | 0 | 15.522.768,00 | 15.522.768,00 | 0 |
| C. Entregas | Parcial | `NULL` | 2 | 0 | 0 | 0 | 0 |
| C. Entregas | **Parcial** | `$` | **4** | **4** | 9.253.165,99 | 4.909.168,82 | 4.343.997,17 |

Ninguna línea tiene factor de unidad de medida distinto de 1. Solo 1 línea (oferta parcial USD) tiene `OpenSum` mayor que `LineTotal`.

Lectura:

- **La moneda no causa la diferencia:** en las líneas completas, en COP y en USD, los dos métodos coinciden al peso. Se descarta la hipótesis de la consulta 4.
- **Toda la diferencia está en las líneas parcialmente convertidas, entregadas o facturadas:** 404 líneas de oferta (802 M), 12 de OV (20,7 M) y 4 de entrega (4,3 M). En todas, `OpenSum` es mayor que el cálculo proporcional; en las OV en COP, más del doble. Es decir, SAP bajó la cantidad abierta (`OpenQty`) más de lo que bajó el saldo en pesos (`OpenSum`), o al revés.
- **Todas las ofertas parciales están en USD**: son ofertas de exportación convertidas a OV por partes.
- Excepción: 6 entregas completas en COP con `OpenSum` 0,6 M menor que el proporcional. Puede ser una devolución o un ajuste por valor. `pendiente`.
- **Líneas sin moneda y con valor 0:** 349 de oferta, 531 de OV y 189 de entrega. No mueven el saldo, pero sí el número de líneas. Probablemente son componentes de kits o líneas a precio 0. `pendiente`: confirmar y decidir si se muestran en el detalle.
- **Todavía no se elige el método.** La consulta 2 (top 30 diferencias con precio y cantidades) dirá cuál de los dos cuadra con `Price × OpenQty`. Si A se limita a ofertas vigentes (consulta 8 del primer script), la mayor parte de la diferencia sale del indicador de todas formas.

### `03-diagnostico-saldo.sql`, consulta 2: las 30 líneas con mayor diferencia (ejecutada por el desarrollador el 2026-11-10)

29 líneas de oferta en USD (documentos como 2000450, 2000437, 2000439, 2000384) y 1 de OV en COP. Patrón en **las 30**: `OpenSum = LineTotal` y `OpenSumFC = Price × Quantity`, aunque `OpenQty` sea mucho menor que `Quantity`.

| Ejemplo | `Quantity` | `OpenQty` | `Price` | `LineTotal` | `OpenSum` | Proporcional | Comprobación |
|---|---|---|---|---|---|---|---|
| Oferta 2000437, línea 27 (USD, tasa 3.275,01) | 552 | 4 | 23,62 | 42.700.366,38 | 42.700.366,38 | 309.422,94 | 23,62 × 4 × 3.275,01 = 309.422,9 |
| OV 163750, línea 8 (COP) | 8 | 4 | 2.016.203,25 | 16.129.626,00 | 16.129.626,00 | 8.064.813,00 | 2.016.203,25 × 4 = 8.064.813 |

Lectura:

- **En las líneas procesadas por partes, SAP no reduce `OpenSum`:** se queda en el valor total de la línea. El cálculo proporcional de la guía es igual a `Price × OpenQty` (× tasa del documento si es USD), que es el saldo real.
- **Decisión técnica: el saldo abierto se calcula como `LineTotal × OpenQty / Quantity`** (método de la guía), no con `OpenSum`. En líneas completas los dos coinciden al peso (consulta 1); en las parciales solo el proporcional es correcto.
- La tasa de las líneas USD es la del documento (`Rate`), porque `LineTotal` ya está en COP con esa tasa. Si la solicitante prefiere la tasa del día, hay que recalcular desde el valor en USD.
- Las cifras de la consulta 3 del primer script con el método correcto son: A = 3.796,3 M (antes de filtrar por vigencia), B = 2.923,9 M, C = 447,5 M.
- Las 6 entregas completas con `OpenSum` 0,6 M menor que el proporcional (consulta 1) quedan como validación: con el método proporcional cuentan por su valor completo.

### `03-diagnostico-saldo.sql`, consulta 3: ¿lo convertido de las ofertas parciales está en OV? (ejecutada por el desarrollador el 2026-11-10)

La versión con `OUTER APPLY` falló (`Mens. 102 … cerca de 'WHERE'`); se reescribió con `LEFT JOIN` a una subconsulta agrupada. Las consultas 3 a 5 ya no usan `APPLY` ni CTE.

| Medida | Resultado |
|---|---|
| Líneas de oferta abiertas parcialmente convertidas | 475 |
| Cantidad convertida (`Quantity − OpenQty`) = cantidad en OV que apunta a esa línea | **442 (93 %)** |
| Sin ninguna OV que apunte a la línea | 11 |
| Con OV pero cantidades distintas | 22 |
| Cantidad convertida total | 5.312 |
| Cantidad en OV total | 5.443 (131 unidades más) |

Lectura:

- **La trazabilidad oferta → OV funciona:** en el 93 % de las líneas, lo que SAP descontó de la oferta es exactamente lo que está en las OV. Con el método proporcional, A cuenta solo lo no convertido y B lo convertido: **no hay doble conteo A–B por conversiones parciales.**
- Las 11 líneas sin OV pueden haberse copiado directo a entrega o a factura (la consulta 7 del primer script mostró 5 líneas de factura con base oferta) o a una OV ya cancelada. Las 22 con cantidad distinta suman 131 unidades más en OV: cambio de cantidad al copiar. En los dos casos el saldo abierto de la oferta sigue siendo `OpenQty`, que es lo que se usa. Quedan en validación.

### `03-diagnostico-saldo.sql`, consulta 4: posible doble conteo A–B (ejecutada por el desarrollador el 2026-11-10)

OV directas abiertas (sin oferta base) cuyo cliente y artículo también tienen una oferta abierta:

| Líneas de OV | OV | Saldo OV | Saldo de oferta del mismo cliente y artículo | Oferta anterior a la OV | Con oferta vigente |
|---|---|---|---|---|---|
| 3 | 3 | 7.037.877,30 | 1.948.996,31 | 2 | 1 |

Lectura:

- **El riesgo de doble conteo A–B es despreciable:** como máximo 1,9 M de oferta, en 3 líneas, frente a 2.924 M de OV. Con la regla de solo ofertas vigentes queda 1 línea.
- No se agrega una regla de exclusión; las 3 líneas quedan en la consulta de validación del objeto final.

### `03-diagnostico-saldo.sql`, consulta 5: posible doble conteo B–D (ejecutada por el desarrollador el 2026-11-10)

OV abiertas cuyo cliente y artículo tienen facturas directas (sin documento base) en los últimos 90 días, la última posterior a la OV:

| Líneas de OV | OV | Saldo OV | Valor de las facturas directas |
|---|---|---|---|
| 94 | 33 | 91.398.012,56 (3,1 % de B) | 214.057.940,22 |

Lectura:

- **No es despreciable:** si fueran ventas duplicadas, B estaría inflado hasta en 91 M. Pero el indicio no distingue un doble conteo de un cliente que compra el mismo artículo con frecuencia (distribuidores, autoservicios).
- El valor de facturas (214 M) está sobreestimado: si un cliente tiene varias líneas de OV del mismo artículo, sus facturas se suman una vez por línea.
- `pendiente`: consulta 6 (detalle por línea de OV: número de facturas, cantidad facturada contra cantidad abierta y canal). Si la factura tiene la misma cantidad que la OV abierta, días después, es probable que sea la misma venta facturada sin copiar la OV; en ese caso el remedio es operativo (cerrar esas OV en SAP) y se informa a la solicitante.

### `03-diagnostico-saldo.sql`, consulta 6: detalle OV abierta vs. factura directa (ejecutada por el desarrollador el 2026-11-10)

94 líneas, 33 OV, 6 códigos de cliente. Todas las líneas de OV están completas (nada entregado ni facturado desde la OV).

| Grupo | Líneas | OV | Saldo OV | Lectura |
|---|---|---|---|---|
| Cliente `CN800185295-02` (Constructores), OV 162358, 162972, 163376 | 11 | 3 | 71.583.379 | **Revisar.** Ver abajo |
| Cliente `CN890302629-03` (Constructores), OV 164211 | 1 | 1 | 8.402.064 | OV de 51 unidades; 1 factura de 1 unidad (0,2 M). Compra distinta |
| Cliente `CN900374366-xx` (Distribución, 4 códigos) | 82 | 29 | 11.412.570 | Compras recurrentes: muchas facturas pequeñas, cantidades distintas. No es doble conteo |
| De ellas, “misma cantidad abierta” | 3 | 3 | 0 | Líneas de valor 0 |

**Caso `CN800185295-02`:** proyecto de Constructores con 3 OV abiertas desde agosto y septiembre de 2026 para el artículo `VROP02-0001-000-0300` (748 unidades abiertas, 68,5 M) y su accesorio `CPLM01-0001-000-0000` (468 unidades, 3,1 M). En el mismo periodo se le facturaron **directo, sin copiar las OV**, 266 unidades del artículo (3 facturas, 24,4 M, del 11-sep al 21-oct) y 194 del accesorio (1,3 M). Ninguna cantidad coincide con una línea de OV, pero el patrón (proyecto con OV abiertas y facturación directa del mismo artículo) es el típico de una OV que se factura “por fuera”.

Lectura:

- **La exposición máxima real a doble conteo B–D es de unos 25,7 M** (lo facturado directo a ese cliente: 24,4 M + 1,3 M), no 91 M. Es el 0,9 % de B.
- No se agrega una regla automática: no hay forma segura de emparejar facturas directas con OV. `pendiente`: que la solicitante o el asesor confirmen si las OV 162358, 162972 y 163376 siguen vigentes o deben cerrarse en SAP.
- Recomendación operativa: facturar copiando desde la OV o la entrega, para que SAP descuente el saldo.

### Resumen de `03-diagnostico-saldo.sql`

| Tema | Resultado |
|---|---|
| Método de saldo | **Proporcional** (`LineTotal × OpenQty / Quantity`); `OpenSum` no se reduce en líneas parciales |
| Doble conteo A–B por conversión parcial | No hay: el 93 % de lo convertido cuadra exacto con las OV |
| Doble conteo A–B por OV directa | Despreciable: 1,9 M de oferta en 3 líneas |
| Doble conteo B–D por factura directa | Hasta 25,7 M, concentrado en 3 OV de un cliente de Constructores (`pendiente`) |
| Moneda | No causa diferencias; USD a la tasa del documento |

### `04-ofertas-b2c.sql` (ejecutado por el desarrollador el 2026-11-11)

**Consulta 1: ofertas abiertas por canal** (saldo proporcional):

| Canal | Ofertas | Líneas | Saldo |
|---|---|---|---|
| 105 Canal Distribución | 126 | 1.034 | 3.359.530.163,17 |
| **113 Canal B2C** | **45** | **124** | **163.078.987,91** |
| 104 Canal Constructores | 23 | 76 | 158.113.950,76 |
| 109 Servicios | 8 | 19 | 57.571.089,13 |
| 108 Ventas Especiales | 2 | 11 | 668.322,15 |
| **Total** | **204** | **1.264** | **3.738.962.513,12** |

- Contra el diagnóstico (215 ofertas, 1.315 líneas, 3.796,3 M) faltan 11 ofertas, 51 líneas y 57,3 M: el `JOIN OCRD` descarta ofertas cuyo `CardCode` no existe en el maestro. Sin cliente no hay canal, así que no afectan a B2C. `pendiente`: identificar esas ofertas.
- Las ofertas de 2016–2020 están en Distribución: el filtro B2C las deja fuera.

**Consulta 2: B2C por vigencia, moneda, estado y subgrupo.** Todas en COP (`$`). La más antigua es de 2025.

| Corte | Ofertas | Saldo |
|---|---|---|
| Vencidas | 34 | 111,7 M |
| Vigentes | 11 | 51,3 M |
| 106-01 Firplak Home | — | 80,3 M |
| 106-02 e-commerce | — | 82,5 M |
| 106-04 MAC (fuera, decisión 12) | — | 0,3 M |
| Estado 02 Pendiente | 38 | 152,2 M |
| Estado 01 Confirmada | 3 | 10,6 M |
| Estado 03 Cancelada | 1 | 0,3 M |

**Consulta 3: B2C por Tipo OV.**

| Tipo OV | Ofertas | Líneas | Saldo |
|---|---|---|---|
| 1 Normal | 10 | 27 | 66.333.708,16 |
| `''` (texto vacío) | 17 | 41 | 29.871.497,27 |
| 14 Cliente final | 9 | 30 | 29.131.582,23 |
| 13 Firplak.com | 3 | 4 | 16.031.899,26 |
| `NULL` | 4 | 18 | 12.314.396,53 |
| 15 Rebastecimiento Firplak Home | 2 | 4 | 9.395.904,46 |

Lectura:

- **A con el filtro por defecto (B2C sin MAC) ≈ 162,8 M.** La “totalidad del canal” (decisión 9) es razonable: no arrastra ofertas abandonadas.
- La pregunta de la tasa USD no aplica a B2C.
- 3 ofertas “Confirmadas” abiertas (10,6 M): posible doble conteo A–B si la OV se creó a mano. Menor; el diagnóstico 4 de `03` lo midió despreciable.
- **En ofertas, el Tipo OV está vacío en el 26 % del saldo (42,2 M, 21 ofertas; `''` o `NULL`).** Si se aplicara la exclusión de Tipo OV con `NOT IN`, se caerían en silencio. Propuesta: A no filtra por Tipo OV (la solicitante dijo que ese filtro es del Visor OV); queda como filtro opcional, con “(sin tipo)” como valor propio. `pendiente`: ¿se excluye el tipo 15 (9,4 M) también en ofertas?

### Query “Visor OV” de Logística (recibido el 2026-11-11)

Copia textual en [`fuentes/visor-ov.sql`](../../proyectos/consolidado-comercial/fuentes/visor-ov.sql). Es un query del Query Manager de SAP B1 con dos parámetros de fecha. Lectura:

| Tema | Qué hace el Visor | Efecto en B |
|---|---|---|
| Universo | Todas las OV con `DocDate` entre las dos fechas del parámetro: abiertas, cerradas y canceladas. No filtra por estado; la columna `Status` combina `DocStatus`, `Confirmed` y `CANCELED` y se filtra después en Excel | B usa el estado actual (`CANCELED = 'N'`, `LineStatus = 'O'`) sin rango de fechas. `pendiente`: qué valores de `Status` filtra Logística; si las OV “Abierto NO AUTORIZADO” (`Confirmed = 'N'`) cuentan |
| Estado de la línea | No lo trae. Una línea cerrada a mano dentro de una OV abierta sigue apareciendo con cantidad pendiente | Consulta 1 de [`05-contraste-visor-ov.sql`](../../proyectos/consolidado-comercial/sql/05-contraste-visor-ov.sql) |
| Valor | `LineTotal` completo (`Precio_Total`) y `INMPrice`; cantidades `CantPed` (`Quantity`) y `Cant_Fact` (`DelivrdQty`, en realidad lo entregado). El pendiente se calcula fuera del query | Equivale a `LineTotal × (Quantity − DelivrdQty) / Quantity`; se compara con `OpenQty` en la consulta 1 de `05` |
| Vendedor | `OSLP.SlpName` del vendedor **de la línea** (`RDR1.SlpCode`) | La matriz proponía el del encabezado; consultas 3 y 4 de `05` |
| Fecha de despacho | `Fecha_Plan_Ini_Despacho` = `RDR1.ShipDate` (también la columna `FECHA`). Además calcula `Fecha_Plan_Ent_Cliente` (ShipDate + días de transporte por ciudad de `@FIR_PROMESA_ENTREGA`, saltando días de `@FIR_FECHAS_DISTR`) y `Fecha_Plan_Ent_a_CEDI` (ShipDate − `U_Dias_Distr` del Tipo OV, saltando `@FIR_FECHAS_PROD`) | **Confirma la propuesta `RDR1.ShipDate`** para la fecha de despacho (decisión 13). Las fechas calculadas usan cursores y no se replican |
| Joins | `INNER JOIN` con `OITM`, `OCRD`, `OCRG`, `@FIR_SUBGRUPOCLIENTE` y `OSLP` (línea): pierde líneas sin subgrupo o sin vendedor válido. `LEFT JOIN @FIR_FAM_SYMPH` por familia + Tipo OV puede duplicar filas | Consultas 2 y 5 de `05` |
| Columnas útiles | Tipo OV (`U_TipoPedidos`), grupo, subgrupo, segmento, tienda (`U_DescTiendas`), ciudad destino, `U_Bloqueado`, `U_TipoFacturacion` | Bloqueado queda como filtro opcional (respuesta 8) |
| Ausentes | Centro de costos, moneda, IVA, `LineStatus` | El centro de costos sigue la regla propia (`OcrCode` con respaldo del cliente) |

### `05-contraste-visor-ov.sql` (ejecutado por el desarrollador el 2026-11-11)

| Consulta | Resultado | Decisión técnica |
|---|---|---|
| 1. Estado de línea y saldo | OV abiertas B2C: 68 OV, 280 líneas, **476.993.918,04**; el saldo del Visor (`Quantity − DelivrdQty`) y el nuestro (`OpenQty`) son **idénticos**. Las líneas cerradas dentro de OV abiertas ya están entregadas completas (salvo 1 línea de 1 peso). Solo hay 1 OV no autorizada (otro canal, 15,3 M). Total todos los canales: 3.148,9 M (2.923,9 M el 2026-11-10: SAP cambia en vivo) | Se mantiene `LineStatus = 'O'` y el saldo proporcional |
| 2. Pérdidas por `INNER JOIN` del Visor | De 1.620 líneas abiertas, solo 1 sin subgrupo (1 peso) | Nuestro query usa `LEFT JOIN` y muestra “(sin subgrupo)” |
| 3. Vendedor encabezado vs. línea en OV | B2C: igual en el 100 % (67 OV, 279 líneas). Otros: distinto en 2 OV (5,7 M) | — |
| 4. `VendedorSenior` de `Informe_ventas` | 4.494 líneas (6.723,2 M) coinciden con encabezado y línea; 521 (244,2 M) solo con la línea, con encabezado genérico “Firplak”; 55 (24,1 M) solo con el encabezado, con vendedor de línea inactivo. Ninguna línea queda sin coincidir | Ver abajo |
| 5. Duplicados en `@FIR_FAM_SYMPH` | Sin filas: ninguna combinación familia + Tipo OV se repite; el `LEFT JOIN` del Visor no duplica líneas | — |

**Regla de `VendedorSenior` (confirmada al 100 % por la consulta 1 de [`06-vendedor-tienda.sql`](../../proyectos/consolidado-comercial/sql/06-vendedor-tienda.sql): 5.070 de 5.070 líneas de factura del mes anterior y el actual coinciden):** el query de facturas del repositorio ([`Facturas.tmdl`](../../bi-origen/bi-notas-credito/bi-notas-creditos.SemanticModel/definition/tables/Facturas.tmdl)) arma “Vendedor Senior” así: si la línea tiene `INV1.U_TIENDAS` vacío, el vendedor del encabezado (`OINV.SlpCode`); si no, el vendedor del maestro del cliente-tienda (`OCRD.SlpCode` del código en `U_TIENDAS`). Eso explica la consulta 4: las facturas de tienda tienen el encabezado genérico “Firplak”. Para que el asesor coincida entre B, C y D, B y C deben usar la misma regla con `RDR1.U_Tiendas` y `DLN1.U_Tiendas` (si existe). El mismo query excluye la serie 88, Donaciones, líneas de solo impuesto, valor 0, artículos `VZNOPE-*` y 9 facturas puntuales; `pendiente`: confirmar si `SP_Generar_Informe_Ventas` aplica las mismas exclusiones.

### `06-vendedor-tienda.sql` (ejecutado por el desarrollador el 2026-11-11)

- Las 36 combinaciones de tienda y vendedor coinciden con `VendedorSenior` (ninguna fila “No”); suman 5.070 líneas, igual que la consulta 4 de `05`.
- “Firplak” funciona como vendedor genérico: 798 líneas sin tienda (1.318,4 M) y 429 con tienda (387,8 M). Será un valor más del filtro de asesor.
- **Regla del asesor para A, B, C y D:** `U_Tiendas` de la línea vacío → `SlpCode` del encabezado; con tienda → `OCRD.SlpCode` del cliente-tienda. En D ya viene así en `VendedorSenior`.
- Consulta 2: `U_Tiendas` existe en `QUT1`, `RDR1`, `DLN1`, `INV1` y `RIN1`.
- Consulta 3 (OV abiertas): ninguna OV B2C tiene tienda (67 OV, 279 líneas, 476,97 M; regla = vendedor de línea). Otros canales: 4 OV con tienda (28,8 M) y 1 sola línea donde la regla cambia el vendedor (0,1 M).
- Consulta 4 (entregas abiertas): B2C 59 entregas, 170 líneas, **73.316.860,27**, todas sin tienda; otros canales 6 entregas con tienda (65,5 M) y 233 sin tienda (327,3 M). La regla coincide con el vendedor de línea en el 100 %. Total C hoy: 466,2 M.
- En B2C la tienda se llena al facturar, no en la OV ni en la entrega. La regla se aplica igual en A–C por consistencia.

### Query “Tránsito” (recibido el 2026-11-11)

Copia textual en [`fuentes/transito.sql`](../../proyectos/consolidado-comercial/fuentes/transito.sql). Query del Query Manager con rango de `ODLN.DocDate`. Lectura:

| Tema | Qué hace el query | Efecto en C |
|---|---|---|
| Universo | Todas las entregas del rango, con columnas `CANCELED` y `Estado Item` (`LineStatus`) para filtrar en Excel. Es el origen del filtro “Estado Item = O” de la guía | C = `CANCELED = 'N'` y `LineStatus = 'O'`, sin rango de fechas |
| Valor | `LineTotal` completo (“Valor sin IVA”), aunque la línea esté facturada en parte | Nuestro saldo es proporcional; consulta 1 de [`07-contraste-transito.sql`](../../proyectos/consolidado-comercial/sql/07-contraste-transito.sql) |
| Facturas | `LEFT JOIN INV1` por línea base: una línea facturada en varias facturas parciales se repite, con su `LineTotal` completo en cada fila | Riesgo de inflar el tránsito en Excel; consulta 1 de `07` |
| Asesor | `OSLP` del encabezado (`ODLN.SlpCode`) | En entregas coincide con la regla de tienda en el 100 % (`06`, consulta 4) |
| Centro de costos | `DLN1.CogsOcrCod` (norma de reparto del costo), no `OcrCode` | Consulta 4 de `07` |
| **Fecha ProyFAC** | **`ODLN.U_FechaRadFAC`** (encabezado, alias “FechaProyFAC”) | Resuelve la incógnita: el filtro “mes en curso o en blanco” usa este campo. Consulta 2 de `07` |
| Fecha despacho | `ODLN.U_FechaDespacho` | Para C puede usarse esta; para B, `RDR1.ShipDate` (Visor). Consulta 5 de `07` |
| Status entrega / POD | `ODLN.U_StatusEntrega`, `U_POD`, `U_TipoFacturacion`, fechas de POD | Consultas 2 y 5 de `07` |
| Tipo OV | `ODLN.U_TipoPedidos` (encabezado de la entrega) | Consulta 3 de `07` |
| Joins | `INNER JOIN` con `OSLP`, `OCRD` y `OCRG` | Sin pérdidas esperadas (`05`, consulta 2) |

### `07-contraste-transito.sql` (ejecutado por el desarrollador el 2026-11-11)

**Consulta 1: valor.** B2C: 59 entregas, 166 líneas, todas completas: 73.141.935,58 con los tres métodos. Otros: 572 líneas completas (375,57 M, iguales) y 6 líneas parciales en 4 entregas, donde el query de Tránsito suma 9,25 M y el saldo proporcional es 4,91 M (inflado de 4,3 M). Cada línea parcial tiene una sola factura: hoy no hay filas repetidas.

**Consulta 2: Status entrega × Fecha ProyFAC (B2C, 73,14 M):**

| Status entrega | ProyFAC en el mes | ProyFAC vacía | Total |
|---|---|---|---|
| `NULL` | 2.001.512,39 | 10.793.712,21 | **12,80 M (17 %)** |
| 1 Embarque | 3.005.379,22 | 3.726.287,00 | 6,73 M |
| 2 Tránsito | 22.985.784,35 | 23.854.848,25 | 46,84 M |
| 6 Cliente recoge | 394.873,95 | — | 0,39 M |
| 7 Entregada | — | 4.326.020,97 | 4,33 M |
| 8 Entregada con novedad | — | 2.053.517,24 | 2,05 M |

- En B2C no hay status 3, 4 ni 9, y ninguna Fecha ProyFAC cae fuera del mes en curso: hoy esos dos filtros no quitan nada. Lo único que mueve C son las entregas sin status (12,8 M). Propuesta: cuentan y “(sin status)” es un valor del filtro (`pendiente` solicitante).
- Otros canales: status 3 y 9 suman ~5,3 M y la Fecha ProyFAC de meses anteriores ~16,8 M adicionales.

**Consulta 3: Tipo OV de las entregas abiertas B2C:**

| Tipo OV | Entregas | Líneas | Saldo | Guía |
|---|---|---|---|---|
| 15 Rebastecimiento Firplak Home | 11 | 76 | 29.151.396,29 | Excluye |
| 14 Cliente final | 11 | 21 | 21.838.758,17 | Incluye |
| 6 Reposición producto | 7 | 10 | 7.512.979,57 | Excluye |
| 1 Normal | 5 | 16 | 4.605.346,63 | Incluye |
| 13 Firplak.com | 2 | 3 | 3.704.790,40 | Incluye |
| 12 Reposición repuesto | 16 | 19 | 3.176.874,62 | Excluye |
| `''` (vacío) | 6 | 17 | 2.755.377,90 | Sin tipo: cuenta |
| 7 Atención | 1 | 2 | 396.412,00 | Excluye |

- **Los tipos excluidos son el 55 % del tránsito B2C (40,2 M).** El 15 son despachos de reabastecimiento a las tiendas propias. Con la exclusión, C B2C ≈ 32,9 M (incluye 2,8 M sin tipo). El filtro de Tipo OV aplica a C (respuesta 6: los filtros “en mención” van al Tránsito).

**Consulta 4: centro de costos.** `CogsOcrCod` y `OcrCode` son iguales en todas las líneas llenas (165 B2C, 567 otros). 12 líneas (18,6 M) tienen ambos vacíos y toman el del cliente (`U_CentrodeCtos`). **`GV-BHCAL` está en el maestro de algún cliente B2C** cuyas entregas usan `GV-FH*` en la línea: parece un código viejo del maestro. `pendiente`: confirmar en `OOCR` con TI o Contabilidad.

**Consulta 5: uso de campos en entregas abiertas B2C (166 líneas).** `U_FechaDespacho` llena en 104 (63 %); `U_FechaRadFAC` (Fecha ProyFAC) en 53 (32 %), siempre 2026-11-30 (fin de mes); `U_FechaRealEntregaEnt` en 23 (14 %); `U_POD` en 23, siempre con valor `2` (significado `pendiente`). Propuesta: fecha de despacho de C = `U_FechaDespacho`, con respaldo `ODLN.DocDate`.

### `08-query-b-c.sql`: primera validación (ejecutado por el desarrollador el 2026-11-11)

**Consulta 1: embudo de filtros.**

| | B (OV) | C (tránsito) |
|---|---|---|
| Todos los canales | 3.084.813.217,61 (1.620 líneas) | 437.131.790,62 (736 líneas) |
| B2C | 477.053.579,47 | 72.574.876,37 |
| B2C sin MAC | 476.866.773,47 | 70.437.680,32 |
| + exclusión Tipo OV | 461.093.465,89 | 30.460.910,89 |
| **Default** (+ Donaciones, Status entrega, Fecha ProyFAC) | **461.093.465,89 (213 líneas)** | **30.460.910,89 (49 líneas)** |
| Dentro del default: sin status | — | 3.456.974,58 |
| Dentro del default: sin Tipo OV | 0 | 2.755.377,90 |
| Dentro del default: Llenados (2, 10, 11) | 0 | 0 |
| Dentro del default: bloqueadas | 330.484.396,56 (72 %) | — |

**Consulta 2: asesor.** B: Ecommerce 311,0 M (Claudia Granada 216,5 M, Juan Fernando Ospina 86,0 M) y Firplak Home 150,1 M (Natalia Gómez Usme 69,3 M, Medardo Hoyos 31,4 M, Sebastián Botero 29,9 M). C: Ecommerce 6,4 M, Firplak Home 24,1 M. Todas las líneas tienen asesor; el genérico “Firplak” pesa 1,0 M en B y 0,4 M en C.

**Consulta 3: centro de costos.** En el default, `GV-SOPTE` Soporte Nacional = segmento Ecommerce (311,0 M en B) y `GV-FHMED` + `GV-FHBOG` + `GV-FHCAL` = segmento Firplak Home (150,1 M): el filtro de centro de costos y el de subgrupo dan las mismas cifras. El respaldo del cliente se usa en 11 líneas de OV (24,6 M). `GV-BHCAL` no aparece.

**Consulta 4: controles.** Cero duplicados, saldos negativos, líneas sin asesor, sin centro de costos o sin canal en las 2.356 líneas. 1 línea sin subgrupo (la de 1 peso conocida). `U_TipoVentas` existe y está lleno en OV y entregas.

**Consulta 5: detalle del default (262 filas, exportado a Excel).**

- **Bloqueadas:** los valores de `ORDR.U_Bloqueado` son textuales (“Bloqueado” / “No Bloqueado”); la regla funciona. El 72 % es real: 15 OV bloqueadas en el encabezado (330,5 M), 12 de ellas también con bloqueo de línea (117,4 M). `pendiente`: confirmar con la solicitante si en B2C el bloqueo es normal (por ejemplo, hasta el pago). Query de bloqueos sobre todas las OV B2C abiertas (477,1 M): “Bloqueado” + línea `NULL` 3 OV 213,1 M; “Bloqueado” + línea `SI` 12 OV 117,4 M; “No Bloqueado” + línea `NO` 44 OV 127,6 M; “No Bloqueado” + línea `NULL` 7 OV 18,9 M. `U_BloqueoLogistica` siempre `NULL` y ninguna línea “NO DESPACHAR” en B2C.
- **Una sola OV es el 41 % de B:** OV 165227, R & U INGENIEROS SAS, 191,0 M, Claudia Granada, subgrupo e-commerce, Tipo OV 13 Firplak.com, bloqueada, creada el 2026-11-03. `pendiente`: confirmar con la solicitante que es venta B2C real.
- **Tipo de ventas “Excluido”:** 1 OV (165531, 17,1 M) cuenta hoy en el default. Depende de la pregunta 5 de seguimiento.
- Todas las OV y entregas del default son de 2026. 9 OV (56,1 M) tienen fecha de despacho vencida.
- Las 6 entregas sin Tipo OV (2,8 M) tampoco tienen tipo de ventas: parecen entregas sin OV de origen.

### `10-inventario-planos.sql`: objetos existentes en `Planos_Symphony` (ejecutado por el desarrollador el 2026-11-11)

El agente no tiene acceso a `Planos_Symphony` (inicio de sesión rechazado); el desarrollador ejecutó el inventario. 134 objetos. Relacionados con el proyecto:

| Objeto | Lee de SAP | Lectura |
|---|---|---|
| `SP_VisorOV` (mod. 2024-10-08), `SP_VisorOV_BI`, `SP_VisorOV_OpenOrders` (2023) → tablas `Visor_OV` (0 filas), `Visor_OV_BI` (279.711), `Visor_OV_DanielHernandez` (1.798) | OV, entregas, facturas y campos de tránsito | Versiones anteriores del Visor OV; ¿en uso? `pendiente` (pestaña 5, código de `SP_VisorOV_OpenOrders`) |
| `SP_Generar_Informe_Entregas` (mod. 2026-11-10) → `Informe_entregas` (433.863 filas) | Entregas, facturas y campos de tránsito | **El query de Tránsito materializado**, una fila por línea de entrega (`DocEntry` + `LineNum`), con `NumFacturas` y `CantidadFacturada`; ya lo usa la Reporting API. Candidato para C: [`11-contraste-informe-entregas.sql`](../../proyectos/consolidado-comercial/sql/11-contraste-informe-entregas.sql) |
| `FPK_InformeEntregasAbiertas` (2024) | Solo entregas | No usa campos de tránsito; descartado |
| `Facturas_Detalladas`, `Notas_Credito_Detalladas` (2017–2020) | — | Posible “Facturación detallada”; D ya sale de `Informe_ventas` |
| `Cargas_Log` | — | Bitácora de cargas reutilizable |

- **Jobs del Agente SQL (pestaña 5):** “BI - Entregas carga completa” y “BI - Entregas carga incremental” (`SP_Generar_Informe_Entregas @Modo = 'COMPLETA' | 'INCREMENTAL'`), los mismos dos para Ventas (`SP_Generar_Informe_Ventas`), “BI - Costo PT carga completa”, `ejecutar_informeInventarios`, `LlenarNivelServicioPT` y `LlenarTest`. **Ningún job ejecuta los SP del Visor OV**: no se actualizan solos (manuales o abandonados), así que no sirven como fuente de B. Los horarios no salen en la consulta. Patrón a seguir para este proyecto: job “BI - Consolidado comercial carga completa” que ejecute el SP del proyecto.
- **Nada lee ofertas** y ningún objeto consolida A–D: A y el consolidado se construyen.
- Ningún objeto se llama oferta, consolidado, comercial, embudo ni pendiente: no hay conflicto de nombres.
- Columnas de `Informe_entregas`: `DocEntry`, `LineNum`, `Entrega`, `Cancelado`, `EstadoItem`, `Factura`, `NumFacturas`, `CantidadFacturada`, `FechaEntrega`, `Asesor` (nombre), `CodCliente`, `Cliente`, `GrupoCliente`, `CentroCostos`, `OrdenVenta`, `ItemOrdenVenta`, `CodigoReferencia`, `DescripcionReferencia`, `Cantidad`, `TipoOV`, `OrdenCompra`, `ValorSinIVA`, `Transportador`, `NumeroGuia`, `FechaDespacho`, `StatusEntrega`, `NovedadEntrega`, `SolucionNovedad`, `TipoFacturacion`, `FechaCierreFac`, `POD`, `FechaRealEntrega`, `FechaRetPOD`, `ANX`, `FechaRetANX`, `FechaEnvPOD`, `AvisoRecibo`, `FechaRadPOD`, `FechaProyFAC`, `DestinoEntrega`, `DestinoPODFactura`, `FechaCarga`, `Empresa`, `TipoMovimiento`, `SubgrupoCliente`, `DocumentoBase`, `TipoVentas`. No tiene `OpenQty`, `SlpCode`, `GroupCode` ni tienda.

### `09-query-a.sql` (ejecutado por el desarrollador el 2026-11-13)

**Consulta 1: embudo.** Todos los canales 3.801.851.586,25 (1.377 líneas); sin cliente en el maestro: 0; B2C 156.576.495,61; **default (B2C sin MAC) 154.172.953,76 (43 ofertas, 127 líneas)**. Dentro del default: vigentes 42,5 M; canceladas 0; confirmadas 0; tipo excluido (15) 9,4 M; sin Tipo OV 42,3 M; “Excluido” 0; otra moneda 0. `U_TipoVentas` existe en `OQUT`.

- Las 11 ofertas que faltaban en `04` frente a `03` no eran clientes fuera del maestro (hoy hay 0): se cerraron entre las dos corridas. Tarea interna cerrada.

**Consulta 2: asesor.** Ecommerce 85,3 M (Juan Fernando Ospina 47,1 M, Claudia Granada 29,4 M, Brian Stiven Rúa 8,4 M, Firplak 0,4 M); Firplak Home 68,9 M (Natalia Gómez Usme 54,9 M en 25 ofertas, Víctor Julio Hernández 8,8 M, César Sánchez Jurado 3,2 M, Juan Diego Giraldo 1,3 M, Hernando Tovar 0,6 M). Todas las líneas con asesor.

**Consulta 3: centro de costos.**

| Centro de costos | Nombre en `OOCR` | Origen | Líneas | Saldo |
|---|---|---|---|---|
| `GV-SOPTE` | Soporte Nacional | Cliente | 46 | 85.327.654,63 |
| `GV-BHMED` | **INHAB** Firplak Home Medellín | Línea | 23 | 19.762.206,96 |
| `GV-BHMED` | **INHAB** Firplak Home Medellín | Cliente | 14 | 14.503.655,51 |
| `GV-FHMED` | Firplak Home Medellín | Línea | 25 | 14.152.298,61 |
| `GV-FHBOG` | Firplak Home Bogotá | Cliente | 3 | 8.757.249,00 |
| `GV-FHMED` | Firplak Home Medellín | Cliente | 14 | 7.783.605,03 |
| `GV-BHCAL` | **INHAB** Firplak Home Cali | Cliente | 1 | 3.247.628,56 |
| `GV-FHCAL` | Firplak Home Cali | Cliente | 1 | 638.655,46 |

- **Resuelto `GV-BHCAL`:** los códigos `GV-BH*` son los centros de costos **inhabilitados** de Firplak Home (`GV-BHMED`, `GV-BHCAL`); los vigentes son `GV-FH*`. En A hay 37,5 M (38 líneas) en códigos inhabilitados, tanto en líneas de oferta como en el maestro de clientes.
- Un filtro “Firplak Home Medellín” sobre `GV-FHMED` dejaría fuera 34,3 M de `GV-BHMED`. Propuesta: columna adicional “centro de costos vigente” que traduzca `GV-BH*` → `GV-FH*` (misma sede) y filtrar por ella; el código original se conserva en el detalle. `pendiente`: confirmar la equivalencia con Contabilidad y avisar que hay clientes con el código inhabilitado en el maestro.
- En ofertas el centro de costos sale del cliente en el 63 % de las líneas (80 de 127): las líneas de oferta rara vez traen `OcrCode`.

**Consulta 4: controles.** Todos en 0 en las 1.377 líneas (duplicados, cantidad cero, saldo negativo, sin asesor, sin centro de costos, sin canal).

**Consulta 5: detalle del default (127 líneas, 154,17 M, exportado a Excel).**

- **Error corregido en el script:** `U_Estado_Oferta_Venta` guarda `01`, `02`, `03` (con cero, como en `04`); el script comparaba con `1`, `2`, `3` y todas las líneas salieron “(sin estado)”, por eso canceladas y confirmadas daban 0 en la consulta 1. Se corrigió el `CASE` para aceptar ambas formas; Segunda corrida (2026-11-13, consulta 1): default sin cambios (154.172.953,76); **canceladas 289.033,50 (1 oferta), confirmadas 26.994.374,30, pendientes ≈ 126,9 M, sin estado 0**.
- Vencidas: 32 ofertas, 111,7 M; vigentes: 11 ofertas, 42,5 M. Las más antiguas son de 2025 (agosto de 2025: 6 ofertas, 31,7 M, de Natalia Gómez Usme con `GV-BHMED`).
- La oferta más grande es la 7428 (DCON DESARROLLO Y CONSTRUCCION SAS, 21,1 M, Claudia Granada, vigente).
- **La oferta 4292 (8,8 M, tipo 15) es a “FIRPLAK HOME BOGOTA”**, la propia tienda: un reabastecimiento interno, no una venta. Refuerza excluir el tipo 15 también en ofertas (pregunta de seguimiento).
- Ninguna línea está parcialmente convertida (`OpenQty = Quantity` en todas).

### `11-contraste-informe-entregas.sql` (ejecutado por el desarrollador el 2026-11-13)

**Consulta 1: frescura.** Solo `Empresa = 'Firplak'`. Carga completa a las 02:15 y luego incrementales: la última carga coincidía con la hora de la consulta (10:05). La tabla mezcla tres `TipoMovimiento`:

| `TipoMovimiento` | Líneas | Con `Cancelado = 'N'` y `EstadoItem = 'O'` |
|---|---|---|
| Entrega | 408.213 | 871 |
| Devolución | 16.503 | 2.952 |
| Nota crédito devolución | 9.811 | 3.567 |

- Para C hay que filtrar `TipoMovimiento = 'Entrega'`; las otras filas pueden repetir `DocEntry` de otros objetos. Las consultas 2 a 5 se corrigieron para cruzar solo entregas; `pendiente` volver a correrlas.
- 871 líneas de entrega abiertas en la tabla contra 736 abiertas en SAP el 2026-11-11 (`08`): la consulta 2 dirá si la tabla deja abiertas líneas ya facturadas.

**Consulta 2: estado en la tabla vs. SAP (solo entregas).** 840 líneas abiertas en ambos lados (saldo SAP 566.494.327,09); **31 líneas abiertas en la tabla y cerradas en SAP**, todas con última carga a las 02:15: la carga incremental no actualiza las entregas que se facturan durante el día; se corrigen en la carga completa nocturna. No hay líneas abiertas en SAP y cerradas en la tabla.

**Consulta 3:** 0 entregas abiertas en SAP faltan en la tabla: la incremental sí agrega entregas nuevas.

**Consulta 4: atributos de las 840 líneas abiertas en ambos lados.** Saldo SAP 566.494.327,09 vs. saldo de la tabla 567.463.037,09 (0,97 M de diferencia en 1 línea con cantidad abierta distinta: consulta 5, entrega 93879 línea 0, 27 unidades, 22 abiertas en SAP; la tabla, cargada a las 02:15, no registra las 5 facturadas o devueltas después); valor, Fecha ProyFAC, Tipo OV y subgrupo iguales (la tabla guarda el nombre del subgrupo); Status entrega distinto en 4 líneas (cambiado después de la última carga); centro de costos distinto en 21 líneas y asesor en 34, explicados por nuestras reglas (respaldo del cliente para el centro de costos y regla de tienda para el asesor; la tabla usa `CogsOcrCod` y el vendedor del encabezado, como el query de Tránsito).

**Decisión 17 (aprobada por el desarrollador el 2026-11-13):** **C se lee de SAP** en la misma carga que B, con el query de `08`. `Informe_entregas` deja líneas facturadas abiertas hasta la madrugada siguiente, lo que causaría doble conteo C–D durante el día porque `Informe_ventas` sí carga las facturas cada 15 minutos. `Informe_entregas` queda como referencia de conciliación. Aviso para quien mantiene `SP_Generar_Informe_Entregas`: el modo incremental no actualiza `EstadoItem` ni `StatusEntrega` de entregas ya cargadas, y eso también afecta el dashboard de entregas del portal (`pendiente` de comunicar).

## Cuestionario para la solicitante

1. **Compañías:** ¿solo Firplak o también Viventta? (`Informe_ventas` ya trae Viventta en facturas; hoy Viventta solo tiene 2,6 M en OV abiertas y nada en ofertas ni entregas.)
2. **Valores:** hoy todo el consolidado sale sin IVA (`Informe_ventas` y SAP coinciden línea a línea). ¿Lo aprueba así o lo quiere con IVA? (Hoy ningún documento abierto tiene descuento de encabezado ni fletes.) El 64 % de las ofertas abiertas está en USD: ¿se llevan a COP con la tasa del documento o con la del día? ¿Las ofertas de exportación entran en el consolidado?
3. **Fecha de corte:** ¿basta el estado actual o se necesita ver cortes pasados (foto diaria desde que salga el tablero)?
4. **Latencia:** ¿cada cuánto debe actualizarse? (`Informe_ventas` va cada 15 min de 6:00 a 20:00.)
5. **Ofertas:** de 4.598 M abiertos en SAP, solo 172 M (34 ofertas) están vigentes; 3.986 M son ofertas de 2016–2020 que nadie cerró. ¿A cuenta solo las vigentes (fecha “válida hasta” ≥ corte) o las de los últimos N meses? ¿Comercial puede cerrar en SAP las vencidas?
6. **Visor OV:** ¿existe un query o Excel en Logística? ¿Quién lo mantiene? ¿Los filtros de Status entrega, Tipo OV y Fecha ProyFAC aplican a OV, a tránsito o a ambos?
7. **Códigos:** Status entrega excluye 3 (En Novedad), 4 (Redireccionada) y 9 (Rechazada), y solo se diligencia en las entregas, así que el filtro aplica al tránsito. Una cuarta parte del tránsito (114 M) no tiene status: ¿cuenta o no? ¿Qué papel tiene el POD (Sin POD, POD Parcial, POD Total) en el tránsito elegible? ¿también 10 (Novedad en Sln)? ¿Las OV con Status 7 (Entregada) siguen contando como pendientes si SAP no las ha cerrado? Tipo OV excluye 4 Muestras, 6 Reposición producto, 7 Atención, 9 FulFillment, 12 Reposición repuesto y 15 Rebastecimiento Firplak Home: ¿también se excluyen 2 Llenado Stock, 10 Llenado Eventos y 11 Llenado Ferias? ¿El ecommerce es el Tipo OV 13 (Firplak.com)? ¿Qué es FulFillment? ¿La exclusión aplica también a ofertas?
8. **Ofertas canceladas y OV bloqueadas:** ¿se excluyen ofertas con Estado oferta = 3 (Cancelada)? ¿Las OV bloqueadas (comercial, logística, despacho) o con línea “NO DESPACHAR” cuentan en B?
9. **Tipo de ventas:** ¿se excluyen Donaciones y Excluido? ¿Zona Franca cuenta como nacional o como exterior?
10. **Canal y subgrupo:** el canal es el grupo de cliente de SAP (B2C = “Canal B2C”, 15 % del saldo de OV). ¿El tablero arranca filtrado solo en B2C, como dice la guía, o en todos los canales? B2C son los subgrupos 106-01 Firplak Home, 106-02 e-commerce y 106-04 MAC. Propuesta: el filtro “Tienda física / Ecommerce” usa el subgrupo de cliente (también existe en facturación). Los otros marcadores dan cifras parecidas pero no iguales (centro de costos Firplak Home 154 M contra 170 M del subgrupo; Tipo OV 13 Firplak.com 271 M contra 274 M). ¿Aprueba el subgrupo? ¿Qué es MAC y entra en el default? ¿Los marketplaces (105-05, 105-06, 1,9 M) cuentan como ecommerce? ¿La agrupación de centros de costos en Obras, Distribución, Home y Exportación es correcta?
11. **Fecha de despacho y Fecha ProyFAC:** los campos de “fecha de despacho” de SAP están vacíos. ¿Sirve la fecha de entrega de la línea (`ShipDate`, llena siempre) o la fecha planeada de entrega al cliente (83 %)? ¿Fecha ProyFAC es `FechaFinPlanDespOV` (`U_FechaaSodimac`), que solo tiene fechas en el 5 % de las líneas, o un cálculo del Visor OV?
12. **Asesor:** ¿el del documento o el de la línea? ¿Cada asesor debe ver solo su cartera?
13. **Defaults:** asesor y centro de costos por defecto del panel avanzado.
14. **Conciliación:** un mes y un asesor con cifras que ella valide como correctas.
15. **OV con facturación directa:** el cliente `CN800185295-02` (Constructores) tiene las OV 162358, 162972 y 163376 abiertas (71,6 M) y, en el mismo periodo, se le facturaron directo 266 unidades del mismo artículo (25,7 M con el accesorio). ¿Esas OV siguen vigentes o ya se facturaron y deben cerrarse en SAP?

## Respuestas de la solicitante (2026-11-11)

Respuestas textuales pasadas por el desarrollador; cada respuesta clara quedó como decisión en la [tabla de decisiones](#decisiones-tomadas).

| # | Respuesta (resumen) | Estado |
|---|---|---|
| 1 | Solo Firplak | Cerrada (decisión 5) |
| 2 | Sin IVA. No respondió tasa USD ni ofertas de exportación | Parcial |
| 3 | Estado a la hora y día de la consulta | Cerrada (decisión 7) |
| 4 | 15 min ideal, o 30; lo define Sistemas | `pendiente` TI (decisión 8) |
| 5 | “Cuenta la totalidad del canal B2C” | Cerrada (decisión 9); magnitud `pendiente` `04` |
| 6 | Existen “Visor OV” (Logística) y “Tránsito”. Visor solo filtra Tipo OV; Status entrega y Fecha ProyFAC filtran Tránsito | Cerrada (decisiones 3 y 10); pedir los SQL |
| 7 | Sin respuesta | Abierta: muchas subpreguntas se resuelven leyendo los queries de Logística |
| 8 | “Cancelado se deja como opción en el filtro, las OV bloqueadas y las demás” | Parcial: se interpreta que bloqueadas y “NO DESPACHAR” también son opción de filtro; confirmar |
| 9 | Se excluye Donaciones. No respondió Excluido ni Zona Franca | Parcial (decisión 11) |
| 10 | MAC no entra. Filtro de centro de costos, pero el valor de Tienda/Ecommerce sale del subgrupo | Parcial (decisión 12); falta el default de canal y los marketplaces |
| 11 | Fecha de despacho del Visor OV; Fecha ProyFAC del query de Tránsito | Cerrada (decisión 13); campos `pendiente` |
| 12 | Vendedor Senior de facturación; “Vendedor” en Visor OV, Tránsito y Ofertas | Cerrada (decisión 14) |
| 13 | Que se pueda filtrar | Cerrada (decisión 15) |
| 14 | No la entendió | Reformulada abajo |
| 15 | Nada se cierra; solo es para visualizar | Cerrada (decisión 16) |

### Preguntas de seguimiento

Estado al 2026-11-11, después de recibir los queries Visor OV y Tránsito.

**A Daniela (solicitante):**

1. **Tránsito sin status ni tipo:** 12,8 M de entregas B2C abiertas no tienen Status entrega y 2,8 M no tienen Tipo OV. Propuesta: cuentan por defecto y aparecen como “(sin status)” y “(sin tipo)” en los filtros.
2. **Llenados:** ¿los Tipo OV 2 Llenado Stock, 10 Llenado Eventos y 11 Llenado Ferias cuentan como venta? (El Visor no lo dice: filtra en Excel.)
3. **Ofertas Tipo 15:** 2 ofertas B2C abiertas de tipo 15 Rebastecimiento Firplak Home (9,4 M). ¿Se excluyen como en OV y tránsito?
4. **Bloqueadas (pregunta 8):** el 72 % del saldo B2C de OV (330,5 M, 15 OV) está bloqueado. ¿Es normal en B2C (por ejemplo, hasta el pago)? ¿Se muestran por defecto y se pueden quitar con el filtro, o al revés?
5. **Tipo de ventas:** ¿“Excluido” también se excluye? (Hoy afecta 1 OV B2C de 17,1 M.) ¿Zona Franca cuenta?
6. **Canal por defecto:** ¿el tablero abre en B2C (Firplak Home + e-commerce) o en todos los canales? ¿Los marketplaces de Distribución (105-05, 105-06) cuentan como e-commerce?
7. **Fecha de despacho del tránsito:** `U_FechaDespacho` está llena en el 63 % de las líneas B2C. Propuesta: si está vacía, usar la fecha de la entrega.
8. **Vendedor “Firplak”:** 1.227 líneas de factura tienen como asesor el genérico “Firplak”. ¿Se muestra así o como “Sin asesor asignado”?
9. **Conciliación (pregunta 14 reformulada):** un reporte que hoy use y en el que confíe, por ejemplo la facturación de octubre de un vendedor.
10. **OV 165227 (R & U INGENIEROS SAS, 191,0 M, Claudia Granada):** es el 41 % de las OV B2C pendientes, con subgrupo e-commerce y Tipo OV Firplak.com. ¿Es una venta B2C real?
11. **Queries pendientes:** “Ofertas de venta” y “Facturación detallada” (Visor OV y Tránsito ya se recibieron).

**A Logística:**

12. ¿Qué valores de `Status` filtran en el Excel del Visor? ¿Las OV “Abierto NO AUTORIZADO” cuentan? (Hoy no hay ninguna en B2C; prioridad baja.)

**Tareas del desarrollador (TI es el mismo desarrollador, 2026-11-17):**

13. Definir cada cuánto corre el job (decisión 8), crear la tabla y el SP en `Planos_Symphony` y dar permiso de lectura a la API (decisión 4). Es el paso 4 de la ruta; no es una pregunta.

**A Contabilidad:**

14. ¿Los centros de costos inhabilitados `GV-BHMED` y `GV-BHCAL` equivalen a `GV-FHMED` y `GV-FHCAL`? (37,5 M de ofertas B2C los usan.) ¿Qué significa el valor `2` del campo `U_POD`?

**Internas (desarrollador):**

15. Confirmar si `SP_Generar_Informe_Ventas` aplica las mismas exclusiones que el query de facturas (serie 88, `VZNOPE-*`, solo impuesto, valor 0).

## Ruta (adaptada al portal)

1. Descubrimiento: scripts `01` a `03` y cuestionario. Hecho; respuestas el 2026-11-11.
2. Reglas firmadas: queries de Logística, scripts `04` a `07` y preguntas de seguimiento. Hecho salvo las preguntas abiertas.
3. SQL de B y C (primer entregable según la guía) con pruebas por `DocEntry` + `LineNum`: [`08-query-b-c.sql`](../../proyectos/consolidado-comercial/sql/08-query-b-c.sql), versión de validación, validada el 2026-11-11. Luego A: [`09-query-a.sql`](../../proyectos/consolidado-comercial/sql/09-query-a.sql), versión de validación. Hecho.
4. Objeto de reporte: [`sql/consolidado-comercial/01_informe_consolidado_comercial.sql`](../../sql/consolidado-comercial/01_informe_consolidado_comercial.sql) (2026-11-13). Hecho.
   - Tabla `Planos_Symphony.dbo.Informe_consolidado_comercial`, una fila por `Etapa` + `DocEntry` + `LineNum`, con A, B y C; D se une en el endpoint desde `Informe_ventas`.
   - SP `dbo.sp_Actualizar_Informe_consolidado_comercial`: recarga completa en una transacción (borra e inserta), bitácora y reglas de `08` y `09`. Nombres de Tipo OV, Status entrega y estado de oferta desde `@FIR_TIPOPEDIDOS` y `UFD1`. Columna `CentroCostosVigente` (`GV-BH*` → `GV-FH*`, `pendiente` Contabilidad) y `EnDefault`.
   - Índices: (`EnDefault`, `Etapa`) para los totales del tablero; (`SlpCode`, `Etapa`) para el filtro de asesor.
   - Bitácora: `dbo.Bitacora_Cargas_Informes` de la plantilla; `pendiente`: confirmar si TI prefiere reutilizar `dbo.Cargas_Log`.
   - Job: “BI - Consolidado comercial carga completa”, cada 30 min de 6:00 a 20:00, script [`02_job_consolidado_comercial.sql`](../../sql/consolidado-comercial/02_job_consolidado_comercial.sql). Creado y probado el 2026-11-17 (corrida manual 11:31, 4.219 filas, OK).
   - Script ejecutado y primera carga el 2026-11-17 11:11 por el desarrollador: 4.217 filas en menos de 1 s, bitácora `OK` (Id 1, `Bitacora_Cargas_Informes`).

     | Etapa | Líneas | Todos los canales | B2C | Líneas default | Saldo default |
     |---|---|---|---|---|---|
     | A_OFERTA | 1.351 | 3.763,6 M | 148,5 M | 121 | 148,5 M |
     | B_OV | 1.868 | 3.423,4 M | 499,7 M | 233 | 466,8 M |
     | C_TRANSITO | 998 | 570,0 M | 74,7 M | 75 | 59,7 M |

     Nombres de Tipo OV, Status entrega y estado de oferta: sin faltantes (0 en los tres controles).
   - Validación del 2026-11-17 (carga 11:16:21, seguida de la pestaña 1 de `09` y `08`): B y C cuadran exactos en líneas, todos los canales, B2C y default (B 1.868 líneas / 466,8 M default; C 995 / 59,7 M). A cuadra exacto en B2C y default (148,5 M, 121 líneas); en todos los canales `09` da 2 líneas y 153.030 más (fuera de B2C): son las 2 líneas de la oferta 7473 (Constructora Guasandi, 144.857,30 + 8.173,20), creada a las 11:17, después de la carga. **Tabla validada.**
   - Permiso de la API: no aplica; la API corre en el mismo servidor de la base de datos (confirmado por el desarrollador, 2026-11-17). **Paso 4 cerrado.**
5. Endpoint en la Reporting API: `GET /api/v1/consolidado-comercial`, rama `proyecto/consolidado-comercial` del repo `reporting-api` (2026-11-17, sin commit).
   - A, B y C de `Informe_consolidado_comercial`; D de `Informe_ventas` (`Empresa = 'Firplak'`, `SUM(ValorTotal)`, periodo por `FechaContabilizacion`; sin periodo, el mes en curso hasta hoy).
   - `vista=default` aplica `EnDefault` en A–C y, en D, Canal B2C + Firplak Home/Ecommerce + sin Donaciones. `vista=todo` quita esas reglas.
   - Filtros: canal, segmento, asesor (en D contra `VendedorSenior`), centro de costos vigente (mismo mapeo `GV-BH*` → `GV-FH*` en D), Tipo OV, Status entrega (solo C), estado de oferta y vigencia (solo A), bloqueo (solo B). Etapa y búsqueda solo filtran el detalle.
   - Respuesta: totales por etapa (monto, líneas, documentos), total A+B+C+D, desgloses por asesor, segmento y centro de costos, detalle paginado de A–C, catálogos y hora de la última carga.
   - El canal y el segmento de D se homologan con los nombres de la tabla; `SubgrupoCliente` se acepta como código o nombre. **Formato confirmado el 2026-11-18** (pestaña 1 de [`12-validacion-endpoint.sql`](../../proyectos/consolidado-comercial/sql/12-validacion-endpoint.sql)): trae el nombre (`Firplak Home` 294 líneas / 131.483.272,68; `e-commerce` 46 / 37.427.692,22; `MAC` 26 / 4.016.582,80, mes en curso, Canal B2C); se homologa con la columna `Subgrupo` de la tabla.
   - Cuadrado contra las pestañas 2 y 3 de `12` el 2026-11-18 (ver paso 6).
   - Desplegado en el servidor el 2026-11-18 por el desarrollador (paquete con `dist/` compilado y dependencias de producción; el `.env` del servidor no se toca). Sin commit en `reporting-api`.
6. Dashboard en el portal (2026-11-18, rama `proyecto/consolidado-comercial`, sin commit). Funciona con datos reales.
   - Informe `consolidado-comercial` en [`lib/reports.ts`](../../lib/reports.ts) (área Ventas). Nadie lo ve hasta que un administrador lo asigna en `/admin/permisos`: `pendiente` dar acceso a la solicitante.
   - `/consolidado-comercial` ([`ConsolidadoComercialDashboard.tsx`](../../components/ConsolidadoComercialDashboard.tsx)): tarjetas A, B, C, D y total (monto, documentos y líneas); composición del total por etapa; desglose por asesor, segmento y centro de costos con pestañas (10 primeros, “Ver todos”).
   - `/consolidado-comercial/detalle`: líneas abiertas de A–C con pestañas por etapa (conteo de líneas de cada etapa), búsqueda, paginación de 50 y panel lateral con los campos de la línea (incluye `DocEntry` y `LineNum` para conciliar).
   - Filtros: año y mes de la facturación (D; por defecto el mes en curso), vista (acordada B2C o todos los canales) y, en filtros avanzados, canal, segmento, asesor, centro de costos, Tipo OV, bloqueo, Status entrega, estado y vigencia de la oferta. Todos viajan a la API y se aplican con el botón.
   - El detalle de D no está en este dashboard: el endpoint solo devuelve las líneas de A–C.
   - Validación: `tsc`, ESLint y `next build` sin errores. Probado por el desarrollador con `npm run dev` y datos reales el 2026-11-18: carga bien. **Cuadre contra SQL el 2026-11-18** (carga 10:30:01, pestañas 2 y 3 de `12`): A 143,32 M / 44 doc / 117 líneas, B 483,00 M / 60 / 216, C 41,21 M / 34 / 97, D 168,91 M / 162 / 340, total 836,43 M; el dashboard muestra lo mismo. Endpoint y dashboard validados.
7. Conciliación contra SAP y despliegue. ← actual
