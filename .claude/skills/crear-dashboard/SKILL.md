---
name: crear-dashboard
description: Construye un dashboard nuevo en el portal de Indicadores (Next.js) a partir del contrato de un endpoint de la Reporting API, con proxy server-side, filtros aplicados con botón, identidad visual Firplak y diseño responsive. Úsala en la fase 5 de una migración o cuando pidan una pantalla de indicadores nueva.
---

# Crear un dashboard en el portal

**Referencias obligatorias**, léelas antes de escribir:

- `docs/manual-identidad-web.md`: tokens, tipografía (solo Montserrat), colores, componentes, accesibilidad y responsive.
- `components/FacturacionDashboard.tsx`: patrón actual de filtros en borrador, opciones desde `filterOptions`, KPIs, tablas y panel de detalle.
- `app/api/facturacion-diaria/route.ts`: patrón del proxy.
- La sección 3 (contrato) de `llm-wiki/bi/<slug>.md`, que debe estar aprobada.

## Componentes comunes primero

Si existe `components/dashboard/` con piezas reutilizables (barra de filtros, tarjeta KPI, tabla, panel de detalle), **úsalas**.

Si no existe, propón al desarrollador extraerlas de `FacturacionDashboard.tsx` **antes** de crear el dashboard nuevo y espera su aprobación. Nunca copies el archivo completo de facturación: cada copia diverge y multiplica los errores.

## Pasos

1. **Tipos:** `lib/<tema>/types.ts` con las formas exactas del contrato (fila, summary, `filterOptions` opcional, payload).
2. **Proxy:** `app/api/<tema>/route.ts`, igual al de facturación. Reenvía los parámetros a `${REPORTING_API_URL}/api/v1/<tema>` con el token en el header, `cache: "no-store"` y `AbortSignal.timeout(60000)`. El token es solo del servidor: **nunca** `NEXT_PUBLIC_`.
3. **Página:** `app/<tema>/page.tsx` que renderiza el componente del dashboard. El middleware ya exige sesión en toda ruta nueva; no lo dupliques.
4. **Filtros:**
   - Estado en **borrador**: no consultan hasta pulsar **Aplicar filtros**, la lupa o Enter. **Limpiar** restablece todo con una sola consulta.
   - Opciones desde `filterOptions` de la API; respaldo en las filas visibles solo si la API aún no lo envía.
   - Todos los filtros viajan a la API. Ninguno se aplica solo en el navegador.
   - Listas dependientes (por ejemplo, ciudad según zona) se filtran localmente a partir de los pares que envía la API, y al cambiar el padre se limpia el hijo.
5. **Indicadores:** solo los de la ficha, calculados por la API en `summary`. **Prohibido** mostrar tendencias, metas o valores de ejemplo escritos en el código.
6. **Formatos `es-CO`:** moneda `$1.284.530.000`, abreviada `$1.284,5 M`, porcentaje `12,4 %`, fechas con `Intl.DateTimeFormat("es-CO")`.
7. **Estilos:**
   - Solo tokens de `app/globals.css` (`var(--color-…)`, `var(--space-…)`). Ningún HEX nuevo.
   - Estilos propios en `app/styles/<tema>.css`, importado en `app/layout.tsx`. Reutiliza las clases existentes cuando sirvan.
   - Colores de gráficos desde `lib/brand.ts`.
   - Cortes 640/1024/1440 y `@container` para cuadrículas que dependen del espacio disponible.
8. **Accesibilidad:** foco visible, filas clicables operables con teclado, `aria-label` en botones de solo icono, controles táctiles de 44 px.
9. **Estados:** carga (skeleton con la forma final), vacío y error con "Reintentar". Si la sesión expiró, el mensaje lo dice.
10. **Portal:** agrega la tarjeta en `accessCards` de `app/page.tsx` y, si aplica, el ítem en la navegación lateral.
11. **Sin elementos decorativos sin función:** nada de botones "···", "Ayuda" o enlaces que no lleven a nada.

## Verificación

1. `npm run lint` y `npm run build` sin errores ni advertencias.
2. Revisión visual a **375, 820 y 1440 px**:
   - Con sesión real: `npm run dev` y las herramientas de dispositivo del navegador.
   - Sin sesión: una copia temporal sin `middleware.ts`, fuera del repositorio, con variables ficticias, y capturas en iframes de ancho fijo (Edge o Chrome sin interfaz no bajan de unos 500 px de ancho). Borra la copia al terminar.
3. Con datos reales: cambia varios filtros, aplica y comprueba que los KPIs, las tablas y la URL del proxy (pestaña Red) reflejan los filtros.
4. Actualiza la sección 5 de la ficha, `llm-wiki/components/frontend.md` y `llm-wiki/log.md`.

## No hagas

- No leas `.env.local`.
- No cambies los tokens de marca ni el manual sin aprobación de Mercadeo.
- No unas a `main` sin PR. Lo revisa el mismo desarrollador responsable: no se exige un segundo revisor.
