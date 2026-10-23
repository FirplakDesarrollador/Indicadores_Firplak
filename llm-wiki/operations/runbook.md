---
status: active
updated: 2026-10-23
sources:
  - ../../README.md
  - https://github.com/Firplak/firplak-reporting-api/blob/main/README.md
  - ../../app/api/facturacion-diaria/route.ts
---

# Runbook operativo

## Desarrollo local

Frontend:

```powershell
npm install
npm run dev
```

Reporting API, si se ejecuta localmente, desde su repositorio separado:

```powershell
git clone https://github.com/Firplak/firplak-reporting-api.git
Set-Location firplak-reporting-api
npm install
npm run dev
```

## Despliegue de la API

1. Actualizar el checkout del repositorio [Firplak Reporting API](https://github.com/Firplak/firplak-reporting-api) en el servidor Windows.
2. Conservar el `.env` real del servidor; no reemplazarlo con `.env.example` sin volver a cargar secretos.
3. Confirmar `REPORT_DB_TABLE_SCHEMA=dbo` y `REPORT_DB_TABLE=Informe_ventas`.
4. Ejecutar `npm install` si cambiaron dependencias.
5. Ejecutar `npm run build`.
6. Reiniciar el servicio que ejecuta `node dist/server.js`.
7. Probar `/health` y después el endpoint autenticado.

## Diagnóstico rápido

| Síntoma | Causa probable | Comprobación |
|---|---|---|
| `ENOTFOUND api.firplak.com` | DNS local | Resolver el dominio desde el servidor y el PC cliente |
| `401` | Token distinto | Comparar el token sin imprimirlo |
| `502` inmediato | Tabla, columna o SQL inválido | Revisar consola de la Reporting API |
| Timeout de 15 s | Driver SQL con valor por defecto | Revisar `REPORT_DB_REQUEST_TIMEOUT_MS` |
| Timeout largo | Fuente sin índices o demasiadas filas | Ejecutar la consulta en SQL Server y revisar plan |

## Rollback

Conservar la versión anterior de `dist/` y del `.env`. Si el nuevo despliegue falla, detener el proceso, restaurar el `dist/` anterior y reiniciar. No borrar la tabla ni alterar datos de SAP como parte de un rollback de la API.
