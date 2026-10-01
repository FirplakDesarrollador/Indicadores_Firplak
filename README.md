# Indicadores Firplak

Dashboard web en Next.js + TypeScript para migrar las vistas principales de Power BI a una experiencia web propia.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura inicial

- `app/page.tsx`: dashboard ejecutivo y datos mock tipados.
- `app/globals.css`: sistema visual responsive.
- `app/layout.tsx`: metadata y layout raíz.

## Próximo paso de integración

Reemplazar los arreglos mock de `app/page.tsx` por llamadas a una capa de datos (`lib/api` o Route Handlers de Next.js). Los indicadores y filtros ya están separados visualmente para conectar ventas, metas, canales, regiones y categorías con la fuente definitiva.
