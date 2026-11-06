---
status: en-migracion
fase: 1
updated: 2026-11-05
sources:
  - ../../bi-origen/bi-ns-plantas/
  - ../../bi-origen/bi-ns-plantas/BI NS plantas.SemanticModel/definition/tables/Ordenes de Fabricacion.tmdl
  - ../../bi-origen/bi-ns-plantas/BI NS plantas.SemanticModel/definition/tables/Medidas.tmdl
  - ../../bi-origen/bi-ns-plantas/BI NS plantas.Report/definition/pages/
---

# BI: NS Plantas

Nivel de servicio de las plantas: qué porcentaje de las órdenes de fabricación (OP) liberadas se cierra a tiempo. La fecha a tiempo se calcula con la fecha de liberación más el amortiguador de la familia, en días hábiles.

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `BI NS plantas` ([proyecto .pbip](../../bi-origen/bi-ns-plantas/BI%20NS%20plantas.pbip)) |
| Dueño de negocio (valida las cifras) | Manufactura |
| Desarrollador responsable | Milton Rendón |
| Usuarios y frecuencia de uso | `hector.chinchilla@firplak.com`; frecuencia `pendiente` |
| Prioridad | Media |
| Rama | `bi/ns-plantas` |

## 1. Análisis

Analizado el 2026-11-05 a partir del proyecto [`BI NS plantas.pbip`](../../bi-origen/bi-ns-plantas/BI%20NS%20plantas.pbip). El modelo está en [`definition/tables/`](../../bi-origen/bi-ns-plantas/BI%20NS%20plantas.SemanticModel/definition/tables/) y las visuales en [`definition/pages/`](../../bi-origen/bi-ns-plantas/BI%20NS%20plantas.Report/definition/pages/). Todavía no se validó con datos: ver las [consultas de validación](#consultas-de-validación-para-el-desarrollador).

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen | Observaciones |
|---|---|---|---|
| `Ordenes de Fabricacion` | `Sql.Database` (import) | Servidor `Itplakinfo`, base `Firplak_SA` (SAP Business One): `OWOR`, `OITM`, `ORDR`, `@FIR_FAM_SYMPH`, `@FIR_AMORTIGUADORES`, `@FIR_FECHAS_PROD` | Tabla de hechos: una fila por OP (confirmado: 27 908 filas y 27 908 OP, sin duplicados). Ventana móvil: OP **creadas en el último año**. |
| `Amortiguador` | `Sql.Database` (import) | `Itplakinfo` / `FIRPLAK_SA`: `dbo.@FIR_AMORTIGUADORES` | Catálogo `Code`, `Name` (familia), `U_Amortiguador` (días). Ninguna visual la usa directamente; solo se relaciona por familia. |
| `CalendarioOF` | Tabla calculada DAX | `CALENDAR(min, max de 'Fecha ideal Entrega')` | Calendario del indicador. Todos los filtros de periodo van contra la **fecha ideal de entrega**. |
| `Medidas` | Tabla vacía | — | Solo contiene las medidas. |

No hay fuentes que no sean SQL Server (ni Excel ni SharePoint).

<details><summary>SQL original de <code>Ordenes de Fabricacion</code></summary>

```sql
SELECT 
    T0.CreateDate 'Fecha de Creación',
    T0.DocNum '# Documento',
    T0.ItemCode 'Cod Artículo',
    T0.ProdName 'Artículo',
    CONVERT(NUMERIC(18,0), T0.PlannedQty) 'Cantidad Planeada',
    T0.U_Tipo_Orden 'Tipo Orden',
    T0.RlsDate 'Fecha Real de Liberación',
    T0.CloseDate 'Fecha de Cierre Real',
    T3.U_FIR_FAM 'Familia Producción',
    CASE
        When T0.Status = 'R' then 'Liberado'
        When T0.Status = 'P' then 'Planificado'
        When T0.Status = 'L' then 'Cerrado'
    END 'Estado Orden',
    T0.U_U_Razonderetraso 'Razón de Retrazo',
    T0.U_U_Razonderetraso2 'Razón de Retrazo 2',
    convert(numeric(2,0), T4.U_Amortiguador) 'Amortiguador',
    CASE 
        WHEN T4.U_Amortiguador = 1 THEN T0.RlsDate
        ELSE 
            DATEADD(DAY, 
                (
                    SELECT TOP 1 numeros.n
                    FROM (
                        SELECT n, 
                               n + 1 - 
                               (SELECT COUNT(1) 
                                FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD] fp 
                                WHERE fp.U_Fecha BETWEEN DATEADD(DAY, 1, T0.RlsDate) 
                                    AND DATEADD(DAY, n, T0.RlsDate)
                                    -- Agregamos filtro de fecha máxima para optimizar
                                    AND fp.U_Fecha <= DATEADD(DAY, T4.U_Amortiguador * 3, T0.RlsDate)
                               ) as dias_habiles
                        FROM (
                            -- Reducimos a un máximo de días más realista
                            SELECT TOP 30 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                            FROM (VALUES (1),(1),(1),(1),(1)) t1(n)
                            CROSS JOIN (VALUES (1),(1),(1),(1),(1),(1)) t2(n)
                        ) AS nums
                        -- Agregamos filtro para reducir el conjunto de datos
                        WHERE n <= T4.U_Amortiguador * 3
                    ) AS numeros
                    WHERE numeros.dias_habiles = T4.U_Amortiguador
                    ORDER BY numeros.n
                ), 
                T0.RlsDate
            )
    END as 'Fecha ideal Entrega',
    t2.U_TipoPedidos
FROM 
    OWOR t0 
    INNER JOIN oitm t1 ON t0.ItemCode = t1.ItemCode 
    INNER JOIN [Firplak_SA].[dbo].[ORDR] T2 ON T0.OriginNum = T2.DocNum
    INNER JOIN [Firplak_SA].[dbo].[@FIR_FAM_SYMPH] T3 ON t1.U_Familia = t3.U_FIR_FAM_MAES 
        AND t3.U_FIR_TIPO_PED = T2.U_TipoPedidos
    INNER JOIN [Firplak_SA].[dbo].[@FIR_AMORTIGUADORES] T4 ON t3.U_FIR_FAM = T4.Name
    Collate SQL_Latin1_General_CP1_CI_AS
WHERE 
    T0.CreateDate >= DATEADD(YEAR, -1, GETDATE())
    AND T0.RlsDate is not null
    AND T0.Status not in ('C','P')
    AND T0.U_NumLote <> ''
    AND T0.Warehouse in ('PT-01','PT-02','PT-08')
ORDER BY
    T0.DocNum DESC;
```

```sql
-- Amortiguador
select * from [dbo].[@FIR_AMORTIGUADORES]
```

</details>

#### Qué órdenes entran (filtros del SQL)

- OP de `OWOR` **creadas en los últimos 12 meses** (`CreateDate >= hoy − 1 año`, ventana móvil).
- Ya liberadas (`RlsDate` con valor) y con estado `R` (Liberado) o `L` (Cerrado). Se excluyen `C` (cancelada) y `P` (planificada). Por eso el valor `Planificado` del `CASE` nunca aparece.
- Con lote (`U_NumLote <> ''`) y de las bodegas `PT-01`, `PT-02` y `PT-08`.
- Solo las OP que vienen de un pedido de venta (`INNER JOIN ORDR` por `OriginNum = DocNum`) y cuya familia tiene equivalencia en `@FIR_FAM_SYMPH` (por familia del artículo y tipo de pedido) y amortiguador en `@FIR_AMORTIGUADORES`. Las OP que no cumplan alguna de esas uniones quedan fuera **sin aviso**.

#### Fecha ideal de entrega (regla central)

- Si el amortiguador de la familia es 1: la fecha ideal es la misma fecha de liberación.
- Si es N > 1: la fecha de liberación más N − 1 días hábiles. El día de liberación cuenta como el día 1 y los días que están en `@FIR_FECHAS_PROD` no cuentan. Confirmado que esa tabla guarda días **no** laborables: casi todas sus fechas son sábados y domingos, y el resto, en su mayoría lunes (festivos). No tiene fechas repetidas y llega hasta el 2028-01-01 (consulta 8).
- La búsqueda llega como máximo a `min(30, 3 × N)` días calendario. Si no encuentra la fecha, queda en `NULL` y esa OP no aparece en ningún periodo del calendario (consulta 1).

### Transformaciones (Power Query M y columnas calculadas)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|
| `Ordenes de Fabricacion` | `Tipo cambiado` (M) | Convierte las fechas de creación, liberación y cierre a `date` y `# Documento` a texto. | Sí: guardar fechas como `date`. |
| `Ordenes de Fabricacion` | Columna `Semana` (DAX) | `WEEKDAY(Fecha de Cierre Real)`: día de la semana del cierre, de domingo = 1 a sábado = 7. | Sí, como parte de la regla siguiente. |
| `Ordenes de Fabricacion` | Columna `Fecha de Cierre Real 2` (DAX) | Si el cierre fue un **sábado**, lo corre al viernes anterior. Si no, deja la fecha igual. | Sí (`FechaCierreAjustada`). |
| `Ordenes de Fabricacion` | Columna `Cumplio` (DAX) | Clasifica la OP según su cierre ajustado: ver abajo. | No: depende de `TODAY()`. Se calcula en la consulta de la API. |
| `Ordenes de Fabricacion` | Columna `Familia Producción (grupos)` (agrupación DAX) | `FV`, `FVH`, `FVHM`, `FVHMP`, `FVHMPM` y `FVM` → `FIBRA`; `PA`, `PAM`, `PC` y `PCM` → `MARMOL`; `MBL`, `MBLM` y `PTTM` → `MUEBLE`; `RTM` y `RTMM` → `RTM`; vacío → `(En blanco)`; cualquier otra familia conserva su código. | Sí (`GrupoFamilia`). |
| `CalendarioOF` | Columnas `Año`, `Mes`, `Dia`, `Semana`, `Dia Semana`, `FIN DE SEMANA` | Atributos de la fecha ideal. `Semana` = `WEEKNUM` (semanas de domingo a sábado). | En la API como filtros. Solo se usa `Semana`; las demás no las usa ninguna visual. |

Regla de la columna `Cumplio`, en orden:

1. Cierre ajustado **posterior** a la fecha ideal → `INCUMPLIÓ`.
2. Sin cierre y fecha ideal **anterior a hoy** → `INCUMPLIÓ`.
3. Sin cierre y fecha ideal **hoy o después** → vacío (en curso).
4. En cualquier otro caso (cerrada en o antes de la fecha ideal) → `CUMPLIÓ`.

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `Ordenes de Fabricacion[Fecha ideal Entrega]` | `CalendarioOF[Fecha]` | Varios a uno | Única (calendario → OP) |
| `Ordenes de Fabricacion[Familia Producción]` | `Amortiguador[Familia]` | Varios a uno | Única |

El resto son tablas de fecha automáticas de Power BI (`LocalDateTable_*`) y no se migran.

### Indicadores (medidas DAX)

| Indicador | Regla de negocio | DAX original | Vivirá en |
|---|---|---|---|
| `TOTAL OP` | Número de OP del periodo (por fecha ideal). Incluye las que están en curso. | `COUNT('Ordenes de Fabricacion'[# Documento])` | summary de la API |
| `TOTAL CUMPLIÓ` | OP cerradas en o antes de su fecha ideal. 0 si no hay. | `IF(ISBLANK(CALCULATE(COUNT([Cumplio]), [Cumplio]="CUMPLIÓ")), 0, CALCULATE(COUNT([Cumplio]), [Cumplio]="CUMPLIÓ"))` | summary de la API |
| `TOTAL INCUMPLIO` | `TOTAL OP − TOTAL CUMPLIÓ`. **Ojo:** cuenta como incumplidas también las OP en curso (pregunta 3). | `[TOTAL OP] - [TOTAL CUMPLIÓ]` | summary de la API |
| `% CUMPLIMIENTO` (tarjeta "NIVEL DE SERVICIO") | OP cumplidas ÷ total de OP, contando **solo** las OP con fecha ideal anterior a hoy. Así las OP en curso no bajan el porcentaje. | `CALCULATE(DIVIDE([TOTAL CUMPLIÓ],[TOTAL OP]), 'Ordenes de Fabricacion'[Fecha ideal Entrega] < TODAY())` | summary de la API |

Medidas sin uso en visuales (no migrar, confirmar):

- `Objetivo IFI MS` = 0,9 (meta del 90 %). No la usa ninguna visual. Pregunta 5: ¿se quiere mostrar la meta?
- `Fecha Actual` = `TODAY()`.

### Visuales y filtros

Las tres páginas son de 1280 × 720 y llevan el logo de Firplak.

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|
| **NS PLantas** (principal) | Tarjeta "NIVEL DE SERVICIO" | `% CUMPLIMIENTO` | — |
| | Líneas | `% CUMPLIMIENTO` | Día de la fecha ideal |
| | Matriz | `TOTAL CUMPLIÓ`, `TOTAL INCUMPLIO`, `TOTAL OP`, `% CUMPLIMIENTO` | Año → mes → día de la fecha ideal. Oculta las filas sin OP. |
| | Columnas | `% CUMPLIMIENTO` | Mes de la fecha ideal |
| **NS Ordenes** | Tabla de detalle, filtrada a `Cumplio = INCUMPLIÓ` | — | `# Documento`, `Cod Artículo`, `Artículo`, `Familia Producción`, fechas de creación, liberación, cierre real e ideal, `Razón de Retrazo`, `Razón de Retrazo 2`, `Tipo Orden`, `Amortiguador`, `Cumplio` |
| **Duplicado de NS PLantas** (visible) | Tarjeta, líneas y columnas iguales a la principal | `% CUMPLIMIENTO` | Igual que la principal |
| | Barras "razón de retraso" | `TOTAL INCUMPLIO` | `Razón de Retrazo`, sin vacíos. Reemplaza a la matriz. |

Filtros y segmentadores (todos en lista desplegable, salvo el de fecha):

| Filtro | Columna de origen | Páginas | Valores reales (confirmados) |
|---|---|---|---|
| Familia | `Familia Producción (grupos)` | Las tres | `FIBRA`, `MARMOL`, `MUEBLE`, `RTM` y cuatro familias sin grupo: `ESPGAB`, `MBL CEFI`, `MBLP` y `PFZ-CEMA` (consulta 3, 2026-11-05). `PTTM` está en la agrupación, pero no tiene OP en el último año. |
| Rango de fechas | `CalendarioOF[Fecha]` (fecha ideal) | NS PLantas, NS Ordenes | Fecha relativa: **última semana, incluido hoy**, por defecto. Sincronizado entre páginas. |
| Semana | `CalendarioOF[Semana]` (`WEEKNUM`) | Las tres | — |
| Mes | Mes de la fecha ideal | Las tres | — |
| Día | Día de la fecha ideal | Las tres | — |
| Año | Año de la fecha ideal | NS PLantas, Duplicado | — |

Interacciones que cambian lo que muestran las visuales:

- En las dos páginas de resumen, la gráfica **mensual** no responde a los filtros de mes, día y semana, ni a la matriz o a las barras. Así sigue mostrando la tendencia de todos los meses. Sí responde a la familia, al año y, en la página principal, al rango de fechas.
- En la página principal, la gráfica de líneas por día no responde al filtro de día.

### Seguridad (RLS)

- ¿Tiene roles? No: no hay `role` en el modelo.
- El acceso en el portal se controlará con los permisos por informe de `/admin/permisos` (usuario inicial: `hector.chinchilla@firplak.com`).

### Riesgos y preguntas para el dueño de negocio

Riesgos técnicos:

- **La historia se pierde.** El BI solo carga OP creadas en los últimos 12 meses y recalcula todo en cada actualización. Además, los meses del borde quedan incompletos: una OP creada hace 13 meses con fecha ideal hace 11 ya no cuenta.
- **El pasado puede cambiar.** Si se modifican los amortiguadores, `@FIR_FAM_SYMPH` o los días no laborables, cambian las fechas ideales, y con ellas el % de meses cerrados.
- **OP que quedan fuera sin aviso** por las uniones `INNER JOIN` (sin pedido, sin familia o sin amortiguador) o porque no tienen fecha ideal (hoy no hay ninguna sin fecha ideal, consulta 1).
- **Días no laborables con fecha de vencimiento.** `@FIR_FECHAS_PROD` está cargada hasta el 2028-01-01. Después de esa fecha, la fórmula contaría los fines de semana y festivos como días hábiles. Hay que saber quién la mantiene (pregunta 1).
- **Meses del borde incompletos.** Noviembre de 2025 tiene 1 036 OP, frente a unas 2 100 a 2 900 en los demás meses, porque la ventana de 12 meses corta las OP creadas antes del 2025-11-06. Su 56 % no es comparable.
- **Pocas razones de retraso.** Solo 456 OP tienen `Razón de Retrazo`, frente a 7 170 incumplidas en el año. La gráfica de razones explica una parte pequeña de los incumplimientos.
- **Cálculo pesado.** La fecha ideal se obtiene con una subconsulta por fila. En la fase 2 conviene calcularla en el SP con una tabla de días hábiles.

Preguntas para Manufactura:

1. **Fecha ideal.** ¿Es correcto que la meta sea la fecha de liberación más el amortiguador de la familia menos 1, en días hábiles (el día de liberación cuenta como día 1)? ¿Quién mantiene los amortiguadores y el calendario de días no laborables (`@FIR_FECHAS_PROD`, cargado hasta el 2028-01-01)?
2. **Cierres del sábado.** ¿Por qué un cierre en sábado cuenta como del viernes? ¿Aplica también a los domingos o a los festivos?
3. **OP en curso.** `TOTAL INCUMPLIO` cuenta las OP que todavía no vencen, pero el % no. ¿En el portal se muestran aparte como "en curso"?
4. **Ventana de 12 meses.** ¿Quieren conservar la historia completa (recomendado) o solo el último año?
5. **Meta.** El modelo tiene un objetivo del 90 % (`Objetivo IFI MS`) que no se muestra. ¿Se agrega como línea de meta?
6. **Páginas.** ¿La página "Duplicado de NS PLantas" se usa? Propuesta: una sola vista con la tarjeta, la tendencia diaria y mensual, la matriz, las barras por razón de retraso y el detalle de incumplidas.
7. **Filtro por defecto.** La página principal abre filtrada a la última semana, y eso también recorta la gráfica mensual. ¿El portal debe abrir en la semana actual o en el mes actual?
8. **Familias sin grupo.** Las familias que no están en la agrupación se muestran con su propio código. Hoy son `ESPGAB` (181 OP), `MBL CEFI` (1 048), `MBLP` (768) y `PFZ-CEMA` (446). ¿Hay que agregar alguna a `FIBRA`, `MARMOL`, `MUEBLE` o `RTM` (por ejemplo, `MBL CEFI` y `MBLP` a `MUEBLE`)?
9. **Alcance.** ¿Las bodegas `PT-01`, `PT-02` y `PT-08`, y solo OP ligadas a un pedido de venta, son el alcance correcto? Hoy entran 8 338 OP de tipo `STOCK` (todas ligadas a un pedido), además de las `STANDARD`, y una OP sin tipo de orden. ¿Las OP de stock sin pedido no cuentan?
10. **Frecuencia.** ¿Cada cuánto se consulta el informe y con qué frescura deben estar los datos (diaria, cada hora)?
11. **Razones de retraso.** Solo el 6 % de las OP incumplidas tiene razón registrada (456 de 7 170). ¿Quién la registra y es obligatoria? ¿La gráfica de razones sigue siendo útil así?

**Validación del dueño de negocio:** nombre — fecha — `pendiente`

### Consultas de validación para el desarrollador

Se ejecutan en `Itplakinfo`, solo lectura. El script completo, listo para ejecutar, está en [`sql/validacion-fase1.sql`](../../bi-origen/bi-ns-plantas/sql/validacion-fase1.sql). Su paso 0 carga el SQL original (sin el `ORDER BY`) en la tabla temporal de sesión `#ns`, que las consultas necesitan. Ejecútalo entero en una misma ventana y pega aquí los resultados. Lo que no tenga nombres de personas se puede pegar completo. Las consultas son estas:

```sql
-- 1. Volumen, rango de fechas y OP sin fecha ideal
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT [# Documento]) AS ops,
       SUM(CASE WHEN [Fecha ideal Entrega] IS NULL THEN 1 ELSE 0 END) AS sin_fecha_ideal,
       MIN([Fecha de Creación]) AS creacion_min, MAX([Fecha de Creación]) AS creacion_max,
       MIN([Fecha ideal Entrega]) AS ideal_min, MAX([Fecha ideal Entrega]) AS ideal_max
FROM #ns;

-- 2. ¿Hay OP repetidas por las uniones?
SELECT TOP 20 [# Documento], COUNT(*) AS veces
FROM #ns GROUP BY [# Documento] HAVING COUNT(*) > 1 ORDER BY veces DESC;

-- 3. Familias y amortiguadores reales
SELECT [Familia Producción], [Amortiguador], COUNT(*) AS ops
FROM #ns GROUP BY [Familia Producción], [Amortiguador] ORDER BY [Familia Producción];

-- 4. Tipo de orden, tipo de pedido y estado
SELECT [Tipo Orden], U_TipoPedidos, [Estado Orden], COUNT(*) AS ops
FROM #ns GROUP BY [Tipo Orden], U_TipoPedidos, [Estado Orden] ORDER BY ops DESC;

-- 5. Razones de retraso
SELECT [Razón de Retrazo], COUNT(*) AS ops
FROM #ns GROUP BY [Razón de Retrazo] ORDER BY ops DESC;

-- 6. Nivel de servicio por mes, replicando el DAX (base para conciliar con Power BI)
WITH c AS (
    SELECT *,
           CASE WHEN DATEDIFF(DAY, '19000106', [Fecha de Cierre Real]) % 7 = 0  -- sábado
                THEN DATEADD(DAY, -1, [Fecha de Cierre Real]) ELSE [Fecha de Cierre Real] END AS cierre2
    FROM #ns
), e AS (
    SELECT *,
           CASE WHEN cierre2 > [Fecha ideal Entrega] THEN 'INCUMPLIÓ'
                WHEN cierre2 IS NULL AND [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 'INCUMPLIÓ'
                WHEN cierre2 IS NULL THEN ''
                ELSE 'CUMPLIÓ' END AS cumplio
    FROM c
    WHERE [Fecha ideal Entrega] IS NOT NULL
)
SELECT YEAR([Fecha ideal Entrega]) AS anio, MONTH([Fecha ideal Entrega]) AS mes,
       COUNT(*) AS total_op,
       SUM(CASE WHEN cumplio = 'CUMPLIÓ' THEN 1 ELSE 0 END) AS cumplio,
       SUM(CASE WHEN cumplio = 'INCUMPLIÓ' THEN 1 ELSE 0 END) AS incumplio,
       SUM(CASE WHEN cumplio = '' THEN 1 ELSE 0 END) AS en_curso,
       CAST(SUM(CASE WHEN cumplio = 'CUMPLIÓ' AND [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 1.0 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN [Fecha ideal Entrega] < CAST(GETDATE() AS date) THEN 1 ELSE 0 END), 0) AS decimal(9,4)) AS pct_cumplimiento
FROM e
GROUP BY YEAR([Fecha ideal Entrega]), MONTH([Fecha ideal Entrega])
ORDER BY anio, mes;

-- 7. ¿@FIR_FECHAS_PROD guarda días no laborables? (día de la semana de cada fecha del último año)
SELECT DATENAME(WEEKDAY, U_Fecha) AS dia_semana, COUNT(*) AS fechas
FROM [Firplak_SA].[dbo].[@FIR_FECHAS_PROD]
WHERE U_Fecha >= DATEADD(YEAR, -1, GETDATE())
GROUP BY DATENAME(WEEKDAY, U_Fecha) ORDER BY fechas DESC;
```

La consulta 8 (fechas repetidas en `@FIR_FECHAS_PROD`) y la limpieza opcional de `#ns` están solo en el script.

#### Resultados (ejecutadas por el desarrollador el 2026-11-05)

1. **Volumen:** 27 908 filas y 27 908 OP. Ninguna sin fecha ideal. Creación entre el 2025-11-06 y el 2026-11-05; fecha ideal entre el 2025-11-07 y el 2026-11-17.
2. **Duplicados:** ninguno. La clave `DocNum` sirve como clave de la tabla.
3. **Familias y amortiguadores:** 18 familias, cada una con un solo amortiguador.

   | Familia | Amortiguador | OP | | Familia | Amortiguador | OP |
   |---|---|---|---|---|---|---|
   | `ESPGAB` | 13 | 181 | | `MBLP` | 1 | 768 |
   | `FV` | 4 | 661 | | `PA` | 4 | 2 180 |
   | `FVH` | 4 | 1 186 | | `PAM` | 2 | 15 |
   | `FVHM` | 3 | 40 | | `PC` | 4 | 9 380 |
   | `FVHMP` | 7 | 263 | | `PCM` | 2 | 245 |
   | `FVHMPM` | 6 | 4 | | `PFZ-CEMA` | 5 | 446 |
   | `FVM` | 2 | 66 | | `RTM` | 3 | 372 |
   | `MBL` | 5 | 10 540 | | `RTMM` | 2 | 56 |
   | `MBL CEFI` | 5 | 1 048 | | `MBLM` | 3 | 457 |

4. **Tipo y estado:** `Tipo Orden` = `STANDARD` o `STOCK`, más una OP con `NULL`. `U_TipoPedidos` va de 1 a 15. Estado: 27 525 `Cerrado` y 383 `Liberado`, ninguna `Planificado`.
5. **Razones de retraso:** 27 452 sin razón. Con razón: `BAJA PRODUCTIVIDAD` 336, `CONCENTRACION DE MOLDES` 56, `AVERÍA EQUIPO` 43, `ERROR ABASTECIMIENTO` 12, `PROBLEMAS CALIDAD PROCESO` 7 y `MOLDE AVERIADO` 2.
6. **Nivel de servicio por mes** (fecha ideal; % solo con fecha ideal anterior al 2026-11-05). Es la base para la conciliación de la fase 6:

   | Mes | OP | Cumplió | Incumplió | En curso | % cumplimiento |
   |---|---|---|---|---|---|
   | 2025-11 (incompleto) | 1 036 | 583 | 453 | 0 | 56,27 % |
   | 2025-12 | 2 573 | 1 422 | 1 151 | 0 | 55,27 % |
   | 2026-01 | 2 245 | 1 520 | 725 | 0 | 67,71 % |
   | 2026-02 | 2 559 | 1 887 | 672 | 0 | 73,74 % |
   | 2026-03 | 2 384 | 1 974 | 410 | 0 | 82,80 % |
   | 2026-04 | 2 456 | 1 871 | 585 | 0 | 76,18 % |
   | 2026-05 | 2 142 | 1 654 | 488 | 0 | 77,22 % |
   | 2026-06 | 2 186 | 1 589 | 597 | 0 | 72,69 % |
   | 2026-07 | 2 856 | 2 325 | 531 | 0 | 81,41 % |
   | 2026-08 | 2 121 | 1 672 | 449 | 0 | 78,83 % |
   | 2026-09 | 2 229 | 1 570 | 659 | 0 | 70,44 % |
   | 2026-10 | 2 479 | 2 058 | 421 | 0 | 83,02 % |
   | 2026-11 (en curso) | 642 | 250 | 29 | 363 | 84,15 % |

   Todos los meses están por debajo de la meta del 90 % del modelo (`Objetivo IFI MS`).
7. **`@FIR_FECHAS_PROD`** (fechas desde hace un año, sin tope futuro): sábado 113, domingo 112, lunes 25, viernes 8, jueves 6, martes 2 y miércoles 2. Confirma que guarda días **no** laborables. Pero 113 sábados y 112 domingos son más del doble de los 52 de un año. Puede ser porque la tabla ya trae fechas futuras o porque tiene fechas repetidas. Si hubiera fechas repetidas, la fórmula las contaría dos veces y la fecha ideal quedaría más tarde.
8. **Fechas repetidas en `@FIR_FECHAS_PROD`:** no hay. Son 268 filas y 268 fechas distintas entre el 2025-11-08 y el 2028-01-01. Los sábados y domingos de más de la consulta 7 son fechas futuras ya cargadas (hasta enero de 2028), no duplicados. La tabla tiene `Code`, `Name` y `U_Fecha`, sin columna de planta, así que los días no laborables son los mismos para todas las plantas.

## 2. Tabla de reporte y carga incremental

Propuesta para revisar en la fase 2 (`pendiente` aprobación; el script todavía no existe):

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_ns_plantas` (nombre `pendiente`) |
| Grano (una fila por…) | OP (`DocNum`) |
| Clave | `DocNum` (validar unicidad, consulta 2) |
| Columnas | `DocNum`, `FechaCreacion`, `CodArticulo`, `Articulo`, `CantidadPlaneada`, `TipoOrden`, `TipoPedido`, `Estado`, `FechaLiberacion`, `FechaCierre`, `FechaCierreAjustada`, `Familia`, `GrupoFamilia`, `Amortiguador`, `FechaIdealEntrega`, `RazonRetraso`, `RazonRetraso2`, `FechaCarga` |
| Fecha de referencia (filtros por periodo) | `FechaIdealEntrega` |
| Estrategia incremental | `pendiente`: `MERGE` sobre las OP abiertas o modificadas recientemente (`UpdateDate` de `OWOR`), sin borrar la historia |
| Cálculo de cumplimiento | En la consulta de la API, porque depende de la fecha de hoy |
| SP | `dbo.sp_Actualizar_Informe_ns_plantas` (nombre `pendiente`) |
| Job y horario | `pendiente` (pregunta 10) |
| Índices | `pendiente` (por `FechaIdealEntrega` y `GrupoFamilia`) |

Validación de totales (origen vs. tabla):

| Periodo | Filas origen | Filas tabla | Total origen | Total tabla |
|---|---|---|---|---|

## 3. Contrato del endpoint

`pendiente`.

**Aprobación del contrato:** nombre — fecha — `pendiente`

## 4. Endpoint

`pendiente`.

## 5. Dashboard

`pendiente`.

## 6. Conciliación con Power BI

`pendiente`.

**Firma del dueño de negocio:** nombre — fecha — `pendiente`

## 7. Despliegue y retiro

`pendiente`.
