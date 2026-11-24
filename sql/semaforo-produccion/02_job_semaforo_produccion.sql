/*
  Job de SQL Server Agent del semáforo de producción.
  Ficha: llm-wiki/proyectos/semaforo-produccion.md.

    - BI - Semáforo producción carga: todos los días cada hora de 6:00 a 20:00 (decisión del
      desarrollador, 2026-11-24), y a las 0:05 para que los consumos, colores y cumplimientos
      amanezcan calculados con la fecha nueva.

  Si el job ya existe con el horario anterior (cada 15 minutos), no hace falta borrarlo:
    EXEC msdb.dbo.sp_update_schedule
        @name = N'Semáforo producción cada 15 min 6:00-20:00',
        @new_name = N'Semáforo producción cada hora 6:00-20:00',
        @freq_subday_type = 8,        -- Horas
        @freq_subday_interval = 1;

  Requisitos: 01_informe_semaforo_produccion.sql ejecutado, una primera carga correcta y la comparación
  con dbo.SEMAFORO revisada (03_validacion.sql, parte B). Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script. Si los demás jobs de BI usan otro (sa o una cuenta de
  servicio), cámbialo en @owner_login_name.

  Rollback:
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - Semáforo producción carga', @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @Job binary(16);
DECLARE @Rc  int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'BI - Semáforo producción carga')
BEGIN
    RAISERROR (N'Ya existe el job del semáforo de producción. Bórralo primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - Semáforo producción carga',
    @enabled       = 1,
    @description   = N'Recarga Planos_Symphony.dbo.Informe_semaforo_produccion (OP abiertas y cerradas en 30 días de FIRPLAK_SA.OWOR). Bitácora en dbo.Cargas_Log (Proceso = Informe_semaforo_produccion).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id        = @Job OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @Job,
    @step_name         = N'Actualizar Informe_semaforo_produccion',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_semaforo_produccion;',
    @retry_attempts    = 1,        -- Un reintento a los 2 minutos (p. ej. bloqueo en SAP)
    @retry_interval    = 2,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @Job,
    @name                   = N'Semáforo producción cada hora 6:00-20:00',
    @enabled                = 1,
    @freq_type              = 4,      -- Diario
    @freq_interval          = 1,      -- Todos los días
    @freq_subday_type       = 8,      -- Cada N horas
    @freq_subday_interval   = 1,
    @active_start_time      = 60000,  -- 06:00:00
    @active_end_time        = 200000; -- 20:00:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @Job,
    @name                   = N'Semáforo producción 0:05',
    @enabled                = 1,
    @freq_type              = 4,
    @freq_interval          = 1,
    @freq_subday_type       = 1,      -- Una vez al día
    @active_start_time      = 500;    -- 00:05:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @Job, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Job del semáforo de producción creado.';
GOTO Fin;

Error:
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR (N'No se pudo crear el job; no quedó nada a medias.', 16, 1);

Fin:
GO

/* ───────────── Verificación (solo lectura) ───────────── */
-- SELECT j.name, j.enabled, s.name AS horario, js.next_run_date, js.next_run_time
-- FROM msdb.dbo.sysjobs j
-- INNER JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
-- INNER JOIN msdb.dbo.sysschedules s ON s.schedule_id = js.schedule_id
-- WHERE j.name = N'BI - Semáforo producción carga';

-- EXEC msdb.dbo.sp_help_jobhistory @job_name = N'BI - Semáforo producción carga';
-- SELECT TOP (10) * FROM Planos_Symphony.dbo.Cargas_Log WHERE Proceso = N'Informe_semaforo_produccion' ORDER BY Inicio DESC;
