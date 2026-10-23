---
status: active
updated: 2026-10-22
source_type: repository-ingestion
---

# Inventario completo del repositorio

Este documento registra la ingesta del código y de la configuración visible del repositorio. Las rutas listadas son las fuentes primarias; esta página es solo el mapa para encontrarlas.

## Frontend y rutas Next.js

| Ruta | Rol |
|---|---|
| `app/page.tsx` | Portal de accesos a módulos. |
| `app/login/page.tsx` | Login visual y OAuth Azure/Microsoft 365 mediante Supabase. |
| `app/auth/callback/route.ts` | Intercambio del código OAuth por sesión. |
| `app/facturacion-diaria/page.tsx` | Entrada de la página de facturación. |
| `app/api/facturacion-diaria/route.ts` | Proxy server-side hacia la Reporting API. |
| `app/layout.tsx` | Metadata y layout raíz en español. |
| `app/globals.css` | Sistema visual, responsive y skeletons. |
| `middleware.ts` | Protección de rutas y renovación de cookies de sesión. |

## Componentes y librerías

| Ruta | Rol |
|---|---|
| `components/FacturacionDashboard.tsx` | Dashboard interactivo: filtros, KPIs, gráfico, zonas, tabla, detalle y paginación. |
| `lib/facturacion/types.ts` | Contrato de filas, paginación y resúmenes del frontend. |
| `lib/facturacion/sql-server.ts` | Conector SQL legado server-side y normalización de compatibilidad. |
| `lib/facturacion/demo-data.ts` | Dataset demo histórico; no forma parte del flujo actual del dashboard. |
| `lib/supabase/client.ts` | Cliente Supabase para navegador. |
| `lib/supabase/server.ts` | Cliente Supabase para componentes/server-side. |

## Reporting API

| Ruta | Rol |
|---|---|
| `reporting-api/src/server.ts` | Servidor HTTP, `/health`, endpoint de facturación y Bearer token. |
| `reporting-api/src/db.ts` | Pool SQL, filtros, consulta paginada, agregados y mapeo de `Informe_ventas`. |
| `reporting-api/src/types.ts` | Contratos internos de filtros, filas y resumen. |
| `reporting-api/package.json` | Scripts `dev`, `build` y `start`. |
| `reporting-api/tsconfig.json` | Compilación TypeScript a `dist/`. |
| `reporting-api/.env.example` | Variables de SQL Server, tabla, timeout y token sin secretos. |
| `reporting-api/README.md` | Manual de instalación, HTTPS y conexión con Vercel. |

## Configuración y herramientas

| Ruta | Rol |
|---|---|
| `package.json` | Dependencias y scripts del frontend. |
| `package-lock.json` | Versiones bloqueadas del frontend. |
| `reporting-api/package-lock.json` | Versiones bloqueadas de la API. |
| `tsconfig.json` | TypeScript del frontend. |
| `next.config.ts` | Configuración Next.js; React Strict Mode. |
| `eslint.config.mjs` | ESLint para Next.js/TypeScript. |
| `next-env.d.ts` | Tipos generados de Next.js. |
| `.env.example` | Contrato de variables del frontend sin secretos. |
| `.gitignore` | Exclusión de secretos, dependencias y builds. |
| `README.md` | Introducción y despliegue de alto nivel. |
| `AGENTS.md` | Contrato de trabajo para agentes LLM. |

## Assets

- `public/brand/firplak-es-positivo.png`: logo para fondos claros.
- `public/brand/firplak-es-negativo.png`: logo para fondos oscuros.

Los archivos binarios se registran por uso y ruta; no se convierten a texto dentro de la wiki.

## Exclusiones deliberadas

- `.env.local` y cualquier `.env`: se ingirieron solo los nombres de variables necesarios; nunca sus valores.
- `node_modules/`, `.next/`, `reporting-api/dist/` y `.npm-cache/`: artefactos generados o dependencias.
- `reporting-api.zip`: paquete duplicado; el código fuente en `reporting-api/` es la fuente de verdad.
- `package-lock.json`: se registra como contrato de dependencias, no se duplica en la wiki.

## Cobertura

La ingesta cubre todas las rutas de código, configuración, documentación y assets versionables identificados en el repositorio al 2026-10-22. Las afirmaciones de comportamiento se contrastan con el código enlazado, no solo con esta tabla.
