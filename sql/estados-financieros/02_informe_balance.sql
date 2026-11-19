/*
  Estados Financieros: balance mensual por cuenta en 5 niveles (saldo inicial, débito, crédito, saldo
  del mes y saldo final), por empresa (Firplak y Viventta).
  Proyecto: llm-wiki/proyectos/estados-financieros.md

  Base: query "balance" de Contabilidad (pegado por el desarrollador el 2026-11-11). Corrido en SAP de
  una sola vez tardaba demasiado y bloqueaba SAP, así que aquí se parte en dos pasos:

    1. dbo.Informe_mov_contable_diario: débito y crédito por empresa, cuenta y día, de toda la historia.
       Es lo único que lee SAP. La incremental solo vuelve a leer los días recientes y los días que
       tocan los asientos nuevos (TransId mayor al último leído), aunque se hayan registrado con fecha
       atrás. La completa lee mes por mes.
    2. dbo.Informe_balance: se calcula desde la tabla anterior, sin leer SAP.

  Empresas (2026-11-19): Firplak lee Firplak_SA y Viventta lee DBViventta, en la misma instancia.
  Las dos bases tienen la misma estructura (consultas de verificación del 2026-11-19): mismas columnas,
  collation, índice OJDT_REFDATE, plan de cuentas en 5 niveles y valores de U_HBT_AreVal. En DBViventta
  hay 9 cuentas imputables fuera de la regla de abajo (nivel 2 o 4, o códigos con letras), todas sin
  movimientos. Sin @Empresa, el SP actualiza las dos empresas, una después de la otra.

  Reglas del query original que se conservan:
    - Asientos con OJDT.U_HBT_AreVal IN ('Comun', '', 'IFRS') o NULL.
    - Cuentas: OACT.Levels = 5, Postable = 'Y' y código de 8 dígitos.
    - Niveles: Lvl1 = primer dígito + 14 ceros; Lvl2, Lvl3 y Lvl4 = primeros 2, 4 y 6 dígitos.
      El nombre de cada nivel sale de OACT por el código (INNER JOIN, como el original).
    - Saldo inicial = todo lo anterior al mes. Saldo final = saldo inicial + débito - crédito.
    - Fecha = último día del mes; para el mes en curso, hoy. Valores redondeados a numeric(18,2).

  Diferencias con el original, sin efecto en las cifras:
    - Los días se toman de OJDT.RefDate (cabecera) y no de JDT1.RefDate (línea), para leer SAP por el
      índice de la cabecera. Se comprobó con el Service Layer que en 2025-2026 coinciden en todas las
      líneas de Firplak (682 días, 0 diferencias, 2026-11-13).
    - El saldo acumulado se calcula mes por mes, porque SUM() OVER (... ROWS BETWEEN ...) no funciona
      en el nivel de compatibilidad 100.
    - Se calcula desde @BalanceDesde (2021-01) y no solo desde 2025-01.

  Validado (Firplak, 2026-11-19): 1.970 filas por mes, saldos encadenados, débitos de nivel 5 iguales a
  los de Supabase de nov-2025 a sep-2026 y octubre 2026 cuenta por cuenta.

  Compatibilidad: nivel 100. Sin CTE, APPLY, TRY_CONVERT, CREATE OR ALTER ni THROW (mismas reglas que
  sql/ns-plantas). SAP solo se lee, con NOLOCK, mediante sp_executesql para elegir la base de la
  empresa (el nombre sale de una lista fija, no del usuario). Bitácora: dbo.Cargas_Log.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Instalación nueva: 1) tablas e índices  2) SP  3) primera carga  4) validación  5) job (03)
  Si ya existían las tablas de la versión de una sola empresa: primero 04_multiempresa.sql.
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tablas (solo se crean si no existen) ───────────── */

-- 1.1 Movimientos por empresa, cuenta y día (todas las cuentas)
IF OBJECT_ID(N'dbo.Informe_mov_contable_diario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_mov_contable_diario (
        Empresa     nvarchar(20)    NOT NULL,   -- Firplak | Viventta
        Fecha       date            NOT NULL,   -- OJDT.RefDate
        Cuenta      nvarchar(15)    NOT NULL,   -- JDT1.Account
        Debito      decimal(19, 6)  NOT NULL,
        Credito     decimal(19, 6)  NOT NULL,
        FechaCarga  datetime2(0)    NOT NULL,
        CONSTRAINT PK_Informe_mov_contable_diario PRIMARY KEY CLUSTERED (Empresa, Fecha, Cuenta)
    );

    -- Saldo acumulado de una cuenta hasta una fecha
    CREATE NONCLUSTERED INDEX IX_Informe_mov_contable_diario_Cuenta
        ON dbo.Informe_mov_contable_diario (Empresa, Cuenta, Fecha)
        INCLUDE (Debito, Credito);
END
GO

-- 1.2 Control de la incremental: último asiento leído por empresa
IF OBJECT_ID(N'dbo.Informe_mov_contable_control', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_mov_contable_control (
        Empresa         nvarchar(20)  NOT NULL,
        UltimoTransId   int           NOT NULL,
        FechaCarga      datetime2(0)  NOT NULL,
        CONSTRAINT PK_Informe_mov_contable_control PRIMARY KEY (Empresa)
    );
END
GO

-- 1.3 Balance mensual: una fila por empresa, mes y código de cuenta (de cualquier nivel)
IF OBJECT_ID(N'dbo.Informe_balance', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_balance (
        Empresa       nvarchar(20)    NOT NULL,
        Anio          smallint        NOT NULL,
        Mes           tinyint         NOT NULL,
        CodigoCuenta  nvarchar(15)    NOT NULL,   -- Código del nivel: Lvl1, Lvl2, Lvl3, Lvl4 o Account
        Nivel         tinyint         NOT NULL,   -- 1 a 5
        Lvl1          nvarchar(15)    NOT NULL,
        Lvl2          nvarchar(2)     NULL,
        Lvl3          nvarchar(4)     NULL,
        Lvl4          nvarchar(6)     NULL,
        Account       nvarchar(8)     NULL,       -- Solo en el nivel 5
        AcctName      nvarchar(200)   NULL,
        SaldoInicial  numeric(18, 2)  NOT NULL,
        Debito        numeric(18, 2)  NOT NULL,
        Credito       numeric(18, 2)  NOT NULL,
        SaldoMes      numeric(18, 2)  NOT NULL,
        SaldoFinal    numeric(18, 2)  NOT NULL,
        Fecha         date            NOT NULL,   -- Fin de mes, u hoy en el mes en curso
        FechaCarga    datetime2(0)    NOT NULL,
        CONSTRAINT PK_Informe_balance PRIMARY KEY CLUSTERED (Empresa, Anio, Mes, CodigoCuenta)
    );

    -- El endpoint pide casi siempre una empresa, un mes y un nivel
    CREATE NONCLUSTERED INDEX IX_Informe_balance_Nivel
        ON dbo.Informe_balance (Empresa, Anio, Mes, Nivel)
        INCLUDE (SaldoInicial, Debito, Credito, SaldoMes, SaldoFinal);

    -- Evolución de una cuenta en el tiempo
    CREATE NONCLUSTERED INDEX IX_Informe_balance_Cuenta
        ON dbo.Informe_balance (Empresa, CodigoCuenta, Anio, Mes)
        INCLUDE (SaldoFinal);
END
GO

/* ───────────── 2. SP de actualización ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_balance', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Informe_balance;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Informe_balance
    @CargaCompleta bit          = 0,           -- 1 = vuelve a leer toda la historia de SAP (primera carga y domingo)
    @DiasVentana   int          = 7,           -- Incremental: días recientes que siempre se vuelven a leer
    @BalanceDesde  date         = '20210101',  -- Primer mes del balance
    @Empresa       nvarchar(20) = NULL         -- Firplak | Viventta; NULL = las dos
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* ── Sin empresa: una corrida por empresa. Si una falla, se intenta la otra y al final se informa. ── */
    IF @Empresa IS NULL
    BEGIN
        DECLARE @ErrorEmpresas nvarchar(4000);

        BEGIN TRY
            EXEC dbo.sp_Actualizar_Informe_balance @CargaCompleta, @DiasVentana, @BalanceDesde, N'Firplak';
        END TRY
        BEGIN CATCH
            SET @ErrorEmpresas = N'Firplak: ' + LEFT(ERROR_MESSAGE(), 1900);
        END CATCH

        BEGIN TRY
            EXEC dbo.sp_Actualizar_Informe_balance @CargaCompleta, @DiasVentana, @BalanceDesde, N'Viventta';
        END TRY
        BEGIN CATCH
            SET @ErrorEmpresas = ISNULL(@ErrorEmpresas + N' | ', N'') + N'Viventta: ' + LEFT(ERROR_MESSAGE(), 1900);
        END CATCH

        IF @ErrorEmpresas IS NOT NULL RAISERROR (N'%s', 16, 1, @ErrorEmpresas);
        RETURN;
    END

    DECLARE @Db sysname = CASE @Empresa WHEN N'Firplak' THEN N'Firplak_SA' WHEN N'Viventta' THEN N'DBViventta' END;
    IF @Db IS NULL
    BEGIN
        RAISERROR (N'Empresa no válida: use Firplak o Viventta.', 16, 1);
        RETURN;
    END

    -- Firplak conserva los nombres de proceso de la primera versión
    DECLARE @Sufijo         nvarchar(30) = CASE WHEN @Empresa = N'Firplak' THEN N'' ELSE N'_' + @Empresa END;
    DECLARE @ProcesoMov     nvarchar(100) = N'Informe_mov_contable_diario' + @Sufijo;
    DECLARE @ProcesoBal     nvarchar(100) = N'Informe_balance' + @Sufijo;
    DECLARE @Recurso        nvarchar(255) = N'sp_Actualizar_Informe_balance_' + @Empresa;

    DECLARE @Inicio         datetime2(0) = sysdatetime();
    DECLARE @Modo           nvarchar(20) = CASE WHEN @CargaCompleta = 1 THEN N'COMPLETA' ELSE N'INCREMENTAL' END;
    DECLARE @Hoy            date = CAST(GETDATE() AS date);
    DECLARE @MesHoy         date;
    DECLARE @UltimoTransId  int;
    DECLARE @MaxTransId     int;
    DECLARE @PrimerDia      date;
    DECLARE @MesCarga       date;
    DECLARE @MesDesde       date;
    DECLARE @Mes            date;
    DECLARE @MovEliminados  int = 0;
    DECLARE @MovInsertados  int = 0;
    DECLARE @Eliminados     int = 0;
    DECLARE @Insertados     int = 0;
    DECLARE @Bloqueo        int;
    DECLARE @Error          nvarchar(4000);
    DECLARE @Sql            nvarchar(max);

    -- Filtro de asientos del query original (se usa en todas las lecturas de movimientos)
    DECLARE @FiltroAreVal   nvarchar(200) = N'(T.U_HBT_AreVal IN (''Comun'', '''', ''IFRS'') OR T.U_HBT_AreVal IS NULL)';

    SET @MesHoy = DATEADD(DAY, 1 - DAY(@Hoy), @Hoy);
    SET @BalanceDesde = DATEADD(DAY, 1 - DAY(@BalanceDesde), @BalanceDesde);

    EXEC @Bloqueo = sp_getapplock
        @Resource = @Recurso, @LockMode = N'Exclusive', @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@ProcesoBal, @Modo, @Inicio, sysdatetime(), 0, 0, N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        IF OBJECT_ID('tempdb..#Dias') IS NOT NULL DROP TABLE #Dias;
        IF OBJECT_ID('tempdb..#Mov') IS NOT NULL DROP TABLE #Mov;
        IF OBJECT_ID('tempdb..#Cuentas') IS NOT NULL DROP TABLE #Cuentas;
        IF OBJECT_ID('tempdb..#Nombres') IS NOT NULL DROP TABLE #Nombres;
        IF OBJECT_ID('tempdb..#Saldo') IS NOT NULL DROP TABLE #Saldo;
        IF OBJECT_ID('tempdb..#MovMes') IS NOT NULL DROP TABLE #MovMes;
        IF OBJECT_ID('tempdb..#Bal5') IS NOT NULL DROP TABLE #Bal5;
        IF OBJECT_ID('tempdb..#Bal') IS NOT NULL DROP TABLE #Bal;

        CREATE TABLE #Dias (Fecha date NOT NULL PRIMARY KEY);
        CREATE TABLE #Mov (
            Fecha    date            NOT NULL,
            Cuenta   nvarchar(15)    COLLATE DATABASE_DEFAULT NOT NULL,
            Debito   decimal(19, 6)  NOT NULL,
            Credito  decimal(19, 6)  NOT NULL,
            PRIMARY KEY (Fecha, Cuenta)
        );

        SET @Sql = REPLACE(N'SELECT @MaxTransId = MAX(TransId) FROM {db}.dbo.OJDT WITH (NOLOCK);', N'{db}', QUOTENAME(@Db));
        EXEC sp_executesql @Sql, N'@MaxTransId int OUTPUT', @MaxTransId = @MaxTransId OUTPUT;

        /* ── Paso 1. Días que se leen de SAP ── */
        IF @CargaCompleta = 1
        BEGIN
            -- Toda la historia, un mes por consulta para no tener una lectura larga sobre SAP
            SET @Sql = REPLACE(N'SELECT @PrimerDia = MIN(RefDate) FROM {db}.dbo.OJDT WITH (NOLOCK);', N'{db}', QUOTENAME(@Db));
            EXEC sp_executesql @Sql, N'@PrimerDia date OUTPUT', @PrimerDia = @PrimerDia OUTPUT;
            SET @MesCarga = DATEADD(DAY, 1 - DAY(@PrimerDia), @PrimerDia);

            SET @Sql = REPLACE(N'
                INSERT INTO #Mov (Fecha, Cuenta, Debito, Credito)
                SELECT CAST(T.RefDate AS date), J.Account, SUM(ISNULL(J.Debit, 0)), SUM(ISNULL(J.Credit, 0))
                FROM {db}.dbo.OJDT T WITH (NOLOCK)
                    INNER JOIN {db}.dbo.JDT1 J WITH (NOLOCK) ON J.TransId = T.TransId
                WHERE T.RefDate >= @MesCarga
                    AND T.RefDate < DATEADD(MONTH, 1, @MesCarga)
                    AND T.RefDate <= @Hoy
                    AND T.TransId <= @MaxTransId
                    AND ' + @FiltroAreVal + N'
                GROUP BY CAST(T.RefDate AS date), J.Account
                OPTION (RECOMPILE);', N'{db}', QUOTENAME(@Db));

            WHILE @MesCarga <= @Hoy
            BEGIN
                EXEC sp_executesql @Sql, N'@MesCarga date, @Hoy date, @MaxTransId int',
                    @MesCarga = @MesCarga, @Hoy = @Hoy, @MaxTransId = @MaxTransId;
                SET @MesCarga = DATEADD(MONTH, 1, @MesCarga);
            END

            IF NOT EXISTS (SELECT 1 FROM #Mov)
                RAISERROR (N'La carga completa no devolvió movimientos; se conserva la carga anterior.', 16, 1);
        END
        ELSE
        BEGIN
            SELECT @UltimoTransId = UltimoTransId FROM dbo.Informe_mov_contable_control WHERE Empresa = @Empresa;
            IF @UltimoTransId IS NULL
                RAISERROR (N'No hay carga previa de movimientos de esta empresa: ejecute primero con @CargaCompleta = 1.', 16, 1);

            -- Días recientes y días tocados por asientos nuevos, aunque tengan fecha atrás
            SET @Sql = REPLACE(N'
                INSERT INTO #Dias (Fecha)
                SELECT CAST(T.RefDate AS date)
                FROM {db}.dbo.OJDT T WITH (NOLOCK)
                WHERE T.RefDate >= DATEADD(DAY, -@DiasVentana, @Hoy) AND T.RefDate <= @Hoy
                GROUP BY CAST(T.RefDate AS date);

                INSERT INTO #Dias (Fecha)
                SELECT CAST(T.RefDate AS date)
                FROM {db}.dbo.OJDT T WITH (NOLOCK)
                WHERE T.TransId > @UltimoTransId AND T.TransId <= @MaxTransId AND T.RefDate <= @Hoy
                    AND NOT EXISTS (SELECT 1 FROM #Dias d WHERE d.Fecha = CAST(T.RefDate AS date))
                GROUP BY CAST(T.RefDate AS date);

                INSERT INTO #Mov (Fecha, Cuenta, Debito, Credito)
                SELECT CAST(T.RefDate AS date), J.Account, SUM(ISNULL(J.Debit, 0)), SUM(ISNULL(J.Credit, 0))
                FROM #Dias d
                    INNER JOIN {db}.dbo.OJDT T WITH (NOLOCK)
                        ON T.RefDate >= d.Fecha AND T.RefDate < DATEADD(DAY, 1, d.Fecha)
                    INNER JOIN {db}.dbo.JDT1 J WITH (NOLOCK) ON J.TransId = T.TransId
                WHERE T.TransId <= @MaxTransId
                    AND ' + @FiltroAreVal + N'
                GROUP BY CAST(T.RefDate AS date), J.Account
                OPTION (RECOMPILE);', N'{db}', QUOTENAME(@Db));
            EXEC sp_executesql @Sql, N'@DiasVentana int, @Hoy date, @UltimoTransId int, @MaxTransId int',
                @DiasVentana = @DiasVentana, @Hoy = @Hoy, @UltimoTransId = @UltimoTransId, @MaxTransId = @MaxTransId;
        END

        /* ── Paso 2. Guardar los movimientos ── */
        BEGIN TRANSACTION;

            IF @CargaCompleta = 1
            BEGIN
                DELETE FROM dbo.Informe_mov_contable_diario WHERE Empresa = @Empresa;
                SET @MovEliminados = @@ROWCOUNT;
            END
            ELSE
            BEGIN
                DELETE m
                FROM dbo.Informe_mov_contable_diario m
                INNER JOIN #Dias d ON d.Fecha = m.Fecha
                WHERE m.Empresa = @Empresa;
                SET @MovEliminados = @@ROWCOUNT;
            END

            INSERT INTO dbo.Informe_mov_contable_diario (Empresa, Fecha, Cuenta, Debito, Credito, FechaCarga)
            SELECT @Empresa, Fecha, Cuenta, Debito, Credito, @Inicio FROM #Mov;
            SET @MovInsertados = @@ROWCOUNT;

            IF EXISTS (SELECT 1 FROM dbo.Informe_mov_contable_control WHERE Empresa = @Empresa)
                UPDATE dbo.Informe_mov_contable_control
                SET UltimoTransId = @MaxTransId, FechaCarga = @Inicio
                WHERE Empresa = @Empresa;
            ELSE
                INSERT INTO dbo.Informe_mov_contable_control (Empresa, UltimoTransId, FechaCarga)
                VALUES (@Empresa, @MaxTransId, @Inicio);

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@ProcesoMov, @Modo, @Inicio, sysdatetime(), @MovEliminados, @MovInsertados, NULL);

        /* ── Paso 3. Meses del balance que se recalculan ──
           Completa: todos desde @BalanceDesde. Incremental: desde el mes anterior, o desde el mes del día
           más antiguo que se volvió a leer, porque un cambio en un mes mueve el saldo de los siguientes. */
        IF @CargaCompleta = 1
            SET @MesDesde = @BalanceDesde;
        ELSE
        BEGIN
            SET @MesDesde = DATEADD(MONTH, -1, @MesHoy);
            SELECT @PrimerDia = MIN(Fecha) FROM #Dias;
            IF @PrimerDia IS NOT NULL AND DATEADD(DAY, 1 - DAY(@PrimerDia), @PrimerDia) < @MesDesde
                SET @MesDesde = DATEADD(DAY, 1 - DAY(@PrimerDia), @PrimerDia);
            IF @MesDesde < @BalanceDesde SET @MesDesde = @BalanceDesde;
        END

        -- El balance de cada empresa empieza en su primer mes con movimientos (Viventta: 2025-08), para no
        -- generar meses en cero. Firplak tiene historia anterior a @BalanceDesde, así que no cambia.
        SELECT @PrimerDia = MIN(Fecha) FROM dbo.Informe_mov_contable_diario WHERE Empresa = @Empresa;
        IF @PrimerDia IS NOT NULL AND DATEADD(DAY, 1 - DAY(@PrimerDia), @PrimerDia) > @MesDesde
            SET @MesDesde = DATEADD(DAY, 1 - DAY(@PrimerDia), @PrimerDia);

        -- Cuentas del balance y nombres de todos los niveles
        CREATE TABLE #Cuentas (
            Account  nvarchar(8)   COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
            Lvl1     nvarchar(15)  COLLATE DATABASE_DEFAULT NOT NULL,
            Lvl2     nvarchar(2)   COLLATE DATABASE_DEFAULT NOT NULL,
            Lvl3     nvarchar(4)   COLLATE DATABASE_DEFAULT NOT NULL,
            Lvl4     nvarchar(6)   COLLATE DATABASE_DEFAULT NOT NULL
        );
        CREATE TABLE #Nombres (
            Codigo    nvarchar(15)   COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
            AcctName  nvarchar(200)  COLLATE DATABASE_DEFAULT NULL
        );

        SET @Sql = REPLACE(N'
            INSERT INTO #Cuentas (Account, Lvl1, Lvl2, Lvl3, Lvl4)
            SELECT A.AcctCode,
                   SUBSTRING(A.AcctCode, 1, 1) + REPLICATE(''0'', 14),
                   SUBSTRING(A.AcctCode, 1, 2),
                   SUBSTRING(A.AcctCode, 1, 4),
                   SUBSTRING(A.AcctCode, 1, 6)
            FROM {db}.dbo.OACT A WITH (NOLOCK)
            WHERE A.Levels = 5 AND A.Postable = ''Y'' AND LEN(A.AcctCode) = 8;

            INSERT INTO #Nombres (Codigo, AcctName)
            SELECT A.AcctCode, A.AcctName
            FROM {db}.dbo.OACT A WITH (NOLOCK)
            WHERE LEN(A.AcctCode) <= 15;', N'{db}', QUOTENAME(@Db));
        EXEC sp_executesql @Sql;

        -- Saldo de cada cuenta antes del primer mes que se recalcula
        CREATE TABLE #Saldo (Account nvarchar(8) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, Saldo decimal(19, 6) NOT NULL);
        INSERT INTO #Saldo (Account, Saldo)
        SELECT c.Account, ISNULL(SUM(m.Debito - m.Credito), 0)
        FROM #Cuentas c
            LEFT JOIN dbo.Informe_mov_contable_diario m
                ON m.Empresa = @Empresa AND m.Cuenta = c.Account AND m.Fecha < @MesDesde
        GROUP BY c.Account;

        CREATE TABLE #MovMes (Account nvarchar(8) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
                              Debito decimal(19, 6) NOT NULL, Credito decimal(19, 6) NOT NULL);
        CREATE TABLE #Bal5 (
            Mes           date            NOT NULL,
            Account       nvarchar(8)     COLLATE DATABASE_DEFAULT NOT NULL,
            SaldoInicial  decimal(19, 6)  NOT NULL,
            Debito        decimal(19, 6)  NOT NULL,
            Credito       decimal(19, 6)  NOT NULL,
            PRIMARY KEY (Mes, Account)
        );

        /* ── Paso 4. Nivel 5, mes por mes (saldo inicial = saldo final del mes anterior) ── */
        SET @Mes = @MesDesde;
        WHILE @Mes <= @MesHoy
        BEGIN
            TRUNCATE TABLE #MovMes;
            INSERT INTO #MovMes (Account, Debito, Credito)
            SELECT m.Cuenta, SUM(m.Debito), SUM(m.Credito)
            FROM dbo.Informe_mov_contable_diario m
                INNER JOIN #Cuentas c ON c.Account = m.Cuenta
            WHERE m.Empresa = @Empresa
                AND m.Fecha >= @Mes AND m.Fecha < DATEADD(MONTH, 1, @Mes) AND m.Fecha <= @Hoy
            GROUP BY m.Cuenta;

            INSERT INTO #Bal5 (Mes, Account, SaldoInicial, Debito, Credito)
            SELECT @Mes, s.Account, s.Saldo, ISNULL(v.Debito, 0), ISNULL(v.Credito, 0)
            FROM #Saldo s
                LEFT JOIN #MovMes v ON v.Account = s.Account;

            UPDATE s SET s.Saldo = s.Saldo + v.Debito - v.Credito
            FROM #Saldo s INNER JOIN #MovMes v ON v.Account = s.Account;

            SET @Mes = DATEADD(MONTH, 1, @Mes);
        END

        /* ── Paso 5. Los cinco niveles ── */
        CREATE TABLE #Bal (
            Mes           date            NOT NULL,
            CodigoCuenta  nvarchar(15)    COLLATE DATABASE_DEFAULT NOT NULL,
            Nivel         tinyint         NOT NULL,
            Lvl1          nvarchar(15)    COLLATE DATABASE_DEFAULT NOT NULL,
            Lvl2          nvarchar(2)     COLLATE DATABASE_DEFAULT NULL,
            Lvl3          nvarchar(4)     COLLATE DATABASE_DEFAULT NULL,
            Lvl4          nvarchar(6)     COLLATE DATABASE_DEFAULT NULL,
            Account       nvarchar(8)     COLLATE DATABASE_DEFAULT NULL,
            SaldoInicial  decimal(19, 6)  NOT NULL,
            Debito        decimal(19, 6)  NOT NULL,
            Credito       decimal(19, 6)  NOT NULL,
            PRIMARY KEY (Mes, CodigoCuenta)
        );

        INSERT INTO #Bal (Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, SaldoInicial, Debito, Credito)
        SELECT b.Mes, c.Lvl1, 1, c.Lvl1, NULL, NULL, NULL, NULL, SUM(b.SaldoInicial), SUM(b.Debito), SUM(b.Credito)
        FROM #Bal5 b INNER JOIN #Cuentas c ON c.Account = b.Account
        GROUP BY b.Mes, c.Lvl1;

        INSERT INTO #Bal (Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, SaldoInicial, Debito, Credito)
        SELECT b.Mes, c.Lvl2, 2, c.Lvl1, c.Lvl2, NULL, NULL, NULL, SUM(b.SaldoInicial), SUM(b.Debito), SUM(b.Credito)
        FROM #Bal5 b INNER JOIN #Cuentas c ON c.Account = b.Account
        GROUP BY b.Mes, c.Lvl1, c.Lvl2;

        INSERT INTO #Bal (Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, SaldoInicial, Debito, Credito)
        SELECT b.Mes, c.Lvl3, 3, c.Lvl1, c.Lvl2, c.Lvl3, NULL, NULL, SUM(b.SaldoInicial), SUM(b.Debito), SUM(b.Credito)
        FROM #Bal5 b INNER JOIN #Cuentas c ON c.Account = b.Account
        GROUP BY b.Mes, c.Lvl1, c.Lvl2, c.Lvl3;

        INSERT INTO #Bal (Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, SaldoInicial, Debito, Credito)
        SELECT b.Mes, c.Lvl4, 4, c.Lvl1, c.Lvl2, c.Lvl3, c.Lvl4, NULL, SUM(b.SaldoInicial), SUM(b.Debito), SUM(b.Credito)
        FROM #Bal5 b INNER JOIN #Cuentas c ON c.Account = b.Account
        GROUP BY b.Mes, c.Lvl1, c.Lvl2, c.Lvl3, c.Lvl4;

        INSERT INTO #Bal (Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, SaldoInicial, Debito, Credito)
        SELECT b.Mes, c.Account, 5, c.Lvl1, c.Lvl2, c.Lvl3, c.Lvl4, c.Account, b.SaldoInicial, b.Debito, b.Credito
        FROM #Bal5 b INNER JOIN #Cuentas c ON c.Account = b.Account;

        /* ── Paso 6. Reemplazo de los meses recalculados de esta empresa ── */
        BEGIN TRANSACTION;

            DELETE FROM dbo.Informe_balance
            WHERE Empresa = @Empresa
                AND (Anio > YEAR(@MesDesde) OR (Anio = YEAR(@MesDesde) AND Mes >= MONTH(@MesDesde)));
            SET @Eliminados = @@ROWCOUNT;

            INSERT INTO dbo.Informe_balance (
                Empresa, Anio, Mes, CodigoCuenta, Nivel, Lvl1, Lvl2, Lvl3, Lvl4, Account, AcctName,
                SaldoInicial, Debito, Credito, SaldoMes, SaldoFinal, Fecha, FechaCarga
            )
            SELECT
                @Empresa, YEAR(b.Mes), MONTH(b.Mes), b.CodigoCuenta, b.Nivel, b.Lvl1, b.Lvl2, b.Lvl3, b.Lvl4, b.Account,
                n.AcctName,
                CAST(b.SaldoInicial AS numeric(18, 2)),
                CAST(b.Debito AS numeric(18, 2)),
                CAST(b.Credito AS numeric(18, 2)),
                CAST(b.Debito - b.Credito AS numeric(18, 2)),
                CAST(b.SaldoInicial + b.Debito - b.Credito AS numeric(18, 2)),
                CASE WHEN b.Mes = @MesHoy THEN @Hoy ELSE DATEADD(DAY, -1, DATEADD(MONTH, 1, b.Mes)) END,
                @Inicio
            FROM #Bal b
                INNER JOIN #Nombres n ON n.Codigo = b.CodigoCuenta;   -- INNER JOIN OACT del original
            SET @Insertados = @@ROWCOUNT;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@ProcesoBal, @Modo, @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE #Dias, #Mov, #Cuentas, #Nombres, #Saldo, #MovMes, #Bal5, #Bal;
        EXEC sp_releaseapplock @Resource = @Recurso, @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@ProcesoBal, @Modo, @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = @Recurso, @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- Las dos empresas (Firplak tarda varios minutos; Viventta, segundos):
-- EXEC dbo.sp_Actualizar_Informe_balance @CargaCompleta = 1;
-- Solo una:
-- EXEC dbo.sp_Actualizar_Informe_balance @CargaCompleta = 1, @Empresa = N'Viventta';

/* ───────────── 4. Validación (solo lectura) ───────────── */

-- 4.1 Últimas cargas: Error debe ser NULL (Firplak: Informe_balance; Viventta: Informe_balance_Viventta)
-- SELECT TOP (8) * FROM dbo.Cargas_Log
-- WHERE Proceso LIKE N'Informe_mov_contable_diario%' OR Proceso LIKE N'Informe_balance%' ORDER BY Inicio DESC;

-- 4.2 Por empresa y mes: filas, débito = crédito, suma de saldos = 0 y encadenamiento
--     (el saldo inicial de cada cuenta es el saldo final del mes anterior; esperado 0 cuentas).
-- SELECT b.Empresa, b.Anio, b.Mes, MAX(b.Fecha) AS Fecha, COUNT_BIG(1) AS Filas,
--        SUM(CASE WHEN b.Nivel = 5 THEN b.Debito END) AS Debito,
--        SUM(CASE WHEN b.Nivel = 5 THEN b.Credito END) AS Credito,
--        SUM(CASE WHEN b.Nivel = 5 THEN b.SaldoFinal END) AS SumaSaldos,
--        SUM(CASE WHEN b.Nivel = 5 AND p.CodigoCuenta IS NOT NULL AND b.SaldoInicial <> p.SaldoFinal THEN 1 ELSE 0 END) AS NoEncadenan
-- FROM dbo.Informe_balance b
--     LEFT JOIN dbo.Informe_balance p ON p.Empresa = b.Empresa AND p.CodigoCuenta = b.CodigoCuenta
--         AND p.Anio * 12 + p.Mes = b.Anio * 12 + b.Mes - 1
-- WHERE b.Anio >= 2025
-- GROUP BY b.Empresa, b.Anio, b.Mes ORDER BY b.Empresa, b.Anio, b.Mes;

-- 4.3 Viventta contra SAP: octubre 2026 debe dar 111.367.753,56 de débito y de crédito
--     (bloque 10 de las consultas de verificación del 2026-11-19).
-- SELECT SUM(Debito) AS Debito, SUM(Credito) AS Credito FROM dbo.Informe_balance
-- WHERE Empresa = N'Viventta' AND Anio = 2026 AND Mes = 10 AND Nivel = 5;

/* ───────────── 5. Job: ver 03_job_estados_financieros.sql (no cambia: sin @Empresa corren las dos) ───────────── */
