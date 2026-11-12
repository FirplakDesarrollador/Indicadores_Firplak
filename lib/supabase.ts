import { createClient } from "@supabase/supabase-js";

// ==============================================================================
// 1. Cliente Supabase para Planner / Capacidad Operativa & Límite WIPL
// Proyecto: TH y TI (jdtjtkncptwqdhlxmzds)
// ==============================================================================
const plannerUrl =
  process.env.SUPABASE_PLANNER_URL || "https://jdtjtkncptwqdhlxmzds.supabase.co";
const plannerKey =
  process.env.SUPABASE_PLANNER_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PLANNER_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabasePlanner = createClient(plannerUrl, plannerKey);

// Alias para mantener compatibilidad con app/api/carga/route.ts
export const supabase = supabasePlanner;
