---
status: en-migracion
fase: 0
updated: AAAA-MM-DD
sources:
  - ../../bi-origen/<slug>/
---

# BI: <Nombre del reporte>

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | |
| Dueño de negocio (valida las cifras) | |
| Desarrollador responsable | |
| Usuarios y frecuencia de uso | |
| Prioridad | Alta / Media / Baja |
| Rama | `bi/<slug>` |

## 1. Análisis

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|

<details><summary>SQL original de cada fuente</summary>

```sql
-- Pegar aquí el Query de cada Sql.Database
```

</details>

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|

### Indicadores (medidas DAX)

| Indicador | Regla de negocio | DAX original | Vivirá en (SP / summary API / frontend) |
|---|---|---|---|

Medidas sin uso en visuales (no migrar, confirmar):

-

### Visuales y filtros

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|

Filtros y segmentadores:

| Filtro | Columna de origen | Valores reales (confirmados) |
|---|---|---|

### Seguridad (RLS)

- ¿Tiene roles? Sí / No
- Reglas:

### Riesgos y preguntas para el dueño de negocio

-

**Validación del dueño de negocio:** nombre — fecha — `pendiente`

## 2. Tabla de reporte y carga incremental

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_<tema>` |
| Grano (una fila por…) | |
| Clave | |
| Fecha de referencia (filtros por periodo) | |
| Estrategia incremental | Ventana móvil de N días / marca de modificación |
| SP | `dbo.sp_Actualizar_Informe_<tema>` |
| Job y horario | |
| Índices | |

Validación de totales (origen vs. tabla):

| Periodo | Filas origen | Filas tabla | Total origen | Total tabla |
|---|---|---|---|---|

## 3. Contrato del endpoint

`GET /api/v1/<tema>`

Parámetros:

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `page`, `pageSize` | entero | — | Paginación |
| `anio`, `mes` | entero | `<FechaReferencia>` | Periodo |

Respuesta:

```json
{
  "rows": [],
  "years": [],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 1 },
  "summary": {},
  "filterOptions": {},
  "source": "sql-server",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Aprobación del contrato:** nombre — fecha — `pendiente`

## 4. Endpoint

- Archivos tocados en `reporting-api`:
- Variables nuevas en `.env.example`:
- Prueba contra la base: fecha — resultado

## 5. Dashboard

- Ruta: `/<tema>`
- Proxy: `app/api/<tema>/route.ts`
- Componentes reutilizados:
- Revisión visual (375 / 820 / 1440 px): fecha

## 6. Conciliación con Power BI

| Indicador | Periodo | Dashboard | Power BI | Diferencia | Causa |
|---|---|---|---|---|---|

**Firma del dueño de negocio:** nombre — fecha — `pendiente`

## 7. Despliegue y retiro

- API desplegada (versión / fecha):
- Frontend desplegado (commit / fecha):
- Power BI retirado (fecha):
- Rollback:
