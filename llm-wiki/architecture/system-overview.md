---
status: active
updated: 2026-10-26
sources:
  - ../../middleware.ts
  - ../../app/api/facturacion-diaria/route.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/server.ts
---

# Visión general del sistema

## Componentes

| Componente | Responsabilidad | Ubicación |
|---|---|---|
| Portal | Tarjetas de acceso y navegación | `app/page.tsx` |
| Autenticación | Inicio de sesión Microsoft 365 mediante Supabase Azure | `app/login/page.tsx`, `app/auth/callback/route.ts` |
| Middleware | Redirige usuarios no autenticados a `/login` | `middleware.ts` |
| Dashboard | Filtros, KPIs, gráfico, tabla y detalle | `components/FacturacionDashboard.tsx` |
| Proxy | Oculta token y llama a la API de informes | `app/api/facturacion-diaria/route.ts` |
| Reporting API | Autenticación Bearer, SQL, paginación y agregados | [Repositorio separado](https://github.com/Firplak/firplak-reporting-api) |
| SQL Server | Tablas preparadas de facturación y entregas | `Planos_Symphony.dbo.Informe_ventas`, `Planos_Symphony.dbo.Informe_entregas` |

## Flujo de autenticación

1. El middleware consulta la sesión de Supabase.
2. Un usuario sin sesión es enviado a `/login`.
3. Login inicia OAuth con proveedor `azure`.
4. El callback intercambia el código por una sesión y redirige a la ruta solicitada.

## Flujo de facturación

1. El dashboard solicita una sola página de 50 registros junto con resúmenes.
2. El Route Handler copia filtros y paginación hacia `/api/v1/facturacion-diaria`.
3. El token `REPORTING_API_TOKEN` se añade solo en el servidor.
4. La Reporting API valida el Bearer token y consulta SQL Server.
5. La respuesta contiene filas, paginación, totales diarios y distribución por zona.

## Flujo de entregas

1. Un consumidor solicita `GET /api/v1/entregas` con el Bearer token server-to-server.
2. La Reporting API aplica filtros y paginación sobre `Planos_Symphony.dbo.Informe_entregas`.
3. La respuesta devuelve filas, años disponibles y agregados de cantidades y valor sin IVA.

## Límites de confianza

- El navegador nunca debe recibir `REPORTING_API_TOKEN`.
- Vercel no debe conectarse directamente a SQL Server.
- SQL Server no debe exponerse a internet en el puerto 1433.
- IIS o el proxy HTTPS publica únicamente la API necesaria.
