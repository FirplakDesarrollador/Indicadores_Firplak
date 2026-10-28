---
status: active
updated: 2026-10-22
sources:
  - ../../middleware.ts
  - ../../app/api/facturacion-diaria/route.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/server.ts
  - ../../.gitignore
---

# Seguridad y secretos

## Reglas

- Nunca poner tokens, contraseñas SQL o claves Supabase en el repositorio.
- Nunca usar `NEXT_PUBLIC_` para `REPORTING_API_TOKEN` o credenciales SQL.
- El navegador llama al Route Handler de Next.js, no directamente a SQL Server.
- La Reporting API valida un Bearer token con comparación de tiempo constante.
- SQL Server debe aceptar únicamente conexiones desde la red de la API.

## Sesiones

Supabase mantiene la sesión mediante cookies server-side. El middleware protege todas las rutas salvo `/login`, `/auth` y archivos estáticos, y además verifica el permiso por informe (ver abajo). Las rutas `/api/*` responden con JSON `401` cuando no hay sesión, para evitar que una redirección HTML rompa el consumo de datos del dashboard.

## Permisos por informe

Implementados el 2026-10-27 (rama `feat/permisos-informes`). Decisiones del desarrollador: tabla en Supabase, un permiso por usuario y por informe, página de administración en la misma aplicación, y los administradores ven todos los informes.

- **Tablas** ([`supabase/migrations/20261027_permisos_informes.sql`](../../supabase/migrations/20261027_permisos_informes.sql), las ejecuta el desarrollador en el editor SQL de Supabase):
  - `report_permissions`: correo y slug del informe.
  - `app_admins`: administradores.
  - `app_users`: quién inició sesión; se registra en `app/auth/callback/route.ts`.
  - `permission_audit`: historial que escriben los triggers, nunca el navegador.
- **Identidad:** el correo de Microsoft 365 en minúsculas, leído del JWT de Supabase con `public.current_email()`. Se puede dar acceso a quien aún no ha iniciado sesión.
- **RLS:** cada usuario solo lee sus propias filas; solo `public.is_admin()` puede dar o quitar permisos y administradores. Un trigger impide quitar al último administrador. No se usa la clave de servicio.
- **Catálogo de informes:** [`lib/reports.ts`](../../lib/reports.ts), con el slug, las páginas y los proxys de cada informe. Un informe nuevo no lo ve nadie hasta que se asigna (denegado por defecto).
- **Dónde se aplica:**
  1. [`middleware.ts`](../../middleware.ts) responde 403 en los proxys `/api/<informe>` y redirige las páginas a `/?acceso=denegado`. `/admin/*` exige administrador.
  2. El portal solo muestra los informes permitidos y la tarjeta de administración.
  La Reporting API sigue con su token único; solo la alcanza el servidor de Next.js.
- **Administración:** `/admin/permisos` ([`PermissionsAdmin.tsx`](../../components/admin/PermissionsAdmin.tsx)): casillas por usuario e informe, rol de administrador, alta por correo, usuarios "Pendiente de acceso" (iniciaron sesión sin informes), búsqueda e historial.
- **Administradores iniciales:** los del script (correo de Esteban Muñoz confirmado: `analista2.desarrollo@firplak.com`).
- **Alcance de datos por usuario (filas):** no implementado. Cuando un BI lo necesite, el proxy enviará el alcance a la API y esta filtrará en SQL.

## Diagnóstico seguro

Los logs pueden indicar códigos de error, rutas y tiempos, pero no deben imprimir tokens, contraseñas ni respuestas completas con datos sensibles.
