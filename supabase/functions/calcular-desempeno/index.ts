// Supabase Edge Function: calcular-desempeno
// Ejecuta el cálculo diario de score de gestión para cada persona de Firplak.
// Puede ejecutarse vía cron (pg_cron) o llamada HTTP directa (POST / GET).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  fecha_corte?: string;
  dias_gracia_atraso?: number;
  dias_umbral_zombie?: number;
  umbral_volumen_minimo?: number;
  meta_score?: number;
}

Deno.serve(async (req: Request) => {
  // Manejo de CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_PLANNER_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_PLANNER_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Credenciales de Supabase no configuradas en el entorno.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leer parámetros opcionales
    let body: ReqBody = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    } else {
      const url = new URL(req.url);
      body.fecha_corte = url.searchParams.get("fecha_corte") || undefined;
    }

    // Fecha objetivo (Por defecto hoy en hora Colombia)
    const targetDate = body.fecha_corte || new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // 1. Intentar llamar a la función RPC si existe
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("fn_calcular_score_gestion", {
        p_fecha_corte: targetDate,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            metodo: "rpc",
            fecha_corte: targetDate,
            resultado: rpcData[0],
            message: `Score de gestión calculado exitosamente para ${targetDate}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      // Si la RPC no existe aún, se procede con cálculo directo en el runtime de Deno
    }

    // 2. Cálculo nativo en Edge Function (Fallback transparente)
    // Leer tareas del corte del día
    const { data: rows, error: fetchErr } = await supabase
      .from("fact_planner_corte_diario")
      .select("id, assigned_user_name, assigned_user_id, area, fecha_entrega, dias_abierto, percent_complete")
      .eq("fecha_corte", targetDate)
      .limit(10000);

    if (fetchErr) throw fetchErr;

    const validRows = (rows || []).filter(
      (r) => r.assigned_user_name && r.assigned_user_name !== "Sin asignar" && (r.percent_complete || 0) < 100
    );

    const diasGracia = body.dias_gracia_atraso ?? 2;
    const diasZombie = body.dias_umbral_zombie ?? 60;
    const umbralVolumen = Math.max(1, body.umbral_volumen_minimo ?? 5);
    const metaScore = body.meta_score ?? 80;

    const userMap: Record<
      string,
      {
        nombre: string;
        colaborador_id: string | null;
        area: string;
        total: number;
        hoy: number;
        atrasadas2d: number;
        zombies: number;
        sinFecha: number;
      }
    > = {};

    for (const r of validRows) {
      const u = r.assigned_user_name;
      if (!userMap[u]) {
        userMap[u] = {
          nombre: u,
          colaborador_id: r.assigned_user_id || null,
          area: r.area || "Sin área",
          total: 0,
          hoy: 0,
          atrasadas2d: 0,
          zombies: 0,
          sinFecha: 0,
        };
      }
      userMap[u].total += 1;

      if (!r.fecha_entrega) {
        userMap[u].sinFecha += 1;
      } else {
        const dueDate = r.fecha_entrega.slice(0, 10);
        if (dueDate === targetDate) {
          userMap[u].hoy += 1;
        } else if (dueDate < targetDate) {
          const diffDays = Math.floor(
            (new Date(targetDate).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays > diasGracia) {
            userMap[u].atrasadas2d += 1;
          }
        }
      }

      if ((r.dias_abierto || 0) > diasZombie) {
        userMap[u].zombies += 1;
      }
    }

    const payload = Object.values(userMap).map((u) => {
      const pctHoy = u.total > 0 ? (u.hoy / u.total) * 100 : 0;
      const pctAtraso = u.total > 0 ? (u.atrasadas2d / u.total) * 100 : 0;
      const pctZombie = u.total > 0 ? (u.zombies / u.total) * 100 : 0;

      const penAtraso = Math.min(40, Math.round((pctAtraso / 100) * 50 * 10) / 10);
      const penHoy =
        pctHoy > 25 ? Math.min(25, Math.round(((pctHoy - 25) / 100) * 50 * 10) / 10) : 0;
      const penZombie = Math.min(25, u.zombies * 5);
      const penSinFecha = Math.min(10, u.sinFecha * 2);

      const rawScore = 100 - penAtraso - penHoy - penZombie - penSinFecha;
      const scoreCalidad = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

      // Ponderación por representatividad de volumen
      const factorVolumen = Math.min(1.0, Math.round((u.total / umbralVolumen) * 100) / 100);
      const scoreGestion = Math.max(0, Math.min(100, Math.round(scoreCalidad * factorVolumen * 10) / 10));

      let nivel = "Crítico";
      if (scoreGestion >= 90) nivel = "Excelente";
      else if (scoreGestion >= 80) nivel = "Bueno";
      else if (scoreGestion >= 65) nivel = "Regular";

      return {
        fecha_corte: targetDate,
        nombre_completo: u.nombre,
        colaborador_id: u.colaborador_id,
        area: u.area,
        total_tareas_activas: u.total,
        tareas_vencimiento_hoy: u.hoy,
        pct_vencimiento_hoy: Math.round(pctHoy * 10) / 10,
        tareas_atrasadas_criticas: u.atrasadas2d,
        pct_atrasadas_criticas: Math.round(pctAtraso * 10) / 10,
        tareas_zombie_60d: u.zombies,
        pct_zombie: Math.round(pctZombie * 10) / 10,
        tareas_sin_fecha: u.sinFecha,
        penalizacion_atraso: penAtraso,
        penalizacion_hoy: penHoy,
        penalizacion_zombie: penZombie,
        penalizacion_sin_fecha: penSinFecha,
        score_calidad: scoreCalidad,
        factor_volumen: Math.round(factorVolumen * 100),
        score_gestion: scoreGestion,
        nivel_gestion: nivel,
        cumple_meta: scoreGestion >= metaScore,
      };
    });

    // Intentar guardar en fact_gestion_diaria si la tabla existe
    try {
      await supabase.from("fact_gestion_diaria").upsert(payload, {
        onConflict: "fecha_corte,nombre_completo",
      });
    } catch {
      // Ignorar si la tabla aún no fue creada
    }

    const avgScore =
      payload.length > 0
        ? Math.round((payload.reduce((acc, p) => acc + p.score_gestion, 0) / payload.length) * 10) / 10
        : 0;
    const cumplenCount = payload.filter((p) => p.cumple_meta).length;

    return new Response(
      JSON.stringify({
        success: true,
        metodo: "edge-function-direct",
        fecha_corte: targetDate,
        total_colaboradores: payload.length,
        promedio_score: avgScore,
        cumplen_meta: cumplenCount,
        pct_cumplimiento: payload.length > 0 ? Math.round((cumplenCount / payload.length) * 100) : 0,
        message: `Cálculo de desempeño finalizado para ${payload.length} colaboradores`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

