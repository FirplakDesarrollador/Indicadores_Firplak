-- Fuente: query "Visor OV" de Logística (SAP B1, Query Manager), pasado por el desarrollador el 2026-11-11.
-- Copia textual; no modificar. Análisis en llm-wiki/proyectos/consolidado-comercial.md.

/* Select From [dbo].[ORDR] P0 */
Declare @fecha1 DateTime
/* Where */
Set @fecha1 = /* P0.DocDate */ '[%0]'

/* Select From [dbo].[ORDR] P1 */
Declare @fecha2 DateTime
/* Where */
Set @fecha2 = /* P1.DocDate */ '[%1]'

--Set @fecha1 = '04/11/2022'
--Set @fecha2 = '04/11/2022'
--Declare @DiasProdu int;
--set @DiasProdu= 5;
declare @Contador2 int;
declare @Contador int;
set  @Contador2 =0;
set @Contador=1;


Select T0.DocNum 'DOCUMENTO',t1.ShipDate 'FECHA', T0.U_TipoPedidos 'Tipo_de_Pedido', (CASE when T0.DocStatus = 'O' and T0.Confirmed = 'N'  then 'Abierto NO AUTORIZADO'
when T0.DocStatus = 'O' and T0.Confirmed = 'Y'  then 'Abierto AUTORIZADO'
when T0.DocStatus = 'C' and T0.Confirmed = 'N' and T0.CANCELED = 'N' then 'Cerrado NO AUTORIZADO'
when T0.DocStatus = 'C' and T0.Confirmed = 'Y' and T0.CANCELED = 'N' then 'Cerrado AUTORIZADO'
when T0.DocStatus = 'C' and T0.Confirmed = 'N' and T0.CANCELED = 'Y' then 'Cancelado NO AUTORIZADO'
when T0.DocStatus = 'C' and T0.Confirmed = 'Y' and T0.CANCELED = 'Y' then 'Cancelado AUTORIZADO'
end)'Status',
T0.U_Comentarios 'Orden_Reabierta',
T0.DocNum'Orden_Vta', (T1.VisOrder+1)Item, T0.NumAtCard'Orden Compra Cliente',
	   T0.CardCode'Cod_Cliente', T0.CardName 'Nombre_Cliente'
       ,T10.GROUPNAME 'Grupo de Cliente'
       ,T11.NAME 'Subgrupo de Cliente'
	   ,t17.name as 'Segmento del cliente'
       ,t8.Name'Contacto/Obra', t1.U_DescTiendas'Tienda',t7.CityS'Ciudad_Destino',
       T1.ItemCode'CODIGOARTICULO', t2.U_prefijo, t2.U_Version, t2.U_Color, t1.Dscription 'Descripción_del_Artículo', t2.U_molde'Cod.Molde',
       (Select t10.ItemName from OITM T10 WHERE T10.ItemCode = t2.U_molde) 'Desc_Molde',
ISNULL(t5.QActivos,0) 'Cantidad_Moldes', t1.U_TipoTOC'TipoTOC',
   	   T9.U_FIR_FAM 'FamiliaTOC', T0.DocDate 'Fecha_OV',F0.U_Dias_Distr 'DIAS',

       case
			When DateAdd(day,-1*(isnull(F0.U_Dias_Distr,0)),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(isnull(F0.U_Dias_Distr,0)),t1.shipdate)
			When DateAdd(day,-1*(1+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(1+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(2+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(2+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(3+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(3+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(4+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(4+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(5+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(5+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(6+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(6+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(7+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(7+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(8+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(8+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(9+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(9+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(10+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(10+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(11+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(11+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(12+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(12+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(13+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(13+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(14+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(14+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			When DateAdd(day,-1*(15+(isnull(F0.U_Dias_Distr,0))),t1.ShipDate)	NOT IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0)
			THEN DateAdd(day,-1*(15+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)
			ELSE DateAdd(day,-1*(16+(isnull(F0.U_Dias_Distr,0))),t1.shipdate)END 'Fecha_Plan_Ent_a_CEDI',
 	   T1.ShipDate'Fecha_Plan_Ini_Despacho', t0.DocDueDate'Fecha_Plan_Fin_Despacho',
 	   T1.ShipDate 'Fecha_Plan_Ent_Cliente',
 	   t0.U_FechaCierre 'Fecha Cierre Fact',t1.Quantity 'CantPed',Isnull(t1.DelivrdQty,0)  'Cant_Fact',

	   Isnull(((CASE When (t1.WhsCode = 'PT-02' and (T1.U_TipoTOC like '%MTO%' OR T1.U_TipoTOC like '%MTS%')) Then t6.Quantity
					 WHEN (t1.WhsCode = 'PT-02' and T1.U_TipoTOC like '%PTO%')
					 THEN (Select SUM (C2.Quantity) From POR1 C1 LEFT JOIN PDN1 C2 ON C2.BaseType = C1.ObjType and C2.baseEntry = C1.DocEntry and C2.baseline = C1.linenum and C2.itemcode = C1.itemcode and C2.targetType <> '21'
Where C1.ItemCode = T1.ItemCode and C1.BaseType = T1.ObjType and C1.BaseLine = T1.LineNum and C1.BaseEntry = T1.DocEntry)
					 WHEN (t1.WhsCode <> 'PT-02') THEN t1.Quantity
					 ELSE (Isnull(t1.DelivrdQty,0)) End) -  (Isnull(t1.DelivrdQty,0))),0) 'Cant_Ent_Desp',


       Isnull((Select Sum(t01.PlannedQty-t01.CmpltQty)
               From OWOR t01
               Where t01.Status = 'R' and t01.ItemCode = t1.itemcode and t01.OriginNum = t0.DocNum and
                     case
	when LEN(t01.U_NumLote) - LEN(REPLACE(t01.U_NumLote,'-','')) >= 2
	then IsNull(Convert(Int,SubString(t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1,CharIndex('-',t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1)-CharIndex('-',t01.U_NumLote)-1)-1),0)
	else
	IsNull(Convert(Int,SubString(t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1,2)-1),0)
	end = t1.Visorder),0)'Cant Proc',
       Isnull((Select Sum(t01.PlannedQty)
               From OWOR t01
               Where t01.Status = 'P' and t01.ItemCode = t1.itemcode and t01.OriginNum = t0.DocNum and
               case
	when LEN(t01.U_NumLote) - LEN(REPLACE(t01.U_NumLote,'-','')) >= 2
	then IsNull(Convert(Int,SubString(t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1,CharIndex('-',t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1)-CharIndex('-',t01.U_NumLote)-1)-1),0)
	else
	IsNull(Convert(Int,SubString(t01.U_NumLote,CharIndex('-',t01.U_NumLote)+1,2)-1),0)
	end = t1.Visorder),0)'Cant Planif',


       Isnull((Select (T02.[OnHand] - T02.[IsCommited] ) FROM OITW T02 WHERE  T02.[WhsCode] = 'pt-01' and t02.ItemCode = t1.ItemCode),0)'Cant_Disp_PT-01', t1.WhsCode 'Almacén',
       t1.INMPrice'Precio_Uni Neto', t1.linetotal'Precio_Total', t4.SlpName 'Vendedor',

        case t1.WhsCode
	   when 'PT-01' then t1.U_FechaReserva
	   when 'PT-06' then t1.U_FechaReserva
	   when 'PT-08' then t1.U_FechaReserva
	   when 'PT-03' then t1.U_FechaReserva
	   when 'PT-04' then t1.U_FechaReserva
	   else
	   case when t1.Quantity <= Isnull(t1.DelivrdQty,0) +
	                 Isnull(((CASE When (t1.WhsCode = 'PT-02' and (T1.U_TipoTOC like '%MTO%' OR T1.U_TipoTOC like '%MTS%')) Then t6.Quantity
					 WHEN (t1.WhsCode = 'PT-02' and T1.U_TipoTOC like '%PTO%')
					 THEN (Select SUM (C2.Quantity) From POR1 C1 LEFT JOIN PDN1 C2 ON C2.BaseType = C1.ObjType and C2.baseEntry = C1.DocEntry and C2.baseline = C1.linenum and C2.itemcode = C1.itemcode and C2.targetType <> '21'
                     Where C1.ItemCode = T1.ItemCode and C1.BaseType = T1.ObjType and C1.BaseLine = T1.LineNum and C1.BaseEntry = T1.DocEntry)
					 WHEN (t1.WhsCode <> 'PT-02') THEN t1.Quantity
					 ELSE (Isnull(t1.DelivrdQty,0)) End) -  (Isnull(t1.DelivrdQty,0))),0)
	   then
	   case t1.U_TipoTOC
	   when 'MTOSTD' then (convert(nvarchar,t6.fechaMaxCierre,103) +' 00:00')
	   when 'PTO' then (select (convert(nvarchar,(max(P1.DocDate)),103) + ' 00:00')

	   From OPDN P1
	   Inner Join PDN1 C2 ON P1.DocEntry = C2.DocEntry
	   left join POR1 C1 ON C2.BaseType = C1.ObjType and C2.baseEntry = C1.DocEntry and C2.baseline = C1.linenum and C2.itemcode = C1.itemcode and C2.targetType <> '21'
	   Where C1.ItemCode = T1.ItemCode and C1.BaseType = T1.ObjType and C1.BaseLine = T1.LineNum and C1.BaseEntry = T1.DocEntry)

	   end
	   end
	   end as 'Fecha Real Ent a CEDI'

       ,t0.U_Bloqueado as 'Bloqueado_para_despacho', T1.U_FechaLiberacion as 'Fecha Desbloqueo', T0.U_TipoFacturacion as 'Tipo_Fac'
       ,T0.Header as 'Observaciones_de_Entrega', t6.nuevocompromiso1 as 'Nueva Fecha Entrega PXN',t6.nuevocompromiso2 as 'Nueva Fecha Entrega PXN2'
       ,T0.U_Num_Contenedor
into #temporal
From ORDR T0
inner join RDR1 T1 on t0.DocEntry = t1.DocEntry
inner join OITM T2 on T1.ItemCode = T2.ItemCode
inner join OCRD T3 on t0.CardCode = t3.CardCode
INNER JOIN OCRG T10 ON T3.GROUPCODE = T10.GROUPCODE
INNER JOIN [@FIR_SUBGRUPOCLIENTE] T11 ON T3.U_SUBGROUPCODE = T11.CODE
inner join OSLP T4 on t1.SlpCode = t4.SlpCode
Left Join (Select t0.ItemCode, COUNT(*) QActivos From OSRN t0 Where t0.U_EstadoMolde = 'Activo' Group By ItemCode) t5 On t2.u_molde = t5.ItemCode
Left Join (Select t0.ItemCode, t0.Posicion, SUM(t0.CmpltQty) Quantity, t0.OriginNum, max(t0.CloseDate) fechaMaxCierre, max(t0.fechaprometida1)nuevocompromiso1, max(t0.fechaprometida2)nuevocompromiso2
From (
Select t0.ItemCode,case
	when LEN(t0.U_NumLote) - LEN(REPLACE(t0.U_NumLote,'-','')) >= 2
	then IsNull(Convert(Int,SubString(t0.U_NumLote,CharIndex('-',t0.U_NumLote)+1,CharIndex('-',t0.U_NumLote,CharIndex('-',t0.U_NumLote)+1)-CharIndex('-',t0.U_NumLote)-1)-1),0)
	else
	IsNull(Convert(Int,SubString(t0.U_NumLote,CharIndex('-',t0.U_NumLote)+1,2)-1),0)
	end Posicion, t0.CmpltQty, t0.OriginNum, t0.CloseDate,
case when t0.U_FechaFinalizacionDesatraso is null then null
when t0.duedate>t0.U_FechaFinalizacionDesatraso then t0.duedate

else t0.U_FechaFinalizacionDesatraso end as 'fechaprometida1',
case when t0.U_U_FechaFinalizacionDesatraso2 is null then null
when t0.duedate>t0.U_U_FechaFinalizacionDesatraso2 then t0.duedate

else t0.U_U_FechaFinalizacionDesatraso2 end as 'fechaprometida2'
From OWOR t0
Where t0.Status in ('P','L','R')
Group By t0.ItemCode,t0.U_NumLote, t0.CmpltQty, t0.OriginNum, t0.CloseDate, t0.duedate, t0.U_FechaFinalizacionDesatraso, t0.U_U_FechaFinalizacionDesatraso2) t0
Group By t0.ItemCode, t0.Posicion,t0.OriginNum ) t6 On t1.ItemCode = t6.ItemCode And t1.VisOrder = t6.Posicion and t6.OriginNum = t0.DocNum
Left join RDR12 T7 on t0.DocEntry = t7.DocEntry
Left join OCPR T8 on T0.CntctCode = T8.CntctCode
Left Join [@FIR_FAM_SYMPH] T9 ON T2.U_Familia = T9.U_FIR_FAM_MAES and T0.U_TipoPedidos = T9.U_FIR_TIPO_PED
Left JOIN [@FIR_TIPOPEDIDOS]F0 ON T0.U_TipoPedidos = F0.Code
LEFT JOIN [dbo].[@FIR_SEGMENTACION]  T17 ON T0.[U_Segmentacion] = T17.[Code]
Where t0.DocDate BetWeen @fecha1 And @fecha2
Order by T0.U_TipoPedidos, T0.DocNum



declare @DOCUMENTO VARCHAR(30),
@CODIGOARTICULO VARCHAR(30),
@FECHA DATE,
@Item int,
@DIAS int,
@Fecha_Plan_Ent_a_CEDI DATE,
@FECHADESPACHO DATE,
@FECHACONTABILIZACION DATE

declare CursorFecha Cursor SCROLL for
SELECT DOCUMENTO,Item,Fecha_Plan_Ini_Despacho,DIAS, Fecha_Plan_Ent_a_CEDI, Fecha_Plan_Ini_Despacho, Fecha_Plan_Fin_Despacho
FROM #temporal FOR UPDATE

Open CursorFecha

Fetch from CursorFecha
INTO @DOCUMENTO,@CODIGOARTICULO,@FECHA,@DIAS,@Fecha_Plan_Ent_a_CEDI, @FECHADESPACHO, @FECHACONTABILIZACION

WHILE(@@FETCH_STATUS=0)
BEGIN
		IF(@DIAS IS NULL OR @DIAS=0)
		BEGIN
			Fetch from CursorFecha
			INTO @DOCUMENTO,@CODIGOARTICULO,@FECHA,@DIAS,@Fecha_Plan_Ent_a_CEDI, @FECHADESPACHO, @FECHACONTABILIZACION;
		END
		ELSE BEGIN
			WHILE(@Contador<=(@DIAS+@Contador2))
			BEGIN
				IF(DateAdd(day,-1*(isnull(@Contador,0)),@FECHA) IN (Select F0.U_Fecha FROM [@FIR_FECHAS_PROD] F0))
				BEGIN
					SET @Contador2=@Contador2+1;
					SET @Contador=@Contador+1;
				END
				ELSE BEGIN
					SET @Contador=@Contador+1;
				END
			END

			UPDATE #temporal
			SET Fecha_Plan_Ent_a_CEDI= DateAdd(day,-1*(isnull((@Contador-1),0)),@FECHA)
			WHERE DOCUMENTO=@DOCUMENTO and CODIGOARTICULO=@CODIGOARTICULO and Fecha_Plan_Ini_Despacho=@FECHA
			SET @Contador2=0;
			SET @Contador=1;
			Fetch from CursorFecha
			INTO @DOCUMENTO,@CODIGOARTICULO,@FECHA,@DIAS,@Fecha_Plan_Ent_a_CEDI, @FECHADESPACHO, @FECHACONTABILIZACION;
		END
END

close CursorFecha;
DEALLOCATE CursorFecha;

Declare SumDias cursor For
Select
TA.Documento, TA.Item,DATEADD(DAY,convert(int,isnull(TC.U_DiasTransporte,0)),TA.Fecha_Plan_Ini_Despacho)
From
#temporal TA Inner Join
ORDR TD on TA.DOCUMENTO = TD.DocNum Inner Join
RDR12 TB on TD.DocEntry = TB.DocEntry Inner Join
[Firplak_SA].[dbo].[@FIR_PROMESA_ENTREGA] TC on TB.CityS = TC.Name

OPEN SumDias
FETCH SumDias Into @Documento, @Item,@Fecha
WHILE (@@FETCH_STATUS=0)
 Begin
 Update #temporal set Fecha_Plan_Ent_Cliente = @Fecha Where DOCUMENTO=@DOCUMENTO and Item=@Item
FETCH SumDias Into @Documento, @Item,@Fecha
END
CLOSE SumDias
DEALLOCATE SumDias


Declare cCargue_FEC cursor for
SELECT
TA.DOCUMENTO,
TA.Item,
dateadd(day,(Select isnull(COUNT(U_Fecha_No_Distribucion),0) FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR] Where U_Fecha_No_Distribucion Between TA.Fecha_Plan_Ini_Despacho and dateadd(day,(Select isnull(COUNT(U_Fecha_No_Distribucion),0) FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR] Where U_Fecha_No_Distribucion Between TA.Fecha_Plan_Ini_Despacho and TA.Fecha_Plan_Ent_Cliente),TA.Fecha_Plan_Ent_Cliente)),TA.Fecha_Plan_Ent_Cliente)
FROM #temporal TA

OPEN cCargue_FEC
FETCH cCargue_FEC INTO @Documento,@Item,@Fecha
WHILE (@@FETCH_STATUS=0)
BEGIN
Update #temporal set Fecha_Plan_Ent_Cliente  = @Fecha WHERE #temporal.DOCUMENTO = @DOCUMENTO and #temporal.Item = @Item
FETCH cCargue_FEC INTO @Documento,@Item,@Fecha
END
CLOSE cCargue_FEC
DEALLOCATE cCargue_FEC


Declare cAct_FEC cursor for
SELECT
DOCUMENTO,
Item,
CASE
WHEN Fecha_Plan_Ent_Cliente IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
THEN CASE
       WHEN DATEADD(day,1,Fecha_Plan_Ent_Cliente) IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
       THEN CASE
             WHEN DATEADD(day,2,Fecha_Plan_Ent_Cliente) IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
             THEN CASE
                   WHEN DATEADD(day,3,Fecha_Plan_Ent_Cliente) IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
                   THEN CASE
                           WHEN DATEADD(day,4,Fecha_Plan_Ent_Cliente) IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
                           THEN CASE
                                   WHEN DATEADD(day,5,Fecha_Plan_Ent_Cliente) IN (Select U_Fecha_No_Distribucion FROM [Firplak_SA].[dbo].[@FIR_FECHAS_DISTR])
                                   THEN DATEADD(day,6,Fecha_Plan_Ent_Cliente)
                                   ELSE DATEADD(day,5,Fecha_Plan_Ent_Cliente)
                                   END
                           ELSE DATEADD(day,4,Fecha_Plan_Ent_Cliente)
                           END
                   ELSE DATEADD(day,3,Fecha_Plan_Ent_Cliente)
                   END
             ELSE DATEADD(day,2,Fecha_Plan_Ent_Cliente)
             END
       ELSE DATEADD(day,1,Fecha_Plan_Ent_Cliente)
       END
ELSE Fecha_Plan_Ent_Cliente
END
FROM #temporal

OPEN cAct_FEC
FETCH cAct_FEC INTO @Documento,@Item,@Fecha
WHILE (@@FETCH_STATUS=0)
BEGIN
Update #temporal set Fecha_Plan_Ent_Cliente  = @Fecha WHERE DOCUMENTO = @DOCUMENTO and Item=@Item
FETCH cAct_FEC INTO @Documento,@Item,@Fecha
END
CLOSE cAct_FEC
DEALLOCATE cAct_FEC


SELECT *
FROM #temporal;
DROP TABLE #temporal;
