/*
  Facturación diaria, punto 8: Informe_entregas con devoluciones y notas crédito de devolución.
  Ficha: llm-wiki/bi/facturacion-diaria.md (sección "Entregas con devoluciones").

  Base: dbo.SP_Generar_Informe_Entregas compartido por el desarrollador el 2026-11-09 (solo entregas de Firplak).
  Cambios:
    - TipoMovimiento: 'Entrega' (ODLN/DLN1), 'Devolución' (ORDN/RDN1) y 'Nota crédito devolución' (ORIN/RIN1 con
      U_TIPOSNC = '01', decisión del desarrollador 2026-11-10). Las líneas de NC basadas en una devolución
      (BaseType = 16) NO se cargan: esa mercancía ya está en la devolución y se contaría dos veces.
    - Devoluciones y NC se guardan con Cantidad y ValorSinIVA NEGATIVOS: SUM(ValorSinIVA) da las entregas netas.
    - Empresa: solo 'Firplak' (Firplak_SA). Viventta queda fuera (decisión del desarrollador 2026-11-10): en 2026 no
      tiene entregas (ODLN vacío), factura directo.
    - SubgrupoCliente: [@FIR_SUBGRUPOCLIENTE].NAME por OCRD.U_SUBGROUPCODE.
    - DocumentoBase: documento origen de la línea (BaseRef: entrega o factura) en devoluciones y NC.
    - TipoVentas (mercado, 2026-11-09): U_TipoVentas del encabezado, igual que en Informe_ventas.
      Es repetible: para agregarla basta con volver a ejecutar el script completo y luego la carga COMPLETA.
    - Clave: (Empresa, TipoMovimiento, DocEntry, LineNum). DocEntry se repite entre tablas y bases.

  ATENCIÓN: cualquier otro consumidor de Informe_entregas (Power BI, Excel, vistas) verá filas nuevas en negativo.
  Para conservar su resultado anterior debe filtrar TipoMovimiento = N'Entrega' AND Empresa = N'Firplak'.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 0) respaldo  1) columnas y clave  2) SP  3) carga COMPLETA  4) validación  5) desplegar la API
*/

USE [Planos_Symphony];
GO

/* ───────────── 0. Respaldo ─────────────
   - En SSMS: clic derecho en dbo.SP_Generar_Informe_Entregas > Script Procedure as > CREATE To > archivo.
   - Nombre de la clave primaria actual (para el rollback):
       SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.Informe_entregas') AND type = 'PK';
*/

/* ───────────── 1. Columnas nuevas y clave ───────────── */

IF COL_LENGTH(N'dbo.Informe_entregas', N'Empresa') IS NULL
    ALTER TABLE dbo.Informe_entregas ADD Empresa nvarchar(20) NOT NULL
        CONSTRAINT DF_Informe_entregas_Empresa DEFAULT (N'Firplak');
GO
IF COL_LENGTH(N'dbo.Informe_entregas', N'TipoMovimiento') IS NULL
    ALTER TABLE dbo.Informe_entregas ADD TipoMovimiento nvarchar(30) NOT NULL
        CONSTRAINT DF_Informe_entregas_TipoMovimiento DEFAULT (N'Entrega');
GO
IF COL_LENGTH(N'dbo.Informe_entregas', N'SubgrupoCliente') IS NULL
    ALTER TABLE dbo.Informe_entregas ADD SubgrupoCliente nvarchar(100) NULL;
GO
IF COL_LENGTH(N'dbo.Informe_entregas', N'DocumentoBase') IS NULL
    ALTER TABLE dbo.Informe_entregas ADD DocumentoBase nvarchar(50) NULL;
GO
IF COL_LENGTH(N'dbo.Informe_entregas', N'TipoVentas') IS NULL
    ALTER TABLE dbo.Informe_entregas ADD TipoVentas nvarchar(100) NULL;
GO

-- Reemplaza la clave primaria actual (cualquiera que sea su nombre) por la nueva.
-- Reescribe la tabla y necesita bloqueo exclusivo: ejecutar con el job de entregas deshabilitado y con
-- Consulta > Opciones de consulta > Ejecución > Tiempo de espera de ejecución = 0 en SSMS.
-- Va en una transacción con XACT_ABORT: si se cancela o expira, no queda la tabla sin clave.
-- EXEC () no admite funciones como QUOTENAME: el comando se arma antes en una variable.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @pk sysname = (SELECT name FROM sys.key_constraints
                       WHERE parent_object_id = OBJECT_ID(N'dbo.Informe_entregas') AND type = 'PK');
DECLARE @dropPk nvarchar(400);
SELECT @pk AS ClaveAnterior;   -- anotarla para el rollback
IF @pk IS NOT NULL AND @pk <> N'PK_Informe_entregas_Mov'
BEGIN
    SET @dropPk = N'ALTER TABLE dbo.Informe_entregas DROP CONSTRAINT ' + QUOTENAME(@pk) + N';';
    EXEC sys.sp_executesql @dropPk;
END;
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'PK_Informe_entregas_Mov')
    ALTER TABLE dbo.Informe_entregas ADD CONSTRAINT PK_Informe_entregas_Mov
        PRIMARY KEY CLUSTERED (Empresa, TipoMovimiento, DocEntry, LineNum);
COMMIT TRANSACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Informe_entregas') AND name = N'IX_Informe_entregas_Fecha')
    CREATE NONCLUSTERED INDEX IX_Informe_entregas_Fecha ON dbo.Informe_entregas (FechaEntrega)
        INCLUDE (Empresa, TipoMovimiento, Cancelado, CentroCostos, GrupoCliente, SubgrupoCliente, Cantidad, CantidadFacturada, ValorSinIVA);
GO

/* ───────────── 2. SP ───────────── */

ALTER PROCEDURE [dbo].[SP_Generar_Informe_Entregas]
    @Modo      VARCHAR(12) = 'INCREMENTAL',
    @DiasAtras INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Modo NOT IN ('COMPLETA', 'INCREMENTAL')
        THROW 50001, N'@Modo debe ser COMPLETA o INCREMENTAL.', 1;

    DECLARE @FechaInicio DATE = '20200101';
    DECLARE @Desde       DATE = DATEADD(DAY, -@DiasAtras, CAST(GETDATE() AS DATE));
    DECLARE @Completa    BIT  = CASE WHEN @Modo = 'COMPLETA' THEN 1 ELSE 0 END;
    DECLARE @Eliminados  INT  = 0;
    DECLARE @Insertados  INT  = 0;
    DECLARE @LogId       INT;

    INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio) VALUES (N'Entregas', @Modo, SYSDATETIME());
    SET @LogId = SCOPE_IDENTITY();

    -- El TRY cubre también la preparación (#Docs, #Facturas): un error ahí también queda en Cargas_Log.Error.
    BEGIN TRY

    /* -----------------------------------------------------------------
       1. Documentos a procesar, por empresa y tipo de movimiento
          COMPLETA: todos desde @FechaInicio. INCREMENTAL: creados o modificados desde @Desde.
       ----------------------------------------------------------------- */
    CREATE TABLE #Docs (
        Empresa        NVARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL,
        TipoMovimiento NVARCHAR(30) COLLATE DATABASE_DEFAULT NOT NULL,
        DocEntry       INT          NOT NULL,
        PRIMARY KEY (Empresa, TipoMovimiento, DocEntry)
    );

    -- Entregas Firplak, más las entregas cuyas facturas cambiaron (incluye anulaciones de factura)
    INSERT INTO #Docs (Empresa, TipoMovimiento, DocEntry)
    SELECT N'Firplak', N'Entrega', DocEntry
    FROM Firplak_SA.dbo.ODLN WITH (NOLOCK)
    WHERE DocDate >= @FechaInicio
      AND (@Completa = 1 OR CreateDate >= @Desde OR UpdateDate >= @Desde)
    UNION
    SELECT N'Firplak', N'Entrega', I1.BaseEntry
    FROM Firplak_SA.dbo.OINV I0 WITH (NOLOCK)
    INNER JOIN Firplak_SA.dbo.INV1 I1 WITH (NOLOCK) ON I1.DocEntry = I0.DocEntry
    WHERE @Completa = 0
      AND (I0.CreateDate >= @Desde OR I0.UpdateDate >= @Desde)
      AND I1.BaseType = 15
      AND I1.BaseEntry IS NOT NULL;

    -- Devoluciones Firplak
    INSERT INTO #Docs (Empresa, TipoMovimiento, DocEntry)
    SELECT N'Firplak', N'Devolución', DocEntry
    FROM Firplak_SA.dbo.ORDN WITH (NOLOCK)
    WHERE DocDate >= @FechaInicio
      AND (@Completa = 1 OR CreateDate >= @Desde OR UpdateDate >= @Desde);

    -- NC Firplak: se procesan todas las modificadas (aunque ya no sean de devolución) para borrar sus líneas viejas;
    -- el INSERT de abajo solo carga las de U_TIPOSNC = '01'.
    INSERT INTO #Docs (Empresa, TipoMovimiento, DocEntry)
    SELECT N'Firplak', N'Nota crédito devolución', DocEntry
    FROM Firplak_SA.dbo.ORIN WITH (NOLOCK)
    WHERE DocDate >= @FechaInicio
      AND (@Completa = 1 OR CreateDate >= @Desde OR UpdateDate >= @Desde);

    /* -----------------------------------------------------------------
       2. Facturas vigentes agrupadas por línea de entrega
       ----------------------------------------------------------------- */
    CREATE TABLE #Facturas (
        Empresa           NVARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL,
        BaseEntry         INT NOT NULL,
        BaseLine          INT NOT NULL,
        Factura           INT NULL,
        NumFacturas       INT NOT NULL,
        CantidadFacturada DECIMAL(19,6) NULL,
        PRIMARY KEY (Empresa, BaseEntry, BaseLine)
    );

    INSERT INTO #Facturas (Empresa, BaseEntry, BaseLine, Factura, NumFacturas, CantidadFacturada)
    SELECT N'Firplak', I1.BaseEntry, I1.BaseLine, MIN(I0.DocNum), COUNT(DISTINCT I0.DocEntry), SUM(I1.Quantity)
    FROM #Docs D
    INNER JOIN Firplak_SA.dbo.INV1 I1 WITH (NOLOCK) ON I1.BaseEntry = D.DocEntry AND I1.BaseType = 15
    INNER JOIN Firplak_SA.dbo.OINV I0 WITH (NOLOCK) ON I0.DocEntry = I1.DocEntry
    WHERE D.Empresa = N'Firplak' AND D.TipoMovimiento = N'Entrega' AND I0.CANCELED = 'N'
    GROUP BY I1.BaseEntry, I1.BaseLine;

    /* -----------------------------------------------------------------
       3. Reemplazar las líneas en la tabla
       ----------------------------------------------------------------- */
        BEGIN TRANSACTION;

        IF @Completa = 1
            TRUNCATE TABLE dbo.Informe_entregas;   -- Requiere permiso ALTER sobre la tabla
        ELSE
        BEGIN
            DELETE E
            FROM dbo.Informe_entregas E
            INNER JOIN #Docs D
                ON D.Empresa = E.Empresa AND D.TipoMovimiento = E.TipoMovimiento AND D.DocEntry = E.DocEntry;
            SET @Eliminados = @@ROWCOUNT;
        END;

        /* 3.1 Entregas Firplak (consulta original + Empresa, TipoMovimiento y SubgrupoCliente) */
        INSERT INTO dbo.Informe_entregas (
            Empresa, TipoMovimiento, DocEntry, LineNum, Entrega, Cancelado, EstadoItem,
            Factura, NumFacturas, CantidadFacturada,
            FechaEntrega, Asesor, CodCliente, Cliente, GrupoCliente, SubgrupoCliente, CentroCostos,
            OrdenVenta, ItemOrdenVenta, DocumentoBase, TipoVentas, CodigoReferencia, DescripcionReferencia,
            Cantidad, TipoOV, OrdenCompra, ValorSinIVA,
            Transportador, NumeroGuia, FechaDespacho, StatusEntrega,
            NovedadEntrega, SolucionNovedad, TipoFacturacion, FechaCierreFac,
            POD, FechaRealEntrega, FechaRetPOD, ANX, FechaRetANX, FechaEnvPOD,
            AvisoRecibo, FechaRadPOD, FechaProyFAC, DestinoEntrega, DestinoPODFactura
        )
        SELECT
            N'Firplak', N'Entrega',
            T0.DocEntry, T1.LineNum, T0.DocNum, T0.CANCELED, T1.LineStatus,
            F.Factura, ISNULL(F.NumFacturas, 0), F.CantidadFacturada,
            T0.DocDate, T2.SlpName, T5.CardCode, T5.CardName, T6.GroupName, T8.Name, T1.CogsOcrCod,
            T1.BaseRef, T1.BaseLine + 1, NULL, T0.U_TipoVentas, T1.ItemCode, T1.Dscription,
            T1.Quantity, T0.U_TipoPedidos, T0.NumAtCard, T1.LineTotal,
            T0.U_Transportador, T0.U_NoGuia, CAST(T0.U_FechaDespacho AS DATE), T0.U_StatusEntrega,
            T0.U_NovedadEntrega, T0.U_SolucionNovedad, T0.U_TipoFacturacion, CAST(T0.U_FechaCierre AS DATE),
            T0.U_POD, CAST(T0.U_FechaRealEntregaEnt AS DATE), CAST(T0.U_FechaRetPOD AS DATE), T0.U_POF,
            CAST(T0.U_FechaEnvFAC AS DATE), CAST(T0.U_FechaEnvPOD AS DATE),
            T0.U_ReceiptDocumentRef, CAST(T0.U_FechaRadPOD AS DATE), CAST(T0.U_FechaRadFAC AS DATE),
            T0.Address2, T0.Address
        FROM #Docs D
        INNER JOIN Firplak_SA.dbo.ODLN T0 WITH (NOLOCK) ON T0.DocEntry = D.DocEntry
        INNER JOIN Firplak_SA.dbo.DLN1 T1 WITH (NOLOCK) ON T1.DocEntry = T0.DocEntry
        INNER JOIN Firplak_SA.dbo.OCRD T5 WITH (NOLOCK) ON T5.CardCode = T0.CardCode
        INNER JOIN Firplak_SA.dbo.OCRG T6 WITH (NOLOCK) ON T6.GroupCode = T5.GroupCode
        LEFT  JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] T8 WITH (NOLOCK) ON T8.Code = T5.U_SUBGROUPCODE
        LEFT  JOIN Firplak_SA.dbo.OSLP T2 WITH (NOLOCK) ON T2.SlpCode = T0.SlpCode
        LEFT  JOIN #Facturas F ON F.Empresa = N'Firplak' AND F.BaseEntry = T1.DocEntry AND F.BaseLine = T1.LineNum
        WHERE D.Empresa = N'Firplak' AND D.TipoMovimiento = N'Entrega'
          AND T0.DocDate >= @FechaInicio
          AND T0.CANCELED <> 'C'          -- documento espejo de una cancelación
        OPTION (MAXDOP 4, RECOMPILE);
        SET @Insertados += @@ROWCOUNT;

        /* 3.2 Devoluciones Firplak (en negativo). Sin facturas ni campos logísticos de la entrega. */
        INSERT INTO dbo.Informe_entregas (
            Empresa, TipoMovimiento, DocEntry, LineNum, Entrega, Cancelado, EstadoItem,
            Factura, NumFacturas, CantidadFacturada,
            FechaEntrega, Asesor, CodCliente, Cliente, GrupoCliente, SubgrupoCliente, CentroCostos,
            OrdenVenta, ItemOrdenVenta, DocumentoBase, TipoVentas, CodigoReferencia, DescripcionReferencia,
            Cantidad, TipoOV, OrdenCompra, ValorSinIVA, DestinoEntrega, DestinoPODFactura
        )
        SELECT
            N'Firplak', N'Devolución',
            T0.DocEntry, T1.LineNum, T0.DocNum, T0.CANCELED, T1.LineStatus,
            NULL, 0, NULL,
            T0.DocDate, T2.SlpName, T5.CardCode, T5.CardName, T6.GroupName, T8.Name, T1.CogsOcrCod,
            NULL, NULL, T1.BaseRef, T0.U_TipoVentas, T1.ItemCode, T1.Dscription,
            -T1.Quantity, T0.U_TipoPedidos, T0.NumAtCard, -T1.LineTotal, T0.Address2, T0.Address
        FROM #Docs D
        INNER JOIN Firplak_SA.dbo.ORDN T0 WITH (NOLOCK) ON T0.DocEntry = D.DocEntry
        INNER JOIN Firplak_SA.dbo.RDN1 T1 WITH (NOLOCK) ON T1.DocEntry = T0.DocEntry
        INNER JOIN Firplak_SA.dbo.OCRD T5 WITH (NOLOCK) ON T5.CardCode = T0.CardCode
        INNER JOIN Firplak_SA.dbo.OCRG T6 WITH (NOLOCK) ON T6.GroupCode = T5.GroupCode
        LEFT  JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] T8 WITH (NOLOCK) ON T8.Code = T5.U_SUBGROUPCODE
        LEFT  JOIN Firplak_SA.dbo.OSLP T2 WITH (NOLOCK) ON T2.SlpCode = T0.SlpCode
        WHERE D.Empresa = N'Firplak' AND D.TipoMovimiento = N'Devolución'
          AND T0.DocDate >= @FechaInicio
          AND T0.CANCELED <> 'C'
        OPTION (MAXDOP 4, RECOMPILE);
        SET @Insertados += @@ROWCOUNT;

        /* 3.3 NC de devolución Firplak (en negativo): U_TIPOSNC = '01' y línea no basada en una devolución */
        INSERT INTO dbo.Informe_entregas (
            Empresa, TipoMovimiento, DocEntry, LineNum, Entrega, Cancelado, EstadoItem,
            Factura, NumFacturas, CantidadFacturada,
            FechaEntrega, Asesor, CodCliente, Cliente, GrupoCliente, SubgrupoCliente, CentroCostos,
            OrdenVenta, ItemOrdenVenta, DocumentoBase, TipoVentas, CodigoReferencia, DescripcionReferencia,
            Cantidad, TipoOV, OrdenCompra, ValorSinIVA, DestinoEntrega, DestinoPODFactura
        )
        SELECT
            N'Firplak', N'Nota crédito devolución',
            T0.DocEntry, T1.LineNum, T0.DocNum, T0.CANCELED, T1.LineStatus,
            NULL, 0, NULL,
            T0.DocDate, T2.SlpName, T5.CardCode, T5.CardName, T6.GroupName, T8.Name, T1.CogsOcrCod,
            NULL, NULL, T1.BaseRef, T0.U_TipoVentas, T1.ItemCode, T1.Dscription,
            -T1.Quantity, T0.U_TipoPedidos, T0.NumAtCard, -T1.LineTotal, T0.Address2, T0.Address
        FROM #Docs D
        INNER JOIN Firplak_SA.dbo.ORIN T0 WITH (NOLOCK) ON T0.DocEntry = D.DocEntry
        INNER JOIN Firplak_SA.dbo.RIN1 T1 WITH (NOLOCK) ON T1.DocEntry = T0.DocEntry
        INNER JOIN Firplak_SA.dbo.OCRD T5 WITH (NOLOCK) ON T5.CardCode = T0.CardCode
        INNER JOIN Firplak_SA.dbo.OCRG T6 WITH (NOLOCK) ON T6.GroupCode = T5.GroupCode
        LEFT  JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] T8 WITH (NOLOCK) ON T8.Code = T5.U_SUBGROUPCODE
        LEFT  JOIN Firplak_SA.dbo.OSLP T2 WITH (NOLOCK) ON T2.SlpCode = T0.SlpCode
        WHERE D.Empresa = N'Firplak' AND D.TipoMovimiento = N'Nota crédito devolución'
          AND T0.DocDate >= @FechaInicio
          AND T0.CANCELED <> 'C'
          AND T0.U_TIPOSNC = N'01'
          AND ISNULL(T1.BaseType, -1) <> 16      -- 16 = Devolución: ya está en 3.2
        OPTION (MAXDOP 4, RECOMPILE);
        SET @Insertados += @@ROWCOUNT;

        COMMIT TRANSACTION;

        UPDATE dbo.Cargas_Log SET Fin = SYSDATETIME(), Eliminados = @Eliminados, Insertados = @Insertados
        WHERE Id = @LogId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        UPDATE dbo.Cargas_Log SET Fin = SYSDATETIME(), Error = ERROR_MESSAGE() WHERE Id = @LogId;
        THROW;
    END CATCH
END;
GO

/* ───────────── 3. Primera carga ───────────── */
-- EXEC dbo.SP_Generar_Informe_Entregas @Modo = 'COMPLETA';
-- SELECT TOP 3 * FROM dbo.Cargas_Log WHERE Proceso = N'Entregas' ORDER BY Id DESC;   -- Error debe ser NULL

/* ───────────── 4. Validación ───────────── */

-- 4.1 Entregas de Firplak: deben coincidir con el total anterior a este cambio (mismas filas que el SP original).
SELECT YEAR(FechaEntrega) AS Anio, MONTH(FechaEntrega) AS Mes, COUNT(*) AS Lineas, SUM(ValorSinIVA) AS Valor
FROM dbo.Informe_entregas
WHERE Empresa = N'Firplak' AND TipoMovimiento = N'Entrega' AND FechaEntrega >= '20260101'
GROUP BY YEAR(FechaEntrega), MONTH(FechaEntrega) ORDER BY Anio, Mes;

-- 4.2 Resumen por empresa y tipo (devoluciones y NC deben salir en negativo).
SELECT Empresa, TipoMovimiento, COUNT(*) AS Lineas, SUM(Cantidad) AS Cantidad, SUM(ValorSinIVA) AS Valor,
       SUM(CASE WHEN Cancelado = 'Y' THEN ValorSinIVA ELSE 0 END) AS ValorAnulado
FROM dbo.Informe_entregas
WHERE FechaEntrega >= '20260101'
GROUP BY Empresa, TipoMovimiento ORDER BY Empresa, TipoMovimiento;

-- 4.3 Doble conteo: NC de tipo devolución basadas en una devolución (excluidas). Si hay muchas, la regla funciona;
--     si hay NC de devolución sin devolución previa y también devoluciones de la misma factura, revisarlas a mano.
SELECT T0.U_TIPOSNC AS TipoNC, ISNULL(T1.BaseType, -1) AS BaseType, COUNT(*) AS Lineas, SUM(T1.LineTotal) AS Valor
FROM Firplak_SA.dbo.ORIN T0
INNER JOIN Firplak_SA.dbo.RIN1 T1 ON T1.DocEntry = T0.DocEntry
WHERE T0.DocDate >= '20260101' AND T0.CANCELED = 'N' AND T0.U_TIPOSNC = N'01'
GROUP BY T0.U_TIPOSNC, ISNULL(T1.BaseType, -1) ORDER BY TipoNC, BaseType;

-- 4.5 Mercado: deben salir Nacional y Exterior (y vacío solo si SAP no lo tiene en el documento).
SELECT Empresa, TipoMovimiento, TipoVentas, COUNT(*) AS Lineas, SUM(ValorSinIVA) AS Valor
FROM dbo.Informe_entregas
WHERE FechaEntrega >= '20260101'
GROUP BY Empresa, TipoMovimiento, TipoVentas ORDER BY Empresa, TipoMovimiento, TipoVentas;

-- 4.4 Empresa del filtro: cuánto queda en CEFI (centro de costos de la línea, DLN1.CogsOcrCod).
SELECT CASE WHEN Empresa = N'Viventta' THEN N'Viventta'
            WHEN CHARINDEX(N'CEFI', UPPER(CentroCostos)) > 0 THEN N'CEFI' ELSE N'Firplak' END AS EmpresaFiltro,
       CentroCostos, COUNT(*) AS Lineas, SUM(ValorSinIVA) AS Valor
FROM dbo.Informe_entregas
WHERE FechaEntrega >= '20260101'
GROUP BY CASE WHEN Empresa = N'Viventta' THEN N'Viventta'
              WHEN CHARINDEX(N'CEFI', UPPER(CentroCostos)) > 0 THEN N'CEFI' ELSE N'Firplak' END, CentroCostos
ORDER BY EmpresaFiltro, Valor DESC;

/* ───────────── Rollback ─────────────
   1. Ejecutar el respaldo del SP como ALTER PROCEDURE.
   2. DELETE FROM dbo.Informe_entregas WHERE Empresa <> N'Firplak' OR TipoMovimiento <> N'Entrega';
   3. ALTER TABLE dbo.Informe_entregas DROP CONSTRAINT PK_Informe_entregas_Mov;
      ALTER TABLE dbo.Informe_entregas ADD CONSTRAINT <nombre anterior> PRIMARY KEY CLUSTERED (DocEntry, LineNum);
   4. Las columnas nuevas pueden quedarse (el SP anterior no las usa) o quitarse:
      DROP INDEX IX_Informe_entregas_Fecha ON dbo.Informe_entregas;   -- si se creó aquí
      ALTER TABLE dbo.Informe_entregas DROP CONSTRAINT DF_Informe_entregas_Empresa, DF_Informe_entregas_TipoMovimiento;
      ALTER TABLE dbo.Informe_entregas DROP COLUMN Empresa, TipoMovimiento, SubgrupoCliente, DocumentoBase, TipoVentas;
   5. EXEC dbo.SP_Generar_Informe_Entregas @Modo = 'COMPLETA';
   6. Volver a desplegar la API anterior: la nueva lee las columnas nuevas.
*/
