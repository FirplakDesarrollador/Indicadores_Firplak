# Registro de mantenimiento

## [2026-10-26] ux | Resumen diario compacto

- El resumen diario muestra inicialmente solo los 7 registros más recientes.
- Se agregó el botón `Ver todos los días` para expandir la tabla y `Mostrar menos` para volver a compactarla.

## [2026-10-26] ux | Limpieza de navegación y acciones

- Se eliminó el selector de espacio de trabajo del lateral.
- Se retiraron `Notas crédito`, `Comparativos`, el estado de conexión SQL Server y `Exportar`.
- Se conservan `Filtros`, `Facturación` y `Detalle de documentos` como acciones principales.

## [2026-10-26] fix | Ocultar detalle en vista principal

- Se corrigió el selector CSS para que la tabla operativa solo se muestre en `/facturacion-diaria/detalle`.
- La página principal `/facturacion-diaria` conserva cards, acumulados y análisis sin renderizar visualmente el detalle de facturas.

## [2026-10-26] fix | Respuestas JSON para APIs protegidas

- El middleware ahora devuelve `401` en JSON para llamadas no autenticadas a `/api/*`, en lugar de redirigirlas a HTML.
- El dashboard valida `Content-Type` antes de ejecutar `response.json()` y distingue sesión expirada de respuesta inválida.
- Validación: lint, build y diagnóstico sin exponer secretos ni respuestas completas.

## [2026-10-26] ux | Filtro de mercado

- El filtro `Canal` se renombró a `Mercado`.
- El selector muestra siempre `Nacional` e `Internacional`.
- El valor seleccionado sigue comparándose contra `row.channel` para filtrar las filas visibles.

## [2026-10-26] ux | Filtros avanzados de documentos

- Se agregó un panel responsive con Cliente, Grupo de cliente, Canal, Zona y Ciudad.
- Se reorganizó la barra principal para mantener periodo, mes, búsqueda y limpiar separados de los criterios avanzados.
- Zona y Grupo de cliente conservan el filtrado server-side existente; Cliente, Canal y Ciudad refinan las filas cargadas.
- Se verificó el frontend con `npm run lint` y `npm run build`.

## [2026-10-26] ux | Resumen diario descendente

- La tabla de facturación y entregas ahora muestra primero la fecha más reciente y continúa hacia atrás.
- Los acumulados mensuales se calculan en orden cronológico y solo se invierte el resultado visual.

## [2026-10-26] ux | Página independiente para detalle de documentos

- Se agregó la ruta `/facturacion-diaria/detalle` para mostrar únicamente el detalle paginado de documentos.
- La vista principal ya no muestra la tabla operativa; el menú lateral enlaza directamente a la nueva página.
- La nueva vista reutiliza los filtros, exportación, paginación y drawer de detalle existentes.

## [2026-10-26] ux | Orden y acceso al detalle de facturas

- La tabla de acumulados se muestra inmediatamente después de las cards de KPIs mediante el orden visual del contenedor principal.
- `Detalle de documentos` en el menú lateral ahora desplaza hasta la tabla operativa de facturas y cierra el menú en pantallas móviles.
- Se verificó el cambio con el lint y el build del frontend.

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

## [2026-10-26] feat | Integración frontend de entregas

- Se agregó el proxy server-side `app/api/entregas/route.ts`.
- El dashboard solicita facturación y entregas en paralelo y muestra `Ent día` y `Ent mes total` en el resumen diario.
- Los valores de entrega se toman de `summary.daily[].valueWithoutVat` y se acumulan por mes en el frontend.
- Se validó el build de Next.js con `npm run build`.

## [2026-10-26] feat | Endpoint de entregas

- Se confirmó la tabla `Planos_Symphony.dbo.Informe_entregas`, con clave `(DocEntry, LineNum)` e índice por `FechaEntrega`.
- Se agregó `GET /api/v1/entregas` al repositorio separado de la API.
- El endpoint implementa paginación, filtros por fecha/estado/búsqueda y agregados diarios/mensuales de cantidades y `ValorSinIVA`.
- Se verificó la compilación de la API con `npm run build`; la consulta contra SQL Server queda pendiente de validación en el servidor con el `.env` real.

## [2026-10-23] arquitectura | Separación de repositorios

- Se creó el repositorio independiente [Firplak Reporting API](https://github.com/Firplak/firplak-reporting-api).
- Se publicó la API con historial derivado de `reporting-api/` mediante `git subtree split`; el repositorio nuevo contiene el servicio, su contrato de configuración y su manual.
- El repositorio del frontend dejará de versionar `reporting-api/`; la documentación y el runbook enlazan ahora al repositorio separado.
- La documentación de la API se corrigió para reflejar la tabla `Planos_Symphony.dbo.Informe_ventas` y las columnas `FechaContabilizacion`, `DocNum` y `TipoVentas`.

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

## [2026-10-27] fix | Filtros de Mercado, Ciudad y Cliente

- Causa: la Reporting API solo aceptaba `zona` y `grupoCliente`. Cliente, Mercado y Ciudad se aplicaban en el navegador sobre las 50 filas visibles, que solo alimentan la tabla de detalle, y no disparaban una nueva consulta; Mercado además comparaba `TipoVentas` contra opciones fijas. Las listas de opciones salían de la página visible.
- API (rama `fix/filtros-mercado-ciudad`): nuevos parámetros `mercado`, `ciudad` y `cliente`; `filterOptions` con los valores del periodo; entregas acepta `grupoCliente` y `cliente`; normalización de espacios.
- Frontend (rama `fix/filtros-mercado-ciudad`): envía todos los filtros, vuelve a consultar al cambiarlos, usa `filterOptions` con respaldo en las filas visibles y avisa que entregas no se filtra por mercado, zona ni ciudad.
- Orden de despliegue: primero la API (recompilar y reiniciar en IIS), después el frontend. Si el frontend sale antes, los filtros nuevos se ignoran sin errores.
- Validación: `tsc` en la API y `npm run lint`/`tsc` en el frontend. `pendiente` probar contra SQL Server: valores reales de `TipoVentas` y tiempo de respuesta de los catálogos con "Todos los años".
- Rollback: revertir los commits de ambas ramas; no hay cambios de esquema.

## [2026-10-27] cambio | Ciudad dependiente de Zona

- API (`fix/filtros-mercado-ciudad`, commit `8ef6968`): con `zona` activa, el catálogo `filterOptions.cities` solo incluye las ciudades de esa zona.
- Frontend: al cambiar la zona, la ciudad seleccionada vuelve a `Todas`. Sin la API actualizada, la lista de respaldo (derivada de las filas visibles) ya queda limitada por zona, porque `zona` siempre se filtró en el servidor.
- Requiere volver a copiar `dist/` de la API al servidor y reiniciar el servicio.
