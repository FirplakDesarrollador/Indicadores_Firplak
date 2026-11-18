/*
  Consolidado comercial SAP: job del SQL Server Agent que recarga dbo.Informe_consolidado_comercial.
  Ficha: llm-wiki/proyectos/consolidado-comercial.md (decisiones 4 y 8).

  Ejecución: SOLO el desarrollador/TI, en ITPLAKINFO, después de 01_informe_consolidado_comercial.sql.
  Horario: cada 30 min de 6:00 a 20:00, todos los días (decisión 8, 2026-11-17).
  Si el job ya existe, el script no hace nada (borrarlo antes con sp_delete_job para recrearlo).
*/

USE msdb;
GO

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'BI - Consolidado comercial carga completa')
BEGIN
    DECLARE @JobId uniqueidentifier;

    EXEC msdb.dbo.sp_add_job
        @job_name = N'BI - Consolidado comercial carga completa',
        @enabled = 1,
        @description = N'Recarga Planos_Symphony.dbo.Informe_consolidado_comercial (ofertas, OV pendientes y tránsito) desde Firplak_SA.',
        @owner_login_name = N'sa',
        @job_id = @JobId OUTPUT;

    EXEC msdb.dbo.sp_add_jobstep
        @job_id = @JobId,
        @step_name = N'Recargar Informe_consolidado_comercial',
        @subsystem = N'TSQL',
        @database_name = N'Planos_Symphony',
        @command = N'EXEC dbo.sp_Actualizar_Informe_consolidado_comercial;',
        @on_success_action = 1,   -- terminar con éxito
        @on_fail_action = 2;      -- terminar con error

    EXEC msdb.dbo.sp_add_jobschedule
        @job_id = @JobId,
        @name = N'Cada 30 min de 6:00 a 20:00',
        @enabled = 1,
        @freq_type = 4,               -- diario
        @freq_interval = 1,           -- todos los días
        @freq_subday_type = 4,        -- en minutos
        @freq_subday_interval = 30,   -- cada 30 min
        @active_start_time = 60000,   -- 06:00:00
        @active_end_time = 200000;    -- 20:00:00

    EXEC msdb.dbo.sp_add_jobserver
        @job_id = @JobId,
        @server_name = N'(local)';
END
GO

/* Verificación: quitar el -- de las líneas que se quieran correr. */
-- Correr una vez a mano:
-- EXEC msdb.dbo.sp_start_job @job_name = N'BI - Consolidado comercial carga completa';

-- Historial del job:
-- SELECT TOP (10) h.run_date, h.run_time, h.run_status, h.run_duration, h.message
-- FROM msdb.dbo.sysjobhistory h
-- JOIN msdb.dbo.sysjobs j ON j.job_id = h.job_id
-- WHERE j.name = N'BI - Consolidado comercial carga completa' AND h.step_id = 0
-- ORDER BY h.instance_id DESC;

-- Bitácora del SP:
-- SELECT TOP (10) * FROM Planos_Symphony.dbo.Bitacora_Cargas_Informes
-- WHERE Informe = N'Informe_consolidado_comercial' ORDER BY Id DESC;
