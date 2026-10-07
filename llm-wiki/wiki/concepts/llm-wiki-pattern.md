---
id: llm-wiki-pattern
title: Patrón LLM Wiki
type: concept
tags: [arquitectura, ia, gestion-conocimiento]
sources: ["https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"]
last_updated: 2026-10-07
---

# Patrón LLM Wiki

El **Patrón LLM Wiki** es una arquitectura para bases de conocimiento personales y corporativas propuesta por [[andrej-karpathy]].

A diferencia de los sistemas RAG tradicionales (donde los fragmentos se redescubren de cero en cada consulta sin aprendizaje acumulativo), el LLM construye y mantiene activamente un **cuerpo persistente e interconectado de archivos Markdown**.

## Tres Capas Fundamentales
1. **Fuentes Crudas (`raw/`)**: Documentos fuente originales e inmutables (artículos, PDFs, notas, imágenes). Nunca son modificados por el LLM.
2. **El Wiki (`wiki/`)**: Documentos generados y mantenidos por el LLM (resúmenes, entidades, conceptos, síntesis).
3. **El Esquema (`AGENTS.md` / `GEMINI.md`)**: Reglas, convenciones y protocolos operativos que guían al LLM en ingesta, consultas y saneamiento (*linting*).

## Operaciones Clave
- **Ingesta (*Ingest*)**: Procesa fuentes crudas, extrae ideas, actualiza páginas de entidades/conceptos cruzadas, actualiza [[index]] y registra en [[log]].
- **Consulta (*Query*)**: Responde preguntas sintetizando el wiki; si la respuesta es de alto valor, se archiva como página en `wiki/synthesis/`.
- **Saneamiento (*Lint*)**: Detección periódica de huérfanos, contradicciones, enlaces rotos y lagunas de conocimiento.
