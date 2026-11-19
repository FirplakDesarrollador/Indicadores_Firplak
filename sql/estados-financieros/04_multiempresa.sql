/*
  Estados Financieros: migración a varias empresas (Firplak y Viventta).
  Proyecto: llm-wiki/proyectos/estados-financieros.md

  Agrega la columna Empresa a las tablas creadas por 01 y 02, marca los datos que ya existen como
  'Firplak' y pone Empresa al inicio de las claves e índices. También amplía los nombres de cuenta y
  de tercero a 200 caracteres (en DBViventta, OACT.AcctName y OCRD.CardName son nvarchar(200)).

  Cada paso revisa si ya se hizo, así que el script se puede volver a ejecutar sin daño.
  No borra ni recalcula datos: las filas actuales solo quedan con Empresa = 'Firplak'.

  Orden de despliegue:
    1) Este script.
    2) 01_informe_cuentas_14_74.sql y 02_informe_balance.sql otra vez: las tablas ya existen y no se
       tocan; se reemplazan los SP por la versión con @Empresa.
    3) Primera carga de Viventta (ver el final de este script).
    4) Desplegar la Reporting API con el parámetro empresa. Antes de este script, esa versión de la
       API falla (la columna Empresa no existe); después de este script, la versión anterior de la API
       sigue funcionando, pero mezclaría las dos empresas: desplegarla en seguida.
    Los jobs (03) no cambian: sin @Empresa, los SP actualizan las dos empresas.

  Rollback: no hay datos de Viventta que conservar, así que basta con borrar sus filas
  (DELETE ... WHERE Empresa = N'Viventta') y volver a los SP anteriores (versión de 01 y 02 en el commit
  0ea5db4). La columna Empresa puede quedarse.
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Informe_cuentas_14_74 ───────────── */
IF COL_LENGTH(N'dbo.Informe_cuentas_14_74', N'Empresa') IS NULL
BEGIN
    ALTER TABLE dbo.Informe_cuentas_14_74
        ADD Empresa nvarchar(20) NOT NULL CONSTRAINT DF_Informe_cuentas_14_74_Empresa DEFAULT (N'Firplak');
    ALTER TABLE dbo.Informe_cuentas_14_74 DROP CONSTRAINT DF_Informe_cuentas_14_74_Empresa;
END
GO

IF EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = N'PK_Informe_cuentas_14_74' AND ic.key_ordinal = 1
             AND COL_NAME(ic.object_id, ic.column_id) <> N'Empresa')
BEGIN
    DROP INDEX IX_Informe_cuentas_14_74_Cuenta ON dbo.Informe_cuentas_14_74;
    DROP INDEX IX_Informe_cuentas_14_74_Tercero ON dbo.Informe_cuentas_14_74;
    ALTER TABLE dbo.Informe_cuentas_14_74 DROP CONSTRAINT PK_Informe_cuentas_14_74;

    ALTER TABLE dbo.Informe_cuentas_14_74 ALTER COLUMN DescripcionCuenta nvarchar(200) NULL;
    ALTER TABLE dbo.Informe_cuentas_14_74 ALTER COLUMN NombreTercero nvarchar(200) NULL;

    ALTER TABLE dbo.Informe_cuentas_14_74 ADD CONSTRAINT PK_Informe_cuentas_14_74
        PRIMARY KEY CLUSTERED (Empresa, FechaContabilizacion, TransId, CuentaContable, CodigoTercero, TransType);
    CREATE NONCLUSTERED INDEX IX_Informe_cuentas_14_74_Cuenta
        ON dbo.Informe_cuentas_14_74 (Empresa, CuentaContable, FechaContabilizacion)
        INCLUDE (Debito, Credito, SaldoMensual);
    CREATE NONCLUSTERED INDEX IX_Informe_cuentas_14_74_Tercero
        ON dbo.Informe_cuentas_14_74 (Empresa, CodigoTercero, FechaContabilizacion);
END
GO

/* ───────────── 2. Informe_mov_contable_diario ───────────── */
IF COL_LENGTH(N'dbo.Informe_mov_contable_diario', N'Empresa') IS NULL
BEGIN
    ALTER TABLE dbo.Informe_mov_contable_diario
        ADD Empresa nvarchar(20) NOT NULL CONSTRAINT DF_Informe_mov_contable_diario_Empresa DEFAULT (N'Firplak');
    ALTER TABLE dbo.Informe_mov_contable_diario DROP CONSTRAINT DF_Informe_mov_contable_diario_Empresa;
END
GO

IF EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = N'PK_Informe_mov_contable_diario' AND ic.key_ordinal = 1
             AND COL_NAME(ic.object_id, ic.column_id) <> N'Empresa')
BEGIN
    DROP INDEX IX_Informe_mov_contable_diario_Cuenta ON dbo.Informe_mov_contable_diario;
    ALTER TABLE dbo.Informe_mov_contable_diario DROP CONSTRAINT PK_Informe_mov_contable_diario;

    ALTER TABLE dbo.Informe_mov_contable_diario ADD CONSTRAINT PK_Informe_mov_contable_diario
        PRIMARY KEY CLUSTERED (Empresa, Fecha, Cuenta);
    CREATE NONCLUSTERED INDEX IX_Informe_mov_contable_diario_Cuenta
        ON dbo.Informe_mov_contable_diario (Empresa, Cuenta, Fecha)
        INCLUDE (Debito, Credito);
END
GO

/* ───────────── 3. Informe_mov_contable_control: una fila por empresa ───────────── */
IF COL_LENGTH(N'dbo.Informe_mov_contable_control', N'Empresa') IS NULL
BEGIN
    ALTER TABLE dbo.Informe_mov_contable_control
        ADD Empresa nvarchar(20) NOT NULL CONSTRAINT DF_Informe_mov_contable_control_Empresa DEFAULT (N'Firplak');
    ALTER TABLE dbo.Informe_mov_contable_control DROP CONSTRAINT DF_Informe_mov_contable_control_Empresa;
END
GO

IF COL_LENGTH(N'dbo.Informe_mov_contable_control', N'Id') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Informe_mov_contable_control DROP CONSTRAINT PK_Informe_mov_contable_control;
    ALTER TABLE dbo.Informe_mov_contable_control DROP CONSTRAINT CK_Informe_mov_contable_control_Id;
    ALTER TABLE dbo.Informe_mov_contable_control DROP COLUMN Id;
    ALTER TABLE dbo.Informe_mov_contable_control ADD CONSTRAINT PK_Informe_mov_contable_control PRIMARY KEY (Empresa);
END
GO

/* ───────────── 4. Informe_balance ───────────── */
IF COL_LENGTH(N'dbo.Informe_balance', N'Empresa') IS NULL
BEGIN
    ALTER TABLE dbo.Informe_balance
        ADD Empresa nvarchar(20) NOT NULL CONSTRAINT DF_Informe_balance_Empresa DEFAULT (N'Firplak');
    ALTER TABLE dbo.Informe_balance DROP CONSTRAINT DF_Informe_balance_Empresa;
END
GO

IF EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = N'PK_Informe_balance' AND ic.key_ordinal = 1
             AND COL_NAME(ic.object_id, ic.column_id) <> N'Empresa')
BEGIN
    DROP INDEX IX_Informe_balance_Nivel ON dbo.Informe_balance;
    DROP INDEX IX_Informe_balance_Cuenta ON dbo.Informe_balance;
    ALTER TABLE dbo.Informe_balance DROP CONSTRAINT PK_Informe_balance;

    ALTER TABLE dbo.Informe_balance ALTER COLUMN AcctName nvarchar(200) NULL;

    ALTER TABLE dbo.Informe_balance ADD CONSTRAINT PK_Informe_balance
        PRIMARY KEY CLUSTERED (Empresa, Anio, Mes, CodigoCuenta);
    CREATE NONCLUSTERED INDEX IX_Informe_balance_Nivel
        ON dbo.Informe_balance (Empresa, Anio, Mes, Nivel)
        INCLUDE (SaldoInicial, Debito, Credito, SaldoMes, SaldoFinal);
    CREATE NONCLUSTERED INDEX IX_Informe_balance_Cuenta
        ON dbo.Informe_balance (Empresa, CodigoCuenta, Anio, Mes)
        INCLUDE (SaldoFinal);
END
GO

/* ───────────── 5. Verificación (solo lectura) ───────────── */
-- Todas las filas actuales deben quedar como Firplak, con los mismos totales de antes
-- SELECT 'cuentas_14_74' AS tabla, Empresa, COUNT_BIG(1) AS filas FROM dbo.Informe_cuentas_14_74 GROUP BY Empresa
-- UNION ALL SELECT 'mov_diario', Empresa, COUNT_BIG(1) FROM dbo.Informe_mov_contable_diario GROUP BY Empresa
-- UNION ALL SELECT 'balance', Empresa, COUNT_BIG(1) FROM dbo.Informe_balance GROUP BY Empresa
-- UNION ALL SELECT 'control', Empresa, COUNT_BIG(1) FROM dbo.Informe_mov_contable_control GROUP BY Empresa;
--
-- Claves e índices: Empresa debe ser la primera columna de cada uno
-- SELECT OBJECT_NAME(i.object_id) AS tabla, i.name, COL_NAME(ic.object_id, ic.column_id) AS primera_columna
-- FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
-- WHERE OBJECT_NAME(i.object_id) LIKE N'Informe[_]%' AND (OBJECT_NAME(i.object_id) LIKE N'%balance%'
--    OR OBJECT_NAME(i.object_id) LIKE N'%mov[_]contable%' OR OBJECT_NAME(i.object_id) LIKE N'%cuentas[_]14[_]74%');

/* ───────────── 6. Después de volver a ejecutar 01 y 02: primera carga de Viventta ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta = 1, @Empresa = N'Viventta';
-- EXEC dbo.sp_Actualizar_Informe_balance       @CargaCompleta = 1, @Empresa = N'Viventta';
