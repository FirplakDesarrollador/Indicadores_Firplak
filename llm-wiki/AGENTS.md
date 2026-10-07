# 🧠 LLM WIKI SCHEMA & PROTOCOL (AGENTS.md)

Este documento define las reglas de operación, estructura y estándares para mantener este **LLM Wiki**.
El agente actúa como **programador y curador**, y el usuario como **arquitecto y explorador**.

---

## 1. Arquitectura de 3 Capas
1. **`raw/` (Fuentes Crudas)**:
   - Contiene artículos, documentos, notas y recursos descargados.
   - **REGLA ESTRICTA**: Es **100% INMUTABLE**. El agente solo tiene permisos de LECTURA. Nunca modifiques, renombres ni elimines archivos en `raw/`.
2. **`wiki/` (Base de Conocimiento Persistente)**:
   - Propiedad exclusiva del LLM. Contiene:
     - `index.md`: Catálogo maestro de páginas por categoría.
     - `log.md`: Registro cronológico *append-only*.
     - `sources/`: Fichas estructuradas de cada fuente leída.
     - `entities/`: Fichas de personas, empresas, herramientas, frameworks.
     - `concepts/`: Principios, ideas, definiciones teóricas y metodologías.
     - `synthesis/`: Respuestas complejas, comparativas y deep-dives reutilizables.
3. **`scripts/` (Lógica y Automatización)**:
   - Herramientas auxiliares (`wiki_cli.py`) para *linting*, indexación, búsqueda y estadísticas.

---

## 2. Flujo Operativo: INGEST (Ingesta de Fuentes)
Cuando el usuario solicita procesar un documento en `raw/`:
1. **Lectura y Comprensión**: Leer el archivo completo en `raw/`.
2. **Ficha de Fuente**: Crear `wiki/sources/<slug>.md` con metadatos YAML frontmatter:
   ```yaml
   ---
   id: <slug>
   title: <Título descriptivo>
   type: source
   format: article | paper | note
   source_file: "raw/<ruta-relativa>"
   author: "[[autor]]"
   tags: [tag1, tag2]
   last_updated: YYYY-MM-DD
   ---
   ```
3. **Propagación Cruzada**:
   - Actualizar o crear páginas de entidades en `wiki/entities/` y conceptos en `wiki/concepts/`.
   - Incorporar citas y contradicciones si la nueva fuente contradice o amplía páginas existentes.
4. **Actualizar `wiki/index.md`**:
   - Insertar la nueva entrada en la tabla correspondiente con enlace `[[slug]]` y resumen conciso.
5. **Registrar en `wiki/log.md`**:
   - Añadir entrada cronológica:
     ```markdown
     ## [YYYY-MM-DD] ingest | Título de la fuente
     - Archivo crudo: `raw/...`
     - Páginas creadas o modificadas: [[slug]], [[entidad]], [[concepto]]
     ```

---

## 3. Flujo Operativo: QUERY (Consultas al Wiki)
Cuando el usuario formula una pregunta analítica:
1. **Búsqueda**: Consultar primero `wiki/index.md` o ejecutar `python scripts/wiki_cli.py search "<término>"`.
2. **Lectura de páginas relevantes**: Cargar las páginas de conceptos/entidades/fuentes correspondientes.
3. **Respuesta Sintética**: Responder con citas explícitas a las páginas del wiki (`[[slug]]`).
4. **Archivo Persistente (Compounding)**: Si la respuesta representa un análisis profundo, comparativa o conclusión nueva de alto valor:
   - Guardar en `wiki/synthesis/<slug-tema>.md`.
   - Agregar a la tabla de Síntesis en `wiki/index.md`.
   - Registrar en `wiki/log.md` (`## [YYYY-MM-DD] query | Título de la consulta`).

---

## 4. Flujo Operativo: LINT (Auditoría de Salud)
Auditoría periódica para mantener el wiki sano:
1. Ejecutar `python scripts/wiki_cli.py lint` para detectar:
   - Enlaces rotos (`[[slug]]` que no existen).
   - Páginas huérfanas (archivos sin enlaces entrantes o ausentes de `index.md`).
   - Discrepancias en frontmatter.
2. Identificar lagunas de información, afirmaciones obsoletas o contradicciones conceptuales.
3. Proponer al usuario nuevas búsquedas o fuentes para cerrar las brechas.

---

## 5. Convenciones de Enlaces y Markdown
- Usar enlaces estilo wiki: `[[nombre-del-slug]]` (compatible nativamente con Obsidian).
- Nombres de archivo: en minúsculas con guiones (kebab-case): `mi-concepto.md`.
- No colocar caracteres especiales o espacios en los nombres de archivo.
