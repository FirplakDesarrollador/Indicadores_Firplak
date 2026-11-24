# Registro de mantenimiento

## [2026-11-12] merge | Integración de main en Ale

- Se sincronizó la rama local `main` con `origin/main` (PRs #1 a #11) y se fusionó en `Ale`.
- Se resolvieron conflictos en `app/page.tsx` adoptando la arquitectura de componentes y diseño vigente de `main` (`BrandPeak`, `UserMenu`, permisos por informe).
- Se registró el módulo de Capacidad & WIPL (`/carga`, `/planner`, `/api/carga`) en el catálogo central de `lib/reports.ts` bajo el área `operaciones`.
- Se verificó compilación exitosa mediante `npx tsc --noEmit` y `npm run build`.

## [2026-11-05] feat | Histórico de Due Date vs Atrasadas en Historial & Flujo

- Se agregó un nuevo gráfico de área situado directamente arriba del gráfico de tareas creadas en `HistorialSubView.tsx`.
- Muestra la comparativa de tareas con fecha de vencimiento (due date) en azul (`#2563eb`) vs tareas atrasadas en rojo (`theme.red`).
- Cuenta con el mismo diseño, selector de granularidad (`Diario` por defecto, `Semanal` y `Mensual`) y sincronización con la fecha de corte activa (`fechaCorte`).
- Se validó con `npx tsc --noEmit`.

## [2026-11-05] feat | Selector de granularidad temporal en Historial & Flujo

- Se agregó un control segmentado para alternar la visualización del gráfico de flujo acumulado en `HistorialSubView.tsx`: `Diario` (por defecto, últimos 30 días), `Semanal` (últimas 12 semanas) y `Mensual` (últimos 10 meses).
- La granularidad diaria es ahora la opción por defecto según requerimiento de usuario.
- Se optimizaron las etiquetas del eje X con formato adaptativo (`d.toLocaleDateString` sin conectores largos) y control de espaciado `minTickGap` para evitar colisiones visuales.
- Se validó la compilación sin errores con `npx tsc --noEmit`.


## [2026-10-29] merge | Integración de main en Ale

- Se sincronizó la rama local `main` con `origin/main` y se fusionó en `Ale`.
- Se adoptó la arquitectura de `main`: portal de accesos (`/`), autenticación Supabase SSR, middleware protector y módulos independientes.
- El módulo de Planner/Capacidad WIPL se integró como ruta `/carga` (con redirección desde `/planner`) y tarjeta de acceso en el portal de inicio.
- Se resolvió conflicto de dependencias instalando `@supabase/ssr` y verificando `npm run build` exitoso.


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

## [2026-11-03] bi | Liberación: inventario y análisis (fases 0 y 1)

- Nueva ficha [Liberación](bi/liberacion.md), a partir del proyecto `bi-origen/bi-liberacion/PBI liberacion act.pbip`. Dueño de negocio: Logística; desarrollador responsable: Milton Rendón; prioridad media; uso diario. Rama `bi/liberacion` en este repositorio y en `reporting-api`.
- Se agregó `bi-origen/bi-liberacion/.gitignore` para no subir `.pbi/cache.abf` ni `.pbi/localSettings.json`.
- Hallazgos: la tabla principal sale de `Planos_Symphony.dbo.Indicador_Liberacion` (sin documentar aún) y las razones de incumplimiento de un Excel en SharePoint, que la API no puede leer. El calendario del BI termina el 2026-12-31.
- `pendiente`: consultas de validación del desarrollador y respuestas de Logística a las 10 preguntas de la ficha.

## [2026-11-04] bi | Costo actual de producto terminado: inventario y análisis (fases 0 y 1)

- Ficha nueva: [`bi/costo-actual-pt.md`](bi/costo-actual-pt.md). El dueño de negocio es Contabilidad, la prioridad es alta y el uso es diario. Rama `bi/costo-actual-pt`.
- Fuente: proyecto `.pbip` en `bi-origen/bi-costo-actual-pt/`. Es la explosión de la lista de materiales (4 niveles) desde SAP `FIRPLAK_SA`, con costo de MP, MO y CIF.
- **Decisión del desarrollador:** la migración usa [`query-optimizado.sql`](../bi-origen/bi-costo-actual-pt/query-optimizado.sql), sin cursores y con reglas corregidas, en lugar del SQL del Power BI. Las diferencias de reglas (D1–D8) están en la ficha y afectarán la conciliación.
- Propuesta: tabla `Informe_costo_pt` con **carga completa** diaria, no incremental (nombre y horario pendientes).
- Pendiente: la validación de Contabilidad (preguntas P1–P9) y los resultados de las consultas V1–V7.

## [2026-11-04] bi | Costo actual de producto terminado: resultados de validación V1–V6

- El query optimizado tarda 33 s y devuelve 449.018 filas, así que la carga completa diaria es viable.
- D1 y D7 no tienen efecto: `validFor` y `frozenFor` son complementarios, y no hay artículos que sean MO y CIF a la vez.
- Hallazgos para Contabilidad: 3.421 productos tienen listas de más de 4 niveles (P10) y 13.019 líneas no tienen costo en SAP (P11). Las consultas de seguimiento V4b y V5b y la comparación V7 de tres productos están en la [ficha](bi/costo-actual-pt.md#resultados-ejecutados-por-el-desarrollador-el-2026-11-04).

## [2026-11-04] bi | Costo actual de producto terminado: V4b, V5b y primer producto de V7

- V4b: solo 1 producto llega al nivel 6 (24 líneas). Explotar todos los niveles (P10) es viable.
- V5b: todas las hojas sin costo son MP. 12.055 líneas son de artículos que no son de inventario y 982 líneas (630 artículos) son de inventario sin costo en SAP. P11 queda reformulada sobre esos dos grupos.
- V7: `CBAN12-0027-000-0406` (un nivel, con MO y CIF) cuadra exacto con el Power BI: total 235.171,705. Falta comparar `VHPT09-0006-073-0100` y `CBAN05-0002-000-0438`, que no salieron en la ejecución.

## [2026-11-04] bi | Costo actual de producto terminado: comparación V7 de los tres productos

- `VHPT09-0006-073-0100` y `CBAN05-0002-000-0438` están inactivos y se reemplazaron por `CBAN05-0001-000-0438` y `CMPD04-0268-000-0000`.
- `CBAN05-0001`: el query da 1.817,70 más que el Power BI. El Power BI deja en 0 la MP de un canto que sí tiene costo unitario (regla D3), y el query lo corrige.
- `CMPD04-0268`: MO y CIF iguales. La MP difiere en 2.094,88 en cuatro hojas del nivel 3 con distinto costo unitario. Puede deberse a D5/D6 o a un cambio del costo promedio desde la última actualización del Power BI. La consulta V7b queda pendiente.

## [2026-11-04] bi | Costo actual de producto terminado: causa de la diferencia de `CMPD04-0268` verificada

- El desarrollador confirma un error conocido del SQL original: en las hojas del nivel 3 no consulta la bodega alternativa y se queda con el costo de la bodega de la lista (D3/D5). El query optimizado lo corrige.
- Se retira la consulta V7b. La validación con datos (V1–V7) queda completa. Para cerrar la fase 1 falta la validación de Contabilidad (P1–P11).

## [2026-11-04] bi | Costo actual de producto terminado: respuestas de Contabilidad P1, P7, P10 y P11

- P1: se aceptan las reglas corregidas del query optimizado.
- P7: se incluyen los semielaborados (todo artículo activo con lista de materiales).
- P10: se desglosan todos los niveles. Es una diferencia nueva respecto del query optimizado (**D9**): el SP de la fase 2 hará la explosión recursiva con control de ciclos.
- P11: las líneas sin costo quedan en 0 y se controlan con la columna `Alerta`, que el portal mostrará.
- Pendiente: P2 a P6, el indicador de P8 y P9.

## [2026-11-04] bi | Costo actual de producto terminado: respuestas de Contabilidad P2 a P9

- P2: los artículos que son MO y CIF a la vez no deberían existir. El SP los cuenta una vez como MO y los marca con la alerta `MO Y CIF A LA VEZ`.
- P3: la tabla muestra MP, MO, CIF y Total. P4: la torta excluye el CIF por clasificación de SAP, no por texto.
- P5: se decide en el dashboard. P8: se muestra `Alerta` y un indicador de líneas con alerta, que resalte `ITEM INACTIVO`. P9: solo costo actual, sin historia.
- Pendiente: aclarar P6 (tarjetas sin producto seleccionado) y confirmar que la mano de obra queda en la torta.

## [2026-11-04] bi | Costo actual de producto terminado: fase 1 cerrada

- P6: las tarjetas solo se muestran con un producto seleccionado (opción a). P4: confirmado que la mano de obra queda en la torta.
- Contabilidad aprobó las reglas por medio del desarrollador. Solo queda P5, que se decide en la fase 5. Sigue la fase 2 (tabla y SP).

## [2026-11-04] bi | Costo actual de producto terminado: fase 2, script de tabla y SP

- Script nuevo: [`sql/costo-actual-pt/01_informe_costo_pt.sql`](../sql/costo-actual-pt/01_informe_costo_pt.sql). Crea `Informe_costo_pt`, `Informe_costo_pt_Carga` y `sp_Actualizar_Informe_costo_pt`, que desglosa todos los niveles (D9) con tope de 15 y control de ciclos.
- Precisión del desarrollador sobre P2: los artículos MO+CIF **no se costean** (costo 0) y se marcan con la alerta `MO Y CIF A LA VEZ`.
- Carga completa **cada hora** con intercambio por `ALTER TABLE … SWITCH`. Bitácora en `dbo.Cargas_Log`, existente.
- Pendiente: que el desarrollador verifique las columnas de `Cargas_Log`, ejecute el script, la primera carga y las validaciones 4.1–4.6, y cree el job.

## [2026-11-04] fix | Costo actual de PT: líneas de ITT1 sin código

- La primera carga falló con el error 515 (`NULL` en `#BOM.Codigo`): hay líneas de `ITT1` sin `Code`, probablemente líneas de texto.
- El SP las excluye del desglose. No tienen costo, así que los totales no cambian frente al query optimizado; solo cambia el número de filas. Se agregó una consulta de diagnóstico por `ITT1.Type`.

## [2026-11-04] fix | Costo actual de PT: rendimiento de la explosión

- La primera carga llevaba más de 9 minutos (1.145 s de CPU) en el `INSERT` del `WHILE`, con `#BOM` ya en las ~463.000 filas esperadas. Causa: el plan compilado con el nivel 1 se reutilizaba sobre todo `#BOM`.
- Corrección: tabla `#Frontera` con solo los encabezados del nivel en curso y `OPTION (RECOMPILE)` en el `INSERT` del desglose, el `INSERT` final y el `UPDATE` de totales.
- Segunda corrección (2026-11-04): la frontera no bastó (la carga anterior tardó 10 min). Causa probable: `LEFT JOIN #ConLista` (varchar) contra `ITT1.Code` (nvarchar en SAP B1) forzaba una conversión implícita y un recorrido completo de `#ConLista` por cada línea. Se reemplazó por `EXISTS` sobre `ITT1`, como en el query optimizado. Tipos de `ITT1`: `pendiente` de confirmar.

## [2026-11-04] bi | Costo actual de PT: primera carga validada y script del job

- La carga final (`Cargas_Log` 1238) tarda 32 s e inserta 463.592 filas: 11.253 productos y listas hasta el nivel 6. Validaciones 4.1–4.5 correctas: el nivel 1 suma sus líneas, no hay MO+CIF ni problemas de estructura, y los tres productos de V7 cuadran exacto.
- Script del job: [`sql/costo-actual-pt/02_job_costo_pt.sql`](../sql/costo-actual-pt/02_job_costo_pt.sql), cada hora al minuto 05. Pendiente: crearlo y ver la primera ejecución programada.

## [2026-11-04] bi | Costo actual de PT: fase 2 cerrada y contrato del endpoint propuesto

- El job `BI - Costo PT carga completa` quedó creado y funcionando (desarrollador). Fase 2 cerrada.
- Contrato propuesto para `GET /api/v1/costo-actual-pt` en la [ficha](bi/costo-actual-pt.md#3-contrato-del-endpoint): selección de un producto por `codigo`, búsqueda de productos con `search`, lista completa sin paginar, resumen de costos y alertas, y composición sin CIF. Sin periodo; `loadedAt` muestra la última carga. Pendiente la aprobación.

## [2026-11-04] bi | Liberación: resultados de las consultas de validación

- `Planos_Symphony.dbo.Indicador_Liberacion` es una tabla con una fila por OP (30 323), desde el 2025-07-10. La escriben los SP `FPK_INDICADOR_LIBERACION` y `FPK_INDICADOR_LIBERACION_OPTIMIZADO` y la actualiza el job `Actualizacion Indicador Liberacion.Subplán_1`.
- Sus 23 columnas son `nvarchar`, incluidas las fechas: es el punto a resolver en la fase 2.
- Resultados y consultas siguientes (6 y 7: definición de los SP y horario del job) en [la ficha](bi/liberacion.md#resultados-ejecutadas-por-el-desarrollador-el-2026-11-04). Se agregaron las preguntas 11 (tipo O/S) y 12 (historia) para Logística.

## [2026-11-04] bi | Liberación: análisis del SP de carga

- El job ejecuta `Planos_Symphony.dbo.FPK_INDICADOR_LIBERACION` (lunes a viernes, 17:00, unos 15 s). Recalcula todo desde SAP (`OWOR`, `ORDR`/`RDR1`, amortiguadores, días de distribución y días no laborables) y hace `TRUNCATE` + `INSERT`, con una ventana de 365 días sobre la fecha prometida: la historia se pierde y los meses cerrados pueden cambiar.
- `FPK_INDICADOR_LIBERACION_OPTIMIZADO` es una copia que escribe en `Indicador_Liberacion_Prueba`; no interviene en el BI.
- Propuesta para la fase 2 (`pendiente` aprobación): no tocar el SP actual y agregar uno nuevo que copie a una tabla tipada con `MERGE`, para conservar historia. Detalle en [la ficha](bi/liberacion.md#cómo-se-carga-indicador_liberacion-código-compartido-por-el-desarrollador-2026-11-04).
- Pregunta 11 resuelta en parte (O = `STANDARD`, S = `STOCK`); se agregó la pregunta 14 (regla de la fecha recomendada) para Logística.

## [2026-11-05] bi | Costo actual de PT: ajustes al contrato

- Se mantienen las tarjetas de promedio del Power BI (`averageCost`, `averageCostWithoutOverhead`), visibles solo con un producto elegido.
- Descarga nueva `GET /api/v1/costo-actual-pt/export` en CSV para Excel (UTF-8 con BOM, `;`, coma decimal), en streaming: todos los productos sin `codigo`, o solo el producto elegido.
- El máximo real es de 331 líneas por producto; el tope de 5.000 del endpoint principal se mantiene.

## [2026-11-05] bi | Costo actual de PT: endpoint implementado (fase 4)

- Contrato aprobado por Daniel Jimenez. En `reporting-api`, rama `bi/costo-actual-pt` (desde `bi/notas-credito-2`), commit `a28da32`: `GET /api/v1/costo-actual-pt` y la descarga `GET /api/v1/costo-actual-pt/export` en CSV con streaming. Compila sin errores.
- Variables nuevas: `REPORT_COSTO_PT_TABLE_SCHEMA`, `REPORT_COSTO_PT_TABLE` y `REPORT_DB_EXPORT_TIMEOUT_MS`. Paquete `reporting-api-dist-a28da32.zip`.
- Pendiente: la prueba contra la base y el despliegue en el servidor.

## [2026-11-05] fix | Costo actual de PT: prueba del endpoint y hora de carga

- Prueba en el servidor: búsqueda, producto y descargas correctas. La descarga completa pesa 104,1 MB.
- `loadedAt` salía en UTC por el estilo 127 de `CONVERT`; se cambió al 126 para conservar el desfase (commit `aeb3f5b` en `reporting-api`, paquete `reporting-api-dist-aeb3f5b.zip`).

## [2026-11-05] bi | Costo actual de PT: fase 4 cerrada

- Versión `aeb3f5b` desplegada en el servidor y verificada: resumen correcto, `loadedAt` con desfase `-05:00` y descarga completa de 104,1 MB en 16,2 s dentro del servidor.

## [2026-11-05] bi | Costo actual de PT: dashboard (fase 5)

- Página `/costo-actual-pt` con buscador de producto, tarjetas de costo, panel de alertas, composición sin CIF, lista de materiales en árbol y botón de descarga (todo o el producto elegido). Proxys `/api/costo-actual-pt` y `/api/costo-actual-pt/export` (streaming, `maxDuration = 300`).
- `ShareList` pasa de notas crédito a `components/dashboard/` para compartirla.
- Lint y build sin errores. Revisión visual a 375, 820 y 1440 px con una API falsa; se movieron las alertas debajo del componente para que la tabla quepa a 1440 px.
- Pendiente: asignar permisos, probar con sesión real y probar la descarga completa a través de Vercel.

## [2026-11-05] cambio | Costo actual de PT: sin tarjetas de promedio

- A pedido del desarrollador se quitan las tarjetas "Costo promedio" y "Costo promedio sin CIF" del dashboard, porque con un producto elegido repetían el total. Quedan "Costo total" y "Costo sin CIF" en una cuadrícula de dos columnas.
- La API no cambia: `summary.averageCost` y `averageCostWithoutOverhead` quedan sin uso en el portal.

## [2026-11-05] bi | NS Plantas: inventario y análisis (fases 0 y 1)

- Nueva ficha [NS Plantas](bi/ns-plantas.md), a partir del proyecto `bi-origen/bi-ns-plantas/BI NS plantas.pbip`. Dueño de negocio: Manufactura; desarrollador responsable: Milton Rendón; prioridad media; usuario inicial `hector.chinchilla@firplak.com`. Rama `bi/ns-plantas`.
- Se agregó `bi-origen/bi-ns-plantas/.gitignore` para no subir `.pbi/cache.abf` ni `.pbi/localSettings.json`.
- Hallazgos: una sola fuente SQL en `Firplak_SA` (SAP: `OWOR`, `ORDR`, `@FIR_FAM_SYMPH`, `@FIR_AMORTIGUADORES`, `@FIR_FECHAS_PROD`), con ventana móvil de 12 meses por fecha de creación. Indicador principal: `% CUMPLIMIENTO` (nivel de servicio), es decir, OP cerradas en o antes de la fecha ideal (liberación más amortiguador en días hábiles), contando solo las que ya vencieron. Sin RLS.
- `pendiente`: consultas de validación del desarrollador y respuestas de Manufactura a las 10 preguntas de la ficha.

## [2026-11-05] bi | NS Plantas: resultados de las consultas de validación

- Script ejecutable en `bi-origen/bi-ns-plantas/sql/validacion-fase1.sql` (paso 0 con la tabla temporal `#ns`, consultas 1 a 8 y limpieza opcional).
- Confirmado: 27 908 OP sin duplicados, ninguna sin fecha ideal; 18 familias con un amortiguador cada una, cuatro sin grupo (`ESPGAB`, `MBL CEFI`, `MBLP`, `PFZ-CEMA`); `@FIR_FECHAS_PROD` guarda días no laborables.
- Nivel de servicio mensual entre 55 % y 84 % (tabla en [la ficha](bi/ns-plantas.md#resultados-ejecutadas-por-el-desarrollador-el-2026-11-05)); noviembre de 2025 incompleto por la ventana de 12 meses.
- Hallazgos: solo 456 de 7 170 OP incumplidas tienen razón de retraso (pregunta 11). Hay demasiados sábados y domingos en `@FIR_FECHAS_PROD` para un año: `pendiente` la consulta 8 (fechas repetidas).

## [2026-11-05] bi | NS Plantas: consulta 8 (calendario de días no laborables)

- `@FIR_FECHAS_PROD` no tiene fechas repetidas: 268 filas y 268 fechas distintas entre el 2025-11-08 y el 2028-01-01. Los sábados y domingos de más de la consulta 7 son fechas futuras ya cargadas. No tiene columna de planta.
- Nuevo riesgo en [la ficha](bi/ns-plantas.md): el calendario vence el 2028-01-01. Se amplió la pregunta 1 (quién lo mantiene).
- Las consultas de validación de la fase 1 quedan completas; falta la validación de Manufactura.

## [2026-11-06] bi | Costo actual de PT: fase 5 cerrada y plan de conciliación (fase 6)

- El desarrollador asignó los permisos y probó el dashboard en la vista previa de Vercel, con sesión real y la descarga. PR: Indicadores_Firplak#2 y firplak-reporting-api#3.
- Fase 6: consultas de solo lectura en [`sql/costo-actual-pt/03_conciliacion.sql`](../sql/costo-actual-pt/03_conciliacion.sql) (C1 totales globales, C2 muestra de 11 productos por caso, C3 detalle con costos de SAP por bodega, C4 comparación contra el query optimizado) y tablas por llenar en la sección 6 de la [ficha](bi/costo-actual-pt.md).
- La conciliación es por producto, no por periodo (P9). Las diferencias con el Power BI deben tener causa D1–D9.

## [2026-11-06] bi | Costo actual de PT: primeros resultados de la conciliación

- C1: el portal suma 7.065.652.224,66 (11.276 productos) y el Power BI 6.959.525.480: +106,1 millones (+1,52 %). Sin CIF: +81,9 millones (+1,38 %). Falta C4 para separar el efecto de D9 del de las reglas corregidas.
- C2: registrados los valores del portal de 10 productos; faltan los del Power BI.
- C3 de `CMPD04-0268-000-0000`: el Power BI tomó el costo de `MP-01` en tres hojas del nivel 3. La causa está en la línea 331 del SQL original (`@Bodega3_` en lugar de `@Bodega2_`), y se precisa la explicación de la V7 (hallazgo H1). Se agrega la consulta C3b.

## [2026-11-06] cambio | Costo actual de PT: descarga en Excel (.xlsx)

- En la revisión, Contabilidad tenía que corregir a mano los números del CSV. Primero se cambió el CSV a coma de miles y punto decimal (`d1c65c2`), pero el desarrollador decidió pasar a `.xlsx` sin desplegar ese cambio, porque el CSV depende de la configuración regional de Excel.
- La API genera el `.xlsx` en streaming con `src/xlsx.ts`, sin dependencias nuevas: números como números, códigos como texto, encabezado fijo, filtros y formato `#,##0.00`. El portal solo cambia el proxy y los textos.
- Medido con 463.600 filas sintéticas: 6,5 s de CPU y 24,3 MB (el CSV pesaba ~104 MB). Excel lo abre en 6,7 s sin reparación. Si el usuario cancela a mitad, la generación falla limpia y se cancela la consulta.
- Despliegue: primero la API y después el portal. Rollback: volver a desplegar el paquete `dist` anterior (`aeb3f5b`, CSV con coma decimal) y revertir el commit del portal.

## [2026-11-06] cambio | Costo actual de PT: seis tarjetas de costo

- A pedido del desarrollador, el dashboard muestra tarjetas separadas de MP, MO y CIF (con su participación en el total) y los totales: costo total, sin CIF (MP + MO) y sin MO (MP + CIF). "Sin MO" se calcula en el navegador con `totalCost - laborCost`; la API no cambia.

## [2026-11-06] bi | Costo actual de PT: valores del Power BI de la muestra

- Con la exportación "Lista de Materiales" del Power BI se comparan 6 productos: `CBAN12-0027`, `CMPD04-0268` y `CMPD04-0261` coinciden. `VHPT05-0015` difiere en +477.436,48 (D9). `VCOC03-0370` difiere en −54.770,47 y `VBAN33-0005` en −4.799,75, solo en MP (`pendiente` de C3).
- `CMPD04-0268` coincide hoy y el 2026-11-04 no: confirma que H1 hace variar el resultado del Power BI entre actualizaciones.
- La exportación llegó cortada; faltan los totales de 4 productos.
- Con la exportación completa (`pbi_LdeM/`): `CBAN19-0001` y `CMPD04-0130` coinciden; `CBAN05-0001` (+1.817,70) y `CEXH01-0008` (+360.000) difieren por D3, como se esperaba. C4 queda escrita completa en `03_conciliacion.sql`, con el nombre de tres partes de la tabla.
- C4: 7.835 productos de hasta 4 niveles sin ninguna diferencia contra el query optimizado; 3.445 de más de 4 niveles con +71,98 millones (D9). C3b confirma H1: el costo de 293,14 de la tuerca es el de `MP-05`, una bodega que quedó de otro componente.
- `VBAN33-0005` explicado al peso con C3: −4.799,75 por H1 (el Power BI usó el costo de `MP-01` en 20 artículos). Los artículos sin costo en ninguna bodega valen 0 en las dos fuentes. Falta la C3 completa de `VCOC03-0370`.
- `VCOC03-0370` desglosado con C3: −59.366,50 de la placa de cuarzo `CQUA01-0001` (el Power BI usa 338.824, fuente `pendiente`), +5.955,31 de H1, −1.334,63 de D9 y −61,08 de movimientos de SAP.
- C3b de la placa `CQUA01-0001`: 338.824 es su costo en `MP-10`, la bodega de los componentes que el Power BI leyó justo antes (H1). Los 10 productos de la muestra quedan explicados; la fase 6 solo espera la aprobación de Contabilidad.
- Resumen de la conciliación enviado a Contabilidad por Teams. Las fases 6 y 7 se cierran con su respuesta, previsto para el martes 2026-11-10.

## [2026-11-06] cambio | Permisos por cargo y trazabilidad

- Decisión del desarrollador: los permisos se dan por **cargo** (uno por persona), no por área, con excepciones individuales. Los cargos se crean a medida que se necesitan.
- Cada informe tiene `area` en `lib/reports.ts`; el portal agrupa las cards por área. Los tipos de informe (indicador, visualización, descarga) quedan para después.
- Todo cambio exige soporte: correo o tarea de Planner (enlace), quién lo solicitó y quién lo aprobó (texto libre). Quién lo hizo y cuándo los pone el servidor.
- Migración `20261106_permisos_por_cargo.sql`: tablas `job_roles`, `job_role_reports`, `user_job_roles` y `access_change_requests`, historial ampliado, `current_user_access()` y `apply_access_change()`. El navegador ya no escribe directo en las tablas.
- `/admin/permisos` se rehace con las pestañas Usuarios, Cargos, Informes e Historial, el diálogo de soporte, "Dar acceso" a varios correos y el aviso "Ver personas" al cambiar un cargo.
- Probado en PGlite y validado por el desarrollador en Supabase y en el portal. La migración se ejecuta antes de desplegar el portal. Detalle en [Seguridad](concepts/security-and-secrets.md#permisos-por-informe).
- La solicitud de acceso desde el portal, con aprobación del jefe, queda para una segunda etapa.

## [2026-11-09] cambio | Facturación diaria: metas, empresas y entregas

- Pedido del desarrollador en 9 puntos; decisiones y reglas en [Facturación diaria](bi/facturacion-diaria.md).
- Nuevo informe `metas-comerciales` (`/metas-comerciales`): meta mensual de facturación y de entregas por empresa y días laborales (lunes a viernes menos festivos de Colombia, editables). Migración `20261109_metas_comerciales.sql` con RLS e historial, probada en PGlite.
- `/facturacion-diaria`: 3 cards de ventas (netas, acumuladas según la meta, cumplimiento) y 3 de entregas, gráfica de ventas netas acumuladas frente a la meta, botón para ver todas las zonas, filtro Empresa y Subgrupo de cliente en lugar de Cliente. Se retiran las metas fijas del código.
- Nueva página `/facturacion-diaria/entregas`.
- Reporting API: parámetros `empresa` y `subgrupoCliente` en facturación.
- `pendiente`: SP de `Informe_entregas` con devoluciones y NC de devoluciones (punto 8), confirmar la columna `CentroCostos` en `Informe_ventas` y desplegar.

## [2026-11-09] cambio | Entregas con devoluciones y NC de devolución (punto 8)

- El desarrollador compartió `SP_Generar_Informe_Entregas` y confirmó que la columna de `Informe_ventas` es `CentroCostos`.
- Script `sql/facturacion-diaria/01_informe_entregas_devoluciones.sql`: columnas `Empresa`, `TipoMovimiento`, `SubgrupoCliente` y `DocumentoBase`, nueva clave, devoluciones (`ORDN`) y NC de devolución (`ORIN`, sin las basadas en una devolución) en negativo, y Viventta. Con validación y rollback. Ejecución `pendiente`.
- Reporting API: `empresa` y `subgrupoCliente` en entregas; totales `delivered`/`returns`/`net` sin anulados; `filterOptions`. El portal muestra entregas netas, devoluciones y documento base.
- Reglas y riesgos en [Facturación diaria](bi/facturacion-diaria.md#entregas-con-devoluciones).

## [2026-11-09] ajuste | Metas en el menú del perfil y orden de filtros

- Revisión del desarrollador en el portal local. Metas comerciales deja de ser card del portal y botón de facturación: queda en el menú del perfil junto a "Permisos de informes", visible solo con el permiso `metas-comerciales` (`tool: true` en `lib/reports.ts`).
- Grupo de cliente va antes de Subgrupo de cliente.
- Empresa y Subgrupo no funcionaban porque el portal local consulta la API desplegada (`api.firplak.com`), aún sin la rama `feat/facturacion-metas-empresa`. El dashboard ahora avisa cuando la API conectada no envía `filterOptions.companies`.

## [2026-11-09] cambio | Metas de Firplak divididas en Nacional y Exterior

- Pedido del desarrollador: la meta de Firplak se divide en Nacional y Exterior, en facturación y en entregas. Segmentos: Firplak Nacional, Firplak Exterior, Viventta y CEFI.
- Filtro: Mercado Nacional = Firplak Nacional + Viventta; Exterior = Firplak Exterior; Empresa CEFI = solo CEFI. Reglas en [Facturación diaria](bi/facturacion-diaria.md#metas-por-segmento-nacional--exterior).
- Migración `20261109_metas_nacional_exterior.sql`, probada en PGlite (convierte las metas `Firplak` en Firplak Nacional).
- `Informe_entregas` agrega `TipoVentas` (script 01, repetible) y la API acepta `mercado` en entregas.

## [2026-11-09] cambio | CEFI fuera del filtro de mercado

- Decisión del desarrollador: con Mercado Nacional o Exterior, los datos de facturación y entregas excluyen CEFI, igual que la meta. Con la empresa CEFI el mercado no se aplica.
- El desarrollador confirmó que el despliegue de las metas por segmento, `TipoVentas` en entregas y la API quedó funcionando. Falta desplegar este ajuste de la API.

## [2026-11-09] cambio | Una sola meta y gráfica acumulada de entregas

- La meta de ventas y la de entregas son la misma (confirmado por el negocio): la pantalla de metas queda con una sola tabla.
- Las gráficas acumuladas de ventas y entregas solo muestran días laborales; lo de sábados y festivos suma al siguiente día laboral.
- `pendiente`: diagnosticar el reporte de "entregas en 0".


## 2026-11-10 — Carga incremental de entregas

- Las corridas INCREMENTAL de `SP_Generar_Informe_Entregas` fallaban con el error 468 (conflicto de intercalación entre `SQL_Latin1_General_CP850_CI_AS` y `SQL_Latin1_General_CP1_CI_AS`) en el `DELETE` que une `#Docs` con `Informe_entregas`. Las tablas temporales tomaban la intercalación de tempdb. Era un error de compilación y no pasaba por el `CATCH`, así que `Cargas_Log` quedaba con `Fin` en NULL. La carga COMPLETA no ejecuta ese `DELETE` y por eso funcionaba.
- Corrección en [`01_informe_entregas_devoluciones.sql`](../sql/facturacion-diaria/01_informe_entregas_devoluciones.sql): las columnas de texto de `#Docs` y `#Facturas` usan `COLLATE DATABASE_DEFAULT`, y el `TRY` cubre también la preparación.
- `pendiente`: entender por qué Viventta no carga entregas (posible exclusión del cliente `CN890927404-01`) y revisar el posible doble conteo entre devoluciones y NC de devolución.
- Decisiones del desarrollador (2026-11-10): las NC de devolución de entregas son las de `U_TIPOSNC = '01'`, y Viventta queda fuera de `Informe_entregas` porque no tiene entregas en SAP. La meta de entregas del portal ya no suma la meta de Viventta ([`lib/metas/targets.ts`](../lib/metas/targets.ts)).
- Ajuste del desarrollador (2026-11-10): CEFI vende en Nacional y en Exterior, así que Empresa CEFI + Mercado filtra por `TipoVentas` (`addFilters` y `addDeliveryFilters` en `reporting-api/src/db.ts`). Sin empresa, el mercado sigue excluyendo CEFI.
- Decisión del desarrollador (2026-11-10): la meta de CEFI se divide en CEFI Nacional y CEFI Exterior ([`20261110_metas_cefi_mercado.sql`](../supabase/migrations/20261110_metas_cefi_mercado.sql), probada en PGlite). La pantalla de metas tiene cinco columnas y `segmentsFor` usa los segmentos de CEFI según el mercado.

## [2026-11-10] proyecto | Consolidado comercial SAP: arranque

- Proyecto nuevo (no es migración de BI), rama `proyecto/consolidado-comercial`. Ficha: [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md).
- Decisiones: entregable en el portal; D desde `Informe_ventas`; queries de A, B y C se construyen desde cero; ubicación de objetos SQL pendiente de TI.
- Se agregó el script de descubrimiento de solo lectura `proyectos/consolidado-comercial/sql/01-descubrimiento.sql` y el cuestionario para la solicitante.

## [2026-11-10] proyecto | Consolidado comercial SAP: resultados del descubrimiento

- El desarrollador ejecutó las 14 consultas de `01-descubrimiento.sql`; resultados y lectura en [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md#resultados-del-descubrimiento).
- Hallazgos: sin facturas de reserva ni descuentos de encabezado; NC ya negativas en `Informe_ventas`; canal = grupo de cliente (`OCRG`); Firplak Home = tres centros de costos; 96 % del saldo de ofertas abiertas está vencido.
- Se agregaron `02-tablas-usuario.sql` (códigos de tablas de usuario, uso de campos, canal e IVA en `Informe_ventas`) y `03-diagnostico-saldo.sql` (diferencia `OpenSum` vs proporcional y posibles dobles conteos A–B y B–D).

## [2026-11-10] proyecto | Consolidado comercial SAP: tablas de usuario y uso de campos

- El desarrollador ejecutó `02-tablas-usuario.sql` completo; resultados en [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md#resumen-de-02-tablas-usuariosql).
- Confirmado: Tipo OV = `U_TipoPedidos`; Status entrega solo se llena en entregas (filtro aplica a C); B2C = subgrupos 106-xx; centro de costos con respaldo del cliente cubre el 100 %; `Informe_ventas.ValorTotal` = `LineTotal` sin IVA y el `SlpCode` se recupera al 100 % desde `OINV`.
- `Firplak_SA` y `Planos_Symphony` están en nivel de compatibilidad 100: el SQL del proyecto no usa `TRY_CONVERT`.

## [2026-11-10] proyecto | Consolidado comercial SAP: diagnóstico de saldos y dobles conteos

- El desarrollador ejecutó `03-diagnostico-saldo.sql` (6 consultas); las versiones con CTE y `OUTER APPLY` fallaron con error de sintaxis y se reescribieron con subconsultas y `GO` por consulta.
- Decisión técnica: el saldo abierto se calcula como `LineTotal * OpenQty / Quantity`; `OpenSum` no se reduce en líneas parciales (ofertas: 802 M de diferencia).
- Doble conteo A–B: no hay por conversiones parciales y es despreciable por OV directas. Doble conteo B–D: hasta 25,7 M en 3 OV de un cliente de Constructores, pendiente de confirmar con la solicitante.

## [2026-11-11] ux | Una gráfica de acumulados y nuevo orden del resumen diario

- Ventas y entregas acumuladas quedan en una sola gráfica ([`CumulativeChart.tsx`](../components/dashboard/CumulativeChart.tsx)): ventas en navy, entregas en ocre (`chartColors.delivery`); una sola meta acumulada punteada, porque es la misma para ventas y entregas.
- Tabla "Facturación y entregas por día": Año, Mes, Día, Entr día, Entr mes, Fac día neta, Fac mes neta, Meta día, Meta acumulada, Total NC, Fac día bruta. El acumulado mensual ahora es neto (antes bruto).
- Validación: `tsc --noEmit` y ESLint sin errores.

## [2026-11-11] cambio | Nombre del informe y descargas de los detalles

- El informe se llama "Facturación y entregas diaria" (portal, encabezado y menú). "Detalle de documentos" pasa a "Detalle de facturas".
- Botón **Descargar** en Detalle de facturas y Detalle de entregas: `.xlsx` con los filtros aplicados, números y fechas como celdas numéricas para Excel ([reporting-api](components/reporting-api.md), [frontend](components/frontend.md)).
- Validación: `tsc` y ESLint del portal sin errores; `tsc` de la API sin errores; el escritor `.xlsx` se probó con datos de ejemplo (openpyxl lee fechas y números con formato).
- La descarga de facturas trae todas las columnas de `Informe_ventas` menos los campos internos de SAP como `DocEntry` y `LineNum` (leídas de la tabla en cada descarga) más Empresa (portal), Facturado, NC y Neto.
- `pendiente`: desplegar la Reporting API (`reporting-api-dist-descargas.zip`) y probar las descargas contra SQL Server.
- Cards: "Ventas acumuladas (meta)" y "Entregas acumuladas (meta)" pasan a "Meta"; "Cumplimiento de ventas" pasa a "Cumplimiento de facturación".

## [2026-11-11] ux | Tabla diaria, Hasta ayer y filtros compactos

- Resumen diario: Día como primera columna fija, "Meta acumulada" pasa a "Meta mes", nueva columna Diferencia (Fac mes neta − Meta mes) y Fac día bruta antes de Total NC.
- Botón **Hasta ayer**: corta toda la página en el día anterior (`fechaHasta` en las consultas) y la meta acumulada.
- Barra de filtros compacta y fija; los filtros se aplican al elegirlos. Tarjetas compactas (6 en una fila en pantallas anchas).
- Recuadro de la gráfica de acumulados con la diferencia entre la facturación neta y la meta.
- Detalle en [Facturación diaria](bi/facturacion-diaria.md). Validación: `tsc` y ESLint sin errores; `pendiente` revisar en el navegador.
- Resumen diario: cada meta queda junto a su facturación (Fac día neta, Meta día, Fac mes neta, Meta mes).

## [2026-11-11] proyecto | Consolidado comercial SAP: respuestas de la solicitante

- Daniela Castro respondió el cuestionario de 15 preguntas; resumen en [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md#respuestas-de-la-solicitante-2026-11-11) y decisiones 5 a 16 en la ficha.
- Cambios de alcance: solo Firplak; sin IVA; corte = estado actual (sin fotos diarias); A = todas las ofertas abiertas del Canal B2C, sin filtro de vigencia; MAC fuera; asesor = vendedor del documento, sin seguridad por cartera; nada se cierra en SAP.
- Se revisa la decisión 3: sí existen los queries “Visor OV” y “Tránsito” (Logística), “Ofertas de venta” y “Facturación detallada”; se piden como referencia.
- Se agregó `proyectos/consolidado-comercial/sql/04-ofertas-b2c.sql` para medir las ofertas B2C. Quedan 7 preguntas de seguimiento.

## [2026-11-11] proyecto | Consolidado comercial SAP: ofertas B2C

- El desarrollador ejecutó `04-ofertas-b2c.sql`; resultados en [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md#04-ofertas-b2csql-ejecutado-por-el-desarrollador-el-2026-11-11).
- Ofertas abiertas B2C: 45 ofertas, 163,1 M, todas en COP y desde 2025; A por defecto (sin MAC) ≈ 162,8 M. Las ofertas antiguas están en Distribución.
- El Tipo OV está vacío en el 26 % del saldo de ofertas B2C: A no filtra por Tipo OV salvo como filtro opcional. Nueva pregunta de seguimiento 8 (tipo 15 en ofertas).

## [2026-11-11] proyecto | Consolidado comercial SAP: query Visor OV

- Se guardó el query “Visor OV” de Logística en `proyectos/consolidado-comercial/fuentes/visor-ov.sql` y se analizó en [proyectos/consolidado-comercial.md](proyectos/consolidado-comercial.md#query-visor-ov-de-logística-recibido-el-2026-11-11).
- Confirma `RDR1.ShipDate` como fecha de despacho. Diferencias con B: el Visor no filtra por estado de línea, usa el vendedor de la línea y pierde líneas por `INNER JOIN`.
- Se agregó `proyectos/consolidado-comercial/sql/05-contraste-visor-ov.sql` para medir esas diferencias y saber de qué vendedor sale `VendedorSenior` en `Informe_ventas`.

## [2026-11-11] proyecto | Consolidado comercial SAP: contraste con el Visor OV

- `05-contraste-visor-ov.sql` ejecutado completo (la 5 sin filas: la tabla de familias no duplica): el saldo de OV del Visor y el nuestro coinciden exacto; el Visor no pierde líneas relevantes por sus `INNER JOIN`; en B2C el vendedor del encabezado y el de la línea son iguales.
- `VendedorSenior` de `Informe_ventas` no es ni el vendedor del encabezado ni el de la línea en todos los casos. Hipótesis tomada del query de facturas del repositorio: depende de `U_TIENDAS` de la línea. Se agregó `proyectos/consolidado-comercial/sql/06-vendedor-tienda.sql` para comprobarla.

## [2026-11-11] proyecto | Consolidado comercial SAP: regla del asesor confirmada

- Consulta 1 de `06-vendedor-tienda.sql`: la regla “sin tienda → vendedor del encabezado; con tienda → vendedor del cliente-tienda” reproduce `VendedorSenior` de `Informe_ventas` en las 5.070 líneas de factura revisadas. Se adopta para A, B y C.
- Consultas 2 a 4 de `06`: `U_Tiendas` existe en ofertas, OV, entregas, facturas y NC. En OV y entregas B2C abiertas no se usa (la tienda se llena al facturar); la regla solo cambia 1 línea de 0,1 M en otros canales.

## [2026-11-11] proyecto | Consolidado comercial SAP: query Tránsito

- Se guardó el query “Tránsito” en `proyectos/consolidado-comercial/fuentes/transito.sql` y se analizó en la ficha. Fecha ProyFAC = `ODLN.U_FechaRadFAC`; centro de costos = `DLN1.CogsOcrCod`; asesor del encabezado.
- El query suma `LineTotal` completo y repite filas por factura parcial. Se agregó `proyectos/consolidado-comercial/sql/07-contraste-transito.sql` para medir el valor, los filtros de Status entrega y Fecha ProyFAC, el Tipo OV, el centro de costos y el uso de campos.
- `07-contraste-transito.sql` ejecutado completo. En B2C el método de Logística y el proporcional coinciden (73,14 M) y los filtros de Status entrega y Fecha ProyFAC hoy no quitan nada; la exclusión de Tipo OV quita el 55 % (40,2 M, sobre todo el tipo 15 de reabastecimiento a tiendas), dejando C B2C ≈ 32,9 M. `CogsOcrCod` = `OcrCode` cuando están llenos. Se agregaron las preguntas de seguimiento 10 a 12.

## [2026-11-11] proyecto | Consolidado comercial SAP: destino de los objetos y query de B y C

- Decisión 4 cerrada: patrón estándar del portal (tabla + SP en `Planos_Symphony`, script en este repositorio, endpoint en `reporting-api`). A–C se recargan completas en cada corrida.
- Se agregó `proyectos/consolidado-comercial/sql/08-query-b-c.sql`: versión de validación (solo lectura, tabla temporal) del query de B y C con todas las reglas verificadas, columna `EnDefault` y 5 pestañas (embudo de filtros, asesor, centro de costos, controles y detalle).
- `08-query-b-c.sql` validado (5 pestañas): default B2C B = 461,1 M (213 líneas) y C = 30,5 M (49 líneas); controles en cero; centro de costos y subgrupo coinciden. Hallazgos para la solicitante: 72 % de B bloqueado, una OV de 191,0 M (41 % de B) y 17,1 M con tipo de ventas “Excluido”.
- Se agregó `proyectos/consolidado-comercial/sql/09-query-a.sql`: query de validación de A (ofertas) con las mismas columnas que B y C; default = B2C sin MAC y sin Donaciones, sin filtro de vigencia ni de Tipo OV.
- El agente no tiene acceso a `Planos_Symphony` (inicio de sesión rechazado para `FIRPLAK\milton.rendon`, 2026-11-11). Se agregó `proyectos/consolidado-comercial/sql/10-inventario-planos.sql` para que el desarrollador revise si ya existen objetos de ofertas, OV o tránsito antes de crear la tabla del proyecto.
- Inventario de `Planos_Symphony` (`10`, pestañas 1 a 4): nada lee ofertas; existen versiones del Visor OV de 2023–2024 y `Informe_entregas`, que es el query de Tránsito materializado. Se agregó `proyectos/consolidado-comercial/sql/11-contraste-informe-entregas.sql` para decidir si C se lee de esa tabla.
- Pestaña 5 de `10`: los jobs del Agente SQL ejecutan `SP_Generar_Informe_Entregas` y `SP_Generar_Informe_Ventas` en modo completo e incremental; ningún job ejecuta los SP del Visor OV.

## [2026-11-13] proyecto | Consolidado comercial SAP: validación del query de A

- `09-query-a.sql`, pestañas 1 a 3: default A = 154,2 M (43 ofertas B2C). No hay ofertas sin cliente en el maestro; la diferencia `03`–`04` fue un cambio de datos entre días.
- `GV-BH*` son centros de costos inhabilitados de Firplak Home (37,5 M de ofertas); se propone una columna “centro de costos vigente” que los traduzca a `GV-FH*`, pendiente de Contabilidad.
- `09-query-a.sql` validado (controles en cero). Se corrigió el mapeo de `U_Estado_Oferta_Venta` (valores `01`–`03`). La oferta tipo 15 más grande es a la propia tienda Firplak Home Bogotá.
- Segunda corrida de `09`: con el estado corregido, el default A se reparte en pendientes ≈ 126,9 M, confirmadas 27,0 M y canceladas 0,3 M.
- `11`, consulta 1: `Informe_entregas` se carga al minuto (completa 02:15 + incrementales) y mezcla entregas, devoluciones y notas crédito de devolución; las consultas 2 a 5 se corrigieron para filtrar `TipoMovimiento = 'Entrega'`.
- `11`, consultas 2 a 4: `Informe_entregas` agrega entregas nuevas pero no cierra en el día las facturadas (31 líneas). Se recomienda leer C de SAP en la misma carga que B; la tabla queda para conciliar.

## [2026-11-13] proyecto | Consolidado comercial SAP: tabla de reporte y SP

- Decisión 17: C se lee de SAP en la misma carga que A y B (aprobada por el desarrollador).
- Se agregó `sql/consolidado-comercial/01_informe_consolidado_comercial.sql`: tabla `Informe_consolidado_comercial` (A, B y C por línea), SP de recarga completa con bitácora, índices, validación y job propuesto. Pendiente de revisión y ejecución por el desarrollador o TI.

## [2026-11-17] proyecto | Consolidado comercial SAP: ejecución del paso 4

- El desarrollador es también TI: las preguntas a TI pasan a ser tareas propias (crear tabla, SP, job y permiso de la API). Se entrega la lista de ejecución de `01_informe_consolidado_comercial.sql`.
- Objetos creados en `Planos_Symphony` y primera carga: 4.217 filas, bitácora `OK`. Default: A 148,5 M, B 466,8 M, C 59,7 M; controles de nombres en cero. Falta cuadrar contra `08` y `09` del mismo momento.
- Validación contra `08` y `09`: B y C exactos; A exacto en B2C y default, con 2 líneas (153.030) más en `09` fuera de B2C, probablemente ofertas nuevas entre corridas.
- Las 2 líneas de A eran la oferta 7473, creada a las 11:17 (después de la carga de las 11:16). Tabla validada; faltan el job y el permiso de la API.
- Job “BI - Consolidado comercial carga completa” creado y probado (corrida 11:31, 4.219 filas, OK). Decisión 8 cerrada: cada 30 min de 6:00 a 20:00. Script en `sql/consolidado-comercial/02_job_consolidado_comercial.sql`.
- Permiso de la API: no aplica (la API corre en el servidor de la base). Paso 4 cerrado; sigue el endpoint en reporting-api.

## [2026-11-17] proyecto | Consolidado comercial SAP: endpoint en reporting-api

- `GET /api/v1/consolidado-comercial` en la rama `proyecto/consolidado-comercial` de `reporting-api` (sin commit): A–C de `Informe_consolidado_comercial`, D de `Informe_ventas` con el mismo default y filtros. Compila (`tsc`); falta probarlo contra SQL Server.
- `12-validacion-endpoint.sql`: formato de `SubgrupoCliente` en D y cifras esperadas de A–D para comparar con el endpoint.

## [2026-11-17] bi | NS Plantas: validación de Manufactura y propuesta de tabla (fases 1 y 2)

- Respuestas de Manufactura registradas en [la ficha](bi/ns-plantas.md#respuestas-de-manufactura-recibidas-el-2026-11-17): se confirman la regla de la fecha ideal y la del sábado; historia completa; meta del 90 % por planta y general; se elimina la página duplicada; el filtro abre en el mes en curso; 8 plantas (4 grupos y 4 familias sin agrupar); solo OP con pedido; actualización a las 6:00 y a las 17:00; la gráfica de razones se conserva.
- `pendiente`: aclarar la pregunta 3 (si las OP abiertas en plazo cuentan en el %) y la 11 (barra "Sin razón registrada"). No cambian la tabla.
- Propuesta de la fase 2 en la ficha: `Planos_Symphony.dbo.Informe_ns_plantas`, una fila por OP (`DocEntry`), fecha ideal calculada por conjuntos, recarga de OP abiertas o modificadas en 7 días, completa semanal, bitácora `dbo.Cargas_Log`. Consultas previas en `bi-origen/bi-ns-plantas/sql/validacion-fase2-previa.sql`.

## [2026-11-18] proyecto | Consolidado comercial SAP: dashboard en el portal

- Se trajeron a la rama `proyecto/consolidado-comercial` los cambios de `origin/main` (avance rápido; conflicto solo en este log, se conservaron las dos partes).
- Endpoint desplegado en el servidor por el desarrollador (paquete con `dist/` y dependencias de producción).
- Dashboard nuevo: `/consolidado-comercial` (tarjetas A–D y total, composición, desglose por asesor, segmento y centro de costos) y `/consolidado-comercial/detalle` (líneas de A–C por etapa). Proxy `/api/consolidado-comercial`, informe `consolidado-comercial` en `lib/reports.ts`, estilos en `app/styles/commercial.css`.
- Validación: `tsc`, ESLint y `next build` sin errores. `pendiente`: revisión en el navegador con datos reales y asignar el informe a la solicitante en `/admin/permisos`.

- Dashboard probado por el desarrollador con `npm run dev` y datos reales: carga bien. Paso 6 funcional; sigue el paso 7 (conciliación y despliegue).
- `12-validacion-endpoint.sql`, pestaña 1: `SubgrupoCliente` trae el nombre del subgrupo (Firplak Home, e-commerce, MAC); el endpoint ya lo homologa. D default esperada: unos 168,9 M (340 líneas) menos Donaciones.
- Pestaña 2: D default esperada = 340 líneas, 162 documentos, 168.910.964,90 (cuadra con la pestaña 1; sin Donaciones en el mes). Falta compararla con el dashboard y la pestaña 3 (A–C).
- Pestaña 3 y tarjetas del dashboard (carga 10:30:01): A, B, C, D y total cuadran exacto con SQL (836,43 M). Endpoint y dashboard validados. Ajuste: en el mes en curso el dashboard pide la facturación hasta hoy (antes mostraba el mes completo en la tarjeta D).
- Se pasó la rama `Ale` a `main` (avance rápido, 07643ee) y se trajo `main` a `proyecto/consolidado-comercial`. El informe `carga` de `Ale` usa el icono `Layers`; el consolidado pasa a `Handshake` para distinguirlos. `tsc`, ESLint y `next build` sin errores con todo junto.

## [2026-11-18] bi | NS Plantas: aclaraciones de Manufactura (preguntas 3 y 11)

- Pregunta 3: el nivel de servicio se mide al llegar el plazo. El % cuenta solo las OP con fecha ideal vencida, como en el BI (84,15 % en noviembre al 2026-11-05).
- Pregunta 11: la gráfica de razones de retraso agrega la barra "Sin razón de atraso" para las OP incumplidas sin razón registrada.
- Calendario laboral: los días no laborables salen del calendario de Colombia (sábados, domingos y festivos de ley), generado por fórmula en `Planos_Symphony.dbo.Calendario_Laboral`, en lugar de `@FIR_FECHAS_PROD` (cargada solo hasta el 2028-01-01). El sábado sigue sin contar, como en el BI. Se agrega la consulta previa 5 para comparar los dos calendarios.

## [2026-11-18] bi | NS Plantas: resultados de las consultas previas a la fase 2

- 268 658 OP desde 2013, `DocEntry` y `DocNum` únicos; 396 abiertas. `UpdateDate` se mueve al cerrar, lo que confirma la carga incremental. Solo el 1,7 % de las OP tiene razón de retraso.
- `@FIR_FECHAS_PROD` solo tiene 2025 a 2028. La fórmula de festivos de Colombia coincide con SAP en todos los festivos de ley; SAP trae 9 días propios de Firplak (24 y 31 de diciembre, 2 y 3 de enero de 2025, un lunes de julio).
- Decisión: calendario laboral = sábados, domingos y festivos de Colombia ∪ `@FIR_FECHAS_PROD`, de 2013 a 2040.

## [2026-11-18] bi | NS Plantas: scripts de la fase 2

- Diseño de la tabla aprobado por el desarrollador.
- `sql/ns-plantas/01_informe_ns_plantas.sql`: `dbo.Calendario_Laboral` (2013 a 2040, festivos de Colombia por fórmula ∪ `@FIR_FECHAS_PROD`), `dbo.Informe_ns_plantas` (una fila por OP), `dbo.sp_Actualizar_Calendario_Laboral`, `dbo.sp_Actualizar_Informe_ns_plantas` (incremental y completa, bitácora `dbo.Cargas_Log`) y consultas de validación, entre ellas la comparación de la fecha ideal contra el SQL original del BI.
- `sql/ns-plantas/02_job_ns_plantas.sql`: jobs `BI - NS Plantas carga incremental` (lunes a sábado, 6:00 y 17:00) y `BI - NS Plantas carga completa` (domingo, 2:00).
- Sin CTE, `APPLY`, `TRY_CONVERT`, `CREATE OR ALTER` ni `THROW` (nivel de compatibilidad 100). `pendiente`: ejecución, primera carga y validación por el desarrollador.

## [2026-11-18] bi | NS Plantas: primera carga y validación de la fase 2

- El desarrollador ejecutó `01_informe_ns_plantas.sql`. La carga completa insertó 268 658 OP en 13 s; la incremental recargó 943 OP en menos de 1 s.
- La fecha ideal coincide con el SQL original del BI en las 27 737 OP comunes (0 diferencias). Las 99 OP solo en la tabla son del día del límite de 12 meses (2025-11-18).
- Nivel de servicio de noviembre al 2026-11-18: 81,63 % (880 de 1 078). `pendiente`: compararlo con la tarjeta del BI y crear los jobs.
- Nivel de servicio contra el BI: el BI actualizado muestra 81,60 %, igual que el SQL del BI con sus reglas DAX; la tabla da 81,63 % por 2 OP del día del límite de 12 meses. Validación de la fase 2 cerrada; `pendiente`: crear los jobs.
- Jobs creados; corrida manual del job incremental a las 11:52 sin error (943 OP). Fase 2 aprobada por el desarrollador.

## [2026-11-18] bi | NS Plantas: propuesta de contrato del endpoint (fase 3)

- `GET /api/v1/ns-plantas` sobre `Informe_ns_plantas`: cumplimiento calculado en SQL con la fecha del servidor, resumen (`serviceLevel`, meta 0,9, medidas, cumplidas, incumplidas, en curso), series diaria y mensual, resumen por planta y razones de retraso con "Sin razón de atraso".
- Decisiones para aprobar: incumplidas sin las OP en curso (el BI las sumaba), razones solo de OP medidas, gráfica mensual del año completo y resumen por planta nuevo.
- Contrato aprobado por el desarrollador con las decisiones A a D.

## [2026-11-18] bi | NS Plantas: endpoint en la API (fase 4)

- `reporting-api`, rama `bi/ns-plantas`, commit `18be860`: `GET /api/v1/ns-plantas` según el contrato. Compila sin errores.
- `pendiente`: paquete `dist` para el servidor (debe incluir también el consolidado comercial si ya está desplegado) y prueba en el servidor.
- Paquete `reporting-api-dist-7a016a9.zip` desde la rama local `deploy/2026-11-18` (NS Plantas + consolidado comercial, que ya está en el servidor).

## [2026-11-18] bi | NS Plantas: dashboard (fase 5)

- Se trajo `main` a `bi/ns-plantas` (catálogo de informes, permisos por cargo y componentes comunes).
- Dashboard `/ns-plantas` y `/ns-plantas/detalle` con proxy, tipos, estilos propios y registro en `lib/reports.ts` (área Operaciones). Lint y build sin errores.
- `pendiente`: revisión visual con datos reales y permisos del usuario de Manufactura.

## [2026-11-13] migracion | Inicio de la migración del BI PKT

- Rama `bi/pkt` creada desde `main` en `Indicadores_Firplak`. La rama de `reporting-api` se crea en la fase 3.
- Exportación del reporte en [`bi-origen/PKT/`](../bi-origen/PKT/).
- Ficha [PKT](bi/pkt.md) en fase 0: dueño Dirección Financiera, desarrollador Daniel Jimenez, usuario direccionfinanciera@firplak.com, prioridad baja.
- Alcance: páginas "General" y "Graficas"; "Duplicado de General" se descarta.

## [2026-11-13] migracion | PKT, fase 1 (análisis)

- Ficha [PKT](bi/pkt.md), sección 1: PKT = KTNO ÷ ventas proyectadas; KTNO = 5 conceptos de capital de trabajo + 7 de proveedores de bienes y servicios, con saldos de fin de mes de `Firplak_SA` (`JDT1`, `OJDT`, `OACT`); ventas netas de facturas y notas de Firplak.
- Riesgos: consultas por año mantenidas a mano (`Cap_Trab_2020` a `2025`), `Cap_Trab_2024` en error en el archivo, posible duplicación de ventas por el cruce con `CostosGlobal`, proyección del mes en curso.
- Sin RLS. Se agregó `.gitignore` a [`bi-origen/PKT/`](../bi-origen/PKT/) para excluir `localSettings.json` y `cache.abf`.
- `pendiente`: validación de Dirección Financiera (8 preguntas) y resultados de las consultas V1 a V4.

## [2026-11-19] decisión | PKT, respuestas de la fase 1

- Decisiones D1 a D8 en la [ficha PKT](bi/pkt.md#respuestas-y-decisiones-2026-11-19): solo meses cerrados; comparativo fijo contra diciembre del año anterior; cuentas vigentes; se excluye el área de valoración "Local"; ventas desde `Informe_ventas` con las reglas del endpoint de facturación; eliminación de saldos entre Firplak y Viventta; desde 2020; dos gráficas.
- Resultados: V1 sin duplicados en `CostosGlobal`; V2 con cinco áreas de valoración, todas con neto 0; V3 da un KTNO de 3.707.635.179,62 a octubre de 2026 (antes de la eliminación con Viventta); PKT calculado 6,05 % y PKT del año anterior 5,89 %.
- `pendiente`: P1 (alcance de la eliminación entre compañías, consulta V5), P2 (Impuestos por pagar da 0) y P3 (diseño de las dos gráficas), y comparar V3 y V4 con Power BI.
- V5b (corte 2026-10-31): el saldo recíproco cuadra (Firplak CXP Viventta 486.272.023,68 frente a Viventta 13050505 + 13809510 = 486.272.023,70). En Firplak ninguna cuenta del PKT tiene saldo con Viventta (23359530 ya se excluye); en Viventta sí (Clientes 475.284.445,19). Diferencia de 156.664,00 entre 13809515 de Firplak y 23359505 + 28050505 de Viventta (`pendiente`).
- Comparación con Power BI: V3 cuadra exacto con la matriz (diciembre de 2025 y octubre de 2026), validado por el desarrollador. `Cap_Trab_2024` sí tiene datos en el BI publicado. Las ventas de `Informe_ventas` quedan 27.658 mil por debajo del BI en 2025 (0,047 %) y 5.420 mil de enero a octubre de 2026; el PKT redondeado no cambia. Consulta V6 para ubicar la diferencia (`pendiente`).
- D9 a D13: PKT consolidado Firplak + Viventta restando solo los saldos recíprocos que coincidan, sin vista por compañía; ventas de Firplak a Viventta ya restadas en el BI (`pendiente` ubicar la regla, V7); Impuestos por pagar se mantiene (0 hasta el cierre fiscal); dos gráficas aprobadas; la tabla conserva la organización de la página General. El PKT consolidado no será igual al del BI: la conciliación se hará por compañía.

## [2026-11-19] migracion | PKT, fase 1 cerrada

- Claudia Duque (Dirección Financiera) valida las reglas D1 a D14, por medio del desarrollador.
- D14: las ventas proyectadas incluyen Viventta. V7: no hay ventas entre compañías en `Informe_ventas` ni facturas de Firplak a Viventta desde 2025, así que no se resta nada en ventas.
- Hallazgo abierto para la fase 6: las ventas del BI superan a las de `Informe_ventas` en 27.658 mil en 2025 (V6 sin ejecutar).

## [2026-11-20] bi | Liberación: razones desde la app de Logística

- El Excel `Razones incumplimiento lib.xlsx` se migró a la app de Logística (proyecto aparte, Supabase Manufactura, schema `logistica`): una razón por OP, 40 492 OP de histórico más lo que se registre en el formulario.
- Decisión del desarrollador: opción A. Las razones vigentes se sincronizan a una tabla en `Planos_Symphony` y la API las cruza en SQL. Se descartó consultar Supabase en cada petición. Diseño y pendientes en [la ficha](bi/liberacion.md#razones-de-planeación-decisión-del-desarrollador-2026-11-20).
- Pregunta 1 respondida en parte (falta la fecha de corte del Excel con Logística); la 8 ya no aplica. Nuevas preguntas 15 (cumple con cambio de fecha) y 16 (fecha programada de la app).
- El script del SP quedó enlazado en la ficha: `bi-origen/bi-liberacion/sql/FPK_INDICADOR_LIBERACION.sql`.
- Decisión del desarrollador: se construye con Supabase sin esperar la fecha de corte del Excel.

## [2026-11-20] bi | Liberación: fase 2, scripts de tablas, envío de razones y endpoint

- Plan aprobado por el desarrollador. Se avanza sin la validación de Logística de la fase 1: las tablas no guardan reglas de cumplimiento.
- `sql/liberacion/01_informe_liberacion.sql`: `dbo.Informe_liberacion` con tipos reales y `dbo.sp_Actualizar_Informe_liberacion` (`MERGE` desde `Indicador_Liberacion`; conserva las OP que salen de la ventana de 365 días). `03_job_liberacion.sql`: job `BI - Liberacion carga`, lunes a viernes 17:15.
- Razones: el desarrollador descartó un servidor vinculado o un driver en ITPLAKINFO. Supabase (`pg_cron` + `pg_net`) envía la vista `logistica.razones_lib_vigentes` a `POST /api/v1/liberacion/razones` cada 15 minutos si cambió. La API reemplaza `dbo.Informe_liberacion_razones` con `dbo.sp_Cargar_Informe_liberacion_razones` (`02_razones_liberacion.sql`). Token propio `LIBERACION_RAZONES_TOKEN`; el usuario de la API solo recibe `EXECUTE` sobre el SP y el tipo.
- Validación hecha: la API compila; pruebas locales de la ruta (401 sin token o con otro token, 400 por JSON o versión inválidos, 413 por tamaño, 404 en GET); la vista probada en PGlite con un caso por regla; el JSON que arma Supabase pasa la validación de la API. Nada se ejecutó en SQL Server ni en Supabase.
- `pendiente` (desarrollador): ejecutar los scripts y pegar los resultados de las consultas 0 y 4 en la ficha; desplegar la API con `LIBERACION_RAZONES_TOKEN`; aplicar la migración de Supabase y crear los secretos en Vault.
- Rollback: al inicio de cada script y de la migración.
- Consultas previas 0.1 a 0.3 de `01_informe_liberacion.sql` ejecutadas por el desarrollador: los nombres y el orden de las columnas coinciden, el formato de las 29 942 filas es válido y los textos caben. El SP no necesita cambios.
- Primera carga de `Informe_liberacion` (29 942 OP en 3 s) y validaciones 4.1 a 4.4 correctas. Octubre de 2026 perdió 16 OP en el origen entre el 4 y el 20 de noviembre: los meses cerrados cambian en `Indicador_Liberacion` (pregunta 12). Detalle en la ficha.
- El desarrollador ejecutó `02_razones_liberacion.sql`, los `GRANT EXECUTE` al usuario de la API (`informes`, que solo tenía `db_datareader`) y el job `BI - Liberacion carga`.
- Rama local `deploy/2026-11-20` en `reporting-api`: `deploy/2026-11-19` (Estados Financieros, NS Plantas) más `bi/liberacion`. Conflictos de "ambos agregaron" en `src/server.ts` y `README.md`; compila y la ruta nueva responde. Sin push.
- Paquete de despliegue de la API: `reporting-api-dist-2b6f75b.zip` (en el escritorio, fuera de los repositorios), desde la rama local `deploy/2026-11-20` = `deploy/2026-11-19` + `bi/liberacion`. Verificado: `dist/server.js` tiene la ruta `/api/v1/liberacion/razones` y las de NS Plantas, balance y consolidado comercial. Sin dependencias nuevas. Variable nueva en el servidor: `LIBERACION_RAZONES_TOKEN`.
- API desplegada por el desarrollador (`reporting-api-dist-2b6f75b.zip`). Verificado desde fuera: `POST /api/v1/liberacion/razones` sin token responde 401 (la ruta existe y `LIBERACION_RAZONES_TOKEN` está configurado); `/health` 200; `/api/v1/ns-plantas` sin token 401, como antes.
- Supabase: secretos en Vault, migración `20261120_logistica_razones_lib_envio_liberacion.sql` aplicada por el desarrollador y primer envío forzado: la API respondió 200 con `received` 40 492 y `replaced` 0 (tabla vacía). Desde ahora `pg_cron` envía cada 15 minutos si hubo cambios. `pendiente`: validaciones 5.1 a 5.3 de `02_razones_liberacion.sql`.
- Validaciones 5.1 y 5.2 de las razones correctas: SQL Server y Supabase coinciden en las 44 razones (40 492 OP, 6 798 con cambio de fecha).
- Validación 5.3: las OP del indicador cruzan con sus razones; en los meses cerrados la cobertura se acerca a las incumplidas por fechas. La fase 2 cierra con la primera ejecución programada del job (2026-11-20 17:15).
- % de cumplimiento por mes con la regla completa del BI, calculado en SQL: agosto 85,4 %, septiembre 79,7 %, octubre 88,5 % de 2026. `pendiente`: compararlo con el Power BI.
- Comparación con el Power BI: agosto (85,43 %) y septiembre (79,68 %) de 2026 iguales con dos decimales. Octubre: portal 88,52 %, Power BI 88,45 % (1 o 2 OP de diferencia); hipótesis de fotos distintas, `pendiente` de confirmar con la hora de actualización y los conteos del Power BI.
- Power BI actualizado por el desarrollador antes de las 17:00: octubre de 2026 da 88,52 %, igual al portal (antes 88,45 %, por una actualización anterior). Agosto, septiembre y octubre coinciden con dos decimales.

## [2026-11-20] bi | Liberación: borrador del contrato del endpoint (fase 3)

- `GET /api/v1/liberacion` en la [ficha](bi/liberacion.md#3-contrato-del-endpoint): estado `ok`, `no`, `sinLiberar` o `noMedir` calculado en SQL con la regla validada; vistas `detalle`, `razones` (tabla de "Razones Día") y `control`; resumen con %, meta del 98 % (línea fija `0.98` en los visuales del Power BI), series diaria, mensual y anual, y cascada de razones de las OP `no`.
- Decisiones A a E `pendiente` de aprobación del desarrollador; las respuestas de Logística pueden cambiar reglas después.
- Contrato aprobado por el desarrollador (decisiones A a E).

## [2026-11-20] bi | Liberación: endpoint GET /api/v1/liberacion (fase 4)

- `reporting-api`, rama `bi/liberacion`: `src/liberacion.ts` con `buildReleaseQuery` y `getReleaseReport`; ruta en `src/server.ts`. Compila; prueba local de autenticación correcta.
- `sql/liberacion/04_validacion_endpoint.sql`: la consulta del endpoint para octubre de 2026, para correrla en SSMS antes de desplegar.
- Paquete `reporting-api-dist-d5a34f6.zip` desde `deploy/2026-11-20`. `pendiente`: validación en SSMS y despliegue.
- Consulta del endpoint validada en SSMS por el desarrollador (octubre de 2026): totales, series diaria, mensual y anual y cascada de razones cuadran entre sí y con la comparación contra el Power BI.
- API desplegada con `reporting-api-dist-d5a34f6.zip`. Verificado desde fuera: `GET /api/v1/liberacion` 401 sin token (la ruta existe); `POST /api/v1/liberacion/razones`, NS Plantas, balance y facturación 401; `/health` 200.

## [2026-11-20] bi | Liberación: dashboard con las 5 páginas del Power BI (fase 5)

- Pedido del desarrollador: lo más parecido posible al Power BI. Estructura tomada del `.pbip` y de sus capturas: columnas 100 % con "META: 98 %", acumulado por año, trimestre o mes, Pareto con línea del 80 % (la cascada del Power BI la tiene fija) y las tablas de Razones Día y Control.
- Rutas `/liberacion`, `/acumulado`, `/razones`, `/razones-dia` y `/control`; proxy `/api/liberacion`; informe `liberacion` en el área Logística. Colores del manual de identidad, no los del Power BI.
- Lint y build sin errores. `pendiente`: revisión con datos reales en 375, 820 y 1440 px y permiso en `/admin/permisos`.

## [2026-11-20] bi | Liberación: conciliación con el Power BI (fase 6)

- `sql/liberacion/05_conciliacion.sql`: % por mes y por día, Pareto por mes y OP sin razón, de septiembre a noviembre de 2026. Regla: comparar el mismo día antes de las 17:00.
- Agosto, septiembre y octubre iguales al decimal. Hallazgo `pendiente`: la captura diaria de octubre difiere en 6 de 20 días por 1 a 3 OP; probablemente el Power BI se actualizó después de la recarga de las 17:00 y el portal seguía con la de las 12:12 (octubre habría cambiado en el origen en un día, pregunta 12).
- Revisión responsive del dashboard aplazada por el desarrollador.

## [2026-11-23] migracion | PKT, fase 2 (script de tabla y SP)

- Scripts [`sql/pkt/01_informe_pkt.sql`](../sql/pkt/01_informe_pkt.sql) y [`02_job_pkt.sql`](../sql/pkt/02_job_pkt.sql): tablas `Informe_pkt_saldos` (fin de mes × compañía × concepto) e `Informe_pkt_intercompania`, SP `sp_Actualizar_Informe_pkt` con carga completa diaria y job `BI - PKT carga diaria` a la 1:00 p. m. Bitácora en `Cargas_Log`.
- Viventta: tiene `U_HBT_AreVal` (se aplica el filtro D4) y usa los mismos prefijos de cuenta (sin `2105`).
- Validación: consultas 4.1 a 4.6 contra V3 y V5b. Rollback: borrar el SP, las dos tablas y el job; no se tocan objetos existentes.
- `pendiente`: ejecución por el desarrollador y resultados de la validación.
- Primera carga ejecutada por el desarrollador (8 s, 2.047 filas, sin error). Validaciones 4.1 a 4.6 correctas: Firplak igual a V3 en los dos cortes, intercompañía igual a V5b (el filtro de área no cambia Viventta), 82 cortes con 24 filas. KTNO consolidado de octubre de 2026 = 3.685.648.698,30; PKT consolidado 6,00 %. `pendiente`: job creado y saldos 0 de inventario y proveedores en Viventta.

## [2026-11-23] migracion | PKT, fase 3 (contrato propuesto)

- Contrato de `GET /api/v1/pkt` en la [ficha](bi/pkt.md#3-contrato-del-endpoint): parámetros `anio` y `mes` (por defecto, el último corte), `period`, `periods`, `summary` (tarjetas de ventas y PKT), `statement` (matriz de la página General en su orden), `series.annualClose` y `series.monthly`. Sin `rows` ni paginación.
- `pendiente`: aprobación del desarrollador.- Contrato aprobado por el desarrollador (2026-11-23). `Informe_ventas` empieza en 2020: para 2020 no hay año anterior. Rama `bi/pkt` creada en `reporting-api` desde `main` (`e422f7b`).

## [2026-11-23] migracion | PKT, fase 4 (endpoint)

- `GET /api/v1/pkt` en `reporting-api`, rama `bi/pkt`: tipos, `getPktReport()` (un lote de 5 consultas), ruta con validación de `anio`/`mes`, README y `.env.example` (`REPORT_PKT_TABLE_SCHEMA`, `REPORT_PKT_TABLE`). Documentado en [Reporting API](components/reporting-api.md) y en la [ficha](bi/pkt.md#4-endpoint).
- Validación: `npm run build` sin errores; cálculo probado con datos simulados de octubre de 2026. `pendiente`: prueba del desarrollador contra la base.
- Rollback: el endpoint es nuevo; no cambia los demás. Basta con no desplegarlo o revertir el commit.- Prueba en el servidor (copia en el puerto 8090): `200`, cifras de octubre de 2026 iguales a la consulta 4.5; PKT consolidado 6,0043 % y año anterior 5,82 %. Fase 4 cerrada. `pendiente`: ventas de Viventta de 2025 (7,2 millones) frente a 2026.

## [2026-11-23] migracion | PKT, fase 5 (dashboard)

- Página `/pkt` con proxy `/api/pkt`, tipos, estilos `pkt.css`, informe `pkt` en el área Financiera del catálogo y navegación propia. Detalle en la [ficha](bi/pkt.md#5-dashboard) y en [Frontend](components/frontend.md).
- Validación: lint y build sin errores; revisión visual a 375, 820 y 1440 px con datos de prueba en una copia temporal (borrada).
- `pendiente`: asignar el informe a direccionfinanciera@firplak.com en `/admin/permisos` y probar con sesión y datos reales.

## [2026-11-23] ux | Contabilidad y finanzas en una categoría; gráficas del PKT aparte

- Portal: las áreas "Informes de contabilidad" e "Informes financieros" pasan a ser una sola, "Informes de contabilidad y finanzas" (`contabilidad-finanzas` en [`lib/reports.ts`](../lib/reports.ts)), con Costo de producto terminado y PKT. Los permisos no cambian: se guardan por informe, no por área.
- PKT: las gráficas pasan a `/pkt/graficas`; `/pkt` queda con las tarjetas, la matriz y el PKT. Menú lateral con las dos páginas. Detalle en la [ficha](bi/pkt.md#5-dashboard).
- Validación: lint y build sin errores.
- PKT: la barra de filtros usa la barra fija de Facturación (`billing-filterbar-sticky`) en `/pkt` y `/pkt/graficas`: queda bajo la barra superior al desplazarse desde 768 px. Lint y build sin errores.

## [2026-11-23] migracion | PKT, fase 6 (conciliación preparada)

- Script de solo lectura [`sql/pkt/03_conciliacion.sql`](../sql/pkt/03_conciliacion.sql) con seis resultados: saldos y tarjetas de Firplak frente al BI (parte A), Viventta, eliminación entre compañías y PKT consolidado (parte B), y ventas por mes con las reglas del BI frente a `Informe_ventas`.
- [Ficha](bi/pkt.md#6-conciliación-con-power-bi), sección 6: octubre de 2026, septiembre de 2026 y diciembre de 2025. Octubre y diciembre ya tienen los valores del BI (capturas del 2026-11-19); los saldos cuadran y el PKT cuadra al redondear.
- Hallazgos: H1 ventas de `Informe_ventas` frente al BI (−27.658 mil en 2025), H2 ventas de Viventta de 2025 (7,2 millones), H3 diferencia entre compañías de 156.664.
- `pendiente`: el desarrollador ejecuta el script, llena septiembre y presenta a Dirección Financiera para la firma. Fase 5 con pendientes de permisos y prueba con sesión.
- Capturas del 2026-11-23: el BI estaba en agosto de 2026 y el portal en septiembre, así que no se comparan entre sí. Se agrega agosto de 2026 como periodo de la conciliación (script y ficha) con los valores del BI. El portal carga con sesión y datos reales (PKT consolidado de septiembre 6,43 %).
- Octubre de 2026 conciliado con capturas del portal y del BI: cada diferencia es el saldo de Viventta después de la eliminación (KTNO −21.986.481,32) o H1 en las ventas. PKT del portal 6,00 % frente a 6,1 % (6,05 %) del BI, explicado por la consolidación. Faltan agosto o septiembre de 2026 y diciembre de 2025 completos.
- Diciembre de 2025 conciliado: 31 dic 2024 idéntico al BI (Viventta no existía) y ventas de 2024 iguales; diferencias de 2025 = Viventta y H1. Agosto de 2026: Clientes +475,8 M y PKT 7,17 % frente a 6,4 % (H4: la eliminación entre compañías no se aplicó porque el sentido no coincidía; `pendiente` confirmar con R4 y decisión de Dirección Financiera sobre la regla D9).
- Dirección Financiera (Claudia Duque): H1 aceptada, H2 correcto (Viventta se creó a finales de 2025), H3 pendiente de revisión.
- H4 confirmado con `Informe_pkt_intercompania` del 2026-08-31: diferencia de 239.900,02 en "Firplak debe a Viventta", por eso no se eliminan los 475.284.445,19 de Clientes de Viventta. Decisión: mantener la regla D9. Conciliación completa en octubre de 2026, agosto de 2026 y diciembre de 2025; `pendiente` la firma de Dirección Financiera.

## [2026-11-23] migracion | PKT, fase 6 cerrada

- Claudia Lorena Duque Alzate (Dirección Financiera) aprueba la conciliación por chat de Teams (2026-11-23, 2:46 p. m.). Periodos: octubre de 2026, agosto de 2026 y diciembre de 2025; hallazgos H1 a H4 en la [ficha](bi/pkt.md#hallazgos). H3 sigue pendiente de revisión por Contabilidad, sin efecto en el PKT.

## [2026-11-24] bi | Liberación: cierre de la fase 2

- El job `BI - Liberacion carga` corrió solo el 2026-11-20 y el 2026-11-23 a las 17:15, sin error (3 s; 5 y 2 OP borradas por salir del origen dentro de la ventana, es decir, canceladas o fuera de los filtros del SP de origen). Con eso queda cerrada la fase 2.

## [2026-11-24] bi | Liberación: conciliación del mismo día

- Septiembre (79,68 %) y octubre (88,56 %) de 2026 iguales al Power BI. Octubre cambió desde el 20 (88,52 %) en los dos sistemas: hallazgo del 20 resuelto y riesgo de la pregunta 12 confirmado.
- Noviembre: portal 88,64 %, Power BI 90,51 %. Causa probable: razones registradas en el Excel después de la última carga a Supabase (2026-11-20 09:55). `pendiente`: recargar Supabase desde el Excel y comparar de nuevo.
- Supabase recargado desde el Excel del 2026-11-23 12:44 (48 OP nuevas, 38 de ellas CUMPLE, y 1 editada). Confirma la causa de la diferencia de noviembre. `pendiente`: comparar de nuevo cuando Supabase envíe las razones al portal.
- Supabase envió las razones a las 9:00 (`Cargas_Log` Id 4010, 40 540). Noviembre quedó en 90,51 % (1 593 OK / 167 NO), igual al Power BI. Septiembre, octubre y noviembre coinciden al decimal; falta la firma de Logística para cerrar la fase 6.

## [2026-11-24] bi | Liberación: recarga automática y fase 7

- Recarga automática del Excel de razones a Supabase en el equipo del desarrollador (lunes a viernes 16:30, con verificación antes de cargar); detalle en el log del proyecto Logística.
- Fase 7 iniciada por decisión del desarrollador, con la firma de Logística pendiente. Ramas `bi/liberacion` subidas en los dos repositorios; el merge a `main` lo hace el desarrollador. [Reporting API](components/reporting-api.md) documentada. Estado, pendientes y rollback en la [ficha](bi/liberacion.md#7-despliegue-y-retiro).
- VibeWorkFlow (FIRPLAK, área Logística): flujo estándar «Consulta del indicador de liberación» (`ac9788e4-83d4-4853-8d24-aac1722fe74b`), con 5 acciones encadenadas, responsables por rol y el KPI. Pendiente: revisión del desarrollador.

## [2026-11-23] proyecto | Semáforo de producción: análisis, SP optimizado y contrato propuesto

- Fuente: SP `Planos_Symphony.dbo.SEMAFORO`, copiado sin cambios en [`proyectos/semaforo-produccion/fuentes/SEMAFORO_original.sql`](../proyectos/semaforo-produccion/fuentes/SEMAFORO_original.sql). Rama `proyecto/semaforo-produccion`.
- [Ficha](proyectos/semaforo-produccion.md): 12 problemas de lógica corregidos (L1–L12), 6 comportamientos conservados a confirmar (R1–R6) y 7 problemas de rendimiento (P1–P7).
- Scripts en [`sql/semaforo-produccion/`](../sql/semaforo-produccion/): tabla `dbo.Informe_semaforo_produccion`, SP `dbo.sp_Actualizar_Informe_semaforo_produccion` (por conjuntos sobre `dbo.Calendario_Laboral`, sin cursor), job cada 15 min de 6:00 a 20:00 y a las 0:05, y validación contra el original.
- `pendiente`: dueño de negocio, consultas previas (parte A), primera carga y comparación (parte B), aprobación del contrato de `/api/v1/semaforo-produccion`.
- Parte A ejecutada por el desarrollador: sin claves repetidas, unión por `DocNum` correcta (R2 cerrado), 23 lotes vacíos, tipo de pedido 2 con 0 días de distribución (L6 afecta a 631 OP), 55 OP sin tipo de orden y calendario cubierto. A2 falló (error 130) y se corrigió en [`03_validacion.sql`](../sql/semaforo-produccion/03_validacion.sql); `pendiente` repetirla.
- A2 repetida: 2.950 OP, 77 sin familia (23 sin pedido), 0 sin molde, amortiguador ni componentes: R1 y R4 cerrados. Primera carga del SP nuevo: 2.876 OP en 2 s, sin error (`Cargas_Log` 3924). La parte B falló por intercalación (tempdb `CP850` frente a `CP1` de `Planos_Symphony`, error 451); `#orig` pasa a `COLLATE DATABASE_DEFAULT`.
- Parte B: nuevo 1,8 s frente a 8,6 s del original; mismas 2.876 OP; cantidades, molde y amortiguador idénticos. Fechas recomendadas (95 = 67 L2 + 28 L3), ideal (8, L1) y prometida (630, L6) cuadran con las causas. B4 se cortó en 500 filas: se agregan B5 (diferencias por columna y causa) y B6 (detalle de `Revisar`) en [`03_validacion.sql`](../sql/semaforo-produccion/03_validacion.sql).
- Comparación cerrada (segunda corrida): 2.880 OP en los dos, nuevo 1,6 s frente a 7,3 s del original, B5 con todas las diferencias explicadas (L1, L2, L3, L6, L7, L8, L9 y derivadas) y 0 `Revisar`. Siguiente: job, validación de Manufactura y aprobación del contrato del endpoint.

## [2026-11-24] proyecto | Semáforo de producción: job cada hora

- El desarrollador cambia la frecuencia del job a cada hora de 6:00 a 20:00, y se mantiene la corrida de las 0:05. Actualizados [`02_job_semaforo_produccion.sql`](../sql/semaforo-produccion/02_job_semaforo_produccion.sql) (con `sp_update_schedule` por si el job ya existe) y la [ficha](proyectos/semaforo-produccion.md).
- Job creado por el desarrollador. Contrato de `/api/v1/semaforo-produccion` aprobado, con descarga en Excel. Implementado en `reporting-api`, rama `proyecto/semaforo-produccion` (`src/semaforo.ts`, tipos, ruta, `.env.example` y README); `npm run build` sin errores. `pendiente`: prueba local contra SQL Server, commit y despliegue. Detalle en la [ficha](proyectos/semaforo-produccion.md#endpoint-implementación).
- Paquete `reporting-api-dist-d4a4d32.zip` desde la rama local `deploy/2026-11-24` (deploy/2026-11-19 + `bi/pkt` + semáforo). Hallazgo: el zip de PKT del 2026-11-23 no incluía NS Plantas, consolidado ni estados financieros. Detalle en la [ficha](proyectos/semaforo-produccion.md#paquete-de-despliegue-2026-11-24).
- Corrección: el `fetch` de la API había fallado por credenciales; con la sesión de `gh` aparecieron `deploy/2026-11-20`, `deploy/2026-11-23` y el endpoint de Liberación en `main`. El paquete `d4a4d32` (sin Liberación) se borró y se reemplazó por `reporting-api-dist-c8b0a42.zip` = `deploy/2026-11-23` + semáforo. La alerta sobre el zip de PKT no aplica: `deploy/2026-11-23` trae todos los endpoints. Rama del semáforo rebasada sobre el `main` nuevo de la API y `main` del portal unido en `proyecto/semaforo-produccion`.
- Ramas subidas: `reporting-api` `proyecto/semaforo-produccion` y `deploy/2026-11-24`; portal `proyecto/semaforo-produccion`. PR abiertos: Firplak/firplak-reporting-api#7 y FirplakDesarrollador/Indicadores_Firplak#16.

## [2026-11-18] proyecto | Consolidado comercial SAP: dashboard en main

- PR #12 unido a `main` (merge `7e6762b`). Falta asignar el informe en `/admin/permisos`, revisarlo en producción y la conciliación de la solicitante. reporting-api queda sin commit por decisión del desarrollador.

## [2026-11-24] proyecto | Consolidado comercial SAP: cierre

- El desarrollador confirmó los cuatro pasos de cierre: despliegue en producción, permiso del informe `consolidado-comercial`, revisión en producción y conciliación con la solicitante. Paso 7 y proyecto cerrados; la ficha pasa a `status: active`.
- Las preguntas de seguimiento quedan como estaban el 2026-11-11. Siguen ediciones de visualización del dashboard.

## [2026-11-24] proyecto | Consolidado comercial SAP: filtros de selección múltiple y dependientes

- Filtros avanzados con selección múltiple; cada lista muestra solo los valores que existen con los demás filtros y con la vista. API: parámetros repetidos y `filterOptions.combinations` (rama `proyecto/consolidado-comercial` de `reporting-api`, sin commit). Portal: `MultiSelectFilter`, `lib/consolidado-comercial/filters.ts`, proxy con `append`.
- Paquete `reporting-api-dist-c8b0a42-consolidado-filtros.zip` (escritorio) = `deploy/2026-11-24` + este cambio; trae todas las rutas actuales del servidor. `pendiente`: despliegue y prueba con datos reales. Detalle en la [ficha](proyectos/consolidado-comercial.md#filtros-de-selección-múltiple-y-dependientes-2026-11-24).
- Detalle: fila de total con líneas y saldo de todas las páginas (`detailTotal` en la API). Filtros del consolidado compartidos con el detalle en `sessionStorage`. Paquete de la API rehecho con el total.
- Detalle: vencimiento de las ofertas (columna “Vence” en la pestaña Ofertas; debajo del estado en Todas). Solo portal.
- Detalle: ofertas una fila por documento (saldo sumado de sus líneas); OV y tránsito siguen por línea. Agrupación en la API (`#commercialRows`); paquete rehecho.
- API desplegada por el desarrollador y verificada: ofertas por documento = tarjeta A (42 docs, 137 líneas, 131,61 M), total del detalle = A + B + C, selección múltiple de asesores suma bien, combinaciones según la vista (71 / 398).
- Tarjeta A: interruptor “Suma en el total” (por defecto encendido); apagado, el total comercial, la composición y el Total del desglose excluyen las ofertas. Solo portal.
- Filtro de periodo opcional para A, B y C (interruptor, apagado por defecto): ofertas por fecha de entrega de la línea, OV por fecha de despacho de la línea, tránsito por Fecha ProyFAC; mes completo. Periodo también en el detalle. API `filtrarFecha=1`; paquete rehecho, `pendiente` despliegue.
- Detalle: botón “Exportar a Excel” con los filtros aplicados (API `/api/v1/consolidado-comercial/export`; proxy con `append`). Paquete rehecho a las 16:19 con todo lo de hoy.
- Verificación tras el despliegue: `filtrarFecha=1` respondía 502 (faltaban las comillas de `C_TRANSITO` en el SQL) y la exportación 404 (paquete anterior). Corregido; paquete rehecho a las 16:22, `pendiente` desplegar y verificar.
- Verificación del despliegue de las 16:22: filtro de fecha y exportación correctos (Excel = pantalla en tres pruebas); demás rutas bien. Hallazgo: `QUT1.ShipDate` vacía en todas las ofertas abiertas, así que A sale en cero con el filtro de fecha. Script `13-fechas-ofertas.sql` para elegir la fecha.
- Ofertas filtradas por fecha de cierre (`U_FechaCierre`, única fecha de oferta con datos: 566 de 1.432 líneas). Columna `FechaCierre` en la tabla y el SP (script 01, sección 2b) y en el filtro de la API; paquete rehecho a las 16:38. `pendiente`: correr 01, desplegar y verificar.
- Verificado: con el filtro de fecha las ofertas salen por fecha de cierre (noviembre: 49 ofertas, 103,81 M en todos los canales; 6 / 9,64 M en la vista acordada). Detalle = A + B + C; exportación y demás rutas bien.
