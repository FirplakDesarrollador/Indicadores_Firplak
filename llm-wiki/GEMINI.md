# 🧠 REGLAS DE OPERACIÓN LLM WIKI (GEMINI.md)

Consulta las directrices completas en [AGENTS.md](file:///c:/Users/isaza/OneDrive/Documentos/Indicadores%20FIRPLAK/indicadores-firplak/llm-wiki/AGENTS.md).

## Reglas Obligatorias:
1. **`raw/` es INMUTABLE**: Solo lectura. Jamás modifiques archivos de fuentes originales.
2. **`wiki/` es propiedad del LLM**: Genera y actualiza notas con frontmatter YAML y enlaces `[[wikilinks]]`.
3. **Cada ingesta exige actualizar**:
   - `wiki/sources/<slug>.md`
   - Entidades/conceptos relacionados
   - `wiki/index.md` (Catálogo temático)
   - `wiki/log.md` (Registro cronológico con `## [YYYY-MM-DD] ingest | Título`)
4. **Respuestas complejas**: Se archivan en `wiki/synthesis/` para capitalizar el conocimiento.
5. **Auditoría periódica**: Ejecutar `python scripts/wiki_cli.py lint` para evitar páginas huérfanas o enlaces rotos.
