---
status: migrado
fase: 7
updated: 2026-10-28
sources:
  - ../../bi-origen/bi-notas-credito/
---

# BI: Notas crédito

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `bi-notas-creditos` ([proyecto .pbip](../../bi-origen/bi-notas-credito/bi-notas-creditos.pbip)) |
| Dueño de negocio (valida las cifras) | Daniel Jimenez |
| Desarrollador responsable | Daniel Jimenez |
| Usuarios y frecuencia de uso | Cartera; uso diario |
| Prioridad | Piloto (primer BI migrado con el proceso) |
| Rama | `bi/notas-credito` |

## 1. Análisis

Analizado el 2026-10-27 a partir del proyecto [`bi-notas-creditos.pbip`](../../bi-origen/bi-notas-credito/bi-notas-creditos.pbip): modelo en [`definition/tables/`](../../bi-origen/bi-notas-credito/bi-notas-creditos.SemanticModel/definition/tables/) y visuales en [`definition/pages/`](../../bi-origen/bi-notas-credito/bi-notas-creditos.Report/definition/pages/). Sin validación con datos todavía: ver [Consultas de validación](#consultas-de-validación-para-el-desarrollador).

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|
| `NotasCreditos` | `Sql.Database` (import) | Servidor `ITPLAKINFO`, base `Firplak_SA` (SAP Business One): `ORIN` + `RIN1` + `RIN12` y maestros | Una fila por línea de nota crédito. Valores ya negados en el SQL (`LINETOTAL * -1`). |
| `Facturas` | `Sql.Database` (import) | Servidor `ITPLAKINFO`, base `Firplak_SA`: `OINV` + `INV1` + `INV12` y maestros | Una fila por línea de factura. Solo se usa como denominador (`Total Facturado`). |
| `calendario` | Tabla calculada DAX | `CALENDAR(min(Facturas[Fecha contabilización]), max(Facturas[Fecha contabilización]))` | El rango lo marcan las facturas, no las notas. |
| `ÁREA` | Datos escritos a mano en Power BI | 6 valores: Cliente, Comercial, Logística, Calidad de fabrica, Muestras / Obsequio, Error en sistema | No la usa ningún visual ni tiene relaciones. No migrar (confirmar). |
| `Medidas` | Tabla vacía | — | Solo contiene las medidas. |
| `LocalDateTable_*`, `DateTableTemplate_*` | Automáticas de Power BI | — | Jerarquía Año/Mes de `calendario`. No se migran. |

Ambas fuentes son SQL Server, no Excel ni SharePoint. **Pero no salen de `Planos_Symphony`**: salen de la base de SAP `Firplak_SA` en `ITPLAKINFO`. Confirmado el 2026-10-27: `Planos_Symphony` está en la misma instancia (`@@SERVERNAME = ITPLAKINFO`), así que el SP puede leer `Firplak_SA.dbo.<tabla>` con nombres de tres partes, sin servidor vinculado.

<details><summary>SQL original de <code>NotasCreditos</code></summary>

```sql
SELECT T0.DOCDATE
      , T0.DOCNUM
      , CASE
           WHEN ISNULL( DATALENGTH( T1.U_TIENDAS ),0 ) = 0 THEN T11.SLPNAME
           ELSE
               (
                 SELECT VENDEDOR.SLPNAME
     FROM OSLP VENDEDOR
          INNER JOIN OCRD SN ON SN.SLPCODE = VENDEDOR.SLPCODE
     WHERE SN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Vendedor Senior'
      , CASE
           WHEN ISNULL( DATALENGTH( T1.U_TIENDAS ),0 ) = 0 THEN T12.NAME
           ELSE
               (
                 SELECT DISTINCT
          T16.NAME
     FROM [@FIR_VENDEDORJUNIOR] T16
          INNER JOIN OCRD T17 ON T17.U_VENDEDORJUNIOR = T16.CODE
     WHERE T17.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Vendedor Junior'
      , T0.U_TipoVentas
      , CASE
           WHEN ISNULL( DATALENGTH( T1.U_TIENDAS ),0 ) = 0 THEN T10.DESCRIPT
           ELSE
               (
                 SELECT ZONAPADRE.DESCRIPT
     FROM OCRD ZONASN
          INNER JOIN OTER ZONATERRITORIO ON ZONASN.TERRITORY = ZONATERRITORIO.TERRITRYID
          INNER JOIN OTER ZONAPADRE ON ZONATERRITORIO.PARENT = ZONAPADRE.TERRITRYID
     WHERE ZONASN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Zona'
      , CASE
           WHEN ISNULL( DATALENGTH( T1.U_TIENDAS ),0 ) = 0 THEN T9.DESCRIPT
           ELSE
               (
                 SELECT ZONATERRITORIO.DESCRIPT
     FROM OCRD ZONASN
          INNER JOIN OTER ZONATERRITORIO ON ZONASN.TERRITORY = ZONATERRITORIO.TERRITRYID
     WHERE ZONASN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Territorio'
      , T5.GROUPNAME 'Grupo de Cliente'
      , T8.NAME 'Subgrupo de Cliente'
      , T0.CARDCODE 'Cod Cliente'
      , T0.CARDNAME 'Nombre Cliente'
      , T1.U_TIENDAS 'Código Punto de Venta'
      , T13.CARDNAME 'Descripción Punto de Venta'
      , CASE
           WHEN ISNULL( DATALENGTH( T1.U_TIENDAS ),0 ) = 0 THEN T4.U_CENTRODECTOS
           ELSE T13.U_CENTRODECTOS
       END AS 'Centro de Costos'
      , T15.ITMSGRPNAM 'Grupo de Articulo'
      , T14.U_GRUPO 'Familia'
      , T1.ITEMCODE 'Codigo Articulo'
      , T1.DSCRIPTION 'Descripcion de Articulo'
      , case WHEN t1.itemcode = 'VZNOPE-0011-000-0000' THEN '0' else T1.QUANTITY * -1 END AS 'Cantidad'
      ,(T1.[PriceBefDi]*t0.DocRate) 'Precio de venta'
      ,T1.DiscPrcnt '% Descuento'
      ,(T1.Price*t0.DocRate) 'Precio tras el descuento'
     , T1.LINETOTAL * -1 'Valor Total'      
     , T1.GROSSBUYPR AS Costo
	  , T1.Quantity * t1.GrossBuyPr*-1 as 'Costo total'
	, (t1.LineTotal)*-1 - (T1.Quantity * t1.GrossBuyPr*-1) as 'Utilidad Bruta'
	, 0.00 as 'Margen Bruta'
--((t1.LineTotal)*-1 - (T1.Quantity * t1.GrossBuyPr*-1)) / t1.LineTotal
      , T3.NAME AS 'Obra'
	  , T16.CityS as 'Ciudad'
      , T4.Phone1 as 'Teléfono'
	, t14.U_FNovedad as 'Fecha Fin Novedad'
      ,T17.Name as 'Segmento del cliente'
      , T0.U_TIPOSNC 'Codigo del Tipo NC'
      , T30.NAME 'TiposNC'
      , T0.U_CONCEPTOSNC 'Codigo Concepto Nc'
      , T31.NAME 'Conceptos Notas Crédito'
      , T0.COMMENTS
FROM ORIN T0
     INNER JOIN RIN1 T1 ON T0.DOCENTRY = T1.DOCENTRY
     INNER JOIN RIN12 T16 ON T0.DOCENTRY = T16.DOCENTRY
     INNER JOIN OCRD T4 ON T0.CARDCODE = T4.CARDCODE
     LEFT JOIN OCPR T3 ON T0.CNTCTCODE = T3.CNTCTCODE
     INNER JOIN OTER T9 ON T4.TERRITORY = T9.TERRITRYID
     INNER JOIN OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
     INNER JOIN OSLP T6 ON T0.SLPCODE = T6.SLPCODE
     LEFT JOIN OSLP T11 ON T0.SLPCODE = T11.SLPCODE
     LEFT JOIN [@FIR_SUBGRUPOCLIENTE] T8 ON T4.U_SUBGROUPCODE = T8.CODE
     LEFT JOIN OTER T10 ON T9.PARENT = T10.TERRITRYID
     LEFT JOIN [@FIR_VENDEDORJUNIOR] T12 ON T4.U_VENDEDORJUNIOR = T12.CODE
     LEFT JOIN OCRD T13 ON T1.U_TIENDAS = T13.CARDCODE
     LEFT JOIN OITM T14 ON T1.ITEMCODE = T14.ITEMCODE
     LEFT JOIN OITB T15 ON T14.ITMSGRPCOD = T15.ITMSGRPCOD
     LEFT JOIN [@FIR_TIPOSNC] T30 ON T0.U_TIPOSNC = T30.CODE
     LEFT JOIN [@FIR_CONCEPTOSNC] T31 ON T0.U_CONCEPTOSNC = T31.CODE
     LEFT JOIN [dbo].[@FIR_SEGMENTACION]  T17 ON T0.[U_Segmentacion] = T17.[Code]
WHERE T0.SERIES <> '88'
     AND T1.TAXONLY = 'N'
     AND T1.LINETOTAL <> 0
     AND T0.CANCELED = 'N'
     And t0.DocType <>'S'
     AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000', 'VZNOPE-0001-000-0000', 'VZNOPE-0004-000-0000', 'VZNOPE-0006-000-0000', 
     'VZNOPE-0007-000-0000', 'VZNOPE-0008-000-0000', 'VZNOPE-0009-000-0000', 'VZNOPE-0010-000-0000', 'VZNOPE-0012-000-0000', 
     'VZNOPE-0014-000-0000', 'VZNOPE-0015-000-0000', 'VZNOPE-0017-000-0000', 'VZNOPE-0018-000-0000')
     AND T0.DocNum <> 1002414 --Se retira esta NC por solicitud de Claudia Duque
```

</details>

<details><summary>SQL original de <code>Facturas</code></summary>

```sql
SELECT T0.DOCDATE
      , T0.DOCNUM
      , CASE
           WHEN ISNULL(DATALENGTH(T1.U_TIENDAS),0) = 0 THEN T11.SLPNAME
           ELSE( 
                 SELECT VENDEDOR.SLPNAME
     FROM OSLP VENDEDOR
          INNER JOIN OCRD SN ON SN.SLPCODE = VENDEDOR.SLPCODE
     WHERE SN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Vendedor Senior'
      , CASE
           WHEN ISNULL(DATALENGTH(T1.U_TIENDAS),0) = 0 THEN T12.NAME
           ELSE( 
                 SELECT DISTINCT T16.NAME
     FROM [@FIR_VENDEDORJUNIOR] T16
          INNER JOIN OCRD T17 ON T17.U_VENDEDORJUNIOR = T16.CODE
     WHERE T17.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Vendedor Junior'
      , T0.U_TipoVentas
      , CASE
           WHEN ISNULL(DATALENGTH(T1.U_TIENDAS),0) = 0 THEN T10.DESCRIPT
           ELSE( 
                 SELECT ZONAPADRE.DESCRIPT
     FROM OCRD ZONASN
          INNER JOIN OTER ZONATERRITORIO ON ZONASN.TERRITORY = ZONATERRITORIO.TERRITRYID
          INNER JOIN OTER ZONAPADRE ON ZONATERRITORIO.PARENT = ZONAPADRE.TERRITRYID
     WHERE ZONASN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Zona'
      , CASE
           WHEN ISNULL(DATALENGTH(T1.U_TIENDAS),0) = 0 THEN T9.DESCRIPT
           ELSE( 
                 SELECT ZONATERRITORIO.DESCRIPT
     FROM OCRD ZONASN
          INNER JOIN OTER ZONATERRITORIO ON ZONASN.TERRITORY = ZONATERRITORIO.TERRITRYID
     WHERE ZONASN.CARDCODE = T1.U_TIENDAS
               )
       END AS 'Territorio'
      , T5.GROUPNAME 'Grupo de Cliente'
      , T8.NAME 'Subgrupo de Cliente'
      , T0.CARDCODE 'Cod Cliente'
      , T0.CARDNAME 'Nombre Cliente'
      , T1.U_TIENDAS 'Código Punto de Venta'
      , T13.CARDNAME 'Descripción Punto de Venta'
      , CASE
           WHEN ISNULL(DATALENGTH(T1.U_TIENDAS),0) = 0 THEN T4.U_CENTRODECTOS
           ELSE T13.U_CENTRODECTOS
       END AS 'Centro de Costos'
      , T15.ITMSGRPNAM 'Grupo de Articulo'
      , T14.U_GRUPO 'Familia'
      , T1.ITEMCODE 'Codigo Articulo'
      , T1.DSCRIPTION 'Descripcion de Articulo'
      , T1.QUANTITY 'Cantidad'
      ,(T1.[PriceBefDi]*t0.DocRate) 'Precio de venta'
      ,T1.DiscPrcnt '% Descuento'
      ,(T1.Price*t0.DocRate) 'Precio tras el descuento'
      , T1.LINETOTAL 'Valor Total'
      , T1.GROSSBUYPR AS Costo
, T1.Quantity * t1.GrossBuyPr as 'Costo total'
, t1.LineTotal - (T1.Quantity * t1.GrossBuyPr) as 'Utilidad Bruta'
, (t1.LineTotal - (T1.Quantity * t1.GrossBuyPr)) / t1.LineTotal as 'Margen Bruta'
      , T3.NAME AS 'Obra'
      , T16.CityS as 'Ciudad'
      , T4.Phone1 as 'Teléfono'
      , t14.U_FNovedad as 'Fecha Fin Novedad'
      ,T17.Name as 'Segmento del cliente'
FROM OINV T0
     INNER JOIN INV1 T1 ON T0.DOCENTRY = T1.DOCENTRY
     INNER JOIN INV12 T16 ON T0.DOCENTRY = T16.DOCENTRY
     INNER JOIN OCRD T4 ON T0.CARDCODE = T4.CARDCODE
     LEFT JOIN OCPR T3 ON T0.CNTCTCODE = T3.CNTCTCODE
     INNER JOIN OTER T9 ON T4.TERRITORY = T9.TERRITRYID
     INNER JOIN OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
     INNER JOIN OSLP T6 ON T0.SLPCODE = T6.SLPCODE
     LEFT JOIN OSLP T11 ON T0.SLPCODE = T11.SLPCODE
     INNER JOIN [@FIR_SUBGRUPOCLIENTE] T8 ON T4.U_SUBGROUPCODE = T8.CODE
     INNER JOIN OTER T10 ON T9.PARENT = T10.TERRITRYID
     LEFT JOIN [@FIR_VENDEDORJUNIOR] T12 ON T4.U_VENDEDORJUNIOR = T12.CODE
     LEFT JOIN OCRD T13 ON T1.U_TIENDAS = T13.CARDCODE
     LEFT JOIN OITM T14 ON T1.ITEMCODE = T14.ITEMCODE
     LEFT JOIN OITB T15 ON T14.ITMSGRPCOD = T15.ITMSGRPCOD
     LEFT JOIN [dbo].[@FIR_SEGMENTACION]  T17 ON T0.[U_Segmentacion] = T17.[Code]
WHERE T0.SERIES <> '88'
     AND T0.CANCELED = 'N'
     AND T1.TAXONLY = 'N'
     AND T0.U_TipoVentas <> 'Donaciones'
     AND T1.LINETOTAL <> 0
     AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000', 'VZNOPE-0001-000-0000', 'VZNOPE-0004-000-0000', 'VZNOPE-0006-000-0000', 
     'VZNOPE-0007-000-0000', 'VZNOPE-0008-000-0000', 'VZNOPE-0009-000-0000', 'VZNOPE-0010-000-0000', 'VZNOPE-0012-000-0000', 
     'VZNOPE-0014-000-0000', 'VZNOPE-0015-000-0000', 'VZNOPE-0017-000-0000', 'VZNOPE-0018-000-0000', 'VZNOPE-0021-000-0000')
     AND T0.DocNum NOT IN (96491, 96492, 96493, 96494, 96495, 96496, 96497, 96515, 96516) --Se retira estas facturas por solicitud de Claudia Duque
```

</details>

#### Diferencias entre las dos consultas

Las dos consultas tienen la misma estructura, pero difieren en lo siguiente. Esto afecta directamente al `% Sobre el total`:

| Regla | `Facturas` | `NotasCreditos` |
|---|---|---|
| Excluye `U_TipoVentas = 'Donaciones'` | Sí | **No** |
| Excluye documentos de servicio (`DocType <> 'S'`) | No | Sí |
| Artículos `VZNOPE-…` excluidos | 14 códigos, incluye `VZNOPE-0021-000-0000` | 13 códigos, **sin** `VZNOPE-0021-000-0000` |
| Documentos excluidos a mano ("por solicitud de Claudia Duque") | `DocNum` 96491–96497, 96515, 96516 | `DocNum` 1002414 |
| `@FIR_SUBGRUPOCLIENTE` y zona padre (`OTER T10`) | `INNER JOIN`: descarta clientes sin subgrupo o sin zona | `LEFT JOIN`: los conserva |
| `Cantidad` | `QUANTITY` | `QUANTITY * -1`; `'0'` para `VZNOPE-0011-000-0000` |
| `Margen Bruta` | Calculado | Fijo en `0.00` |

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|
| `NotasCreditos` | `Renamed Columns` | Renombra `U_TipoVentas`→`TipoVentas`, `DOCDATE`→`Fecha contabilización`, `DOCNUM`→`Num Documento`, `COMMENTS`→`Comentarios` | Sí, como alias de columnas de la tabla |
| `NotasCreditos` | `Columnas quitadas` | Quita `Fecha Fin Novedad` | Sí (no se carga) |
| `NotasCreditos` | Columna calculada `Departamento` | Toma los 2 primeros caracteres de `Codigo Concepto Nc`: 23 COMERCIAL, 24 LOGISTICA, 25 FINANCIERA, 26 PRODUCCIÓN, 27 CALIDAD, 28 CLIENTE, 29 COMPRAS, 30 T.I, 31 INGENIERIA, 32 COMEX, 33 MUESTRA; cualquier otro código queda en blanco | Sí, como `CASE` en el SP |
| `NotasCreditos` | Columna calculada `TIPO NC Agr.` | Según los 10 primeros caracteres de `TiposNC`: "Devolución" queda "Devolución"; "Anulación ", "Descuento ", "Dscto no f", "NC Obsequi", "Perdida po" y "Reposicion" pasan a "Anulación"; cualquier otro tipo conserva su nombre | Sí, como `CASE` en el SP |
| `Facturas` | `Renamed Columns` | Renombra `U_TipoVentas`, `DOCDATE`, `DOCNUM` | Sí, como alias |

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `NotasCreditos[Fecha contabilización]` | `calendario[Date]` | Muchos a uno | Única (calendario filtra notas) |
| `Facturas[Fecha contabilización]` | `calendario[Date]` | Muchos a uno | Única (calendario filtra facturas) |
| `calendario[Date]`, `Facturas[Fecha Fin Novedad]` | `LocalDateTable_*` | Automáticas | — |

`NotasCreditos` y `Facturas` **solo comparten la fecha**. Por eso los segmentadores de `Departamento`, `TipoVentas`, vendedor, concepto o tipo de NC filtran las notas, pero **no** la facturación.

### Indicadores (medidas DAX)

| Indicador | Regla de negocio | DAX original | Vivirá en (SP / summary API / frontend) |
|---|---|---|---|
| Total NC | Suma del valor de las líneas de notas crédito, mostrado en positivo | `sum(NotasCreditos[Valor Total])*-1` | Summary API (`SUM`); el SP guarda el valor por línea |
| Total Facturado | Suma del valor de las líneas de factura del periodo | `sum(Facturas[Valor Total])` | Summary API |
| Total Ventas | Facturación neta: facturado menos notas crédito | `[Total Facturado] - [Total NC]` | Summary API |
| % Sobre el total | Peso de las notas crédito sobre lo facturado | `DIVIDE([Total NC], [Total Facturado])` | Summary API (con división segura) |
| A.A % Sobre el total | El mismo % en el mismo periodo del año anterior | `CALCULATE([% Sobre el total], SAMEPERIODLASTYEAR(calendario[Date]))` | Summary API (serie mensual del año anterior) |
| Meta | Meta fija del 3 % para el % de notas crédito (oficial por ahora, según el dueño) | `0.03` | Summary API, como constante única y documentada |

Medidas sin uso en visuales (no migrar, confirmar):

- `Total notas` (`SUM(NotasCreditos[Valor Total])`, el mismo total con signo negativo).
- `ÁREA` (medida vacía en `Facturas`).
- Columnas cargadas que ningún visual usa: precios, descuento, costo, utilidad, margen, cantidad, artículo, familia, grupo de artículo, obra, ciudad, teléfono, segmento, punto de venta, centro de costos, grupo de cliente y zona.

### Visuales y filtros

El informe no tiene filtros de informe ni de página.

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|
| INDICADOR NC (primera página) | Título "NOTAS CRÉDITO" | — | — |
| INDICADOR NC | Tarjeta | Total NC | — |
| INDICADOR NC | Línea: facturación vs. notas | Total Facturado, Total NC, Total Ventas | Año, Mes |
| INDICADOR NC | Línea: % NC vs. meta | % Sobre el total, A.A % Sobre el total, Meta | Año, Mes. Filtro del visual: `% Sobre el total > 0` |
| INDICADOR NC | Matriz "TIPO NC" | Total NC | `TIPO NC Agr.`. Filtro del visual: `TipoVentas` en Exterior, Nacional o vacío |
| INDICADOR NC | Matriz por vendedor | Total NC | Vendedor Senior, Vendedor Junior, Num Documento |
| PARETO | Tarjeta | Total NC | — |
| PARETO | Torta | Total NC | Departamento |
| PARETO | Barras "CONCEPTO NOTAS CRÉDITO" | Total NC, % Sobre el total | Conceptos Notas Crédito |
| PARETO | Matriz "TIPO NC" | Total NC | `TIPO NC Agr.`. Mismo filtro de `TipoVentas` |
| DETALLE | Tabla | Total NC (con total) | Num Documento, Nombre Cliente, Subgrupo de Cliente, Territorio, TipoVentas, Vendedor Senior, TiposNC, Conceptos Notas Crédito, Comentarios |
| DETALLE | Botón "Atrás" | — | — |

Interacciones: en PARETO, un clic en la matriz TIPO NC filtra las barras de concepto, y un clic en las barras filtra la torta.

Filtros y segmentadores:

| Filtro | Columna de origen | Valores reales (confirmados) |
|---|---|---|
| Año / Mes (las 3 páginas) | `calendario[Date]` → `Fecha contabilización` | Años y meses con datos (los arma la API) |
| Departamento (INDICADOR NC, PARETO) | Columna calculada `Departamento` | Prefijos con datos: 23–32 (COMERCIAL a COMEX). El 33 (MUESTRA) no aparece en 24 meses. Los prefijos 34, 35 y 36 y los conceptos nulos quedan vacíos |
| Tipo ventas (PARETO, DETALLE) | `ORIN.U_TipoVentas` | Nacional (4615 líneas), Exterior (1969), Donaciones (133, se excluirá), Excluido (49), vacío (9), Zona Franca (5) |
| Vendedor Senior (DETALLE) | Subconsulta sobre `OSLP` | Los arma la API desde la tabla (no se consultaron) |
| Concepto NC (DETALLE) | `[@FIR_CONCEPTOSNC].NAME` | 40 conceptos con datos y nulos; ver resultados de la consulta 1 |
| Tipo NC agrupado (DETALLE) | Columna calculada `TIPO NC Agr.` | Con los `TiposNC` reales solo resultan **Devolución**, **Anulación** y vacío (`TiposNC` nulo) |

### Seguridad (RLS)

- ¿Tiene roles? No. El modelo no tiene `role` ni `tablePermission`.
- Reglas: no hay. Todos los usuarios del BI ven todas las notas.

### Riesgos y preguntas para el dueño de negocio

Riesgos técnicos:

- **Fuente fuera de `Planos_Symphony`.** Los datos salen de `ITPLAKINFO.Firplak_SA` (SAP). Resuelto: es la misma instancia.
- **`Informe_ventas` no basta.** Tiene `TipoDocumento`, `CodigoTipoNC` y `TiposNC` ([Flujo de datos](../architecture/data-flow.md)), pero no tiene concepto, comentarios ni subgrupo de cliente. Tampoco se sabe si aplica las mismas exclusiones que este BI. Haría falta una tabla nueva.
- **Archivos con datos.** `.pbi/cache.abf` guarda los datos importados y `.pbi/localSettings.json` guarda configuración local. El proyecto no trae `.gitignore`: se agregó [`bi-origen/bi-notas-credito/.gitignore`](../../bi-origen/bi-notas-credito/.gitignore) para no subirlos.
- **Tipo de página.** INDICADOR NC y PARETO están definidas como páginas de información sobre herramientas (`type: Tooltip`) aunque miden 1280×720. Sin impacto: el dashboard incluirá el contenido de las 3 páginas.

Preguntas para el dueño de negocio (Daniel Jimenez):

1. **Donaciones.** Las facturas excluyen el tipo de venta "Donaciones" y las notas no. ¿El % debe comparar las mismas poblaciones?
Respuesta: Se debe excluir en los dos querys
2. **Documentos de servicio y `VZNOPE-0021`.** Hoy se excluyen solo de un lado. ¿Es intencional?
Respuesta: No, debe excluirse a ambos lados
3. **Exclusiones a mano.** ¿Se mantienen las facturas 96491–96497, 96515 y 96516 y la NC 1002414 retiradas por solicitud de Claudia Duque? ¿Aparecerán más?
Respuesta: Es posible que aparezcan mas
4. **% con filtros.** Al filtrar por departamento o tipo de venta, el % divide las notas filtradas entre **toda** la facturación. ¿Es lo esperado, o la facturación también debe filtrarse por tipo de venta?
Respuesta: Es lo esperado
5. **Meta del 3 %.** ¿Es la meta oficial? ¿Es fija o cambia por año o por mes?
Respuesta: Por ahora es la oficial
6. **Agrupación de tipos NC.** Descuento, Dscto no f…, NC Obsequio, Pérdida…, Reposición y Anulación se agrupan como "Anulación". ¿Es correcto?
Respuesta: Si es correcto
7. **Matriz TIPO NC.** Solo cuenta Exterior, Nacional y tipo de venta vacío, así que su total puede no coincidir con la tarjeta. ¿Se mantiene ese filtro?
Respuesta: Manten el filtro
8. **Departamento vacío.** Los conceptos cuyo código no empieza por 23–33 quedan sin departamento. ¿Cómo deben mostrarse?
Respuesta: Como vacío
9. **Tabla `ÁREA`.** ¿Se puede descartar? Sus 6 áreas no coinciden con los departamentos.
Respuesta: Se puede descartar
10. **Columnas sin uso.** ¿Cartera necesita alguna columna que no aparece en los visuales, como ciudad, teléfono, obra o punto de venta, para el detalle o para exportar?
Respuesta: Para el detalle

#### Decisiones del dueño de negocio (2026-10-27)

| # | Decisión | Efecto en la migración |
|---|---|---|
| 1 | Excluir Donaciones en facturas y en notas | Cambia el % frente al BI actual: la conciliación de la fase 6 debe explicarlo |
| 2 | Excluir documentos de servicio (`DocType = 'S'`) y `VZNOPE-0021-000-0000` en ambos lados | Misma lista de exclusiones para facturas y notas |
| 3 | Pueden aparecer más documentos excluidos a mano | Las exclusiones por `DocNum` van en una tabla, no fijas en el SP |
| 4 | ~~El % con filtros divide las notas filtradas entre toda la facturación del periodo~~. **Cambiada el 2026-10-27:** tipo de venta y vendedor también filtran la facturación | La facturación se filtra por periodo, tipo de venta y vendedor senior; departamento, concepto, tipo NC y búsqueda solo filtran las notas (las facturas no tienen esos datos) |
| 5 | Meta del 3 %, oficial por ahora | Constante en la API; revisar si cambia |
| 6 | La agrupación de tipos NC es correcta | Se replica el `SWITCH` en el SP |
| 7 | Se mantiene el filtro de la matriz TIPO NC (Exterior, Nacional y vacío) | El summary de esa matriz excluye Excluido y Zona Franca |
| 8 | Departamento sin código 23–33 se muestra vacío | Sin valor por defecto |
| 9 | La tabla `ÁREA` se descarta | No se migra |
| 10 | Cartera necesita columnas adicionales en el detalle | Se agregan ciudad, teléfono, obra y punto de venta (código y descripción), las mencionadas en la pregunta. `pendiente` confirmar si falta alguna |

Por las decisiones 1 y 2, las cifras del portal **no coincidirán** con el Power BI actual en los meses con donaciones, documentos de servicio o `VZNOPE-0021`. Es una corrección pedida, no un error.

### Consultas de validación para el desarrollador

Ejecutar en `ITPLAKINFO.Firplak_SA` (solo lectura) y pegar los resultados aquí. Reutilizan las condiciones `WHERE` del SQL original de notas.

```sql
-- 1. Valores reales de los filtros (últimos 24 meses)
SELECT T0.U_TipoVentas, COUNT(*) AS Lineas
FROM ORIN T0 INNER JOIN RIN1 T1 ON T0.DOCENTRY = T1.DOCENTRY
WHERE T0.DOCDATE >= DATEADD(MONTH, -24, GETDATE()) AND T0.CANCELED = 'N' AND T0.SERIES <> '88'
  AND T1.TAXONLY = 'N' AND T1.LINETOTAL <> 0 AND T0.DocType <> 'S'
GROUP BY T0.U_TipoVentas ORDER BY Lineas DESC;

U_TipoVentas	Lineas
Nacional	4615
Exterior	1969
Donaciones	133
Excluido	49
	9
Zona Franca	5

SELECT T30.NAME AS TiposNC, LEFT(T0.U_CONCEPTOSNC, 2) AS PrefijoConcepto, T31.NAME AS Concepto, COUNT(*) AS Lineas
FROM ORIN T0 INNER JOIN RIN1 T1 ON T0.DOCENTRY = T1.DOCENTRY
     LEFT JOIN [@FIR_TIPOSNC] T30 ON T0.U_TIPOSNC = T30.CODE
     LEFT JOIN [@FIR_CONCEPTOSNC] T31 ON T0.U_CONCEPTOSNC = T31.CODE
WHERE T0.DOCDATE >= DATEADD(MONTH, -24, GETDATE()) AND T0.CANCELED = 'N' AND T0.SERIES <> '88'
  AND T1.TAXONLY = 'N' AND T1.LINETOTAL <> 0 AND T0.DocType <> 'S'
GROUP BY T30.NAME, LEFT(T0.U_CONCEPTOSNC, 2), T31.NAME ORDER BY Lineas DESC;

TiposNC	PrefijoConcepto	Concepto	Lineas
Devolución Mercancia ventas gr	28	Cliente desiste de la compra	1135
Anulación Factura Ventas grava	28	Errores clientes  administrativos o logísticos	689
Anulación Factura Ventas grava	23	Pedido mal diligenciado	526
Devolución Mercancia ventas gr	28	Errores clientes  administrativos o logísticos	510
Devolución Mercancia ventas gr	23	Pedido mal diligenciado	459
Anulación Factura Ventas grava	24	Factura mal elaborada o retraso en envío	434
Anulación factura ventas de ex	23	Muestra sin valor comercial	398
Descuento no facturado	23	Pedido mal diligenciado	268
Anulación Factura Ventas grava	24	Pedido mal digitado	231
Devolución Mercancia ventas gr	24	Factura mal elaborada o retraso en envío	223
NC Obsequios	23	Obsequio	166
Devolución Mercancia ventas gr	24	Retraso en despacho	158
Devolución Mercancia ventas gr	24	Mercancia incompleta	132
Anulación Factura Ventas grava	30	Error de Transmisión en SAP	129
Devolución Mercancia ventas gr	24	Avería en transporte	127
Devolución Mercancia ventas gr	31	Error en codigo	102
Devolución Mercancia ventas gr	24	Pedido mal digitado	90
Anulación factura ventas de ex	24	Factura mal elaborada o retraso en envío	84
Reposicion exterior	27	Calidad- Imperfectos de fabrica	83
Anulación factura ventas de ex	23	Pedido mal diligenciado	83
Devolución Mercancia ventas gr	32	Pedido mal diligenciado COMEX	66
Anulación Factura Ventas grava	28	Incumplimiento en la negociacion	53
Devolución Mercancia ventas gr	31	INGENIERIA	51
Anulación factura ventas de ex	28	Errores clientes  administrativos o logísticos	49
Anulación Factura Ventas grava	23	Compromiso comercial Incumplido	48
Devolución Mercancia ventas gr	24	Adelanto en fecha  despacho	30
Anulación factura ventas de ex	30	Error de Transmisión en SAP	29
Anulación Factura Ventas grava	24	Inconsistencias  en documentos para radicar	28
Devolución Mercancia ventas gr	24	Retraso en transporte	28
NULL		NULL	24
Descuento no facturado	23	Descuento Exhibicion	23
Descuento no facturado	23	Obsequio	22
Anulación factura ventas de ex	32	Informacion erronea COMEX	21
Anulación Factura Ventas grava	24	Retraso en despacho	20
Perdida por siniestro	28	Errores clientes  administrativos o logísticos	19
Anulación Factura Ventas grava	25	Error en creación de cliente	18
Devolución Mercancia ventas gr	27	Calidad- Imperfectos de fabrica	17
Anulación factura ventas de ex	28	Cliente desiste de la compra	14
Devolución Mercancia ventas gr	23	Sobrante cliente	13
Anulación Factura Ventas grava	31	INGENIERIA	12
Anulación Factura Ventas grava	23	Muestra sin valor comercial	12
Devolución Mercancia ventas gr	28	Incumplimiento en la negociacion	11
Anulación Factura Ventas grava	24	Adelanto en fecha  despacho	11
Anulación Factura Ventas grava	28	Cliente desiste de la compra	9
Anulación factura ventas de ex	23	Compromiso comercial Incumplido	9
Anulación Factura Ventas grava	31	Error en codigo	8
Devolución mercancía de export	32	Pedido mal diligenciado COMEX	8
Devolución Mercancia ventas gr	32	Informacion erronea COMEX	8
Devolución Mercancia ventas gr	23	Compromiso comercial Incumplido	7
Devolución Mercancia ventas gr	24	Mercancia trocada	7
Anulación factura ventas de ex	24	Pedido mal digitado	6
Devolución Mercancia ventas gr	36	Adelanto de facturación	6
Anulación Factura Ventas grava	32	Pedido mal diligenciado COMEX	5
Devolución mercancía de export	23	Pedido mal diligenciado	5
Devolución Mercancia ventas gr	26	Retrasos en producción	4
Devolución Mercancia ventas gr	30	Error de Transmisión en SAP	4
Anulación Factura Ventas grava	30	Error de Transmisión en FACTURE (Proveedor Tecnológico)	4
Devolución mercancía ventas ex	28	Cliente desiste de la compra	4
Descuento no facturado	23	Compromiso comercial Incumplido	3
Anulación Factura Ventas grava	28	CLIENTE	2
Devolución Mercancia ventas gr	24	LOGISTICA	2
Descuento no facturado	35	Incumplimiento en fecha	2
Anulación Factura Ventas grava	31	Informacion erronea	2
Descuento no facturado		NULL	2
Devolución mercancía de export	23	Muestra sin valor comercial	2
NULL	30	Error de Transmisión en SAP	2
Devolución Mercancia ventas gr	28	CLIENTE	2
Anulación Factura Ventas grava	23	Sobrante cliente	2
Dscto no fact v excluidas	23	Pedido mal diligenciado	2
Descuento no facturado	27	Calidad- Imperfectos de fabrica	2
Devolución mercancía ventas ex	31	Informacion erronea	2
Descuento no facturado	26	Mal despacho	2
Descuento no facturado	28	Incumplimiento en la negociacion	2
Anulación Factura Ventas grava	35	Incumplimiento en fecha	1
Anulación fac otras v al ext	24	Factura mal elaborada o retraso en envío	1
Anulación factura ventas de ex	32	Pedido mal diligenciado COMEX	1
Devolución Mercancia ventas gr	29	Calidad- proveedor	1
Devolución Mercancia ventas gr		NULL	1
Descuento no facturado	24	Causa de fuerza mayor en el Transporte (Derrumbes, paro, pandemia, siniestro etc)	1
Anulación factura ventas de ex	27	Calidad- Imperfectos de fabrica	1
Descuento no facturado	34	Mala asesoria	1
Descuento no facturado	24	Avería en transporte	1



-- 2. ¿Planos_Symphony está en la misma instancia que Firplak_SA?
SELECT @@SERVERNAME AS Servidor, DB_ID('Planos_Symphony') AS IdPlanosSymphony;
```
Servidor	IdPlanosSymphony
ITPLAKINFO	8


**Validación del dueño de negocio:** Daniel Jimenez — 2026-10-27 — validado con las respuestas a las 10 preguntas.

## 2. Tabla de reporte y carga incremental

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_ventas`, **reutilizada** (decisión del desarrollador, 2026-10-27). No se crean tablas nuevas. |
| Grano (una fila por…) | Línea de documento: `TipoDocumento = 'Nota Crédito'` para las notas, `'Factura'` para el denominador |
| Clave | `Empresa` + `TipoDocumento` + `DocEntry` + `LineNum` |
| Fecha de referencia (filtros por periodo) | `FechaContabilizacion` |
| Estrategia incremental | La de `SP_Generar_Informe_Ventas`: documentos creados o modificados desde el día anterior (`CreateDate`/`UpdateDate`) |
| SP | `dbo.SP_Generar_Informe_Ventas` (existente, **no se modifica**) |
| Job y horario | `BI - Ventas carga incremental`: cada 15 min, de 6:00 a 20:00, todos los días. `BI - Ventas carga completa`: diaria a las 2:00. Cumple la frecuencia pedida. |
| Bitácora | `dbo.Cargas_Log` (existente) |
| Índices | Existentes y suficientes: `PK_Informe_ventas` (clustered: `Empresa`, `TipoDocumento`, `DocEntry`, `LineNum`), `IX_Informe_ventas_Fecha` (`FechaContabilizacion`) y `NCCI_Informe_ventas` (columnstore no agrupado, para agregaciones). No se proponen índices nuevos. |

**Decisión (2026-10-27):** no se modifican las reglas de `SP_Generar_Informe_Ventas`. Efecto sobre las decisiones del dueño de negocio:

| Decisión | Estado con `Informe_ventas` tal como está |
|---|---|
| 1. Excluir Donaciones en ambos lados | Se cumple en Firplak. Viventta no las excluye; se acepta |
| 2. Excluir `DocType = 'S'` y `VZNOPE-0021` en ambos lados | `VZNOPE-0021` se cumple. No hay facturas de servicio en `Informe_ventas` desde 2025-01-01 (consulta 2 sin filas), así que no hay efecto práctico |
| 3. Exclusiones manuales ampliables | Siguen fijas en el SP; una nueva exclusión requiere editarlo |
| Lista `VZNOPE` | Se adoptan los 21 códigos de `Informe_ventas` |

- **Factura 4316.** Explicada: su única línea es `VZNOPE-0028-000-0000`, que `Informe_ventas` excluye y la comparación no.
- **Concepto NC.** En 10.080 de 10.439 líneas de notas desde 2025, el concepto de la línea (`RIN1.U_CONCEPTOSNC`, el que usa `Informe_ventas`) difiere del concepto del encabezado (`ORIN.U_CONCEPTOSNC`, el que usa el BI). Diagnóstico (2026-10-27): **en `Informe_ventas`, 5.928 de 5.929 líneas de notas de Firplak desde 2025 no tienen concepto.** El concepto se registra en el encabezado (valores como `23-01`, `24-04`, `28-03`, `19`) y la línea viene `NULL`. Es un error de `SP_Generar_Informe_Ventas`: lee `T1.U_CONCEPTOSNC` en el `SELECT` y en el `JOIN` con `@FIR_CONCEPTOSNC`, cuando debería leer `T0.U_CONCEPTOSNC`. Sin esa corrección quedan vacíos la torta por departamento, las barras por concepto y los filtros de concepto y departamento. **Corregido el 2026-10-27** con la aprobación del desarrollador (Daniel Jimenez):

- **Cambio.** En `SP_Generar_Informe_Ventas`, sección de notas crédito de Firplak, se reemplazaron las 2 apariciones de `T1.U_CONCEPTOSNC` por `T0.U_CONCEPTOSNC` (en el `SELECT` y en el `JOIN` con `@FIR_CONCEPTOSNC`). Se hizo con Modify y buscar y reemplazar en SSMS.
- **Respaldo.** Script `CREATE` guardado por el desarrollador antes del cambio.
- **Rollback.** Ejecutar el respaldo como `ALTER PROCEDURE` y luego `EXEC dbo.SP_Generar_Informe_Ventas @Modo = 'COMPLETA';`.
- **Recarga.** Carga `COMPLETA` del 2026-10-27, de 15:32:33 a 15:33:06, con 260.204 filas y sin error. En `Cargas_Log` queda además una corrida `COMPLETA` iniciada a las 15:31:07 sin `Fin` ni `Error` (interrumpida). La siguiente la reemplazó.
- **Validación.** Las líneas de notas de Firplak sin concepto desde 2025 bajaron de 5.928 a 25 (las que tampoco tienen concepto en el encabezado). La facturación de enero a septiembre de 2026 es idéntica a la de antes del cambio. Octubre sube de 3.235.569.552,40 a 3.236.103.947,06 por documentos nuevos del mes en curso.

<details><summary>Propuesta anterior de tabla propia (descartada)</summary>

Propuesta de columnas (fase 1; el script es de la fase 2):

| Columna | Origen | Uso |
|---|---|---|
| `DocEntry`, `LineNum` | `ORIN.DocEntry`, `RIN1.LineNum` | Clave |
| `FechaContabilizacion` | `ORIN.DOCDATE` | Periodo (año y mes) |
| `NumDocumento` | `ORIN.DOCNUM` | Detalle, matriz por vendedor |
| `VendedorSenior`, `VendedorJunior` | Mismas reglas `CASE` del SQL original | Matriz por vendedor, filtro |
| `TipoVentas` | `ORIN.U_TipoVentas` | Filtro, detalle |
| `Territorio` | Misma regla `CASE` del original | Detalle |
| `SubgrupoCliente` | `[@FIR_SUBGRUPOCLIENTE].NAME` | Detalle |
| `CodCliente`, `NombreCliente` | `ORIN.CARDCODE`, `ORIN.CARDNAME` | Detalle, búsqueda |
| `CodigoTipoNC`, `TiposNC` | `ORIN.U_TIPOSNC`, `[@FIR_TIPOSNC].NAME` | Detalle |
| `TipoNCAgrupado` | `CASE` equivalente a `TIPO NC Agr.` | Matriz TIPO NC, filtro |
| `CodigoConceptoNC`, `ConceptoNC` | `ORIN.U_CONCEPTOSNC`, `[@FIR_CONCEPTOSNC].NAME` | Barras por concepto, filtro |
| `Departamento` | `CASE` sobre `LEFT(U_CONCEPTOSNC, 2)` | Torta, filtro |
| `Comentarios` | `ORIN.COMMENTS` | Detalle |
| `CodigoPuntoVenta`, `PuntoVenta` | `RIN1.U_TIENDAS`, `OCRD.CARDNAME` del punto | Detalle (decisión 10) |
| `Ciudad` | `RIN12.CityS` | Detalle (decisión 10) |
| `Telefono` | `OCRD.Phone1` del cliente | Detalle (decisión 10) |
| `Obra` | `OCPR.NAME` | Detalle (decisión 10) |
| `ValorNC` | `RIN1.LINETOTAL` (positivo) | Total NC |

El denominador (`Total Facturado`) necesita la facturación con las reglas de la consulta `Facturas`. Por las decisiones 1 y 2, las exclusiones de facturas cambian respecto del BI, y no hay evidencia de que `Informe_ventas` aplique esas reglas. Se decide en el plan de la fase 2.

</details>


#### ¿Sirve `Informe_ventas` como denominador? (2026-10-27)

Comparación mensual, ejecutada por el desarrollador, entre `Informe_ventas` (`TipoDocumento = 'Factura'`, sin Donaciones) y SAP con las reglas nuevas de facturas (últimos 12 meses):

| Mes | Líneas Informe_ventas | Líneas SAP | Total Informe_ventas | Total SAP | Diferencia |
|---|---|---|---|---|---|
| 2025-10 | 1386 | 1383 | 3.118.188.207,49 | 3.116.918.881,49 | 1.269.326,00 |
| 2025-11 | 3809 | 3793 | 6.020.147.389,31 | 6.029.263.110,08 | −9.115.720,77 |
| 2025-12 | 3520 | 3499 | 5.692.002.599,12 | 5.689.253.274,12 | 2.749.325,00 |
| 2026-01 | 3778 | 3746 | 5.410.366.143,28 | 5.404.676.062,28 | 5.690.081,00 |
| 2026-02 | 3743 | 3709 | 5.141.156.801,98 | 5.135.364.953,98 | 5.791.848,00 |
| 2026-03 | 3895 | 3836 | 5.747.650.707,50 | 5.735.280.492,50 | 12.370.215,00 |
| 2026-04 | 3637 | 3582 | 5.460.418.129,91 | 5.452.569.492,91 | 7.848.637,00 |
| 2026-05 | 3594 | 3537 | 5.397.033.578,63 | 5.388.677.708,63 | 8.355.870,00 |
| 2026-06 | 3591 | 3536 | 5.994.857.029,93 | 5.984.755.017,93 | 10.102.012,00 |
| 2026-07 | 4125 | 4061 | 6.555.970.165,07 | 6.549.142.620,07 | 6.827.545,00 |
| 2026-08 | 3339 | 3279 | 5.301.374.323,51 | 5.291.477.511,51 | 9.896.812,00 |
| 2026-09 | 3885 | 3813 | 5.904.873.181,19 | 5.892.705.739,19 | 12.167.442,00 |
| 2026-10 (parcial) | 2545 | 2504 | 3.235.569.552,40 | 3.231.485.442,40 | 4.084.110,00 |

Hallazgo: **no cuadra**. `Informe_ventas` tiene entre 3 y 72 líneas más por mes y un total mayor (0,02 %–0,22 %), salvo noviembre de 2025, donde es menor. Salvo noviembre, las diferencias son pesos enteros, lo que apunta a líneas completas que una fuente incluye y la otra no. Diagnóstico por documento (marzo de 2026 y noviembre de 2025, ejecutado por el desarrollador el 2026-10-27):

- **Sobran en `Informe_ventas`** documentos con `DOCNUM` bajo (20–40 y 136–192), de 1 o 2 líneas, entre 50.420 y 2.260.504 pesos cada uno. En `OINV` esos números corresponden a otros documentos: series 4 (2012), 5 (2013–2014) y 252/254 (febrero a junio de 2025), **ninguno con fecha en el mes comparado**. Es decir, `Informe_ventas` incluye como `Factura` documentos que no están en `OINV` con esa fecha. Según el desarrollador (2026-10-27), son documentos de **Viventta**, una compañía nueva del grupo Firplak que `Informe_ventas` ya incluye en facturas y en notas crédito. El Power BI de notas crédito solo lee `Firplak_SA` y no la incluye. La base de datos de Viventta está `pendiente` de confirmar.
- **Falta en `Informe_ventas`** la factura 4316 (serie 276, Exterior, 2025-11-19, 11.943.116,77). Explica la diferencia negativa de noviembre.
- `DocNum` se repite entre series de SAP: la clave de las tablas nuevas debe ser `DocEntry` (+ `LineNum`), nunca `DocNum`.

Decisiones (Daniel Jimenez, 2026-10-27):

- El dashboard **incluye Viventta**. Sus notas se leen de la base `DBViventta`. Está en la misma instancia `ITPLAKINFO` (`DB_ID('DBViventta') = 31`).
- Viventta no usa `U_TIPOSNC`, `U_CONCEPTOSNC` ni las tablas `@FIR_TIPOSNC`/`@FIR_CONCEPTOSNC`. Por su bajo volumen, sus notas quedan con tipo NC, concepto, departamento y tipo NC agrupado **en blanco**.
- Recarga completa semanal: domingo a las 2:00.

#### Cómo se carga `Informe_ventas` (definición compartida por el desarrollador, 2026-10-27)

`Planos_Symphony.dbo.SP_Generar_Informe_Ventas` (`@Modo` = `COMPLETA` | `INCREMENTAL`, `@DiasAtras` = 1), invocado por los jobs `BI - Ventas carga incremental` y `BI - Ventas carga completa`. Horario de los jobs: `pendiente`.

- **Columnas útiles para este BI.** Ya tiene `Empresa` (Firplak / Viventta), `TipoDocumento`, `DocEntry`, `LineNum`, `CodigoTipoNC`, `TiposNC`, `CodigoConceptoNC`, `ConceptosNotasCredito`, `Comentarios`, `SubgrupoCliente`, `Territorio`, vendedores, `Ciudad`, `Telefono`, `Obra` y punto de venta. Cubre todas las columnas que pide el dashboard, también las del detalle (decisión 10).
- **Incremental.** Recarga los documentos creados o modificados (`CreateDate`/`UpdateDate`) en los últimos `@DiasAtras` días, incluidas las anulaciones. Es más preciso que una ventana fija de 45 días. La carga completa trunca la tabla y recarga desde 2020-01-01.
- **Bitácora.** Ya existe: `dbo.Cargas_Log` (`Proceso`, `Modo`, `Inicio`, `Fin`, `Eliminados`, `Insertados`, `Error`). No hace falta crear `Bitacora_Cargas_Informes`.

Reglas frente a las decisiones del dueño de negocio:

| Regla | Facturas Firplak | NC Firplak | Facturas y NC Viventta | ¿Cumple las decisiones? |
|---|---|---|---|---|
| Excluir Donaciones (decisión 1) | Sí | Sí | No | Falta en Viventta |
| Excluir documentos de servicio, `DocType = 'S'` (decisión 2) | **No** | Sí | No | **Falta en facturas** |
| Artículos `VZNOPE` excluidos (decisión 2) | 21 códigos, incluye `0021` y además `0020`, `0022`–`0024`, `0026`, `0028`, `0029` | Los mismos 21 | Ninguno | Más amplio que el BI |
| Documentos excluidos a mano (decisión 3) | Fijos en una variable de tabla del SP | Ídem | — | No es ampliable sin editar el SP |
| Otras | — | — | Excluye el cliente `CN890927404-01` | — |
| Concepto NC | — | **Por línea** (`RIN1.U_CONCEPTOSNC`) | Vacío | El BI lo toma del encabezado (`ORIN.U_CONCEPTOSNC`) |
| Desde | 2020-01-01 | 2020-01-01 | 2020-01-01 | El BI no tenía fecha mínima |

- **Viventta en la comparación.** Explica los documentos de `DOCNUM` bajo que sobraban.
- **Factura 4316.** Hipótesis `pendiente`: tiene un artículo `VZNOPE` que `Informe_ventas` excluye y la consulta de comparación no.

Validación de totales (origen vs. tabla): ver la comparación mensual de `Informe_ventas` frente a SAP y la validación de la corrección del concepto, arriba. Las diferencias están explicadas: Viventta y la factura 4316 (`VZNOPE-0028`).

<!-- Tabla de la plantilla, no aplica al reutilizar Informe_ventas: -->

| Periodo | Filas origen | Filas tabla | Total origen | Total tabla |
|---|---|---|---|---|

## 3. Contrato del endpoint

`GET /api/v1/notas-credito`. Usa el mismo token, el mismo manejo de errores (502 sin detalles internos) y la misma forma de respuesta que `/api/v1/facturacion-diaria` ([`server.ts`](../../../reporting-api/src/server.ts)).

**Fuente.** `Informe_ventas`, mediante `reportSource()` y la variable existente `REPORT_DB_TABLE`. No hay variables de entorno nuevas.

- **Notas:** filas con `TipoDocumento = N'Nota Crédito'`.
- **Facturación (denominador):** filas con `TipoDocumento = N'Factura'`.
- **Compañías:** se suman Firplak y Viventta, sin filtro de empresa (decisión del 2026-10-27).

**Columnas calculadas en SQL**, iguales a las del BI:

- `departamento` = `CASE LEFT(CodigoConceptoNC, 2)`: 23 COMERCIAL, 24 LOGISTICA, 25 FINANCIERA, 26 PRODUCCIÓN, 27 CALIDAD, 28 CLIENTE, 29 COMPRAS, 30 T.I, 31 INGENIERIA, 32 COMEX, 33 MUESTRA. Cualquier otro valor da `NULL` (decisión 8).
- `tipoNcAgrupado` = `CASE LEFT(TiposNC, 10)`: "Devolución" da Devolución; "Anulación ", "Descuento ", "Dscto no f", "NC Obsequi", "Perdida po" y "Reposicion" dan Anulación; cualquier otro valor conserva `TiposNC` (decisión 6).
- **Valor de la nota:** `-ValorTotal`, que es positivo porque `Informe_ventas` guarda las notas en negativo. Equivale a la medida `Total NC`.

### Parámetros

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `page`, `pageSize` | entero | — | Paginación de `rows`, igual que en facturación |
| `anio`, `mes` | entero | `FechaContabilizacion` | Periodo. Aplica a notas y facturación |
| `fechaDesde`, `fechaHasta` | `AAAA-MM-DD` | `FechaContabilizacion` | Rango opcional. Aplica a notas y facturación |
| `tipoVentas` | texto | `TipoVentas` | Notas y facturación |
| `departamento` | texto | `departamento` (calculada) | Solo notas |
| `concepto` | texto | `ConceptosNotasCredito` | Solo notas |
| `tipoNc` | texto | `tipoNcAgrupado` (calculada) | Solo notas |
| `vendedorSenior` | texto | `VendedorSenior` | Notas y facturación |
| `search` | texto | `NombreCliente`, `CodCliente`, `DocNum`, `Comentarios` | Búsqueda libre. Solo notas |

Reglas de los filtros:

- Todos los filtros se aplican en SQL, con parámetros (`request.input`).
- La **facturación se filtra por periodo, tipo de venta y vendedor senior** (decisión 4, cambiada el 2026-10-27). Departamento, concepto, tipo NC y búsqueda solo afectan a las notas.
- Los catálogos de `filterOptions` usan solo el periodo, para que las listas no se reduzcan al elegir un filtro.

### Respuesta

```json
{
  "rows": [
    {
      "id": "Firplak-123456-0",
      "date": "2026-10-20",
      "docnum": "1006232",
      "customerCode": "C900123456",
      "customer": "Cliente S.A.S.",
      "customerSubgroup": "Distribuidor",
      "territory": "Antioquia",
      "salesType": "Nacional",
      "seniorSeller": "Vendedor",
      "juniorSeller": "Vendedor junior",
      "creditType": "Devolución Mercancia ventas gr",
      "creditTypeGroup": "Devolución",
      "conceptCode": "23-01",
      "concept": "Pedido mal diligenciado",
      "department": "COMERCIAL",
      "comments": "Texto de ORIN.Comments",
      "city": "Medellín",
      "phone": "6040000000",
      "project": "Obra",
      "storeCode": "",
      "storeName": "",
      "creditNote": 1250000
    }
  ],
  "years": [2026, 2025],
  "pagination": { "page": 1, "pageSize": 50, "total": 0, "totalPages": 0 },
  "summary": {
    "creditNotes": 0,
    "invoiced": 0,
    "net": 0,
    "creditNoteRate": 0.0,
    "target": 0.03,
    "monthly": [
      { "year": 2026, "month": 1, "invoiced": 0, "creditNotes": 0, "net": 0, "creditNoteRate": 0.0, "previousYearRate": 0.0 }
    ],
    "departments": [{ "name": "COMERCIAL", "creditNotes": 0 }],
    "concepts": [{ "name": "Pedido mal diligenciado", "creditNotes": 0, "rate": 0.0 }],
    "creditTypeGroups": [{ "name": "Devolución", "creditNotes": 0 }],
    "sellers": [{ "seniorSeller": "Vendedor", "juniorSeller": "Vendedor junior", "docnum": "1006232", "creditNotes": 0 }]
  },
  "filterOptions": {
    "salesTypes": [],
    "departments": [],
    "concepts": [],
    "creditTypeGroups": [],
    "seniorSellers": []
  },
  "source": "sql-server",
  "updatedAt": "2026-10-27T20:00:00.000Z"
}
```

Los valores del ejemplo son ilustrativos; el endpoint solo devuelve datos reales.

Reglas de cada campo:

| Campo | Regla | Medida o visual del BI |
|---|---|---|
| `rows` | Una fila por combinación de documento (`Empresa` + `DocEntry`) y sus columnas descriptivas, con la suma de `creditNote`, como la tabla de DETALLE. Orden: fecha y documento descendentes. Paginada. | Tabla DETALLE + decisión 10 |
| `summary.creditNotes` | Suma del valor de las notas filtradas | `Total NC` (tarjetas) |
| `summary.invoiced` | Suma de `ValorTotal` de las facturas del periodo | `Total Facturado` |
| `summary.net` | `invoiced - creditNotes` | `Total Ventas` |
| `summary.creditNoteRate` | `creditNotes / invoiced`; `null` si `invoiced = 0` | `% Sobre el total` |
| `summary.target` | Constante `0.03` en la API | `Meta` (decisión 5) |
| `summary.monthly` | Por mes del periodo: `invoiced`, `creditNotes`, `net` y `creditNoteRate`. `previousYearRate` es el mismo % del mismo mes del año anterior, con los mismos filtros de notas; `null` si no hay datos | Las dos líneas de INDICADOR NC (`A.A % Sobre el total`). El frontend no dibuja el % de los meses con `creditNoteRate` en 0 o `null`, como el filtro `> 0` del visual |
| `summary.departments` | Notas por departamento, de mayor a menor. `name: null` es "Vacío" | Torta de PARETO |
| `summary.concepts` | Notas por concepto y su `rate = creditNotes / invoiced` del periodo | Barras CONCEPTO NOTAS CRÉDITO |
| `summary.creditTypeGroups` | Notas por tipo NC agrupado, **solo con `TipoVentas` Exterior, Nacional o vacío** (decisión 7). Su total puede diferir de `creditNotes` | Matriz TIPO NC |
| `summary.sellers` | Notas por vendedor senior, vendedor junior y documento. El frontend arma la jerarquía | Matriz por vendedor de INDICADOR NC |
| `filterOptions` | Valores distintos y no vacíos de cada filtro, en las notas del periodo | Segmentadores |
| `years` | Años con notas crédito | Segmentador Año |
| `updatedAt` | Hora de la respuesta, igual que en facturación | — |

No se incluyen: `Total notas` (sin uso), la tabla `ÁREA` (decisión 9) ni la compañía.

**Aprobación del contrato:** Daniel Jimenez — 2026-10-27 — aprobado.

## 4. Endpoint

- Rama `bi/notas-credito` en `reporting-api` (desde `main` en `f69963b`), sin commit todavía.
- Archivos tocados en `reporting-api`: `src/types.ts` (`CreditNoteFilters`, `CreditNoteRow`, `CreditNoteSummary`, `CreditNoteFilterOptions`, `CreditNoteApiResponse`), `src/db.ts` (`getCreditNoteReport`), `src/server.ts` (ruta `/api/v1/notas-credito` y `creditNoteFiltersFrom`) y `README.md`.
- Variables nuevas en `.env.example`: ninguna; usa `REPORT_DB_TABLE`.
- Lote SQL: crea `#notes` (periodo actual y mismo periodo del año anterior), `#invoices` y `#documents`, y devuelve 14 recordsets: 0 página, 1 total, 2 totales, 3 serie mensual, 4 departamentos, 5 conceptos, 6 tipos NC agrupados, 7 vendedores, 8 años y 9 a 13 catálogos.
- `npm run build`: sin errores (2026-10-27).
- **Despliegue en el servidor (2026-10-27, desarrollador).** Copió el `dist` nuevo en `C:\Apps\reporting-api` y el proceso de Node arrancó a las 15:59. La API escucha en `127.0.0.1:8090` (`PORT=8090` en el `.env` del servidor); el puerto 8080 es de otra aplicación del servidor. Rollback: restaurar el `dist` anterior y reiniciar el servicio (respaldo `pendiente` de confirmar).
- **Prueba contra la base (2026-10-27),** `anio=2026&mes=9`: HTTP 200 `application/json`.
  - `creditNotes` = 796.683.781,95; `invoiced` = 5.904.873.181,19 (igual al total de facturas de septiembre en `Informe_ventas`); `creditNoteRate` = 13,49 %; `target` = 0,03.
  - Departamentos: CLIENTE 544.999.800,82; LOGISTICA 132.483.427,76; COMERCIAL 117.627.282,67; INGENIERIA 865.051; vacío 447.578; CALIDAD 260.641,7. La suma coincide con `creditNotes`.
  - Filas con concepto y departamento llenos.
  - `pendiente`: confirmar `creditNotes` con la consulta directa en SSMS.

## 5. Dashboard

- Ruta: `/notas-credito`
- Proxy: `app/api/notas-credito/route.ts`
- Página: [`app/notas-credito/page.tsx`](../../app/notas-credito/page.tsx) → [`components/NotasCreditoDashboard.tsx`](../../components/NotasCreditoDashboard.tsx). Tipos: [`lib/notas-credito/types.ts`](../../lib/notas-credito/types.ts). Estilos: [`app/styles/credit-notes.css`](../../app/styles/credit-notes.css).
- Componentes reutilizados: `DashboardShell`, `MetricCard`/`MetricSkeleton`, `FilterSelect`, `TablePager` y `lib/dashboard/*`, extraídos de facturación con aprobación del desarrollador (2026-10-27).
- Acceso: tarjeta en el portal (`app/page.tsx`). El menú lateral del reporte solo muestra "Notas crédito" y "Detalle de notas crédito" (`/notas-credito/detalle`, [`page.tsx`](../../app/notas-credito/detalle/page.tsx)). La vista principal no incluye la tabla de documentos; el detalle muestra filtros, tabla y panel lateral.
- Contenido:
  - Filtros en borrador (año, mes, búsqueda; avanzados: tipo de venta, departamento, concepto, tipo NC y vendedor), aplicados con botón, lupa o Enter. Por defecto, el año en curso completo.
  - KPIs: notas crédito, facturación, ventas netas y % sobre la facturación frente a la meta.
  - Gráficos: facturado y notas por mes; % mensual frente a la meta y al año anterior (los meses sin % no se dibujan).
  - Distribuciones por departamento ("Vacío" incluido) y por tipo NC (con la nota del filtro Exterior / Nacional / vacío).
  - Conceptos (8 visibles; botón "Ver los N conceptos"), vendedores expandibles a vendedor junior y documentos, y detalle paginado con panel lateral (incluye ciudad, teléfono, obra y punto de venta).
- Gráficos:
  - Una sola escala por gráfico: el % va aparte de los valores en pesos.
  - Líneas rectas sin animación.
  - La segunda serie es punteada y la meta, de puntos, para no depender solo del color.
  - La paleta navy/sage pasa la separación para daltonismo (ΔE 25,7) y el contraste. No cumple la banda de luminosidad y croma del validador de la skill `dataviz`; se acepta porque es la paleta de marca y se compensa con el trazo distinto.
- `npm run lint` y `npm run build` sin errores (2026-10-27).
- Revisión visual (375 / 820 / 1440 px): 2026-10-27, en una copia temporal sin middleware y con una API simulada con **datos ficticios**, borrada al terminar. Correcta en los tres anchos. Facturación conserva su estructura después de la extracción.
- `pendiente`:
  - Prueba con sesión real y datos reales: cambiar filtros y comprobar los KPIs y la URL del proxy en la pestaña Red.
  - Comprobar que IIS reenvíe `/api/v1/notas-credito`.
  - Prueba con sesión real y datos reales: validada por el desarrollador el 2026-10-27.

## 6. Conciliación con Power BI

El dueño de negocio contrastó las cifras del dashboard con el Power BI y las dio por conciliadas el 2026-10-28. Los valores por indicador y periodo no se registraron en el repositorio.

Las diferencias esperadas, ya explicadas en la ficha, son:

- Viventta incluida (el Power BI solo leía `Firplak_SA`).
- Donaciones excluidas también en las notas (decisión 1).
- Los 21 artículos `VZNOPE` de `Informe_ventas`, que excluyen, por ejemplo, la factura 4316.
- El concepto NC leído del encabezado después de la corrección de `SP_Generar_Informe_Ventas`.
- Tipo de venta y vendedor también filtran la facturación (decisión 4, cambiada).

**Firma del dueño de negocio:** Daniel Jimenez — 2026-10-28 — conciliado.

## 7. Despliegue y retiro

- API desplegada: `dist` de la rama `bi/notas-credito-2` en `C:\Apps\reporting-api`, 2026-10-27 (ver sección 4).
- Frontend: unido a `main` (dashboard: PR #1, merge `540abfb`; permisos por informe: PR #5, merge `6a02bc2`). Desplegado en Vercel el 2026-10-28.
- Documentación en VibeWorkFlow: flujo estándar "Consulta del indicador de notas crédito", entorno FIRPLAK, área Tecnología, id `35bad5f7-8628-4bb1-9af3-4da057d07722`, creado el 2026-10-28.
  - Cuatro `accion` encadenadas, con su documento: registro en SAP, carga en `Informe_ventas`, endpoint de la API y dashboard.
  - Responsables por rol: área de Cartera, desarrollador del portal de Indicadores y dueño de negocio del indicador.
  - KPI: % de notas crédito sobre la facturación (meta 3 %).
  - Revisado por el desarrollador en VibeWorkFlow el 2026-10-28.
- Power BI: retiro programado para el 2026-11-06. Hasta esa fecha queda en paralelo como respaldo para Cartera.
- Rollback:
  - API: restaurar el `dist` anterior en `C:\Apps\reporting-api` y reiniciar el servicio.
  - Frontend: revertir el merge en `main` y dejar que Vercel redespliegue.
  - SP: ejecutar el respaldo de `SP_Generar_Informe_Ventas` como `ALTER PROCEDURE` y hacer una carga `COMPLETA` (ver sección 2).
  - Mientras el Power BI no se retire, sigue disponible como respaldo para Cartera.
