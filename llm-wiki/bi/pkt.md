---
status: en-migracion
fase: 1
updated: 2026-11-13
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

**Validación del dueño de negocio:** nombre — fecha — `pendiente`

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

### Propuesta de tabla (para la fase 2)

Dos tablas pequeñas en `Planos_Symphony`, porque el PKT solo necesita totales por mes:

1. `dbo.Informe_pkt_saldos`. Una fila por **fin de mes × concepto** (12 conceptos), desde enero de 2020. Columnas: `FechaCorte` (último día del mes; en el mes en curso, la fecha de carga), `Anio`, `Mes`, `Grupo` ("Capital de Trabajo" / "Proveedores de bienes y servicios"), `Concepto`, `Orden`, `Saldo`, `FechaCarga`. El año anterior, el KTNO y el PKT los calcula la API.
2. Ventas netas por mes: **reutilizar `Informe_ventas`** si V4 cuadra y Dirección Financiera acepta sus reglas. Si no, `dbo.Informe_pkt_ventas_mes` (una fila por mes: `Anio`, `Mes`, `VentasNetas`, `FechaCarga`) con las reglas exactas del BI.

Carga incremental: recalcular el año en curso y el anterior en cada ejecución (saldos de meses cerrados pueden cambiar por asientos tardíos), una vez al día antes de las 2:00 p. m. Se define en la fase 2.


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
- Documentación en VibeWorkFlow (flujo, área, id y fecha de aprobación):
- Power BI retirado (fecha):
- Rollback:
