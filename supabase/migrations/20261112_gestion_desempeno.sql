-- ==============================================================================
-- Migración: Dashboard de Gestión y Evaluación Diaria de Desempeño
-- Tablas: dim_gestion_config, fact_gestion_diaria
-- Función: fn_calcular_score_gestion
-- Fecha: 2026-11-12
-- ==============================================================================

-- 1. Tabla de Parámetros de Configuración del Score de Gestión
CREATE TABLE IF NOT EXISTS public.dim_gestion_config (
  id serial PRIMARY KEY,
  nombre_config text NOT NULL DEFAULT 'Configuración Estándar Firplak',
  dias_gracia_atraso int NOT NULL DEFAULT 2,           -- Días de retraso permitidos/tolerados (default: 2)
  dias_umbral_zombie int NOT NULL DEFAULT 60,          -- Tareas abiertas > 60 días (detección procrastinación)
  pct_max_hoy_tolerado numeric NOT NULL DEFAULT 0.25,  -- 25% de la carga venciendo hoy se tolera sin penalizar
  peso_atraso numeric NOT NULL DEFAULT 40,             -- Deducción máxima por atraso crítico (40 pts)
  peso_hoy numeric NOT NULL DEFAULT 25,                -- Deducción máxima por agolpamiento hoy (25 pts)
  peso_zombie numeric NOT NULL DEFAULT 25,             -- Deducción máxima por procrastinación zombie (25 pts)
  peso_sin_fecha numeric NOT NULL DEFAULT 10,          -- Deducción máxima por tareas sin fecha de entrega (10 pts)
  umbral_volumen_minimo int NOT NULL DEFAULT 5,        -- Tareas mínimas para representatividad plena (100%)
  meta_score numeric NOT NULL DEFAULT 80,              -- Meta mínima de gestión (80 pts)
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insertar configuración por defecto si la tabla está vacía
INSERT INTO public.dim_gestion_config (
  nombre_config, dias_gracia_atraso, dias_umbral_zombie, pct_max_hoy_tolerado,
  peso_atraso, peso_hoy, peso_zombie, peso_sin_fecha, umbral_volumen_minimo, meta_score, activo
)
SELECT 
  'Configuración Estándar Firplak', 2, 60, 0.25, 40, 25, 25, 10, 5, 80, true
WHERE NOT EXISTS (SELECT 1 FROM public.dim_gestion_config WHERE activo = true);

-- 2. Tabla de Resultados Diarios por Colaborador
CREATE TABLE IF NOT EXISTS public.fact_gestion_diaria (
  id bigserial PRIMARY KEY,
  fecha_corte date NOT NULL,
  nombre_completo text NOT NULL,
  colaborador_id text,
  area text DEFAULT 'Sin área',
  total_tareas_activas int NOT NULL DEFAULT 0,
  tareas_vencimiento_hoy int NOT NULL DEFAULT 0,
  pct_vencimiento_hoy numeric(5,2) NOT NULL DEFAULT 0,
  tareas_atrasadas_criticas int NOT NULL DEFAULT 0,
  pct_atrasadas_criticas numeric(5,2) NOT NULL DEFAULT 0,
  tareas_zombie_60d int NOT NULL DEFAULT 0,
  pct_zombie numeric(5,2) NOT NULL DEFAULT 0,
  tareas_sin_fecha int NOT NULL DEFAULT 0,
  penalizacion_atraso numeric(5,2) NOT NULL DEFAULT 0,
  penalizacion_hoy numeric(5,2) NOT NULL DEFAULT 0,
  penalizacion_zombie numeric(5,2) NOT NULL DEFAULT 0,
  penalizacion_sin_fecha numeric(5,2) NOT NULL DEFAULT 0,
  score_calidad numeric(5,2) NOT NULL DEFAULT 0,       -- Calidad base sin ponderar (0-100)
  factor_volumen numeric(5,2) NOT NULL DEFAULT 100,    -- % de representatividad por volumen
  score_gestion numeric(5,2) NOT NULL DEFAULT 0,       -- Score efectivo de ranking (score_calidad * factor_volumen)
  nivel_gestion text NOT NULL DEFAULT 'Crítico',       -- 'Excelente', 'Bueno', 'Regular', 'Crítico'
  cumple_meta boolean NOT NULL DEFAULT false,
  detalles_json jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_fact_gestion_diaria UNIQUE (fecha_corte, nombre_completo)
);

CREATE INDEX IF NOT EXISTS idx_fact_gestion_fecha ON public.fact_gestion_diaria(fecha_corte);
CREATE INDEX IF NOT EXISTS idx_fact_gestion_area ON public.fact_gestion_diaria(area);
CREATE INDEX IF NOT EXISTS idx_fact_gestion_score ON public.fact_gestion_diaria(score_gestion DESC);

-- 3. Función RPC para Calcular y Persistir el Score Diario
CREATE OR REPLACE FUNCTION public.fn_calcular_score_gestion(p_fecha_corte date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  procesados int,
  promedio_score numeric,
  cumplen_meta int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cfg record;
  v_count int := 0;
  v_avg_score numeric := 0;
  v_cumplen int := 0;
BEGIN
  -- Obtener la configuración activa
  SELECT * INTO v_cfg 
  FROM public.dim_gestion_config 
  WHERE activo = true 
  ORDER BY id DESC 
  LIMIT 1;

  IF v_cfg IS NULL THEN
    -- Valores de respaldo en caso de no existir registro
    v_cfg.dias_gracia_atraso := 2;
    v_cfg.dias_umbral_zombie := 60;
    v_cfg.pct_max_hoy_tolerado := 0.25;
    v_cfg.peso_atraso := 40;
    v_cfg.peso_hoy := 25;
    v_cfg.peso_zombie := 25;
    v_cfg.peso_sin_fecha := 10;
    v_cfg.umbral_volumen_minimo := 5;
    v_cfg.meta_score := 80;
  END IF;

  -- Calcular e insertar en fact_gestion_diaria
  WITH calculo AS (
    SELECT
      f.assigned_user_name AS nombre_completo,
      MAX(f.assigned_user_id) AS colaborador_id,
      COALESCE(NULLIF(f.area, ''), 'Sin área') AS area,
      COUNT(*)::int AS total_tareas_activas,
      -- 1. Vence hoy
      COUNT(*) FILTER (
        WHERE f.fecha_entrega IS NOT NULL 
          AND f.fecha_entrega::date = p_fecha_corte
      )::int AS tareas_hoy,
      -- 2. Atrasadas > días de gracia
      COUNT(*) FILTER (
        WHERE f.fecha_entrega IS NOT NULL 
          AND f.fecha_entrega::date < (p_fecha_corte - (v_cfg.dias_gracia_atraso || ' days')::interval)::date
      )::int AS atrasadas_criticas,
      -- 3. Zombies (> 60 días abiertas)
      COUNT(*) FILTER (
        WHERE COALESCE(f.dias_abierto, 0) > v_cfg.dias_umbral_zombie
      )::int AS zombies,
      -- 4. Sin fecha
      COUNT(*) FILTER (
        WHERE f.fecha_entrega IS NULL
      )::int AS sin_fecha
    FROM public.fact_planner_corte_diario f
    WHERE f.fecha_corte = p_fecha_corte
      AND f.assigned_user_name IS NOT NULL
      AND f.assigned_user_name <> 'Sin asignar'
      AND COALESCE(f.percent_complete, 0) < 100
    GROUP BY f.assigned_user_name, COALESCE(NULLIF(f.area, ''), 'Sin área')
  ),
  scores AS (
    SELECT
      p_fecha_corte AS fecha_corte,
      c.nombre_completo,
      c.colaborador_id,
      c.area,
      c.total_tareas_activas,
      c.tareas_hoy,
      ROUND((c.tareas_hoy::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) * 100, 2) AS pct_hoy,
      c.atrasadas_criticas,
      ROUND((c.atrasadas_criticas::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) * 100, 2) AS pct_atrasadas,
      c.zombies,
      ROUND((c.zombies::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) * 100, 2) AS pct_zombie,
      c.sin_fecha,
      -- Penalizaciones
      LEAST(v_cfg.peso_atraso, ROUND((c.atrasadas_criticas::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) * 50, 2)) AS pen_atraso,
      CASE 
        WHEN (c.tareas_hoy::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) > v_cfg.pct_max_hoy_tolerado 
        THEN LEAST(v_cfg.peso_hoy, ROUND(((c.tareas_hoy::numeric / NULLIF(c.total_tareas_activas, 0)::numeric) - v_cfg.pct_max_hoy_tolerado) * 50, 2))
        ELSE 0 
      END AS pen_hoy,
      LEAST(v_cfg.peso_zombie, (c.zombies * 5)::numeric) AS pen_zombie,
      LEAST(v_cfg.peso_sin_fecha, (c.sin_fecha * 2)::numeric) AS pen_sin_fecha,
      -- Factor de volumen (0 a 100%)
      LEAST(100.0, ROUND((c.total_tareas_activas::numeric / NULLIF(v_cfg.umbral_volumen_minimo, 0)::numeric) * 100, 1)) AS factor_volumen
    FROM calculo c
  ),
  final_scores AS (
    SELECT
      s.*,
      GREATEST(0, LEAST(100, ROUND(100 - (s.pen_atraso + s.pen_hoy + s.pen_zombie + s.pen_sin_fecha), 1))) AS score_calidad,
      GREATEST(0, LEAST(100, ROUND(
        (GREATEST(0, LEAST(100, 100 - (s.pen_atraso + s.pen_hoy + s.pen_zombie + s.pen_sin_fecha))) * (s.factor_volumen / 100.0)),
        1
      ))) AS score_gestion
    FROM scores s
  )
  INSERT INTO public.fact_gestion_diaria (
    fecha_corte,
    nombre_completo,
    colaborador_id,
    area,
    total_tareas_activas,
    tareas_vencimiento_hoy,
    pct_vencimiento_hoy,
    tareas_atrasadas_criticas,
    pct_atrasadas_criticas,
    tareas_zombie_60d,
    pct_zombie,
    tareas_sin_fecha,
    penalizacion_atraso,
    penalizacion_hoy,
    penalizacion_zombie,
    penalizacion_sin_fecha,
    score_calidad,
    factor_volumen,
    score_gestion,
    nivel_gestion,
    cumple_meta
  )
  SELECT
    fs.fecha_corte,
    fs.nombre_completo,
    fs.colaborador_id,
    fs.area,
    fs.total_tareas_activas,
    fs.tareas_hoy,
    fs.pct_hoy,
    fs.atrasadas_criticas,
    fs.pct_atrasadas,
    fs.zombies,
    fs.pct_zombie,
    fs.sin_fecha,
    fs.pen_atraso,
    fs.pen_hoy,
    fs.pen_zombie,
    fs.pen_sin_fecha,
    fs.score_calidad,
    fs.factor_volumen,
    fs.score_gestion,
    CASE 
      WHEN fs.score_gestion >= 90 THEN 'Excelente'
      WHEN fs.score_gestion >= 80 THEN 'Bueno'
      WHEN fs.score_gestion >= 65 THEN 'Regular'
      ELSE 'Crítico'
    END AS nivel_gestion,
    (fs.score_gestion >= v_cfg.meta_score) AS cumple_meta
  FROM final_scores fs
  ON CONFLICT (fecha_corte, nombre_completo) 
  DO UPDATE SET
    area = EXCLUDED.area,
    total_tareas_activas = EXCLUDED.total_tareas_activas,
    tareas_vencimiento_hoy = EXCLUDED.tareas_vencimiento_hoy,
    pct_vencimiento_hoy = EXCLUDED.pct_vencimiento_hoy,
    tareas_atrasadas_criticas = EXCLUDED.tareas_atrasadas_criticas,
    pct_atrasadas_criticas = EXCLUDED.pct_atrasadas_criticas,
    tareas_zombie_60d = EXCLUDED.tareas_zombie_60d,
    pct_zombie = EXCLUDED.pct_zombie,
    tareas_sin_fecha = EXCLUDED.tareas_sin_fecha,
    penalizacion_atraso = EXCLUDED.penalizacion_atraso,
    penalizacion_hoy = EXCLUDED.penalizacion_hoy,
    penalizacion_zombie = EXCLUDED.penalizacion_zombie,
    penalizacion_sin_fecha = EXCLUDED.penalizacion_sin_fecha,
    score_calidad = EXCLUDED.score_calidad,
    factor_volumen = EXCLUDED.factor_volumen,
    score_gestion = EXCLUDED.score_gestion,
    nivel_gestion = EXCLUDED.nivel_gestion,
    cumple_meta = EXCLUDED.cumple_meta;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT 
    COALESCE(ROUND(AVG(score_gestion), 1), 0),
    COUNT(*) FILTER (WHERE cumple_meta = true)
  INTO v_avg_score, v_cumplen
  FROM public.fact_gestion_diaria
  WHERE fecha_corte = p_fecha_corte;

  RETURN QUERY SELECT v_count, v_avg_score, v_cumplen;
END;
$$;

