---
name: migrar-bi
description: Coordina la migración de un reporte de Power BI al portal de Indicadores Firplak, fase por fase y con aprobación del desarrollador entre fases. Úsala cuando alguien pida migrar, pasar o llevar un BI/Power BI al portal, o pregunte en qué fase va una migración.
---

# Migrar un BI al portal de Indicadores

Esta skill es el punto de entrada. No ejecuta todo de una vez: lleva al desarrollador por las fases, delega cada fase técnica en su skill y **se detiene en cada punto de aprobación**.

## Reparto de responsabilidades

- **Tú (IA):** el trabajo operativo. Lees, analizas, escribes código, scripts SQL, documentación y validaciones.
- **El desarrollador:** decide, valida con el negocio, **ejecuta los scripts en SQL Server**, revisa los PR y despliega. Nunca ejecutes escrituras en una base de datos ni despliegues a producción.

## Antes de empezar

1. Lee `AGENTS.md`, `llm-wiki/index.md` y `docs/manual-identidad-web.md`.
2. Pide al desarrollador el **nombre corto del BI** (slug en minúsculas con guiones, por ejemplo `cartera-clientes`) y busca si ya existe `llm-wiki/bi/<slug>.md`. Si existe, retoma desde la fase que indique su campo `fase`.
3. Confirma que estén clonados los dos repositorios, uno al lado del otro:
   - `Indicadores_Firplak` (este repositorio, frontend).
   - `reporting-api` (API, en `../reporting-api`).
4. Crea la rama `bi/<slug>` desde `main` actualizado en los repositorios que vayas a tocar.

## Fases

| # | Fase | Quién la ejecuta | Termina cuando… |
|---|---|---|---|
| 0 | Inventario: dueño de negocio, usuarios, prioridad | Desarrollador; tú creas la ficha vacía con `plantilla-ficha-bi.md` de la skill `analizar-bi` | La ficha tiene dueño, responsable y prioridad. |
| 1 | Análisis del BI | Skill `analizar-bi` | **APROBACIÓN:** el dueño de negocio valida las reglas de cada indicador. |
| 2 | Tabla y SP incremental | Skill `crear-tabla-incremental` | **APROBACIÓN:** el desarrollador ejecutó el script, el job corre y los totales cuadran con el origen. |
| 3 | Contrato del endpoint | Skill `crear-endpoint`, paso 1 | **APROBACIÓN:** el desarrollador aprueba el contrato JSON de la ficha. |
| 4 | Endpoint en la API | Skill `crear-endpoint` | Compila y el desarrollador lo probó contra la base. |
| 5 | Dashboard | Skill `crear-dashboard` | Lint y build pasan y se revisó en 375, 820 y 1440 px. |
| 6 | Conciliación con Power BI | Tú preparas la comparación; el desarrollador la presenta | **APROBACIÓN:** el dueño de negocio firma que las cifras coinciden. |
| 7 | Despliegue, documentación y retiro | Desarrollador despliega; tú documentas | API y frontend en producción, wiki al día, Power BI retirado. |

En cada fase:

1. Presenta primero un **plan corto** de lo que vas a hacer y espera la aprobación.
2. Ejecuta.
3. Actualiza el campo `fase` y la sección correspondiente de la ficha `llm-wiki/bi/<slug>.md`.
4. Resume qué hiciste, qué validaste y qué falta, y **detente** si la fase tiene punto de APROBACIÓN.

## Fase 6: conciliación

Prepara para el desarrollador:

- La lista de indicadores de la ficha, cada uno con su valor en el dashboard y un espacio para el valor de Power BI, para al menos tres periodos (mes actual, mes anterior y un mes con notas o ajustes).
- Las consultas SQL de solo lectura que explican cada cifra, por si hay diferencias.
- Una diferencia mayor a una unidad de redondeo es un hallazgo: documenta la causa en la ficha antes de seguir.

## Reglas que no se negocian

- **Nada de datos inventados.** Ni tendencias, ni metas, ni valores de ejemplo en producción. Si un indicador no tiene datos reales, no se muestra.
- **Filtros en SQL.** Todo filtro del dashboard llega a la API y se aplica en la consulta, nunca solo en el navegador.
- **Sin secretos.** No leas ni copies `.env`, `.env.local` ni tokens. Las credenciales nuevas van en `.env.example` como variable vacía.
- **Nombres reales.** No inventes tablas, columnas ni endpoints: confírmalos en la ficha, el código o con el desarrollador.
- **Elementos sin función, fuera.** No agregues botones, menús ni enlaces que no hagan nada.
- **Documentación al día.** Toda decisión que cambie comportamiento va a la ficha y a `llm-wiki/log.md`.

## Definición de terminado

- [ ] Ficha `llm-wiki/bi/<slug>.md` completa, con `fase: 7`, enlazada desde `llm-wiki/index.md`.
- [ ] Tabla, SP, índices y job documentados (script en la ficha o enlazado).
- [ ] Endpoint documentado en `reporting-api/README.md` y en `llm-wiki/components/reporting-api.md`.
- [ ] Dashboard accesible desde el portal y documentado en `llm-wiki/components/frontend.md`.
- [ ] Conciliación firmada por el dueño de negocio (fecha y nombre en la ficha).
- [ ] PR revisado por otro desarrollador y unido a `main` en ambos repositorios.
- [ ] Entrada en `llm-wiki/log.md` con validación y rollback.
