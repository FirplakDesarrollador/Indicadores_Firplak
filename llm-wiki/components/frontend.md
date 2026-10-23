---
status: active
updated: 2026-10-22
sources:
  - ../../app/page.tsx
  - ../../app/login/page.tsx
  - ../../components/FacturacionDashboard.tsx
  - ../../app/api/facturacion-diaria/route.ts
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
- `/api/facturacion-diaria`: proxy server-side hacia la Reporting API.

## Comportamiento del dashboard

El catálogo de años del filtro proviene de `years` en la respuesta de la Reporting API; no se calcula solamente con la página visible de 50 filas. Esto permite mostrar años antiguos sin descargar todos los documentos.

El dashboard incluye una tabla de resumen diario sin métricas de entregas. Calcula el acumulado mensual a partir de `summary.daily` y usa temporalmente las metas mensuales suministradas en el código DAX del proyecto; los meses sin meta muestran `—`.

La distribución de facturación neta por zona muestra las cinco primeras zonas. La tabla diaria muestra todas las fechas del periodo. Al iniciar o restablecer filtros, se seleccionan el año y mes actuales del navegador.

Los importes de KPIs y distribuciÃ³n se muestran abreviados siempre en millones cuando superan $1.000.000, usando el sufijo `M`; los datos numÃ©ricos originales se conservan para cÃ¡lculos, grÃ¡ficos y exportaciÃ³n.

El dashboard no usa datos demo en el flujo actual. Solicita `pageSize=50`, conserva el estado de carga con skeletons y envía filtros de año, mes, zona, grupo y búsqueda. Los KPIs se construyen con `summary`, no sumando únicamente la página visible.

## Variables del frontend

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REPORTING_API_URL`
- `REPORTING_API_TOKEN`

Las dos últimas son server-side y no deben tener prefijo `NEXT_PUBLIC_`.
