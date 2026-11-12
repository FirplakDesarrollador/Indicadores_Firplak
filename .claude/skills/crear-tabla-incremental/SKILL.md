---
name: crear-tabla-incremental
description: Escribe el script T-SQL de una tabla de reporte en Planos_Symphony con su SP de actualización incremental, índices, bitácora y consultas de validación, a partir de la ficha del BI. Úsala en la fase 2 de una migración o cuando pidan convertir un query de Power BI en una tabla con carga incremental.
---

# Crear tabla de reporte con carga incremental

La API nunca consulta vistas pesadas: consulta una tabla preparada que un SP mantiene actualizada (ver `llm-wiki/decisions/ADR-001-reporting-table.md`). Esta skill escribe ese script. **El desarrollador lo revisa y lo ejecuta; tú nunca ejecutas escrituras en SQL Server.**

## Insumos

- La ficha `llm-wiki/bi/<slug>.md` con la fase 1 aprobada: SQL de origen, transformaciones, reglas y la propuesta de tabla.
- `plantilla-tabla-sp.sql` (en esta carpeta).

Si la ficha no tiene la fase 1 aprobada, **detente** y avísalo.

## Pasos

1. **Confirma el diseño con el desarrollador**, en una tabla corta:
   - Grano: "una fila por …" y su clave.
   - Fecha de referencia: la columna por la que el dashboard filtra el periodo.
   - Columnas: dimensiones de filtro y medidas, con tipo de dato.
   - Estrategia incremental (abajo).
2. **Escribe el script** copiando la plantilla a `sql/<slug>/01_informe_<tema>.sql` en este repositorio y reemplazando los marcadores `<...>`:
   - Las transformaciones M y la lógica por fila del DAX van en el `SELECT` del SP.
   - Normaliza aquí los textos que se usarán como filtro (`LTRIM(RTRIM(...))`, mayúsculas consistentes). No dejes esa limpieza para la pantalla: así nacieron duplicados como ENVIGADO/ENVÍGADO.
   - Usa los mismos nombres de columna del origen cuando tengan sentido; si renombras, documenta la equivalencia en la ficha.
3. **Índices:** uno por la fecha de referencia y uno por cada dimensión que se filtre a menudo, combinada con la fecha. Explica en la ficha por qué existe cada uno.
4. **Consultas de validación:** completa la sección final de la plantilla. Comparan filas y totales entre origen y tabla por periodo.
5. **Job:** propón en la ficha el horario del SQL Server Agent (por ejemplo, cada hora en horario laboral) y el comando (`EXEC dbo.sp_Actualizar_Informe_<tema>;`). El desarrollador crea el job.
6. **Entrega al desarrollador**, en este orden:
   1. Ejecutar el script en un entorno de pruebas, si existe.
   2. Ejecutar la primera carga con `@CargaCompleta = 1`.
   3. Ejecutar las consultas de validación y pegar los resultados en la ficha.
   4. Crear el job.
7. Con los resultados, completa la sección 2 de la ficha y la entrada en `llm-wiki/log.md`.

## Estrategia incremental

- **Ventana móvil (por defecto).** Borra y recarga los últimos N días por la fecha de referencia. Es la opción más segura para documentos del ERP que se modifican o anulan después de creados. Elige N con el desarrollador según cuánto tiempo puede cambiar un documento (por ejemplo 45 días).
- **Marca de modificación.** Solo si el origen tiene una columna de última modificación confiable. Trae lo modificado desde la última carga registrada en la bitácora.
- En ambos casos, programa una **recarga completa periódica** (por ejemplo semanal, en la madrugada) para corregir filas borradas en el origen fuera de la ventana.

## Reglas

- Predicados **sargables**: `columna >= @FechaDesde`, nunca `YEAR(columna) = …` en el `WHERE` del origen.
- Todo dentro de una transacción con `TRY/CATCH` y registro en la bitácora.
- Sin `SELECT *`: columnas explícitas.
- Sin credenciales, servidores ni datos de clientes en el script.
- La tabla `dbo.Bitacora_Cargas_Informes` de la plantilla es una **propuesta**: confirma con el desarrollador si ya existe una bitácora o un nombre preferido antes de crearla.
