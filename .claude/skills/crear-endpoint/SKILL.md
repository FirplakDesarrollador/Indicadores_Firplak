---
name: crear-endpoint
description: Define el contrato JSON y crea un endpoint GET /api/v1/<tema> en la Reporting API (repositorio ../reporting-api) siguiendo el patrón de facturación, con filtros en SQL, resumen y catálogos de opciones, más el paquete de despliegue para IIS. Úsala en las fases 3 y 4 de una migración o cuando pidan un endpoint nuevo en la API.
---

# Crear un endpoint en la Reporting API

La API vive en `../reporting-api` (Node.js + `mssql`) y corre en el servidor Windows/IIS junto al SQL Server. El frontend nunca consulta SQL Server: solo llama a esta API con un token.

**Patrón de referencia:** `/api/v1/facturacion-diaria`. Antes de escribir, lee completos:

- `../reporting-api/src/server.ts`: `billingFiltersFrom`, validadores, ruteo y respuesta.
- `../reporting-api/src/db.ts`: `reportSource`, `addPeriodFilters`, `addFilters`, `getBillingReport` y la construcción de `filterOptions`.
- `../reporting-api/src/types.ts`: `BillingFilters`, `BillingFilterOptions`, `BillingApiResponse`.

## Paso 1: el contrato (fase 3)

Con la ficha `llm-wiki/bi/<slug>.md`, completa su sección 3:

- **Parámetros:** `page`, `pageSize`, `anio`, `mes`, `fechaDesde`, `fechaHasta`, `search` y uno por cada filtro de la ficha, en español y sin tildes (`zona`, `grupoCliente`, `mercado`…), con la columna SQL que filtra.
- **Respuesta:** `rows` (campos en inglés y camelCase, como `BillingRow`), `years`, `pagination`, `summary` (los indicadores de la ficha calculados en SQL sobre **todo** el filtro, no sobre la página), `filterOptions` (valores reales por filtro), `source` y `updatedAt`.

Muestra el contrato y **detente hasta que el desarrollador lo apruebe**. Con el contrato aprobado, el frontend puede empezar en paralelo.

## Paso 2: implementación (fase 4)

En `../reporting-api`, rama `bi/<slug>`:

1. **`.env.example`:** agrega `REPORT_<TEMA>_TABLE_SCHEMA=dbo` y `REPORT_<TEMA>_TABLE=Informe_<tema>`, como `REPORT_DELIVERIES_TABLE`.
2. **`src/types.ts`:** `<Tema>Filters`, `<Tema>Row`, `<Tema>Summary`, `<Tema>FilterOptions` y `<Tema>ApiResponse`.
3. **`src/db.ts`:**
   - `<tema>Source()` con `safeIdentifier`, como `deliverySource()`.
   - Filtros de periodo separados de los demás (como `addPeriodFilters`), para que los **catálogos de opciones usen solo el periodo** y no se reduzcan al elegir un filtro. Excepción: las listas dependientes, como ciudad por zona.
   - Cada filtro como predicado parametrizado: `request.input("nombre", sql.NVarChar(100), valor)`. **Nunca concatenes valores del usuario en el SQL.**
   - Compara textos normalizados: `LTRIM(CONVERT(nvarchar(100), t.[Columna])) = @param`.
   - Una sola consulta por lotes: tabla temporal filtrada → página → total → summary → series → `years` → catálogos. Anota con un comentario el **índice de cada `recordset`** y verifica que coincida con el código que los lee.
   - Normaliza filas con `textValue`, `numberValue` y `dateValue`.
4. **`src/server.ts`:** `<tema>FiltersFrom()` con los validadores existentes (`validDate`, `validNumber`, `paginationFrom`), la ruta en el `if` de rutas y la respuesta con la misma forma que facturación. Mismo token y mismo manejo de errores (502 sin detalles internos).
5. **`README.md`:** documenta el endpoint, sus parámetros y `filterOptions`.

## Verificación

1. `npm run build` sin errores.
2. Revisa el SQL a mano, porque TypeScript no lo valida: paréntesis balanceados, número de `SELECT` igual al número de recordsets leídos, sin `SELECT *` y parámetros declarados.
3. Si tienes conexión de solo lectura, prueba la consulta del lote con un periodo pequeño. Si no, entrega al desarrollador:
   - El comando para levantar la API local (`npm run dev`).
   - Una prueba con `curl` y el header `Authorization: Bearer $REPORTING_API_TOKEN`, leyendo el token de su entorno, nunca escrito en el chat.
   - Qué debe ver en la respuesta.
4. Registra el resultado en la sección 4 de la ficha.

## Paquete de despliegue

El servidor no tiene Git: se despliega copiando `dist/`.

1. `npm run build`.
2. Comprime `dist/` como `reporting-api-dist-<commit corto>.zip` **fuera de los repositorios**, por ejemplo en la carpeta padre.
3. Entrega al desarrollador:
   - Detener el servicio, reemplazar `dist/` en la carpeta del `cwd=` del log de arranque, sin tocar el `.env` del servidor.
   - Verificar con `findstr /c:"<texto único del cambio>" dist\db.js`.
   - Agregar las variables nuevas al `.env` del servidor.
   - Reiniciar el servicio y probar el endpoint.
4. Primero se despliega la API y después el frontend.

## No hagas

- No leas ni escribas el `.env` real ni pongas tokens en archivos o mensajes.
- No cambies el contrato de endpoints existentes sin acordarlo: los consume el frontend en producción.
- No apliques filtros solo en memoria después de la consulta.
