---
status: active
updated: 2026-11-11
sources:
  - ../../components/FacturacionDashboard.tsx
  - ../../components/EntregasDetalleDashboard.tsx
  - ../../components/MetasComercialesDashboard.tsx
  - ../../lib/metas/calendar.ts
  - ../../lib/metas/targets.ts
  - ../../supabase/migrations/20261109_metas_comerciales.sql
  - ../../supabase/migrations/20261109_metas_nacional_exterior.sql
  - ../../sql/facturacion-diaria/01_informe_entregas_devoluciones.sql
  - ../../../reporting-api/src/db.ts
---

# Facturación diaria: metas, empresas y entregas

Cambios pedidos por el desarrollador (Daniel Jimenez) el 2026-11-09 sobre `/facturacion-diaria`. Rama `feat/facturacion-metas-empresa` en el portal y en la Reporting API.

## Decisiones (2026-11-09)

| # | Pedido | Decisión |
|---|---|---|
| 1 | Pantalla para poner metas de facturación y de entregas por mes | `/metas-comerciales`, informe `metas-comerciales` del catálogo, marcado `tool`: no tiene card en el portal ni botón en facturación; se abre desde el menú del perfil, junto a "Permisos de informes", solo para quien tiene el permiso (ajuste del desarrollador, 2026-11-09). Una meta de facturación y una de entregas por **mes y empresa** (Firplak, Viventta, CEFI). Con "Todas las empresas" se suman. Se guardan en Supabase. |
| 2 | Días laborales para sacar la meta diaria | Por mes. El portal propone **lunes a viernes menos festivos de Colombia** ([`calendar.ts`](../../lib/metas/calendar.ts)) y quien edita puede corregirlos. Meta diaria = meta mensual / días laborales. |
| 3 | Filtro Empresa | Viventta sale de la columna `Empresa` (la separan las consultas de carga). Del resto, todo centro de costos que contenga `CEFI` es CEFI y lo demás es Firplak (`companySql` en la API). |
| 4.1 | Cards de ventas | 3 cards: **Ventas netas** = facturación − NC; **Meta** (antes "Ventas acumuladas (meta)") = meta mensual / días laborales × días laborales transcurridos a la fecha; **Cumplimiento de facturación** = ventas netas / meta acumulada a la fecha. |
| 4.2 | Cards de entregas | **Entregas netas**, **Meta** y **Cumplimiento de entregas**, con la misma regla. |
| 5 | Ventas por zona | Botón "Ver todas (n)" / "Ver principales" (5 por defecto). |
| 6 | Gráfica de acumulados | Una sola gráfica (desde 2026-11-11) con ventas netas (navy) y entregas netas (ocre) acumuladas, líneas continuas hasta la fecha de corte, y una sola meta acumulada punteada (gris salvia), porque la meta es la misma para ambas. |
| 7 | Detalle de entregas | `/facturacion-diaria/entregas`: líneas paginadas con filtros (periodo, mes, búsqueda, empresa, subgrupo, grupo) y panel lateral. |
| 8 | Devoluciones y NC de devoluciones en entregas | Nuevo `SP_Generar_Informe_Entregas` ([script](../../sql/facturacion-diaria/01_informe_entregas_devoluciones.sql)); ver [Entregas con devoluciones](#entregas-con-devoluciones). Ejecución `pendiente`. |
| 9 | Quitar Cliente, agregar Subgrupo de cliente (después de Grupo de cliente) | `SubgrupoCliente` en `Informe_ventas` y, con el punto 8, en `Informe_entregas`. Parámetro `subgrupoCliente` en los dos endpoints. |

## Metas por segmento (Nacional / Exterior)

Decisión del desarrollador (2026-11-09): la meta de Firplak se divide en **Firplak Nacional** y **Firplak Exterior**, en facturación y en entregas. Las metas se registran por segmento: Firplak Nacional, Firplak Exterior, Viventta y CEFI (`commercial_targets.company`, migración [`20261109_metas_nacional_exterior.sql`](../../supabase/migrations/20261109_metas_nacional_exterior.sql); las metas ya guardadas como `Firplak` pasan a Firplak Nacional). El 2026-11-10 CEFI se dividió igual, en **CEFI Nacional** y **CEFI Exterior** (migración [`20261110_metas_cefi_mercado.sql`](../../supabase/migrations/20261110_metas_cefi_mercado.sql); las metas guardadas como `CEFI` pasan a CEFI Nacional).

Meta que se compara según los filtros (`segmentsFor` en [`targets.ts`](../../lib/metas/targets.ts)):

| Filtro | Meta |
|---|---|
| Empresa CEFI | CEFI Nacional + CEFI Exterior; con un mercado, solo el de ese mercado |
| Mercado Nacional | Firplak Nacional + Viventta (en entregas, solo Firplak Nacional) |
| Mercado Exterior | Solo Firplak Exterior |
| Otro mercado | Sin meta |
| Empresa Firplak / Viventta | Sus segmentos, combinados con el mercado (intersección) |
| Mercado sin empresa | CEFI no cuenta, ni en datos ni en meta |
| Sin filtros | Los cinco segmentos |

- **Datos alineados con la meta** (decisión del desarrollador, 2026-11-09; ajustada el 2026-11-10): con un mercado elegido y sin empresa, la API excluye CEFI de facturación y de entregas. Con una empresa elegida, el mercado se aplica a esa empresa; CEFI vende en Nacional y en Exterior, así que CEFI + mercado filtra por `TipoVentas`.
- Para comparar entregas por mercado, `Informe_entregas` tiene `TipoVentas`: `U_TipoVentas` del encabezado en Firplak (como en `Informe_ventas`) (Viventta no carga entregas). `GET /api/v1/entregas` acepta `mercado`.

## Una sola meta y gráficas acumuladas (2026-11-09)

- **Una sola meta:** el negocio confirmó que la meta de ventas y la de entregas son la misma. La pantalla de metas tiene una sola tabla. Al guardar se escribe el mismo valor en `billing_target` y `delivery_target`, y el portal usa `billing_target` para las dos (`buildTargetSeries`).
- **Gráficas acumuladas** ([`CumulativeChart.tsx`](../../components/dashboard/CumulativeChart.tsx)): desde 2026-11-11 es una sola gráfica con ventas netas (navy, `chartColors.primary`) y entregas netas (ocre, `chartColors.delivery`), y una sola línea de meta acumulada punteada, porque la meta es la misma para ambas. Solo se dibujan los días laborales (lunes a viernes sin festivos). Lo de sábados, domingos y festivos sí suma al acumulado y se ve en el siguiente día laboral (`buildCumulativeData`).

## Reglas de cálculo

- **Fecha de corte:** hoy (fecha del navegador) si cae dentro del periodo; el último día del periodo si ya pasó. Hoy cuenta como día transcurrido.
- **Periodo de un año** (mes "Todos"): la meta acumulada suma mes a mes. Con "Todos los años" no hay metas.
- **Días guardados distintos de los calculados:** en cada mes el acumulado no supera la meta mensual (`buildTargetSeries`). Si se guardan más días que los calculados, el acumulado de fin de mes queda por debajo de la meta, porque los días extra no tienen fecha.
- **Entregas netas** = entregas − devoluciones − NC de devolución, en `ValorSinIVA` y **sin documentos anulados** (`Cancelado = 'Y'`). Antes de este cambio la API sumaba también las entregas anuladas. Con la API anterior, `deliveryNet()` cae en `valueWithoutVat` (entregas brutas).
- La tabla de resumen diario reemplaza las columnas fijas "Meta Nacional" y "Meta Firplak" (valores escritos en el código hasta abril de 2026) por "Meta día" y "Meta acumulada" de facturación.

## Almacenamiento y permisos

Migración [`20261109_metas_comerciales.sql`](../../supabase/migrations/20261109_metas_comerciales.sql):

- `commercial_targets` (`year`, `month`, `company`, `billing_target`, `delivery_target`) y `commercial_working_days` (`year`, `month`, `working_days`).
- `save_commercial_targets(p_year, p_months)` guarda el año en una transacción. Es `security invoker`: aplica la RLS.
- RLS con `has_report_access(slug)`: leen quienes ven `facturacion-diaria` o `metas-comerciales`; escriben los de `metas-comerciales` y los administradores.
- `commercial_targets_audit`: valor anterior, valor nuevo, autor y fecha de cada cambio, escrito por trigger. Un guardado sin cambios no deja rastro.
- Probado en PGlite (2026-11-09): el editor guarda, el lector solo lee y su `UPDATE` directo no afecta filas, un usuario sin permiso no ve filas, el historial no se puede escribir desde el navegador y los días fuera de 1–31 se rechazan.

## Entregas con devoluciones

`SP_Generar_Informe_Entregas` compartido por el desarrollador el 2026-11-09 (antes solo cargaba entregas de Firplak desde `ODLN`/`DLN1`). Cambios del [script](../../sql/facturacion-diaria/01_informe_entregas_devoluciones.sql):

| Tema | Regla |
|---|---|
| `TipoMovimiento` | `Entrega` (`ODLN`/`DLN1`), `Devolución` (`ORDN`/`RDN1`) y `Nota crédito devolución` (`ORIN`/`RIN1` con `U_TIPOSNC = '01'`, decisión del desarrollador del 2026-11-10). |
| Doble conteo | No se cargan las líneas de NC con `BaseType = 16` (basadas en una devolución): esa mercancía ya está en `ORDN`. Validación 4.3 del script. |
| Signo | Devoluciones y NC con `Cantidad` y `ValorSinIVA` negativos: `SUM(ValorSinIVA)` da el neto. |
| `Empresa` | Solo `Firplak` (`Firplak_SA`). Viventta queda fuera por decisión del desarrollador (2026-11-10): en 2026 no tiene entregas en `DBViventta.ODLN` porque factura directo. En el portal, la meta de entregas no suma la meta de Viventta. |
| CEFI | Por `CentroCostos` (`CogsOcrCod` de la línea en entregas; en `Informe_ventas` viene del cliente o del punto de venta). Validación 4.4 del script. |
| `SubgrupoCliente` | `[@FIR_SUBGRUPOCLIENTE].Name` por `OCRD.U_SUBGROUPCODE` |
| `DocumentoBase` | `BaseRef` de devoluciones y NC (entrega o factura de origen). |
| Clave | `PK_Informe_entregas_Mov` (`Empresa`, `TipoMovimiento`, `DocEntry`, `LineNum`), más `IX_Informe_entregas_Fecha`. |
| Incremental | Igual que antes, por tipo y empresa. Las NC modificadas se borran aunque hayan dejado de ser de devolución, y solo se recargan las que lo siguen siendo. `#Docs` y `#Facturas` usan `COLLATE DATABASE_DEFAULT`: sin eso, la incremental fallaba con el error 468 (2026-11-10). |
| Devoluciones sin documento base | En 2026 son 446 líneas por $6.823 M, el 74 % del valor devuelto. `pendiente`: confirmar si deben restar de las entregas netas. |

**Riesgo:** cualquier otro consumidor de `Informe_entregas` verá filas nuevas en negativo. Para conservar el resultado anterior debe filtrar `TipoMovimiento = 'Entrega' AND Empresa = 'Firplak'`.

## Reporting API

`GET /api/v1/facturacion-diaria` acepta `empresa` (`Firplak` | `Viventta` | `CEFI`) y `subgrupoCliente`. Las filas traen `company` y `customerSubgroup`; `summary.daily` trae `net`; `filterOptions` agrega `customerSubgroups` y `companies`. Se conserva `cliente` y `filterOptions.customers` por compatibilidad con el portal anterior.

`GET /api/v1/entregas` acepta `empresa` y `subgrupoCliente`. Las filas traen `company`, `movementType`, `customerSubgroup` y `baseDocument`; los resúmenes (total, diario y mensual) traen `delivered`, `returns`, `net` y `valueWithoutVat = net`, todos sin anulados; `filterOptions` trae grupos, subgrupos y empresas del periodo. Necesita las columnas nuevas: se despliega **después** de ejecutar el script SQL.

## Pendientes

- Confirmado por el desarrollador (2026-11-09): la columna de `Informe_ventas` se llama `CentroCostos`.
- Validado (2026-11-10): las devoluciones basadas en una entrega facturada suman solo $27,7 M en 2026, así que el doble conteo con las NC es mínimo. Viventta no tiene entregas en 2026.
- `pendiente`: despliegue. Orden: 1) migración en Supabase, 2) script SQL de entregas y carga `COMPLETA`, 3) API, 4) portal. Dar el informe `metas-comerciales` al cargo que edita las metas en `/admin/permisos`.
- Rollback: el bloque comentado al final de la migración (borra las metas), el rollback del script SQL y volver a desplegar la API y el portal anteriores.

## Tabla de resumen diario (2026-11-11)

Orden de columnas vigente (2026-11-11): Día (columna fija al desplazar), Año, Mes, Entr día, Entr mes, Fac día neta, Meta día, Fac mes neta, Meta mes, Diferencia, Fac día bruta, Total NC. **Diferencia** = Fac mes neta − Meta mes de ese día (negativa en rojo: por debajo de la meta). Antes (2026-11-11, primera versión): Año, Mes, Día, …, Meta acumulada, Total NC, Fac día bruta. "Fac mes neta" es el acumulado mensual de facturación − NC (antes acumulaba la facturación bruta). Fuente: [`FacturacionDashboard.tsx`](../../components/FacturacionDashboard.tsx).

## Filtros, "Hasta ayer" y diferencia en la gráfica (2026-11-11)

- **Barra de filtros compacta y fija** (decisión del desarrollador): Año, Mes, Empresa y Mercado siempre visibles, con los botones Más filtros, Hasta ayer y Limpiar encima; la búsqueda, Grupo, Subgrupo, Zona y Ciudad en "Más filtros". Desde 768 px de ancho la barra queda fija bajo la barra superior al desplazarse. **Los filtros se aplican al elegirlos**; solo la búsqueda espera Enter o la lupa.
- **Tarjetas compactas**: ícono al lado del texto y las 6 en una fila cuando el contenido mide 1240 px o más.
- **Hasta ayer** (decisión del desarrollador: corta meta y real): el corte pasa a ser el día anterior a hoy y se aplica a **toda la página**: las consultas a facturación y entregas llevan `fechaHasta` = ayer, así que tarjetas, gráficas, zonas, evolución diaria y tabla diaria quedan hasta ese día, y la meta acumulada también se corta ahí.
- Filtros que no pueden aplicar a todo por falta de datos: Zona y Ciudad no existen en `Informe_entregas` (las entregas no se filtran por ellas; la pantalla lo avisa), y las metas solo existen por empresa y mercado (Grupo, Subgrupo, Zona, Ciudad y búsqueda no cambian la meta).
- **Recuadro de la gráfica de acumulados**: además de cada línea muestra "Diferencia facturación neta vs. meta" del día (ventas netas acumuladas − meta acumulada), sin dibujarla como línea (`tooltipExtras` en [`CumulativeChart.tsx`](../../components/dashboard/CumulativeChart.tsx)).
