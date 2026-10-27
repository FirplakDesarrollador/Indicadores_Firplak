---
status: active
updated: 2026-10-26
sources:
  - ../../app/page.tsx
  - ../../app/login/page.tsx
  - ../../components/FacturacionDashboard.tsx
  - ../../app/api/facturacion-diaria/route.ts
  - ../../app/api/entregas/route.ts
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

El botón `Filtros` abre un panel avanzado responsive con Cliente, Grupo de cliente, Mercado, Zona y Ciudad. Todos se envían a la Reporting API (`cliente` con el código del cliente, `grupoCliente`, `mercado`, `zona`, `ciudad`), así que KPIs, resumen diario, gráfico, distribución por zona y detalle los respetan. Las opciones salen de `filterOptions` de la API (valores reales del periodo) y, si la API no lo envía, se derivan de la página visible. Entregas solo filtra por `grupoCliente` y `cliente`: `Informe_entregas` no tiene mercado, zona ni ciudad, y el resumen diario lo indica cuando alguno de esos filtros está activo. Antes de 2026-10-27, Cliente, Mercado y Ciudad solo filtraban las 50 filas visibles y Mercado comparaba contra las opciones fijas `Nacional`/`Internacional`, por lo que en la vista principal no tenían efecto.

Los importes de KPIs y distribuciÃ³n se muestran abreviados siempre en millones cuando superan $1.000.000, usando el sufijo `M`; los datos numÃ©ricos originales se conservan para cÃ¡lculos, grÃ¡ficos y exportaciÃ³n.

El dashboard no usa datos demo en el flujo actual. Solicita `pageSize=50` a facturación y entregas en paralelo, conserva el estado de carga con skeletons y envía filtros de año, mes y búsqueda a ambos endpoints; zona y grupo se aplican al endpoint de facturación. Los KPIs se construyen con `summary`, no sumando únicamente la página visible.

El consumo de las APIs valida el tipo de contenido antes de parsear JSON y muestra un mensaje específico si la sesión expiró o si un proxy devuelve una respuesta no válida.

En la composición visual del dashboard, la tabla de acumulados aparece inmediatamente después de las cards de KPIs. La tabla operativa no se muestra en la vista principal: la opción lateral `Detalle de documentos` enlaza a `/facturacion-diaria/detalle`, una página independiente con filtros, paginación y detalle de documentos.

La navegación lateral no muestra las opciones `Notas crédito` ni `Comparativos`; el encabezado no muestra el estado de conexión SQL Server ni un botón de exportación.

## Variables del frontend

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REPORTING_API_URL`
- `REPORTING_API_TOKEN`

Las dos últimas son server-side y no deben tener prefijo `NEXT_PUBLIC_`.
