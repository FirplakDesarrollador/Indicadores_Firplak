---
status: en-migracion
fase: 5
updated: 2026-11-18
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

- **La historia se pierde.** El BI solo carga OP creadas en los últimos 12 meses y recalcula todo en cada actualización. Además, los meses del borde quedan incompletos: una OP creada hace 13 meses con fecha ideal hace 11 ya no cuenta. Resuelto en la migración: se carga toda la historia (respuesta 4).
- **El pasado puede cambiar.** Si se modifican los amortiguadores, `@FIR_FAM_SYMPH` o los días no laborables, cambian las fechas ideales, y con ellas el % de meses cerrados.
- **OP que quedan fuera sin aviso** por las uniones `INNER JOIN` (sin pedido, sin familia o sin amortiguador) o porque no tienen fecha ideal (hoy no hay ninguna sin fecha ideal, consulta 1).
- **Días no laborables con fecha de vencimiento.** `@FIR_FECHAS_PROD` está cargada hasta el 2028-01-01. Después de esa fecha, la fórmula contaría los fines de semana y festivos como días hábiles. Resuelto en la migración: se usa un calendario de Colombia generado por fórmula, que no vence (decisión del 2026-11-18).
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

#### Respuestas de Manufactura (recibidas el 2026-11-17)

| # | Tema | Respuesta | Qué cambia en la migración |
|---|---|---|---|
| 1 | Fecha ideal | El cálculo es correcto. Los amortiguadores son fijos y están en el semáforo de producción. | Se conserva la regla. Calendario decidido el 2026-11-18: los días no laborables salen del calendario de Colombia (sábados, domingos y festivos de ley), no de `@FIR_FECHAS_PROD`. Ver la fila "Calendario laboral" de la sección 2. |
| 2 | Cierres del sábado | El sábado es una jornada reducida, sin liberación y sin toda la empresa trabajando, así que un cierre en sábado cuenta como del viernes. Domingos y festivos no se calculan porque no se trabaja. | Se conserva la regla sábado → viernes. |
| 3 | OP en curso | "En curso es una orden que no se ha cerrado, por lo tanto se debe contar como abierta en el cálculo de nivel de servicio." | Aclarado el 2026-11-18: ver la nota debajo de esta tabla. Se conserva la regla del BI. |
| 4 | Historia | Todo el historial de órdenes de fabricación de SAP. | La tabla carga toda la historia, sin la ventana de 12 meses. |
| 5 | Meta | Sí: línea de meta del 90 %, por planta y para todo Firplak. | La meta se muestra en el dashboard, en la vista general y en cada planta. |
| 6 | Páginas | Eliminar la página "Duplicado de NS PLantas"; no se usa. | No se migra. La gráfica de razones de retraso sí se conserva (respuesta 11). |
| 7 | Filtro por defecto | El mes en curso, solo el mes. | El dashboard abre en el mes actual. |
| 8 | Familias | Usar las familias completas: `ESPGAB`, `FIBRA`, `MARMOL`, `MBL CEFI`, `MBLP`, `MUEBLE`, `PFZ-CEMA`, `RTM`. | Se conserva la agrupación actual: 4 grupos y 4 familias con su propio código, 8 valores en total. Es la dimensión "planta" de la meta (respuesta 5). Manufactura escribió "ESPAGB"; el código en SAP es `ESPGAB`. |
| 9 | Alcance | Toda orden debe tener pedido; si no lo tiene, no se incluye. | Se conservan el `INNER JOIN` con `ORDR` y los demás filtros (bodegas `PT-01`, `PT-02` y `PT-08`, con lote, estados `R` y `L`). |
| 10 | Frecuencia | Se consulta 2 o 3 veces al día; actualizar a las 6:00 y a las 17:00. | Job a las 6:00 y a las 17:00. |
| 11 | Razones de retraso | Es obligatoria, pero registrarla en SAP es tedioso y no se hace. Graficarla aunque falten datos; más adelante se buscará una forma más práctica. | Se conserva la gráfica. Aclarado el 2026-11-18: se agrega una barra **"Sin razón de atraso"** para las OP incumplidas que no tienen razón registrada. |

**Nota sobre la pregunta 3 (aclarada el 2026-11-18).** Respuesta de Manufactura: "el nivel de servicio solo se mide el día de plazo; si se cumple antes no es necesario medir; si se cumple por fuera del plazo, no hay cumplimiento". Es la regla que usa el BI hoy:

- Una OP entra al % solo cuando su fecha ideal ya pasó (`FechaIdealEntrega < hoy`). Las OP con plazo vigente no cuentan, aunque ya estén cerradas; se muestran aparte como "en curso".
- Al llegar el plazo, cumple si se cerró en o antes de la fecha ideal (con la regla sábado → viernes). Si se cerró después o sigue abierta, incumple.

Con noviembre de 2026 (consulta 6, al 2026-11-05) da **84,15 %**, igual que el BI. La lectura alternativa (contar todas las OP del mes, 38,9 %) queda descartada.

**Validación del dueño de negocio:** Manufactura — 2026-11-17 — validado. Aclaraciones de las preguntas 3 y 11 recibidas el 2026-11-18. Calendario laboral decidido el 2026-11-18 por el desarrollador: sábados, domingos y festivos de Colombia.

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

Diseño aprobado por el desarrollador el 2026-11-18. Scripts: [`sql/ns-plantas/01_informe_ns_plantas.sql`](../../sql/ns-plantas/01_informe_ns_plantas.sql) (calendario, tabla, SP y validación) y [`sql/ns-plantas/02_job_ns_plantas.sql`](../../sql/ns-plantas/02_job_ns_plantas.sql) (jobs). Ejecutados y validados el 2026-11-18.

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_ns_plantas` |
| Grano (una fila por…) | OP de `OWOR` que cumple los filtros del BI, sin la ventana de 12 meses |
| Clave | `DocEntry` (clave interna de SAP, única). `DocNum` se guarda para mostrar y filtrar. Confirmado: `DocEntry` y `DocNum` son únicos en las 268 658 OP de la historia (consulta previa 2). |
| Fecha de referencia (filtros por periodo) | `FechaIdealEntrega` |
| Estrategia incremental | Cada corrida recarga las OP que pueden cambiar: abiertas (`Status = 'R'`) o modificadas en los últimos 7 días (`OWOR.UpdateDate`). Se borran por `DocEntry` y se vuelven a insertar. Recarga completa semanal, el domingo en la madrugada, para recoger cambios de amortiguadores o del calendario. Confirmado: en las 268 262 OP cerradas `UpdateDate` es igual o posterior al cierre, así que los cierres entran en la corrida siguiente (consulta previa 4). Una razón registrada semanas después la recoge la carga completa del domingo. |
| Cálculo de cumplimiento | En la consulta de la API, porque depende de la fecha de hoy: el % cuenta solo las OP con `FechaIdealEntrega < hoy` (pregunta 3) |
| Calendario laboral | Tabla `Planos_Symphony.dbo.Calendario_Laboral` (`Fecha` PK, `EsLaborable`, `Motivo`), de 2013 a 2040. No laborables (decisión del desarrollador, 2026-11-18): **sábados, domingos y festivos de Colombia** generados por fórmula (Ley 51 de 1983: 6 fijos, 7 que se corren al lunes y 5 que dependen de la Pascua; sin fechas repetidas cuando dos festivos caen el mismo día, como el 2025-06-30), **más las fechas de `@FIR_FECHAS_PROD`** (días propios de Firplak, que se siguen cargando en SAP). El sábado no cuenta como día hábil, igual que en el BI. La fórmula se recalcula en cada carga completa, así que las fechas nuevas de SAP entran solas. |
| Fecha ideal | Se calcula en el SP con `dbo.Calendario_Laboral` por conjuntos (sin la subconsulta por fila del BI), con la misma regla: amortiguador 1 → la fecha de liberación; N > 1 → el día hábil N − 1 después de la liberación, si cae dentro de `min(30, 3 × N)` días; si no, `NULL`. Se compara con la consulta original antes de aprobar. |
| SP | `dbo.sp_Actualizar_Informe_ns_plantas` (`@CargaCompleta = 1` para la primera carga y la semanal; reconstruye el calendario con `dbo.sp_Actualizar_Calendario_Laboral`). Bloqueo con `sp_getapplock` para no correr dos cargas a la vez. Si las uniones con `ORDR`, `@FIR_FAM_SYMPH` o `@FIR_AMORTIGUADORES` llegan a repetir una OP, la carga falla con aviso en la bitácora y la tabla conserva los datos anteriores. |
| Bitácora | `dbo.Cargas_Log` (ya existe; ver [Flujo de datos](../architecture/data-flow.md)) |
| Job y horario | `BI - NS Plantas carga incremental`: lunes a sábado a las 6:00 y a las 17:00 (respuesta 10). `BI - NS Plantas carga completa`: domingo a las 2:00. |
| Índices | PK agrupada por `DocEntry`. `IX_..._FechaIdeal` por `FechaIdealEntrega` con `Planta`, `FechaCierreAjustada`, `Estado` y `RazonRetraso` incluidas, para el resumen y las gráficas por periodo. `IX_..._Planta` por (`Planta`, `FechaIdealEntrega`) con las mismas incluidas, para el filtro de planta. En el calendario, `IX_Calendario_Laboral_NumDiaHabil` para buscar la fecha ideal. |

Columnas propuestas:

| Columna | Tipo | Origen | Nota |
|---|---|---|---|
| `DocEntry` | `int` | `OWOR.DocEntry` | Clave |
| `DocNum` | `int` | `OWOR.DocNum` | `# Documento` |
| `FechaCreacion` | `date` | `OWOR.CreateDate` | |
| `CodArticulo` | `nvarchar(50)` | `OWOR.ItemCode` | |
| `Articulo` | `nvarchar(200)` | `OWOR.ProdName` | |
| `CantidadPlaneada` | `decimal(19,6)` | `OWOR.PlannedQty` | El BI la redondeaba a entero; aquí se guarda sin redondear. |
| `TipoOrden` | `nvarchar(30)` | `OWOR.U_Tipo_Orden` | `STANDARD`, `STOCK` o `NULL` |
| `TipoPedido` | `nvarchar(30)` | `ORDR.U_TipoPedidos` | |
| `Bodega` | `nvarchar(8)` | `OWOR.Warehouse` | Nueva: no estaba en el BI |
| `Estado` | `nvarchar(20)` | `OWOR.Status` | `Liberado` o `Cerrado` |
| `FechaLiberacion` | `date` | `OWOR.RlsDate` | |
| `FechaCierre` | `date` | `OWOR.CloseDate` | |
| `FechaCierreAjustada` | `date` | Regla del sábado | Cierre en sábado → viernes |
| `Familia` | `nvarchar(30)` | `@FIR_FAM_SYMPH.U_FIR_FAM` | |
| `Planta` | `nvarchar(30)` | Agrupación de la familia | 8 valores (respuesta 8) |
| `Amortiguador` | `smallint` | `@FIR_AMORTIGUADORES.U_Amortiguador` | Redondeado como en el BI (`numeric(2,0)`); la fecha ideal usa el valor sin redondear, como el BI |
| `FechaIdealEntrega` | `date` | Calculada | Fecha de referencia |
| `RazonRetraso` | `nvarchar(100)` | `OWOR.U_U_Razonderetraso` | Texto normalizado |
| `RazonRetraso2` | `nvarchar(100)` | `OWOR.U_U_Razonderetraso2` | Texto normalizado |
| `FechaCarga` | `datetime2(0)` | — | Auditoría |

**Diferencia con el BI por el calendario.** De 2025 a 2027 el calendario de la migración es igual al del BI (Colombia ∪ `@FIR_FECHAS_PROD`). Antes de 2025 el BI no tiene días no laborables, pero tampoco tiene esas OP (ventana de 12 meses). En la historia de 2013 a 2024 solo se descuentan sábados, domingos y festivos de ley: los días propios de Firplak de esos años (p. ej. 24 y 31 de diciembre) no están en SAP y cuentan como hábiles.

#### Resultados de las consultas previas (2026-11-18)

1. **Volumen:** 268 658 OP desde 2013 (la primera liberación es del 2013-08-12), una fila por OP. Entre 13 000 y 15 000 OP por año hasta 2020; de 2021 en adelante, entre 24 000 y 34 500 (34 453 en 2025; 24 269 en 2026 al 2026-11-18).
2. **Unicidad:** 268 658 filas, 268 658 `DocEntry` y 268 658 `DocNum` distintos.
3. **`@FIR_FECHAS_PROD` por año:** solo 2025 (123 fechas), 2026 (125), 2027 (122) y 2028 (1). Cada año completo trae sus 104 sábados y domingos. No hay datos antes de 2025.
4. **Estados y `UpdateDate`:** 396 OP abiertas (`R`) y 268 262 cerradas (`L`). Todas las cerradas tienen `UpdateDate` igual o posterior al cierre. Solo 4 576 OP (1,7 %), todas cerradas, tienen razón de retraso.
5. **SAP vs. calendario de Colombia:** ningún festivo de ley falta en SAP, lo que valida la fórmula. SAP tiene 9 días propios de Firplak: 2025-01-02, 2025-01-03, 2025-12-31, 2026-07-13, 2026-12-24, 2026-12-31, 2027-07-12, 2027-12-24 y 2027-12-31.

Consultas previas (solo lectura) en [`sql/validacion-fase2-previa.sql`](../../bi-origen/bi-ns-plantas/sql/validacion-fase2-previa.sql): volumen de la historia por año, unicidad de `DocNum`, cobertura de `@FIR_FECHAS_PROD` por año, comportamiento de `UpdateDate` y diferencias entre `@FIR_FECHAS_PROD` y el calendario de Colombia.

Validación (2026-11-18, ejecutada por el desarrollador; sección 5 de `01_informe_ns_plantas.sql`):

| # | Prueba | Resultado |
|---|---|---|
| 5.1 | Primera carga completa | OK: 268 658 OP insertadas en 13 s (11:34:08 a 11:34:21), incluido el calendario. Sin error. |
| 5.2 | Calendario por año | OK: fin de semana + festivos + hábiles = días del año en 2013 a 2040. 18 festivos por año (17 cuando dos caen el mismo lunes: 2014, 2019, 2030, 2038). Con los días de SAP: 2025 = 20, 2026 = 21, 2027 = 21. |
| 5.3 | OP por año | OK: igual a la consulta previa 1 en los 14 años. 0 OP sin fecha ideal. |
| 5.4 | Fecha ideal vs. SQL original del BI | OK: 27 737 OP en ambos, **0 con fecha ideal distinta**, 0 solo en el BI. 99 solo en la tabla, todas creadas el 2025-11-18: el BI corta los 12 meses por fecha y hora y deja fuera el día del límite. |
| 5.5 | Nivel de servicio de noviembre (OP vencidas al 2026-11-18) | Total 81,63 % (880 de 1 078). ESPGAB 86,67 %, FIBRA 62,89 %, MARMOL 88,58 %, MBL CEFI 58,33 %, MBLP 100 %, MUEBLE 76,73 %, PFZ-CEMA 100 %, RTM 57,14 %. Las 8 plantas de la respuesta 8, sin "(En blanco)". OK contra el BI: con el SQL del BI (`#ns`) y sus reglas DAX da 81,60 % (878 de 1 076), sin diferencias de cierre en ninguna OP vencida. El BI actualizado el 2026-11-18 muestra 81,60 %. La tabla tiene 2 OP más, cumplidas, del día del límite de 12 meses. Antes de actualizarlo, el BI mostraba 81,37 % (878 de 1 079) porque tenía datos de una actualización anterior. |
| 5.6 | Carga incremental | OK: 943 OP borradas y reinsertadas en menos de 1 s; el total sigue en 268 658. |

Jobs creados y habilitados el 2026-11-18 (`BI - NS Plantas carga incremental` con sus dos horarios y `BI - NS Plantas carga completa`). Corrida del job lanzada a mano el 2026-11-18 a las 11:52:42: 943 OP, sin error. El job tiene permisos para leer `Firplak_SA` y escribir en `Planos_Symphony`.

**Aprobación de la fase 2:** Milton Rendón — 2026-11-18 — script ejecutado, job corriendo y totales cuadrados con el BI.

## 3. Contrato del endpoint

Aprobado por el desarrollador el 2026-11-18, con las decisiones A a D.

`GET /api/v1/ns-plantas`. Usa el mismo token, el mismo manejo de errores (502 sin detalles internos) y la misma forma de respuesta que `/api/v1/facturacion-diaria`.

**Fuente.** `Planos_Symphony.dbo.Informe_ns_plantas`, con las variables nuevas `REPORT_NS_PLANTAS_TABLE_SCHEMA=dbo` y `REPORT_NS_PLANTAS_TABLE=Informe_ns_plantas`.

**"Hoy"** es `CAST(GETDATE() AS date)` del SQL Server, en hora de Colombia. El cumplimiento se calcula en SQL en cada consulta, con la regla del BI y la respuesta 3:

| `compliance` | Regla (en orden) | Cuenta en el % |
|---|---|---|
| `incumplio` | `FechaCierreAjustada > FechaIdealEntrega`, o sin cierre y `FechaIdealEntrega < hoy` | Sí, si `FechaIdealEntrega < hoy` |
| `enCurso` | Sin cierre y `FechaIdealEntrega >= hoy` | No |
| `cumplio` | Cerrada en o antes de la fecha ideal | Sí, si `FechaIdealEntrega < hoy` |

Una OP **medida** es la que tiene `FechaIdealEntrega < hoy`. Una OP cerrada antes de su fecha ideal es `cumplio`, pero no entra al % hasta que llega su plazo.

### Parámetros

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `page`, `pageSize` | entero | — | Paginación de `rows`, igual que en facturación |
| `anio`, `mes` | entero | `FechaIdealEntrega` | Periodo. El dashboard abre en el mes en curso (respuesta 7) |
| `fechaDesde`, `fechaHasta` | `AAAA-MM-DD` | `FechaIdealEntrega` | Rango opcional |
| `semana` | entero 1–54 | `FechaIdealEntrega` | Semana del año de domingo a sábado, como `WEEKNUM` del BI (llega a 54 en años bisiestos que empiezan en sábado, como 2028). Se calcula sin depender de `SET DATEFIRST` |
| `dia` | entero 1–31 | `FechaIdealEntrega` | Día del mes |
| `planta` | texto | `Planta` | Uno de los 8 valores (respuesta 8) |
| `cumplimiento` | `cumplio`, `incumplio` o `enCurso` | Calculada | **Solo filtra `rows`**, no el resumen ni las gráficas. El detalle abre en `incumplio`, como la página "NS Ordenes" |
| `search` | texto | `DocNum`, `CodArticulo`, `Articulo` | Búsqueda libre. Solo filtra `rows` |

Reglas de los filtros:

- Todos se aplican en SQL, con parámetros (`request.input`).
- `filterOptions` usa solo el periodo, para que la lista de plantas no se reduzca al elegir una.

### Respuesta

```json
{
  "rows": [
    {
      "id": 812345,
      "docNum": 1234567,
      "createdAt": "2026-11-03",
      "itemCode": "CODIGO-ARTICULO",
      "item": "Nombre del artículo",
      "plannedQty": 12,
      "orderType": "STANDARD",
      "orderSource": "Tipo de pedido",
      "warehouse": "PT-01",
      "status": "Cerrado",
      "releaseDate": "2026-11-04",
      "closeDate": "2026-11-08",
      "adjustedCloseDate": "2026-11-07",
      "family": "FVH",
      "plant": "FIBRA",
      "buffer": 3,
      "idealDate": "2026-11-06",
      "compliance": "incumplio",
      "delayReason": null,
      "delayReason2": null
    }
  ],
  "years": [2026, 2025],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 0 },
  "summary": {
    "serviceLevel": 0.816,
    "target": 0.9,
    "total": 0,
    "measured": 0,
    "onTime": 0,
    "late": 0,
    "inProgress": 0,
    "closedEarly": 0,
    "daily": [{ "date": "2026-11-03", "measured": 0, "onTime": 0, "serviceLevel": 0.0 }],
    "monthly": [{ "year": 2026, "month": 1, "measured": 0, "onTime": 0, "late": 0, "serviceLevel": 0.0 }],
    "plants": [{ "name": "FIBRA", "measured": 0, "onTime": 0, "late": 0, "serviceLevel": 0.0 }],
    "delayReasons": [{ "name": null, "late": 0 }]
  },
  "filterOptions": { "plants": [] },
  "source": "sql-server",
  "loadedAt": "2026-11-18T17:00:12.000Z",
  "updatedAt": "2026-11-18T17:05:00.000Z"
}
```

Los valores del ejemplo son ilustrativos; el endpoint solo devuelve datos reales.

Reglas de cada campo:

| Campo | Regla | Medida o visual del BI |
|---|---|---|
| `rows` | Una fila por OP con todos los filtros, incluidos `cumplimiento` y `search`. Orden: `idealDate` y `docNum` descendentes. Paginada. | Tabla de "NS Ordenes" |
| `summary.serviceLevel` | `onTime / measured`; `null` si `measured = 0` | `% CUMPLIMIENTO` (tarjeta "NIVEL DE SERVICIO") |
| `summary.target` | Constante `0.9` en la API | `Objetivo IFI MS` (respuesta 5) |
| `summary.total` | OP del filtro, medidas o no | `TOTAL OP` |
| `summary.measured` | OP con `FechaIdealEntrega < hoy` | Denominador del % |
| `summary.onTime` | OP medidas `cumplio` | `TOTAL CUMPLIÓ` (solo medidas) |
| `summary.late` | OP medidas `incumplio` (`measured - onTime`) | Reemplaza a `TOTAL INCUMPLIO` (ver decisión A) |
| `summary.inProgress` | OP `enCurso` | — |
| `summary.closedEarly` | OP cerradas a tiempo cuya fecha ideal aún no llega | — |
| `summary.daily` | Por fecha ideal del filtro, solo fechas anteriores a hoy: `measured`, `onTime`, `serviceLevel`. **No aplica el filtro `dia`** | Líneas "% CUMPLIMIENTO por Day" |
| `summary.monthly` | Por mes del año `anio` (o del año en curso): `measured`, `onTime`, `late`, `serviceLevel`. Aplica `planta`; **no aplica `mes`, `semana`, `dia` ni el rango de fechas** | Columnas "% CUMPLIMIENTO por Month" y matriz año → mes |
| `summary.plants` | Por planta, con todos los filtros: `measured`, `onTime`, `late`, `serviceLevel` | Nuevo: meta del 90 % por planta (respuesta 5) |
| `summary.delayReasons` | OP medidas `incumplio` por `RazonRetraso`, de mayor a menor. `name: null` es "Sin razón de atraso" | Barras "razón de retraso" (respuesta 11) |
| `filterOptions.plants` | Plantas con OP en el periodo | Segmentador de familia |
| `years` | Años con fecha ideal en la tabla | Segmentador Año |
| `loadedAt` | `MAX(FechaCarga)` de la tabla: hora de la última carga | — |
| `updatedAt` | Hora de la respuesta, igual que en facturación | — |

Decisiones de este contrato (aprobadas el 2026-11-18):

- **A. Incumplidas sin las OP en curso.** El BI calcula `TOTAL INCUMPLIO = TOTAL OP − TOTAL CUMPLIÓ`, así que cuenta como incumplidas las OP que todavía están en plazo (en la matriz de noviembre: 510 "NO", frente a unas 198 incumplidas medidas). Con la respuesta 3, `late` cuenta solo las OP medidas que incumplieron, y las que están en plazo van aparte en `inProgress` y `closedEarly`.
- **B. Razones de retraso solo de OP medidas e incumplidas**, por el mismo motivo.
- **C. La gráfica mensual muestra el año completo** y no responde al rango de fechas, para que siempre se vea la tendencia. En el BI respondía al rango de fechas de la página principal.
- **D. Resumen por planta nuevo**, para mostrar la meta del 90 % por planta.

No se incluyen: la columna `RazonRetraso2` en las gráficas (sí en el detalle), la página "Duplicado de NS PLantas" (respuesta 6) ni exportación a Excel (el BI no la tenía).

**Aprobación del contrato:** Milton Rendón — 2026-11-18 — aprobado.

## 4. Endpoint

- Repositorio `reporting-api`, rama `bi/ns-plantas` (desde `main`), commit `18be860`.
- Archivos tocados en `reporting-api`: `src/types.ts` (`NsPlants*`), `src/db.ts` (`nsPlantsSource`, `addNsPlantsPeriodFilters`, `getNsPlantsReport`), `src/server.ts` (`nsPlantsFiltersFrom` y la ruta `/api/v1/ns-plantas`), `.env.example` y `README.md`.
- Variables nuevas en `.env.example`: `REPORT_NS_PLANTAS_TABLE_SCHEMA=dbo` y `REPORT_NS_PLANTAS_TABLE=Informe_ns_plantas`. Tienen esos valores por defecto en el código, así que el `.env` del servidor funciona sin agregarlas.
- Una sola consulta por lotes: `#ops` (periodo y planta, sin el día) → `#rows` (detalle con cumplimiento y búsqueda) → 10 recordsets: 0 página, 1 total, 2 totales, 3 serie diaria, 4 serie mensual, 5 plantas, 6 razones, 7 años, 8 catálogo de plantas, 9 `loadedAt`.
- `npm run build` sin errores (2026-11-18). SQL revisado a mano: recordsets e índices coinciden, filtros parametrizados, sin `TRY_CONVERT`.
- `pendiente`: prueba contra la base. No hay `.env` local en `reporting-api`, así que se prueba en el servidor después de desplegar el paquete.
- Paquete de despliegue: `reporting-api-dist-7a016a9.zip` (en el escritorio, fuera de los repositorios), construido desde la rama local `deploy/2026-11-18` = `bi/ns-plantas` + `proyecto/consolidado-comercial`, porque el servidor ya tiene desplegado el consolidado comercial y el `dist` reemplaza la API completa. Verificado: `dist/server.js` tiene las dos rutas.

## 5. Dashboard

- Rutas: `/ns-plantas` (resumen) y `/ns-plantas/detalle` (órdenes), en [`components/NsPlantasDashboard.tsx`](../../components/NsPlantasDashboard.tsx), con los componentes comunes de `components/dashboard/`. Proxy `app/api/ns-plantas/route.ts`, tipos `lib/ns-plantas/types.ts`, estilos `app/styles/ns-plants.css`.
- Catálogo: informe `ns-plantas` en `lib/reports.ts`, área Operaciones; navegación `nsPlantsNavigation`.
- Filtros en borrador (Aplicar, lupa o Enter; Limpiar vuelve al mes en curso): año, mes y planta en la barra; semana, día, desde y hasta en "Filtros"; en el detalle, además, cumplimiento (abre en `incumplio`) y búsqueda. Todos viajan a la API.
- Resumen: tarjetas de nivel de servicio (meta 90 %), medidas, incumplidas y "aún en plazo" (abiertas + cerradas antes de su plazo); líneas por fecha ideal y columnas por mes con la línea de meta; tabla por planta con "Cumple la meta" o "Bajo la meta" (icono, texto y color); barras de incumplidas por razón con "Sin razón de atraso" diferenciada.
- Pie: hora de la última carga (`loadedAt`) y horario de actualización.
- `npm run lint` y `npm run build` sin errores (2026-11-18).
- `pendiente`: revisión visual a 375, 820 y 1440 px con datos reales, y asignar el informe a `hector.chinchilla@firplak.com` en `/admin/permisos`.

## 6. Conciliación con Power BI

`pendiente`.

**Firma del dueño de negocio:** nombre — fecha — `pendiente`

## 7. Despliegue y retiro

`pendiente`.
