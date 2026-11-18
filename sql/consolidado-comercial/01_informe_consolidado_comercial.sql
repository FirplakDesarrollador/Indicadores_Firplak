/*
  Consolidado comercial SAP: tabla de reporte de A (ofertas), B (OV pendientes) y C (tránsito)
  + SP de recarga completa. D (facturación neta) se lee de dbo.Informe_ventas.
  Ficha: llm-wiki/proyectos/consolidado-comercial.md (decisiones 4 y 17).
  Origen de las reglas: proyectos/consolidado-comercial/sql/08-query-b-c.sql y 09-query-a.sql
  (validados por el desarrollador el 2026-11-11 y el 2026-11-13).

  Revisión y ejecución: SOLO el desarrollador o TI, primero en pruebas si existe.
  Orden: 1) bitácora  2) tabla e índices  3) SP  4) primera carga  5) validación  6) job

  Compatibilidad: Planos_Symphony y Firplak_SA están en nivel 100 (SQL Server 2016 SP2).
  Sin CTE, APPLY, TRY_CONVERT, CREATE OR ALTER ni THROW. SAP solo se lee (SELECT).

  Por qué recarga completa y no incremental: A, B y C son saldos abiertos. Una línea sale del
  universo cuando se convierte, entrega o factura, sin que cambie una fecha que sirva de ventana.
  Son ~4.000 líneas en todos los canales: la recarga tarda segundos.
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Bitácora de cargas ─────────────
   PROPUESTA de la plantilla del repositorio. Ya existe dbo.Cargas_Log (2.211 filas): si TI
   prefiere usarla, reemplazar los INSERT/UPDATE de la bitácora en el SP por sus columnas. */
IF OBJECT_ID(N'dbo.Bitacora_Cargas_Informes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Bitacora_Cargas_Informes (
        Id               bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Bitacora_Cargas_Informes PRIMARY KEY,
        Informe          sysname        NOT NULL,
        Inicio           datetime2(0)   NOT NULL,
        Fin              datetime2(0)   NULL,
        FechaDesde       date           NULL,
        FilasEliminadas  int            NULL,
        FilasInsertadas  int            NULL,
        Estado           varchar(20)    NOT NULL,   -- EN_CURSO | OK | ERROR
        Mensaje          nvarchar(4000) NULL
    );
END
GO

/* ───────────── 2. Tabla de reporte ───────────── */
IF OBJECT_ID(N'dbo.Informe_consolidado_comercial', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_consolidado_comercial (
        -- Grano: una fila por línea de documento abierto
        Etapa                 varchar(12)    NOT NULL,   -- A_OFERTA | B_OV | C_TRANSITO
        ObjType               int            NOT NULL,   -- 23 | 17 | 15
        DocEntry              int            NOT NULL,
        LineNum               int            NOT NULL,
        DocNum                int            NOT NULL,
        FechaDocumento        date           NOT NULL,
        ValidaHasta           date           NULL,       -- solo A (OQUT.DocDueDate)
        Vigencia              varchar(10)    NULL,       -- solo A: Vigente | Vencida
        -- Cliente y canal
        CodCliente            nvarchar(50)   NOT NULL,
        Cliente               nvarchar(200)  NULL,
        GrupoCodigo           int            NULL,       -- OCRD.GroupCode (113 = Canal B2C)
        Canal                 nvarchar(100)  NULL,       -- OCRG.GroupName
        SubgrupoCodigo        nvarchar(50)   NULL,       -- OCRD.U_SubGroupCode
        Subgrupo              nvarchar(100)  NULL,
        SegmentoB2C           nvarchar(20)   NOT NULL,   -- Firplak Home | Ecommerce | MAC | Otro
        -- Asesor: sin tienda en la línea -> vendedor del encabezado; con tienda -> vendedor del cliente-tienda
        SlpCode               int            NULL,
        Asesor                nvarchar(155)  NULL,
        -- Centro de costos: OcrCode de la línea; si está vacío, OCRD.U_CentrodeCtos
        CentroCostos          nvarchar(20)   NULL,
        CentroCostosNombre    nvarchar(100)  NULL,
        CentroCostosVigente   nvarchar(20)   NULL,       -- GV-BHMED -> GV-FHMED, GV-BHCAL -> GV-FHCAL (pendiente Contabilidad)
        OrigenCentroCostos    varchar(10)    NOT NULL,   -- Linea | Cliente
        -- Atributos de filtro
        TipoOV                nvarchar(10)   NULL,
        TipoOVNombre          nvarchar(100)  NULL,
        StatusEntrega         nvarchar(20)   NULL,       -- solo C
        StatusEntregaNombre   nvarchar(100)  NULL,
        EstadoOferta          nvarchar(10)   NULL,       -- solo A
        EstadoOfertaNombre    nvarchar(100)  NULL,
        FechaDespacho         date           NULL,       -- A y B: ShipDate de la línea; C: U_FechaDespacho o DocDate
        FechaProyFAC          date           NULL,       -- solo C: ODLN.U_FechaRadFAC
        TipoVentas            nvarchar(30)   NULL,
        Autorizada            char(1)        NULL,       -- Confirmed
        BloqueoOV             nvarchar(50)   NULL,       -- solo B: ORDR.U_Bloqueado
        BloqueoLinea          bit            NOT NULL,   -- solo B: U_Bloqueado = SI, U_BloqueoLogistica = 1 o "NO DESPACHAR"
        -- Artículo y valores (COP, sin IVA)
        ItemCode              nvarchar(50)   NULL,
        Descripcion           nvarchar(200)  NULL,
        Cantidad              decimal(19, 6) NOT NULL,
        CantidadAbierta       decimal(19, 6) NOT NULL,
        ValorLinea            decimal(19, 6) NOT NULL,
        Saldo                 decimal(19, 6) NOT NULL,   -- ValorLinea * CantidadAbierta / Cantidad
        -- Marcas de los filtros por defecto (1 = la regla de la guía excluye la fila)
        TipoOVExcluido        bit            NOT NULL,   -- 4, 6, 7, 9, 12, 15 (en A no se aplica al default)
        StatusExcluido        bit            NOT NULL,   -- solo C: 3, 4, 9
        ProyFACFueraDeMes     bit            NOT NULL,   -- solo C: fecha fuera del mes en curso (vacía = 0)
        Donacion              bit            NOT NULL,
        EnDefault             bit            NOT NULL,   -- B2C sin MAC + reglas de la etapa
        -- Auditoría
        FechaCarga            datetime2(0)   NOT NULL
            CONSTRAINT DF_Informe_consolidado_comercial_FechaCarga DEFAULT (sysdatetime()),
        CONSTRAINT PK_Informe_consolidado_comercial PRIMARY KEY CLUSTERED (Etapa, DocEntry, LineNum)
    );

    -- Totales del tablero: siempre filtran por default y etapa.
    CREATE NONCLUSTERED INDEX IX_Informe_consolidado_comercial_Default
        ON dbo.Informe_consolidado_comercial (EnDefault, Etapa)
        INCLUDE (Saldo, SlpCode, SegmentoB2C, CentroCostosVigente);

    -- Filtro por asesor.
    CREATE NONCLUSTERED INDEX IX_Informe_consolidado_comercial_Asesor
        ON dbo.Informe_consolidado_comercial (SlpCode, Etapa)
        INCLUDE (Saldo, EnDefault);
END
GO

/* ───────────── 3. SP de recarga ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_consolidado_comercial', N'P') IS NULL
    EXEC (N'CREATE PROCEDURE dbo.sp_Actualizar_Informe_consolidado_comercial AS RETURN 0;');
GO

ALTER PROCEDURE dbo.sp_Actualizar_Informe_consolidado_comercial
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    -- Igual que los scripts de validación: lectura sin bloqueos sobre SAP.
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    DECLARE @BitacoraId bigint;
    DECLARE @Eliminadas int = 0;
    DECLARE @Insertadas int = 0;
    DECLARE @InicioMes date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
    DECLARE @InicioMesSiguiente date = DATEADD(month, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1));
    DECLARE @Hoy date = CAST(GETDATE() AS date);
    DECLARE @Error nvarchar(4000);

    INSERT INTO dbo.Bitacora_Cargas_Informes (Informe, Inicio, FechaDesde, Estado)
    VALUES (N'Informe_consolidado_comercial', sysdatetime(), NULL, 'EN_CURSO');
    SET @BitacoraId = SCOPE_IDENTITY();

    BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.Informe_consolidado_comercial;
        SET @Eliminadas = @@ROWCOUNT;

        INSERT INTO dbo.Informe_consolidado_comercial (
            Etapa, ObjType, DocEntry, LineNum, DocNum, FechaDocumento, ValidaHasta, Vigencia,
            CodCliente, Cliente, GrupoCodigo, Canal, SubgrupoCodigo, Subgrupo, SegmentoB2C,
            SlpCode, Asesor, CentroCostos, CentroCostosNombre, CentroCostosVigente, OrigenCentroCostos,
            TipoOV, TipoOVNombre, StatusEntrega, StatusEntregaNombre, EstadoOferta, EstadoOfertaNombre,
            FechaDespacho, FechaProyFAC, TipoVentas, Autorizada, BloqueoOV, BloqueoLinea,
            ItemCode, Descripcion, Cantidad, CantidadAbierta, ValorLinea, Saldo,
            TipoOVExcluido, StatusExcluido, ProyFACFueraDeMes, Donacion, EnDefault
        )
        SELECT
            Y.Etapa, Y.ObjType, Y.DocEntry, Y.LineNum, Y.DocNum, Y.FechaDocumento, Y.ValidaHasta,
            CASE WHEN Y.Etapa = 'A_OFERTA' THEN CASE WHEN Y.ValidaHasta >= @Hoy THEN 'Vigente' ELSE 'Vencida' END END,
            Y.CodCliente, Y.Cliente, Y.GrupoCodigo, Y.Canal, Y.SubgrupoCodigo, Y.Subgrupo, Y.SegmentoB2C,
            Y.SlpCode, P.SlpName, Y.CentroCostos, R.OcrName,
            CASE Y.CentroCostos WHEN N'GV-BHMED' THEN N'GV-FHMED' WHEN N'GV-BHCAL' THEN N'GV-FHCAL' ELSE Y.CentroCostos END,
            Y.OrigenCentroCostos,
            Y.TipoOV, TP.Name, Y.StatusEntrega, VS.Descr, Y.EstadoOferta, VE.Descr,
            Y.FechaDespacho, Y.FechaProyFAC, Y.TipoVentas, Y.Autorizada, Y.BloqueoOV, Y.BloqueoLinea,
            Y.ItemCode, Y.Descripcion, Y.Cantidad, Y.CantidadAbierta, Y.ValorLinea, Y.Saldo,
            Y.TipoOVExcluido, Y.StatusExcluido, Y.ProyFACFueraDeMes, Y.Donacion,
            CASE WHEN Y.GrupoCodigo = 113
                  AND Y.SubgrupoCodigo IN (N'106-01', N'106-02')
                  AND Y.Donacion = 0
                  AND (Y.Etapa = 'A_OFERTA' OR Y.TipoOVExcluido = 0)
                  AND Y.StatusExcluido = 0
                  AND Y.ProyFACFueraDeMes = 0
                 THEN 1 ELSE 0 END
        FROM (
            SELECT X.*,
                   CASE X.SubgrupoCodigo WHEN N'106-01' THEN N'Firplak Home' WHEN N'106-02' THEN N'Ecommerce'
                                         WHEN N'106-04' THEN N'MAC' ELSE N'Otro' END AS SegmentoB2C,
                   CASE WHEN X.TipoOV IN (N'4', N'6', N'7', N'9', N'12', N'15') THEN 1 ELSE 0 END AS TipoOVExcluido,
                   CASE WHEN X.StatusEntrega IN (N'3', N'4', N'9') THEN 1 ELSE 0 END AS StatusExcluido,
                   CASE WHEN X.FechaProyFAC IS NULL THEN 0
                        WHEN X.FechaProyFAC >= @InicioMes AND X.FechaProyFAC < @InicioMesSiguiente THEN 0
                        ELSE 1 END AS ProyFACFueraDeMes,
                   CASE WHEN X.TipoVentas = N'Donaciones' THEN 1 ELSE 0 END AS Donacion
            FROM (
                /* A. Ofertas abiertas */
                SELECT 'A_OFERTA' AS Etapa, 23 AS ObjType, H.DocEntry, L.LineNum, H.DocNum,
                       CAST(H.DocDate AS date) AS FechaDocumento, CAST(H.DocDueDate AS date) AS ValidaHasta,
                       H.CardCode AS CodCliente, H.CardName AS Cliente, C.GroupCode AS GrupoCodigo, G.GroupName AS Canal,
                       C.U_SubGroupCode AS SubgrupoCodigo, S.Name AS Subgrupo,
                       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END AS SlpCode,
                       ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), N''), C.U_CentrodeCtos) AS CentroCostos,
                       CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), N'') IS NULL THEN 'Cliente' ELSE 'Linea' END AS OrigenCentroCostos,
                       NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), N'') AS TipoOV,
                       CAST(NULL AS nvarchar(20)) AS StatusEntrega,
                       NULLIF(LTRIM(RTRIM(CAST(H.U_Estado_Oferta_Venta AS nvarchar(10)))), N'') AS EstadoOferta,
                       CAST(L.ShipDate AS date) AS FechaDespacho,
                       CAST(NULL AS date) AS FechaProyFAC,
                       CAST(H.U_TipoVentas AS nvarchar(30)) AS TipoVentas,
                       H.Confirmed AS Autorizada,
                       CAST(NULL AS nvarchar(50)) AS BloqueoOV,
                       CAST(0 AS bit) AS BloqueoLinea,
                       L.ItemCode, L.Dscription AS Descripcion, L.Quantity AS Cantidad, L.OpenQty AS CantidadAbierta,
                       L.LineTotal AS ValorLinea,
                       CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END AS Saldo
                FROM Firplak_SA.dbo.OQUT H
                JOIN Firplak_SA.dbo.QUT1 L ON L.DocEntry = H.DocEntry
                LEFT JOIN Firplak_SA.dbo.OCRD C ON C.CardCode = H.CardCode
                LEFT JOIN Firplak_SA.dbo.OCRG G ON G.GroupCode = C.GroupCode
                LEFT JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
                LEFT JOIN Firplak_SA.dbo.OCRD T ON T.CardCode = L.U_Tiendas
                WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'

                UNION ALL

                /* B. OV pendientes */
                SELECT 'B_OV', 17, H.DocEntry, L.LineNum, H.DocNum,
                       CAST(H.DocDate AS date), NULL,
                       H.CardCode, H.CardName, C.GroupCode, G.GroupName,
                       C.U_SubGroupCode, S.Name,
                       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END,
                       ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), N''), C.U_CentrodeCtos),
                       CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), N'') IS NULL THEN 'Cliente' ELSE 'Linea' END,
                       NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), N''),
                       NULL,
                       NULL,
                       CAST(L.ShipDate AS date),
                       NULL,
                       CAST(H.U_TipoVentas AS nvarchar(30)),
                       H.Confirmed,
                       ISNULL(CAST(H.U_Bloqueado AS nvarchar(50)), N''),
                       CAST(CASE WHEN CAST(L.U_Bloqueado AS nvarchar(10)) = N'SI'
                                   OR CAST(L.U_BloqueoLogistica AS nvarchar(10)) = N'1'
                                   OR CAST(L.U_Comentarios AS nvarchar(200)) LIKE N'%NO DESPACHAR%'
                                 THEN 1 ELSE 0 END AS bit),
                       L.ItemCode, L.Dscription, L.Quantity, L.OpenQty, L.LineTotal,
                       CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END
                FROM Firplak_SA.dbo.ORDR H
                JOIN Firplak_SA.dbo.RDR1 L ON L.DocEntry = H.DocEntry
                LEFT JOIN Firplak_SA.dbo.OCRD C ON C.CardCode = H.CardCode
                LEFT JOIN Firplak_SA.dbo.OCRG G ON G.GroupCode = C.GroupCode
                LEFT JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
                LEFT JOIN Firplak_SA.dbo.OCRD T ON T.CardCode = L.U_Tiendas
                WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'

                UNION ALL

                /* C. Tránsito: entregado sin facturar */
                SELECT 'C_TRANSITO', 15, H.DocEntry, L.LineNum, H.DocNum,
                       CAST(H.DocDate AS date), NULL,
                       H.CardCode, H.CardName, C.GroupCode, G.GroupName,
                       C.U_SubGroupCode, S.Name,
                       CASE WHEN ISNULL(DATALENGTH(L.U_Tiendas), 0) = 0 THEN H.SlpCode ELSE T.SlpCode END,
                       ISNULL(NULLIF(LTRIM(RTRIM(L.OcrCode)), N''), C.U_CentrodeCtos),
                       CASE WHEN NULLIF(LTRIM(RTRIM(L.OcrCode)), N'') IS NULL THEN 'Cliente' ELSE 'Linea' END,
                       NULLIF(LTRIM(RTRIM(CAST(H.U_TipoPedidos AS nvarchar(10)))), N''),
                       NULLIF(LTRIM(RTRIM(CAST(H.U_StatusEntrega AS nvarchar(20)))), N''),
                       NULL,
                       CAST(ISNULL(H.U_FechaDespacho, H.DocDate) AS date),
                       CAST(H.U_FechaRadFAC AS date),
                       CAST(H.U_TipoVentas AS nvarchar(30)),
                       H.Confirmed,
                       NULL,
                       CAST(0 AS bit),
                       L.ItemCode, L.Dscription, L.Quantity, L.OpenQty, L.LineTotal,
                       CASE WHEN L.Quantity <> 0 THEN L.LineTotal * L.OpenQty / L.Quantity ELSE 0 END
                FROM Firplak_SA.dbo.ODLN H
                JOIN Firplak_SA.dbo.DLN1 L ON L.DocEntry = H.DocEntry
                LEFT JOIN Firplak_SA.dbo.OCRD C ON C.CardCode = H.CardCode
                LEFT JOIN Firplak_SA.dbo.OCRG G ON G.GroupCode = C.GroupCode
                LEFT JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] S ON S.Code = C.U_SubGroupCode
                LEFT JOIN Firplak_SA.dbo.OCRD T ON T.CardCode = L.U_Tiendas
                WHERE H.CANCELED = 'N' AND L.LineStatus = 'O'
            ) X
        ) Y
        LEFT JOIN Firplak_SA.dbo.OSLP P ON P.SlpCode = Y.SlpCode
        LEFT JOIN Firplak_SA.dbo.OOCR R ON R.OcrCode = Y.CentroCostos
        LEFT JOIN Firplak_SA.dbo.[@FIR_TIPOPEDIDOS] TP ON TP.Code = Y.TipoOV
        -- Nombres de Status entrega y estado de oferta desde la lista de valores del campo de usuario.
        LEFT JOIN Firplak_SA.dbo.CUFD FS ON FS.TableID = 'ODLN' AND FS.AliasID = 'StatusEntrega'
        LEFT JOIN Firplak_SA.dbo.UFD1 VS ON VS.TableID = FS.TableID AND VS.FieldID = FS.FieldID AND VS.FldValue = Y.StatusEntrega
        LEFT JOIN Firplak_SA.dbo.CUFD FE ON FE.TableID = 'OQUT' AND FE.AliasID = 'Estado_Oferta_Venta'
        LEFT JOIN Firplak_SA.dbo.UFD1 VE ON VE.TableID = FE.TableID AND VE.FieldID = FE.FieldID AND VE.FldValue = Y.EstadoOferta;

        SET @Insertadas = @@ROWCOUNT;

        COMMIT TRANSACTION;

        UPDATE dbo.Bitacora_Cargas_Informes
        SET Fin = sysdatetime(), FilasEliminadas = @Eliminadas, FilasInsertadas = @Insertadas, Estado = 'OK'
        WHERE Id = @BitacoraId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        UPDATE dbo.Bitacora_Cargas_Informes
        SET Fin = sysdatetime(), Estado = 'ERROR', Mensaje = @Error
        WHERE Id = @BitacoraId;

        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 4. Primera carga (la ejecuta el desarrollador) ───────────── */
EXEC dbo.sp_Actualizar_Informe_consolidado_comercial;

/* ───────────── 5. Validación (solo lectura) ─────────────
   Correr justo después de la carga. Comparar con la pestaña 1 de 08-query-b-c.sql y de
   09-query-a.sql corridas al mismo tiempo: líneas y saldos deben coincidir por etapa. */
SELECT Etapa,
       COUNT(*) AS Lineas, SUM(Saldo) AS TodosCanales,
       SUM(CASE WHEN GrupoCodigo = 113 THEN Saldo ELSE 0 END) AS B2C,
       SUM(CASE WHEN EnDefault = 1 THEN 1 ELSE 0 END) AS LineasDefault,
       SUM(CASE WHEN EnDefault = 1 THEN Saldo ELSE 0 END) AS SaldoDefault,
       SUM(CASE WHEN StatusEntrega IS NOT NULL AND StatusEntregaNombre IS NULL THEN 1 ELSE 0 END) AS StatusSinNombre_0,
       SUM(CASE WHEN EstadoOferta IS NOT NULL AND EstadoOfertaNombre IS NULL THEN 1 ELSE 0 END) AS EstadoSinNombre_0,
       SUM(CASE WHEN TipoOV IS NOT NULL AND TipoOVNombre IS NULL THEN 1 ELSE 0 END) AS TipoOVSinNombre_0,
       MAX(FechaCarga) AS FechaCarga
FROM dbo.Informe_consolidado_comercial
GROUP BY Etapa
ORDER BY Etapa;

-- Últimas cargas
SELECT TOP (10) * FROM dbo.Bitacora_Cargas_Informes
WHERE Informe = N'Informe_consolidado_comercial' ORDER BY Id DESC;

/* ───────────── 6. Job (lo crea TI en SQL Server Agent) ─────────────
   Nombre:   BI - Consolidado comercial carga completa   (mismo patrón que "BI - Ventas ...")
   Paso:     EXEC dbo.sp_Actualizar_Informe_consolidado_comercial;
   Horario:  cada 15 min (ideal) o 30 min, 6:00 a 20:00, como Informe_ventas (decisión 8, la define TI).
   Permisos: la API necesita SELECT sobre dbo.Informe_consolidado_comercial. */

   SELECT H.DocNum, L.LineNum, H.CardName, H.CreateDate, H.DocTime, H.UpdateDate,
       L.LineTotal * L.OpenQty / NULLIF(L.Quantity, 0) AS Saldo
FROM Firplak_SA.dbo.OQUT H
JOIN Firplak_SA.dbo.QUT1 L ON L.DocEntry = H.DocEntry
LEFT JOIN dbo.Informe_consolidado_comercial I
       ON I.Etapa = 'A_OFERTA' AND I.DocEntry = L.DocEntry AND I.LineNum = L.LineNum
WHERE H.CANCELED = 'N' AND L.LineStatus = 'O' AND I.DocEntry IS NULL;

