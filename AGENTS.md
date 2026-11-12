# Instrucciones para agentes de IA

Este repositorio mantiene una wiki persistente para agentes LLM en [`llm-wiki/`](llm-wiki/index.md).

## Antes de trabajar

1. Lee [`llm-wiki/index.md`](llm-wiki/index.md).
2. Abre solo las páginas relacionadas con la tarea.
3. Comprueba el código y la configuración real antes de afirmar que algo existe.
4. No leas, copies ni expongas valores secretos de `.env.local`, `.env` o tokens.
5. Para migrar un reporte de Power BI, sigue la skill [`migrar-bi`](.claude/skills/migrar-bi/SKILL.md): coordina las fases y los puntos de aprobación del desarrollador.

## Fuentes de verdad

En caso de contradicción, usa este orden:

1. Código ejecutable y consultas SQL.
2. Archivos `.env.example` y contratos tipados.
3. README y runbooks.
4. Páginas de `llm-wiki/`, que deben enlazar a la evidencia.

La wiki sintetiza el repositorio; no reemplaza al código. Cuando una decisión cambie el comportamiento, actualiza la página afectada y agrega una entrada en [`llm-wiki/log.md`](llm-wiki/log.md).

## Operaciones de la wiki

- **Ingestar:** leer una fuente, resumirla, actualizar las páginas afectadas, el índice y el log.
- **Consultar:** leer primero el índice, después las páginas relevantes y finalmente la fuente primaria.
- **Revisar:** buscar enlaces rotos, páginas huérfanas, afirmaciones obsoletas, contradicciones y secretos expuestos.

Las fuentes originales son inmutables. Las páginas de la wiki deben incluir enlaces relativos a archivos del repositorio y marcar como `pendiente` cualquier afirmación que no esté verificada.

## Convenciones

- Documentación en español; nombres de código, rutas y variables conservan su forma original.
- Cada página usa frontmatter YAML con `status`, `updated` y `sources` cuando sea útil.
- No inventes nombres de tablas, endpoints, variables o credenciales.
- En cambios de infraestructura, documenta validación, rollback y diagnóstico.
