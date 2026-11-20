import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkingDay, monthDates, suggestedWorkingDays } from "@/lib/metas/calendar";

// Empresas del filtro y de las metas. Viventta sale de la columna Empresa; CEFI, del centro de costos (Reporting API).
export const companies = ["Firplak", "Viventta", "CEFI"] as const;
export type Company = (typeof companies)[number];

// Segmentos con meta propia: Firplak y CEFI se dividen por mercado (TipoVentas). En la base se guardan en
// commercial_targets.company.
export const targetSegments = ["Firplak Nacional", "Firplak Exterior", "Viventta", "CEFI Nacional", "CEFI Exterior"] as const;
export type TargetSegment = (typeof targetSegments)[number];

const cefiSegments: TargetSegment[] = ["CEFI Nacional", "CEFI Exterior"];

// Meta que corresponde a los filtros (decisiones del desarrollador, 2026-11-09 y 2026-11-10):
// - Empresa: Firplak y CEFI, sus dos segmentos; Viventta, el suyo. Empresa y mercado se combinan (intersección).
// - Mercado Nacional: Firplak Nacional + Viventta (+ CEFI Nacional solo con la empresa CEFI).
//   Mercado Exterior: Firplak Exterior (+ CEFI Exterior solo con la empresa CEFI). Otro mercado: sin meta.
// - Con un mercado y todas las empresas, CEFI no cuenta: la API también lo excluye de los datos.
export function segmentsFor(company: Company | "Todas", market: string): TargetSegment[] {
  const byCompany: TargetSegment[] = company === "Firplak" ? ["Firplak Nacional", "Firplak Exterior"]
    : company === "Viventta" ? ["Viventta"]
    : company === "CEFI" ? cefiSegments
    : [...targetSegments];
  if (market === "Todos") return byCompany;
  const byMarket: TargetSegment[] = market === "Nacional" ? ["Firplak Nacional", "Viventta", "CEFI Nacional"]
    : market === "Exterior" ? ["Firplak Exterior", "CEFI Exterior"]
    : [];
  return byCompany.filter((segment) => byMarket.includes(segment) && (company === "CEFI" || !cefiSegments.includes(segment)));
}

export type CommercialTarget = {
  year: number;
  month: number;
  segment: TargetSegment;
  billingTarget: number;
  deliveryTarget: number;
};

export type CommercialTargetsYear = {
  targets: CommercialTarget[];
  // Días laborales guardados por mes; si un mes no tiene valor se usa el calculado.
  workingDays: Map<number, number>;
};

export async function loadCommercialTargets(supabase: SupabaseClient, year: number): Promise<CommercialTargetsYear> {
  const [targetsResult, daysResult] = await Promise.all([
    supabase.from("commercial_targets").select("year, month, company, billing_target, delivery_target").eq("year", year),
    supabase.from("commercial_working_days").select("month, working_days").eq("year", year),
  ]);
  if (targetsResult.error) throw targetsResult.error;
  if (daysResult.error) throw daysResult.error;
  return {
    targets: (targetsResult.data ?? []).map((row) => ({
      year: Number(row.year),
      month: Number(row.month),
      segment: row.company as TargetSegment,
      billingTarget: Number(row.billing_target) || 0,
      deliveryTarget: Number(row.delivery_target) || 0,
    })),
    workingDays: new Map((daysResult.data ?? []).map((row) => [Number(row.month), Number(row.working_days)])),
  };
}

export function workingDaysFor(data: CommercialTargetsYear | null, year: number, month: number) {
  return data?.workingDays.get(month) ?? suggestedWorkingDays(year, month);
}

export type TargetPoint = {
  date: string;
  working: boolean;
  billingDay: number;
  deliveryDay: number;
  billingCumulative: number;
  deliveryCumulative: number;
};

// Meta diaria = meta mensual / días laborales del mes, solo en días laborales. El acumulado corre por todo el periodo
// (un mes o el año) y en cada mes no supera la meta mensual aunque los días calculados excedan los guardados.
export function buildTargetSeries(data: CommercialTargetsYear | null, year: number, months: number[], company: Company | "Todas", market = "Todos") {
  const segments = segmentsFor(company, market);
  const points: TargetPoint[] = [];
  let billingBase = 0;
  let deliveryBase = 0;
  let billingTotal = 0;
  let deliveryTotal = 0;

  for (const month of months) {
    const monthTargets = (data?.targets ?? []).filter((target) => target.month === month && segments.includes(target.segment));
    const billing = monthTargets.reduce((total, target) => total + target.billingTarget, 0);
    // Una sola meta para ventas y entregas (confirmado por el negocio, 2026-11-09): billing_target manda.
    // Viventta no tiene entregas en SAP y queda fuera del informe de entregas (2026-11-10): su meta no cuenta aquí.
    const delivery = monthTargets
      .filter((target) => target.segment !== "Viventta")
      .reduce((total, target) => total + target.billingTarget, 0);
    const workingDays = workingDaysFor(data, year, month);
    billingTotal += billing;
    deliveryTotal += delivery;

    let elapsed = 0;
    for (const date of monthDates(year, month)) {
      const working = isWorkingDay(date);
      if (working) elapsed += 1;
      const share = Math.min(elapsed, workingDays) / workingDays;
      points.push({
        date,
        working,
        billingDay: working && elapsed <= workingDays ? billing / workingDays : 0,
        deliveryDay: working && elapsed <= workingDays ? delivery / workingDays : 0,
        billingCumulative: billingBase + billing * share,
        deliveryCumulative: deliveryBase + delivery * share,
      });
    }
    billingBase += billing;
    deliveryBase += delivery;
  }

  return { points, billingTotal, deliveryTotal };
}

// Punto de la serie en la fecha de corte: hoy si cae dentro del periodo, el último día si el periodo ya pasó.
export function pointAt(points: TargetPoint[], cutoff: string) {
  if (!points.length || cutoff < points[0].date) return null;
  let found = points[0];
  for (const point of points) {
    if (point.date > cutoff) break;
    found = point;
  }
  return found;
}

export function elapsedWorkingDays(points: TargetPoint[], cutoff: string) {
  return points.filter((point) => point.working && point.date <= cutoff).length;
}
