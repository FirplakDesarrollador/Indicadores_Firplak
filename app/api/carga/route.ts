import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PlannerUserKpi {
  id?: string;
  mail?: string;
  display_name?: string;
  total_tasks?: number;
  completadas?: number;
  vencidas?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedDate = searchParams.get("fecha_corte");

    // 1. Obtener todas las fechas de corte disponibles
    const { data: dateData } = await supabase
      .from("fact_planner_corte_diario")
      .select("fecha_corte")
      .order("fecha_corte", { ascending: false });

    const fechasCorteDisponibles = Array.from(
      new Set((dateData || []).map((d) => d.fecha_corte).filter(Boolean))
    );

    const targetDate =
      requestedDate && fechasCorteDisponibles.includes(requestedDate)
        ? requestedDate
        : fechasCorteDisponibles[0] || requestedDate || new Date().toISOString().split("T")[0];

    // 2. Query de todas las asignaciones del corte del día
    const { data: rows, error } = await supabase
      .from("fact_planner_corte_diario")
      .select("id, task_id, titulo_tarea, plan_id, titulo_plan, bucket_id, titulo_bucket, assigned_user_name, area, fecha_creacion_tarea, fecha_entrega, percent_complete, es_atrasado, dias_abierto")
      .eq("fecha_corte", targetDate);

    if (error) throw error;

    const allRows = rows || [];

    // 3. Capacidades WIPL desde dim_personal_capacidad
    const { data: capData } = await supabase
      .from("dim_personal_capacidad")
      .select("id, nombre_completo, wipl, area, activo");

    const wiplMap: Record<string, number> = {};
    (capData || []).forEach((c) => {
      wiplMap[c.nombre_completo] = c.wipl || 5;
    });

    // 4. Obtener KPIs históricos de productividad / throughput por usuario
    const throughputMap: Record<string, { total: number; completadas: number; vencidas: number }> = {};
    try {
      const { data: kpis } = await supabase.rpc("get_planner_user_kpis");
      (kpis as PlannerUserKpi[] | null || []).forEach((k) => {
        if (k.display_name) {
          throughputMap[k.display_name] = {
            total: k.total_tasks || 0,
            completadas: k.completadas || 0,
            vencidas: k.vencidas || 0,
          };
        }
      });
    } catch {
      // Si el RPC falla o no está disponible, continuar sin throughput
    }

    // 5. Catálogos maestros completos
    const masterAreas = Array.from(
      new Set(allRows.map((r) => r.area).filter((a) => a && a !== "Sin área"))
    ).sort();

    const masterPlanes = Array.from(
      new Set(allRows.map((r) => r.titulo_plan).filter(Boolean))
    ).sort();

    const masterUsers = Array.from(
      new Set(allRows.map((r) => r.assigned_user_name).filter((u) => u && u !== "Sin asignar"))
    ).sort();

    return NextResponse.json({
      success: true,
      fechaCorte: targetDate,
      fechasCorteDisponibles,
      wiplMap,
      collaboratorsConfig: capData || [],
      throughputMap,
      masterCatalog: {
        areas: masterAreas,
        planes: masterPlanes,
        users: masterUsers,
      },
      snapshotRows: allRows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error en API capacidad / WIPL:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return NextResponse.json({ success: false, error: "Formato inválido. 'configs' debe ser una lista." }, { status: 400 });
    }

    // Actualizar o insertar cada configuración de colaborador
    for (const item of configs) {
      if (!item.nombre_completo) continue;

      const { data: existing } = await supabase
        .from("dim_personal_capacidad")
        .select("id")
        .eq("nombre_completo", item.nombre_completo)
        .maybeSingle();

      const wiplVal = typeof item.wipl === "number" ? Math.max(1, Math.min(50, item.wipl)) : 5;
      const areaVal = item.area || "General";
      const activoVal = item.activo !== false;

      if (existing) {
        await supabase
          .from("dim_personal_capacidad")
          .update({
            wipl: wiplVal,
            area: areaVal,
            activo: activoVal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("dim_personal_capacidad")
          .insert({
            nombre_completo: item.nombre_completo,
            wipl: wiplVal,
            area: areaVal,
            activo: activoVal,
          });
      }
    }

    // Retornar la lista actualizada
    const { data: updatedList } = await supabase
      .from("dim_personal_capacidad")
      .select("id, nombre_completo, wipl, area, activo");

    const wiplMap: Record<string, number> = {};
    (updatedList || []).forEach((c) => {
      wiplMap[c.nombre_completo] = c.wipl || 5;
    });

    return NextResponse.json({
      success: true,
      collaboratorsConfig: updatedList || [],
      wiplMap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error al actualizar configuración WIPL:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
