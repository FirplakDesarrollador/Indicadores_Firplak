---
status: active
updated: 2026-10-22
sources:
  - ../../reporting-api/src/db.ts
  - ../../reporting-api/src/types.ts
  - ../../components/FacturacionDashboard.tsx
---

# Flujo y contrato de datos

## Fuente

La API consulta:

```text
[Planos_Symphony].[dbo].[Informe_ventas]
```

La tabla contiene 46 columnas. Las columnas usadas por el dashboard son:

| Columna SQL | Campo API | Uso |
|---|---|---|
| `FechaContabilizacion` | `date` | Fecha del documento |
| `DOCNUM` | `docnum` | Número del documento |
| `NombreCliente` | `customer` | Cliente |
| `GrupoCliente` | `customerGroup` | Grupo de cliente |
| `TipoVentas` | `channel` | Canal |
| `Zona` | `zone` | Zona |
| `Ciudad` | `city` | Ciudad |
| `CodCliente` | `customerCode` | Código del cliente |
| `VendedorSenior` | `seniorSeller` | Vendedor senior |
| `VendedorJunior` | `juniorSeller` | Vendedor junior |
| `Territorio` | `territory` | Territorio |
| `ValorTotal` | `valueTotal` | Valor contable |
| `TipoDocumento` | `documentType` | Clasificación del documento |
| `CodigoTipoNC` | `creditCode` | Código de nota crédito |
| `TiposNC` | `creditType` | Tipo de nota crédito |

## Regla contable

`TipoDocumento` contiene al menos `Factura` y `Nota Crédito`. La API considera nota crédito cualquier registro cuyo tipo empiece por `Nota`, o que tenga `CodigoTipoNC` o `TiposNC` informado.

- Facturas: `invoiced = abs(ValorTotal)`, `creditNote = 0`, `net = ValorTotal`.
- Notas crédito: `invoiced = 0`, `creditNote = abs(ValorTotal)`, `net = -abs(ValorTotal)`.

La regla debe revisarse si el SP incorpora nuevos tipos documentales.

## Respuesta de la API

```json
{
  "rows": [],
  "years": [2026],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 0 },
  "summary": {
    "invoiced": 0,
    "creditNote": 0,
    "net": 0,
    "daily": [],
    "zones": []
  },
  "source": "sql-server",
  "updatedAt": "2026-10-22T00:00:00.000Z"
}
```

## Rendimiento

La tabla debe ser alimentada por el proceso de actualización periódica y tener índices, como mínimo, sobre `DOCDATE`, `Zona` y `GrupoCliente`. La búsqueda libre usa `CHARINDEX`, por lo que si crece mucho debe evaluarse Full-Text Search o una columna de búsqueda preparada.
