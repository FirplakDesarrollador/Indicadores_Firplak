---
status: active
updated: 2026-11-11
sources:
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/server.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/db.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/package.json
  - https://github.com/Firplak/firplak-reporting-api/blob/main/.env.example
---

# Reporting API

## Responsabilidad

Servicio Node.js que permanece cerca de SQL Server. Valida el token compartido, transforma columnas de `Informe_ventas`, aplica filtros y devuelve una página más agregados.

## Endpoints

### `GET /health`

No requiere Bearer token. Devuelve el estado del servicio.

### `GET /api/v1/facturacion-diaria`

Requiere:

```http
Authorization: Bearer <REPORTING_API_TOKEN>
```

Parámetros: `page`, `pageSize`, `fechaDesde`, `fechaHasta`, `anio`, `mes`, `zona`, `grupoCliente`, `mercado` (`TipoVentas`), `ciudad` (`Ciudad`), `cliente` (`CodCliente`), `subgrupoCliente` (`SubgrupoCliente`), `empresa` (`Firplak` | `Viventta` | `CEFI`, regla en `companySql`) y `search`. Los dos últimos, desde la rama `feat/facturacion-metas-empresa` ([Facturación diaria](../bi/facturacion-diaria.md#reporting-api), despliegue `pendiente`).

La respuesta incluye `filterOptions` (`markets`, `cities`, `zones`, `customerGroups` y `customers` con `code`/`name`): los valores distintos del periodo, calculados solo con los filtros de fecha para que las listas no se reduzcan; la excepción es `cities`, que con `zona` activa solo trae las ciudades de esa zona. `cityZones` trae las parejas zona-ciudad del periodo sin limitar por zona. Disponible desde la rama `fix/filtros-mercado-ciudad` de la API (`pendiente` de despliegue).

Respuestas principales:

- `200`: filas, paginación y resúmenes.
- `401`: token ausente o inválido.
- `502`: error consultando SQL Server.
- `503`: configuración incompleta.

### `GET /api/v1/entregas`

Consulta `Planos_Symphony.dbo.Informe_entregas` y requiere el mismo Bearer token. Acepta paginación y filtros por `fechaDesde`, `fechaHasta`, `anio`, `mes`, `estadoEntrega`, `estadoItem`, `cancelado`, `grupoCliente`, `cliente` (`CodCliente`), `subgrupoCliente`, `empresa` y `search`. La tabla no tiene mercado, zona ni ciudad. Desde la rama `feat/facturacion-metas-empresa` incluye devoluciones y NC de devolución en negativo y totales `delivered`/`returns`/`net` sin anulados ([Facturación diaria](../bi/facturacion-diaria.md#entregas-con-devoluciones); despliegue `pendiente`).

La respuesta incluye el detalle de entregas, los años disponibles y resúmenes diarios/mensuales con `Cantidad`, `CantidadFacturada` y `ValorSinIVA`. Con el script `01_informe_entregas_devoluciones.sql` la clave pasa de `(DocEntry, LineNum)` a `(Empresa, TipoMovimiento, DocEntry, LineNum)`; `FechaEntrega` sigue siendo la fecha principal.

### `GET /api/v1/notas-credito`

Agregado en la rama `bi/notas-credito` y desplegado en el servidor el 2026-10-27 (el servicio escucha en `127.0.0.1:8090`). Consulta `Informe_ventas` (`REPORT_DB_TABLE`) con el mismo Bearer token. Firplak y Viventta van juntas. Las notas son `TipoDocumento = 'Nota Crédito'` y el denominador, `TipoDocumento = 'Factura'`, filtrado por periodo, `tipoVentas` y `vendedorSenior`.

- Filtros: `fechaDesde`, `fechaHasta`, `anio`, `mes`, `tipoVentas`, `departamento`, `concepto`, `tipoNc`, `vendedorSenior` y `search`.
- Respuesta: detalle por documento, totales, % de notas sobre la facturación, meta del 3 %, serie mensual con el % del año anterior y totales por departamento, concepto, tipo NC agrupado y vendedor.
- Código: `getCreditNoteReport` en `src/db.ts` y `creditNoteFiltersFrom` en `src/server.ts`.
- Reglas: [ficha de Notas crédito](../bi/notas-credito.md#3-contrato-del-endpoint).

### `GET /api/v1/costo-actual-pt` y `/api/v1/costo-actual-pt/export`

Agregados en la rama `bi/costo-actual-pt` (commit `a28da32`, creada desde `bi/notas-credito-2`). Despliegue `pendiente`. Consultan `Informe_costo_pt` (`REPORT_COSTO_PT_TABLE`), que el SP `sp_Actualizar_Informe_costo_pt` recalcula cada hora. Mismo Bearer token.

- Principal: `codigo`, `search` y `alerta`. Sin periodo ni paginación: devuelve la lista de materiales completa del producto (tope de 5.000 líneas), el resumen de costos y alertas, los productos que coinciden con la búsqueda y `loadedAt`.
- Descarga: libro de Excel `.xlsx` generado por `src/xlsx.ts` (sin dependencias; números como números, códigos como texto), en streaming con `request.toReadableStream()` de `mssql` y contrapresión. Con `codigo`, un producto; sin él, todos. Usa un pool aparte con `REPORT_DB_EXPORT_TIMEOUT_MS` (10 min por defecto).
- Código: `getProductCostReport`, `getProductCostExportInfo` y `openProductCostExport` en `src/db.ts`; `productCostFiltersFrom` y `sendProductCostExport` en `src/server.ts`.
- Reglas: [ficha de Costo actual de PT](../bi/costo-actual-pt.md#3-contrato-del-endpoint).

### `GET /api/v1/facturacion-diaria/export` y `/api/v1/entregas/export`

Agregados el 2026-11-11 en la rama `feat/facturacion-metas-empresa`. Despliegue `pendiente`; no se probaron contra SQL Server porque no hay `.env` local de la API.

- Mismos filtros que `GET /api/v1/facturacion-diaria` y `GET /api/v1/entregas` (`addFilters` y `addDeliveryFilters`), sin paginación: descargan todas las filas filtradas en un `.xlsx`.
- Facturas: **todas las columnas de `Informe_ventas`** en el orden de la tabla (pedido del desarrollador, 2026-11-11), menos los campos internos de SAP (`DocEntry`, `LineNum` y, si existieran, `VisOrder`, `ObjType`, `BaseEntry`, `BaseType`, `BaseLine`, `TransId`, `LogInstanc`, `UserSign`, `UserSign2`), que se confunden con el número de documento. Se leen con `SELECT TOP (0) *` en cada descarga, así que una columna nueva aparece sin cambiar el código. Al final van las calculadas del portal: Empresa (portal, con CEFI), Facturado, NC y Neto (misma regla de nota crédito que los totales).
- Entregas: todas las columnas de la línea, con cantidades, `ValorSinIVA` y fechas.
- El tipo SQL de cada columna decide la celda: enteros y `bit` como enteros, `decimal`/`numeric`/`money`/`float` como números, `date` como fecha y `datetime*` como fecha y hora; el resto como texto.
- Los números salen de SQL como texto con punto decimal (`CONVERT(varchar(60), decimal(38, 6))`) y se escriben como celdas numéricas con formato `#,##0.00`. Las fechas se escriben como fecha de Excel (`yyyy-mm-dd`, tipo `date` agregado a `src/xlsx.ts`).
- Código: `openBillingExport` (con `exportColumnFor`), `openDeliveryExport` y `deliveryExportColumns` en `src/db.ts`; `exportRoutes` y `streamXlsx` en `src/server.ts`.

## Configuración SQL

```env
REPORT_DB_SERVER=localhost
REPORT_DB_NAME=Planos_Symphony
REPORT_DB_TABLE_SCHEMA=dbo
REPORT_DB_TABLE=Informe_ventas
REPORT_DB_REQUEST_TIMEOUT_MS=60000
REPORTING_API_TOKEN=<secreto>
```

La tabla de entregas se configura con `REPORT_DELIVERIES_TABLE_SCHEMA=dbo` y `REPORT_DELIVERIES_TABLE=Informe_entregas`.

La tabla de costo de PT se configura con `REPORT_COSTO_PT_TABLE_SCHEMA=dbo` y `REPORT_COSTO_PT_TABLE=Informe_costo_pt`. Las descargas usan `REPORT_DB_EXPORT_TIMEOUT_MS=600000`.

El contrato SQL vigente usa `FechaContabilizacion`, `DocNum` y `TipoVentas` para fecha, documento y canal, respectivamente.

La fuente SQL efectiva es la tabla `[Planos_Symphony].[dbo].[Informe_ventas]`; no se usa una vista heredada.

## Ejecución

```powershell
npm install
npm run build
npm run start
```

Fuente SQL efectiva: la API usa `REPORT_DB_TABLE` con esquema `REPORT_DB_TABLE_SCHEMA`; no hace fallback a una vista heredada. Para este proyecto la fuente esperada es `[Planos_Symphony].[dbo].[Informe_ventas]`, con `FechaContabilizacion`, `DocNum` y `TipoVentas`.

El servicio ejecuta `dist/server.js`. Después de modificar `src/`, siempre hay que recompilar antes de reiniciar el servicio.
