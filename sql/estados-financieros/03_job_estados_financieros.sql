/*
  Jobs de SQL Server Agent de Estados Financieros.
  Proyecto: llm-wiki/proyectos/estados-financieros.md

    - BI - Estados financieros carga incremental: todos los días a las 5:00 (pedido del desarrollador,
      2026-11-11). Paso 1: cuentas 14 y 74 (últimos 60 días). Paso 2: balance (días recientes y días
      tocados por asientos nuevos).
    - BI - Estados financieros carga completa: domingo a las 3:00 (después de las completas de ventas y
      NS Plantas de las 2:00). Recarga la historia de las dos tablas.

  Si el paso 1 falla, el job sigue con el paso 2 y termina en error solo si falla el paso 2; el
  error del paso 1 queda en dbo.Cargas_Log (Proceso = Informe_cuentas_14_74).

  Requisitos: 01 y 02 ejecutados y una primera carga completa correcta de cada SP.
  Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script (por omisión de sp_add_job). Si los demás jobs de BI
  usan otro propietario (por ejemplo, sa o una cuenta de servicio), cámbialo en @owner_login_name.

  Rollback:
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - Estados financieros carga incremental', @delete_unused_schedule = 1;
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - Estados financieros carga completa',    @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @JobInc binary(16);
DECLARE @JobCom binary(16);
DECLARE @Rc int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs
           WHERE name IN (N'BI - Estados financieros carga incremental', N'BI - Estados financieros carga completa'))
BEGIN
    RAISERROR (N'Ya existe alguno de los jobs de Estados financieros. Bórralos primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

/* ── Incremental ── */
EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - Estados financieros carga incremental',
    @enabled       = 1,
    @description   = N'Actualiza en Planos_Symphony las tablas Informe_cuentas_14_74, Informe_mov_contable_diario e Informe_balance desde FIRPLAK_SA (JDT1, OJDT, OACT, OCRD). Bitácora en dbo.Cargas_Log.',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id        = @JobInc OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobInc,
    @step_name         = N'Cuentas 14 y 74 (incremental)',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_cuentas_14_74;',
    @retry_attempts    = 1,
    @retry_interval    = 5,
    @on_success_action = 3,       -- Siguiente paso
    @on_fail_action    = 3;       -- Siguiente paso: el balance no depende de esta tabla
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobInc,
    @step_name         = N'Balance (incremental)',
    @step_id           = 2,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_balance;',
    @retry_attempts    = 1,
    @retry_interval    = 5,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id            = @JobInc,
    @name              = N'Estados financieros diario 5:00',
    @enabled           = 1,
    @freq_type         = 4,       -- Diario
    @freq_interval     = 1,       -- Todos los días
    @freq_subday_type  = 1,       -- Una vez al día
    @active_start_time = 50000;   -- 05:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @JobInc, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

/* ── Completa ── */
EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - Estados financieros carga completa',
    @enabled       = 1,
    @description   = N'Recarga desde FIRPLAK_SA toda la historia de Informe_cuentas_14_74 (desde 2021) y de Informe_mov_contable_diario, y recalcula Informe_balance desde 2021-01. Bitácora en dbo.Cargas_Log (Modo = COMPLETA).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,
    @job_id        = @JobCom OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobCom,
    @step_name         = N'Cuentas 14 y 74 (completa)',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_cuentas_14_74 @CargaCompleta = 1;',
    @retry_attempts    = 1,
    @retry_interval    = 15,
    @on_success_action = 3,
    @on_fail_action    = 3;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobCom,
    @step_name         = N'Balance (completa)',
    @step_id           = 2,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_balance @CargaCompleta = 1;',
    @retry_attempts    = 1,
    @retry_interval    = 15,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @JobCom,
    @name                   = N'Estados financieros domingo 3:00',
    @enabled                = 1,
    @freq_type              = 8,     -- Semanal
    @freq_interval          = 1,     -- Domingo
    @freq_recurrence_factor = 1,
    @freq_subday_type       = 1,
    @active_start_time      = 30000; -- 03:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @JobCom, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Jobs de Estados financieros creados.';
GOTO Fin;

Error:
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR (N'No se pudieron crear los jobs de Estados financieros; no quedó nada a medias.', 16, 1);

Fin:
GO

/* Verificación
SELECT j.name, j.enabled, s.name AS horario, s.freq_type, s.freq_interval, s.active_start_time
FROM msdb.dbo.sysjobs j
    INNER JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
    INNER JOIN msdb.dbo.sysschedules s ON s.schedule_id = js.schedule_id
WHERE j.name LIKE N'BI - Estados financieros%';
*/
