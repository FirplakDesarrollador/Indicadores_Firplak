---
status: borrador
version: 0.2
updated: 2026-10-27
implementacion: ../app/globals.css
sources:
  - Manual de marca Firplak v1-030726 (Manual de Identidad Corporativa, PDF, 23 páginas)
  - Brand Book Firplak, versión anterior (PDF, 25 páginas), reemplazada por la v1-030726
---

# Manual de identidad web Firplak

Lineamientos para diseñar y desarrollar aplicaciones web responsive de Firplak: portales internos, dashboards, herramientas operativas y sitios.

> **Relación con el Brand Book.** Este manual **hereda** la identidad del Brand Book (logotipo, paleta, tipografía, tono y sistema gráfico) y la **traduce** a interfaces digitales. Si algo se contradice, manda el Brand Book. Lo que aquí se añade (escalas derivadas, colores funcionales, componentes, estados, accesibilidad) cubre aspectos que el Brand Book no define.

---

## 1. Principios de interfaz

La personalidad de marca (moderna, confiable, cálida, ingeniosa, sofisticada, cercana y funcional) se traduce en cuatro principios:

| Principio | En la interfaz significa | Evitar |
|---|---|---|
| **Claro, no técnico** | Etiquetas en lenguaje de negocio, un dato principal por tarjeta, jerarquía evidente. | Nombres de tablas, códigos internos o jerga de sistemas en la UI. |
| **Cercano, no informal** | Microcopy en segunda persona ("Selecciona un periodo"), mensajes de error que dicen qué hacer. | Bromas, emojis, signos de exclamación repetidos. |
| **Inspirador, no exagerado** | Mucho aire, fondos crema, fotografía de producto en contexto. | Gradientes llamativos, animaciones decorativas, colores saturados. |
| **Seguro, no arrogante** | Datos precisos, estados de carga honestos, confirmación antes de acciones destructivas. | Prometer en la UI cosas que el sistema no garantiza. |

**Regla de oro:** el contenido (los datos, el producto) es el protagonista; la marca lo enmarca, no compite con él.

---

## 2. Color

### 2.1 Paleta base (Brand Book)

| Rol | Nombre | HEX | Uso en web |
|---|---|---|---|
| Principal | Navy | `#324354` | Navegación, títulos, botón primario, encabezados de tabla, serie principal de gráficos. |
| Secundario | Sage | `#7B8E90` | Acentos, estados activos, bordes de controles, serie secundaria. **No** se usa para texto pequeño. |
| Fondo | Crema | `#F6F3EE` | Fondo general de la aplicación. |
| Complementario | Negro | `#000000` | Logo monocromático y detalles puntuales. **No** se usa como color de texto de interfaz (ver nota). |
| Superficie | Blanco | `#FFFFFF` | Tarjetas, paneles, tablas, modales. El Brand Book no lo lista como color de marca, pero lo usa como superficie en todas sus piezas. |

> **Negro en pantalla.** El Brand Book reserva el negro "para texto y detalles", pero en sus propias piezas el texto va en navy. En web el texto de interfaz se mantiene en navy (`--color-text`): el negro puro sobre crema (18,97:1) produce un contraste excesivo que fatiga en pantallas grandes y rompe la calidez de la paleta. El negro se reserva para la versión monocromática del logo, para impresión y para detalles gráficos puntuales.

### 2.2 Proporción 60 / 30 / 10 en interfaz

- **60 % crema y blanco:** fondo de la app (crema) y superficies de contenido (blanco).
- **30 % navy:** barra lateral, títulos, texto principal, botones primarios.
- **10 % sage:** ítem de menú activo, foco, chips, indicadores secundarios.
- **Negro:** fuera de la proporción; solo en detalles.

### 2.3 Escala derivada

El Brand Book define tres colores; una interfaz necesita más matices para bordes, fondos suaves, hover y texto secundario. Todos se derivan de los colores base: **no se introducen tonos nuevos**.

| Token | HEX | Uso |
|---|---|---|
| `--navy-900` | `#1F2B37` | Hover del botón primario, texto de máximo énfasis. |
| `--navy-700` | `#324354` | Navy de marca. |
| `--navy-50` | `#EEF1F4` | Fondo de fila seleccionada, hover suave. |
| `--sage-800` | `#46555A` | Texto sobre fondos sage claros. |
| `--sage-700` | `#5A6B6D` | Texto de acento y enlaces secundarios (sage legible). |
| `--sage-500` | `#7B8E90` | Sage de marca. |
| `--sage-300` | `#B4C1C2` | Acento de texto e iconos **sobre navy** (el sage de marca no alcanza 3:1 sobre navy). |
| `--sage-50` | `#EFF2F2` | Fondo de chips y badges neutros. |
| `--crema-100` | `#F6F3EE` | Crema de marca. |
| `--crema-200` | `#ECE7DF` | Fondo de encabezados secundarios y zonas agrupadas. |
| `--crema-300` | `#D9D3C9` | Divisores y bordes decorativos. |
| `--gray-600` | `#5F6B73` | Texto secundario, etiquetas, pies. |

### 2.4 Colores funcionales

El Brand Book no define colores de estado. Se proponen tonos **desaturados**, coherentes con la "saturación contenida" de la marca. Úsalos **solo para comunicar estado o dirección de un dato**, nunca como decoración.

| Token | HEX | Uso |
|---|---|---|
| `--success` | `#3D6E55` | Variación positiva, meta cumplida, operación exitosa. |
| `--warning` | `#8A6420` | Advertencias, datos parciales o desactualizados. |
| `--danger` | `#9E4335` | Errores, variación negativa, acciones destructivas. |
| `--info` | `#324354` | Información neutral (se reutiliza el navy). |

Cada color funcional se acompaña de un fondo al 10 % de opacidad para alertas y badges, y **siempre de un icono o texto**: el color nunca es el único portador del significado.

### 2.5 Contraste (WCAG 2.2 AA)

Combinaciones verificadas. Mínimos: 4,5:1 para texto normal, 3:1 para texto grande (≥ 24 px, o ≥ 18,66 px en negrita) y para componentes de UI.

| Texto / elemento | Sobre blanco | Sobre crema | Veredicto |
|---|---|---|---|
| Navy `#324354` | 10,16 | 9,18 | ✅ Cualquier texto |
| Navy 900 `#1F2B37` | 14,39 | 13,00 | ✅ Cualquier texto |
| Negro `#000000` | 21,00 | 18,97 | ✅ Cumple, pero no se usa para texto de interfaz (ver 2.1) |
| Gris 600 `#5F6B73` | 5,47 | 4,94 | ✅ Texto secundario |
| Sage 700 `#5A6B6D` | 5,59 | 5,05 | ✅ Texto de acento |
| Sage `#7B8E90` | 3,43 | 3,10 | ⚠️ Solo iconos, bordes y texto grande |
| Success / Warning / Danger | 5,90 / 5,35 / 6,35 | 5,33 / 4,83 / 5,74 | ✅ Texto |

| Texto sobre fondo de color | Contraste | Veredicto |
|---|---|---|
| Blanco o crema sobre navy | 10,16 / 9,18 | ✅ Cualquier texto |
| Crema sobre negro | 18,97 | ✅ Cualquier texto (piezas de marca, no interfaz) |
| Crema al 72 % sobre navy (texto secundario de navegación) | 5,67 | ✅ Texto |
| Sage 300 `#B4C1C2` sobre navy | 5,49 | ✅ Texto e iconos de acento |
| Blanco sobre sage | 3,43 | ⚠️ Solo texto grande o en negrita (ajuste al Brand Book para web) |
| Navy sobre sage | 2,96 | ❌ No usar |
| Navy sobre negro | 2,07 | ❌ No usar |

> Los bordes de campos de formulario usan sage (3,10:1 sobre crema) para cumplir el mínimo de 3:1 de componentes. El borde `--crema-300` es solo decorativo (divisores).

---

## 3. Tipografía

### 3.1 Familias

| Rol | Familia | Pesos | Uso |
|---|---|---|---|
| Principal | **Montserrat** | 300, 400, 500, 600 | Todo el texto de interfaz. El peso 300 (Light) es solo para el título de página, como los títulos de sección del Brand Book. |
| Display | **Jost** | 300 | Solo momentos de marca: login, cabecera del portal, portadas. Nunca en vistas de trabajo (dashboards, tablas, paneles). |

- *Orborn Medium* (display del Brand Book) **no tiene licencia web confirmada** (`pendiente`). La escala tipográfica del Brand Book usa Jost para H1, y en la v1-030726 la muestra de Orborn y los titulares de portada se ven en Jost, por lo que Jost es el sustituto en web.
- **Dos niveles de titular.** El Brand Book define la display como de "uso ocasional y acotado", y en la v1-030726 los títulos de sección van en Montserrat Light. Por eso en web Jost queda para los momentos de marca, y el título de cada vista usa Montserrat 300.
- Carga las fuentes con `next/font/google` (o autohospedadas con `font-display: swap`). No uses `@import` de Google Fonts en CSS: bloquea el render.
- Fuente de respaldo: `system-ui, -apple-system, "Segoe UI", sans-serif`.

### 3.2 Escala fluida

Adaptación de la jerarquía del Brand Book (pensada para piezas editoriales) a pantallas. El cuerpo baja de 18 px a 15–16 px porque las interfaces de datos necesitan densidad.

| Nivel | Familia / peso | Tamaño | Interlineado | Uso |
|---|---|---|---|---|
| Display | Jost 300 | `clamp(2.25rem, 1.5rem + 3vw, 3.5rem)` | 1.1 | Momentos de marca: login, cabecera del portal, portadas. |
| H1 | Montserrat 300 | `clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem)` | 1.15 | Título de página (uno por vista) y títulos de paneles laterales. |
| H2 | Montserrat 500 | `clamp(1.125rem, 1rem + 0.5vw, 1.375rem)` | 1.3 | Título de panel o sección. |
| H3 / Eyebrow | Montserrat 600, MAYÚSCULAS, `letter-spacing: .14em` | 0.75rem | 1.4 | Antetítulos ("RESUMEN DIARIO"), categorías. |
| Cuerpo | Montserrat 400 | 1rem (0.9375rem en tablas densas) | 1.6 | Texto corrido, descripciones. |
| Pequeño | Montserrat 500 | 0.8125rem | 1.45 | Pies, ayudas, metadatos. |
| KPI | Montserrat 500, `tabular-nums` | `clamp(1.5rem, 1.2rem + 1vw, 2rem)` | 1.1 | Cifras principales de tarjetas. |

### 3.3 Reglas

- Cifras en tablas y KPIs con `font-variant-numeric: tabular-nums` para que las columnas se alineen.
- Números alineados a la derecha; texto a la izquierda. Nunca justificado.
- Longitud de línea de texto corrido: 60–75 caracteres (`max-width: 68ch`).
- Mínimo absoluto de 12 px, solo en etiquetas en mayúsculas; el cuerpo nunca baja de 14 px.
- Unidades `rem` para que la interfaz respete el tamaño de letra del navegador.

---

## 4. Espaciado, retícula y responsive

### 4.1 Escala de espaciado (base 4 px)

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` → tokens `--space-1` a `--space-9`.

- Dentro de un componente: 8–16 px.
- Entre componentes: 24 px.
- Entre secciones: 48–64 px.
- **Ante la duda, más aire.** El Brand Book prioriza "contraste y aire".

### 4.2 Puntos de corte (mobile-first)

| Nombre | Rango | Columnas | Margen lateral | Gutter |
|---|---|---|---|---|
| Móvil | < 640 px | 4 | 16 px | 16 px |
| Tablet | 640–1023 px | 8 | 24 px | 24 px |
| Escritorio | 1024–1439 px | 12 | 32 px | 24 px |
| Amplio | ≥ 1440 px | 12 | 48 px | 32 px (contenido máx. 1440 px) |

```css
/* Escribe primero el estilo móvil, luego amplía */
@media (min-width: 640px)  { /* tablet */ }
@media (min-width: 1024px) { /* escritorio */ }
@media (min-width: 1440px) { /* amplio */ }
```

- Usa solo estos tres cortes. Si un componente necesita adaptarse a su contenedor y no a la pantalla, usa `@container`.
- Prefiere layouts intrínsecos: `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` para tarjetas.
- Sin scroll horizontal de página en ningún ancho a partir de 320 px.

### 4.3 Patrones responsive

| Elemento | Móvil | Tablet | Escritorio |
|---|---|---|---|
| Navegación | Barra superior + menú lateral deslizable | Igual que móvil | Barra lateral fija de 248 px |
| KPIs | 1 columna (o 2 si caben) | 2 columnas | 4 columnas |
| Filtros | Botón "Filtros" que abre un panel inferior o lateral | Fila que se envuelve | Fila completa |
| Tablas | Scroll horizontal con primera columna fija, o vista de tarjetas si hay ≤ 5 campos clave | Scroll horizontal | Tabla completa |
| Detalle de registro | Pantalla completa | Panel lateral al 60 % | Panel lateral de 480 px |
| Gráficos | Altura de 220 px, menos marcas en los ejes | 280 px | 320 px |

### 4.4 Interacción táctil

- Área táctil mínima de **44 × 44 px** (aunque el icono sea de 20 px).
- Separación mínima de 8 px entre elementos tocables.
- Nada debe depender solo de `hover`: los tooltips deben abrirse también con tap o foco.

---

## 5. Logotipo en web

| Regla | Valor |
|---|---|
| Formato | **SVG** (`pendiente` de obtener el SVG oficial). PNG solo como respaldo, recortado y sin margen. |
| Ancho mínimo | 120 px (Brand Book). |
| Área de seguridad | 1X en todos los lados (X = altura del símbolo "Λ"). Implementar con `padding` del contenedor, no con márgenes negativos. |
| Versión clara | Navy sobre crema o blanco. |
| Versión negativa | Blanco o crema sobre navy, sage o fotografía con capa de contraste. |
| Monocromática (negro) y escala de grises | Aprobadas en el Brand Book v1-030726. En web son de uso excepcional (documentos o exportaciones en blanco y negro, impresión). En pantalla se usan la versión clara o la negativa. |
| Con eslogan | Solo en login, portadas y pie de página; nunca en barras de navegación por debajo de 200 px de ancho. |
| Espacios reducidos | Monograma "Λ" (favicon, avatar, icono de app, menú colapsado). |

**Prohibido en web:** recortar el logo con `overflow` y posiciones negativas, estirarlo con `object-fit: fill`, aplicarle `filter` o sombras, animarlo, o recolorearlo fuera de las versiones aprobadas.

### Favicon e iconos de app

- `favicon.svg` con el monograma "Λ" navy sobre crema, más `favicon.ico` de 32 px.
- `apple-touch-icon.png` de 180 px y `icon-512.png` de 512 px: monograma crema sobre navy con margen de seguridad.
- `theme-color`: `#324354`.

---

## 6. Sistema gráfico: el pico

- El "Λ" se usa como **marca de agua** en zonas de marca: barra lateral, panel de login, cabeceras de portada, estados vacíos.
- Opacidad del 4–8 % sobre navy, o del 5 % en navy sobre crema. Nunca sobre tablas, gráficos ni formularios.
- Puede salirse por un borde del contenedor, como en el Brand Book, pero nunca superponerse al logotipo.
- El patrón de monogramas solo se usa en fondos de páginas de marca (login, error 404), nunca detrás de datos.
- Implementación: un único componente SVG decorativo con `aria-hidden="true"` y `pointer-events: none`.

---

## 7. Componentes

### 7.1 Forma

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 8 px | Botones, campos, badges cuadrados. |
| `--radius-md` | 14 px | Tarjetas, paneles, modales. |
| `--radius-pill` | 999 px | Chips y filtros activos (como las etiquetas de personalidad del Brand Book). |
| `--shadow-sm` | `0 1px 2px rgb(50 67 84 / .06)` | Tarjetas en reposo. |
| `--shadow-md` | `0 8px 24px rgb(50 67 84 / .08)` | Menús, paneles flotantes. |
| `--shadow-lg` | `0 16px 48px rgb(50 67 84 / .14)` | Modales y paneles laterales. |

Prefiere bordes de 1 px (`--crema-300`) sobre sombras. La estética es plana y limpia.

### 7.2 Estados obligatorios

Todo componente interactivo define: **reposo, hover, foco, activo, deshabilitado y cargando**.

- **Foco:** `outline: 2px solid var(--sage-700); outline-offset: 2px;` mediante `:focus-visible`. Nunca `outline: none` sin reemplazo.
- **Deshabilitado:** opacidad del 45 %, `cursor: not-allowed`, sin hover.
- **Cargando:** el botón conserva su ancho, muestra un spinner y queda deshabilitado.

### 7.3 Botones

| Variante | Reposo | Hover | Uso |
|---|---|---|---|
| Primario | Fondo navy, texto blanco | Navy 900 | Una acción principal por vista. |
| Secundario | Borde sage, texto navy, fondo transparente | Fondo `--navy-50` | Acciones alternativas. |
| Terciario | Solo texto sage 700 | Subrayado | Acciones de baja jerarquía ("Ver todos los días"). |
| Peligro | Fondo `--danger`, texto blanco | 10 % más oscuro | Eliminar o revocar, siempre con confirmación. |

Tamaños: 36 px de alto en escritorio y 44 px en táctil. Padding horizontal de 16 px. Texto en Montserrat 500 de 14–15 px, sin mayúsculas forzadas.

### 7.4 Formularios y filtros

- La etiqueta siempre visible encima del campo; el placeholder no la reemplaza.
- Campo: fondo blanco, borde de 1 px sage, radio de 8 px, alto de 40–44 px.
- Error: borde y mensaje en `--danger` bajo el campo, con icono y un texto que diga cómo corregirlo.
- Los filtros activos se muestran como chips eliminables y siempre hay un botón "Limpiar filtros".

### 7.5 Tarjetas de KPI

```
┌───────────────────────────────┐
│ FACTURACIÓN BRUTA     (icono) │  ← eyebrow gris 600
│ $1.284 M                      │  ← KPI navy, tabular-nums
│ ▲ 12,4 % vs. mes anterior     │  ← success/danger + icono + texto
│ 1.024 documentos              │  ← pequeño gris 600
└───────────────────────────────┘
```

- Un dato principal por tarjeta. La variación siempre lleva flecha, signo y periodo de comparación.
- Nunca muestres una variación inventada o de ejemplo en producción.

### 7.6 Tablas de datos

- Encabezado: fondo `--crema-200` o navy con texto blanco, Montserrat 600 de 12–13 px en mayúsculas.
- Filas de 44–48 px de alto, divisor de 1 px `--crema-300` y hover `--navy-50`. Sin cebrado.
- Encabezado fijo (`position: sticky`) en tablas con scroll vertical, y primera columna fija en scroll horizontal.
- Números a la derecha con `tabular-nums`; negativos en `--danger` con signo menos, no solo en rojo.
- Paginación con texto explícito ("Página 2 de 14 · 683 registros").
- Estados vacío, cargando (skeleton) y error siempre diseñados.

### 7.7 Navegación

- Barra lateral navy con logo negativo y pico de marca de agua.
- Ítem activo: fondo blanco al 8 %, barra izquierda sage de 3 px y texto blanco 600.
- Ítem en reposo: texto crema al 75 %.
- Migas de pan en la barra superior para vistas de más de un nivel.

### 7.8 Retroalimentación

| Tipo | Patrón |
|---|---|
| Alerta en página | Banda con fondo funcional al 10 %, icono, mensaje y acción ("Reintentar"). |
| Toast | Esquina inferior derecha (en móvil, inferior centrado), desaparece a los 5 s y se puede cerrar. |
| Skeleton | Bloques `--crema-200` con pulso suave; replican la forma final. |
| Estado vacío | Pico de marca de agua, título breve, explicación y acción sugerida. |

---

## 8. Visualización de datos

- **Orden de series:** 1) navy `#324354`, 2) sage `#7B8E90`, 3) navy al 45 %, 4) sage al 45 %, 5) `--crema-300`. Máximo 5 series. Si hay más, agrupa en "Otros" o usa una tabla.
- Positivo y negativo con los colores funcionales, solo cuando el signo es el mensaje.
- Rejilla horizontal tenue (`--crema-300`, 1 px), sin rejilla vertical y sin bordes de gráfico.
- Ejes en Montserrat de 12 px gris 600, con valores abreviados ("$450 M").
- Tooltip en superficie blanca, `--shadow-md`, valores completos con formato de moneda.
- Leyenda visible si hay más de una serie; nunca dependas solo del color (usa etiquetas directas cuando sea posible).
- Animaciones de entrada de 300 ms o menos, desactivadas con `prefers-reduced-motion`.
- Cada gráfico tiene título, periodo y, si aplica, la fuente del dato.

---

## 9. Formatos y contenido

| Dato | Formato (locale `es-CO`) | Ejemplo |
|---|---|---|
| Moneda completa | `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })` | $1.284.530.000 |
| Moneda abreviada | Millones con sufijo `M` a partir de $1.000.000 | $1.284,5 M |
| Porcentaje | Una cifra decimal, con coma | 12,4 % |
| Fecha corta | `dd MMM yyyy` | 27 oct 2026 |
| Fecha y hora | `dateStyle: "medium", timeStyle: "short"` | 27 oct 2026, 9:42 a. m. |

**Microcopy**

- Botones con verbo en infinitivo: "Aplicar filtros", "Ver detalle", "Reintentar".
- Errores en tres partes: qué pasó, por qué (si se sabe) y qué hacer. Ejemplo: "No pudimos cargar la facturación. Revisa tu conexión e intenta de nuevo."
- Sin términos técnicos en la UI: "Fuente de datos: Ventas", no "Vista SQL Server".
- Sentence case en títulos ("Facturación y entregas por día"); MAYÚSCULAS solo en eyebrows.

---

## 10. Iconografía

- Librería: **Lucide**, de trazo lineal y coherente con la tipografía geométrica.
- Trazo de 1,75 px. Tamaños de 16 px (en línea con texto), 20 px (botones y navegación) y 24 px (destacados).
- Color heredado del texto (`currentColor`).
- Los iconos que funcionan solos como botón llevan `aria-label`; los decorativos, `aria-hidden="true"`.

---

## 11. Fotografía en web

- Producto en contexto, luz natural y cálida, encuadres amplios y limpios (Brand Book, pág. 12).
- Servir con `next/image` en AVIF o WebP, con `sizes` correctos y `priority` solo en la imagen principal visible al cargar.
- Texto o logo sobre foto: capa navy al 45–65 % o degradado navy a transparente, de modo que se cumpla 4,5:1 en la zona del texto.
- Texto alternativo descriptivo; vacío (`alt=""`) si la foto es puramente decorativa.
- En dashboards y herramientas operativas no se usa fotografía; solo en login, portadas o estados vacíos.

---

## 12. Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--duration-fast` | 120 ms | Hover, foco, cambios de color. |
| `--duration-base` | 200 ms | Desplegables, tooltips. |
| `--duration-slow` | 320 ms | Paneles laterales, modales. |
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` | Entradas. |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | Salidas. |

- Anima solo `opacity` y `transform`.
- Obligatorio: `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`.

---

## 13. Accesibilidad (WCAG 2.2 AA)

- [ ] Contraste según la sección 2.5.
- [ ] Toda la funcionalidad accesible con teclado, en un orden de tabulación lógico.
- [ ] Foco visible en todo elemento interactivo.
- [ ] HTML semántico: `<header>`, `<nav>`, `<main>`, `<table>` con `<th scope>`, un solo `<h1>` por vista.
- [ ] `lang="es"` en `<html>`.
- [ ] Formularios con `<label>` asociado y errores anunciados (`aria-live` o `aria-describedby`).
- [ ] Modales y paneles con trampa de foco, cierre con `Esc` y retorno del foco al disparador.
- [ ] Usable con zoom al 200 % y a 320 px de ancho sin pérdida de contenido.
- [ ] Gráficos con resumen textual o tabla alternativa.

---

## 14. Rendimiento

Objetivos de Core Web Vitals (percentil 75, móvil):

| Métrica | Objetivo |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |

- Fuentes con `next/font` (sin bloqueo ni salto de texto).
- Imágenes con dimensiones declaradas.
- Librerías de gráficos cargadas solo en las rutas que las usan.
- Skeletons con las dimensiones finales, para evitar CLS.

---

## 15. Modo oscuro

Fuera del alcance de la versión 0.1: el Brand Book no lo define. Los tokens semánticos de la sección 16 ya permiten añadirlo después redefiniendo solo las variables.

---

## 16. Tokens de implementación

```css
:root {
  /* Marca */
  --navy-900: #1F2B37;
  --navy-700: #324354;
  --navy-50:  #EEF1F4;
  --sage-800: #46555A;
  --sage-700: #5A6B6D;
  --sage-500: #7B8E90;
  --sage-300: #B4C1C2;
  --sage-50:  #EFF2F2;
  --crema-100: #F6F3EE;
  --crema-200: #ECE7DF;
  --crema-300: #D9D3C9;
  --gray-600: #5F6B73;
  --white: #FFFFFF;
  --black: #000000; /* logo monocromático y detalles; no para texto de interfaz */

  /* Funcionales */
  --success: #3D6E55;
  --warning: #8A6420;
  --danger:  #9E4335;

  /* Semánticos (usa estos en los componentes) */
  --color-bg: var(--crema-100);
  --color-surface: var(--white);
  --color-surface-muted: var(--crema-200);
  --color-text: var(--navy-700);
  --color-text-strong: var(--navy-900);
  --color-text-muted: var(--gray-600);
  --color-accent: var(--sage-500);
  --color-accent-text: var(--sage-700);
  --color-border: var(--crema-300);
  --color-border-control: var(--sage-500);
  --color-focus: var(--sage-700);
  --color-nav-bg: var(--navy-700);
  --color-nav-text: var(--crema-100);
  --color-nav-text-muted: rgb(246 243 238 / .72);
  --color-on-dark-accent: var(--sage-300);
  --color-overlay: rgb(31 43 55 / .45);

  /* Tipografía */
  --font-sans: var(--font-montserrat), system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: var(--font-jost), var(--font-sans);

  /* Espaciado */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;
  --space-7: 48px; --space-8: 64px; --space-9: 96px;

  /* Forma */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-pill: 999px;
  --shadow-sm: 0 1px 2px rgb(50 67 84 / .06);
  --shadow-md: 0 8px 24px rgb(50 67 84 / .08);
  --shadow-lg: 0 16px 48px rgb(50 67 84 / .14);

  /* Movimiento */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --ease-out: cubic-bezier(.2, .8, .2, 1);
  --ease-in: cubic-bezier(.4, 0, 1, 1);

  /* Layout */
  --sidebar-width: 248px;
  --content-max: 1440px;
}
```

Carga de fuentes en Next.js (`app/layout.tsx`):

```tsx
import { Jost, Montserrat } from "next/font/google";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-montserrat" });
const jost = Jost({ subsets: ["latin"], weight: ["300"], variable: "--font-jost" });

// <html lang="es" className={`${montserrat.variable} ${jost.variable}`}>
```

**Reglas para el código**

- Los componentes usan **tokens semánticos**, nunca HEX directos.
- Un color nuevo solo entra al sistema si se deriva de la paleta base y se documenta aquí.
- Gráficos (Recharts u otra librería): leer los colores desde una constante compartida que replique los tokens, no escribir HEX en cada gráfico.

---

## 17. Checklist de revisión (PR)

- [ ] Solo tokens; ningún HEX nuevo en componentes.
- [ ] Montserrat y Jost cargadas con `next/font`; ninguna otra familia. Jost solo en momentos de marca.
- [ ] Logo en versión aprobada, ≥ 120 px y con área de seguridad.
- [ ] Revisado a 375, 768, 1280 y 1440 px, sin scroll horizontal.
- [ ] Estados de hover, foco, deshabilitado, cargando, vacío y error diseñados.
- [ ] Contraste verificado; sin texto pequeño sobre sage.
- [ ] Navegable con teclado y con `prefers-reduced-motion` respetado.
- [ ] Microcopy claro y no técnico; formatos `es-CO`.

---

## 18. Pendientes

| Tema | Estado |
|---|---|
| SVG oficial del logotipo y del monograma "Λ" | `pendiente`: solicitar a Mercadeo. |
| Licencia web de Orborn Medium | `pendiente`: mientras tanto, Jost. Confirmar si la muestra de Orborn de la v1-030726 es en realidad Jost. |
| Peso del H1 en el Brand Book | `pendiente`: la escala dice "Jost · 300", pero la muestra se ve en un peso mayor. |
| Uso del negro en texto | `pendiente`: confirmar con Mercadeo que el texto de interfaz puede seguir en navy. |
| Validación de colores funcionales por Mercadeo | `pendiente`. |
| Modo oscuro | Fuera de alcance de la v0.1. |
| Biblioteca de componentes compartida entre aplicaciones Firplak | Por evaluar cuando exista una segunda aplicación. |
