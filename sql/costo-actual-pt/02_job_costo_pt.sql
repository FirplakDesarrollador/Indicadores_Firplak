/*
  Job de SQL Server Agent: carga completa del informe de costo actual de PT, cada hora.
  Ficha: llm-wiki/bi/costo-actual-pt.md (sección 2).

  Requisitos: dbo.sp_Actualizar_Informe_costo_pt ya creado (01_informe_costo_pt.sql) y una
  primera carga correcta. Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script (por omisión de sp_add_job). Si los demás jobs
  de BI usan otro propietario (por ejemplo, sa o una cuenta de servicio), cámbialo en @owner_login_name.

  Rollback:  EXEC msdb.dbo.sp_delete_job @job_name = N'BI - Costo PT carga completa', @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @JobId binary(16);
DECLARE @Rc int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'BI - Costo PT carga completa')
BEGIN
    RAISERROR (N'El job "BI - Costo PT carga completa" ya existe. Bórralo primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

EXEC @Rc = msdb.dbo.sp_add_job
    @job_name     = N'BI - Costo PT carga completa',
    @enabled      = 1,
    @description  = N'Recalcula Planos_Symphony.dbo.Informe_costo_pt (explosión de listas de materiales con costo MP/MO/CIF desde FIRPLAK_SA). Carga completa con intercambio por SWITCH. Bitácora en dbo.Cargas_Log (Proceso = Informe_costo_pt).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id       = @JobId OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobId,
    @step_name         = N'Actualizar Informe_costo_pt',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_costo_pt;',
    @retry_attempts    = 0,        -- La siguiente ejecución es en una hora; el error queda en Cargas_Log
    @on_success_action = 1,        -- Terminar con éxito
    @on_fail_action    = 2;        -- Terminar con error
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id               = @JobId,
    @name                 = N'Cada hora, minuto 05',
    @enabled              = 1,
    @freq_type            = 4,     -- Diario
    @freq_interval        = 1,     -- Todos los días
    @freq_subday_type     = 8,     -- Unidad: horas
    @freq_subday_interval = 1,     -- Cada 1 hora
    @active_start_time    = 500,   -- 00:05:00 (HHMMSS)
    @active_end_time      = 235959;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver
    @job_id      = @JobId,
    @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Job "BI - Costo PT carga completa" creado.';
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
-- WHERE j.name = N'BI - Costo PT carga completa';

-- Historial del job (después de la primera ejecución programada)
-- EXEC msdb.dbo.sp_help_jobhistory @job_name = N'BI - Costo PT carga completa';

-- Ejecución manual de prueba (opcional)
-- EXEC msdb.dbo.sp_start_job @job_name = N'BI - Costo PT carga completa';

-- Cargas registradas por el SP
-- SELECT TOP (5) * FROM Planos_Symphony.dbo.Cargas_Log WHERE Proceso = N'Informe_costo_pt' ORDER BY Inicio DESC;
