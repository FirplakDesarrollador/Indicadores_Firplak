# API de informes Firplak

Servicio Node.js para consultar la vista de SQL Server que está en el servidor Windows de Firplak. La API debe quedarse en la red cercana a SQL Server; Vercel no debe intentar conectarse directamente a la base de datos local.

## 1. Preparar el servidor Windows

Instala Node.js LTS y copia esta carpeta al servidor. Luego ejecuta:

```powershell
npm install
Copy-Item .env.example .env
npm run build
```

Edita `.env` con los datos reales. La configuración inicial espera:

```dotenv
PORT=8080
REPORT_DB_SERVER=localhost
REPORT_DB_PORT=1433
REPORT_DB_INSTANCE_NAME=
REPORT_DB_NAME=Planos_Symphony
REPORT_DB_USER=usuario_solo_lectura
REPORT_DB_PASSWORD=contraseña
REPORT_DB_ENCRYPT=false
REPORT_DB_TRUST_SERVER_CERTIFICATE=true
REPORT_DB_CONNECTION_TIMEOUT_MS=30000
REPORT_DB_REQUEST_TIMEOUT_MS=60000
REPORT_DB_TABLE_SCHEMA=dbo
REPORT_DB_TABLE=Informe_ventas
REPORT_DB_VIEW_SCHEMA=bi
REPORT_DB_VIEW=vw_InformeVentas
REPORTING_API_TOKEN=un_token_largo_y_aleatorio
```

Si SQL Server está instalado como una instancia nombrada, por ejemplo `SQLEXPRESS`, deja `REPORT_DB_PORT` vacío y usa `REPORT_DB_SERVER=localhost` junto con `REPORT_DB_INSTANCE_NAME=SQLEXPRESS`.

Usa un usuario de SQL Server con permiso únicamente `SELECT` sobre la vista o el esquema de informes. No uses el usuario administrador ni las credenciales de SAP.

Antes de publicar, valida la vista directamente en SQL Server:

```sql
USE [Planos_Symphony];
SELECT TOP (5)
    [DOCDATE], [DOCNUM], [NombreCliente], [GrupoCliente], [U_TipoVentas], [Zona],
    [Ciudad], [CodigoTipoNC], [TiposNC], [ValorTotal]
FROM [dbo].[Informe_ventas];
```

Prueba localmente:

```powershell
npm start
Invoke-RestMethod http://127.0.0.1:8080/health
Invoke-RestMethod http://127.0.0.1:8080/api/v1/facturacion-diaria -Headers @{ Authorization = "Bearer $env:REPORTING_API_TOKEN" }
```

## 2. Publicar con HTTPS

Deja Node escuchando solo en `127.0.0.1:8080` y publica la URL mediante IIS como reverse proxy. Configura un certificado TLS válido para, por ejemplo, `api.firplak.com`, y reenvía únicamente:

```text
https://api.firplak.com/api/v1/facturacion-diaria
```

No abras el puerto 1433 de SQL Server a internet. Si la API debe ser accesible desde fuera de la red, permite en el firewall únicamente el tráfico HTTPS al sitio de IIS y restringe el resto.

Para dejar el proceso funcionando como servicio de Windows se puede usar NSSM o un servicio administrado por el equipo de infraestructura. El proceso debe ejecutar `node dist/server.js` desde esta carpeta y conservar las variables del `.env` fuera del repositorio.

## 3. Conectar Vercel

En las variables de entorno de Vercel agrega únicamente:

```dotenv
REPORTING_API_URL=https://api.firplak.com
REPORTING_API_TOKEN=el_mismo_token_del_servidor
```

No uses el prefijo `NEXT_PUBLIC_`. Después de guardar las variables, crea un nuevo deployment. Next.js hará la consulta server-to-server y el navegador solo verá `/api/facturacion-diaria`.

## Contrato

`GET /api/v1/facturacion-diaria` acepta `page`, `pageSize`, `fechaDesde`, `fechaHasta`, `zona`, `grupoCliente` y `search`. Devuelve filas normalizadas, paginación, origen y fecha de actualización. Las filas con `TipoNC` o `Codigo del Tipo NC` se tratan como notas crédito; si la regla contable es distinta, se ajusta en `src/db.ts`.
