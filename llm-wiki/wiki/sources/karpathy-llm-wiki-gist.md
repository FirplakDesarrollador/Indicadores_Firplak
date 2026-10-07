---
id: karpathy-llm-wiki-gist
title: LLM Wiki (Andrej Karpathy)
type: source
format: article
source_file: "raw/articles/karpathy-llm-wiki-gist.md"
author: "[[andrej-karpathy]]"
date: 2026-04-02
tags: [arquitectura, ia, gestion-conocimiento]
last_updated: 2026-10-07
---

# Fuente: LLM Wiki (Andrej Karpathy)

- **Archivo crudo:** `raw/articles/karpathy-llm-wiki-gist.md`
- **Autor:** [[andrej-karpathy]]
- **Enlace original:** [Gist GitHub](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

## Ideas Clave y Resumen
1. **Problema con RAG convencional**: RAG redescubre fragmentos aislados sin memoria acumulativa; responder preguntas complejas exige unir piezas desde cero cada vez.
2. **Propuesta LLM Wiki**: El LLM actúa como compilador persistente que lee fuentes y actualiza proactivamente un grafo Markdown con enlaces cruzados.
3. **Flujo de Trabajo Simbiótico**: El usuario investiga y guía en [[obsidian]] (el IDE), mientras el LLM redacta y mantiene el wiki (el código base).
4. **Tres Operaciones**: *Ingest* (incorporar fuente), *Query* (consultar y archivar síntesis valiosas) y *Lint* (auditar inconsistencias o huérfanos).

## Entidades y Conceptos Relacionados
- [[llm-wiki-pattern]]
- [[andrej-karpathy]]
- [[obsidian]]
