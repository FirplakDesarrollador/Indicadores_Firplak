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

## [2026-10-27] ingest | Manual de identidad web (borrador v0.1)

- Se creó `docs/manual-identidad-web.md` a partir del Brand Book Firplak (PDF) para traducir la identidad a aplicaciones web responsive.
- Incluye escala de color derivada, colores funcionales propuestos, contrastes WCAG verificados, tipografía Montserrat/Jost, breakpoints 640/1024/1440, componentes, visualización de datos y tokens CSS.
- Pendientes: SVG oficial del logo, licencia web de Orborn y validación de colores funcionales por Mercadeo. El frontend todavía no aplica estos lineamientos.

## [2026-10-27] cambio | Aplicación del manual de identidad web al frontend

- Se reescribió el CSS: `app/globals.css` (tokens y base) y `app/styles/{login,portal,billing}.css`. Se eliminaron unas 100 clases sin uso de un dashboard anterior y tres capas de estilos superpuestas.
- Se reemplazaron DM Sans y Manrope por Montserrat y Jost (`next/font`), y la paleta no oficial (verde azulado, coral) por navy, sage y crema.
- Los logos dejan de recortarse con posiciones negativas: hay PNG recortados (`firplak-wordmark-*`, `firplak-eslogan-*`). Se agregaron el monograma `BrandPeak` y el favicon `app/icon.svg`.
- Responsive mobile-first con cortes en 640/1024/1440 px y container queries para las cuadrículas del dashboard.
- Formatos `es-CO` en millones y porcentajes, filas de la tabla accesibles con teclado, `Esc` para cerrar paneles, colores de Recharts centralizados en `lib/brand.ts`.
- Validación: `npm run lint` y `npm run build` sin errores; revisión visual a 375, 820 y 1440 px en una copia temporal sin middleware.
- Rollback: revertir el commit; no hay cambios de datos, API ni configuración.
- Pendientes: los KPIs "Cumplimiento 94,8 %" y las tendencias "12,4 %" / "4,7 %" siguen fijos en el código; el avatar "DJ" y "Usuario Firplak" están fijos en la barra lateral.

## [2026-10-27] ingest | Manual de marca Firplak v1-030726

- Llegó una nueva versión del Brand Book (v1-030726, 23 páginas). Cambios relevantes para web: negro `#000000` como color complementario "para texto y detalles", logo monocromático en negro con versión en escala de grises, combinación "crema sobre negro", y títulos de sección en Montserrat Light (Jost/Orborn solo en portadas).
- El manual web pasa a la v0.2: se agrega el negro (token `--black`, no se usa para texto de interfaz), las nuevas versiones del logo, contrastes medidos (negro/crema 18,97; navy/negro 2,07) y dos niveles de titular.
- Código: Montserrat suma el peso 300; los títulos del dashboard y del panel de detalle pasan de Jost a Montserrat 300. Jost queda en el login y la cabecera del portal.
- Pendientes con Mercadeo: licencia de Orborn (su muestra se ve como Jost), peso real del H1 de la escala y confirmación de que el texto de interfaz puede seguir en navy.
- Validación: `npm run lint` y `npm run build`. Rollback: revertir el commit.

## [2026-10-27] decisión | Respuestas de Mercadeo al manual web

- Mercadeo (Gabriel Molina Isaza) respondió: todo en Montserrat (Orborn es secundaria y el "Jost" de la escala del Brand Book es un error), titulares de gran volumen, fondo blanco en lugar de crema con navy para bloques de volumen, y texto en navy o negro sobre blanco.
- Manual web v0.3: decisiones registradas al inicio del documento; paleta con fondo blanco y neutros fríos (`--gray-100`, `--gray-200`); crema solo como texto sobre navy; una sola familia tipográfica; escala de titulares más grande; pendientes de tipografía, negro y fondo cerrados. Myriad no se adopta (licencia paga de Adobe).
- Código: se retira Jost; `--color-bg` pasa a blanco; skeletons, barra de progreso, encabezados de tabla y panel de detalle usan grises fríos; favicon blanco sobre navy; colores de Recharts actualizados en `lib/brand.ts`.
- Validación: `npm run lint`, `npm run build` y revisión visual a 375 y 1440 px. Rollback: revertir el commit.

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

## [2026-10-27] cambio | Búsqueda al pulsar la lupa

- El buscador del dashboard deja de consultar la API con cada tecla: el texto se aplica al pulsar la lupa o Enter (formulario con `role="search"`). `Limpiar` borra también el texto escrito.
- Se confirmó con datos reales que `Zona` es una zona comercial: con `zona=ANTIOQUIA` aparecen ciudades de otros departamentos. También hay nombres de ciudad duplicados (por ejemplo `ENVIGADO`/`ENVÍGADO`); su normalización corresponde al proceso que alimenta `Informe_ventas` (`pendiente`).

## [2026-10-27] cambio | Botón para aplicar filtros

- Los filtros del dashboard pasan a ser un borrador: elegir varias opciones ya no dispara una consulta por cada cambio. Se aplican con `Aplicar filtros`, la lupa o Enter.
- API (`fix/filtros-mercado-ciudad`, commit `f69963b`): `filterOptions.cityZones` con las parejas zona-ciudad del periodo, para que la lista de ciudades siga a la zona del borrador sin otra consulta.
- Diseño: la barra de filtros pasa a una sola fila con una consulta de contenedor (≥ 1040 px de contenido); el panel avanzado usa 3 o 5 columnas según el ancho disponible y muestra un segundo botón `Aplicar filtros` solo en pantallas angostas.
- Requiere copiar `dist/` de la API al servidor y reiniciar (ZIP `reporting-api-dist-f69963b.zip`). Sin esa copia, todo funciona salvo que la lista de ciudades se ajusta a la zona solo después de aplicar.

## [2026-10-27] cambio | Perfil real en la barra lateral

- El perfil del dashboard deja de mostrar "DJ" y "Usuario Firplak" fijos: usa el nombre, el correo y las iniciales del usuario de Microsoft 365 obtenidos de Supabase.
- Se desactiva `devIndicators` en `next.config.ts`; el círculo "N" solo aparecía en `npm run dev` y tapaba el avatar.

## [2026-10-27] limpieza | Elementos sin funcionalidad

- Dashboard: se quitan la tarjeta "Fuente de datos", los botones "Ayuda" (barra lateral y superior), los menús "···", la insignia "01", el botón "Ver documento", las tendencias fijas "12,4 %"/"4,7 %" y la tarjeta "Cumplimiento 94,8 %" (valores inventados). Los KPIs pasan a 3 tarjetas.
- La pestaña "Resumen" pasa a "Todos" y "Facturación" ahora filtra las filas con valor facturado; antes ambas mostraban lo mismo.
- Portal: se quitan la sección "Más aplicaciones próximamente", el correo en la cabecera y el texto "Accesos gestionados por tu organización" (tenía ícono de enlace sin serlo). El saludo usa el nombre o la parte local del correo.
- Se eliminan del CSS los estilos de esos elementos. `pendiente`: volver a mostrar "Cumplimiento" cuando existan metas reales (hoy `monthlyTargets` solo cubre enero a abril de 2026).

## [2026-10-27] proceso | Skills para migrar BI con IA

- Se agregan cinco skills de proyecto en `.claude/skills/`: `migrar-bi` (coordina las 8 fases y los puntos de aprobación), `analizar-bi` (de un proyecto `.pbip` a la ficha del BI), `crear-tabla-incremental` (tabla, SP por ventana móvil, índices, bitácora y validación), `crear-endpoint` (contrato y endpoint en `reporting-api` con el patrón de facturación, más paquete de despliegue) y `crear-dashboard` (proxy, filtros en borrador, identidad Firplak y verificación responsive).
- Plantillas: ficha del BI (`analizar-bi/plantilla-ficha-bi.md`) y script T-SQL (`crear-tabla-incremental/plantilla-tabla-sp.sql`). La tabla `dbo.Bitacora_Cargas_Informes` es una propuesta `pendiente` de confirmar con el DBA.
- Reparto: la IA hace el trabajo operativo; el desarrollador decide, ejecuta scripts en SQL Server, revisa PR y despliega. La IA nunca escribe en la base ni despliega.
- `pendiente`: extraer componentes comunes del dashboard antes del segundo BI, versión en `/health` de la API, permisos por usuario y conexión SQL de solo lectura para la IA.

## [2026-10-27] migración | BI Notas crédito, fase 0

- Se inicia la migración piloto del Power BI `bi-notas-creditos` (fuente en `bi-origen/bi-notas-credito/`), rama `bi/notas-credito`.
- Ficha creada en [`llm-wiki/bi/notas-credito.md`](bi/notas-credito.md): dueño de negocio Daniel Jimenez, usuarios de Cartera, prioridad piloto.
- Desarrollador responsable: Daniel Jimenez. Frecuencia de uso: diaria.

## [2026-10-27] migración | BI Notas crédito, fase 1 (análisis)

- Ficha completada con fuentes, transformaciones, relaciones, 6 medidas, visuales de 3 páginas, filtros y RLS (no hay): [`llm-wiki/bi/notas-credito.md`](bi/notas-credito.md).
- Hallazgo: el BI lee de SAP (`ITPLAKINFO.Firplak_SA`, tablas `ORIN`/`RIN1` y `OINV`/`INV1`), no de `Planos_Symphony`. Las consultas de facturas y notas aplican exclusiones distintas (Donaciones, `DocType`, artículos `VZNOPE`, documentos retirados a mano).
- Se propone la tabla `Informe_notas_credito` con grano de línea de nota crédito; el denominador de facturación queda `pendiente`.
- Se agrega `bi-origen/bi-notas-credito/.gitignore` para no versionar `.pbi/cache.abf` (datos importados) ni `.pbi/localSettings.json`.
- `pendiente`: validación del dueño de negocio (10 preguntas en la ficha) y resultados de las consultas de validación.

## [2026-10-27] migración | BI Notas crédito, fase 1 validada

- Daniel Jimenez (dueño de negocio) respondió las 10 preguntas. Facturas y notas aplicarán las mismas exclusiones (Donaciones, `DocType = 'S'`, `VZNOPE-0021`), lo que cambia el % frente al Power BI actual. Las exclusiones manuales por `DocNum` irán en una tabla. La meta del 3 % se mantiene. Se descarta `ÁREA` y se agregan al detalle ciudad, teléfono, obra y punto de venta.
- Validación con datos: `Planos_Symphony` y `Firplak_SA` están en la misma instancia `ITPLAKINFO`. Con los datos reales, el tipo NC agrupado solo resulta en Devolución, Anulación y vacío; los prefijos de concepto 34–36 quedan sin departamento.

## [2026-10-27] hallazgo | `Informe_ventas` frente a SAP

- Durante la fase 2 de Notas crédito, `Informe_ventas` (`TipoDocumento = 'Factura'`) no cuadró con `Firplak_SA.dbo.OINV`: sobran documentos de `DOCNUM` bajo que no existen en `OINV` con esa fecha (unos 5 a 12 millones al mes) y falta al menos la factura de exportación 4316 (serie 276). Detalle en [la ficha de Notas crédito](bi/notas-credito.md#sirve-informe_ventas-como-denominador-2026-10-27).
- Decisión: el BI de notas no usa `Informe_ventas` como denominador. `pendiente`: revisar el SP de `Informe_ventas` porque el dashboard de facturación podría estar afectado.

## [2026-10-27] corrección | Documentos de Viventta en `Informe_ventas`

- Los documentos de `DOCNUM` bajo del hallazgo anterior son de **Viventta**, compañía del grupo que `Informe_ventas` ya incluye en facturas y notas crédito. No es un error de `Informe_ventas`. El Power BI de notas crédito solo lee `Firplak_SA`.
- Sigue `pendiente`: la factura 4316 (serie 276), que está en SAP pero no en `Informe_ventas`, y la decisión de incluir Viventta en el dashboard de notas crédito.

## [2026-10-27] decisión | Notas crédito incluye Viventta

- El dashboard de notas crédito incluirá Viventta (base `DBViventta`). Sus notas quedan sin tipo, concepto ni departamento porque no usa esos campos. Recarga completa los domingos a las 2:00.

## [2026-10-27] ingesta | `SP_Generar_Informe_Ventas`

- El desarrollador compartió la definición del SP que llena `Informe_ventas`. Ya incluye notas crédito de Firplak con tipo, concepto (por línea), comentarios y las columnas del detalle; además tiene `Empresa`, `DocEntry` y `LineNum`. La bitácora existente es `dbo.Cargas_Log`.
- Diferencias con las decisiones del BI de Notas crédito: las facturas no excluyen `DocType = 'S'`; Viventta no excluye Donaciones; las exclusiones manuales son fijas en el SP. Detalle en la [ficha](bi/notas-credito.md#cómo-se-carga-informe_ventas-definición-compartida-por-el-desarrollador-2026-10-27).
- `pendiente`: la plantilla de la skill `crear-tabla-incremental` propone `Bitacora_Cargas_Informes`; debería apuntar a `Cargas_Log`.

## [2026-10-27] decisión | Notas crédito reutiliza `Informe_ventas`

- El dashboard de notas crédito leerá notas y facturación de `Informe_ventas` (filtrando por `Empresa` y `TipoDocumento`). No se crean tablas, SP ni jobs nuevos y **no se modifican** las reglas de `SP_Generar_Informe_Ventas`.
- Los jobs existentes ya cumplen la frecuencia pedida: incremental cada 15 minutos (6:00–20:00) y completa a las 2:00.
- La factura 4316 queda explicada (`VZNOPE-0028`, excluida por `Informe_ventas`). `pendiente`: el concepto NC por línea difiere del concepto del encabezado en el 97 % de las líneas.

## [2026-10-27] hallazgo | Concepto NC vacío en `Informe_ventas`

- 5.928 de 5.929 líneas de notas de Firplak (desde 2025) no tienen `CodigoConceptoNC`. `SP_Generar_Informe_Ventas` lee el concepto de la línea (`RIN1.U_CONCEPTOSNC`, casi siempre `NULL`) y no del encabezado (`ORIN.U_CONCEPTOSNC`). Corrección propuesta en la [ficha de Notas crédito](bi/notas-credito.md); `pendiente` de aprobación.
- Índices de `Informe_ventas` confirmados: PK clustered, `IX_Informe_ventas_Fecha` y columnstore `NCCI_Informe_ventas`.

## [2026-10-27] cambio | Concepto NC en `SP_Generar_Informe_Ventas` (fase 2 de Notas crédito cerrada)

- Las notas crédito de Firplak toman el concepto del encabezado (`ORIN.U_CONCEPTOSNC`) en lugar de la línea. Lo ejecutó el desarrollador en SSMS, con respaldo previo del SP.
- Validación: líneas sin concepto desde 2025 de 5.928 a 25; facturación de enero a septiembre de 2026 sin cambios; carga completa de 260.204 filas sin error.
- Rollback: ejecutar el respaldo como `ALTER PROCEDURE` y hacer una carga `COMPLETA`.
- Impacto en otros consumidores de `Informe_ventas`: `CodigoConceptoNC` y `ConceptosNotasCredito` ahora tienen datos; antes venían vacíos.

## [2026-10-27] migración | Notas crédito, fase 3 (contrato propuesto)

- Contrato de `GET /api/v1/notas-credito` en la [ficha](bi/notas-credito.md#3-contrato-del-endpoint), sobre `Informe_ventas`, sin filtro de empresa (Firplak y Viventta sumadas, decisión del desarrollador). Departamento y tipo NC agrupado se calculan con `CASE` en SQL. `pendiente`: aprobación del desarrollador.

## [2026-10-27] migración | Notas crédito, fase 4 (endpoint)

- Contrato aprobado por Daniel Jimenez. Se implementa `GET /api/v1/notas-credito` en `reporting-api`, rama `bi/notas-credito`; compila sin errores. Documentado en [Reporting API](components/reporting-api.md#get-apiv1notas-credito).
- `pendiente`: prueba del desarrollador contra la base y despliegue. Si el proxy de IIS limita rutas, hay que agregar `/api/v1/notas-credito`.

## [2026-10-27] despliegue | `GET /api/v1/notas-credito` en el servidor

- El desarrollador desplegó el `dist` de la rama `bi/notas-credito` en `C:\Apps\reporting-api`. La API escucha en `127.0.0.1:8090` (no en 8080, que pertenece a otra aplicación).
- Prueba de septiembre de 2026: la facturación coincide con `Informe_ventas`; las notas suman 796.683.781,95 (13,49 % de la facturación). Detalle en la [ficha](bi/notas-credito.md#4-endpoint).
- `pendiente`: el código desplegado aún no tiene commit en `reporting-api`; confirmar el respaldo del `dist` anterior.

## [2026-10-27] migración | Notas crédito, fase 5 (dashboard) y componentes comunes

- Commit `da3e0fc` en `reporting-api`, rama `bi/notas-credito`, con el endpoint ya desplegado.
- Se extraen los componentes comunes de dashboard (`components/dashboard/`, `lib/dashboard/`) desde `FacturacionDashboard.tsx`, sin cambios visibles en facturación. Ver [Frontend](components/frontend.md#componentes-comunes-de-dashboard).
- Nuevo dashboard `/notas-credito` con proxy `/api/notas-credito`, tarjeta en el portal y opción en el menú lateral. Lint y build sin errores; revisión visual a 375, 820 y 1440 px con datos ficticios en una copia temporal, ya borrada.
- `lib/brand.ts` agrega `surface` (blanco, replica `--white`) para los puntos de los gráficos.
- `pendiente`: prueba con sesión y datos reales, revisión de IIS para la ruta nueva y commit del frontend.

## [2026-10-27] cambio | Menú lateral por reporte y selector de mes

- Validación con datos reales del dashboard de notas crédito: hecha por el desarrollador.
- Cada reporte muestra en el menú lateral solo su vista principal y su detalle (`billingNavigation`, `creditNoteNavigation`). Se quita "Resumen" del menú; "Indicadores" en las migas de pan pasa a ser el enlace al portal.
- Nueva página `/notas-credito/detalle`. La vista principal de notas crédito ya no muestra la tabla de documentos.
- `billing.css`: la columna del mes en la barra de filtros pasa de `minmax(180px, .8fr)` a `minmax(255px, 1fr)`, para que "Todos los meses" no se recorte en ninguno de los dos dashboards. Revisado a 1380 y 1440 px.

## [2026-10-27] cambio | Notas crédito: filtros también sobre la facturación

- Por decisión de Daniel Jimenez, cambia la decisión 4: `tipoVentas` y `vendedorSenior` filtran también la facturación, que es el denominador del %. Departamento, concepto, tipo NC y búsqueda siguen filtrando solo las notas, porque las facturas no tienen esos datos.
- `reporting-api` (`src/db.ts`, `addCreditNoteFilters` devuelve `shared` y `notesOnly`) y su README actualizados. Compila. Paquete `reporting-api-dist-bi-notas-credito.zip` regenerado. `pendiente`: commit y despliegue en el servidor.
- Frontend: el texto del panel de filtros avanzados lo indica.

## [2026-10-27] proceso | Revisión de PR por el mismo desarrollador

- Por falta de personal, los PR de las migraciones los revisa el mismo desarrollador responsable; ya no se exige un segundo revisor. Cambian las skills `migrar-bi` (definición de terminado) y `crear-dashboard` (regla "No hagas").
- La IA crea los PR con `gh` (GitHub CLI, instalada y autenticada el 2026-10-27).

## [2026-10-27] proceso | Migración de BI documentada en VibeWorkFlow

- Se conecta el MCP `vibeworkflow` en Claude Code (configuración de usuario).
- Se documenta el proceso en VibeWorkFlow: flujo estándar "Migración de reportes de Power BI al portal de Indicadores", entorno FIRPLAK, área Tecnología (id `5cb0a7af-a680-49ca-89a0-4bcb69efe3be`). Tiene 8 acciones (fases 0 a 7) con su documento, 4 soluciones (skills, ficha, Reporting API y portal), responsables por rol, 2 KPI, un deseo y el checklist de cierre.
- Skill `migrar-bi`: la fase 7 exige subir la documentación del BI migrado a VibeWorkFlow (flujo estándar del indicador en el área del dueño de negocio) y enlazarla en la ficha. Se actualizan la definición de terminado y la plantilla de la ficha.
- `pendiente`: subir la documentación del BI de notas crédito cuando llegue a la fase 7.

## [2026-10-27] cambio | Permisos por informe

- **Decisiones del desarrollador:**
  - Los permisos se guardan en una tabla de Supabase, uno por usuario y por informe.
  - La administración se hace en una página de la misma aplicación.
  - Los administradores ven todos los informes.
  - Administradores iniciales: analista.desarrollador, daniel.jimenez, milton.rendon, analista2.desarrollo (Esteban Muñoz), alejandro.isaza e ismael.correa (@firplak.com).
  - Al lanzar, ningún usuario normal tiene informes.
- **Implementación:**
  - Script `supabase/migrations/20261027_permisos_informes.sql`: tablas, RLS, triggers de historial y de último administrador, y administradores iniciales.
  - Catálogo `lib/reports.ts` y `lib/auth/access.ts`.
  - El middleware responde 403 o redirige al portal.
  - Registro de ingresos en el callback.
  - Portal filtrado por permisos.
  - Página `/admin/permisos`.
- **Validación:**
  - Lint y build sin errores.
  - Revisión visual a 375, 820 y 1440 px con un Supabase simulado y usuarios ficticios, en una copia temporal ya borrada.
- **Despliegue:** ejecutar el script **antes** de desplegar el frontend. Sin las tablas, el middleware niega todos los informes.
- **Rollback:** revertir el PR. Las tablas se borran con el bloque de rollback del script.
- **`pendiente`:**
  - Ejecutar el script en Supabase.
  - Probar con sesión real.
- **Skills:** `migrar-bi` (fases 0 y 5) y `crear-dashboard` (paso 10) incluyen el catálogo y los permisos.

## [2026-10-27] cambio | Permisos en el menú del perfil

- Por decisión del desarrollador, el acceso a `/admin/permisos` deja de ser una tarjeta del portal y pasa a ser una opción ("Permisos de informes") del menú del perfil, el bloque con nombre y correo. Está en el encabezado del portal y en la barra lateral de los dashboards, y solo lo ven los administradores; para los demás, el perfil se muestra sin menú.
- Componente `components/dashboard/UserMenu.tsx` y estilos en `app/styles/user-menu.css`. El portal muestra ahora el avatar y el correo del usuario.
- Lint, tipos y build sin errores; revisión visual con el menú abierto en una copia temporal con datos ficticios, ya borrada.

## [2026-10-28] bi | Notas crédito: conciliación firmada (fase 6)

- El dueño de negocio (Daniel Jimenez) contrastó el dashboard con el Power BI y dio la conciliación por buena. Las cifras por indicador no quedaron registradas; las diferencias esperadas están en la sección 6 de [la ficha](bi/notas-credito.md).
- La ficha pasa a `fase: 6` y la sección 7 registra el despliegue de la API y del frontend y el rollback de cada parte.

## [2026-10-28] bi | Notas crédito: migración cerrada (fase 7)

- **VibeWorkFlow:** flujo estándar "Consulta del indicador de notas crédito", área Tecnología, id `35bad5f7-8628-4bb1-9af3-4da057d07722`. Lo creó el agente después de una caída del servicio y lo revisó el desarrollador el 2026-10-28.
- **Frontend:** desplegado en Vercel el 2026-10-28.
- **Power BI:** retiro programado para el 2026-11-06; hasta entonces queda en paralelo como respaldo.
- **Rollback:** está en la sección 7 de [la ficha](bi/notas-credito.md), separado para la API, el frontend y el SP.
- La ficha pasa a `status: migrado` y `fase: 7`.

## [2026-11-04] bi | Costo actual de producto terminado: inventario y análisis (fases 0 y 1)

- Ficha nueva: [`bi/costo-actual-pt.md`](bi/costo-actual-pt.md). El dueño de negocio es Contabilidad, la prioridad es alta y el uso es diario. Rama `bi/costo-actual-pt`.
- Fuente: proyecto `.pbip` en `bi-origen/bi-costo-actual-pt/`. Es la explosión de la lista de materiales (4 niveles) desde SAP `FIRPLAK_SA`, con costo de MP, MO y CIF.
- **Decisión del desarrollador:** la migración usa [`query-optimizado.sql`](../bi-origen/bi-costo-actual-pt/query-optimizado.sql), sin cursores y con reglas corregidas, en lugar del SQL del Power BI. Las diferencias de reglas (D1–D8) están en la ficha y afectarán la conciliación.
- Propuesta: tabla `Informe_costo_pt` con **carga completa** diaria, no incremental (nombre y horario pendientes).
- Pendiente: la validación de Contabilidad (preguntas P1–P9) y los resultados de las consultas V1–V7.
