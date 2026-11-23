/*
  Job de SQL Server Agent: carga diaria del informe PKT, a la 1:00 p. m.
  Ficha: llm-wiki/bi/pkt.md (sección 2).

  Por qué a esa hora: Dirección Financiera consulta el informe una vez al día, a las 2:00 p. m., y el
  informe solo muestra meses cerrados. Una carga diaria recoge los asientos tardíos de meses cerrados.

  Requisitos: dbo.sp_Actualizar_Informe_pkt ya creado (01_informe_pkt.sql) y una primera carga correcta.
  Lo ejecuta el desarrollador con permisos en msdb.

  Propietario: el login que ejecuta el script (por omisión de sp_add_job). Si los demás jobs
  de BI usan otro propietario (por ejemplo, sa o una cuenta de servicio), cámbialo en @owner_login_name.

  Rollback:  EXEC msdb.dbo.sp_delete_job @job_name = N'BI - PKT carga diaria', @delete_unused_schedule = 1;
*/

USE [msdb];
GO

DECLARE @JobId binary(16);
DECLARE @Rc int;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'BI - PKT carga diaria')
BEGIN
    RAISERROR (N'El job "BI - PKT carga diaria" ya existe. Bórralo primero (ver rollback) o revisa su configuración.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

EXEC @Rc = msdb.dbo.sp_add_job
    @job_name     = N'BI - PKT carga diaria',
    @enabled      = 1,
    @description  = N'Recalcula Planos_Symphony.dbo.Informe_pkt_saldos e Informe_pkt_intercompania (saldos de fin de mes del KTNO de Firplak_SA y DBViventta, con eliminación entre compañías). Carga completa. Bitácora en dbo.Cargas_Log (Proceso = Informe_pkt).',
    @category_name = N'[Uncategorized (Local)]',
    -- @owner_login_name = N'sa',
    @notify_level_eventlog = 2,   -- Registra en el log de eventos de Windows si falla
    @job_id       = @JobId OUTPUT;
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobstep
    @job_id            = @JobId,
    @step_name         = N'Actualizar Informe_pkt',
    @step_id           = 1,
    @subsystem         = N'TSQL',
    @database_name     = N'Planos_Symphony',
    @command           = N'EXEC dbo.sp_Actualizar_Informe_pkt;',
    @retry_attempts    = 1,        -- Un reintento: el informe se consulta a las 2:00 p. m.
    @retry_interval    = 10,       -- Minutos entre intentos
    @on_success_action = 1,        -- Terminar con éxito
    @on_fail_action    = 2;        -- Terminar con error
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobschedule
    @job_id            = @JobId,
    @name              = N'Diario 1:00 p. m.',
    @enabled           = 1,
    @freq_type         = 4,        -- Diario
    @freq_interval     = 1,        -- Todos los días
    @active_start_time = 130000;   -- 13:00:00 (HHMMSS)
IF @Rc <> 0 GOTO Error;

EXEC @Rc = msdb.dbo.sp_add_jobserver
    @job_id      = @JobId,
    @server_name = N'(local)';
IF @Rc <> 0 GOTO Error;

COMMIT TRANSACTION;
PRINT N'Job "BI - PKT carga diaria" creado.';
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
-- WHERE j.name = N'BI - PKT carga diaria';

-- Historial del job (después de la primera ejecución programada)
-- EXEC msdb.dbo.sp_help_jobhistory @job_name = N'BI - PKT carga diaria';

-- Ejecución manual de prueba (opcional)
-- EXEC msdb.dbo.sp_start_job @job_name = N'BI - PKT carga diaria';

-- Cargas registradas por el SP
-- SELECT TOP (5) * FROM Planos_Symphony.dbo.Cargas_Log WHERE Proceso = N'Informe_pkt' ORDER BY Inicio DESC;
