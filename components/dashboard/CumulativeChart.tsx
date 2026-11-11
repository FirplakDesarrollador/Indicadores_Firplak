"use client";

import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { formatCurrency, formatDate, formatNumber } from "@/lib/dashboard/format";
import { isWorkingDay } from "@/lib/metas/calendar";

export type CumulativePoint = { date: string; label: string; real: number | null; meta: number | null };

// Acumulado real frente a la meta acumulada, día a día. Los valores de sábados, domingos y festivos sí suman al
// acumulado, pero en la gráfica solo aparecen los días laborales (decisión del desarrollador, 2026-11-09): lo vendido
// un sábado se ve en el siguiente día laboral.
export function buildCumulativeData({ dates, valuesByDate, targetByDate, cutoff }: {
  dates: string[];
  valuesByDate: Map<string, number>;
  targetByDate: Map<string, number> | null;
  cutoff: string;
}): CumulativePoint[] {
  const points: CumulativePoint[] = [];
  let running = 0;
  for (const date of dates) {
    running += valuesByDate.get(date) ?? 0;
    if (!isWorkingDay(date)) continue;
    points.push({
      date,
      label: formatDate(date),
      real: date <= cutoff ? running : null,
      meta: targetByDate ? targetByDate.get(date) ?? null : null,
    });
  }
  return points;
}

const millionsTick = (value: unknown) => `$${formatNumber(Math.round(Number(value) / 1_000_000))} M`;

export default function CumulativeChart({ kicker, title, realLabel, data, loading, ariaLabel, emptyText, note, className = "" }: {
  kicker: string;
  title: string;
  realLabel: string;
  data: CumulativePoint[];
  loading: boolean;
  ariaLabel: string;
  emptyText: string;
  note?: ReactNode;
  className?: string;
}) {
  return <section className={`billing-panel billing-cumulative-panel ${className}`}>
    <div className="billing-panel-heading"><div><span className="billing-panel-kicker">{kicker}</span><h2>{title}</h2></div><span className="billing-period-caption">{data.length ? `${formatDate(data[0].date)} — ${formatDate(data[data.length - 1].date)}` : "Sin datos"}</span></div>
    <div className="billing-chart-legend"><span><i className="cumulative-real" /> {realLabel}</span><span><i className="cumulative-target" /> Meta acumulada</span></div>
    {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : data.length ? <div className="billing-chart" role="img" aria-label={ariaLabel}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke={chartColors.grid} /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: chartColors.axis, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={millionsTick} width={64} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: chartColors.primary, fontWeight: 600 }} formatter={(value) => formatCurrency(Number(value))} /><Line type="monotone" dataKey="real" name={realLabel} stroke={chartColors.primary} strokeWidth={2.5} dot={false} connectNulls={false} /><Line type="monotone" dataKey="meta" name="Meta acumulada" stroke={chartColors.secondary} strokeWidth={2} strokeDasharray="6 4" dot={false} /></LineChart></ResponsiveContainer></div> : <div className="billing-empty">{emptyText}</div>}
    {note}
  </section>;
}
