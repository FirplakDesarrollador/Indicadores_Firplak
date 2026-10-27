---
status: active
updated: 2026-10-27
sources:
  - ../../app/page.tsx
  - ../../app/login/page.tsx
  - ../../components/FacturacionDashboard.tsx
  - ../../app/api/facturacion-diaria/route.ts
  - ../../app/api/entregas/route.ts
  - ../../app/globals.css
  - ../../app/styles/
  - ../../docs/manual-identidad-web.md
---

# Frontend

## Stack

- Next.js 15 con TypeScript.
- React 19.
- Supabase SSR para sesión.
- Recharts para visualizaciones.
- Lucide para iconos.

## Rutas

- `/`: portal de accesos.
- `/login`: inicio de sesión Microsoft 365.
- `/facturacion-diaria`: dashboard comercial.
- `/facturacion-diaria/detalle`: página independiente para el detalle paginado de documentos de facturación.
- `/api/facturacion-diaria`: proxy server-side hacia la Reporting API.
- `/api/entregas`: proxy server-side hacia `GET /api/v1/entregas`.

## Comportamiento del dashboard

El catálogo de años del filtro proviene de `years` en la respuesta de la Reporting API; no se calcula solamente con la página visible de 50 filas. Esto permite mostrar años antiguos sin descargar todos los documentos.

El dashboard incluye una tabla de resumen diario con `Ent día` y `Ent mes total`, calculados desde los agregados diarios de `GET /api/v1/entregas` usando `ValorSinIVA`. Las columnas de facturación y metas se mantienen en la misma tabla.

La distribución de facturación neta por zona muestra las cinco primeras zonas. La tabla diaria muestra todas las fechas del periodo. Al iniciar o restablecer filtros, se seleccionan el año y mes actuales del navegador.
La tabla diaria se presenta en orden descendente por fecha, comenzando por el día más reciente y continuando hacia atrás. Los acumulados mensuales se calculan antes de invertir la presentación para conservar sus valores correctos.
El resumen diario muestra inicialmente los 7 días más recientes y ofrece `Ver todos los días` cuando existen más registros; el botón alterna entre la vista resumida y la completa.

El botón `Filtros` abre un panel avanzado responsive con Cliente, Grupo de cliente, Mercado, Zona y Ciudad. Mercado ofrece las opciones fijas `Nacional` e `Internacional`; Zona y Grupo de cliente también se envían como filtros soportados al endpoint de facturación, mientras Cliente, Mercado y Ciudad refinan las filas visibles.

Los importes de KPIs y distribución se muestran abreviados en millones cuando superan $1.000.000, con formato `es-CO` y sufijo ` M` (por ejemplo `$1.284,5 M`); los porcentajes también usan `es-CO` (`3,2 %`). Los datos numéricos originales se conservan para cálculos, gráficos y exportación.

El dashboard no usa datos demo en el flujo actual. Solicita `pageSize=50` a facturación y entregas en paralelo, conserva el estado de carga con skeletons y envía filtros de año, mes y búsqueda a ambos endpoints; zona y grupo se aplican al endpoint de facturación. Los KPIs se construyen con `summary`, no sumando únicamente la página visible.

El consumo de las APIs valida el tipo de contenido antes de parsear JSON y muestra un mensaje específico si la sesión expiró o si un proxy devuelve una respuesta no válida.

En la composición visual del dashboard, la tabla de acumulados aparece inmediatamente después de las cards de KPIs. La tabla operativa no se muestra en la vista principal: la opción lateral `Detalle de documentos` enlaza a `/facturacion-diaria/detalle`, una página independiente con filtros, paginación y detalle de documentos.

La navegación lateral no muestra las opciones `Notas crédito` ni `Comparativos`; el encabezado no muestra el estado de conexión SQL Server ni un botón de exportación.

## Estilos e identidad visual

La interfaz aplica el [manual de identidad web](../../docs/manual-identidad-web.md):

- [`app/globals.css`](../../app/globals.css) define los tokens (color, tipografía, espaciado, forma, movimiento) y la base; [`app/styles/`](../../app/styles/) contiene `login.css`, `portal.css` y `billing.css`, importados desde [`app/layout.tsx`](../../app/layout.tsx).
- Fuentes Montserrat (300/400/500/600) y Jost (300) cargadas con `next/font/google`. Es necesario tener acceso a Google Fonts en el momento del build. Jost solo aparece en momentos de marca (panel del login, formulario del login y cabecera del portal); los títulos del dashboard y del panel de detalle usan Montserrat 300.
- El token `--black` existe para el logo monocromático y detalles; el texto de interfaz sigue en navy.
- Puntos de corte mobile-first: 640, 1024 y 1440 px. Las cuadrículas de KPIs y de análisis usan `@container` sobre `.billing-content`. La barra lateral del dashboard funciona como drawer por debajo de 1024 px.
- Logos recortados en `public/brand/firplak-wordmark-*.png` y `firplak-eslogan-*.png`. Los `firplak-es-*.png` originales (600×600 con margen) ya no se referencian.
- El monograma «Λ» es [`components/BrandPeak.tsx`](../../components/BrandPeak.tsx) (marca de agua) y [`app/icon.svg`](../../app/icon.svg) (favicon). Ambos se dibujaron a partir de la geometría del Brand Book; `pendiente` reemplazarlos por el SVG oficial.
- Los colores de Recharts salen de [`lib/brand.ts`](../../lib/brand.ts), que replica los tokens.
- Las filas de la tabla de documentos se abren con teclado (Enter/Espacio) y `Esc` cierra el panel de detalle y el menú lateral.

## Variables del frontend

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REPORTING_API_URL`
- `REPORTING_API_TOKEN`

Las dos últimas son server-side y no deben tener prefijo `NEXT_PUBLIC_`.
