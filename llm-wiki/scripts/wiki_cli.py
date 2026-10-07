#!/usr/bin/env python3
"""
LLM Wiki CLI - Herramienta de auditoría, búsqueda, estadísticas e indexación
Arquitectura basada en Karpathy LLM Wiki Pattern.
"""

import sys
import os
import re
import argparse
from pathlib import Path
from datetime import datetime

# Garantizar compatibilidad UTF-8 en consolas Windows (cp1252)
if sys.platform.startswith("win"):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

WIKI_DIR_NAME = "wiki"
RAW_DIR_NAME = "raw"

def find_root_dir() -> Path:
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / WIKI_DIR_NAME).is_dir() and (current / RAW_DIR_NAME).is_dir():
            return current
        if (current / "llm-wiki").is_dir():
            return current / "llm-wiki"
        current = current.parent
    # Fallback to parent of scripts
    return Path(__file__).resolve().parent.parent

ROOT = find_root_dir()
WIKI_PATH = ROOT / WIKI_DIR_NAME
RAW_PATH = ROOT / RAW_DIR_NAME

def get_all_wiki_slugs():
    slugs = {}
    for md in WIKI_PATH.glob("**/*.md"):
        slug = md.stem
        slugs[slug] = md
    return slugs

def extract_wikilinks(text: str):
    # Eliminar bloques de código e inline code para no capturar ejemplos de sintaxis
    text_clean = re.sub(r"```[\s\S]*?```", "", text)
    text_clean = re.sub(r"`[^`]*`", "", text_clean)
    # Matches [[slug]] or [[slug|alias]]
    pattern = r"\[\[([a-zA-Z0-9_\-\.]+)(?:\|[^\]]+)?\]\]"
    return re.findall(pattern, text_clean)

def cmd_lint(args):
    print(f"\n🔍 [LLM Wiki Lint] Auditando: {WIKI_PATH}\n" + "="*50)
    slugs = get_all_wiki_slugs()
    inbound_links = {slug: 0 for slug in slugs}
    broken_links = []
    
    # Audit links
    for md_path in WIKI_PATH.glob("**/*.md"):
        content = md_path.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(content.splitlines(), start=1):
            links = extract_wikilinks(line)
            for link in links:
                if link in slugs:
                    inbound_links[link] += 1
                else:
                    broken_links.append((md_path.relative_to(ROOT), i, link))

    # Audit orphans (except index.md and log.md)
    orphans = [
        slug for slug, count in inbound_links.items()
        if count == 0 and slug not in ["index", "log", "README"]
    ]

    # Audit log format
    log_file = WIKI_PATH / "log.md"
    log_errors = []
    if log_file.exists():
        log_content = log_file.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(log_content.splitlines(), start=1):
            if line.startswith("## ") and not line.startswith("## ["):
                log_errors.append((i, line))
            elif line.startswith("## ["):
                if not re.match(r"^## \[\d{4}-\d{2}-\d{2}\] (setup|ingest|query|lint|update) \| .+", line):
                    log_errors.append((i, line))

    # Display results
    has_errors = False

    if broken_links:
        has_errors = True
        print(f"❌ Enlaces Rotos Encontrados ({len(broken_links)}):")
        for file_rel, line_no, link in broken_links:
            print(f"   - {file_rel}:{line_no} -> [[{link}]] (archivo inexistente)")
    else:
        print("✅ Sin enlaces rotos.")

    if orphans:
        print(f"\n⚠️  Páginas Huérfanas ({len(orphans)}) [Sin enlaces entrantes]:")
        for o in orphans:
            print(f"   - [[{o}]] ({slugs[o].relative_to(ROOT)})")
    else:
        print("✅ Sin páginas huérfanas.")

    if log_errors:
        print(f"\n⚠️  Advertencias en formato de log.md ({len(log_errors)}):")
        for line_no, line in log_errors:
            print(f"   - Línea {line_no}: '{line}' (Formato esperado: ## [YYYY-MM-DD] accion | Título)")
    else:
        print("✅ Formato de wiki/log.md válido.")

    print("\n" + "="*50)
    print("✨ Auditoría finalizada.\n")
    return 1 if broken_links else 0

def cmd_search(args):
    query = args.query.lower()
    print(f"\n🔎 Buscando: '{args.query}' en {ROOT}...\n" + "-"*50)
    matches = 0

    for md_file in list(WIKI_PATH.glob("**/*.md")) + list(RAW_PATH.glob("**/*.md")):
        rel_path = md_file.relative_to(ROOT)
        content = md_file.read_text(encoding="utf-8", errors="ignore")
        file_matches = []

        for i, line in enumerate(content.splitlines(), start=1):
            if query in line.lower():
                file_matches.append((i, line.strip()))

        if file_matches:
            matches += len(file_matches)
            print(f"📄 {rel_path} ({len(file_matches)} coincidencias):")
            for line_no, line in file_matches[:5]:
                print(f"   L{line_no}: {line}")
            if len(file_matches) > 5:
                print(f"   ... (+{len(file_matches) - 5} más)")
            print()

    print(f"Total coincidencias: {matches}\n")

def cmd_stats(args):
    slugs = get_all_wiki_slugs()
    raw_files = list(RAW_PATH.glob("**/*"))
    raw_files = [f for f in raw_files if f.is_file() and f.name != "README.md"]

    sources = list((WIKI_PATH / "sources").glob("*.md")) if (WIKI_PATH / "sources").is_dir() else []
    entities = list((WIKI_PATH / "entities").glob("*.md")) if (WIKI_PATH / "entities").is_dir() else []
    concepts = list((WIKI_PATH / "concepts").glob("*.md")) if (WIKI_PATH / "concepts").is_dir() else []
    synthesis = list((WIKI_PATH / "synthesis").glob("*.md")) if (WIKI_PATH / "synthesis").is_dir() else []

    total_wikilinks = 0
    for md in WIKI_PATH.glob("**/*.md"):
        content = md.read_text(encoding="utf-8", errors="ignore")
        total_wikilinks += len(extract_wikilinks(content))

    print(f"\n📊 [LLM Wiki Stats] Resumen de Conocimiento\n" + "="*45)
    print(f"📂 Fuentes crudas inmutables (raw/):  {len(raw_files)}")
    print(f"📑 Fichas de fuentes (wiki/sources/): {len(sources)}")
    print(f"🧠 Conceptos (wiki/concepts/):       {len(concepts)}")
    print(f"👤 Entidades (wiki/entities/):       {len(entities)}")
    print(f"🧪 Síntesis (wiki/synthesis/):       {len(synthesis)}")
    print(f"🔗 Enlaces bidireccionales activos:  {total_wikilinks}")
    print(f"📝 Total páginas wiki:               {len(slugs)}")
    print("="*45 + "\n")

def cmd_index(args):
    print(f"\n📑 Verificando catálogo en wiki/index.md...\n")
    index_file = WIKI_PATH / "index.md"
    if not index_file.exists():
        print("❌ Error: No existe wiki/index.md")
        return

    content = index_file.read_text(encoding="utf-8", errors="ignore")
    slugs = get_all_wiki_slugs()
    missing = []

    for slug, path in slugs.items():
        if slug in ["index", "log", "README"]:
            continue
        link_str = f"[[{slug}]]"
        if link_str not in content:
            missing.append((slug, path.relative_to(ROOT)))

    if missing:
        print(f"⚠️  Páginas no catalogadas en wiki/index.md ({len(missing)}):")
        for slug, rel in missing:
            print(f"   - {slug} ({rel})")
        print("\nSugerencia: Añade estas páginas a sus respectivas secciones en index.md.")
    else:
        print("✅ Todas las páginas del wiki están catalogadas en wiki/index.md.")

def main():
    parser = argparse.ArgumentParser(description="CLI de gestión para LLM Wiki")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # Lint
    subparsers.add_parser("lint", help="Auditar salud del wiki (enlaces rotos, huérfanos, formato)")

    # Search
    search_p = subparsers.add_parser("search", help="Buscar texto en wiki y raw")
    search_p.add_argument("query", help="Término de búsqueda")

    # Stats
    subparsers.add_parser("stats", help="Mostrar métricas de la base de conocimiento")

    # Index
    subparsers.add_parser("index", help="Validar catalogación de páginas en index.md")

    args = parser.parse_args()

    if args.command == "lint":
        sys.exit(cmd_lint(args))
    elif args.command == "search":
        cmd_search(args)
    elif args.command == "stats":
        cmd_stats(args)
    elif args.command == "index":
        cmd_index(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
