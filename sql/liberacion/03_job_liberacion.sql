/*
  Job de SQL Server Agent del informe Liberación.
  Ficha: llm-wiki/bi/liberacion.md (sección 2).

    - BI - Liberacion carga: lunes a viernes a las 17:15, 15 minutos después del job
      'Actualizacion Indicador Liberacion' (17:00, ~15 s), que recarga dbo.Indicador_Liberacion.
      El SP no carga si encuentra el origen vacío o a medias, y el reintento a los 10 minutos cubre
      un día en que el job de origen se demore.

  Las razones de Planeación NO tienen job aquí: las envía Supabase a la Reporting API
  (ver 02_razones_liberacion.sql).

  Requisitos: 01_informe_liberacion.sql ejecutado y una primera carga correcta.
  Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script (por omisión de sp_add_job). Si los demás jobs de BI
  usan otro propietario (por ejemplo, sa o una cuenta de servicio), cámbialo en @owner_login_name.

  Rollback:
    EXEC msdb.dbo.sp_delete_job @job_name = N'BI - Liberacion carga', @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @Job binary(16);
DECLARE @Rc int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'BI - Liberacion carga')
BEGIN
    RAISERROR (N'Ya existe el job de Liberación. Bórralo primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

EXEC @Rc = msdb.dbo.sp_add_job
    @job_name      = N'BI - Liberacion carga',
    @enabled       = 1,
    @description   = N'Copia Planos_Symphony.dbo.Indicador_Liberacion a dbo.Informe_liberacion con tipos reales (MERGE; conserva las OP que salen de la ventana de 365 días). Bitácora en dbo.Cargas_Log (Proceso = Informe_liberacion).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id        = @Job OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @Job,
    @step_name         = N'Actualizar Informe_liberacion',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_liberacion;',
    @retry_attempts    = 1,        -- Un reintento a los 10 minutos (origen todavía cargando)
    @retry_interval    = 10,
    @on_success_action = 1,
    @on_fail_action    = 2;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id                 = @Job,
    @name                   = N'Liberacion lunes a viernes 17:15',
    @enabled                = 1,
    @freq_type              = 8,     -- Semanal
    @freq_interval          = 62,    -- Lunes (2) + martes (4) + miércoles (8) + jueves (16) + viernes (32), igual que el job de origen
    @freq_recurrence_factor = 1,     -- Cada semana
    @freq_subday_type       = 1,     -- Una vez al día
    @active_start_time      = 171500; -- 17:15:00
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver @job_id = @Job, @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Job de Liberación creado.';
GOTO Fin;

Error:
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR (N'No se pudo crear el job; no quedó nada a medias.', 16, 1);

Fin:
GO

/* ───────────── Verificación (solo lectura) ───────────── */
-- Configuración y próxima ejecución
-- SELECT j.name, j.enabled, s.name AS horario, js.next_run_date, js.next_run_time
-- FROM msdb.dbo.sysjobs j
-- INNER JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
-- INNER JOIN msdb.dbo.sysschedules s ON s.schedule_id = js.schedule_id
-- WHERE j.name = N'BI - Liberacion carga';

-- Historial (después de la primera ejecución programada)
-- EXEC msdb.dbo.sp_help_jobhistory @job_name = N'BI - Liberacion carga';

-- Ejecución manual de prueba (opcional)
-- EXEC msdb.dbo.sp_start_job @job_name = N'BI - Liberacion carga';

-- Cargas registradas por el SP
-- SELECT TOP (5) * FROM Planos_Symphony.dbo.Cargas_Log WHERE Proceso = N'Informe_liberacion' ORDER BY Inicio DESC;
