/*
  Estados Financieros: detalle de las cuentas 14 (inventarios) y 74 (costos de producción), por empresa
  (Firplak y Viventta).
  Proyecto: llm-wiki/proyectos/estados-financieros.md

  Base: query "cuentas 14 y 74" de Contabilidad (pegado por el desarrollador el 2026-11-19), sin cambios
  de reglas:
    - Desde el 2021-01-01 hasta hoy, asientos con OJDT.U_HBT_AreVal IN ('Comun', 'IFRS').
      (Ojo: el balance también incluye '' y NULL; este query no. Se respeta el original.)
    - Parte A: cuentas 14050505, 14050510, 14050520, 14050555, 14050560, 14350505, 14350510
               con TransType 18, 19, 20, 21.
    - Parte B: las mismas cuentas con TransType 69 (precios de entrega) y tercero 'PE%'
               (el LEFT JOIN a OCRD con CardCode LIKE 'PE%' en el WHERE equivale a un INNER JOIN).
    - Parte C: cuentas 74010505, 74010510, 74010515, 74010520, 74010525 con TransType 18, 19, 20, 21.
    - Grano: una fila por empresa + asiento (TransId) + cuenta + tercero + tipo + fecha, con débito y
      crédito sumados y redondeados a pesos (numeric(12,0)) como en el original. Saldo = débito - crédito
      redondeados.
    - Las tres partes no se cruzan (cuentas o TransType distintos), así que el UNION del original es
      igual a UNION ALL. El SP lo comprueba: si hubiera una clave repetida, falla sin tocar la tabla.

  Viventta (consultas de verificación del 2026-11-19): de las 12 cuentas solo existen 14350505 y
  14350510, y no tienen movimientos. Viventta presta servicios: mueve 14100515, 14300510, 61359505 y
  7305xx, que no están en este query. Con las reglas de Firplak su parte queda vacía hasta que
  Contabilidad defina otras cuentas; entonces se cambia la lista de cuentas por empresa en el paso 1.

  Estrategia de carga:
    - Incremental (diaria, 5:00): borra y recarga los últimos @DiasVentana días por fecha contable.
    - Completa (domingo): recarga desde el 2021-01-01, para recoger asientos registrados con fecha
      anterior a la ventana.
    - Sin @Empresa: las dos empresas, una después de la otra.

  Compatibilidad: Planos_Symphony y Firplak_SA en nivel 100 (DBViventta en 130). Sin CTE, APPLY,
  TRY_CONVERT, CREATE OR ALTER ni THROW (mismas reglas que sql/ns-plantas). SAP solo se lee, con NOLOCK,
  mediante sp_executesql para elegir la base de la empresa (nombre de una lista fija).
  Bitácora: dbo.Cargas_Log.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Instalación nueva: 1) tabla e índices  2) SP  3) primera carga  4) validación  5) job (03)
  Si ya existía la tabla de la versión de una sola empresa: primero 04_multiempresa.sql.
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tabla de reporte (solo se crea si no existe) ───────────── */
IF OBJECT_ID(N'dbo.Informe_cuentas_14_74', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_cuentas_14_74 (
        Empresa               nvarchar(20)   NOT NULL,   -- Firplak | Viventta
        FechaContabilizacion  date           NOT NULL,   -- JDT1.RefDate
        TransId               int            NOT NULL,
        CuentaContable        nvarchar(15)   NOT NULL,
        CodigoTercero         nvarchar(100)  NOT NULL,   -- JDT1.U_HBT_Tercero; '' cuando SAP lo tiene vacío o NULL
        TransType             int            NOT NULL,   -- 18, 19, 20, 21 o 69
        DescripcionCuenta     nvarchar(200)  NULL,
        Origen                nvarchar(30)   NULL,       -- Texto del TransType, igual que el query
        NombreTercero         nvarchar(200)  NULL,       -- OCRD.CardName
        Debito                numeric(12, 0) NOT NULL,
        Credito               numeric(12, 0) NOT NULL,
        SaldoMensual          numeric(13, 0) NOT NULL,   -- Debito - Credito (ya redondeados)
        Anio                  smallint       NOT NULL,
        FechaCarga            datetime2(0)   NOT NULL,
        CONSTRAINT PK_Informe_cuentas_14_74
            PRIMARY KEY CLUSTERED (Empresa, FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType)
    );

    -- Filtro por cuenta y periodo (el endpoint filtra por cuenta casi siempre)
    CREATE NONCLUSTERED INDEX IX_Informe_cuentas_14_74_Cuenta
        ON dbo.Informe_cuentas_14_74 (Empresa, CuentaContable, FechaContabilizacion)
        INCLUDE (Debito, Credito, SaldoMensual);

    -- Filtro por tercero
    CREATE NONCLUSTERED INDEX IX_Informe_cuentas_14_74_Tercero
        ON dbo.Informe_cuentas_14_74 (Empresa, CodigoTercero, FechaContabilizacion);
END
GO

/* ───────────── 2. SP de actualización ───────────── */
IF OBJECT_ID(N'dbo.sp_Actualizar_Informe_cuentas_14_74', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Actualizar_Informe_cuentas_14_74;
GO

CREATE PROCEDURE dbo.sp_Actualizar_Informe_cuentas_14_74
    @CargaCompleta bit          = 0,     -- 1 = desde el 2021-01-01 (primera carga y domingo)
    @DiasVentana   int          = 60,    -- Incremental: días hacia atrás que se recargan
    @Empresa       nvarchar(20) = NULL   -- Firplak | Viventta; NULL = las dos
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* ── Sin empresa: una corrida por empresa. Si una falla, se intenta la otra y al final se informa. ── */
    IF @Empresa IS NULL
    BEGIN
        DECLARE @ErrorEmpresas nvarchar(4000);

        BEGIN TRY
            EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta, @DiasVentana, N'Firplak';
        END TRY
        BEGIN CATCH
            SET @ErrorEmpresas = N'Firplak: ' + LEFT(ERROR_MESSAGE(), 1900);
        END CATCH

        BEGIN TRY
            EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta, @DiasVentana, N'Viventta';
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

    -- Firplak conserva el nombre de proceso de la primera versión
    DECLARE @Proceso    nvarchar(100) = N'Informe_cuentas_14_74' + CASE WHEN @Empresa = N'Firplak' THEN N'' ELSE N'_' + @Empresa END;
    DECLARE @Recurso    nvarchar(255) = N'sp_Actualizar_Informe_cuentas_14_74_' + @Empresa;

    DECLARE @Inicio     datetime2(0) = sysdatetime();
    DECLARE @Modo       nvarchar(20) = CASE WHEN @CargaCompleta = 1 THEN N'COMPLETA' ELSE N'INCREMENTAL' END;
    DECLARE @FechaIni   date = '20210101';   -- @fechaIni del query original
    DECLARE @Hoy        date = CAST(GETDATE() AS date);
    DECLARE @Desde      date;
    DECLARE @Eliminados int = 0;
    DECLARE @Insertados int = 0;
    DECLARE @Duplicados int = 0;
    DECLARE @Bloqueo    int;
    DECLARE @Error      nvarchar(4000);
    DECLARE @Sql        nvarchar(max);

    SET @Desde = CASE WHEN @CargaCompleta = 1 THEN @FechaIni ELSE DATEADD(DAY, -@DiasVentana, @Hoy) END;
    IF @Desde < @FechaIni SET @Desde = @FechaIni;

    EXEC @Bloqueo = sp_getapplock
        @Resource = @Recurso, @LockMode = N'Exclusive', @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@Proceso, @Modo, @Inicio, sysdatetime(), 0, 0, N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        IF OBJECT_ID('tempdb..#Base') IS NOT NULL DROP TABLE #Base;

        CREATE TABLE #Base (
            FechaContabilizacion  date           NOT NULL,
            TransId               int            NOT NULL,
            CuentaContable        nvarchar(15)   COLLATE DATABASE_DEFAULT NOT NULL,
            CodigoTercero         nvarchar(100)  COLLATE DATABASE_DEFAULT NOT NULL,
            TransType             int            NOT NULL,
            DescripcionCuenta     nvarchar(200)  COLLATE DATABASE_DEFAULT NULL,
            NombreTercero         nvarchar(200)  COLLATE DATABASE_DEFAULT NULL,
            Debito                numeric(12, 0) NOT NULL,
            Credito               numeric(12, 0) NOT NULL
        );

        /* ── Paso 1. Lectura de SAP (base de la empresa) ──
           Partes A y C del query: TransType 18, 19, 20, 21 en las cuentas 14 y 74.
           Parte B: precios de entrega (TransType 69) de proveedores del exterior (tercero 'PE%'). */
        SET @Sql = REPLACE(N'
            INSERT INTO #Base (FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType,
                               DescripcionCuenta, NombreTercero, Debito, Credito)
            SELECT
                CAST(T0.RefDate AS date),
                T0.TransId,
                T1.AcctCode,
                ISNULL(T0.U_HBT_Tercero, N''''),
                T0.TransType,
                T1.AcctName,
                T3.CardName,
                CONVERT(numeric(12, 0), SUM(T0.Debit)),
                CONVERT(numeric(12, 0), SUM(T0.Credit))
            FROM {db}.dbo.JDT1 T0 WITH (NOLOCK)
                INNER JOIN {db}.dbo.OACT T1 WITH (NOLOCK) ON T0.Account = T1.AcctCode
                INNER JOIN {db}.dbo.OJDT T2 WITH (NOLOCK) ON T0.TransId = T2.TransId
                LEFT JOIN {db}.dbo.OCRD T3 WITH (NOLOCK) ON T0.U_HBT_Tercero = T3.CardCode
            WHERE T0.RefDate >= @Desde
                AND T0.RefDate <= GETDATE()
                AND T2.U_HBT_AreVal IN (''Comun'', ''IFRS'')
                AND T0.TransType IN (18, 19, 20, 21)
                AND T0.Account IN (''14050505'', ''14050510'', ''14050520'', ''14050555'', ''14050560'', ''14350505'', ''14350510'',
                                   ''74010505'', ''74010510'', ''74010515'', ''74010520'', ''74010525'')
            GROUP BY T1.AcctCode, T1.AcctName, T0.RefDate, T0.U_HBT_Tercero, T3.CardName, T0.TransId, T0.TransType
            OPTION (RECOMPILE);

            INSERT INTO #Base (FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType,
                               DescripcionCuenta, NombreTercero, Debito, Credito)
            SELECT
                CAST(T0.RefDate AS date),
                T0.TransId,
                T1.AcctCode,
                ISNULL(T0.U_HBT_Tercero, N''''),
                T0.TransType,
                T1.AcctName,
                T3.CardName,
                CONVERT(numeric(12, 0), SUM(T0.Debit)),
                CONVERT(numeric(12, 0), SUM(T0.Credit))
            FROM {db}.dbo.JDT1 T0 WITH (NOLOCK)
                INNER JOIN {db}.dbo.OACT T1 WITH (NOLOCK) ON T0.Account = T1.AcctCode
                INNER JOIN {db}.dbo.OJDT T2 WITH (NOLOCK) ON T0.TransId = T2.TransId
                INNER JOIN {db}.dbo.OCRD T3 WITH (NOLOCK) ON T0.U_HBT_Tercero = T3.CardCode
            WHERE T0.RefDate >= @Desde
                AND T0.RefDate <= GETDATE()
                AND T2.U_HBT_AreVal IN (''Comun'', ''IFRS'')
                AND T0.TransType = 69
                AND T3.CardCode LIKE ''PE%''
                AND T0.Account IN (''14050505'', ''14050510'', ''14050520'', ''14050555'', ''14050560'', ''14350505'', ''14350510'')
            GROUP BY T1.AcctCode, T1.AcctName, T0.RefDate, T0.U_HBT_Tercero, T3.CardName, T0.TransId, T0.TransType
            OPTION (RECOMPILE);', N'{db}', QUOTENAME(@Db));
        EXEC sp_executesql @Sql, N'@Desde date', @Desde = @Desde;

        -- El original agrupa también por U_IFRS_Tipo (de la cuenta) y U_HBT_AreVal (del asiento): no
        -- cambian el grano. Si una clave se repitiera, el original mostraría dos filas; aquí se detiene.
        SELECT @Duplicados = COUNT(1)
        FROM (SELECT 1 AS x FROM #Base
              GROUP BY FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType
              HAVING COUNT(1) > 1) d;
        IF @Duplicados > 0
        BEGIN
            SET @Error = N'Hay ' + CAST(@Duplicados AS nvarchar(10))
                       + N' claves repetidas (fecha, asiento, cuenta, tercero, tipo). Se conserva la carga anterior.';
            RAISERROR (N'%s', 16, 1, @Error);
        END

        -- Firplak siempre tiene filas; Viventta hoy no (ver encabezado), así que en ella no es un error.
        IF @CargaCompleta = 1 AND @Empresa = N'Firplak' AND NOT EXISTS (SELECT 1 FROM #Base)
            RAISERROR (N'La carga completa no devolvió filas; se conserva la carga anterior.', 16, 1);

        /* ── Paso 2. Reemplazo en la tabla de reporte (solo las filas de esta empresa) ── */
        BEGIN TRANSACTION;

            DELETE FROM dbo.Informe_cuentas_14_74
            WHERE Empresa = @Empresa AND FechaContabilizacion >= @Desde;
            SET @Eliminados = @@ROWCOUNT;

            INSERT INTO dbo.Informe_cuentas_14_74 (
                Empresa, FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType, DescripcionCuenta,
                Origen, NombreTercero, Debito, Credito, SaldoMensual, Anio, FechaCarga
            )
            SELECT
                @Empresa, b.FechaContabilizacion, b.TransId, b.CuentaContable, b.CodigoTercero, b.TransType,
                b.DescripcionCuenta,
                CASE b.TransType
                    WHEN 21 THEN N'Devolución Mercancía'
                    WHEN 18 THEN N'Factura Proveedor'
                    WHEN 20 THEN N'Entrada de Mercancía'
                    WHEN 19 THEN N'Nota Crédito Proveedor'
                    WHEN 69 THEN N'Precios de Entrega'
                END,
                b.NombreTercero,
                b.Debito,
                b.Credito,
                b.Debito - b.Credito,
                YEAR(b.FechaContabilizacion),
                @Inicio
            FROM #Base b;
            SET @Insertados = @@ROWCOUNT;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@Proceso, @Modo, @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE #Base;
        EXEC sp_releaseapplock @Resource = @Recurso, @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @Error = LEFT(ERROR_MESSAGE(), 4000);

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (@Proceso, @Modo, @Inicio, sysdatetime(), 0, 0, @Error);

        EXEC sp_releaseapplock @Resource = @Recurso, @LockOwner = N'Session';
        RAISERROR (N'%s', 16, 1, @Error);
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- Las dos empresas:
-- EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta = 1;
-- Solo una:
-- EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta = 1, @Empresa = N'Viventta';

/* ───────────── 4. Validación (solo lectura) ───────────── */

-- 4.1 Últimas cargas: Error debe ser NULL (Firplak: Informe_cuentas_14_74; Viventta: Informe_cuentas_14_74_Viventta)
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso LIKE N'Informe_cuentas_14_74%' ORDER BY Inicio DESC;

-- 4.2 Filas por empresa y año. Referencia Firplak (2026-11-19): 2021 = 3.221, 2022 = 3.931, 2023 = 4.631,
--     2024 = 4.855, 2025 = 6.164 filas; débitos 2021 = 15.827.269.848 … 2025 = 28.240.303.612.
--     Viventta: 0 filas (no mueve estas cuentas).
-- SELECT Empresa, Anio, COUNT_BIG(1) AS Filas, SUM(Debito) AS Debito, SUM(Credito) AS Credito
-- FROM dbo.Informe_cuentas_14_74 GROUP BY Empresa, Anio ORDER BY Empresa, Anio;

-- 4.3 Por origen y cuenta en un mes cerrado, para cuadrar contra el query original del mismo mes
-- SELECT CuentaContable, Origen, COUNT_BIG(1) AS Filas, SUM(Debito) AS Debito, SUM(Credito) AS Credito
-- FROM dbo.Informe_cuentas_14_74
-- WHERE Empresa = N'Firplak' AND FechaContabilizacion >= '20261001' AND FechaContabilizacion < '20261101'
-- GROUP BY CuentaContable, Origen ORDER BY CuentaContable, Origen;

/* ───────────── 5. Job: ver 03_job_estados_financieros.sql (no cambia: sin @Empresa corren las dos) ───────────── */
