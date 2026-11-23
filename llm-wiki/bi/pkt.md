---
status: en-migracion
fase: 7
updated: 2026-11-23
sources:
  - ../../bi-origen/PKT/
---

# BI: PKT

## 0. Inventario

| Campo | Valor |
|---|---|
| Nombre en Power BI | `PKT v4.1 1` ([proyecto .pbip](../../bi-origen/PKT/PKT%20v4.1%201.pbip)) |
| Dueño de negocio (valida las cifras) | Dirección Financiera (Claudia Duque) |
| Desarrollador responsable | Daniel Jimenez |
| Usuarios y frecuencia de uso | direccionfinanciera@firplak.com; una vez al día, a las 2:00 p. m. |
| Prioridad | Baja |
| Rama | `bi/pkt` |

## 1. Análisis

Analizado el 2026-11-13 a partir del proyecto [`PKT v4.1 1.pbip`](../../bi-origen/PKT/PKT%20v4.1%201.pbip): modelo en [`definition/`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/) y visuales en [`definition/pages/`](../../bi-origen/PKT/PKT%20v4.1%201.Report/definition/pages/). Sin validación con datos todavía: ver [Consultas de validación](#consultas-de-validación-para-el-desarrollador).

Alcance: páginas "General" y "Graficas". La página "Duplicado de General" se descarta por decisión del desarrollador (2026-11-13).

**Qué mide el BI.** PKT (productividad del capital de trabajo) = KTNO ÷ ventas proyectadas del año. El KTNO (capital de trabajo neto operativo) se arma con saldos contables de fin de mes de SAP (activos operativos más pasivos operativos, que en SAP tienen saldo negativo). Las ventas proyectadas anualizan las ventas acumuladas del año. Todo se compara contra el cierre de diciembre del año anterior.

### Fuentes de datos

| Tabla del modelo | Tipo de fuente | Origen (base.esquema.objeto o archivo) | Observaciones |
|---|---|---|---|
| `CapitalTrabajo` | `Sql.Database` (import), 7 consultas anexadas | `ITPLAKINFO`, base `Firplak_SA` (SAP B1): `OACT`, `JDT1`, `OJDT` | Balance de prueba mensual: una fila por cuenta (nivel 5) y por cada nivel superior (1 a 4) y por mes, con `Saldo Inicial`, `Débito`, `Crédito`, `Saldo del Mes`, `Saldo Final` y `Fecha` (último día del mes). Una consulta para el año en curso (enero hasta el mes actual) y una por año fijo: `Cap_Trab_2020` … `Cap_Trab_2025` ([`expressions.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/expressions.tmdl)). Las siete consultas son idénticas salvo `@Year` y la fecha final. |
| `InformeVentas` | `Sql.Database` (import), dos consultas anexadas | `ITPLAKINFO`, base `Firplak_SA`: `OINV`+`INV1`+`INV12` (`Facturas`) y `ORIN`+`RIN1`+`RIN12` (`NotasCredito`), con maestros | Una fila por línea de factura o nota crédito, sin filtro de fecha (toda la historia). Las notas vienen negadas (`LINETOTAL * -1`). Solo lee Firplak, no Viventta. El PKT solo usa `Valor Total` y `Fecha contabilización`. |
| `CostosPTNivel1` (se combina en `InformeVentas`) | `Sql.Database` (import) | `ITPLAKINFO`, `Planos_Symphony.dbo.CostosGlobal` (`Nivel = 1`) | Solo agrega columnas de costo. No interviene en el PKT, pero el cruce puede duplicar líneas de venta (ver riesgos). |
| `Calendario` | Tabla calculada DAX | `CALENDAR("01/01/2020", 31/12/<año actual>)`, con `NroMes = MONTH(Fecha)` | Se relaciona con `CapitalTrabajo[Fecha]` e `InformeVentas[Fecha contabilización]`. |
| `NombresMedidas` | Datos escritos a mano en Power BI | 14 filas `Nivel 1` / `Nivel 2` (ver la matriz en [Visuales](#visuales-y-filtros)) | Solo sirve para las filas de la matriz de la página General. |
| `Capital de Trabajo`, `Proveedores de bienes y servicios`, `KTNO`, `PKT`, `Ventas` | Tablas vacías | — | Solo contienen medidas. |
| `LocalDateTable_*`, `DateTableTemplate_*` | Automáticas de Power BI | — | Jerarquía Año/Mes. No se migran. |

No hay fuentes de Excel, SharePoint ni carpetas. Todo sale de `ITPLAKINFO`, la misma instancia de `Planos_Symphony`, así que el SP puede leer `Firplak_SA.dbo.<tabla>` con nombres de tres partes (como en [Notas crédito](notas-credito.md)).

<details><summary>SQL original de <code>CapitalTrabajo</code> (año en curso)</summary>

Las consultas `Cap_Trab_<año>` son iguales, con `Set @Year = '<año>'`, `@FecFin = '31/12/<año>'` y los ciclos hasta el mes 12 en lugar de `MONTH(GETDATE())`.

```sql
IF OBJECT_ID('tempdb..#T') IS NOT NULL
BEGIN
DROP TABLE #T
END

Declare
@FecIni as date,
@FecFin as date,
@Year as nvarchar(4),
@Mes as nvarchar(2)

Set @Mes = 1
Set @Year = YEAR(GETDATE())

Set @FecIni = '01/01/' + @Year
Set @FecFin = Getdate()
Create Table #T
(
Lvl1 nvarchar(16) Collate SQL_Latin1_General_CP850_CI_AS,
Lvl2 nvarchar(2) Collate SQL_Latin1_General_CP850_CI_AS,
Lvl3 nvarchar(4) Collate SQL_Latin1_General_CP850_CI_AS,
Lvl4 nvarchar(6) Collate SQL_Latin1_General_CP850_CI_AS,
Account nvarchar(8) Collate SQL_Latin1_General_CP850_CI_AS,
AcctName nvarchar(100) Collate SQL_Latin1_General_CP850_CI_AS,
[Saldo Inicial] numeric(18,2),
Débito numeric(18,2),
Crédito numeric(18,2),
[Saldo del Mes] numeric(18,2),
Mes nvarchar(22) Collate SQL_Latin1_General_CP850_CI_AS
)
Carga_CuentasxMes:
Insert Into #T (Lvl1,Lvl2,Lvl3,Lvl4,Account,AcctName,[Saldo Inicial],Débito,Crédito,[Saldo del Mes],Mes)
Select
SUBSTRING(TA.AcctCode,1,1)+REPLICATE(0,14) Lvl1,
SUBSTRING(TA.AcctCode,1,2) Lvl2,
SUBSTRING(TA.AcctCode,1,4) Lvl3,
SUBSTRING(TA.AcctCode,1,6) Lvl4,
TA.AcctCode,
TA.AcctName,
0,
0,
0,
0,
@Mes
from
OACT TA
Where
TA.Levels = 5
AND TA.Postable = 'Y'
AND LEN(TA.AcctCode)=8
Order By TA.AcctCode ASC
IF @Mes <> (Select MONTH(getdate()))
BEGIN set @Mes = @Mes+1 GOTO Carga_CuentasxMes
END
Declare
@Acct as nvarchar(14),
@Vlr as numeric(18,2),
@Dbt as numeric(18,2),
@Crt as numeric(18,2),
@SldM as numeric(18,2),
@MesR as nvarchar(2)

Declare CMov CURSOR FOR
select
TB.Account,
isnull(sum(TB.Debit),0),
isnull(sum(TB.Credit),0),
isnull((SUM(TB.Debit-Credit)),0),
MONTH(TB.RefDate) Mes
from
JDT1 TB Inner Join
OJDT TA on TB.TransId = TA.TransId Inner Join
OACT TC on TB.Account = TC.AcctCode
Where
TB.RefDate >=@FecIni
and TB.RefDate <=@FecFin
AND (TA.U_HBT_AreVal = 'Comun' or TA.U_HBT_AreVal = '' or TA.U_HBT_AreVal = 'IFRS' or TA.U_HBT_AreVal is null)
Group By
TB.Account,
TC.AcctName,
MONTH(TB.RefDate)
Order By TB.Account ASC
OPEN CMov
FETCH CMov INTO @Acct,@Dbt,@Crt,@SldM,@MesR
WHILE (@@FETCH_STATUS=0)
BEGIN
UPDATE #T SET Débito=@Dbt, Crédito=@Crt, [Saldo del Mes]=@SldM WHERE Account=@Acct and Mes=@MesR
FETCH CMov INTO @Acct,@Dbt,@Crt,@SldM,@MesR
END
CLOSE CMov
DEALLOCATE CMov

Set @Mes=1
Carga_SI:
DECLARE cSI CURSOR FOR
Select
TA.Account,
Isnull(SUM(TA.Debit-TA.Credit),0),
@Mes
from
JDT1 TA 
Inner Join OJDT TB on TA.TransId = TB.TransId
Where
TA.RefDate < '01/' + @Mes +'/' + @Year
AND (TB.U_HBT_AreVal = 'Comun' or TB.U_HBT_AreVal = '' or TB.U_HBT_AreVal = 'IFRS' or TB.U_HBT_AreVal is null)
Group By
TA.Account
OPEN cSI
FETCH cSI INTO @Acct,@Vlr,@Mes
WHILE (@@FETCH_STATUS=0)
BEGIN
UPDATE #T SET [Saldo Inicial] = @Vlr WHERE Account=@Acct and Mes=@Mes
FETCH cSI INTO @Acct,@Vlr,@Mes
END
CLOSE cSI
DEALLOCATE cSI
IF @Mes <> (Select MONTH(getdate()))
BEGIN set @Mes = @Mes+1 GOTO Carga_SI
END

Select --Nivel 5
Lvl1,
Lvl2,
Lvl3,
Lvl4,
Account,
AcctName,
[Saldo Inicial],
Débito,
Crédito,
[Saldo del Mes],
[Saldo Inicial]+[Saldo del Mes] 'Saldo Final',
Case
 When
 Mes <> 12 Then Dateadd(Day,-1,'01/' + convert(nvarchar(2),(Mes+1)) + '/' + @Year)
           Else '31/12/' + @Year
End Fecha,
Mes
from #T
Union --Nivel 4
Select
Lvl1 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl2 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl3 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl4 Collate SQL_Latin1_General_CP850_CI_AS,
Null,
TA.AcctName Collate SQL_Latin1_General_CP850_CI_AS,
SUM([Saldo Inicial]),
SUM(Débito),
SUM(Crédito),
SUM([Saldo del Mes]),
SUM([Saldo Inicial]+[Saldo del Mes]) 'Saldo Final',
Case
 When
 Mes <> 12 Then Dateadd(Day,-1,'01/' + convert(nvarchar(2),(Mes+1)) + '/' + @Year)
           Else '31/12/' + @Year
End Fecha,
Mes Collate SQL_Latin1_General_CP850_CI_AS
From
#T Inner Join
OACT TA on #T.Lvl4 = TA.AcctCode Collate SQL_Latin1_General_CP850_CI_AS
Group By
Lvl1,
Lvl2,
Lvl3,
Lvl4,
TA.AcctName,
Mes
--Order By Lvl4,Fecha,Account Asc
Union --Nivel 3
Select
Lvl1 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl2 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl3 Collate SQL_Latin1_General_CP850_CI_AS,
Null,
Null,
TA.AcctName Collate SQL_Latin1_General_CP850_CI_AS,
SUM([Saldo Inicial]),
SUM(Débito),
SUM(Crédito),
SUM([Saldo del Mes]),
SUM([Saldo Inicial]+[Saldo del Mes]) 'Saldo Final',
Case
 When
 Mes <> 12 Then Dateadd(Day,-1,'01/' + convert(nvarchar(2),(Mes+1)) + '/' + @Year)
           Else '31/12/' + @Year
End Fecha,
Mes Collate SQL_Latin1_General_CP850_CI_AS
From
#T Inner Join
OACT TA on #T.Lvl3 = TA.AcctCode Collate SQL_Latin1_General_CP850_CI_AS
Group By
Lvl1,
Lvl2,
Lvl3,
TA.AcctName,
Mes
--Order By fecha,Lvl3,Lvl4,Account Asc
Union --Nivel 2
Select
Lvl1 Collate SQL_Latin1_General_CP850_CI_AS,
Lvl2 Collate SQL_Latin1_General_CP850_CI_AS,
Null,
Null,
Null,
TA.AcctName Collate SQL_Latin1_General_CP850_CI_AS,
SUM([Saldo Inicial]),
SUM(Débito),
SUM(Crédito),
SUM([Saldo del Mes]),
SUM([Saldo Inicial]+[Saldo del Mes]) 'Saldo Final',
Case
 When
 Mes <> 12 Then Dateadd(Day,-1,'01/' + convert(nvarchar(2),(Mes+1)) + '/' + @Year)
           Else '31/12/' + @Year
End Fecha,
Mes Collate SQL_Latin1_General_CP850_CI_AS
From
#T Inner Join
OACT TA on #T.Lvl2 = TA.AcctCode Collate SQL_Latin1_General_CP850_CI_AS
Group By
Lvl1,
Lvl2,
TA.AcctName,
Mes
--Order By Fecha,Lvl2,Lvl3,Lvl4,Account Asc
Union --Nivel 1
Select
Lvl1 Collate SQL_Latin1_General_CP850_CI_AS,
Null,
Null,
Null,
Null,
TA.AcctName Collate SQL_Latin1_General_CP850_CI_AS,
SUM([Saldo Inicial]),
SUM(Débito),
SUM(Crédito),
SUM([Saldo del Mes]),
SUM([Saldo Inicial]+[Saldo del Mes]) 'Saldo Final',
Case
 When
 Mes <> 12 Then Dateadd(Day,-1,'01/' + convert(nvarchar(2),(Mes+1)) + '/' + @Year)
           Else '31/12/' + @Year
End Fecha,
Mes Collate SQL_Latin1_General_CP850_CI_AS
From
#T Inner Join
OACT TA on #T.Lvl1 = TA.AcctCode Collate SQL_Latin1_General_CP850_CI_AS
Group By
Lvl1,
TA.AcctName,
Mes
Order By Fecha,Lvl1,Lvl2,Lvl3,Lvl4,Account Asc
Drop Table #T
```

</details>

<details><summary>SQL original de <code>Facturas</code> y <code>NotasCredito</code> (las dos partes de <code>InformeVentas</code>)</summary>

Las columnas que no usa el PKT se omiten; la consulta completa está en [`expressions.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/expressions.tmdl). Los joins con `INNER JOIN` sí se conservan porque descartan filas.

```sql
-- Facturas
SELECT T0.DOCDATE, T0.DOCNUM, T1.ITEMCODE, T1.LINETOTAL 'Valor Total' -- (más columnas descriptivas)
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
     'VZNOPE-0014-000-0000', 'VZNOPE-0015-000-0000', 'VZNOPE-0017-000-0000', 'VZNOPE-0018-000-0000', 'VZNOPE-0021-000-0000', 
     'VZNOPE-0023-000-0000', 'VZNOPE-0024-000-0000')
     AND T0.DocNum NOT IN (96491, 96492, 96493, 96494, 96495, 96496, 96497, 96515, 96516) --Se retira estas facturas por solicitud de Claudia Duque

-- NotasCredito
SELECT T0.DOCDATE, T0.DOCNUM, T1.ITEMCODE, T1.LINETOTAL * -1 'Valor Total' -- (más columnas descriptivas)
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
     LEFT JOIN [@FIR_CONCEPTOSNC] T31 ON T1.U_CONCEPTOSNC = T31.CODE
     LEFT JOIN [dbo].[@FIR_SEGMENTACION]  T17 ON T0.[U_Segmentacion] = T17.[Code]
WHERE T0.SERIES <> '88'
     AND T1.TAXONLY = 'N'
     AND T1.LINETOTAL <> 0
     AND T0.CANCELED = 'N'
     And t0.DocType <>'S'
     AND T0.U_TipoVentas <> 'Donaciones'
     AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000', 'VZNOPE-0001-000-0000', 'VZNOPE-0004-000-0000', 'VZNOPE-0006-000-0000', 
     'VZNOPE-0007-000-0000', 'VZNOPE-0008-000-0000', 'VZNOPE-0009-000-0000', 'VZNOPE-0010-000-0000', 'VZNOPE-0012-000-0000', 
     'VZNOPE-0014-000-0000', 'VZNOPE-0015-000-0000', 'VZNOPE-0017-000-0000', 'VZNOPE-0018-000-0000', 'VZNOPE-0021-000-0000', 
     'VZNOPE-0023-000-0000', 'VZNOPE-0024-000-0000')
     AND T0.DocNum <> 1002414 --Se retira esta NC por solicitud de Claudia Duque

-- CostosPTNivel1
Select t0.Codigo 'Codigo Articulo', t0.Descripcion, t0.Nivel, t0.Cantidad, t0.Costo_Unitario,
       t0.Costo_Mp, t0.Costo_Mo, t0.Costo_Cif, t0.Costo_Total
From Planos_Symphony.dbo.CostosGlobal t0
where nivel = 1
Order By t0.linea
```

Frente al BI de [Notas crédito](notas-credito.md#diferencias-entre-las-dos-consultas), aquí las dos consultas excluyen Donaciones y los mismos 16 artículos `VZNOPE` (incluye `0021`, `0023` y `0024`). Siguen distintas en: `DocType <> 'S'` solo en notas, y `@FIR_SUBGRUPOCLIENTE` y zona padre con `INNER JOIN` solo en facturas.

</details>

### Transformaciones (Power Query M)

| Tabla | Paso | Qué hace | ¿Pasa al SP? |
|---|---|---|---|
| `CapitalTrabajo` | `Consulta anexada` | Une el año en curso con `Cap_Trab_2020` … `Cap_Trab_2025` | Sí: el SP calcula todos los meses desde 2020 sin consultas por año |
| `CapitalTrabajo` | `Valor reemplazado` … `Valor reemplazado8` | Cambia `Lvl1` de `100000000000000` a `1` (y así hasta `9`) | No hace falta: el SP guarda el primer dígito de la cuenta |
| `CapitalTrabajo` | Tipos | `Lvl1` a `Lvl4` y `Account` pasan a entero; `Fecha` a fecha | Sí, como tipos de columna |
| `CapitalTrabajo` | Columnas calculadas `Agrupacion` y `Agrupacion 2` | Clasifican cuentas en conceptos | **No**: ningún visual las usa y sus reglas no coinciden con las medidas (ver riesgos) |
| `InformeVentas` | `Origen` | Une `NotasCredito` y `Facturas` | Sí |
| `InformeVentas` | `Merged Queries` / `Merged Queries1` | Cruza dos veces con `CostosPTNivel1` por `Codigo Articulo` (`LEFT JOIN`) y expande `Costo_Mp`, `Costo_Mo`, `Costo_Cif` | No para el PKT. Ojo: si `CostosGlobal` tiene códigos repetidos en nivel 1, duplica líneas y **infla las ventas** (consulta V1) |
| `InformeVentas` | Columnas de costo y contribución | `C MP`, `Costo MP`, `Costo Totalmente Variable`, `Contribución bruta` | No: el PKT no las usa |
| `InformeVentas` | `Valor reemplazado` … `2` | En `Subgrupo de Cliente`: "Autoservicio" → "Autoservicio Nacional", "Mayoristas" → "Mayoristas Nacional", "otros" → "Ventas Especiales" | No: el PKT no usa el subgrupo |

### Relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `CapitalTrabajo[Fecha]` | `Calendario[Fecha]` | Muchos a uno | Una (el calendario filtra) |
| `InformeVentas[Fecha contabilización]` | `Calendario[Fecha]` | Muchos a uno | Una (el calendario filtra) |
| `Calendario[Fecha]`, `InformeVentas[Fecha Fin Novedad]` | `LocalDateTable_*` | Automáticas | No se migran |

Para el portal no hacen falta uniones: el SP deja saldos y ventas ya por mes.

### Indicadores (medidas DAX)

Notación. `S(x)` es `CALCULATE(MAX(CapitalTrabajo[Saldo Final]), x)`: el saldo de fin de mes de una cuenta o de un nivel de la jerarquía, con el mes elegido. "Nivel 3 = 1355" es la fila agregada de todas las cuentas que empiezan por 1355 (`Lvl3 = 1355, ISBLANK(Lvl4)`). Saldo = débitos − créditos acumulados hasta el fin de mes (los pasivos son negativos).

**Capital de trabajo** ([`Capital de Trabajo.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/tables/Capital%20de%20Trabajo.tmdl))

| Indicador | Regla de negocio | DAX original | Vivirá en |
|---|---|---|---|
| Clientes | Saldo de las cuentas 13050505 + 13051005 + 13051010 | `S(Account = 13050505) + S(Account = 13051005) + S(Account = 13051010)` | SP |
| Anticipos de impuestos o saldos a favor | Saldo del nivel 1355 | `S(Lvl3 = 1355, ISBLANK(Lvl4))` | SP |
| Inventarios | Saldo del nivel 14 | `S(Lvl2 = 14, ISBLANK(Lvl3))` | SP |
| Otras cuentas por cobrar operativas | Nivel 1330 menos la cuenta 13300515, más el nivel 1365 | `(S(Lvl3 = 1330, ISBLANK(Lvl4)) - S(Account = 13300515)) + S(Lvl3 = 1365, ISBLANK(Lvl4))` | SP |
| Provisión (Deterioro) CxC (Vr. negativo) | Cuentas 13050590 + 13051090 más el nivel 139905 | `S(Account = 13050590) + S(Account = 13051090) + S(Lvl4 = 139905, ISBLANK(Account))` | SP |
| **Capital Trabajo** | Suma de los cinco conceptos anteriores | `[Anticipos…] + [Clientes] + [Inventarios] + [Otras cuentas por cobrar operativas] + [Provisión…]` | Summary API |

**Proveedores de bienes y servicios (PBS)** ([`Proveedores de bienes y servicios.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/tables/Proveedores%20de%20bienes%20y%20servicios.tmdl))

| Indicador | Regla de negocio | DAX original | Vivirá en |
|---|---|---|---|
| Proveedores | Saldo del nivel 22 | `S(Lvl2 = 22, ISBLANK(Lvl3))` | SP |
| Ob. Fras. Prov. - Confirming | Cuentas 21051040 + 21051045 | `S(Account = 21051040) + S(Account = 21051045)` | SP |
| Costos y Gastos por pagar | Nivel 2335 menos las cuentas 23359515, 23359525 y 23359530 | `S(Lvl3 = 2335, ISBLANK(Lvl4)) - S(Account = 23359515) - S(Account = 23359525) - S(Account = 23359530)` | SP |
| Impuestos por pagar | Solo la cuenta 24040505 | `S(Account = 24040505)` | SP |
| Obligaciones laborales | Saldo del nivel 25 | `S(Lvl2 = 25, ISBLANK(Lvl3))` | SP |
| Otras cuentas por pagar operativas | Niveles 2365 + 2367 + 2368 + 2370 + 2380 + 2408 + 2805 | `S(Lvl3 = 2365, …) + S(Lvl3 = 2408, …) + S(Lvl3 = 2367, …) + S(Lvl3 = 2368, …) + S(Lvl3 = 2370, …) + S(Lvl3 = 2380, …) + S(Lvl3 = 2805, …)` | SP |
| Pasivos estimados y provisiones | Saldo del nivel 26 | `S(Lvl2 = 26, ISBLANK(Lvl3))` | SP |
| **Proveedores de bienes y servicios** | Suma de los siete conceptos anteriores | `[Costos y Gastos por pagar] + [Impuestos por pagar] + [Obligaciones laborales] + [Otras cuentas por pagar operativas] + [Pasivos estimados y provisiones] + [Proveedores] + [Confirming]` | Summary API |

**KTNO, ventas y PKT** ([`KTNO.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/tables/KTNO.tmdl), [`Ventas.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/tables/Ventas.tmdl), [`PKT.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/tables/PKT.tmdl))

| Indicador | Regla de negocio | DAX original | Vivirá en |
|---|---|---|---|
| KTNO | Capital de trabajo + PBS (como el PBS es negativo, es activos operativos menos pasivos operativos) | `[Capital Trabajo] + [Proveedores de bienes y servicios]` | Summary API |
| totalVentas | Facturas menos notas crédito (`Valor Total`, antes de IVA) del periodo | `SUM(InformeVentas[Valor Total])` | SP (ventas por mes) |
| ventasAcumuladas | Ventas netas desde el 1 de enero hasta el fin del mes elegido | `TOTALYTD([totalVentas], Calendario[Fecha].[Date])` | Summary API |
| NroMes | Número del mes elegido (1 a 12) | `MAX(Calendario[NroMes])` | Summary API |
| **Ventas proyectadas** (tarjeta "VENTAS PROYECTADAS") | Ventas acumuladas ÷ número del mes × 12 (anualiza el año) | `DIVIDE([ventasAcumuladas],[NroMes])*12` | Summary API |
| **Ventas año anterior** (tarjeta "VENTAS PROY PY") | Ventas netas de **todo** el año anterior (enero a diciembre), sin proyectar | `CALCULATE([totalVentas], PREVIOUSYEAR(Calendario[Fecha]))` | Summary API |
| **Variación $** (tarjeta) | Ventas proyectadas − ventas del año anterior | `[ventasProyectadas] - [ventasProyectadasAA]` | Summary API |
| **Variación %** (tarjeta) | Variación $ ÷ ventas del año anterior | `DIVIDE([Variacion $], Ventas[ventasProyectadasAA])` | Summary API |
| **PKT** (tarjeta y gráficas) | KTNO del mes elegido ÷ ventas proyectadas | `DIVIDE([KTNO],[ventasProyectadas])` | Summary API |
| **PKT año anterior** (tarjeta "A.A PKT") | KTNO de diciembre del año anterior ÷ ventas de todo el año anterior | `DIVIDE([A.A KTNO],[ventasProyectadasAA])` | Summary API |

**Comparación con el año anterior (matriz de la página General)**

| Indicador | Regla de negocio | DAX original | Vivirá en |
|---|---|---|---|
| Año Actual | Valor del concepto (o del subtotal) en el mes elegido | `SWITCH` sobre `NombresMedidas[Nivel 2]` y `[Nivel 1]` que llama a la medida de cada concepto | Summary API |
| Año Anterior | Valor del concepto en **diciembre** del año anterior al elegido | `A.A. <concepto> = CALCULATE([<concepto>], MONTH(Calendario[Fecha]) = 12, YEAR(Calendario[Fecha]) = SELECTEDVALUE(Calendario[Fecha].[Año]) - 1)` | Summary API |
| Variacion | Año Actual − Año Anterior | `[Año Actual] - [Año Anterior]` | Summary API |
| % | Variación ÷ Año Anterior (0 si el año anterior es cero) | `DIVIDE([Variacion], [Año Anterior], 0)` | Summary API |

Medidas sin uso en visuales (no migrar, confirmar):

- Etiquetas de texto: `Label PKT`, `Label KTNO`, `Label Capital trabajo`, `Label <concepto>` (la tarjeta con `Label PKT` solo muestra el texto "PKT").
- `PKT GF` (PKT con el mes 12 fijo) y `Prueba` (`HASONEVALUE`).
- Las variaciones por concepto (`Variacion $ <concepto>`, `Variacion % <concepto>`), `Variacion $ / % KTNO`, `Variacion $ / % Capital de Trabajo`: la matriz usa las medidas genéricas `Variacion` y `%`. Nota: `Variacion % Proveedores de bienes y servicios` divide la variación del **capital de trabajo**, no la de PBS; es un error, pero no se ve en ningún visual.
- Columnas calculadas `CapitalTrabajo[Agrupacion]` y `[Agrupacion 2]`.
- Todas las columnas de `InformeVentas` salvo `Fecha contabilización` y `Valor Total`.

### Visuales y filtros

| Página | Visual | Medidas | Dimensiones |
|---|---|---|---|
| General | Tarjeta "VENTAS PROY PY" | `ventasProyectadasAA` | Año y mes de los segmentadores |
| General | Tarjeta "VENTAS PROYECTADAS" | `ventasProyectadas` | Año y mes |
| General | Tarjeta "VARIACIÓN $" | `Variacion $` | Año y mes |
| General | Tarjeta "VARIACIÓN %" | `Variacion %` | Año y mes |
| General | Matriz | `Año Anterior`, `Año Actual`, `Variacion`, `%` | Filas `NombresMedidas[Nivel 1]` > `[Nivel 2]` (ver abajo) |
| General | Tarjeta "PKT" (solo texto) | `Label PKT` | — |
| General | Tarjeta PKT año anterior | `A.A PKT` | Año y mes |
| General | Tarjeta PKT | `PKT` | Año y mes |
| General | Imagen | — | Logo de Firplak |
| Graficas | Columnas: PKT de cierre por año | `PKT` | Año. Filtro del visual: mes = diciembre. **No** le afectan los segmentadores de año ni de mes |
| Graficas | Columnas: PKT por mes | `PKT` | Mes; le afectan los dos segmentadores |
| Graficas | Columnas: PKT por año y mes | `PKT` | Año > Mes; le afecta el año, **no** el mes |

Filas de la matriz (de `NombresMedidas`): **Capital de Trabajo** (Clientes, Anticipos de impuestos o saldos a favor, Inventarios, Otras cuentas por cobrar operativas, Provisión (Deterioro) CxC), **Proveedores de bienes y servicios** (Proveedores, Ob. Fras. Prov. - Confirming, Costos y Gastos por pagar, Impuestos por pagar, Obligaciones laborales, Otras cuentas por pagar operativas, Pasivos estimados y provisiones) y **z KTNO**, cuyo subtotal muestra el KTNO. Sus hijos `a` y `b` son filas vacías de relleno para que el subtotal aparezca al final.

Filtros y segmentadores:

| Filtro | Columna de origen | Valores reales (confirmados) |
|---|---|---|
| Año (General y Graficas, lista desplegable) | `Calendario[Fecha]` → año | 2020 al año en curso (rango de `Calendario`); guardado en 2026. `pendiente` confirmar desde qué año hay saldos |
| Mes (General y Graficas, lista desplegable) | `Calendario[Fecha]` → mes | enero a diciembre; guardado en agosto |
| Mes = diciembre (filtro fijo de un visual) | `Calendario[Fecha]` → mes | Solo en la gráfica de cierre por año |

No hay filtros de página ni de informe.

**Comportamiento sin mes elegido.** Los saldos usan `MAX`, así que si no hay un mes elegido el BI toma el **mayor** saldo del año en cada concepto: en los pasivos, que son negativos, eso es el menor valor absoluto. Por eso la gráfica por año fija diciembre. El portal siempre trabajará con un mes concreto.

### Seguridad (RLS)

- ¿Tiene roles? No (no hay `role` en el modelo).
- Reglas: ninguna. En el portal el informe se asignará a direccionfinanciera@firplak.com en `/admin/permisos`.

### Riesgos y preguntas para el dueño de negocio

Riesgos técnicos:

1. **Mantenimiento manual por año.** Cada año alguien debe agregar una consulta `Cap_Trab_<año>`. En enero de 2027 la consulta del año en curso pasará a 2027 y 2026 desaparecerá del BI si nadie agrega `Cap_Trab_2026`. La tabla nueva lo resuelve calculando todos los meses.
2. **`Cap_Trab_2024` quedó en error** en la última actualización del archivo (`PBI_ResultType = Exception` en [`expressions.tmdl`](../../bi-origen/PKT/PKT%20v4.1%201.SemanticModel/definition/expressions.tmdl)). Si el error se publicó, las cifras de 2024 (y el "año anterior" de 2025) podrían estar vacías en el Power BI actual. Hay que tenerlo en cuenta en la conciliación.
3. **Posible duplicación de ventas** por el cruce con `CostosGlobal` (consulta V1).
4. **Mes en curso.** El saldo del mes actual es el saldo a la fecha, y `ventasProyectadas` divide por el número del mes completo aunque el mes vaya por la mitad: en noviembre, con 13 días, divide entre 11. El PKT del mes en curso cambia cada día.
5. **Fechas como texto.** El SQL arma fechas con `'01/' + mes + '/' + año`, que depende del idioma de la sesión de SQL Server. El SP usará `DATEFROMPARTS`.
6. **Las columnas `Agrupacion` contradicen a las medidas** (por ejemplo, Clientes sin 13051010, Impuestos por pagar con las clases 4, 5 y 6). No se usan y no se migran; se documenta por si alguien las toma como referencia.

Preguntas para Dirección Financiera:

1. **Ventas proyectadas.** Hoy son ventas acumuladas ÷ número del mes × 12, también en el mes en curso aunque no haya terminado. ¿Se mantiene, o el mes en curso debe excluirse (o el portal mostrar por defecto el último mes cerrado)?
2. **Comparativo con el año anterior.** La tarjeta "VENTAS PROY PY" muestra las ventas reales de todo el año anterior, no una proyección, y el "Año Anterior" de la matriz es siempre diciembre del año anterior, sin importar el mes elegido. ¿Es la comparación correcta, o debería ser el mismo mes del año anterior?
3. **Cuentas de cada concepto.** ¿Siguen vigentes las cuentas y niveles de la tabla de indicadores? En particular: Impuestos por pagar solo con 24040505; las exclusiones 13300515, 23359515, 23359525 y 23359530; Confirming con 21051040 y 21051045.
4. **Área de valoración.** Los saldos solo toman asientos con `U_HBT_AreVal` igual a "Comun", "IFRS", vacío o nulo. ¿Es correcto excluir el resto (por ejemplo, las de valoración fiscal)?
5. **Exclusiones en ventas.** Se mantienen las facturas 96491–96497, 96515 y 96516 y la NC 1002414 retiradas a mano, los 16 artículos `VZNOPE` y las Donaciones. ¿Se puede usar la tabla existente `Informe_ventas` (filtrada a Firplak) aunque sus reglas difieran un poco (consulta V4), o el PKT debe conservar sus reglas exactas?
6. **Solo Firplak.** El PKT no incluye Viventta. ¿Se mantiene así?
7. **Desde qué año.** ¿El portal debe mostrar desde 2020, como el BI, o basta con los últimos años?
8. **Página "Graficas".** ¿Se mantienen las tres gráficas (PKT de cierre por año, PKT por mes del año elegido y la serie mensual)? Propuesta: dejar el cierre por año y la serie mensual del año elegido, porque la tercera repite la segunda.

**Validación del dueño de negocio:** Claudia Duque (Dirección Financiera) — 2026-11-19 — validado, por medio del desarrollador ([cierre](#cierre-de-la-fase-1-2026-11-19)).

### Consultas de validación para el desarrollador

Todas son de solo lectura. Pide los resultados para cerrar los `pendiente`.

```sql
-- V1. ¿Hay códigos repetidos en CostosGlobal nivel 1? (si hay, el BI duplica ventas)
SELECT Codigo, COUNT(*) AS Filas
FROM Planos_Symphony.dbo.CostosGlobal
WHERE Nivel = 1
GROUP BY Codigo
HAVING COUNT(*) > 1;

-- V2. Valores de área de valoración en asientos desde 2024
SELECT ISNULL(TB.U_HBT_AreVal, '(nulo)') AS AreaValoracion, COUNT(*) AS Lineas,
       SUM(TA.Debit - TA.Credit) AS Neto
FROM Firplak_SA.dbo.JDT1 TA
INNER JOIN Firplak_SA.dbo.OJDT TB ON TA.TransId = TB.TransId
WHERE TA.RefDate >= '20240101'
GROUP BY TB.U_HBT_AreVal;

-- V3. Saldo de fin de mes por concepto (regla del BI, sin cursores) para diciembre de 2025 y octubre de 2026.
--     Comparar con la columna "Año Actual" de la matriz en Power BI.
DECLARE @Cortes TABLE (FechaCorte date);
INSERT INTO @Cortes VALUES ('20251231'), ('20261031');

WITH Saldos AS (
    SELECT C.FechaCorte, TA.Account, SUM(TA.Debit - TA.Credit) AS Saldo
    FROM @Cortes C
    INNER JOIN Firplak_SA.dbo.JDT1 TA ON TA.RefDate <= C.FechaCorte
    INNER JOIN Firplak_SA.dbo.OJDT TB ON TA.TransId = TB.TransId
    INNER JOIN Firplak_SA.dbo.OACT TC ON TC.AcctCode = TA.Account
    WHERE (TB.U_HBT_AreVal IN ('Comun', 'IFRS', '') OR TB.U_HBT_AreVal IS NULL)
      AND TC.Levels = 5 AND TC.Postable = 'Y' AND LEN(TC.AcctCode) = 8
    GROUP BY C.FechaCorte, TA.Account
)
SELECT FechaCorte,
  SUM(CASE WHEN Account IN ('13050505','13051005','13051010') THEN Saldo END) AS Clientes,
  SUM(CASE WHEN Account LIKE '1355%' THEN Saldo END) AS AnticiposImpuestos,
  SUM(CASE WHEN Account LIKE '14%' THEN Saldo END) AS Inventarios,
  SUM(CASE WHEN (Account LIKE '1330%' AND Account <> '13300515') OR Account LIKE '1365%' THEN Saldo END) AS OtrasCxC,
  SUM(CASE WHEN Account IN ('13050590','13051090') OR Account LIKE '139905%' THEN Saldo END) AS ProvisionCxC,
  SUM(CASE WHEN Account LIKE '22%' THEN Saldo END) AS Proveedores,
  SUM(CASE WHEN Account IN ('21051040','21051045') THEN Saldo END) AS Confirming,
  SUM(CASE WHEN Account LIKE '2335%' AND Account NOT IN ('23359515','23359525','23359530') THEN Saldo END) AS CostosGastosPorPagar,
  SUM(CASE WHEN Account = '24040505' THEN Saldo END) AS ImpuestosPorPagar,
  SUM(CASE WHEN Account LIKE '25%' THEN Saldo END) AS ObligacionesLaborales,
  SUM(CASE WHEN LEFT(Account, 4) IN ('2365','2367','2368','2370','2380','2408','2805') THEN Saldo END) AS OtrasCxP,
  SUM(CASE WHEN Account LIKE '26%' THEN Saldo END) AS PasivosEstimados
FROM Saldos
GROUP BY FechaCorte
ORDER BY FechaCorte;

-- V4. Ventas netas por mes con las reglas del PKT frente a Informe_ventas (Firplak), 2025 y 2026.
--     Si coinciden, el PKT puede leer las ventas de Informe_ventas.
SELECT YEAR(FechaContabilizacion) AS Anio, MONTH(FechaContabilizacion) AS Mes,
       SUM(ValorTotal) AS VentasInformeVentas
FROM Planos_Symphony.dbo.Informe_ventas
WHERE ISNULL(Empresa, '') <> 'Viventta'
  AND FechaContabilizacion >= '20250101'
GROUP BY YEAR(FechaContabilizacion), MONTH(FechaContabilizacion)
ORDER BY Anio, Mes;
-- y comparar con la suma mensual de LINETOTAL (facturas) y LINETOTAL * -1 (notas) de las consultas
-- Facturas y NotasCredito de arriba, agrupadas por YEAR(DOCDATE), MONTH(DOCDATE).
```

V3 reproduce los niveles del BI sumando las cuentas por prefijo, que es lo que hace la consulta original (cada nivel es la suma de sus cuentas de nivel 5). Si V3 coincide con Power BI, el SP de la fase 2 puede usar esta forma, que no necesita cursores ni consultas por año.

### Respuestas y decisiones (2026-11-19)

Respuestas a las preguntas anteriores, entregadas por el desarrollador.

| # | Tema | Decisión |
|---|---|---|
| D1 | Mes en curso | **Solo meses cerrados.** El portal no muestra el mes en curso; por defecto abre el último mes cerrado. Con esto desaparece el riesgo 4. |
| D2 | Comparativo | Contra **diciembre del año anterior**, fijo durante todo el año hasta el cambio de año. Se mantienen las reglas del BI: el "Año Anterior" de la matriz es diciembre del año anterior y "VENTAS PROY PY" son las ventas de todo el año anterior. |
| D3 | Cuentas de cada concepto | Vigentes, tal como están en la [tabla de indicadores](#indicadores-medidas-dax). |
| D4 | Área de valoración | Correcto: solo "Comun", "IFRS", vacío o nulo. Se excluye "Local" (V2). |
| D5 | Ventas | Se leen de `Informe_ventas`, con las mismas reglas que el endpoint de facturación ya existente (`/api/v1/facturacion-diaria`). No se crea una tabla de ventas propia del PKT. |
| D6 | Operaciones entre compañías | En las cuentas del PKT se **restan** los saldos de Firplak con tercero Viventta y los de Viventta con tercero Firplak. Los dos valores deben ser iguales. Falta precisar el alcance (ver P1). |
| D7 | Desde qué año | Desde **2020**. |
| D8 | Gráficas | Solo **dos gráficas**, pero que muestren toda la información de las tres originales (ver P3). |

### Resultados de las consultas de validación (2026-11-19)

- **V1.** Sin códigos repetidos en `CostosGlobal` nivel 1: el cruce del BI **no** duplica ventas. Se descarta el riesgo 3.
- **V2.** Áreas de valoración desde 2024: nulo (22 líneas), vacío (53.252), "Comun" (4.984.017), "IFRS" (7.967) y "Local" (5.716). Todas tienen neto 0, así que cada área cuadra por sí sola. Con D4 se excluye "Local".
- **V3.** Saldos por concepto con la consulta sin cursores (Firplak, sin eliminar operaciones con Viventta):

| Concepto | 2025-12-31 | 2026-10-31 |
|---|---:|---:|
| Clientes | 5.284.272.166,54 | 7.193.722.220,95 |
| Anticipos de impuestos o saldos a favor | 1.462.093.286,85 | 1.493.252.191,10 |
| Inventarios | 8.739.201.315,43 | 7.826.068.904,14 |
| Otras cuentas por cobrar operativas | 150.337.137,99 | 105.075.178,08 |
| Provisión (Deterioro) CxC | −80.741.397,86 | −77.871.720,86 |
| **Capital de trabajo** | **15.555.162.508,95** | **16.540.246.773,41** |
| Proveedores | −5.550.840.472,90 | −3.872.233.643,20 |
| Ob. Fras. Prov. - Confirming | −955.575.020,67 | −2.560.178.868,99 |
| Costos y gastos por pagar | −1.909.964.149,84 | −1.914.768.623,58 |
| Impuestos por pagar | 0,00 | 0,00 |
| Obligaciones laborales | −1.066.493.218,00 | −430.104.804,00 |
| Otras cuentas por pagar operativas | −2.577.390.808,78 | −2.531.934.996,42 |
| Pasivos estimados y provisiones | 0,00 | −1.523.390.657,60 |
| **Proveedores de bienes y servicios** | **−12.060.263.670,19** | **−12.832.611.593,79** |
| **KTNO** | **3.494.898.838,76** | **3.707.635.179,62** |

**Validado:** coincide con la matriz de Power BI ([comparación](#comparación-con-power-bi-2026-11-19)). Impuestos por pagar da 0 en los dos cortes: hay que confirmar que la cuenta 24040505 es la correcta (ver P2).

- **V4.** Ventas de `Informe_ventas` sin Viventta (Firplak y CEFI): 2025 completo = 59.302.543.965,32; enero a octubre de 2026 = 51.052.657.466,60.

Con V3 y V4 (antes de eliminar las operaciones con Viventta):

| Cifra | Valor |
|---|---:|
| Ventas proyectadas a octubre de 2026 (51.052.657.466,60 ÷ 10 × 12) | 61.263.188.959,92 |
| Ventas del año anterior (2025) | 59.302.543.965,32 |
| Variación $ / % | 1.960.644.994,60 / 3,31 % |
| PKT octubre de 2026 (3.707.635.179,62 ÷ 61.263.188.959,92) | 6,05 % |
| PKT año anterior (3.494.898.838,76 ÷ 59.302.543.965,32) | 5,89 % |

Comparado con las tarjetas de Power BI: el PKT coincide; las ventas difieren un poco ([comparación](#comparación-con-power-bi-2026-11-19)).

### Comparación con Power BI (2026-11-19)

Capturas del desarrollador del Power BI con año 2025 / mes diciembre y año 2026 / mes octubre.

- **Saldos: V3 cuadra exacto** con la matriz en los dos cortes, concepto por concepto, incluidos los subtotales y el KTNO (3.494.899 mil y 3.707.635 mil). La consulta sin cursores reemplaza las siete consultas por año. **Validado por el desarrollador.**
- **Riesgo 2 descartado:** el Power BI sí tiene diciembre de 2024 (KTNO del año anterior a 2025 = 2.610.309 mil; ventas de 2024 = 46.659.443 mil).
- **Ventas: `Informe_ventas` da un poco menos que el BI** (hallazgo, `pendiente`):

| Cifra | Power BI | `Informe_ventas` sin Viventta | Diferencia |
|---|---:|---:|---:|
| Ventas 2025 | 59.330.202 mil | 59.302.544 mil | 27.658 mil (0,047 %) |
| Ventas enero a octubre de 2026 (61.269.693 mil ÷ 12 × 10) | 51.058.078 mil | 51.052.657 mil | 5.420 mil (0,011 %) |
| PKT octubre de 2026 | 6,1 % (6,051 %) | 6,052 % | 0,001 puntos |
| PKT año anterior (2025) | 5,89 % (5,891 %) | 5,893 % | 0,002 puntos |

  El PKT redondeado no cambia, pero las tarjetas de ventas sí: la diferencia es mayor que una unidad de redondeo. La causa probable son las reglas que difieren entre el BI y `Informe_ventas` (ver [Notas crédito](notas-credito.md#cómo-se-carga-informe_ventas-definición-compartida-por-el-desarrollador-2026-10-27)). La consulta V6 la ubica por mes.

```sql
-- V6. Ventas netas por mes con las reglas exactas del BI frente a Informe_ventas (sin Viventta), 2025 y 2026.
WITH BI AS (
    SELECT T0.DOCDATE AS Fecha, T1.LINETOTAL AS Valor
    FROM Firplak_SA.dbo.OINV T0
    INNER JOIN Firplak_SA.dbo.INV1 T1 ON T0.DOCENTRY = T1.DOCENTRY
    INNER JOIN Firplak_SA.dbo.INV12 T16 ON T0.DOCENTRY = T16.DOCENTRY
    INNER JOIN Firplak_SA.dbo.OCRD T4 ON T0.CARDCODE = T4.CARDCODE
    INNER JOIN Firplak_SA.dbo.OTER T9 ON T4.TERRITORY = T9.TERRITRYID
    INNER JOIN Firplak_SA.dbo.OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
    INNER JOIN Firplak_SA.dbo.OSLP T6 ON T0.SLPCODE = T6.SLPCODE
    INNER JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] T8 ON T4.U_SUBGROUPCODE = T8.CODE
    INNER JOIN Firplak_SA.dbo.OTER T10 ON T9.PARENT = T10.TERRITRYID
    WHERE T0.SERIES <> '88' AND T0.CANCELED = 'N' AND T1.TAXONLY = 'N'
      AND T0.U_TipoVentas <> 'Donaciones' AND T1.LINETOTAL <> 0
      AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000','VZNOPE-0001-000-0000','VZNOPE-0004-000-0000','VZNOPE-0006-000-0000',
          'VZNOPE-0007-000-0000','VZNOPE-0008-000-0000','VZNOPE-0009-000-0000','VZNOPE-0010-000-0000','VZNOPE-0012-000-0000',
          'VZNOPE-0014-000-0000','VZNOPE-0015-000-0000','VZNOPE-0017-000-0000','VZNOPE-0018-000-0000','VZNOPE-0021-000-0000',
          'VZNOPE-0023-000-0000','VZNOPE-0024-000-0000')
      AND T0.DocNum NOT IN (96491, 96492, 96493, 96494, 96495, 96496, 96497, 96515, 96516)
      AND T0.DOCDATE >= '20250101'
    UNION ALL
    SELECT T0.DOCDATE, T1.LINETOTAL * -1
    FROM Firplak_SA.dbo.ORIN T0
    INNER JOIN Firplak_SA.dbo.RIN1 T1 ON T0.DOCENTRY = T1.DOCENTRY
    INNER JOIN Firplak_SA.dbo.RIN12 T16 ON T0.DOCENTRY = T16.DOCENTRY
    INNER JOIN Firplak_SA.dbo.OCRD T4 ON T0.CARDCODE = T4.CARDCODE
    INNER JOIN Firplak_SA.dbo.OTER T9 ON T4.TERRITORY = T9.TERRITRYID
    INNER JOIN Firplak_SA.dbo.OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
    INNER JOIN Firplak_SA.dbo.OSLP T6 ON T0.SLPCODE = T6.SLPCODE
    WHERE T0.SERIES <> '88' AND T1.TAXONLY = 'N' AND T1.LINETOTAL <> 0 AND T0.CANCELED = 'N'
      AND T0.DocType <> 'S' AND T0.U_TipoVentas <> 'Donaciones'
      AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000','VZNOPE-0001-000-0000','VZNOPE-0004-000-0000','VZNOPE-0006-000-0000',
          'VZNOPE-0007-000-0000','VZNOPE-0008-000-0000','VZNOPE-0009-000-0000','VZNOPE-0010-000-0000','VZNOPE-0012-000-0000',
          'VZNOPE-0014-000-0000','VZNOPE-0015-000-0000','VZNOPE-0017-000-0000','VZNOPE-0018-000-0000','VZNOPE-0021-000-0000',
          'VZNOPE-0023-000-0000','VZNOPE-0024-000-0000')
      AND T0.DocNum <> 1002414
      AND T0.DOCDATE >= '20250101'
),
BIMes AS (
    SELECT YEAR(Fecha) AS Anio, MONTH(Fecha) AS Mes, SUM(Valor) AS VentasBI FROM BI GROUP BY YEAR(Fecha), MONTH(Fecha)
),
IVMes AS (
    SELECT YEAR(FechaContabilizacion) AS Anio, MONTH(FechaContabilizacion) AS Mes, SUM(ValorTotal) AS VentasInformeVentas
    FROM Planos_Symphony.dbo.Informe_ventas
    WHERE ISNULL(Empresa, '') <> 'Viventta' AND FechaContabilizacion >= '20250101'
    GROUP BY YEAR(FechaContabilizacion), MONTH(FechaContabilizacion)
)
SELECT B.Anio, B.Mes, B.VentasBI, I.VentasInformeVentas, B.VentasBI - I.VentasInformeVentas AS Diferencia
FROM BIMes B
LEFT JOIN IVMes I ON I.Anio = B.Anio AND I.Mes = B.Mes
ORDER BY B.Anio, B.Mes;
```

### Preguntas abiertas (2026-11-19, respondidas en D9 a D13)

1. **P1. Alcance de la eliminación entre compañías (D6).** ¿Cuál de estas dos lecturas es la correcta?
   - **a) PKT consolidado:** se suman los saldos de Firplak y de Viventta (`DBViventta`) y se restan los saldos recíprocos. En ese caso, ¿las ventas también incluyen Viventta y se restan las ventas entre las dos compañías?
   - **b) PKT solo de Firplak:** se restan de Firplak sus saldos con Viventta, y los saldos de Viventta con Firplak solo sirven para comprobar que el valor coincide.

   También hace falta saber cómo se identifica el tercero: propongo usar `JDT1.ShortName` (el código del socio de negocio en el asiento) con el código de Viventta en `Firplak_SA.OCRD` y el de Firplak en `DBViventta.OCRD` (consulta V5).
2. **P2. Impuestos por pagar.** La cuenta 24040505 da 0 en diciembre de 2025 y en octubre de 2026. ¿Es la cuenta correcta, o el concepto debería usar otra cuenta o nivel?
3. **P3. Gráficas (D8).** Propuesta:
   - **Gráfica 1, cierre por año:** PKT de diciembre de cada año desde 2020, más el último mes cerrado del año en curso (marcado como parcial).
   - **Gráfica 2, serie mensual:** PKT de cada mes cerrado del año elegido, con el mes elegido resaltado y el valor en cada barra. Esto cubre la gráfica "PKT por mes" y la serie "año y mes" del BI.

### Respuestas a P1, P2 y P3 (2026-11-19)

| # | Tema | Decisión |
|---|---|---|
| D9 | Consolidación (P1) | El PKT **consolida Firplak y Viventta** y resta **solo los saldos recíprocos que coincidan** entre las dos compañías. No hace falta ver cada compañía por separado: el portal muestra solo el consolidado. |
| D10 | Ventas entre compañías | Las ventas de Firplak a Viventta se restan. Según el desarrollador, el BI ya las tiene restadas (`pendiente`: identificar la regla que lo hace, consulta V7). |
| D11 | Impuestos por pagar (P2) | Se mantiene la medida del BI (cuenta 24040505). Da 0 porque el año fiscal aún no se ha cerrado. |
| D12 | Gráficas (P3) | Se aprueban las dos gráficas propuestas: cierre por año y serie mensual del año elegido. |
| D13 | Tabla del estado | La tabla del portal debe tener **la misma organización que la primera hoja del BI** (ver abajo). |

**Organización de la tabla (D13), tomada de la página General del BI.** Columnas: Año Anterior, Año Actual, Variación, %. Filas, en este orden:

1. **Capital de Trabajo** (subtotal): Anticipos de Impuestos o saldos a favor, Clientes, Inventarios, Otras cuentas por cobrar operativas, Provisión (Deterioro) CxC (Vr. negativo).
2. **Proveedores de bienes y servicios** (subtotal): Costos y Gastos por pagar, Impuestos por pagar, Ob. Fras. Prov. - Confirming, Obligaciones laborales, Otras cuentas por pagar operativas, Pasivos estimados y provisiones, Proveedores.
3. **KTNO** (total). En el BI aparece como "z KTNO" porque la "z" lo ordena al final; en el portal se llamará "KTNO".

Encima de la tabla van cuatro tarjetas: Ventas Proyectadas A.A., Ventas Proyectadas, Variación $ y %. Debajo, las tarjetas PKT del año anterior y PKT del mes. Formato: pesos en miles ("$15.555.163 mil"), negativos entre paréntesis, porcentajes con dos decimales.

**Regla de "saldos que coinciden" (D9), propuesta para la fase 2** (`pendiente` de aprobación):

- Se separan los saldos recíprocos en dos sentidos: lo que Firplak le debe a Viventta, y lo que Viventta le debe a Firplak.
- En cada sentido se compara el total registrado en las dos compañías, con todas las cuentas de clase 1 y 2 de ese tercero (consulta V5b).
- Si los dos totales coinciden (diferencia de máximo 1 peso), se restan de los conceptos del PKT los saldos de ese sentido en las dos compañías. Si no coinciden, no se resta nada de ese sentido y el saldo queda marcado como diferencia para Contabilidad.
- Ejemplo con el corte del 31 de octubre de 2026:
  - Firplak debe a Viventta: coincide (486.272.023,68 frente a 486.272.023,70). Se resta de Clientes de Viventta 475.284.445,19. La cuenta 23359530 de Firplak ya está fuera del PKT por regla, y 13809510 de Viventta no pertenece a ningún concepto.
  - Viventta debe a Firplak: no coincide (1.739.126,00 frente a 1.582.462,00). No se restan los −274.162,00 ni los −1.308.300,00 de Viventta.

**Efecto en la conciliación.** El BI actual solo tiene Firplak. Con D9 el portal suma Viventta, así que su PKT **no será igual** al del BI. En la fase 6 se concilia en dos partes: la parte de Firplak contra el BI, y la parte de Viventta con su eliminación por separado. Para eso la tabla guarda la compañía, aunque el portal no la muestre.

**Pendientes para la fase 2:**

- Confirmar que Viventta usa las mismas cuentas para cada concepto del PKT. V5b sugiere que sí: 13050505 es Clientes nacionales y 23359505 Otros costos y gastos por pagar.
- Confirmar si `DBViventta.dbo.OJDT` tiene `U_HBT_AreVal` y si se aplica el mismo filtro de área de valoración.
- Ventas de Viventta: con D9 las ventas proyectadas deberían incluir las de Viventta (`Informe_ventas` con `Empresa = 'Viventta'`). Confirmar con Dirección Financiera.

```sql
-- V7. Ventas a la otra compañía en Informe_ventas, 2025 y 2026, para ubicar la regla que ya las resta (D10).
SELECT Empresa, YEAR(FechaContabilizacion) AS Anio, CodCliente, NombreCliente, SUM(ValorTotal) AS Ventas
FROM Planos_Symphony.dbo.Informe_ventas
WHERE FechaContabilizacion >= '20250101'
  AND (CodCliente LIKE '%901967145%' OR CodCliente LIKE '%890927404%'
       OR NombreCliente LIKE '%VIVENTTA%' OR NombreCliente LIKE '%FIRPLAK%')
GROUP BY Empresa, YEAR(FechaContabilizacion), CodCliente, NombreCliente
ORDER BY Empresa, Anio;
-- Y en SAP, facturas de Firplak a Viventta (todas, con y sin las exclusiones del BI):
SELECT YEAR(T0.DOCDATE) AS Anio, T0.SERIES, T0.U_TipoVentas, T0.CARDCODE, T0.CARDNAME,
       COUNT(*) AS Lineas, SUM(T1.LINETOTAL) AS Valor
FROM Firplak_SA.dbo.OINV T0
INNER JOIN Firplak_SA.dbo.INV1 T1 ON T0.DOCENTRY = T1.DOCENTRY
WHERE T0.DOCDATE >= '20250101' AND T0.CANCELED = 'N'
  AND (T0.CARDCODE LIKE '%901967145%' OR T0.CARDNAME LIKE '%VIVENTTA%')
GROUP BY YEAR(T0.DOCDATE), T0.SERIES, T0.U_TipoVentas, T0.CARDCODE, T0.CARDNAME
ORDER BY Anio;
```

### Cierre de la fase 1 (2026-11-19)

- **D14. Ventas de Viventta:** confirmado. Las ventas proyectadas del PKT consolidado suman Firplak y Viventta desde `Informe_ventas` (todas las empresas).
- **Resultado de V7:**
  - En `Informe_ventas` desde 2025 no hay ventas de una compañía a la otra. Solo aparece "FIRPLAK HOME CALI" (`CN11111111-02`, empresa Firplak, 5.798.319,33 en 2025), que es un cliente propio con un código genérico, no Viventta.
  - En `Firplak_SA.OINV` no hay facturas a Viventta desde 2025.
  - Viventta sí tiene a Firplak como cliente (saldo de 475.284.445,19 en V5b), pero esas ventas no están en `Informe_ventas`. Por eso no hay nada que restar en ventas, lo que confirma D10.
- **V6 no se ejecutó.** La diferencia de ventas frente al BI (27.658 mil en 2025, 0,047 %) queda como hallazgo abierto para la fase 6.
- **Validación del dueño de negocio:** Claudia Duque (Dirección Financiera) confirma las reglas, por medio del desarrollador, el 2026-11-19.

### Consulta para P1 (solo lectura)

```sql
-- V5a. Código de cada compañía como tercero en la otra
SELECT 'Firplak_SA' AS Base, CardCode, CardName, CardType
FROM Firplak_SA.dbo.OCRD WHERE CardName LIKE '%VIVENTTA%'
UNION ALL
SELECT 'DBViventta', CardCode COLLATE DATABASE_DEFAULT, CardName COLLATE DATABASE_DEFAULT, CardType COLLATE DATABASE_DEFAULT
FROM DBViventta.dbo.OCRD WHERE CardName LIKE '%FIRPLAK%';

-- Resultado de V5a (2026-11-19): en Firplak_SA, Viventta es proveedor AC901967145-01.
-- En DBViventta, Firplak es cliente CN890927404-01 y proveedor AC890927404-01.
-- Cada compañía puede tener a la otra como cliente y como proveedor: se toman todos los códigos por NIT.

-- V5c. Todos los códigos de cada compañía en la otra, buscados por NIT
SELECT 'Firplak_SA' AS Base, CardCode, CardName, CardType, LicTradNum
FROM Firplak_SA.dbo.OCRD
WHERE CardCode LIKE '%901967145%' OR LicTradNum LIKE '901967145%'
UNION ALL
SELECT 'DBViventta', CardCode COLLATE DATABASE_DEFAULT, CardName COLLATE DATABASE_DEFAULT, CardType COLLATE DATABASE_DEFAULT, LicTradNum COLLATE DATABASE_DEFAULT
FROM DBViventta.dbo.OCRD
WHERE CardCode LIKE '%890927404%' OR LicTradNum LIKE '890927404%';

-- V5b. Saldos con la otra compañía al 2026-10-31, por cuenta y por código de tercero.
DECLARE @Corte date = '20261031';

SELECT 'Firplak_SA' AS Base, TA.ShortName AS Tercero, TA.Account, TC.AcctName, SUM(TA.Debit - TA.Credit) AS Saldo
FROM Firplak_SA.dbo.JDT1 TA
INNER JOIN Firplak_SA.dbo.OJDT TB ON TB.TransId = TA.TransId
INNER JOIN Firplak_SA.dbo.OACT TC ON TC.AcctCode = TA.Account
WHERE TA.RefDate <= @Corte
  AND TA.ShortName IN (SELECT CardCode FROM Firplak_SA.dbo.OCRD
                       WHERE CardCode LIKE '%901967145%' OR LicTradNum LIKE '901967145%')
  AND (TB.U_HBT_AreVal IN ('Comun', 'IFRS', '') OR TB.U_HBT_AreVal IS NULL)
  AND LEFT(TA.Account, 1) IN ('1', '2')
GROUP BY TA.ShortName, TA.Account, TC.AcctName
HAVING SUM(TA.Debit - TA.Credit) <> 0
UNION ALL
SELECT 'DBViventta', TA.ShortName COLLATE DATABASE_DEFAULT, TA.Account COLLATE DATABASE_DEFAULT, TC.AcctName COLLATE DATABASE_DEFAULT, SUM(TA.Debit - TA.Credit)
FROM DBViventta.dbo.JDT1 TA
INNER JOIN DBViventta.dbo.OJDT TB ON TB.TransId = TA.TransId
INNER JOIN DBViventta.dbo.OACT TC ON TC.AcctCode = TA.Account
WHERE TA.RefDate <= @Corte
  AND TA.ShortName IN (SELECT CardCode FROM DBViventta.dbo.OCRD
                       WHERE CardCode LIKE '%890927404%' OR LicTradNum LIKE '890927404%')
  AND LEFT(TA.Account, 1) IN ('1', '2')
GROUP BY TA.ShortName, TA.Account, TC.AcctName
HAVING SUM(TA.Debit - TA.Credit) <> 0
ORDER BY Base, Tercero, Account;
```

En `DBViventta` no se filtra el área de valoración porque no está confirmado que `OJDT.U_HBT_AreVal` exista en esa base (`pendiente`).

#### Resultado de V5b (2026-11-19, corte 2026-10-31)

| Base | Tercero | Cuenta | Nombre | Saldo | Concepto del PKT |
|---|---|---|---|---:|---|
| Firplak_SA | AC901967145-01 (Viventta, proveedor) | 13809515 | CXC OTROS | 1.739.126,00 | Ninguno (1380 no está en el PKT) |
| Firplak_SA | AC901967145-01 | 23359530 | CXP VIVENTTA | −486.272.023,68 | Ninguno: el BI **ya excluye** 23359530 de Costos y gastos por pagar |
| DBViventta | CN890927404-01 (Firplak, cliente) | 13050505 | CLIENTES NACIONALES | 475.284.445,19 | Clientes |
| DBViventta | AC890927404-01 (Firplak, proveedor) | 13809510 | CXC DEUDORES | 10.987.578,51 | Ninguno |
| DBViventta | AC890927404-01 | 23359505 | OTROS COSTOS Y GTOS POR PAGAR | −274.162,00 | Costos y gastos por pagar |
| DBViventta | AC890927404-01 | 28050505 | ANTICIPO DE CLIENTES | −1.308.300,00 | Otras cuentas por pagar operativas |

Lectura:

- **Cuadre recíproco.** Lo que Firplak le debe a Viventta (23359530: 486.272.023,68) es igual a lo que Viventta le cobra a Firplak: 13050505 + 13809510 = 486.272.023,70. Diferencia de 0,02 por redondeo.
- **Diferencia sin explicar.** Firplak tiene por cobrar a Viventta 1.739.126,00 (13809515), y Viventta registra por pagar a Firplak 1.582.462,00 (23359505 + 28050505). Faltan 156.664,00 (`pendiente` con Contabilidad).
- **En Firplak la eliminación no cambia el PKT a esta fecha.** Ninguna cuenta con saldo contra Viventta está en los conceptos del PKT. La única relevante, 23359530, ya se excluye por regla.
- **En Viventta sí cambia.** Si el PKT suma Viventta, hay que restar 475.284.445,19 de Clientes, −274.162,00 de Costos y gastos por pagar y −1.308.300,00 de Otras cuentas por pagar. Esto apunta a la lectura **a) consolidado** de P1 (`pendiente` de confirmar).
- Limitación: `JDT1.ShortName` solo identifica al tercero en cuentas asociadas a socios de negocio. Una cuenta contable sin socio de negocio no aparece aquí aunque sea entre compañías.

### Propuesta de tabla (para la fase 2)

Actualizada el 2026-11-19 con D1, D5 y D7.

1. `dbo.Informe_pkt_saldos`: una fila por **fin de mes × compañía × concepto** (12 conceptos), desde enero de 2020 y solo meses cerrados. Columnas: `FechaCorte`, `Anio`, `Mes`, `Empresa`, `Grupo` ("Capital de Trabajo" / "Proveedores de bienes y servicios"), `Concepto`, `Orden`, `SaldoContable`, `SaldoIntercompania`, `Saldo` (contable − intercompañía) y `FechaCarga`. `Empresa` (Firplak / Viventta) se guarda para conciliar y auditar la eliminación (D9), aunque el portal solo muestre el consolidado. El año anterior, el KTNO y el PKT los calcula la API.
2. Ventas: **no** hay tabla nueva. Se leen de `Informe_ventas` con las reglas del endpoint de facturación (D5), agregadas por mes.

Carga: recalcular el año en curso y el anterior una vez al día, antes de las 2:00 p. m., porque los meses cerrados pueden recibir asientos tardíos. Se define en la fase 2.

## 2. Tabla de reporte y carga incremental

Script: [`sql/pkt/01_informe_pkt.sql`](../../sql/pkt/01_informe_pkt.sql) (tablas, SP y consultas de validación). Job: [`sql/pkt/02_job_pkt.sql`](../../sql/pkt/02_job_pkt.sql). Escritos el 2026-11-23; `pendiente` de que el desarrollador los ejecute.

Datos de Viventta confirmados por el desarrollador (2026-11-23):

- `DBViventta.dbo.OJDT` tiene `U_HBT_AreVal`, así que se aplica el mismo filtro de área de valoración que en Firplak (D4).
- El catálogo de Viventta usa los mismos prefijos de cuenta. No tiene `2105`, por lo que Confirming queda en 0. Tiene `1399` (provisión de cartera), que solo cuenta si la cuenta empieza por `139905` (revisar con la validación 4.4).

| Campo | Valor |
|---|---|
| Tabla | `Planos_Symphony.dbo.Informe_pkt_saldos` |
| Grano (una fila por…) | Fin de mes × compañía (Firplak, Viventta) × concepto (12) |
| Clave | `FechaCorte`, `Empresa`, `Concepto` (PK clustered) |
| Fecha de referencia (filtros por periodo) | `FechaCorte`: último día de cada mes cerrado, desde 2020-01-31 |
| Columnas | `Anio`, `Mes`, `Grupo`, `Orden` (orden de la matriz del BI), `SaldoContable`, `SaldoIntercompania`, `Saldo` (= contable − intercompañía) y `FechaCarga` |
| Tabla auxiliar | `dbo.Informe_pkt_intercompania`: saldo con la otra compañía por corte, cuenta y tercero, con su sentido, la diferencia del sentido y la marca `Coincide` |
| Estrategia | **Carga completa** en cada ejecución. El saldo de un mes necesita toda la historia de asientos, así que una ventana incremental no reduce la lectura del origen, y el resultado es pequeño (unas 2.000 filas). Los movimientos se agregan por cuenta y mes, sin cursores, y el saldo se acumula con `SUM() OVER` |
| SP | `dbo.sp_Actualizar_Informe_pkt @Tolerancia = 1.00` (diferencia máxima, en pesos, para que un sentido coincida) |
| Job y horario | `BI - PKT carga diaria`, todos los días a la 1:00 p. m., con un reintento a los 10 minutos |
| Bitácora | `dbo.Cargas_Log`, `Proceso = Informe_pkt` |
| Índices | Solo la PK clustered: la API filtra por `FechaCorte` y la tabla es pequeña |

Reglas que implementa el SP:

- Conceptos con las cuentas de la [tabla de indicadores](#indicadores-medidas-dax), aplicadas a las dos compañías (las mismas reglas de V3).
- Eliminación entre compañías (D9):
  - El tercero se identifica por `JDT1.ShortName` contra los socios de negocio con el NIT de la otra compañía en `CardCode` o en `LicTradNum` (901967145 para Viventta en Firplak, 890927404 para Firplak en Viventta).
  - "Firplak debe a Viventta" = cuentas clase 2 de Firplak + cuentas clase 1 de Viventta con ese tercero. "Viventta debe a Firplak" = clase 1 de Firplak + clase 2 de Viventta.
  - Si la suma de un sentido está dentro de `@Tolerancia`, se resta de cada concepto el saldo de ese sentido; si no, se deja y queda con `Coincide = 0` para revisión de Contabilidad.
- Las ventas no se cargan: la API las lee de `Informe_ventas` (D5, D14).

Validación de totales (tabla frente a V3 y al BI). La completa el desarrollador con las consultas 4.1 a 4.6 del script:

| Comprobación | Esperado | Resultado |
|---|---|---|
| KTNO Firplak 2025-12-31 (sin eliminación) | 3.494.898.838,76 | 3.494.898.838,76, y cada concepto igual a V3 ✔ |
| KTNO Firplak 2026-10-31 (sin eliminación) | 3.707.635.179,62 | 3.707.635.179,62, y cada concepto igual a V3 ✔ |
| Sentido "Firplak debe a Viventta" 2026-10-31 | Diferencia 0,02, coincide | Diferencia 0,02, `Coincide = 1` ✔ |
| Sentido "Viventta debe a Firplak" 2026-10-31 | Diferencia 156.664,00, no coincide | Diferencia 156.664,00, `Coincide = 0` ✔ |
| Viventta, Clientes, `SaldoIntercompania` 2026-10-31 | 475.284.445,19 | 475.284.445,19 (contable 475.300.054,94; queda 15.609,75) ✔ |
| Cortes cargados | 2020-01-31 al último mes cerrado, 24 filas por corte | 2020-01-31 a 2026-10-31, 82 cortes, 24 filas por corte ✔ |

Los esperados de intercompañía venían de V5b, que en Viventta no filtraba el área de valoración: el filtro no cambió ningún saldo.

Primera carga (2026-11-23, desarrollador): 8 segundos, 2.047 filas (1.968 de saldos y 79 de intercompañía), `Error` NULL en `Cargas_Log`.

Viventta al 2026-10-31 (consulta 4.4), después de la eliminación:

| Concepto | Saldo contable | Eliminado | Saldo |
|---|---:|---:|---:|
| Anticipos de impuestos o saldos a favor | 2.740.000,00 | 0,00 | 2.740.000,00 |
| Clientes | 475.300.054,94 | 475.284.445,19 | 15.609,75 |
| Costos y Gastos por pagar | −337.012,62 | 0,00 | −337.012,62 |
| Obligaciones laborales | −3.788.608,00 | 0,00 | −3.788.608,00 |
| Otras cuentas por pagar operativas | −11.189.349,77 | 0,00 | −11.189.349,77 |
| Pasivos estimados y provisiones | −9.427.120,68 | 0,00 | −9.427.120,68 |
| Inventarios, Otras CxC, Provisión, Impuestos, Confirming, Proveedores | 0,00 | 0,00 | 0,00 |
| **KTNO Viventta** | | | **−21.986.481,32** |

`pendiente` con Contabilidad: Viventta tiene cuentas de inventario (1410, 1430, 1435) y de proveedores (2205) en su catálogo, pero el saldo da 0 al corte.

PKT consolidado de prueba al 2026-10-31 (consulta 4.5):

| Cifra | Valor |
|---|---:|
| KTNO consolidado (3.707.635.179,62 − 21.986.481,32) | 3.685.648.698,30 |
| Ventas enero a octubre, todas las compañías | 51.152.707.058,60 |
| Ventas proyectadas | 61.383.248.470,32 |
| PKT | 6,00 % (el BI, solo Firplak, muestra 6,1 %) |

**Fase 2:** totales validados por el desarrollador el 2026-11-23. `pendiente`: confirmar que el job `BI - PKT carga diaria` está creado y corrió.

Rollback: `DROP PROCEDURE IF EXISTS dbo.sp_Actualizar_Informe_pkt;` y `DROP TABLE IF EXISTS dbo.Informe_pkt_intercompania, dbo.Informe_pkt_saldos;`, y borrar el job con `msdb.dbo.sp_delete_job` (ver el encabezado de cada script). No toca ninguna tabla existente.

## 3. Contrato del endpoint

Propuesto el 2026-11-23. Sigue el patrón de `/api/v1/facturacion-diaria` (mismo token, mismo manejo de errores, `source` y `updatedAt`), con una diferencia: **no hay `rows` ni `pagination`**. El PKT no tiene detalle por documento; la respuesta es el estado de un mes.

`GET /api/v1/pkt`

### Parámetros

| Parámetro | Tipo | Columna | Descripción |
|---|---|---|---|
| `anio` | entero (2020 o posterior) | `Informe_pkt_saldos.Anio` | Año del corte. Opcional |
| `mes` | entero 1–12 | `Informe_pkt_saldos.Mes` | Mes del corte. Opcional; se envía junto con `anio` |

- Sin parámetros, la API usa el **último corte cargado**, que es el último mes cerrado (D1).
- Si el par `anio`/`mes` no está en la tabla (por ejemplo, el mes en curso), responde `400` con `{ "error": "No hay datos para el periodo solicitado" }`. No hay otros filtros: el portal no muestra compañías por separado (D9).

### Respuesta

```json
{
  "period": { "year": 2026, "month": 10, "cutoffDate": "2026-10-31", "previousCutoffDate": "2025-12-31" },
  "periods": [
    { "year": 2026, "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { "year": 2025, "months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
  ],
  "summary": {
    "ytdSales": 51152707058.6,
    "projectedSales": 61383248470.32,
    "previousYearSales": 59402000000.0,
    "salesVariation": 1981248470.32,
    "salesVariationPct": 0.0334,
    "ktno": 3685648698.3,
    "previousKtno": 3470000000.0,
    "pkt": 0.060043,
    "previousPkt": 0.0584
  },
  "statement": [
    { "type": "group", "group": "Capital de Trabajo", "name": "Capital de Trabajo", "order": 0,
      "previousYear": 15530000000.0, "currentYear": 16543002383.16, "variation": 1013002383.16, "variationPct": 0.0652 },
    { "type": "concept", "group": "Capital de Trabajo", "name": "Anticipos de Impuestos o saldos a favor", "order": 1,
      "previousYear": 1462000000.0, "currentYear": 1495992191.1, "variation": 33992191.1, "variationPct": 0.0233 },
    { "type": "total", "group": "KTNO", "name": "KTNO", "order": 13,
      "previousYear": 3470000000.0, "currentYear": 3685648698.3, "variation": 215648698.3, "variationPct": 0.0621 }
  ],
  "series": {
    "annualClose": [
      { "year": 2025, "month": 12, "cutoffDate": "2025-12-31", "ktno": 3470000000.0, "projectedSales": 59402000000.0, "pkt": 0.0584, "partial": false },
      { "year": 2026, "month": 10, "cutoffDate": "2026-10-31", "ktno": 3685648698.3, "projectedSales": 61383248470.32, "pkt": 0.060043, "partial": true }
    ],
    "monthly": [
      { "month": 10, "cutoffDate": "2026-10-31", "ktno": 3685648698.3, "projectedSales": 61383248470.32, "pkt": 0.060043 }
    ]
  },
  "source": "sql-server",
  "updatedAt": "2026-11-23T10:24:32.000Z"
}
```

Las cifras del ejemplo solo muestran la forma de la respuesta. Las de octubre de 2026 (`ytdSales`, `projectedSales`, `ktno`, `pkt` y los saldos `currentYear`) son reales (consultas 4.4 y 4.5); todas las del año anterior están **redondeadas a mano**, porque el KTNO consolidado de diciembre de 2025 y las ventas de Viventta de 2025 todavía no se han consultado. Valores de dinero en pesos; porcentajes como fracción (0,060043 = 6,0043 %).

### Campos y reglas

| Campo | Regla | Origen |
|---|---|---|
| `period.cutoffDate` | Último día del mes elegido | `Informe_pkt_saldos.FechaCorte` |
| `period.previousCutoffDate` | 31 de diciembre del año anterior (D2) | — |
| `periods` | Años y meses con datos, del más reciente al más antiguo. Llenan los selectores de año y mes | `DISTINCT Anio, Mes` de `Informe_pkt_saldos` |
| `summary.ytdSales` | Ventas netas del 1 de enero al corte, todas las compañías (D14), con la regla neta de facturación: facturas − notas crédito (`-ABS(ValorTotal)` en notas) | `Informe_ventas` |
| `summary.projectedSales` | `ytdSales ÷ mes × 12` (tarjeta "Ventas Proyectadas") | API |
| `summary.previousYearSales` | Ventas netas de enero a diciembre del año anterior, sin proyectar (tarjeta "Ventas Proyectadas A.A.") | `Informe_ventas` |
| `summary.salesVariation` | `projectedSales − previousYearSales` (tarjeta "Variacion $") | API |
| `summary.salesVariationPct` | `salesVariation ÷ previousYearSales`; `null` si el año anterior es 0 (tarjeta "%") | API |
| `summary.ktno` / `previousKtno` | Suma de `Saldo` (consolidado, con la eliminación entre compañías) al corte / al 31 de diciembre anterior | `Informe_pkt_saldos` |
| `summary.pkt` | `ktno ÷ projectedSales`; `null` si las ventas son 0 | API |
| `summary.previousPkt` | `previousKtno ÷ previousYearSales` (tarjeta del PKT del año anterior) | API |
| `statement` | Matriz de la página General (D13), **en este orden**: grupo Capital de Trabajo y sus 5 conceptos, grupo Proveedores de bienes y servicios y sus 7 conceptos, total KTNO. `type` = `group`, `concept` o `total`; `order` = `Orden` de la tabla | `Informe_pkt_saldos` |
| `statement[].previousYear` / `currentYear` | Saldo consolidado al 31 de diciembre anterior / al corte. Los pasivos son negativos, como en el BI | `Informe_pkt_saldos.Saldo` |
| `statement[].variation` | `currentYear − previousYear` | API |
| `statement[].variationPct` | `variation ÷ previousYear`; **0 si `previousYear` es 0**, igual que el BI (`DIVIDE(…, …, 0)`) | API |
| `series.annualClose` | Gráfica 1 (D12): PKT de diciembre de cada año desde 2020 y, para el año del último corte cargado, ese mes con `partial: true`. No depende del periodo elegido, como en el BI | `Informe_pkt_saldos` + `Informe_ventas` |
| `series.monthly` | Gráfica 2 (D12): PKT de cada mes cerrado del año elegido. El frontend resalta `period.month` | `Informe_pkt_saldos` + `Informe_ventas` |
| `updatedAt` | `MAX(FechaCarga)` de `Informe_pkt_saldos` (hora de la última carga, no de la consulta) | `Informe_pkt_saldos` |

Notas:

- **Año anterior de 2020.** No hay corte de diciembre de 2019 (D7), así que con un periodo de 2020 `previousYear`, `previousKtno` y `previousPkt` llegan en `null` y el frontend muestra "—". `Informe_ventas` también empieza en 2020 (confirmado por el desarrollador, 2026-11-23), así que `previousYearSales` y `salesVariationPct` de 2020 también llegan en `null`.
- **Sin descarga a Excel**: no se pidió. Se puede agregar después como `/api/v1/pkt/export`.
- **Variables nuevas** en `.env.example` de la API: `REPORT_PKT_TABLE_SCHEMA=dbo` y `REPORT_PKT_TABLE=Informe_pkt_saldos`. Las ventas usan la tabla de facturación que ya está configurada (`REPORT_DB_TABLE`).
- **Consultas**: un solo lote: saldos del corte y del diciembre anterior por concepto, ventas por año y mes desde 2019 hasta el corte (una sola agregación de `Informe_ventas`), KTNO por corte para las series, periodos disponibles y `MAX(FechaCarga)`. La API arma los subtotales, las variaciones y las proyecciones.

**Aprobación del contrato:** Daniel Jimenez (desarrollador) — 2026-11-23 — aprobado.

## 4. Endpoint

Implementado el 2026-11-23 en `reporting-api`, rama `bi/pkt` (creada desde `main` `e422f7b`). Sin commit todavía.

- Archivos tocados en `reporting-api`:
  - `src/types.ts`: `PktFilters`, `PktSummary`, `PktStatementRow`, `PktAnnualPoint`, `PktMonthlyPoint` y `PktApiResponse`.
  - `src/db.ts`: `pktSource()` y `getPktReport()`. Una consulta por lotes con 5 recordsets: 0 corte y hora de carga, 1 periodos, 2 matriz por concepto (corte y diciembre anterior), 3 KTNO por corte para las series, 4 ventas netas por año y mes de `Informe_ventas`. Los subtotales, variaciones, proyecciones y el PKT se calculan en TypeScript.
  - `src/server.ts`: `pktFiltersFrom()` (`anio` y `mes` juntos o ninguno; `400` si falta uno o está fuera de rango) y la ruta `/api/v1/pkt` (`400` si el periodo no está cargado; `502` sin detalles si falla la consulta).
  - `README.md` y `.env.example`.
- Variables nuevas en `.env.example`: `REPORT_PKT_TABLE_SCHEMA=dbo` y `REPORT_PKT_TABLE=Informe_pkt_saldos`. Si no están en el `.env` del servidor, la API usa esos mismos valores por defecto.
- Verificación local (2026-11-23):
  - `npm run build` sin errores.
  - SQL revisado a mano: 5 `SELECT` frente a 5 recordsets leídos (índices 0 a 4), parámetros `@year` y `@month` declarados, sin `SELECT *`, predicados de fecha sargables sobre `Informe_ventas`.
  - Prueba del cálculo con recordsets simulados (cifras de octubre de 2026 y ventas de Firplak): la matriz suma el KTNO de la tabla (3.685.648.698,30), el orden es el de la página General, el % de "Pasivos estimados" da 0 con año anterior 0, y el PKT, la proyección y las series cuadran con el cálculo a mano.
- Prueba contra la base (2026-11-23, desarrollador, copia de la API en el servidor en el puerto 8090): `200` en 200 ms, 6.323 bytes.
  - `period.cutoffDate = 2026-10-31`, `periods` de 2020 a 2026 (2026 hasta octubre).
  - `ytdSales` 51.152.707.058,60 y `projectedSales` 61.383.248.470,32, iguales a la consulta 4.5. `ktno` 3.685.648.698,30 y `pkt` 6,0043 %, iguales a 4.5.
  - Año anterior consolidado: `previousYearSales` 59.309.789.843,32; `previousKtno` 3.452.766.311,53 (Firplak 3.494.898.838,76 más Viventta −42.132.527,23); `previousPkt` 5,82 %; variación de ventas 2.073.458.626,99 (3,50 %).
  - `statement` en el orden del BI; "Impuestos por pagar" con año anterior 0 da % 0.
  - Observación: las ventas de Viventta en `Informe_ventas` son 7.245.878 en todo 2025 frente a unos 100.049.592 de enero a octubre de 2026. `pendiente` confirmar con Dirección Financiera si es correcto.

**Fase 4 cerrada** (2026-11-23).
- Paquete para el servidor (2026-11-23): `reporting-api-dist-bi-pkt-20261123.zip` en la carpeta padre de los repositorios, con `dist/` compilado desde la rama `bi/pkt` sin commit (por eso el nombre lleva la rama y la fecha en lugar del commit). Sin dependencias nuevas. Prueba propuesta en una copia aparte del servicio, en el puerto 8090, sin tocar producción.

Prueba del desarrollador, con la API local (`npm run dev` en `reporting-api`, con su `.env`):

```bash
curl -s -H "Authorization: Bearer $REPORTING_API_TOKEN" "http://127.0.0.1:8080/api/v1/pkt"
curl -s -H "Authorization: Bearer $REPORTING_API_TOKEN" "http://127.0.0.1:8080/api/v1/pkt?anio=2025&mes=12"
curl -s -H "Authorization: Bearer $REPORTING_API_TOKEN" "http://127.0.0.1:8080/api/v1/pkt?anio=2026"
```

Qué debe verse:

1. Sin parámetros: `period.cutoffDate = "2026-10-31"`; `summary.ktno = 3685648698.3`; `summary.ytdSales = 51152707058.6`; `summary.pkt` cerca de 0,060043 (consulta 4.5). `statement` con 15 filas (2 grupos, 12 conceptos y KTNO) y el KTNO igual a `summary.ktno`. `series.annualClose` de 2020 a 2025 más 2026-10 con `partial: true`; `series.monthly` de enero a octubre de 2026.
2. Con `anio=2025&mes=12`: `previousCutoffDate = "2024-12-31"`. La parte de Firplak de la matriz debe coincidir con la columna "Año Actual" del BI de diciembre de 2025.
3. Con `anio=2026` sin `mes`: `400` con el mensaje "Envía anio (2020 o posterior) y mes (1 a 12) juntos".

## 5. Dashboard

Construido el 2026-11-23 en la rama `bi/pkt` del frontend (sin commit todavía), con el plan y los formatos aprobados por el desarrollador.

- Rutas: `/pkt` con tarjetas, matriz y PKT ([`app/pkt/page.tsx`](../../app/pkt/page.tsx)) y `/pkt/graficas` con las dos gráficas ([`app/pkt/graficas/page.tsx`](../../app/pkt/graficas/page.tsx)), separadas a pedido del desarrollador (2026-11-23). Las dos usan [`components/PktDashboard.tsx`](../../components/PktDashboard.tsx) (`mode` `statement` o `charts`), la misma consulta y los mismos filtros; el periodo no se conserva al pasar de una página a la otra (cada una abre en el último mes cerrado).
- Proxy: [`app/api/pkt/route.ts`](../../app/api/pkt/route.ts), igual al de nivel de servicio de plantas; el token solo vive en el servidor.
- Tipos: [`lib/pkt/types.ts`](../../lib/pkt/types.ts). Estilos: [`app/styles/pkt.css`](../../app/styles/pkt.css), solo tokens.
- Catálogo: informe `pkt` en el área **Contabilidad y finanzas** de [`lib/reports.ts`](../../lib/reports.ts) (título "PKT"; las áreas de contabilidad y financiera se unieron el 2026-11-23); navegación `pktNavigation` (PKT y Gráficas del PKT) en [`lib/dashboard/navigation.ts`](../../lib/dashboard/navigation.ts). `pendiente`: asignarlo a direccionfinanciera@firplak.com en `/admin/permisos`.
- Componentes reutilizados: `DashboardShell`, `MetricCard` / `MetricSkeleton`, `readJsonPayload`, formatos de `lib/dashboard/format.ts` y las clases `billing-*` (barra de filtros, paneles, tabla, gráficas, alertas).

Pantalla, en el orden de la página General del BI (D13):

1. Filtros Año y Mes con los periodos de la API (solo meses cerrados), en la barra fija de Facturación (`billing-filterbar-sticky`): desde 768 px de ancho se queda bajo la barra superior al desplazarse; en celular queda en su lugar para no tapar la pantalla. Por defecto, el último mes cerrado. Se aplican con "Aplicar filtros"; "Limpiar" vuelve al último mes cerrado.
2. Cuatro tarjetas de ventas: año anterior, proyectadas (con el cálculo acumulado ÷ mes × 12), variación $ y variación %.
3. Matriz con grupos plegables: Capital de Trabajo (5 conceptos), Proveedores de bienes y servicios (7) y KTNO. Columnas: año anterior (31 dic), año actual (mes elegido), variación y %.
4. Tarjetas del PKT del año anterior y del mes (destacada).
5. Gráficas, en la página `/pkt/graficas`: PKT de cierre por año (el año en curso con el último mes cerrado, en tono claro) y PKT por mes del año elegido (el mes elegido resaltado). Valor sobre cada barra y tooltip con KTNO y ventas.
6. Pie con la hora de la última carga y "se actualiza todos los días a la 1:00 p. m.".

Formatos aprobados (2026-11-23): montos siempre en millones con un decimal y el valor completo en el `title`; negativos con signo menos, sin rojo en los saldos (todos los pasivos son negativos); verde y rojo solo en la columna Variación; PKT con dos decimales y los demás porcentajes con uno.

Revisión visual (375 / 820 / 1440 px): 2026-11-23, con una copia temporal sin `middleware.ts` y datos de prueba (borrada al terminar). Ajustes tras la revisión: columna de concepto de 150 px en móvil para que se vean los montos, etiqueta del año parcial solo con el año (el corte va en el tooltip), montos menores a un millón también en millones y la flecha del grupo sin encogerse. `npm run lint` y `npm run build` sin errores.

`pendiente`: revisión con datos reales y sesión (cambiar año y mes, comprobar la URL del proxy en la pestaña Red).

**Fase 5:** el desarrollador pidió continuar con la fase 6 el 2026-11-23. La prueba con sesión y datos reales la hizo el desarrollador (capturas del portal de septiembre de 2026, 2026-11-23): las tarjetas, la matriz y el PKT cargan y el cálculo es coherente. Queda `pendiente` confirmar la asignación del informe en `/admin/permisos`.

## 6. Conciliación con Power BI

Preparada el 2026-11-23. Script de solo lectura: [`sql/pkt/03_conciliacion.sql`](../../sql/pkt/03_conciliacion.sql) (resultados R1 a R6).

El Power BI solo tiene Firplak; el portal consolida Firplak y Viventta restando los saldos entre compañías que coinciden (D9). Por eso:

- **Parte A, Firplak frente al BI:** debe cuadrar. Saldos con R1; tarjetas con R2, calculadas con las reglas de ventas del BI (columnas `…BI`) y con `Informe_ventas` (columnas `…IV`, lo que usa el portal).
- **Parte B, lo que agrega el portal:** Viventta, la eliminación y el PKT consolidado (R3 a R5). No tiene equivalente en el BI; se revisa con Dirección Financiera.

Valores de Power BI de octubre de 2026 y diciembre de 2025: capturas del desarrollador del 2026-11-19 (en miles de pesos, redondeados). Agosto de 2026: captura del 2026-11-23. Septiembre de 2026: no se concilió; los tres periodos exigidos son octubre de 2026, agosto de 2026 y diciembre de 2025. Una diferencia mayor a una unidad de redondeo es un hallazgo y se documenta antes de seguir.

### Parte A · Octubre de 2026 (año anterior = 31 dic 2025)

| Indicador | Portal (Firplak) | Power BI | Diferencia | Causa |
|---|---:|---:|---:|---|
| Capital de trabajo | 16.540.246.773,41 | 16.540.247 mil | 0 | — |
| Proveedores de bienes y servicios | −12.832.611.593,79 | −12.832.612 mil | 0 | — |
| KTNO | 3.707.635.179,62 | 3.707.635 mil | 0 | — |
| KTNO año anterior (31 dic 2025) | 3.494.898.838,76 | 3.494.899 mil | 0 | — |
| Cada uno de los 12 conceptos | V3 / R1 | Matriz del BI | 0 | Validado el 2026-11-19 |
| Ventas año anterior (2025) | `Informe_ventas`: 59.302.543.965,32 · reglas BI: R2 | 59.330.202 mil | −27.658 mil con `Informe_ventas` | H1 |
| Ventas proyectadas | `Informe_ventas`: 61.263.188.959,92 · reglas BI: R2 | 61.269.693 mil | −6.504 mil con `Informe_ventas` | H1 |
| Variación $ | `Informe_ventas`: 1.960.644.994,60 | 1.939.491 mil | +21.154 mil | H1 |
| Variación % | `Informe_ventas`: 3,31 % | 3,27 % | +0,04 puntos | H1 |
| PKT | `Informe_ventas`: 6,052 % | 6,1 % (6,051 %) | 0 al redondear | — |
| PKT año anterior | `Informe_ventas`: 5,893 % | 5,89 % | 0 al redondear | — |

### Octubre de 2026: portal consolidado frente al BI (conciliado)

Capturas del desarrollador del 2026-11-23 del portal y del BI, los dos con año 2026 y mes octubre. Cada diferencia se explica con el saldo de Viventta después de la eliminación (consulta 4.4 de la fase 2) y con H1 en las ventas. **Sin diferencias sin explicar.**

| Indicador | Portal | Power BI (Firplak) | Diferencia | Explicación |
|---|---:|---:|---:|---|
| Anticipos de Impuestos o saldos a favor | 1.496,0 M | 1.493.252 mil | +2,7 M | Viventta 2.740.000,00 |
| Clientes | 7.193,7 M | 7.193.722 mil | +0,0 M | Viventta 15.609,75 (475.300.054,94 − 475.284.445,19 eliminados) |
| Inventarios | 7.826,1 M | 7.826.069 mil | 0 | Viventta 0 |
| Otras cuentas por cobrar operativas | 105,1 M | 105.075 mil | 0 | Viventta 0 |
| Provisión (Deterioro) CxC | −77,9 M | −77.872 mil | 0 | Viventta 0 |
| **Capital de trabajo** | **16.543,0 M** | **16.540.247 mil** | **+2,8 M** | Viventta 2.755.609,75 |
| Costos y Gastos por pagar | −1.915,1 M | −1.914.769 mil | −0,3 M | Viventta −337.012,62 |
| Impuestos por pagar | 0,0 M | 0 | 0 | — |
| Ob. Fras. Prov. - Confirming | −2.560,2 M | −2.560.179 mil | 0 | Viventta no tiene la cuenta 2105 |
| Obligaciones laborales | −433,9 M | −430.105 mil | −3,8 M | Viventta −3.788.608,00 |
| Otras cuentas por pagar operativas | −2.543,1 M | −2.531.935 mil | −11,2 M | Viventta −11.189.349,77 |
| Pasivos estimados y provisiones | −1.532,8 M | −1.523.391 mil | −9,4 M | Viventta −9.427.120,68 |
| Proveedores | −3.872,2 M | −3.872.234 mil | 0 | Viventta 0 |
| **Proveedores de bienes y servicios** | **−12.857,4 M** | **−12.832.612 mil** | **−24,7 M** | Viventta −24.742.091,07 |
| **KTNO** | **3.685,6 M** | **3.707.635 mil** | **−22,0 M** | KTNO de Viventta −21.986.481,32 |
| KTNO año anterior (31 dic 2025) | 3.452,8 M | 3.494.899 mil | −42,1 M | KTNO de Viventta a 31 dic 2025 −42.132.527,23 |
| Ventas año anterior (2025) | 59.309,8 M | 59.330.202 mil | −20,4 M | H1 en Firplak (−27,7 M) + ventas de Viventta de 2025 (+7,2 M) |
| Ventas proyectadas | 61.383,2 M | 61.269.693 mil | +113,6 M | H1 en Firplak (−6,5 M) + Viventta proyectada (100,0 M ÷ 10 × 12 = +120,1 M) |
| Variación $ / % | +2.073,5 M / +3,5 % | 1.939.491 mil / 3,27 % | +134,0 M | Las dos líneas anteriores |
| **PKT** | **6,00 %** | **6,1 % (6,05 %)** | **−0,05 puntos** | Consolidación con Viventta (KTNO −22,0 M y ventas +113,6 M) |
| PKT año anterior | 5,82 % | 5,89 % | −0,07 puntos | Consolidación con Viventta (KTNO −42,1 M y ventas +7,2 M) y H1 |

En la columna "Año anterior" (31 dic 2025) las diferencias por concepto también son saldos de Viventta: Anticipos +2,7 M, Clientes +2,0 M, Costos y gastos −5,2 M, Obligaciones laborales −15,4 M y Otras cuentas por pagar −26,2 M. Suman −42,1 M.

Para que Dirección Financiera vea la parte de Firplak igual que en el BI, R1 y R2 del script la dan sin Viventta.

### Diciembre de 2025: portal consolidado frente al BI (conciliado)

Capturas del 2026-11-23 del portal y del BI con año 2025 y mes diciembre.

| Indicador | Portal | Power BI (Firplak) | Diferencia | Explicación |
|---|---:|---:|---:|---|
| Los 12 conceptos, subtotales y KTNO a 31 dic 2024 (año anterior) | KTNO 2.610,3 M | KTNO 2.610.309 mil | 0 en todos | Viventta no existía en 2024 (H2) |
| Capital de trabajo a 31 dic 2025 | 15.559,9 M | 15.555.163 mil | +4,8 M | Viventta: Anticipos +2,7 M y Clientes +2,0 M |
| Proveedores de bienes y servicios a 31 dic 2025 | −12.107,2 M | −12.060.264 mil | −46,9 M | Viventta: Costos y gastos −5,2 M, Obligaciones laborales −15,4 M, Otras CxP −26,2 M |
| **KTNO** | **3.452,8 M** | **3.494.899 mil** | **−42,1 M** | KTNO de Viventta −42.132.527,23 |
| Ventas año anterior (2024) | 46.659,4 M | 46.659.443 mil | 0 | En 2024 `Informe_ventas` y las reglas del BI coinciden |
| Ventas proyectadas (2025) | 59.309,8 M | 59.330.202 mil | −20,4 M | H1 (−27,7 M) + Viventta (+7,2 M) |
| Variación $ / % | +12.650,3 M / +27,1 % | 12.670.759 mil / 27,16 % | −20,4 M | La línea anterior |
| **PKT** | **5,82 %** | **5,9 % (5,89 %)** | **−0,07 puntos** | Consolidación con Viventta y H1 |
| PKT año anterior | 5,59 % | 5,59 % | 0 | — |

### Agosto de 2026: portal consolidado frente al BI (hallazgo H4)

Capturas del 2026-11-23 del portal y del BI con año 2026 y mes agosto.

| Indicador | Portal | Power BI (Firplak) | Diferencia | Explicación |
|---|---:|---:|---:|---|
| Anticipos de Impuestos o saldos a favor | 2.436,5 M | 2.433.765 mil | +2,7 M | Viventta |
| **Clientes** | **6.252,0 M** | **5.776.174 mil** | **+475,8 M** | **H4:** cuenta por cobrar de Viventta a Firplak sin eliminar (475.284.445,19, confirmado con R4) y el resto, clientes propios de Viventta |
| Inventarios | 7.872,7 M | 7.872.720 mil | 0 | — |
| Otras cuentas por cobrar operativas | 172,3 M | 172.464 mil | −0,2 M | Saldo propio de Viventta (no aparece en R4, así que no es entre compañías) |
| Provisión (Deterioro) CxC | −78,1 M | −78.097 mil | 0 | — |
| Costos y Gastos por pagar | −2.124,5 M | −2.123.237 mil | −1,3 M | Viventta |
| Ob. Fras. Prov. - Confirming | −1.514,1 M | −1.514.054 mil | 0 | — |
| Obligaciones laborales | −431,9 M | −428.105 mil | −3,8 M | Viventta |
| Otras cuentas por pagar operativas | −2.495,8 M | −2.484.375 mil | −11,4 M | Viventta |
| Pasivos estimados y provisiones | −1.153,6 M | −1.145.958 mil | −7,6 M | Viventta |
| Proveedores | −4.550,2 M | −4.550.244 mil | 0 | — |
| **KTNO** | **4.385,4 M** | **3.931.053 mil** | **+454,3 M** | H4 (+475,8 M) y saldos de Viventta (−21,5 M) |
| Ventas proyectadas | 61.170,1 M | 61.071.499 mil | +98,6 M | H1 y ventas de Viventta |
| **PKT** | **7,17 %** | **6,4 %** | **+0,77 puntos** | H4 |

### Parte A · Septiembre de 2026 (año anterior = 31 dic 2025)

| Indicador | Portal (Firplak) | Power BI | Diferencia | Causa |
|---|---:|---:|---:|---|
| Capital de trabajo | R1 | `pendiente` | | |
| Proveedores de bienes y servicios | R1 | `pendiente` | | |
| KTNO | R1 | `pendiente` | | |
| Ventas proyectadas | R2 (`…BI` y `…IV`) | `pendiente` | | |
| Variación $ y % | R2 | `pendiente` | | |
| PKT | R2 | `pendiente` | | |

### Parte A · Agosto de 2026 (año anterior = 31 dic 2025)

Valores del BI: captura del desarrollador del 2026-11-23 (año 2026, mes agosto), en miles de pesos. Portal: R1 y R2.

| Indicador | Portal (Firplak) | Power BI | Diferencia | Causa |
|---|---:|---:|---:|---|
| Capital de trabajo | R1 | 16.177.027 mil | | |
| Anticipos de Impuestos o saldos a favor | R1 | 2.433.765 mil | | |
| Clientes | R1 | 5.776.174 mil | | |
| Inventarios | R1 | 7.872.720 mil | | |
| Otras cuentas por cobrar operativas | R1 | 172.464 mil | | |
| Provisión (Deterioro) CxC | R1 | −78.097 mil | | |
| Proveedores de bienes y servicios | R1 | −12.245.974 mil | | |
| Costos y Gastos por pagar | R1 | −2.123.237 mil | | |
| Impuestos por pagar | R1 | 0 | | |
| Ob. Fras. Prov. - Confirming | R1 | −1.514.054 mil | | |
| Obligaciones laborales | R1 | −428.105 mil | | |
| Otras cuentas por pagar operativas | R1 | −2.484.375 mil | | |
| Pasivos estimados y provisiones | R1 | −1.145.958 mil | | |
| Proveedores | R1 | −4.550.244 mil | | |
| KTNO | R1 | 3.931.053 mil | | |
| KTNO año anterior (31 dic 2025) | 3.494.898.838,76 | 3.494.899 mil | 0 | — |
| Ventas año anterior (2025) | R2 | 59.330.202 mil | | H1 |
| Ventas proyectadas | R2 | 61.071.499 mil | | H1 |
| Variación $ / % | R2 | 1.741.297 mil / 2,93 % | | H1 |
| PKT | R2 | 6,4 % | | |
| PKT año anterior | R2 | 5,89 % | | |

### Parte A · Diciembre de 2025 (año anterior = 31 dic 2024)

| Indicador | Portal (Firplak) | Power BI | Diferencia | Causa |
|---|---:|---:|---:|---|
| Capital de trabajo | 15.555.162.508,95 | 15.555.163 mil | 0 | — |
| Proveedores de bienes y servicios | −12.060.263.670,19 | −12.060.264 mil | 0 | — |
| KTNO | 3.494.898.838,76 | 3.494.899 mil | 0 | — |
| Capital de trabajo año anterior (31 dic 2024) | R1 | 12.726.379 mil | | |
| Proveedores año anterior (31 dic 2024) | R1 | −10.116.071 mil | | |
| KTNO año anterior (31 dic 2024) | R1 | 2.610.309 mil | | |
| Conceptos a 31 dic 2024 | R1 | Anticipos 807.008 · Clientes 5.761.249 · Inventarios 6.022.522 · Otras CxC 169.795 · Provisión −34.195 · Costos y gastos −922.470 · Impuestos 0 · Confirming −613.044 · Obligaciones laborales −932.694 · Otras CxP −3.806.283 · Pasivos estimados 0 · Proveedores −3.841.579 (mil) | | |
| Ventas año anterior (2024) | R2 | 46.659.443 mil | | |
| Ventas proyectadas (= ventas de 2025) | R2 | 59.330.202 mil | | H1 |
| Variación $ / % | R2 | 12.670.759 mil / 27,16 % | | |
| PKT | R2 | 5,9 % | | |
| PKT año anterior | R2 | 5,59 % | | |

### Parte B · Lo que agrega el portal (R3 a R5)

| Indicador | Oct 2026 | Sep 2026 | Dic 2025 |
|---|---:|---:|---:|
| KTNO Viventta, después de la eliminación | −21.986.481,32 | R5 | −42.132.527,23 |
| KTNO consolidado según el portal (captura del 2026-11-23) | 3.685,6 M | 3.932,0 M | 3.452,8 M |
| Ventas proyectadas consolidadas según el portal | 61.383,2 M | 61.184,3 M (45.888,2 M ÷ 9 × 12) | — |
| PKT consolidado según el portal | 6,00 % | 6,43 % | 5,82 % |
| Eliminado de Clientes de Viventta ("Firplak debe a Viventta", coincide) | 475.284.445,19 | R4 | R4 |
| Sentido "Viventta debe a Firplak" | No coincide (156.664,00); no se elimina | R4 | R4 |
| KTNO consolidado | 3.685.648.698,30 | R5 | 3.452.766.311,53 |
| Ventas proyectadas consolidadas | 61.383.248.470,32 | R5 | R5 |
| **PKT consolidado (portal)** | **6,00 %** | R5 | R5 |
| PKT año anterior consolidado | 5,82 % | R5 | R5 |

Los valores de octubre de 2026 y el KTNO consolidado de diciembre de 2025 son los de la prueba del endpoint (fase 4).

### Hallazgos

Decisiones de Dirección Financiera (Claudia Duque), transmitidas por el desarrollador el 2026-11-23:

- **H1. Ventas de `Informe_ventas` frente a las reglas del BI: aceptada la diferencia.** La parte de Firplak queda 27.658 mil por debajo del BI en 2025 (0,047 %) y 5.420 mil de enero a octubre de 2026. En 2024 coinciden. Se mantiene D5: el portal usa `Informe_ventas`.
- **H2. Ventas de Viventta de 2025: correcto.** Viventta se creó a finales de 2025; por eso solo tiene 7.245.878 en ventas de 2025 y ningún saldo a 31 dic 2024.
- **H3. Diferencia entre compañías de 156.664,00** en el sentido "Viventta debe a Firplak" (octubre de 2026): `pendiente` de revisión por Contabilidad.
- **H4. Meses sin eliminación entre compañías: se mantiene la regla D9** (decisión transmitida por el desarrollador, 2026-11-23). En agosto de 2026 el sentido "Firplak debe a Viventta" no coincide: Firplak registra −485.374.422,68 (23359530) y Viventta 475.284.445,19 (13050505) + 10.329.877,51 (13809510) = 485.614.322,70, con una diferencia de 239.900,02. Por eso no se eliminan los 475.284.445,19 de Clientes de Viventta y el PKT consolidado de agosto es 7,17 %, frente al 6,4 % de Firplak en el BI. El sentido "Viventta debe a Firplak" tampoco coincide en agosto (156.664,00, la misma diferencia de H3). Con D9, el PKT de un mes sube cuando los saldos entre compañías no están cuadrados; el detalle queda en `Informe_pkt_intercompania` para Contabilidad.

**Firma del dueño de negocio:** Claudia Lorena Duque Alzate (Dirección Financiera) — 2026-11-23, 2:46 p. m. — aprobada por chat de Teams ("apruebo la conciliacion"), tras recibir el resumen de diferencias de octubre de 2026, agosto de 2026 y diciembre de 2025 y los hallazgos H1 a H4.

## 7. Despliegue y retiro

- API desplegada (versión / fecha):
- Frontend desplegado (commit / fecha):
- Documentación en VibeWorkFlow: flujo estándar "Consulta del indicador PKT", entorno FIRPLAK, área Contabilidad y finanzas, id `9d4c2e39-567d-4db2-a594-53deea9db3db`, creado el 2026-11-23. Cuatro acciones con su documento (registro en SAP, carga de `Informe_pkt_saldos`, endpoint de la Reporting API y consulta en el portal), responsables por rol (Dirección Financiera y Desarrollador del portal de Indicadores) y el KPI "PKT mensual". `pendiente`: revisión del desarrollador en VibeWorkFlow.
- Power BI retirado (fecha):
- Rollback:
