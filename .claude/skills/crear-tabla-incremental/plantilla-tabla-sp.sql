/*
  Plantilla: tabla de reporte + SP de carga incremental (ventana móvil).
  Reemplaza todos los marcadores <...> y borra los que no apliquen.

  Revisión y ejecución: SOLO el desarrollador, primero en pruebas si existe.
  Orden: 1) tabla e índices  2) bitácora  3) SP  4) primera carga  5) validación  6) job
*/

USE [Planos_Symphony];
GO

/* ───────────── 1. Tabla de reporte ───────────── */
IF OBJECT_ID(N'dbo.Informe_<tema>', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Informe_<tema> (
        -- Clave del grano definido en la ficha ("una fila por …")
        <ClaveDocumento>   nvarchar(50)   NOT NULL,
        <Linea>            int            NOT NULL,
        -- Fecha de referencia: la que usa el dashboard para filtrar el periodo
        <FechaReferencia>  date           NOT NULL,
        -- Dimensiones de filtro (textos ya normalizados)
        <Dimension1>       nvarchar(100)  NULL,
        <Dimension2>       nvarchar(100)  NULL,
        -- Medidas
        <Medida1>          decimal(38, 6) NULL,
        -- Auditoría
        FechaCarga         datetime2(0)   NOT NULL
            CONSTRAINT DF_Informe_<tema>_FechaCarga DEFAULT (sysdatetime()),
        CONSTRAINT PK_Informe_<tema> PRIMARY KEY CLUSTERED (<ClaveDocumento>, <Linea>)
    );

    CREATE NONCLUSTERED INDEX IX_Informe_<tema>_Fecha
        ON dbo.Informe_<tema> (<FechaReferencia>)
        INCLUDE (<Medida1>);

    CREATE NONCLUSTERED INDEX IX_Informe_<tema>_<Dimension1>
        ON dbo.Informe_<tema> (<Dimension1>, <FechaReferencia>);
END
GO

/* ───────────── 2. Bitácora de cargas (propuesta; una sola para todos los informes) ───────────── */
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

/* ───────────── 3. SP de actualización ───────────── */
CREATE OR ALTER PROCEDURE dbo.sp_Actualizar_Informe_<tema>
    @DiasVentana   int = 45,   -- días hacia atrás que se recargan (documentos que aún pueden cambiar)
    @CargaCompleta bit = 0     -- 1 = recarga toda la historia (primera carga, reparación o recarga semanal)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaDesde date =
        CASE WHEN @CargaCompleta = 1 THEN CAST('19000101' AS date)
             ELSE DATEADD(day, -@DiasVentana, CAST(GETDATE() AS date)) END;
    DECLARE @BitacoraId bigint;
    DECLARE @Eliminadas int = 0;
    DECLARE @Insertadas int = 0;

    INSERT INTO dbo.Bitacora_Cargas_Informes (Informe, Inicio, FechaDesde, Estado)
    VALUES (N'Informe_<tema>', sysdatetime(), @FechaDesde, 'EN_CURSO');
    SET @BitacoraId = SCOPE_IDENTITY();

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @CargaCompleta = 1
        BEGIN
            SELECT @Eliminadas = COUNT(1) FROM dbo.Informe_<tema>;
            TRUNCATE TABLE dbo.Informe_<tema>;
        END
        ELSE
        BEGIN
            DELETE FROM dbo.Informe_<tema>
            WHERE <FechaReferencia> >= @FechaDesde;
            SET @Eliminadas = @@ROWCOUNT;
        END

        INSERT INTO dbo.Informe_<tema> (
            <ClaveDocumento>, <Linea>, <FechaReferencia>,
            <Dimension1>, <Dimension2>, <Medida1>
        )
        SELECT
            CONVERT(nvarchar(50), o.<ColumnaDocumento>),
            o.<ColumnaLinea>,
            CONVERT(date, o.<ColumnaFecha>),
            NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), o.<ColumnaDimension1>))), N''),
            NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100), o.<ColumnaDimension2>))), N''),
            CONVERT(decimal(38, 6), o.<ColumnaMedida1>)
            -- Aquí va la lógica por fila que venía del M o del DAX (CASE, signos, tipos de documento…)
        FROM <BaseOrigen>.<EsquemaOrigen>.<TablaOrigen> AS o
        -- JOIN … según las relaciones documentadas en la ficha
        WHERE o.<ColumnaFecha> >= @FechaDesde;   -- sargable: sin funciones sobre la columna
        SET @Insertadas = @@ROWCOUNT;

        COMMIT TRANSACTION;

        UPDATE dbo.Bitacora_Cargas_Informes
        SET Fin = sysdatetime(), FilasEliminadas = @Eliminadas, FilasInsertadas = @Insertadas, Estado = 'OK'
        WHERE Id = @BitacoraId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        UPDATE dbo.Bitacora_Cargas_Informes
        SET Fin = sysdatetime(), Estado = 'ERROR', Mensaje = LEFT(ERROR_MESSAGE(), 4000)
        WHERE Id = @BitacoraId;

        THROW;
    END CATCH
END
GO

/* ───────────── 4. Primera carga (la ejecuta el desarrollador) ───────────── */
-- EXEC dbo.sp_Actualizar_Informe_<tema> @CargaCompleta = 1;

/* ───────────── 5. Validación: origen vs. tabla por mes (solo lectura) ───────────── */
-- Origen
-- SELECT YEAR(o.<ColumnaFecha>) AS Anio, MONTH(o.<ColumnaFecha>) AS Mes,
--        COUNT_BIG(1) AS Filas, SUM(CONVERT(decimal(38, 6), o.<ColumnaMedida1>)) AS Total
-- FROM <BaseOrigen>.<EsquemaOrigen>.<TablaOrigen> AS o
-- WHERE o.<ColumnaFecha> >= DATEADD(month, -3, CAST(GETDATE() AS date))
-- GROUP BY YEAR(o.<ColumnaFecha>), MONTH(o.<ColumnaFecha>)
-- ORDER BY Anio, Mes;

-- Tabla de reporte
-- SELECT YEAR(<FechaReferencia>) AS Anio, MONTH(<FechaReferencia>) AS Mes,
--        COUNT_BIG(1) AS Filas, SUM(<Medida1>) AS Total
-- FROM dbo.Informe_<tema>
-- WHERE <FechaReferencia> >= DATEADD(month, -3, CAST(GETDATE() AS date))
-- GROUP BY YEAR(<FechaReferencia>), MONTH(<FechaReferencia>)
-- ORDER BY Anio, Mes;

-- Últimas cargas
-- SELECT TOP (10) * FROM dbo.Bitacora_Cargas_Informes WHERE Informe = N'Informe_<tema>' ORDER BY Id DESC;

/* ───────────── 6. Job (lo crea el desarrollador en SQL Server Agent) ───────────── */
-- Paso:      EXEC dbo.sp_Actualizar_Informe_<tema>;
-- Horario:   según la ficha (por ejemplo, cada hora en horario laboral)
-- Semanal:   EXEC dbo.sp_Actualizar_Informe_<tema> @CargaCompleta = 1;   (madrugada del domingo)
