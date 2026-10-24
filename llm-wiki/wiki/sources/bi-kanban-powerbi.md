---
id: bi-kanban-powerbi
title: "Ingeniería Inversa: BI Kanban (Power BI a Indicadores Firplak)"
type: source
source_file: "raw/Power-bi/BI Kanban.pbix"
date_ingested: 2026-10-23
tags: ["#powerbi", "#ingenieria-inversa", "#planner", "#supabase", "#kanban", "#carga"]
---

# 📊 Ingeniería Inversa: BI Kanban (`BI Kanban.pbix`)

## 1. Resumen Ejecutivo
Descomposición y reingeniería del archivo `BI Kanban.pbix` para sustituir el flujo inestable de Dataverse por una extracción automatizada vía **Microsoft Graph API (`AGENTE PERFORMANCE`)** almacenada de forma óptima en **Supabase** (`fact_planner_corte_diario` y `dim_personal_capacidad`).

## 2. Vistas del Reporte Original (Replicadas al 100%)
1. **Firplak (Macro)**: Resumen ejecutivo macro corporativo (`MacroSubView.tsx`).
2. **Área**: Desglose operativo departamental con comparativa de carga y % atraso (`AreasSubView.tsx`).
3. **Detalle**: Trazabilidad granular con paginación, filtros múltiples y búsqueda (`CargaView.tsx`).
4. **Historial**: Evolución temporal acumulada y flujo acumulado (`HistorialSubView.tsx`).
5. **Carga**: Balanceo de carga vs capacidad/WIPL y configuración interactiva (`CargaView.tsx`).
6. **FPKs**: Asignaciones y auditoría de tareas huérfanas sin asignar por plan (`HuerfanasSubView.tsx`).
7. **Aplazamientos**: Días de retraso, histograma de permanencia y envejecimiento (`AplazamientosSubView.tsx`).

## 3. Modelo de Datos Reconstruido en Supabase
* **`fact_planner_corte_diario`**: Registra los cortes diarios a las 03:00 AM (5,086 tareas activas, 6,775 asignaciones en 144 planes activos).
* **`dim_personal_capacidad`**: Mapeo de colaboradores, áreas operativas y límite **WIPL** (por defecto 5 tareas).

## 4. Automatización Implementada
* **Conector**: Azure AD App `AGENTE PERFORMANCE` (`26c2227e-2ebe-4075-9f76-3cfa2cfe1bcf`) con permisos de aplicación `Tasks.Read.All`, `Group.Read.All`, `User.Read.All`.
* **Programación**: Función SQL `fn_tomar_corte_diario_planner()` ejecutada diariamente a las **03:00 AM Colombia** (`0 8 * * *` UTC) mediante `pg_cron`.
* **Frontend**: Tablero modular Next.js (`CargaView.tsx` + carpeta `app/components/carga/`), exportación a CSV con formato UTF-8 BOM y endpoint API `/api/carga`.
