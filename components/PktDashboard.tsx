"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Database, Gauge, History, Percent, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, type TooltipProps, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { formatCurrency, formatDateTime, formatMonthName } from "@/lib/dashboard/format";
import { pktNavigation } from "@/lib/dashboard/navigation";
import type { PktPayload, PktStatementRow } from "@/lib/pkt/types";

// Periodo vacío = el último mes cerrado que tenga la API (D1 de la ficha).
type Period = { year: string; month: string };
const defaultPeriod: Period = { year: "", month: "" };

// El PKT lleva dos decimales (decisión de la fase 5: 6,00 % frente a 6,05 % importa); los demás porcentajes, uno.
const pktFormat = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedPercentFormat = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });

function formatPkt(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : pktFormat.format(value);
}

function formatSignedPercent(value: number | null) {
  return value === null ? "—" : signedPercentFormat.format(value);
}

// La matriz y las tarjetas van siempre en millones con un decimal (decisión de la fase 5); el valor completo, en el title.
const millionsFormat = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatMoney(value: number | null) {
  if (value === null) return "—";
  const millions = Math.abs(value) / 1_000_000;
  return `${value < 0 && millions >= 0.05 ? "-" : ""}$${millionsFormat.format(millions)} M`;
}

function formatSignedMoney(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 && Math.abs(value) >= 50_000 ? "+" : ""}${formatMoney(value)}`;
}

function shortMonth(month: number) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(2026, month - 1, 1)).replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function periodLabel(year: number, month: number) {
  return `${formatMonthName(month).toLowerCase()} de ${year}`;
}

function variationClass(value: number | null) {
  if (value === null || value === 0) return "";
  return value > 0 ? "billing-difference-cell" : "billing-difference-cell negative";
}

function ChartTooltip({ active, payload, label, rows }: TooltipProps<number, string> & { rows: (data: Record<string, unknown>) => Array<[string, string]> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, unknown>;
  return <div style={chartTooltipStyle} className="pkt-chart-tooltip"><strong>{label}</strong>{rows(data).map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b></div>)}</div>;
}

const pktTick = (value: unknown) => pktFormat.format(Number(value));
const pktLabel = (value: unknown) => (typeof value === "number" ? pktFormat.format(value) : "");

// Dos páginas con el mismo periodo y la misma consulta: "statement" (tarjetas, matriz y PKT) y "charts" (gráficas).
export default function PktDashboard({ mode = "statement" }: { mode?: "statement" | "charts" }) {
  const isCharts = mode === "charts";
  const [payload, setPayload] = useState<PktPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // El periodo se edita como borrador y solo consulta la API al aplicarlo.
  const [appliedPeriod, setAppliedPeriod] = useState<Period>(defaultPeriod);
  const [draftPeriod, setDraftPeriod] = useState<Period>(defaultPeriod);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedPeriod.year && appliedPeriod.month) {
        params.set("anio", appliedPeriod.year);
        params.set("mes", appliedPeriod.month);
      }
      const query = params.toString();
      const response = await fetch(`/api/pkt${query ? `?${query}` : ""}`, { cache: "no-store" });
      const data = await readJsonPayload<PktPayload & { error?: string }>(response, "La API del PKT");
      if (!response.ok) throw new Error(data.error ?? "No pudimos cargar el PKT. Intenta de nuevo en unos minutos.");
      if (!data.summary || !data.statement) throw new Error("La API necesita actualizarse para devolver el PKT.");
      setPayload(data);
      setDraftPeriod({ year: String(data.period.year), month: String(data.period.month) });
      setError("");
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "No pudimos cargar el PKT. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [appliedPeriod]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 150);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const periods = useMemo(() => payload?.periods ?? [], [payload]);
  const draftMonths = useMemo(() => periods.find((period) => String(period.year) === draftPeriod.year)?.months ?? [], [periods, draftPeriod.year]);
  const shownPeriod = payload?.period;
  const hasPendingPeriod = Boolean(shownPeriod) && (draftPeriod.year !== String(shownPeriod?.year) || draftPeriod.month !== String(shownPeriod?.month));

  // Al cambiar el año, el mes se conserva si existe en ese año; si no, pasa al último mes cerrado del año.
  const changeYear = (year: string) => {
    const months = periods.find((period) => String(period.year) === year)?.months ?? [];
    setDraftPeriod((current) => ({ year, month: months.includes(Number(current.month)) ? current.month : String(months[months.length - 1] ?? "") }));
  };
  const applyPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasPendingPeriod || !draftPeriod.year || !draftPeriod.month) return;
    setAppliedPeriod({ ...draftPeriod });
  };
  const resetPeriod = () => {
    if (appliedPeriod.year || appliedPeriod.month) setAppliedPeriod(defaultPeriod);
    else if (shownPeriod) setDraftPeriod({ year: String(shownPeriod.year), month: String(shownPeriod.month) });
  };
  const toggleGroup = (group: string) => setCollapsedGroups((current) => (current.includes(group) ? current.filter((item) => item !== group) : [...current, group]));

  const summary = payload?.summary;
  const year = shownPeriod?.year ?? 0;
  const month = shownPeriod?.month ?? 1;
  const previousYear = year - 1;
  const currentLabel = shownPeriod ? periodLabel(year, month) : "";
  const variationIcon = (summary?.salesVariation ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;

  const annualData = useMemo(() => (payload?.series.annualClose ?? []).map((point) => ({
    ...point,
    label: String(point.year),
    cutoff: point.partial ? `${formatMonthName(point.month)} (parcial)` : "Diciembre",
  })), [payload]);
  const monthlyData = useMemo(() => (payload?.series.monthly ?? []).map((point) => ({ ...point, label: shortMonth(point.month) })), [payload]);

  const visibleRows = (payload?.statement ?? []).filter((row) => row.type !== "concept" || !collapsedGroups.includes(row.group));

  const statementRow = (row: PktStatementRow) => {
    const isGroup = row.type === "group";
    const isTotal = row.type === "total";
    const collapsed = collapsedGroups.includes(row.group);
    return <tr key={`${row.type}-${row.name}`} className={`pkt-row-${row.type}`}>
      <td>{isGroup ? <button type="button" className="pkt-group-toggle" onClick={() => toggleGroup(row.group)} aria-expanded={!collapsed} aria-label={`${collapsed ? "Mostrar" : "Ocultar"} los conceptos de ${row.name}`}>{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}<span>{row.name}</span></button> : <span className={isTotal ? "pkt-total-name" : "pkt-concept-name"}>{row.name}</span>}</td>
      <td className="align-right" title={row.previousYear === null ? undefined : formatCurrency(row.previousYear)}>{formatMoney(row.previousYear)}</td>
      <td className="align-right" title={formatCurrency(row.currentYear)}>{formatMoney(row.currentYear)}</td>
      <td className={`align-right ${variationClass(row.variation)}`} title={row.variation === null ? undefined : formatCurrency(row.variation)}>{formatSignedMoney(row.variation)}</td>
      <td className="align-right">{formatSignedPercent(row.variationPct)}</td>
    </tr>;
  };

  return <DashboardShell navigation={pktNavigation} activeHref={isCharts ? "/pkt/graficas" : "/pkt"} title={isCharts ? "Gráficas del PKT" : "PKT"} className="pkt-shell">
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> CONTABILIDAD Y FINANZAS</div><h1>{isCharts ? "Gráficas del PKT" : "PKT · Productividad del capital de trabajo"}</h1><p>{isCharts ? "Evolución del PKT: cierre de cada año y cada mes cerrado del año elegido. Consolidado de Firplak y Viventta." : "KTNO frente a las ventas proyectadas del año, consolidado de Firplak y Viventta. Solo meses cerrados; el comparativo es el cierre de diciembre del año anterior."}</p></div></div>

    <form className="billing-filterbar billing-filterbar-sticky" onSubmit={applyPeriod} aria-label="Filtros">
      <div className="billing-filterbar-primary">
        <label><CalendarDays size={15} /><span>Año</span><select value={draftPeriod.year} onChange={(event) => changeYear(event.target.value)} disabled={!periods.length}>{periods.map((period) => <option key={period.year} value={String(period.year)}>{period.year}</option>)}</select></label>
        <label><span>Mes</span><select value={draftPeriod.month} onChange={(event) => setDraftPeriod((current) => ({ ...current, month: event.target.value }))} disabled={!draftMonths.length}>{draftMonths.map((item) => <option key={item} value={String(item)}>{formatMonthName(item)}</option>)}</select></label>
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetPeriod}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingPeriod}>Aplicar filtros</button></div>
      </div>
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData()}>Reintentar</button></div>}

    {!isCharts && <>
    <div className="pkt-metrics-grid">{loading || !summary ? Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />) : <>
      <MetricCard label="Ventas año anterior" value={formatMoney(summary.previousYearSales)} detail={summary.previousYearSales === null ? `Sin ventas registradas de ${previousYear}` : `Ventas netas de enero a diciembre de ${previousYear}`} icon={History} />
      <MetricCard label="Ventas proyectadas" value={formatMoney(summary.projectedSales)} detail={`${formatMoney(summary.ytdSales)} acumuladas a ${formatMonthName(month).toLowerCase()} ÷ ${month} × 12`} icon={TrendingUp} />
      <MetricCard label="Variación de ventas" value={formatSignedMoney(summary.salesVariation)} detail={summary.salesVariation === null ? "Sin año anterior para comparar" : `Proyectadas ${year} frente a ventas de ${previousYear}`} icon={variationIcon} />
      <MetricCard label="Variación de ventas %" value={formatSignedPercent(summary.salesVariationPct)} detail={summary.salesVariationPct === null ? "Sin año anterior para comparar" : `${(summary.salesVariationPct ?? 0) < 0 ? "▼" : "▲"} frente a ${previousYear}`} icon={Percent} />
    </>}</div>

    <section className="billing-panel pkt-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">CAPITAL DE TRABAJO NETO OPERATIVO</span><h2>KTNO a {currentLabel || "último mes cerrado"}</h2><p>Saldos de fin de mes en millones de pesos. Los pasivos son negativos; el KTNO es la suma de los dos grupos.</p></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table pkt-statement-table"><thead><tr><th>Concepto</th><th className="align-right">Año anterior{shownPeriod ? <small>31 dic {previousYear}</small> : null}</th><th className="align-right">Año actual{shownPeriod ? <small>{shortMonth(month).toLowerCase()} {year}</small> : null}</th><th className="align-right">Variación</th><th className="align-right">%</th></tr></thead><tbody>
        {loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={5}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : visibleRows.length ? visibleRows.map(statementRow) : <tr><td colSpan={5} className="billing-table-state"><strong>No hay saldos para el periodo elegido</strong><span>Elige otro mes cerrado.</span></td></tr>}
      </tbody></table></div>
    </section>

    <div className="pkt-indicator-grid">{loading || !summary ? Array.from({ length: 2 }, (_, index) => <MetricSkeleton key={index} />) : <>
      <article className="billing-metric-card pkt-indicator-card"><div className="billing-metric-icon blue"><History size={18} /></div><div className="billing-metric-copy"><span>PKT año anterior</span><strong>{formatPkt(summary.previousPkt)}</strong><small>{summary.previousPkt === null ? `Sin datos de diciembre de ${previousYear}` : `KTNO a 31 dic ${previousYear} ${formatMoney(summary.previousKtno)} ÷ ventas de ${previousYear} ${formatMoney(summary.previousYearSales)}`}</small></div></article>
      <article className="billing-metric-card pkt-indicator-card pkt-indicator-current"><div className="billing-metric-icon blue"><Gauge size={18} /></div><div className="billing-metric-copy"><span>PKT {currentLabel}</span><strong>{formatPkt(summary.pkt)}</strong><small>KTNO {formatMoney(summary.ktno)} ÷ ventas proyectadas {formatMoney(summary.projectedSales)}</small></div></article>
    </>}</div>
    </>}

    {isCharts && <div className="pkt-two-column-grid">
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">CIERRE ANUAL</span><h2>PKT de cierre por año</h2><p className="pkt-panel-note">Diciembre de cada año. El año en curso muestra el último mes cerrado. No cambia con el periodo elegido.</p></div></div>
        <div className="billing-chart-legend"><span><i className="pkt-legend-solid" /> Cierre de diciembre</span><span><i className="pkt-legend-light" /> Último mes cerrado (parcial)</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : annualData.length ? <div className="billing-chart" role="img" aria-label="PKT de cierre de cada año"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={pktTick} width={64} />
          <Tooltip cursor={{ fill: chartColors.grid }} content={<ChartTooltip rows={(data) => [["Corte", String(data.cutoff)], ["PKT", formatPkt(data.pkt as number | null)], ["KTNO", formatCurrency(Number(data.ktno))], [data.partial ? "Ventas proyectadas" : "Ventas del año", formatCurrency(Number(data.projectedSales))]]} />} />
          <Bar dataKey="pkt" name="PKT" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {annualData.map((point) => <Cell key={point.cutoffDate} fill={chartColors.primary} fillOpacity={point.partial ? 0.45 : 1} />)}
            <LabelList dataKey="pkt" position="top" formatter={pktLabel} fill={chartColors.axis} fontSize={12} />
          </Bar>
        </BarChart></ResponsiveContainer></div> : <div className="billing-empty">Todavía no hay cierres de año cargados.</div>}
      </section>
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN MENSUAL</span><h2>PKT por mes de {year || "—"}</h2><p className="pkt-panel-note">Cada mes cerrado del año elegido, con sus ventas proyectadas a ese mes.</p></div></div>
        <div className="billing-chart-legend"><span><i className="pkt-legend-solid" /> {shownPeriod ? formatMonthName(month) : "Mes elegido"}</span><span><i className="pkt-legend-light" /> Otros meses</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : monthlyData.length ? <div className="billing-chart" role="img" aria-label={`PKT por mes de ${year}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={pktTick} width={64} />
          <Tooltip cursor={{ fill: chartColors.grid }} content={<ChartTooltip rows={(data) => [["PKT", formatPkt(data.pkt as number | null)], ["KTNO", formatCurrency(Number(data.ktno))], ["Ventas proyectadas", formatCurrency(Number(data.projectedSales))]]} />} />
          <Bar dataKey="pkt" name="PKT" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {monthlyData.map((point) => <Cell key={point.cutoffDate} fill={chartColors.primary} fillOpacity={point.month === month ? 1 : 0.45} />)}
            <LabelList dataKey="pkt" position="top" formatter={pktLabel} fill={chartColors.axis} fontSize={11} />
          </Bar>
        </BarChart></ResponsiveContainer></div> : <div className="billing-empty">No hay meses cerrados de {year} cargados.</div>}
      </section>
    </div>}

    <footer className="billing-footer"><span>{payload?.updatedAt ? `Datos de SAP cargados ${formatDateTime(payload.updatedAt)} · se actualizan todos los días a la 1:00 p. m.` : "Se actualiza todos los días a la 1:00 p. m."}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
