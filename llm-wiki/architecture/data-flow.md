---
status: active
updated: 2026-10-23
sources:
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/db.ts
  - https://github.com/Firplak/firplak-reporting-api/blob/main/src/types.ts
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

## Carga

Confirmado el 2026-10-27 ([ficha de Notas crédito](../bi/notas-credito.md#cómo-se-carga-informe_ventas-definición-compartida-por-el-desarrollador-2026-10-27)): la tabla la llena `Planos_Symphony.dbo.SP_Generar_Informe_Ventas` (modos `COMPLETA` e `INCREMENTAL`) desde `Firplak_SA` y `DBViventta`, con los jobs `BI - Ventas carga incremental` y `BI - Ventas carga completa`, y registra cada corrida en `dbo.Cargas_Log`. Además de las columnas de arriba, tiene `Empresa` (Firplak / Viventta), `DocEntry` y `LineNum`. El dashboard de facturación aún no filtra por `Empresa`. Horario: incremental cada 15 minutos de 6:00 a 20:00 y completa diaria a las 2:00.

## Rendimiento

La tabla debe ser alimentada por el proceso de actualización periódica y tener índices, como mínimo, sobre `FechaContabilizacion`, `Zona` y `GrupoCliente`. La búsqueda libre usa `CHARINDEX`, por lo que si crece mucho debe evaluarse Full-Text Search o una columna de búsqueda preparada.
