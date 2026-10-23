---
status: contextual
updated: 2026-10-22
source_type: conversation-synthesis
---

# Contexto histórico de las conversaciones

Esta página resume las conversaciones del proyecto para preservar decisiones y causas de problemas. No es una transcripción literal y no contiene tokens, contraseñas ni valores de `.env`.

## Infraestructura, NAT y DNS

- Se verificó que `200.7.99.254` es la IP de salida a internet, mientras que las reglas de NAT para el servicio usan `200.7.96.194`.
- La regla externa publica TCP/UDP en el puerto `8443` hacia `10.2.1.4:8443`.
- La resolución pública de `api.firplak.com` se validó hacia `200.7.96.194`.
- La conectividad TCP a `200.7.96.194:8443` se validó desde la red del servidor/cliente.
- `curl --resolve` contra `https://api.firplak.com:8443/health` devolvió `HTTP/1.1 200 OK` y `{"status":"ok","service":"firplak-reporting-api"}`.
- En el PC de desarrollo Windows, Node devolvía `ENOTFOUND api.firplak.com` aunque resolvers públicos sí respondían. El archivo `hosts` se consideró un workaround local; no es requisito para usuarios externos si el DNS público está correcto.

## Aplicación y autenticación

- El frontend se ejecuta localmente en `http://localhost:3000`.
- El login usa Supabase SSR con proveedor Azure/Microsoft 365.
- El middleware protege las rutas privadas y redirige a `/login` cuando no hay sesión.
- Se corrigió el error inicial de URL inválida de Supabase mediante la configuración de `.env.local`.
- El token que consume la aplicación es `REPORTING_API_TOKEN`, usado server-to-server entre Next.js y la Reporting API. No corresponde al certificado TLS de ACME.

## Diseño visual

- Se unificó el frontend con el lenguaje visual de Firplak: logos positivo/negativo, fondos corporativos, tarjetas, navegación lateral y estados de carga.
- Se eliminaron los datos demo del flujo operativo de facturación y se añadió skeleton loading.
- Las decisiones visuales se reflejan principalmente en `app/globals.css`, `app/login/page.tsx`, `app/page.tsx` y `components/FacturacionDashboard.tsx`.

## Rendimiento y evolución de datos

- La primera implementación solicitaba páginas grandes y múltiples lotes; llegó a consultar decenas de páginas de 1000 registros y sufrió timeouts.
- Se cambió a paginación server-side de 50 registros, filtros enviados a la API y resúmenes calculados en SQL.
- El timeout por defecto de `mssql` de 15 segundos causó fallos; se parametrizó `REPORT_DB_REQUEST_TIMEOUT_MS` con valor recomendado de 60000 ms.
- La vista pesada se reemplazó como fuente objetivo por una tabla de reportes preparada, para que un SP/proceso periódico la alimente y SQL Server pueda indexarla.

## Fuente SQL confirmada

La tabla real confirmada por el usuario es:

```text
Planos_Symphony.dbo.Informe_ventas
```

Columnas relevantes: `TipoDocumento`, `DOCDATE`, `DOCNUM`, `VendedorSenior`, `VendedorJunior`, `U_TipoVentas`, `Zona`, `Territorio`, `GrupoCliente`, `CodCliente`, `NombreCliente`, `Ciudad`, `ValorTotal`, `CodigoTipoNC` y `TiposNC`.

La clasificación observada fue:

- `Factura`: 357522 registros.
- `Nota Crédito`: 22341 registros.

El mapeo vigente está implementado en [`reporting-api/src/db.ts`](../../reporting-api/src/db.ts) y documentado en [`../architecture/data-flow.md`](../architecture/data-flow.md).

## Despliegue de la API

- La Reporting API corre en Windows cerca de SQL Server y se publica por HTTPS mediante IIS/NAT.
- El proceso ejecuta `node dist/server.js`; modificar `src/` exige ejecutar `npm run build` antes de reiniciar.
- El frontend consume `https://api.firplak.com` mediante `REPORTING_API_URL` y el token server-side.
- Vercel todavía es una fase posterior; primero se valida el entorno local y la API publicada.

## Pendientes derivados de los chats

- Confirmar que el SP de actualización de `Informe_ventas` esté operativo y documentar su frecuencia real.
- Crear o validar índices sobre `DOCDATE`, `Zona`, `GrupoCliente` y columnas de búsqueda.
- Medir tiempos reales del endpoint con página, filtros y resumen.
- Validar el despliegue final en Vercel después de estabilizar la API local/publicada.
- Mantener sincronizadas esta síntesis, el runbook y los contratos si cambian las columnas.

## Regla para futuras ingestas

Los mensajes antiguos sirven para entender la evolución, pero el código y la configuración actual prevalecen. Si un chat contradice una fuente ejecutable, registrar la contradicción y actualizar esta página sin convertir el dato antiguo en una instrucción vigente.
