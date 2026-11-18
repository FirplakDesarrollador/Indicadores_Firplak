/*
  Jobs de SQL Server Agent del informe NS Plantas.
  Ficha: llm-wiki/bi/ns-plantas.md (sección 2).

    - BI - NS Plantas carga incremental: lunes a sábado a las 6:00 y a las 17:00 (respuesta 10 de Manufactura).
    - BI - NS Plantas carga completa:    domingo a las 2:00 (calendario + toda la historia).

  Requisitos: 01_informe_ns_plantas.sql ejecutado y una primera carga completa correcta.
  Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script (por omisión de sp_add_job). Si los demás jobs de BI
  usan otro propietario (por ejemplo, sa o una cuenta de servicio), cámbialo en @owner_login_name.

  Rollback:
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - NS Plantas carga incremental', @delete_unused_schedule = 1;
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - NS Plantas carga completa',    @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @JobInc binary(16);
DECLARE @JobCom binary(16);
DECLARE @Rc int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs
           WHERE name IN (N'BI - NS Plantas carga incremental', N'BI - NS Plantas carga completa'))
BEGIN
    RAISERROR (N'Ya existe alguno de los jobs de NS Plantas. Bórralos primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

/* ── Incremental ── */
EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - NS Plantas carga incremental',
    @enabled       = 1,
    @description   = N'Recarga en Planos_Symphony.dbo.Informe_ns_plantas las OP abiertas y las modificadas en los últimos 7 días (FIRPLAK_SA.OWOR). Bitácora en dbo.Cargas_Log (Proceso = Informe_ns_plantas).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id        = @JobInc OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobInc,
    @step_name         = N'Actualizar Informe_ns_plantas (incremental)',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_ns_plantas;',
    @retry_attempts    = 1,        -- Un reintento a los 5 minutos (p. ej. bloqueo en SAP)
    @retry_interval    = 5,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @JobInc,
    @name                   = N'NS Plantas lunes a sábado 6:00',
    @enabled                = 1,
    @freq_type              = 8,     -- Semanal
    @freq_interval          = 126,   -- Lunes (2) + martes (4) + miércoles (8) + jueves (16) + viernes (32) + sábado (64)
    @freq_recurrence_factor = 1,     -- Cada semana
    @freq_subday_type       = 1,     -- Una vez al día
    @active_start_time      = 60000; -- 06:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @JobInc,
    @name                   = N'NS Plantas lunes a sábado 17:00',
    @enabled                = 1,
    @freq_type              = 8,
    @freq_interval          = 126,
    @freq_recurrence_factor = 1,
    @freq_subday_type       = 1,
    @active_start_time      = 170000; -- 17:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @JobInc, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

/* ── Completa ── */
EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - NS Plantas carga completa',
    @enabled       = 1,
    @description   = N'Reconstruye Planos_Symphony.dbo.Calendario_Laboral y recarga toda la historia de Informe_ns_plantas. Bitácora en dbo.Cargas_Log (Proceso = Informe_ns_plantas, Modo = COMPLETA).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,
    @job_id        = @JobCom OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobCom,
    @step_name         = N'Actualizar Informe_ns_plantas (completa)',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_ns_plantas @CargaCompleta = 1;',
    @retry_attempts    = 1,
    @retry_interval    = 15,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @JobCom,
    @name                   = N'NS Plantas domingo 2:00',
    @enabled                = 1,
    @freq_type              = 8,     -- Semanal
    @freq_interval          = 1,     -- Domingo
    @freq_recurrence_factor = 1,
    @freq_subday_type       = 1,
    @active_start_time      = 20000; -- 02:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @JobCom, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Jobs de NS Plantas creados.';
GOTO Fin;

Error:
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR (N'No se pudieron crear los jobs; no quedó nada a medias.', 16, 1);

Fin:
GO

/* ───────────── Verificación (solo lectura) ───────────── */
-- Configuración y próxima ejecución
-- SELECT j.name, j.enabled, s.name AS horario, js.next_run_date, js.next_run_time
-- FROM msdb.dbo.sysjobs j
-- INNER JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
-- INNER JOIN msdb.dbo.sysschedules s ON s.schedule_id = js.schedule_id
-- WHERE j.name LIKE N'BI - NS Plantas%';

-- Historial (después de la primera ejecución programada)
-- EXEC msdb.dbo.sp_help_jobhistory @job_name = N'BI - NS Plantas carga incremental';

-- Ejecución manual de prueba (opcional)
-- EXEC msdb.dbo.sp_start_job @job_name = N'BI - NS Plantas carga incremental';

-- Cargas registradas por el SP
-- SELECT TOP (5) * FROM Planos_Symphony.dbo.Cargas_Log WHERE Proceso = N'Informe_ns_plantas' ORDER BY Inicio DESC;
