/*
  Semáforo de producción: tabla de reporte y SP de carga que reemplazan el cálculo en línea de
  dbo.SEMAFORO (copia original: proyectos/semaforo-produccion/fuentes/SEMAFORO_original.sql).
  Ficha: llm-wiki/proyectos/semaforo-produccion.md.

  Qué cambia frente a dbo.SEMAFORO
    Rendimiento
      - Sin los INNER JOIN a RDR1 y WOR1 que multiplicaban cada OP por (líneas del pedido x componentes)
        y obligaban al DISTINCT. WOR1 se conserva como EXISTS para no cambiar qué OP entran.
      - Sin cursor: la fecha ideal y todas las fechas en días hábiles se calculan por conjuntos con
        dbo.Calendario_Laboral (NumDiaHabil), en lugar de subconsultas por fila contra @FIR_FECHAS_PROD
        y de TOP 15 sobre sys.objects.
      - El lote y la línea del pedido se calculan una vez, con validación del formato (el original
        falla con un lote sin dos guiones o con una línea no numérica).
      - "Hoy" se fija una vez (@Hoy). La API lee la tabla; SAP ya no se consulta en cada uso.
    Lógica (ver la ficha, sección "Problemas de lógica")
      L1  Fecha ideal: si la liberación cae en día no laborable, el día de liberación cuenta como día 1
          (misma regla que NS Plantas, validada por Manufactura). El original daba un día hábil más.
      L2  Liberación recomendada STANDARD con amortiguador 1: la fecha de entrega del lote, no el día
          calendario anterior (el original podía devolver un sábado o domingo).
      L3  Liberación recomendada STANDARD con amortiguador >= 12 (ESPGAB = 13): el original buscaba solo
          15 días calendario y la dejaba en NULL.
      L4  Sin la fecha centinela 1900-01-01: una OP STANDARD sin fecha de entrega queda sin fecha
          recomendada (el original la mostraba con ~46.000 días de consumo, en negro y "No cumplió").
      L5  Liberación recomendada STOCK de una OP creada en día no laborable: el siguiente día hábil
          (el original saltaba uno más).
      L6  Fecha prometida del ítem con 0 días de distribución: la fecha de envío (el original restaba 1).
      L7  Días de retraso Firplak de una OP cerrada antes de la entrega: en días hábiles (el original
          contaba días calendario en ese caso).
      L8  Cumplimiento Firplak: una OP abierta no está vencida el mismo día de su fecha de entrega
          (el original comparaba con GETDATE() con hora).
      L9  Color de producción de una OP sin liberar: 'SIN LIBERAR' (el original la dejaba en GREEN porque
          el consumo era 0). El consumo queda en NULL.
      L10 Sin dato no es CYAN: cuando no hay fecha recomendada o de entrega, el color es 'SIN DATO'.
      L11 Cumplimiento de liberación de una OP liberada sin fecha recomendada: 'Sin fecha recomendada'
          (el original decía 'Sin liberar').
      L12 Cantidad pendiente del lote: los lotes sin formato pedido-línea-consecutivo no se agrupan entre
          sí (el original sumaba todas las OP con lote vacío como si fueran un solo lote).
    Se conserva igual: el alcance (estados R y P, cerradas en los últimos 30 días, bodegas PT-01, PT-02 y
    PT-08, INNER JOIN con ORDR, @FIR_FAM_SYMPH, @FIR_AMORTIGUADORES y el molde en OITM), los textos de
    los estados, los umbrales de color y las fórmulas de capacidad de molde y disponible PT-01.

  Días hábiles: dbo.Calendario_Laboral (creado por sql/ns-plantas/01_informe_ns_plantas.sql; sábados,
  domingos, festivos de Colombia y @FIR_FECHAS_PROD). NumDiaHabil(d) = número del último día hábil <= d,
  así que "días hábiles entre a y b" = NumDiaHabil(b) - NumDiaHabil(a). De 2025 a 2027 es igual a
  @FIR_FECHAS_PROD (validado en NS Plantas); antes de 2025 y después del 2028-01-01 @FIR_FECHAS_PROD no
  tiene fechas y el original contaba los fines de semana como hábiles.

  Carga: recarga completa en cada corrida (el alcance son unas miles de OP). Los valores que dependen de
  hoy (consumos, colores y cumplimientos) quedan calculados a la fecha de FechaCarga.

  Compatibilidad: nivel 100 (SQL Server 2016 SP2), sin CTE, APPLY, TRY_CONVERT, CREATE OR ALTER ni THROW.
  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 0) consultas previas (03_validacion.sql, parte A)  1) tabla  2) SP  3) primera carga
         4) comparación con dbo.SEMAFORO (03_validacion.sql, parte B)  5) job (02_job_semaforo_produccion.sql)
  Rollback: DROP PROCEDURE dbo.sp_Actualizar_Informe_semaforo_produccion;
            DROP TABLE dbo.Informe_semaforo_produccion;   (dbo.SEMAFORO no se modifica)
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tabla de reporte: una fila por OP ───────────── */
IF OBJECT_ID(N'dbo.Informe_semaforo_produccion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_semaforo_produccion (
        DocEntry                    int            NOT NULL,   -- OWOR.DocEntry
        DocNum                      int            NOT NULL,   -- 'Nro OP'
        PedidoOrigen                int            NULL,       -- 'Originnum' (ORDR.DocNum)
        Cliente                     nvarchar(200)  NULL,
        TipoPedido                  nvarchar(30)   NULL,       -- ORDR.U_TipoPedidos
        DiasDistribucion            smallint       NULL,       -- @FIR_TIPOPEDIDOS.U_Dias_Distr
        CodArticulo                 nvarchar(50)   NOT NULL,   -- 'SKU'
        Articulo                    nvarchar(200)  NULL,       -- 'Descripción Artículo'
        Planta                      nvarchar(20)   NULL,       -- OITM.U_Linea agrupada (FV, MS, INYECCION, MBL, CEFI)
        Familia                     nvarchar(30)   NOT NULL,   -- @FIR_FAM_SYMPH.U_FIR_FAM
        TipoOrden                   nvarchar(30)   NULL,       -- STANDARD | STOCK
        Estado                      nvarchar(20)   NOT NULL,   -- Planificado | Liberado | Cerrado
        Bodega                      nvarchar(8)    NOT NULL,   -- 'Destino'
        NumLote                     nvarchar(50)   NULL,
        Lote                        nvarchar(50)   NULL,       -- pedido-línea (NumLote hasta el segundo guion)
        CodMolde                    nvarchar(50)   NULL,
        Molde                       nvarchar(200)  NULL,
        CapacidadMolde              decimal(19, 2) NULL,       -- Moldes activos x vueltas x turnos
        CantidadTotal               decimal(19, 6) NULL,
        CantidadPendiente           decimal(19, 6) NULL,
        CantidadPendienteLote       decimal(19, 6) NULL,       -- 'Cant. Pend. Item'
        DisponiblePT01              decimal(19, 6) NULL,
        Amortiguador                smallint       NULL,       -- @FIR_AMORTIGUADORES.U_Amortiguador (días)
        FechaCreacion               date           NOT NULL,
        FechaLiberacionRecomendada  date           NULL,
        FechaLiberacion             date           NULL,       -- 'Fecha Real Liberación'
        ConsumoLiberacion           int            NULL,       -- Días hábiles desde la liberación recomendada
        PctLiberacion               decimal(10, 2) NULL,       -- 'Color Liberación'
        ColorLiberacion             nvarchar(12)   NOT NULL,   -- 'Color Liberación Txt'
        CumplimientoLiberacion      nvarchar(30)   NOT NULL,
        FechaEntregaLote            date           NULL,       -- OWOR.DueDate
        FechaRecomendadaEntrega     date           NULL,
        FechaIdealProduccion        date           NULL,       -- 'Fecha Ideal Entrega Producción'
        FechaCierre                 date           NULL,
        ConsumoAmortiguador         int            NULL,       -- Días hábiles desde la liberación (liberación = día 1)
        PctProduccion               decimal(10, 2) NULL,       -- 'Color Producción'
        ColorProduccion             nvarchar(12)   NOT NULL,   -- 'Color Producción Txt'
        CumplimientoPlanta          nvarchar(30)   NULL,
        DiasRetrasoFirplak          int            NULL,       -- Días hábiles contra la fecha de entrega del lote
        PctFirplak                  decimal(10, 2) NULL,       -- 'Color Firplak'
        ColorFirplak                nvarchar(12)   NOT NULL,   -- 'Color Firplak Txt'
        CumplimientoFirplak         nvarchar(30)   NULL,
        FechaPrometidaItem          date           NULL,       -- RDR1.ShipDate menos los días de distribución
        FechaCargaMolde             date           NULL,
        FechaCarga                  datetime2(0)   NOT NULL,   -- Corte de los valores que dependen de hoy
        CONSTRAINT PK_Informe_semaforo_produccion PRIMARY KEY CLUSTERED (DocEntry)
    );

    -- Filtro de planta del dashboard, ordenado por la fecha recomendada de entrega.
    -- La tabla es pequeña (unas miles de filas): no hacen falta más índices.
    CREATE NONCLUSTERED INDEX IX_Informe_semaforo_produccion_Planta
        ON dbo.Informe_semaforo_produccion (Planta, FechaRecomendadaEntrega)
        INCLUDE (Familia, Estado, ColorLiberacion, ColorProduccion, ColorFirplak);
END
GO

/* ───────────── 2. SP de carga ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_semaforo_produccion', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Informe_semaforo_produccion;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Informe_semaforo_produccion
    @DiasCerradas int = 30   -- OP cerradas en los últimos N días (igual que el original)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Inicio     datetime2(0) = sysdatetime();
    DECLARE @Hoy        date = CAST(GETDATE() AS date);
    DECLARE @hHoy       int;
    DECLARE @Eliminados int = 0;
    DECLARE @Insertados int = 0;
    DECLARE @Duplicados int = 0;
    DECLARE @Bloqueo    int;
    DECLARE @Error      nvarchar(4000);

    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Actualizar_Informe_semaforo_produccion', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_semaforo_produccion', N'COMPLETA', @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        IF OBJECT_ID('tempdb..#Base') IS NOT NULL DROP TABLE #Base;
        IF OBJECT_ID('tempdb..#LotesPend') IS NOT NULL DROP TABLE #LotesPend;

        SELECT @hHoy = c.NumDiaHabil FROM dbo.Calendario_Laboral c WHERE c.Fecha = @Hoy;
        IF @hHoy IS NULL
            RAISERROR (N'dbo.Calendario_Laboral no tiene la fecha de hoy; ejecute dbo.sp_Actualizar_Calendario_Laboral.', 16, 1);

        /* ── Paso 1. OP del alcance, una fila por OP ── */
        CREATE TABLE #Base (
            DocEntry                    int            NOT NULL,
            DocNum                      int            NOT NULL,
            PedidoOrigen                int            NULL,
            PedidoDocEntry              int            NOT NULL,
            Cliente                     nvarchar(200)  NULL,
            TipoPedido                  nvarchar(30)   NULL,
            DiasDistribucion            smallint       NULL,
            CodArticulo                 nvarchar(50)   NOT NULL,
            Articulo                    nvarchar(200)  NULL,
            Planta                      nvarchar(20)   NULL,
            Familia                     nvarchar(30)   NULL,
            TipoOrden                   nvarchar(30)   NULL,
            Estado                      nvarchar(20)   NOT NULL,
            Bodega                      nvarchar(8)    NOT NULL,
            NumLote                     nvarchar(50)   NULL,
            Lote                        nvarchar(50)   NULL,
            LineaPedido                 int            NULL,
            CodMolde                    nvarchar(50)   NULL,
            Molde                       nvarchar(200)  NULL,
            CapacidadMolde              decimal(19, 2) NULL,
            CantidadTotal               decimal(19, 6) NULL,
            CantidadPendiente           decimal(19, 6) NULL,
            CantidadPendienteLote       decimal(19, 6) NULL,
            DisponiblePT01              decimal(19, 6) NULL,
            Amortiguador                smallint       NULL,
            FechaCreacion               date           NOT NULL,
            FechaLiberacion             date           NULL,
            FechaEntregaLote            date           NULL,
            FechaCierre                 date           NULL,
            FechaEnvioItem              date           NULL,
            -- Número de día hábil de cada fecha (dbo.Calendario_Laboral.NumDiaHabil)
            hCreacion                   int            NULL,
            hLiberacion                 int            NULL,
            hEntrega                    int            NULL,
            hCierre                     int            NULL,
            hEnvioItem                  int            NULL,
            hRecoLib                    int            NULL,
            -- Resultados
            FechaLiberacionRecomendada  date           NULL,
            FechaIdealProduccion        date           NULL,
            FechaRecomendadaEntrega     date           NULL,
            FechaPrometidaItem          date           NULL,
            FechaCargaMolde             date           NULL,
            ConsumoLiberacion           int            NULL,
            PctLiberacion               decimal(10, 2) NULL,
            ColorLiberacion             nvarchar(12)   NULL,
            CumplimientoLiberacion      nvarchar(30)   NULL,
            ConsumoAmortiguador         int            NULL,
            PctProduccion               decimal(10, 2) NULL,
            ColorProduccion             nvarchar(12)   NULL,
            CumplimientoPlanta          nvarchar(30)   NULL,
            DiasRetrasoFirplak          int            NULL,
            PctFirplak                  decimal(10, 2) NULL,
            ColorFirplak                nvarchar(12)   NULL,
            CumplimientoFirplak         nvarchar(30)   NULL
        );

        INSERT INTO #Base (
            DocEntry, DocNum, PedidoOrigen, PedidoDocEntry, Cliente, TipoPedido, CodArticulo, Articulo,
            Planta, Familia, TipoOrden, Estado, Bodega, NumLote, CodMolde, Molde, CapacidadMolde,
            CantidadTotal, CantidadPendiente, DisponiblePT01, Amortiguador,
            FechaCreacion, FechaLiberacion, FechaEntregaLote, FechaCierre
        )
        SELECT
            T0.DocEntry,
            T0.DocNum,
            T0.OriginNum,
            T2.DocEntry,
            T2.CardName,
            NULLIF(LTRIM(RTRIM(CAST(T2.U_TipoPedidos AS nvarchar(30)))), N''),
            T0.ItemCode,
            T1.ItemName,
            CASE T1.U_Linea
                WHEN 'F01' THEN N'FV'
                WHEN 'F02' THEN N'MS'
                WHEN 'F03' THEN N'MS'
                WHEN 'F04' THEN N'INYECCION'
                WHEN 'F05' THEN N'MBL'
                WHEN 'F06' THEN N'MBL'
                WHEN 'F07' THEN N'MBL'
                WHEN 'F10' THEN N'MBL'
                WHEN 'F09' THEN N'CEFI'
                WHEN 'F11' THEN N'CEFI'
            END,
            T5.U_FIR_FAM,
            NULLIF(UPPER(LTRIM(RTRIM(T0.U_Tipo_Orden))), N''),
            CASE T0.Status WHEN 'P' THEN N'Planificado' WHEN 'R' THEN N'Liberado' WHEN 'L' THEN N'Cerrado' END,
            T0.Warehouse,
            NULLIF(LTRIM(RTRIM(T0.U_NumLote)), N''),
            T1.U_Molde,
            T7.ItemName,
            M.Moldes * T7.U_NumVueltas * TU.U_Turnos,
            T0.PlannedQty,
            T0.PlannedQty - T0.CmpltQty,
            P0.OnHand - P0.IsCommited,
            CONVERT(smallint, CONVERT(numeric(3, 0), T6.U_Amortiguador)),   -- Igual que Amort NUMERIC(3,0) del original
            CAST(T0.CreateDate AS date),
            CASE WHEN T0.Status = 'P' THEN NULL ELSE CAST(T0.RlsDate AS date) END,
            CAST(T0.DueDate AS date),
            CAST(T0.CloseDate AS date)
        FROM Firplak_SA.dbo.OWOR T0 WITH (NOLOCK)
            INNER JOIN Firplak_SA.dbo.OITM T1 WITH (NOLOCK) ON T0.ItemCode = T1.ItemCode
            INNER JOIN Firplak_SA.dbo.ORDR T2 WITH (NOLOCK) ON T0.OriginNum = T2.DocNum
            INNER JOIN Firplak_SA.dbo.[@FIR_FAM_SYMPH] T5 WITH (NOLOCK)
                ON T1.U_Familia COLLATE SQL_Latin1_General_CP1_CI_AS = T5.U_FIR_FAM_MAES COLLATE SQL_Latin1_General_CP1_CI_AS
                AND T5.U_FIR_TIPO_PED = T2.U_TipoPedidos
            INNER JOIN Firplak_SA.dbo.[@FIR_AMORTIGUADORES] T6 WITH (NOLOCK)
                ON T5.U_FIR_FAM COLLATE SQL_Latin1_General_CP1_CI_AS = T6.Name COLLATE SQL_Latin1_General_CP1_CI_AS
            INNER JOIN Firplak_SA.dbo.OITM T7 WITH (NOLOCK) ON T1.U_Molde = T7.ItemCode   -- OP sin molde: fuera (igual que el original)
            LEFT JOIN Firplak_SA.dbo.OITW P0 WITH (NOLOCK)
                ON P0.ItemCode = T0.ItemCode AND P0.WhsCode = 'PT-01'
            -- Capacidad del molde (antes, un UPDATE aparte)
            LEFT JOIN (
                SELECT s.ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS AS ItemCode, COUNT(1) AS Moldes
                FROM Firplak_SA.dbo.OSRN s WITH (NOLOCK)
                WHERE s.U_EstadoMolde = 'Activo'
                GROUP BY s.ItemCode COLLATE SQL_Latin1_General_CP1_CI_AS
            ) M ON M.ItemCode = T1.U_Molde COLLATE SQL_Latin1_General_CP1_CI_AS
            LEFT JOIN Firplak_SA.dbo.[@FIR_FAMILIA] FAM WITH (NOLOCK) ON FAM.Code = T1.U_Familia
            LEFT JOIN Firplak_SA.dbo.[@TURNOS] TU WITH (NOLOCK)
                ON FAM.U_Planta COLLATE SQL_Latin1_General_CP1_CI_AS = TU.Code COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE (T0.Status IN ('R', 'P')
               OR (T0.Status = 'L' AND T0.CloseDate > DATEADD(DAY, -@DiasCerradas, @Hoy)))   -- = CloseDate >= GETDATE() - 30 del original
            AND T0.Warehouse IN ('PT-01', 'PT-02', 'PT-08')
            AND T5.U_FIR_FAM IS NOT NULL
            -- El original exigía al menos un componente (INNER JOIN WOR1); se conserva sin multiplicar filas
            AND EXISTS (SELECT 1 FROM Firplak_SA.dbo.WOR1 T4 WITH (NOLOCK) WHERE T4.DocEntry = T0.DocEntry)
        OPTION (RECOMPILE);

        -- Sin RDR1 ni DISTINCT, una OP solo se repite si @FIR_FAM_SYMPH o @FIR_AMORTIGUADORES tienen claves
        -- repetidas o si dos pedidos comparten DocNum. En ese caso la carga falla y se conserva la anterior.
        SELECT @Duplicados = COUNT(1)
        FROM (SELECT DocEntry FROM #Base GROUP BY DocEntry HAVING COUNT(1) > 1) d;
        IF @Duplicados > 0
        BEGIN
            SET @Error = N'Hay ' + CAST(@Duplicados AS nvarchar(10))
                       + N' OP repetidas por las uniones con ORDR, @FIR_FAM_SYMPH o @FIR_AMORTIGUADORES. Se conserva la carga anterior.';
            RAISERROR (N'%s', 16, 1, @Error);
        END
        IF NOT EXISTS (SELECT 1 FROM #Base)
            RAISERROR (N'La carga no devolvió OP; se conserva la carga anterior.', 16, 1);

        CREATE UNIQUE CLUSTERED INDEX IX_Base ON #Base (DocEntry);

        /* ── Paso 2. Lote (pedido-línea) y línea del pedido, con el formato validado ──
           NumLote = <pedido>-<línea>-<consecutivo>. Sin dos guiones o con línea no numérica: NULL. */
        UPDATE #Base
        SET Lote = CASE WHEN CHARINDEX(N'-', NumLote) > 0
                         AND CHARINDEX(N'-', NumLote, CHARINDEX(N'-', NumLote) + 1) > CHARINDEX(N'-', NumLote) + 1
                        THEN LEFT(NumLote, CHARINDEX(N'-', NumLote, CHARINDEX(N'-', NumLote) + 1) - 1) END,
            LineaPedido = CASE WHEN CHARINDEX(N'-', NumLote) > 0
                                AND CHARINDEX(N'-', NumLote, CHARINDEX(N'-', NumLote) + 1) - CHARINDEX(N'-', NumLote) - 1 BETWEEN 1 AND 9
                                AND SUBSTRING(NumLote, CHARINDEX(N'-', NumLote) + 1,
                                              CHARINDEX(N'-', NumLote, CHARINDEX(N'-', NumLote) + 1) - CHARINDEX(N'-', NumLote) - 1) NOT LIKE N'%[^0-9]%'
                               THEN CONVERT(int, SUBSTRING(NumLote, CHARINDEX(N'-', NumLote) + 1,
                                              CHARINDEX(N'-', NumLote, CHARINDEX(N'-', NumLote) + 1) - CHARINDEX(N'-', NumLote) - 1)) END;

        /* ── Paso 3. Cantidad pendiente del lote: OP abiertas (R, P) de todas las bodegas, como el original ── */
        CREATE TABLE #LotesPend (Lote nvarchar(50) NOT NULL PRIMARY KEY, CantPend decimal(19, 6) NULL);
        INSERT INTO #LotesPend (Lote, CantPend)
        SELECT x.Lote, ISNULL(SUM(x.PlannedQty), 0) - ISNULL(SUM(x.CmpltQty), 0)
        FROM (
            SELECT CASE WHEN CHARINDEX(N'-', r.L) > 0
                         AND CHARINDEX(N'-', r.L, CHARINDEX(N'-', r.L) + 1) > CHARINDEX(N'-', r.L) + 1
                        THEN LEFT(r.L, CHARINDEX(N'-', r.L, CHARINDEX(N'-', r.L) + 1) - 1)
                   END AS Lote,
                   r.PlannedQty, r.CmpltQty
            FROM (
                SELECT LTRIM(RTRIM(w.U_NumLote)) AS L, w.PlannedQty, w.CmpltQty
                FROM Firplak_SA.dbo.OWOR w WITH (NOLOCK)
                WHERE w.Status IN ('R', 'P')
            ) r
        ) x
        WHERE x.Lote IS NOT NULL
        GROUP BY x.Lote;

        UPDATE b
        SET b.CantidadPendienteLote = l.CantPend
        FROM #Base b
        INNER JOIN #LotesPend l ON l.Lote = b.Lote;

        /* ── Paso 4. Fecha de envío del ítem (RDR1.VisOrder = línea - 1) y días de distribución ── */
        UPDATE b
        SET b.FechaEnvioItem = CAST(R.ShipDate AS date)
        FROM #Base b
        INNER JOIN Firplak_SA.dbo.RDR1 R WITH (NOLOCK)
            ON R.DocEntry = b.PedidoDocEntry AND R.VisOrder = b.LineaPedido - 1;

        -- El original convertía U_TipoPedidos a número antes de compararlo con Code ('01' -> '1')
        UPDATE b
        SET b.DiasDistribucion = CONVERT(smallint, CONVERT(numeric(4, 0), TP.U_Dias_Distr))
        FROM #Base b
        INNER JOIN Firplak_SA.dbo.[@FIR_TIPOPEDIDOS] TP WITH (NOLOCK)
            ON TP.Code COLLATE SQL_Latin1_General_CP1_CI_AS =
               (CASE WHEN b.TipoPedido NOT LIKE N'%[^0-9]%' AND LEN(b.TipoPedido) BETWEEN 1 AND 18
                     THEN CAST(CONVERT(numeric(18, 0), b.TipoPedido) AS nvarchar(30))
                     ELSE b.TipoPedido END) COLLATE SQL_Latin1_General_CP1_CI_AS;

        /* ── Paso 5. Número de día hábil de cada fecha ── */
        UPDATE b
        SET b.hCreacion   = c1.NumDiaHabil,
            b.hLiberacion = c2.NumDiaHabil,
            b.hEntrega    = c3.NumDiaHabil,
            b.hCierre     = c4.NumDiaHabil,
            b.hEnvioItem  = c5.NumDiaHabil
        FROM #Base b
            LEFT JOIN dbo.Calendario_Laboral c1 ON c1.Fecha = b.FechaCreacion
            LEFT JOIN dbo.Calendario_Laboral c2 ON c2.Fecha = b.FechaLiberacion
            LEFT JOIN dbo.Calendario_Laboral c3 ON c3.Fecha = b.FechaEntregaLote
            LEFT JOIN dbo.Calendario_Laboral c4 ON c4.Fecha = b.FechaCierre
            LEFT JOIN dbo.Calendario_Laboral c5 ON c5.Fecha = b.FechaEnvioItem;

        -- Liberación recomendada, como número de día hábil:
        --   STOCK:    el día hábil siguiente a la creación.
        --   STANDARD: el día hábil desde el cual, contando ese día, caben Amortiguador días hábiles hasta
        --             la entrega del lote (amortiguador 1 = la misma fecha de entrega).
        UPDATE #Base
        SET hRecoLib = CASE
                WHEN TipoOrden = N'STOCK'    THEN hCreacion + 1
                WHEN TipoOrden = N'STANDARD' AND Amortiguador >= 1 THEN hEntrega - Amortiguador + 1
            END;

        /* ── Paso 6. Fechas en días hábiles ── */
        UPDATE b
        SET b.FechaLiberacionRecomendada = cR.Fecha,
            -- Fecha ideal (regla de NS Plantas): amortiguador 1 = la liberación; N >= 2 = el día hábil N - 1
            -- después de la liberación (la liberación cuenta como día 1).
            b.FechaIdealProduccion = CASE WHEN b.Amortiguador = 1 THEN b.FechaLiberacion ELSE cI.Fecha END,
            -- Fecha prometida del ítem: envío del pedido menos los días de distribución, en días hábiles
            b.FechaPrometidaItem = CASE WHEN b.DiasDistribucion IS NULL THEN b.FechaEnvioItem ELSE cP.Fecha END
        FROM #Base b
            LEFT JOIN dbo.Calendario_Laboral cR ON cR.EsLaborable = 1 AND cR.NumDiaHabil = b.hRecoLib
            LEFT JOIN dbo.Calendario_Laboral cI ON cI.EsLaborable = 1 AND b.Amortiguador >= 2
                AND cI.NumDiaHabil = b.hLiberacion + b.Amortiguador - 1
            LEFT JOIN dbo.Calendario_Laboral cP ON cP.EsLaborable = 1
                AND cP.NumDiaHabil = b.hEnvioItem - b.DiasDistribucion;

        UPDATE #Base
        SET FechaRecomendadaEntrega = CASE WHEN FechaEntregaLote > FechaIdealProduccion
                                           THEN FechaIdealProduccion ELSE FechaEntregaLote END,
            FechaCargaMolde = CASE WHEN FechaLiberacion IS NOT NULL THEN FechaLiberacion
                                   WHEN FechaLiberacionRecomendada > @Hoy THEN FechaLiberacionRecomendada
                                   ELSE @Hoy END;

        /* ── Paso 7. Consumos en días hábiles y porcentajes del amortiguador ── */
        UPDATE #Base
        SET ConsumoLiberacion   = CASE WHEN FechaLiberacionRecomendada IS NOT NULL
                                       THEN COALESCE(hLiberacion, @hHoy) - hRecoLib END,
            ConsumoAmortiguador = CASE WHEN FechaLiberacion IS NOT NULL
                                       THEN COALESCE(hCierre, @hHoy) - hLiberacion + 1 END,
            DiasRetrasoFirplak  = CASE WHEN FechaEntregaLote IS NOT NULL
                                       THEN COALESCE(hCierre, @hHoy) - hEntrega END;

        UPDATE #Base
        SET PctLiberacion = ConsumoLiberacion   * 100.0 / NULLIF(Amortiguador, 0),
            PctProduccion = ConsumoAmortiguador * 100.0 / NULLIF(Amortiguador, 0),
            PctFirplak    = DiasRetrasoFirplak  * 100.0 / NULLIF(Amortiguador, 0);

        /* ── Paso 8. Colores y cumplimientos (umbrales y textos del original) ── */
        UPDATE #Base
        SET ColorLiberacion = CASE
                WHEN PctLiberacion IS NULL  THEN N'SIN DATO'
                WHEN PctLiberacion >= 100   THEN N'BLACK'
                WHEN PctLiberacion >= 66.6  THEN N'RED'
                WHEN PctLiberacion >= 33.3  THEN N'YELLOW'
                WHEN PctLiberacion >= 0     THEN N'GREEN'
                ELSE N'CYAN'
            END,
            CumplimientoLiberacion = CASE
                WHEN FechaLiberacion IS NOT NULL AND FechaLiberacionRecomendada IS NULL THEN N'Sin fecha recomendada'
                WHEN FechaLiberacion IS NOT NULL AND FechaLiberacion <= FechaLiberacionRecomendada THEN N'Si cumplió'
                WHEN FechaLiberacion IS NOT NULL THEN N'No cumplió'
                WHEN FechaLiberacionRecomendada < @Hoy THEN N'No cumplió'
                ELSE N'Sin liberar'
            END,
            ColorProduccion = CASE
                WHEN FechaLiberacion IS NULL THEN N'SIN LIBERAR'
                WHEN PctProduccion IS NULL   THEN N'SIN DATO'
                WHEN PctProduccion > 100     THEN N'BLACK'
                WHEN PctProduccion > 66.6    THEN N'RED'
                WHEN PctProduccion > 33.3    THEN N'YELLOW'
                WHEN PctProduccion >= 0      THEN N'GREEN'
                ELSE N'SIN DATO'
            END,
            CumplimientoPlanta = CASE
                WHEN FechaCierre IS NOT NULL AND FechaIdealProduccion IS NULL THEN N'Sin fecha ideal'
                WHEN FechaCierre IS NOT NULL AND FechaCierre <= FechaIdealProduccion THEN N'Cumplió'
                WHEN FechaCierre IS NOT NULL THEN N'No Cumplió'
                WHEN FechaLiberacion IS NULL THEN N'Sin Liberar'
                WHEN @Hoy > FechaIdealProduccion THEN N'No Cumplió'
                WHEN @Hoy <= FechaIdealProduccion THEN N'Sin Entregar'
            END,
            ColorFirplak = CASE
                WHEN PctFirplak IS NULL  THEN N'SIN DATO'
                WHEN PctFirplak > 0      THEN N'BLACK'
                WHEN PctFirplak > -33.3  THEN N'RED'
                WHEN PctFirplak > -66.6  THEN N'YELLOW'
                WHEN PctFirplak > -100   THEN N'GREEN'
                ELSE N'CYAN'
            END,
            CumplimientoFirplak = CASE
                WHEN FechaCierre IS NOT NULL AND FechaCierre <= FechaEntregaLote THEN N'Cumplió'
                WHEN FechaCierre IS NOT NULL AND FechaCierre > FechaEntregaLote THEN N'No Cumplió'
                WHEN FechaCierre IS NULL AND @Hoy > FechaEntregaLote THEN N'No Cumplió'
                WHEN FechaCierre IS NULL AND FechaLiberacion IS NOT NULL THEN N'Sin Entregar'
                WHEN FechaCierre IS NULL AND FechaLiberacion IS NULL THEN N'Sin Liberar'
            END;

        /* ── Paso 9. Reemplazo de la tabla de reporte ── */
        BEGIN TRANSACTION;
            SELECT @Eliminados = COUNT(1) FROM dbo.Informe_semaforo_produccion WITH (TABLOCKX);
            TRUNCATE TABLE dbo.Informe_semaforo_produccion;

            INSERT INTO dbo.Informe_semaforo_produccion (
                DocEntry, DocNum, PedidoOrigen, Cliente, TipoPedido, DiasDistribucion, CodArticulo, Articulo,
                Planta, Familia, TipoOrden, Estado, Bodega, NumLote, Lote, CodMolde, Molde, CapacidadMolde,
                CantidadTotal, CantidadPendiente, CantidadPendienteLote, DisponiblePT01, Amortiguador,
                FechaCreacion, FechaLiberacionRecomendada, FechaLiberacion, ConsumoLiberacion, PctLiberacion,
                ColorLiberacion, CumplimientoLiberacion, FechaEntregaLote, FechaRecomendadaEntrega,
                FechaIdealProduccion, FechaCierre, ConsumoAmortiguador, PctProduccion, ColorProduccion,
                CumplimientoPlanta, DiasRetrasoFirplak, PctFirplak, ColorFirplak, CumplimientoFirplak,
                FechaPrometidaItem, FechaCargaMolde, FechaCarga
            )
            SELECT
                DocEntry, DocNum, PedidoOrigen, Cliente, TipoPedido, DiasDistribucion, CodArticulo, Articulo,
                Planta, Familia, TipoOrden, Estado, Bodega, NumLote, Lote, CodMolde, Molde, CapacidadMolde,
                CantidadTotal, CantidadPendiente, CantidadPendienteLote, DisponiblePT01, Amortiguador,
                FechaCreacion, FechaLiberacionRecomendada, FechaLiberacion, ConsumoLiberacion, PctLiberacion,
                ColorLiberacion, CumplimientoLiberacion, FechaEntregaLote, FechaRecomendadaEntrega,
                FechaIdealProduccion, FechaCierre, ConsumoAmortiguador, PctProduccion, ColorProduccion,
                CumplimientoPlanta, DiasRetrasoFirplak, PctFirplak, ColorFirplak, CumplimientoFirplak,
                FechaPrometidaItem, FechaCargaMolde, @Inicio
            FROM #Base;
            SET @Insertados = @@ROWCOUNT;
        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_semaforo_produccion', N'COMPLETA', @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE #Base, #LotesPend;
        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_semaforo_produccion', @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_semaforo_produccion', N'COMPLETA', @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_semaforo_produccion', @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_semaforo_produccion;
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_semaforo_produccion' ORDER BY Inicio DESC;

/* ───────────── 4. Comparación con dbo.SEMAFORO: 03_validacion.sql, parte B ───────────── */

/* ───────────── 5. Opcional, solo después de validar: dbo.SEMAFORO lee la tabla ─────────────
   Si otros consumidores (Excel, reportes) llaman a dbo.SEMAFORO, puede leer la tabla con los mismos
   nombres de columna y dejar de recalcular contra SAP. Rollback: volver a ejecutar
   proyectos/semaforo-produccion/fuentes/SEMAFORO_original.sql.

ALTER PROCEDURE dbo.SEMAFORO
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        PedidoOrigen                AS 'Originnum',
        DocNum                      AS 'Nro OP',
        CodArticulo                 AS 'SKU',
        Articulo                    AS 'Descripción Artículo',
        Planta                      AS 'Planta',
        Familia                     AS 'Familia',
        TipoOrden                   AS 'Tipo Orden',
        CantidadPendiente           AS 'Cant. Pendiente',
        CantidadPendienteLote       AS 'Cant. Pend. Item',
        CantidadTotal               AS 'Cantidad total',
        DisponiblePT01              AS 'Disponible PT01',
        FechaCreacion               AS 'Fecha Creación OP',
        Estado                      AS 'Estado',
        FechaLiberacionRecomendada  AS 'Fecha Recomendada Liberación',
        FechaLiberacion             AS 'Fecha Real Liberación',
        ConsumoLiberacion           AS 'Consumo Para Liberar',
        ColorLiberacion             AS 'Color Liberación Txt',
        PctLiberacion               AS 'Color Liberación',
        CumplimientoLiberacion      AS 'Cumplimiento Liberación',
        FechaEntregaLote            AS 'Fecha Entrega Lote',
        FechaRecomendadaEntrega     AS 'Fecha Recomendada de Entrega',
        FechaCierre                 AS 'Fecha Cierre OP',
        FechaIdealProduccion        AS 'Fecha Ideal Entrega Producción',
        ConsumoAmortiguador         AS 'Consumo Amortiguador Planta',
        ColorProduccion             AS 'Color Producción Txt',
        PctProduccion               AS 'Color Producción',
        CumplimientoPlanta          AS 'Cumplimiento Planta',
        DiasRetrasoFirplak          AS 'Dias Retrazo Firplak',
        ColorFirplak                AS 'Color Firplak Txt',
        PctFirplak                  AS 'Color Firplak',
        CumplimientoFirplak         AS 'Cumplimiento Firplak',
        FechaPrometidaItem          AS 'Fecha Prometida Entrega Item',
        Bodega                      AS 'Destino',
        NumLote                     AS 'NumLote',
        Molde                       AS 'Molde',
        CapacidadMolde              AS 'Capacidad Molde',
        FechaCargaMolde             AS 'Fecha Carga Molde',
        Amortiguador                AS 'Amortiguador',
        Cliente                     AS 'Cliente'
    FROM dbo.Informe_semaforo_produccion;
END
*/
