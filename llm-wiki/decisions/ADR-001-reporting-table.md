---
status: accepted
updated: 2026-10-23
sources:
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/db.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/.env.example
---

# ADR-001: consultar una tabla de reportes

## Contexto

La vista original podía tardar demasiado al calcular filas, paginación y agregados sobre un volumen grande. El frontend terminó solicitando páginas pequeñas, pero los totales seguían requiriendo recorrer todos los registros coincidentes.

## Decisión

La Reporting API consulta `Planos_Symphony.dbo.Informe_ventas`, una tabla de reportes alimentada por un proceso periódico. La fuente se configura mediante `REPORT_DB_TABLE_SCHEMA` y `REPORT_DB_TABLE`.

## Consecuencias

Positivas:

- Consultas más predecibles y aptas para índices.
- Menor dependencia de la carga de SAP durante la consulta.
- Posibilidad de preparar columnas y agregados para el dashboard.

Costes:

- Los datos tienen la latencia del proceso de actualización.
- El SP y la tabla se vuelven dependencias operativas.
- Cambios de columnas requieren actualizar el mapeo de `src/db.ts`.

## Validación pendiente

Medir el tiempo de `GET /api/v1/facturacion-diaria?page=1&pageSize=50` con y sin filtros y revisar índices sobre `FechaContabilizacion`, `Zona`, `GrupoCliente` y las claves de búsqueda.
