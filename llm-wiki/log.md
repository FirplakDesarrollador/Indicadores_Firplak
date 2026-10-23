# Registro de mantenimiento

## [2026-10-23] fix | Fuente SQL de informes

## [2026-10-23] fix | Contrato vigente de `Informe_ventas`

## [2026-10-23] ux | Importes en millones

## [2026-10-23] fix | Catálogo completo de años

## [2026-10-23] ux | Tabla de resumen diario

## [2026-10-23] ux | Tabla compacta y periodo inicial

- La distribución de facturación neta por zona se limita a las cinco primeras zonas; el resumen diario conserva todas las fechas del periodo.
- El año y mes iniciales, y los valores de `Limpiar`, usan el periodo actual del navegador.
- Se añadieron estilos para acciones de la tabla y se verificaron las compilaciones del frontend y la API.

- Se agregó una tabla de facturación diaria con facturación del día, acumulado mensual, notas crédito, neto y metas Nacional/Firplak.
- Se excluyeron `Ent día` y `Ent Mes` hasta que exista el endpoint de entregas.
- Las metas de enero a abril de 2026 se tomaron del bloque DAX compartido; los meses no definidos quedan pendientes de una fuente persistente.

- La API ahora devuelve `years` mediante una consulta `DISTINCT YEAR(FechaContabilizacion)` independiente de la paginación.
- El frontend usa ese catálogo para el filtro de periodo y deja de inferir años solo desde las 50 filas visibles.
- Se verificaron las compilaciones de `reporting-api` y del frontend.

- `components/FacturacionDashboard.tsx` ahora muestra los importes iguales o superiores a un millÃ³n con el sufijo `M`.
- Un valor de miles de millones se expresa como su equivalente en millones; por ejemplo, `5.100.000.000` se muestra como `$5,100.0M`.
- Se verificÃ³ el frontend con `npm run build`.

- La tabla vigente tiene 46 columnas y usa `FechaContabilizacion`, `DocNum` y `TipoVentas` en lugar de `DOCDATE`, `DOCNUM` y `U_TipoVentas`.
- Se actualizaron los filtros, la paginaciÃ³n, el ordenamiento y el mapeo del canal en `reporting-api/src/db.ts`.
- Se verificÃ³ nuevamente la compilaciÃ³n local con `npm run build`.

- Se eliminó el fallback de `reporting-api/src/db.ts` a una vista heredada.
- La API usa `REPORT_DB_NAME`, `REPORT_DB_TABLE_SCHEMA` y `REPORT_DB_TABLE`; por defecto, el esquema es `dbo` y la tabla es `Informe_ventas`.
- Se verificó la compilación local con `npm run build`.

Este archivo es cronológico y append-only. Cada entrada registra una ingesta, consulta relevante o revisión de salud de la wiki.

## [2026-10-22] ingest | Repositorio inicial

- Se documentó el frontend Next.js, la autenticación con Supabase/Azure y el proxy server-side.
- Se documentó `reporting-api` como servicio Node.js independiente junto a SQL Server.
- Se confirmó la tabla `Planos_Symphony.dbo.Informe_ventas` y su contrato de columnas.
- Se registró la decisión de consultar una tabla de reportes preparada para evitar recalcular una vista grande.
- Fuentes principales: `README.md`, `package.json`, `app/`, `components/`, `reporting-api/src/`.

## [2026-10-22] ingest | Código completo y conversaciones

- Se inventariaron todas las rutas de código, configuración, documentación y assets del repositorio.
- Se excluyeron secretos, dependencias, builds y el ZIP duplicado; sus motivos quedaron documentados.
- Se incorporó una síntesis trazable de las conversaciones sobre NAT, DNS, autenticación, diseño, rendimiento, tabla SQL y despliegue.
- Se enlazó la nueva ingesta desde `index.md`.

## [2026-10-23] fix | Filtro mensual de `Informe_ventas`

- Se corrigió un predicado heredado que todavía usaba `[Fecha contabilizacion]` cuando la tabla real usa `[DOCDATE]`.
- La API debe recompilarse y reiniciarse en el servidor antes de validar el cambio.

## [2026-10-23] diagnóstico | Fuente SQL efectiva

- Se añadió un log seguro que muestra la base, esquema y tabla/vista que la API está consultando, sin imprimir credenciales ni filtros de búsqueda.
- Esto permite distinguir una configuración `.env` correcta de un proceso que ejecuta otro `dist/` o inicia desde otra carpeta.
- El arranque también informa el directorio de trabajo, porque `dotenv` busca `.env` relativo al proceso iniciado.
