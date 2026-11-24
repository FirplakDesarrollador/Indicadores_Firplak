/*
  BI PKT (productividad del capital de trabajo): tablas de reporte y SP de carga.
  Ficha: llm-wiki/bi/pkt.md (secciones 1 y 2).

  Qué calcula:
    - Saldo de fin de mes de los 12 conceptos del KTNO, por compañía (Firplak_SA y DBViventta),
      con las reglas de cuentas del BI validadas con la consulta V3 (fase 1).
    - Solo asientos con área de valoración 'Comun', 'IFRS', vacía o nula (D4).
    - Solo meses cerrados, desde enero de 2020 (D1, D7).
    - Eliminación entre compañías (D9): se resta de cada concepto el saldo con el tercero de la otra
      compañía, solo en el sentido cuyos saldos coinciden en las dos compañías (diferencia <= @Tolerancia).
      Sentidos: "Firplak debe a Viventta" = pasivos (clase 2) de Firplak + activos (clase 1) de Viventta;
                "Viventta debe a Firplak" = activos (clase 1) de Firplak + pasivos (clase 2) de Viventta.
      El tercero se identifica por JDT1.ShortName contra los socios de negocio con el NIT de la otra compañía.
    - Las ventas NO se cargan aquí: la API las lee de dbo.Informe_ventas (D5, D14).

  Estrategia: carga completa en cada ejecución. El saldo de un mes necesita toda la historia de asientos,
  así que una ventana incremental no ahorra lectura del origen; el resultado es pequeño
  (12 conceptos x 2 compañías x meses desde 2020, unas 2.000 filas). El SP agrega los movimientos por
  mes en tablas temporales, sin cursores, y reemplaza las dos tablas dentro de una transacción.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 1) tablas  2) SP  3) primera carga  4) validación  5) job (02_job_pkt.sql)
  Lee Firplak_SA y DBViventta (misma instancia ITPLAKINFO) con nombres de tres partes.

  Rollback:
    DROP PROCEDURE IF EXISTS dbo.sp_Actualizar_Informe_pkt;
    DROP TABLE IF EXISTS dbo.Informe_pkt_intercompania, dbo.Informe_pkt_saldos;
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tablas de reporte ───────────── */

-- Una fila por fin de mes x compañía x concepto.
IF OBJECT_ID(N'dbo.Informe_pkt_saldos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_pkt_saldos (
        FechaCorte          date           NOT NULL,   -- Último día del mes (solo meses cerrados)
        Anio                smallint       NOT NULL,
        Mes                 tinyint        NOT NULL,
        Empresa             nvarchar(20)   NOT NULL,   -- Firplak | Viventta
        Grupo               nvarchar(60)   NOT NULL,   -- Capital de Trabajo | Proveedores de bienes y servicios
        Concepto            nvarchar(80)   NOT NULL,   -- Nombre igual al de la matriz del BI
        Orden               tinyint        NOT NULL,   -- Orden de la matriz del BI (D13)
        SaldoContable       decimal(19, 2) NOT NULL,   -- Débitos - créditos acumulados al corte
        SaldoIntercompania  decimal(19, 2) NOT NULL,   -- Parte que se elimina (0 si el sentido no coincide)
        Saldo               decimal(19, 2) NOT NULL,   -- SaldoContable - SaldoIntercompania (el que usa el PKT)
        FechaCarga          datetime2(0)   NOT NULL
            CONSTRAINT DF_Informe_pkt_saldos_FechaCarga DEFAULT (sysdatetime()),
        CONSTRAINT PK_Informe_pkt_saldos PRIMARY KEY CLUSTERED (FechaCorte, Empresa, Concepto)
    );
    -- Sin índices adicionales: la tabla es pequeña y la API siempre filtra por FechaCorte (clave clustered).
END
GO

-- Detalle de la eliminación entre compañías, para auditoría y conciliación. Una fila por corte x cuenta x tercero.
IF OBJECT_ID(N'dbo.Informe_pkt_intercompania', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_pkt_intercompania (
        FechaCorte          date           NOT NULL,
        Sentido             nvarchar(40)   NOT NULL,   -- Firplak debe a Viventta | Viventta debe a Firplak
        Empresa             nvarchar(20)   NOT NULL,   -- Compañía que registra el saldo
        Cuenta              nvarchar(15)   NOT NULL,
        Tercero             nvarchar(50)   NOT NULL,   -- CardCode de la otra compañía
        Concepto            nvarchar(80)   NULL,       -- NULL si la cuenta no pertenece a ningún concepto del PKT
        Saldo               decimal(19, 2) NOT NULL,
        DiferenciaSentido   decimal(19, 2) NOT NULL,   -- Suma de las dos compañías en el sentido (0 = cuadra)
        Coincide            bit            NOT NULL,   -- 1 = se elimina; 0 = queda para revisión de Contabilidad
        FechaCarga          datetime2(0)   NOT NULL
            CONSTRAINT DF_Informe_pkt_intercompania_FechaCarga DEFAULT (sysdatetime()),
        CONSTRAINT PK_Informe_pkt_intercompania PRIMARY KEY CLUSTERED (FechaCorte, Empresa, Cuenta, Tercero)
    );
END
GO

/* ───────────── 2. SP de actualización ───────────── */
CREATE OR ALTER PROCEDURE dbo.sp_Actualizar_Informe_pkt
    @Tolerancia decimal(19, 2) = 1.00   -- Diferencia máxima (en pesos) para considerar que un sentido coincide
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Desde       date         = '20200101';                     -- D7
    DECLARE @Hasta       date         = EOMONTH(GETDATE(), -1);         -- Último mes cerrado (D1)
    DECLARE @NitFirplak  nvarchar(20) = N'890927404';
    DECLARE @NitViventta nvarchar(20) = N'901967145';
    DECLARE @Inicio      datetime2(0) = sysdatetime();
    DECLARE @Eliminados  int = 0;
    DECLARE @Insertados  int = 0;
    DECLARE @Bloqueo     int;

    -- Evita dos cargas simultáneas (por ejemplo, el job y una ejecución manual).
    EXEC @Bloqueo = sp_getapplock
        @Resource = N'sp_Actualizar_Informe_pkt', @LockMode = N'Exclusive',
        @LockOwner = N'Session', @LockTimeout = 0;
    IF @Bloqueo < 0
    BEGIN
        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_pkt', N'COMPLETA', @Inicio, sysdatetime(), 0, 0,
                N'Omitida: ya hay una carga en curso.');
        RETURN;
    END

    BEGIN TRY
        DROP TABLE IF EXISTS #Conceptos, #Cortes, #Terceros, #Mov, #SaldoConcepto, #SaldoIC, #Sentido;

        /* ── Paso 1. Catálogos ── */

        -- Conceptos en el orden de la matriz del BI (D13).
        CREATE TABLE #Conceptos (
            Concepto nvarchar(80) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,
            Grupo    nvarchar(60) COLLATE DATABASE_DEFAULT NOT NULL,
            Orden    tinyint      NOT NULL
        );
        INSERT INTO #Conceptos (Concepto, Grupo, Orden) VALUES
            (N'Anticipos de Impuestos o saldos a favor',  N'Capital de Trabajo', 1),
            (N'Clientes',                                  N'Capital de Trabajo', 2),
            (N'Inventarios',                               N'Capital de Trabajo', 3),
            (N'Otras cuentas por cobrar operativas',       N'Capital de Trabajo', 4),
            (N'Provisión (Deterioro) CxC (Vr. negativo)',  N'Capital de Trabajo', 5),
            (N'Costos y Gastos por pagar',                 N'Proveedores de bienes y servicios', 6),
            (N'Impuestos por pagar',                       N'Proveedores de bienes y servicios', 7),
            (N'Ob. Fras. Prov. - Confirming',              N'Proveedores de bienes y servicios', 8),
            (N'Obligaciones laborales',                    N'Proveedores de bienes y servicios', 9),
            (N'Otras cuentas por pagar operativas',        N'Proveedores de bienes y servicios', 10),
            (N'Pasivos estimados y provisiones',           N'Proveedores de bienes y servicios', 11),
            (N'Proveedores',                               N'Proveedores de bienes y servicios', 12);

        -- Un corte por mes cerrado.
        CREATE TABLE #Cortes (MesInicio date NOT NULL PRIMARY KEY, FechaCorte date NOT NULL);
        WITH M AS (
            SELECT @Desde AS MesInicio
            UNION ALL
            SELECT DATEADD(month, 1, MesInicio) FROM M WHERE DATEADD(month, 1, MesInicio) <= @Hasta
        )
        INSERT INTO #Cortes (MesInicio, FechaCorte)
        SELECT MesInicio, EOMONTH(MesInicio) FROM M
        OPTION (MAXRECURSION 1000);

        -- Socios de negocio que representan a la otra compañía (por NIT en el código o en LicTradNum).
        CREATE TABLE #Terceros (
            Empresa  nvarchar(20) COLLATE DATABASE_DEFAULT NOT NULL,
            CardCode nvarchar(50) COLLATE DATABASE_DEFAULT NOT NULL,
            PRIMARY KEY (Empresa, CardCode)
        );
        INSERT INTO #Terceros (Empresa, CardCode)
        SELECT DISTINCT N'Firplak', c.CardCode
        FROM Firplak_SA.dbo.OCRD AS c
        WHERE c.CardCode LIKE N'%' + @NitViventta + N'%' OR c.LicTradNum LIKE @NitViventta + N'%';

        INSERT INTO #Terceros (Empresa, CardCode)
        SELECT DISTINCT N'Viventta', c.CardCode
        FROM DBViventta.dbo.OCRD AS c
        WHERE c.CardCode LIKE N'%' + @NitFirplak + N'%' OR c.LicTradNum LIKE @NitFirplak + N'%';

        /* ── Paso 2. Movimientos por cuenta y mes (los anteriores a 2020 se acumulan en enero de 2020) ── */
        CREATE TABLE #Mov (
            Empresa  nvarchar(20) COLLATE DATABASE_DEFAULT NOT NULL,
            Cuenta   nvarchar(15) COLLATE DATABASE_DEFAULT NOT NULL,
            Tercero  nvarchar(50) COLLATE DATABASE_DEFAULT NULL,   -- Solo si el asiento es con la otra compañía
            Mes      date           NOT NULL,
            Neto     decimal(19, 2) NOT NULL,
            Concepto nvarchar(80) COLLATE DATABASE_DEFAULT NULL
        );

        INSERT INTO #Mov (Empresa, Cuenta, Tercero, Mes, Neto)
        SELECT N'Firplak', TA.Account, T.CardCode,
               CASE WHEN TA.RefDate < @Desde THEN @Desde
                    ELSE DATEFROMPARTS(YEAR(TA.RefDate), MONTH(TA.RefDate), 1) END,
               SUM(TA.Debit - TA.Credit)
        FROM Firplak_SA.dbo.JDT1 AS TA
        INNER JOIN Firplak_SA.dbo.OJDT AS TB ON TB.TransId = TA.TransId
        INNER JOIN Firplak_SA.dbo.OACT AS TC ON TC.AcctCode = TA.Account
        LEFT JOIN #Terceros AS T
            ON T.Empresa = N'Firplak' AND T.CardCode = TA.ShortName COLLATE DATABASE_DEFAULT
        WHERE TA.RefDate <= @Hasta
          AND (TB.U_HBT_AreVal IN (N'Comun', N'IFRS', N'') OR TB.U_HBT_AreVal IS NULL)
          AND TC.Levels = 5 AND TC.Postable = 'Y' AND LEN(TC.AcctCode) = 8
          AND (TA.Account LIKE '1%' OR TA.Account LIKE '2%')
        GROUP BY TA.Account, T.CardCode,
                 CASE WHEN TA.RefDate < @Desde THEN @Desde
                      ELSE DATEFROMPARTS(YEAR(TA.RefDate), MONTH(TA.RefDate), 1) END;

        INSERT INTO #Mov (Empresa, Cuenta, Tercero, Mes, Neto)
        SELECT N'Viventta', TA.Account, T.CardCode,
               CASE WHEN TA.RefDate < @Desde THEN @Desde
                    ELSE DATEFROMPARTS(YEAR(TA.RefDate), MONTH(TA.RefDate), 1) END,
               SUM(TA.Debit - TA.Credit)
        FROM DBViventta.dbo.JDT1 AS TA
        INNER JOIN DBViventta.dbo.OJDT AS TB ON TB.TransId = TA.TransId
        INNER JOIN DBViventta.dbo.OACT AS TC ON TC.AcctCode = TA.Account
        LEFT JOIN #Terceros AS T
            ON T.Empresa = N'Viventta' AND T.CardCode = TA.ShortName COLLATE DATABASE_DEFAULT
        WHERE TA.RefDate <= @Hasta
          AND (TB.U_HBT_AreVal IN (N'Comun', N'IFRS', N'') OR TB.U_HBT_AreVal IS NULL)
          AND TC.Levels = 5 AND TC.Postable = 'Y' AND LEN(TC.AcctCode) = 8
          AND (TA.Account LIKE '1%' OR TA.Account LIKE '2%')
        GROUP BY TA.Account, T.CardCode,
                 CASE WHEN TA.RefDate < @Desde THEN @Desde
                      ELSE DATEFROMPARTS(YEAR(TA.RefDate), MONTH(TA.RefDate), 1) END;

        /* ── Paso 3. Concepto de cada cuenta (reglas del BI, ficha sección 1 y consulta V3) ── */
        UPDATE #Mov SET Concepto =
            CASE
                WHEN Cuenta IN (N'13050505', N'13051005', N'13051010')                      THEN N'Clientes'
                WHEN Cuenta LIKE N'1355%'                                                   THEN N'Anticipos de Impuestos o saldos a favor'
                WHEN Cuenta LIKE N'14%'                                                     THEN N'Inventarios'
                WHEN (Cuenta LIKE N'1330%' AND Cuenta <> N'13300515') OR Cuenta LIKE N'1365%' THEN N'Otras cuentas por cobrar operativas'
                WHEN Cuenta IN (N'13050590', N'13051090') OR Cuenta LIKE N'139905%'         THEN N'Provisión (Deterioro) CxC (Vr. negativo)'
                WHEN Cuenta LIKE N'22%'                                                     THEN N'Proveedores'
                WHEN Cuenta IN (N'21051040', N'21051045')                                   THEN N'Ob. Fras. Prov. - Confirming'
                WHEN Cuenta LIKE N'2335%' AND Cuenta NOT IN (N'23359515', N'23359525', N'23359530')
                                                                                            THEN N'Costos y Gastos por pagar'
                WHEN Cuenta = N'24040505'                                                   THEN N'Impuestos por pagar'
                WHEN Cuenta LIKE N'25%'                                                     THEN N'Obligaciones laborales'
                WHEN LEFT(Cuenta, 4) IN (N'2365', N'2367', N'2368', N'2370', N'2380', N'2408', N'2805')
                                                                                            THEN N'Otras cuentas por pagar operativas'
                WHEN Cuenta LIKE N'26%'                                                     THEN N'Pasivos estimados y provisiones'
            END;

        /* ── Paso 4. Saldo contable por compañía, concepto y corte (acumulado de movimientos) ── */
        CREATE TABLE #SaldoConcepto (
            FechaCorte    date NOT NULL,
            Empresa       nvarchar(20) COLLATE DATABASE_DEFAULT NOT NULL,
            Concepto      nvarchar(80) COLLATE DATABASE_DEFAULT NOT NULL,
            SaldoContable decimal(19, 2) NOT NULL,
            PRIMARY KEY (FechaCorte, Empresa, Concepto)
        );
        WITH MovConcepto AS (
            SELECT Empresa, Concepto, Mes, SUM(Neto) AS Neto
            FROM #Mov
            WHERE Concepto IS NOT NULL
            GROUP BY Empresa, Concepto, Mes
        ),
        Malla AS (
            SELECT e.Empresa, k.Concepto, c.MesInicio, c.FechaCorte
            FROM (VALUES (N'Firplak'), (N'Viventta')) AS e (Empresa)
            CROSS JOIN #Conceptos AS k
            CROSS JOIN #Cortes AS c
        )
        INSERT INTO #SaldoConcepto (FechaCorte, Empresa, Concepto, SaldoContable)
        SELECT g.FechaCorte, g.Empresa, g.Concepto,
               SUM(ISNULL(m.Neto, 0)) OVER (PARTITION BY g.Empresa, g.Concepto ORDER BY g.MesInicio
                                            ROWS UNBOUNDED PRECEDING)
        FROM Malla AS g
        LEFT JOIN MovConcepto AS m
            ON m.Empresa = g.Empresa AND m.Concepto = g.Concepto AND m.Mes = g.MesInicio;

        /* ── Paso 5. Saldos con la otra compañía por cuenta y corte, y cuadre por sentido ── */
        CREATE TABLE #SaldoIC (
            FechaCorte date NOT NULL,
            Sentido    nvarchar(40) COLLATE DATABASE_DEFAULT NOT NULL,
            Empresa    nvarchar(20) COLLATE DATABASE_DEFAULT NOT NULL,
            Cuenta     nvarchar(15) COLLATE DATABASE_DEFAULT NOT NULL,
            Tercero    nvarchar(50) COLLATE DATABASE_DEFAULT NOT NULL,
            Concepto   nvarchar(80) COLLATE DATABASE_DEFAULT NULL,
            Saldo      decimal(19, 2) NOT NULL,
            PRIMARY KEY (FechaCorte, Empresa, Cuenta, Tercero)
        );
        WITH MovIC AS (
            SELECT Empresa, Cuenta, Tercero, MAX(Concepto) AS Concepto, Mes, SUM(Neto) AS Neto
            FROM #Mov
            WHERE Tercero IS NOT NULL
            GROUP BY Empresa, Cuenta, Tercero, Mes
        ),
        CuentasIC AS (
            SELECT DISTINCT Empresa, Cuenta, Tercero, Concepto FROM MovIC
        ),
        Acumulado AS (
            SELECT c.FechaCorte, a.Empresa, a.Cuenta, a.Tercero, a.Concepto,
                   SUM(ISNULL(m.Neto, 0)) OVER (PARTITION BY a.Empresa, a.Cuenta, a.Tercero ORDER BY c.MesInicio
                                                ROWS UNBOUNDED PRECEDING) AS Saldo
            FROM CuentasIC AS a
            CROSS JOIN #Cortes AS c
            LEFT JOIN MovIC AS m
                ON m.Empresa = a.Empresa AND m.Cuenta = a.Cuenta AND m.Tercero = a.Tercero AND m.Mes = c.MesInicio
        )
        INSERT INTO #SaldoIC (FechaCorte, Sentido, Empresa, Cuenta, Tercero, Concepto, Saldo)
        SELECT FechaCorte,
               CASE WHEN (Empresa = N'Firplak'  AND Cuenta LIKE N'2%')
                      OR (Empresa = N'Viventta' AND Cuenta LIKE N'1%')
                    THEN N'Firplak debe a Viventta' ELSE N'Viventta debe a Firplak' END,
               Empresa, Cuenta, Tercero, Concepto, Saldo
        FROM Acumulado
        WHERE Saldo <> 0;

        -- Un sentido coincide si lo que registra Firplak y lo que registra Viventta se anulan (signos opuestos).
        CREATE TABLE #Sentido (
            FechaCorte date NOT NULL,
            Sentido    nvarchar(40) COLLATE DATABASE_DEFAULT NOT NULL,
            Diferencia decimal(19, 2) NOT NULL,
            Coincide   bit NOT NULL,
            PRIMARY KEY (FechaCorte, Sentido)
        );
        INSERT INTO #Sentido (FechaCorte, Sentido, Diferencia, Coincide)
        SELECT FechaCorte, Sentido, SUM(Saldo),
               CASE WHEN ABS(SUM(Saldo)) <= @Tolerancia THEN 1 ELSE 0 END
        FROM #SaldoIC
        GROUP BY FechaCorte, Sentido;

        /* ── Paso 6. Reemplazo de las tablas de reporte ── */
        BEGIN TRANSACTION;

        DELETE FROM dbo.Informe_pkt_intercompania;
        SET @Eliminados = @@ROWCOUNT;
        DELETE FROM dbo.Informe_pkt_saldos;
        SET @Eliminados += @@ROWCOUNT;

        INSERT INTO dbo.Informe_pkt_saldos (
            FechaCorte, Anio, Mes, Empresa, Grupo, Concepto, Orden,
            SaldoContable, SaldoIntercompania, Saldo
        )
        SELECT s.FechaCorte, YEAR(s.FechaCorte), MONTH(s.FechaCorte), s.Empresa, k.Grupo, s.Concepto, k.Orden,
               s.SaldoContable,
               ISNULL(e.Eliminar, 0),
               s.SaldoContable - ISNULL(e.Eliminar, 0)
        FROM #SaldoConcepto AS s
        INNER JOIN #Conceptos AS k ON k.Concepto = s.Concepto
        LEFT JOIN (
            SELECT i.FechaCorte, i.Empresa, i.Concepto, SUM(i.Saldo) AS Eliminar
            FROM #SaldoIC AS i
            INNER JOIN #Sentido AS d ON d.FechaCorte = i.FechaCorte AND d.Sentido = i.Sentido
            WHERE d.Coincide = 1 AND i.Concepto IS NOT NULL
            GROUP BY i.FechaCorte, i.Empresa, i.Concepto
        ) AS e ON e.FechaCorte = s.FechaCorte AND e.Empresa = s.Empresa AND e.Concepto = s.Concepto;
        SET @Insertados = @@ROWCOUNT;

        INSERT INTO dbo.Informe_pkt_intercompania (
            FechaCorte, Sentido, Empresa, Cuenta, Tercero, Concepto, Saldo, DiferenciaSentido, Coincide
        )
        SELECT i.FechaCorte, i.Sentido, i.Empresa, i.Cuenta, i.Tercero, i.Concepto, i.Saldo, d.Diferencia, d.Coincide
        FROM #SaldoIC AS i
        INNER JOIN #Sentido AS d ON d.FechaCorte = i.FechaCorte AND d.Sentido = i.Sentido;
        SET @Insertados += @@ROWCOUNT;

        COMMIT TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_pkt', N'COMPLETA', @Inicio, sysdatetime(), @Eliminados, @Insertados, NULL);

        DROP TABLE IF EXISTS #Conceptos, #Cortes, #Terceros, #Mov, #SaldoConcepto, #SaldoIC, #Sentido;
        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_pkt', @LockOwner = N'Session';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        INSERT INTO dbo.Cargas_Log (Proceso, Modo, Inicio, Fin, Eliminados, Insertados, Error)
        VALUES (N'Informe_pkt', N'COMPLETA', @Inicio, sysdatetime(), 0, 0, LEFT(ERROR_MESSAGE(), 4000));

        EXEC sp_releaseapplock @Resource = N'sp_Actualizar_Informe_pkt', @LockOwner = N'Session';
        THROW;
    END CATCH
END
GO

/* ───────────── 3. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_pkt;

/* ───────────── 4. Validación (solo lectura) ───────────── */

-- 4.1 Última carga. Esperado: Error NULL; Insertados ~ 12 x 2 x meses desde 2020 + filas de intercompañía.
-- SELECT TOP (5) * FROM dbo.Cargas_Log WHERE Proceso = N'Informe_pkt' ORDER BY Inicio DESC;

-- 4.2 Firplak sin eliminación frente a V3 y a la matriz del BI.
--     Esperado (KTNO Firplak): 2025-12-31 = 3.494.898.838,76 ; 2026-10-31 = 3.707.635.179,62
--     y cada concepto igual a la tabla V3 de la ficha.
-- SELECT FechaCorte, Orden, Concepto, SaldoContable
-- FROM dbo.Informe_pkt_saldos
-- WHERE Empresa = N'Firplak' AND FechaCorte IN ('20251231', '20261031')
-- ORDER BY FechaCorte, Orden;
-- SELECT FechaCorte, SUM(SaldoContable) AS KTNO_Firplak
-- FROM dbo.Informe_pkt_saldos
-- WHERE Empresa = N'Firplak' AND FechaCorte IN ('20251231', '20261031')
-- GROUP BY FechaCorte;

-- 4.3 Eliminación entre compañías al 2026-10-31.
--     Esperado (según V5b, sin filtro de área en Viventta): "Firplak debe a Viventta" con diferencia 0,02 y Coincide = 1;
--     "Viventta debe a Firplak" con diferencia 156.664,00 y Coincide = 0. Si el filtro de área cambia los
--     saldos de Viventta, anotar la diferencia en la ficha.
-- SELECT Sentido, Empresa, Tercero, Cuenta, Concepto, Saldo, DiferenciaSentido, Coincide
-- FROM dbo.Informe_pkt_intercompania
-- WHERE FechaCorte = '20261031'
-- ORDER BY Sentido, Empresa, Cuenta;
--     Esperado: Viventta / Clientes con SaldoIntercompania = 475.284.445,19; el resto en 0.
-- SELECT Empresa, Concepto, SaldoContable, SaldoIntercompania, Saldo
-- FROM dbo.Informe_pkt_saldos
-- WHERE FechaCorte = '20261031' AND SaldoIntercompania <> 0;

-- 4.4 Saldos de Viventta por concepto al 2026-10-31 (revisar que tengan sentido con Contabilidad).
-- SELECT Orden, Concepto, SaldoContable, SaldoIntercompania, Saldo
-- FROM dbo.Informe_pkt_saldos
-- WHERE Empresa = N'Viventta' AND FechaCorte = '20261031'
-- ORDER BY Orden;

-- 4.5 PKT consolidado de prueba (lo que calculará la API): KTNO de octubre de 2026 y ventas de enero a octubre
--     de todas las compañías en Informe_ventas, proyectadas a 12 meses.
-- DECLARE @Corte date = '20261031';
-- SELECT k.KTNO, v.VentasAcumuladas,
--        v.VentasAcumuladas / MONTH(@Corte) * 12 AS VentasProyectadas,
--        k.KTNO / NULLIF(v.VentasAcumuladas / MONTH(@Corte) * 12, 0) AS PKT
-- FROM (SELECT SUM(Saldo) AS KTNO FROM dbo.Informe_pkt_saldos WHERE FechaCorte = @Corte) AS k
-- CROSS JOIN (SELECT SUM(ValorTotal) AS VentasAcumuladas
--             FROM dbo.Informe_ventas
--             WHERE FechaContabilizacion >= DATEFROMPARTS(YEAR(@Corte), 1, 1)
--               AND FechaContabilizacion <  DATEADD(day, 1, @Corte)) AS v;

-- 4.6 Cortes cargados. Esperado: desde 2020-01-31 hasta el último mes cerrado, 24 filas por corte.
-- SELECT MIN(FechaCorte) AS Desde, MAX(FechaCorte) AS Hasta, COUNT(DISTINCT FechaCorte) AS Cortes,
--        COUNT(1) * 1.0 / COUNT(DISTINCT FechaCorte) AS FilasPorCorte
-- FROM dbo.Informe_pkt_saldos;
