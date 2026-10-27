---
name: analizar-bi
description: Analiza un reporte de Power BI exportado como proyecto (.pbip) y produce la ficha del BI en la wiki, con fuentes, reglas de cada indicador, filtros y seguridad. Úsala en la fase 1 de una migración, o cuando pidan entender, documentar o desglosar un Power BI.
---

# Analizar un BI de Power BI

El objetivo es que cualquier persona entienda **qué muestra el BI, de dónde salen los datos y cómo se calcula cada cifra**, sin abrir Power BI. El resultado es la ficha `llm-wiki/bi/<slug>.md`.

## Insumo: el BI como texto

Un `.pbix` es binario y no se puede leer. Pide al desarrollador que, en Power BI Desktop, use **Archivo → Guardar como → Proyecto de Power BI (.pbip)** y deje la carpeta en `bi-origen/<slug>/` de este repositorio.

- El modelo queda en `<nombre>.SemanticModel/`: en `definition/` (archivos `.tmdl`) o en `model.bim` (JSON), según la versión.
- Los visuales quedan en `<nombre>.Report/`: en `report.json` o en `definition/pages/`.
- Power BI crea su propio `.gitignore` en el proyecto. Verifica que excluya `.pbi/localSettings.json` y `.pbi/cache.abf` antes de cualquier commit.
- Si la carpeta no existe, **detente** y pide la exportación. No intentes leer el `.pbix`.

## Pasos

1. **Crea o completa la ficha** copiando `plantilla-ficha-bi.md` (en esta carpeta) a `llm-wiki/bi/<slug>.md`.
2. **Fuentes de datos.** En cada tabla del modelo, lee la partición M:
   - `Sql.Database("servidor", "base", [Query="..."])`: copia el SQL completo a la ficha.
   - Pasos de transformación M (`Table.SelectRows`, `Table.AddColumn`, `Table.Group`…): tradúcelos a lenguaje claro y anota cuáles deberán pasar al SQL de la tabla nueva.
   - Fuentes que no son SQL Server (Excel, SharePoint, carpetas): márcalas como **riesgo**; necesitan una decisión del desarrollador.
3. **Relaciones.** Lista las relaciones del modelo (tabla, columna, cardinalidad, dirección). Indican qué uniones necesitará la tabla de reporte.
4. **Medidas DAX.** Por cada medida usada en un visual, escribe:
   - El DAX original.
   - La regla en lenguaje de negocio ("Facturación neta = facturado menos notas crédito").
   - Dónde vivirá en la nueva arquitectura: en el **SP** (lógica por fila), en el **summary de la API** (agregaciones) o en el **frontend** (solo formato).
   Las medidas que no usa ningún visual van en una lista aparte como "no migrar, confirmar".
5. **Visuales y filtros.** Por cada página: visuales (tipo, medidas y dimensiones), segmentadores y filtros de página o de informe. De aquí salen los indicadores y filtros del dashboard.
6. **Seguridad.** Busca roles de seguridad por filas (RLS, `role` en TMDL o `roles` en `model.bim`). Si hay, documenta quién ve qué: el portal **aún no tiene permisos por usuario** y es una decisión pendiente del desarrollador.
7. **Validación con datos.** Si tienes una conexión de solo lectura a SQL Server, comprueba columnas, tipos y valores reales de los filtros (por ejemplo, los valores distintos de una columna de canal). Si no la tienes, escribe en la ficha las consultas que el desarrollador debe ejecutar y pide los resultados. Nunca supongas valores.
8. **Propuesta de tabla.** Propón el nivel de detalle (grano), las columnas y la fecha de referencia de la tabla `Informe_<tema>` en la sección correspondiente de la ficha. No escribas el script todavía: es la fase 2.
9. Enlaza la ficha desde `llm-wiki/index.md` y agrega una entrada en `llm-wiki/log.md`.

## Al terminar

Resume para el desarrollador:

- Indicadores encontrados y la regla de cada uno.
- Riesgos: fuentes no SQL, lógica compleja, RLS, cifras que no se pueden reproducir.
- Preguntas para el dueño de negocio.

Luego **detente**: la fase 1 termina con la validación del dueño de negocio, no con tu análisis.

## No hagas

- No copies credenciales ni cadenas de conexión con contraseña a la ficha.
- No inventes reglas que no estén en el DAX o el M. Si una regla no se entiende, regístrala como pregunta.
- No migres visuales decorativos ni medidas sin uso sin confirmarlo.
