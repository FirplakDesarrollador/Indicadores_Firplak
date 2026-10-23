# indicadores-firplak

App de Indicadores Firplak.

Dashboard web en Next.js + TypeScript para migrar las vistas principales de Power BI a una experiencia web propia.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura inicial

- `app/page.tsx`: portal de accesos del usuario.
- `app/facturacion-diaria/page.tsx`: acceso al BI de Facturación Diaria.
- `components/FacturacionDashboard.tsx`: módulo interactivo de facturación con filtros, KPIs, gráficos, tabla y detalle de documentos.
- `app/api/facturacion-diaria/route.ts`: Route Handler que funciona como proxy seguro hacia la API de informes.
- `lib/facturacion/sql-server.ts`: conexión segura server-side y normalización de columnas de la vista.
- `reporting-api/`: API independiente para Windows, instalada cerca de SQL Server y publicada por IIS con HTTPS.
- `lib/facturacion/demo-data.ts`: datos de demostración para trabajar la interfaz antes de conectar SQL Server.
- `app/globals.css`: sistema visual responsive.
- `app/layout.tsx`: metadata y layout raíz.

## Accesos habilitados

Los accesos se mantienen como una lista tipada en `app/page.tsx`. Para agregar un nuevo módulo, incorpora una tarjeta con su título, icono y ruta en `accessCards`.

## Configurar SQL Server

Copia las variables de `.env.example` a `.env.local` y completa la conexión. Las credenciales se quedan únicamente en el servidor; nunca uses el prefijo `NEXT_PUBLIC_` para SQL Server.

La fuente real definida para este módulo es la vista `[Planos_Symphony].[bi].[vw_InformeVentas]`. La API consulta sus columnas `[Fecha contabilizacion]`, `[DOCNUM]`, `[Num Documento]`, `[Nombre Cliente]`, `[Grupo de Cliente]`, `[TipoVentas]`, `[Zona]`, `[Ciudad]`, `[Cod Cliente]`, `[Codigo del Tipo NC]`, `[TipoNC]` y `[Valor Total]`.

La configuración recomendada es ejecutar `reporting-api` en el servidor Windows que tiene acceso al SQL Server. Next.js en Vercel solo llama a esa API por HTTPS usando `REPORTING_API_TOKEN`; el token no se entrega al navegador.

Para desarrollar sin la API instalada, la aplicación conserva el modo demo. La conexión directa antigua mediante `SQL_SERVER_*` queda como fallback local; en producción se recomienda dejar esas variables fuera de Vercel y usar únicamente `REPORTING_API_URL` y `REPORTING_API_TOKEN`.

Mientras `REPORTING_API_URL` esté vacío, la pantalla muestra datos demo y una etiqueta visible de “Modo demostración”. Cuando la API responde correctamente, la etiqueta cambia a “SQL Server conectado”. Consulta el manual de despliegue en `reporting-api/README.md`.
