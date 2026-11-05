---
status: active
updated: 2026-10-27
sources:
  - ../README.md
  - ../package.json
  - https://github.com/Firplak/firplak-reporting-api
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
  │ /api/facturacion-diaria + /api/entregas + REPORTING_API_TOKEN
  ▼ HTTPS
Firplak Reporting API (repositorio separado, Windows / IIS)
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
- [Seguridad](concepts/security-and-secrets.md): límites de secretos, autenticación y permisos por informe.

### Diseño

- [Manual de identidad web](../docs/manual-identidad-web.md) (borrador v0.3, basado en el Manual de marca v1-030726 y las decisiones de Mercadeo): tokens, tipografía, responsive, componentes y accesibilidad derivados del Brand Book. Aplicado al portal, al login y al dashboard (ver [Frontend](components/frontend.md#estilos-e-identidad-visual)).

### Migración de BI

- Proceso con IA en 8 fases (inventario, análisis, tabla y SP incremental, contrato, endpoint, dashboard, conciliación, despliegue) definido en las skills de [`.claude/skills/`](../.claude/skills/): [`migrar-bi`](../.claude/skills/migrar-bi/SKILL.md) coordina y [`analizar-bi`](../.claude/skills/analizar-bi/SKILL.md), [`crear-tabla-incremental`](../.claude/skills/crear-tabla-incremental/SKILL.md), [`crear-endpoint`](../.claude/skills/crear-endpoint/SKILL.md) y [`crear-dashboard`](../.claude/skills/crear-dashboard/SKILL.md) ejecutan cada fase.
- Cada BI migrado tiene su ficha en `llm-wiki/bi/<slug>.md` ([plantilla](../.claude/skills/analizar-bi/plantilla-ficha-bi.md)). Fichas:
  - [Notas crédito](bi/notas-credito.md): piloto, migrado (fase 7 cerrada el 2026-10-28; Power BI se retira el 2026-11-06).
  - [Costo actual de producto terminado](bi/costo-actual-pt.md): en migración (fase 1 cerrada: reglas validadas por Contabilidad; sigue la fase 2, tabla y SP). Usa el query optimizado del desarrollador, con reglas corregidas y la explosión de todos los niveles (D9).

### Decisiones

- [ADR-001: tabla de reportes](decisions/ADR-001-reporting-table.md): por qué la API consulta una tabla preparada en lugar de una vista pesada.

### Ingesta

- [Inventario del repositorio](sources/repository-inventory.md): mapa de todo el código, configuración, documentación y assets.
- [Contexto de chats](sources/chat-history.md): decisiones, problemas resueltos y pendientes reconstruidos de las conversaciones.

## Fuentes primarias

- Frontend: [`app/`](../app/), [`components/FacturacionDashboard.tsx`](../components/FacturacionDashboard.tsx), [`app/api/facturacion-diaria/route.ts`](../app/api/facturacion-diaria/route.ts) y [`app/api/entregas/route.ts`](../app/api/entregas/route.ts).
- API: [repositorio Firplak Reporting API](https://github.com/Firplak/firplak-reporting-api), especialmente `src/server.ts`, `src/db.ts` y `src/types.ts`.
- Contrato de configuración: [`.env.example`](../.env.example) y `.env.example` del [repositorio de la API](https://github.com/Firplak/firplak-reporting-api/blob/main/.env.example).

## Hechos y pendientes

| Tema | Estado | Evidencia |
|---|---|---|
| Tabla de reportes | Confirmado: `Planos_Symphony.dbo.Informe_ventas` | [Flujo de datos](architecture/data-flow.md) |
| Notas crédito | Confirmado: `TipoDocumento = Nota Crédito` y columnas `CodigoTipoNC`/`TiposNC` | [Flujo de datos](architecture/data-flow.md) |
| API pública | Configurada mediante `api.firplak.com:8443` | [Reporting API](components/reporting-api.md) |
| Actualización periódica de las tablas | `Informe_ventas`: `SP_Generar_Informe_Ventas`, jobs `BI - Ventas carga incremental`/`completa`, bitácora `Cargas_Log`; incremental cada 15 min (6:00–20:00) y completa a las 2:00 | [Flujo de datos](architecture/data-flow.md#carga) |
| Tabla de entregas | Confirmada: `Planos_Symphony.dbo.Informe_entregas` | [Reporting API](components/reporting-api.md) |
| Índices SQL | Recomendados; validar en SQL Server | [ADR-001](decisions/ADR-001-reporting-table.md) |
