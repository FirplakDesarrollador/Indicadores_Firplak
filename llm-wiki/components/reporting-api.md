---
status: active
updated: 2026-10-23
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

Parámetros: `page`, `pageSize`, `fechaDesde`, `fechaHasta`, `anio`, `mes`, `zona`, `grupoCliente` y `search`.

Respuestas principales:

- `200`: filas, paginación y resúmenes.
- `401`: token ausente o inválido.
- `502`: error consultando SQL Server.
- `503`: configuración incompleta.

## Configuración SQL

```env
REPORT_DB_SERVER=localhost
REPORT_DB_NAME=Planos_Symphony
REPORT_DB_TABLE_SCHEMA=dbo
REPORT_DB_TABLE=Informe_ventas
REPORT_DB_REQUEST_TIMEOUT_MS=60000
REPORTING_API_TOKEN=<secreto>
```

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
