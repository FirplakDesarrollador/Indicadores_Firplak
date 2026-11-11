"use client";

import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { formatCurrency, formatDate, formatNumber } from "@/lib/dashboard/format";
import { isWorkingDay } from "@/lib/metas/calendar";

export type CumulativePoint = { date: string; label: string; real: number | null; meta: number | null };
export type CumulativeChartPoint = { date: string; label: string } & Record<string, number | string | null>;
export type CumulativeLine = { dataKey: string; name: string; color: string; dashed?: boolean };
export type CumulativeTooltipExtra = { label: string; value: number };

type TooltipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: CumulativeChartPoint };

// Recuadro del día: los valores de cada línea y, debajo, los datos extra que calcula la pantalla (por ejemplo, la
// diferencia frente a la meta). Los extras no se dibujan como línea para no cambiar la escala del eje.
function CumulativeTooltip({ active, label, payload, extras }: {
  active?: boolean;
  label?: unknown;
  payload?: readonly TooltipEntry[];
  extras?: (point: CumulativeChartPoint) => CumulativeTooltipExtra[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const extraRows = point && extras ? extras(point) : [];
  return <div className="cumulative-tooltip" style={chartTooltipStyle}>
    <strong>{String(label ?? "")}</strong>
    {payload.filter((entry) => entry.value !== null && entry.value !== undefined).map((entry) => <span key={String(entry.dataKey)}><i style={{ background: entry.color }} />{String(entry.name)}: {formatCurrency(Number(entry.value))}</span>)}
    {extraRows.map((extra) => <span key={extra.label} className={`cumulative-tooltip-extra ${extra.value < 0 ? "negative" : "positive"}`}>{extra.label}: {extra.value > 0 ? "+" : ""}{formatCurrency(extra.value)}</span>)}
  </div>;
}

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

// Varias series acumuladas en una sola gráfica; cada serie se distingue por el color y las metas van punteadas.
export default function CumulativeChart({ kicker, title, lines, data, loading, ariaLabel, emptyText, note, tooltipExtras, className = "" }: {
  kicker: string;
  title: string;
  lines: CumulativeLine[];
  data: CumulativeChartPoint[];
  loading: boolean;
  ariaLabel: string;
  emptyText: string;
  note?: ReactNode;
  tooltipExtras?: (point: CumulativeChartPoint) => CumulativeTooltipExtra[];
  className?: string;
}) {
  return <section className={`billing-panel billing-cumulative-panel ${className}`}>
    <div className="billing-panel-heading"><div><span className="billing-panel-kicker">{kicker}</span><h2>{title}</h2></div><span className="billing-period-caption">{data.length ? `${formatDate(data[0].date)} — ${formatDate(data[data.length - 1].date)}` : "Sin datos"}</span></div>
    <div className="billing-chart-legend">{lines.map((line) => <span key={line.dataKey}><i className="cumulative-line" style={{ borderTop: `${line.dashed ? 2 : 2.5}px ${line.dashed ? "dashed" : "solid"} ${line.color}` }} /> {line.name}</span>)}</div>
    {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : data.length ? <div className="billing-chart" role="img" aria-label={ariaLabel}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke={chartColors.grid} /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: chartColors.axis, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={millionsTick} width={64} /><Tooltip content={(props) => <CumulativeTooltip active={props.active} label={props.label} payload={props.payload as readonly TooltipEntry[] | undefined} extras={tooltipExtras} />} />{lines.map((line) => <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name} stroke={line.color} strokeWidth={line.dashed ? 2 : 2.5} strokeDasharray={line.dashed ? "6 4" : undefined} dot={false} connectNulls={false} />)}</LineChart></ResponsiveContainer></div> : <div className="billing-empty">{emptyText}</div>}
    {note}
  </section>;
}
