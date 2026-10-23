---
status: active
updated: 2026-10-22
sources:
  - ../../middleware.ts
  - ../../app/api/facturacion-diaria/route.ts
  - ../../reporting-api/src/server.ts
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

Supabase mantiene la sesión mediante cookies server-side. El middleware protege todas las rutas salvo `/login`, `/auth` y archivos estáticos.

## Diagnóstico seguro

Los logs pueden indicar códigos de error, rutas y tiempos, pero no deben imprimir tokens, contraseñas ni respuestas completas con datos sensibles.
