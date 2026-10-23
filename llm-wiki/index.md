---
status: active
updated: 2026-10-22
sources:
  - ../README.md
  - ../package.json
  - ../reporting-api/src/server.ts
  - ../reporting-api/src/db.ts
---

# Índice de la wiki

## Propósito

Indicadores Firplak es un portal interno que presenta indicadores comerciales. El frontend está construido con Next.js y consulta una API Node.js separada, instalada cerca de SQL Server. La fuente operativa de facturación es la tabla `[Planos_Symphony].[dbo].[Informe_ventas]`.

## Mapa del sistema

```text
Usuario
  │ Microsoft 365 / Supabase Auth
  ▼
Next.js (localhost:3000 o Vercel)
  │ /api/facturacion-diaria + REPORTING_API_TOKEN
  ▼ HTTPS
Firplak Reporting API (Windows / IIS)
  │ mssql, paginación y resúmenes
  ▼
Planos_Symphony.dbo.Informe_ventas
  ▲
SP o proceso de actualización periódica
```

## Páginas

### Arquitectura

- [Visión general](architecture/system-overview.md): componentes, límites de confianza y flujo de extremo a extremo.
- [Flujo de datos](architecture/data-flow.md): contrato de facturación, mapeo de columnas y rendimiento.

### Componentes

- [Frontend](components/frontend.md): rutas Next.js, autenticación y dashboard.
- [Reporting API](components/reporting-api.md): endpoints, consultas, configuración y despliegue.

### Operación

- [Runbook](operations/runbook.md): desarrollo local, despliegue y diagnóstico.
- [Seguridad](concepts/security-and-secrets.md): límites de secretos y autenticación.

### Decisiones

- [ADR-001: tabla de reportes](decisions/ADR-001-reporting-table.md): por qué la API consulta una tabla preparada en lugar de una vista pesada.

### Ingesta

- [Inventario del repositorio](sources/repository-inventory.md): mapa de todo el código, configuración, documentación y assets.
- [Contexto de chats](sources/chat-history.md): decisiones, problemas resueltos y pendientes reconstruidos de las conversaciones.

## Fuentes primarias

- Frontend: [`app/`](../app/), [`components/FacturacionDashboard.tsx`](../components/FacturacionDashboard.tsx) y [`app/api/facturacion-diaria/route.ts`](../app/api/facturacion-diaria/route.ts).
- API: [`reporting-api/src/server.ts`](../reporting-api/src/server.ts), [`reporting-api/src/db.ts`](../reporting-api/src/db.ts) y [`reporting-api/src/types.ts`](../reporting-api/src/types.ts).
- Contratos de configuración: [`.env.example`](../.env.example) y [`reporting-api/.env.example`](../reporting-api/.env.example).

## Hechos y pendientes

| Tema | Estado | Evidencia |
|---|---|---|
| Tabla de reportes | Confirmado: `Planos_Symphony.dbo.Informe_ventas` | [Flujo de datos](architecture/data-flow.md) |
| Notas crédito | Confirmado: `TipoDocumento = Nota Crédito` y columnas `CodigoTipoNC`/`TiposNC` | [Flujo de datos](architecture/data-flow.md) |
| API pública | Configurada mediante `api.firplak.com:8443` | [Reporting API](components/reporting-api.md) |
| Actualización periódica de la tabla | Dependencia operativa; confirmar proceso y horario | [Runbook](operations/runbook.md) |
| Índices SQL | Recomendados; validar en SQL Server | [ADR-001](decisions/ADR-001-reporting-table.md) |
