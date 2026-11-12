---
status: active
updated: 2026-11-06
sources:
  - ../../supabase/migrations/20261027_permisos_informes.sql
  - ../../supabase/migrations/20261106_permisos_por_cargo.sql
  - ../../lib/auth/access.ts
  - ../../components/admin/PermissionsAdmin.tsx
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

Primera versión el 2026-10-27 (un permiso por usuario e informe). Desde el 2026-11-06 (rama `feat/permisos-por-cargo`) los permisos se dan **por cargo**, con excepciones individuales y el soporte de cada cambio.

### Decisiones del desarrollador

- Tablas en Supabase y administración en la misma aplicación. Los administradores ven todos los informes (2026-10-27).
- **Un cargo por persona** (no por área: el auxiliar de ventas no ve lo mismo que el director de ventas). Los cargos se crean desde la página a medida que se necesitan.
- **Excepciones individuales:** informes sueltos para una persona sin cambiar su cargo. Se guardan en `report_permissions`; los permisos de la primera versión quedan como excepciones.
- **Áreas:** cada informe tiene `area` en [`lib/reports.ts`](../../lib/reports.ts) (ventas, contabilidad, financiera, logística). Agrupan las cards del portal y los selectores de la administración. Facturación y Notas crédito son de Ventas; Costo de PT, de Contabilidad.
- **Soporte obligatorio de cada cambio:** medio (**correo** o **tarea de Planner**, los dos medios autorizados; la mesa de ayuda lleva todo a Planner), referencia (asunto y fecha del correo, o el enlace `https://` de la tarea), correo de quien lo solicitó, quién lo aprobó (texto libre por ahora) y una observación opcional. Quién hizo el cambio y cuándo los pone el servidor.
- Los tipos de informe (indicador, visualización, descarga) se definirán después. La solicitud de acceso por el propio usuario, con aprobación del jefe en el portal, queda para una segunda etapa.

### Modelo

- **Tablas** (las ejecuta el desarrollador en el editor SQL de Supabase, en orden):
  - [`20261027_permisos_informes.sql`](../../supabase/migrations/20261027_permisos_informes.sql): `app_users` (quién inició sesión; lo registra `app/auth/callback/route.ts`), `app_admins`, `report_permissions` y `permission_audit`.
  - [`20261106_permisos_por_cargo.sql`](../../supabase/migrations/20261106_permisos_por_cargo.sql):
    - `job_roles`: cargos, con nombre único sin distinguir mayúsculas.
    - `job_role_reports`: informes de cada cargo.
    - `user_job_roles`: el cargo de cada correo; el correo es la llave primaria.
    - `access_change_requests`: el soporte de cada cambio.
- **Acceso efectivo** = administrador, o informes de su cargo, o sus excepciones. Lo calcula `public.current_user_access()`, una sola llamada que usan el middleware, el portal y el shell ([`lib/auth/access.ts`](../../lib/auth/access.ts)). Un informe nuevo no lo ve nadie hasta que se agrega a un cargo o como excepción (denegado por defecto).
- **Escrituras:** solo mediante `public.apply_access_change(p_request, p_changes)`, que comprueba `is_admin()`, guarda el soporte y aplica todos los cambios en una sola transacción. El navegador ya no puede escribir directo en las tablas (se revocaron `insert` y `delete`). Los triggers rechazan cualquier cambio con sesión que no traiga soporte; los cambios desde el editor SQL quedan con actor `sql`.
- **Historial** (`permission_audit`): acción, persona, cargo (nombre en ese momento), informe, actor, fecha y hora, y el enlace al soporte (`request_id`). Cuando cambian los informes de un cargo, guarda en `affected_emails` quiénes lo tenían en ese momento, para responder "¿quién podía ver X en tal fecha?". Los registros anteriores al 2026-11-06 no tienen soporte.
- **Identidad:** el correo de Microsoft 365 en minúsculas, leído del JWT con `public.current_email()`. Se puede dar acceso a quien aún no ha iniciado sesión.
- **RLS:** solo los administradores leen cargos, soportes e historial; cada usuario lee su propio cargo. Un trigger impide quitar al último administrador. No se usa la clave de servicio.

### Dónde se aplica

1. [`middleware.ts`](../../middleware.ts) responde 403 en los proxys `/api/<informe>` y redirige las páginas a `/?acceso=denegado`. `/admin/*` exige administrador.
2. El portal solo muestra los informes permitidos, agrupados por área.

El acceso a la administración está en el menú del perfil, tanto en el encabezado del portal como en la barra lateral de los dashboards, y solo aparece para administradores ([`UserMenu.tsx`](../../components/dashboard/UserMenu.tsx)). La Reporting API sigue con su token único; solo la alcanza el servidor de Next.js.

### Administración (`/admin/permisos`)

[`PermissionsAdmin.tsx`](../../components/admin/PermissionsAdmin.tsx) y sus piezas en [`components/admin/`](../../components/admin/). Cuatro pestañas:

- **Usuarios:** cargo, número de informes, excepciones y último ingreso, con filtros Pendientes, Sin cargo y Administradores, más filtros por cargo, por informe y búsqueda. El panel lateral cambia el cargo, las excepciones y el rol de administrador; los informes que llegan por el cargo aparecen marcados "Por cargo".
- **Cargos:** crear, editar y eliminar cargos (solo cuando no tienen personas) y asignar personas. Al cambiar los informes de un cargo se avisa a cuántas personas afecta, con el botón **Ver personas**.
- **Informes:** quién ve cada informe y por qué vía (cargo o excepción).
- **Historial:** filtros por fechas, tipo, medio y texto, detalle del soporte y exportación CSV. El CSV usa punto y coma y BOM para Excel en español.

**Dar acceso** admite varios correos a la vez, con un cargo y excepciones. Todo **Guardar** abre el diálogo de soporte con el resumen de los cambios y las personas afectadas.

### Despliegue, validación y rollback

1. Ejecutar `20261106_permisos_por_cargo.sql` en Supabase **antes** de desplegar el portal: sin `current_user_access()`, el middleware niega todos los informes.
2. Validar con las consultas comentadas al final del script. Probado el 2026-11-06 en PGlite (Postgres en WASM), con `auth.jwt()` simulado: altas, excepciones, acceso efectivo, historial con soporte, rechazos (escritura directa, usuario que no es administrador, Planner sin `https://`, solicitante sin correo, cargo con personas) y rollback. El desarrollador lo validó en Supabase y en el portal el 2026-11-06.
3. **Rollback:** el bloque comentado al final del script, más volver a desplegar el portal anterior. Borra cargos y soportes; conserva excepciones y administradores.

**Alcance de datos por usuario (filas):** no implementado. Cuando un BI lo necesite, el proxy enviará el alcance a la API y esta filtrará en SQL.

## Diagnóstico seguro

Los logs pueden indicar códigos de error, rutas y tiempos, pero no deben imprimir tokens, contraseñas ni respuestas completas con datos sensibles.
