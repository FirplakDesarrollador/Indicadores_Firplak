-- Fuente: query "Tránsito" (SAP B1, Query Manager), pasado por el desarrollador el 2026-11-11.
-- Copia textual; no modificar. Análisis en llm-wiki/proyectos/consolidado-comercial.md.

-- Por solicitud de Daniel Hernandez se agrega el codigo del socio de negocio. Ticket 2537. DJP
-- Se agrega Centro de Costos. 30Sep2024
-- Se Elimina Tipo Envio, se agregan: Fecha CierreFac, ANX?, FechaRetANX, y se cambia el orden de los campos. 29Oct2024

SELECT
	T0.[DocNum] as 'Entrega',
	T0.[CANCELED],T1.[LineStatus] as 'Estado Item',
	T4.[DocNum] as 'Factura',
	T2.[SlpName] as 'Asesor',
	T5.[CardCode] as 'Cod Cliente',
	T5.[CardName] as 'Cliente', T6.[GroupName] as 'Grupo Cliente',
                T1.[CogsOcrCod] as 'Centro de Costos',
	T1.[BaseRef] as 'Orden de Venta',
	T1.[BaseLine]+1 as 'Item',
	T1.[ItemCode] as 'Código Referencia',
	T1.[Dscription] as 'Descripción Referencia',
	T1.[Quantity],
	T0.[U_TipoPedidos] as 'Tipo OV',
	T0.[NumAtCard] as 'Orden de Compra',
	T1.[LineTotal] as 'Valor sin IVA',
                T0.[DocDate] as 'Fecha Doc Ent',
	T0.[U_Transportador],
	T0.[U_NoGuia] as '# Guia',
                T0.[U_FechaDespacho] as 'Fecha Despacho',
	T0.[U_StatusEntrega] as 'Status Entrega',
                T0.[U_NovedadEntrega],
	T0.[U_SolucionNovedad],
	T0.[U_TipoFacturacion] as 'Tipo Fac',
                T0.[U_FechaCierre] as 'Fecha Cierre Fac',
                T0.[U_POD] as 'POD?',
                T0.[U_FechaRealEntregaEnt] as 'Fecha Real Ent',
	T0.[U_FechaRetPOD],
                T0.[U_POF] as 'ANX?', T0.[U_FechaEnvFAC] as 'FechaRetANX',
                T0.[U_FechaEnvPOD],
	T0.[U_ReceiptDocumentRef] as 'Aviso de Recibo',
	T0.[U_FechaRadPOD], T0.[U_FechaRadFAC] as 'FechaProyFAC',
	T0.[Address2] as 'Destino Entrega',
	T0.[Address] as 'Destino POD/Factura'

FROM
	ODLN T0
	INNER JOIN DLN1 T1 ON T0.[DocEntry] = T1.[DocEntry]
	INNER JOIN OSLP T2 ON T0.[SlpCode] = T2.[SlpCode]
	LEFT JOIN INV1 T3 ON T3.[BaseEntry] = T1.[DocEntry] and T3.[BaseType] = T1.[ObjType] and T3.[BaseLine] = T1.[LineNum]
	LEFT JOIN OINV T4 ON T3.[DocEntry] = T4.[DocEntry]
	INNER JOIN OCRD T5 ON T0.[CardCode] = T5.[CardCode]
                INNER JOIN OCRG T6 ON T5.[GroupCode] = T6.[GroupCode]

WHERE
T0.[DocDate] BETWEEN [%0] AND [%1]
