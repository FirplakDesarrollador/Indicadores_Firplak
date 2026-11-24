"use client";

import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Database, Filter, MinusCircle, RefreshCw, Search, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, type TooltipProps, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import TablePager from "@/components/dashboard/TablePager";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { releaseNavigation } from "@/lib/dashboard/navigation";
import { dateValue, formatDate, formatDateTime, formatMonthName, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { toOptions, type FilterOption } from "@/lib/dashboard/options";
import type { ReleaseCompliance, ReleaseFilterOptions, ReleasePayload, ReleaseRow, ReleaseSummary, ReleaseView } from "@/lib/liberacion/types";

// Las 5 páginas del Power BI "PBI liberacion act" (llm-wiki/bi/liberacion.md, secciones 1 y 5).
export type ReleaseMode = "cumplimiento" | "acumulado" | "razones" | "razonesDia" | "control";

type PageConfig = { href: string; title: string; heading: string; description: string; view: ReleaseView | null };

const pages: Record<ReleaseMode, PageConfig> = {
  cumplimiento: { href: "/liberacion", title: "Cumplimiento liberación", heading: "Indicador de liberación", description: "Órdenes de producción liberadas a tiempo frente a su fecha recomendada de liberación, por día.", view: null },
  acumulado: { href: "/liberacion/acumulado", title: "Cumplimiento acumulado", heading: "Indicador de liberación acumulado", description: "El mismo indicador agrupado por año, trimestre o mes del periodo elegido.", view: null },
  razones: { href: "/liberacion/razones", title: "Razones de incumplimiento", heading: "% razones de incumplimiento", description: "Peso de cada razón registrada por Planeación entre las órdenes que no se liberaron a tiempo.", view: null },
  razonesDia: { href: "/liberacion/razones-dia", title: "Razones por día", heading: "Razones por día", description: "Órdenes con razón registrada distinta de CUMPLE y el peso de cada razón entre las que no cumplen.", view: "razones" },
  control: { href: "/liberacion/control", title: "Control", heading: "Control", description: "Órdenes que no se liberaron a tiempo y todavía no tienen razón registrada por Planeación.", view: "control" },
};

type DashboardFilters = { year: string; month: string; day: string; from: string; to: string; reason: string; search: string };

const all = "Todos";
const tablePageSize = 50;
const dayOptions: FilterOption[] = Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
// Las etiquetas del Power BI: dos decimales en el cumplimiento y ninguno en el Pareto.
const percentTwo = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentWhole = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });
const complianceLabels: Record<ReleaseCompliance, string> = { ok: "Cumple", no: "No cumple", sinLiberar: "Sin liberar", noMedir: "No medir" };
const typeLabels: Record<string, string> = { O: "STANDARD", S: "STOCK" };

// Por defecto, el mes en curso, como los demás informes del portal.
function initialFilters(): DashboardFilters {
  const today = new Date();
  return { year: String(today.getFullYear()), month: String(today.getMonth() + 1), day: all, from: "", to: "", reason: all, search: "" };
}

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

function formatRate(value: number | null) {
  return value === null ? "—" : formatPercent(value);
}

function fullDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(dateValue(value)).replace(".", "");
}

function shortMonth(month: number) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(2026, month - 1, 1)).replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ───────────── Gráfico de columnas 100 % (páginas Cumplimiento y Acum) ───────────── */

type SharePoint = { key: string; label: string; ok: number; no: number };

function ShareTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as SharePoint & { okShare: number };
  return <div style={chartTooltipStyle} className="release-chart-tooltip"><strong>{label}</strong>
    <div><span>Cumplimiento</span><b>{percentTwo.format(data.okShare)}</b></div>
    <div><span>Cumplen</span><b>{formatNumber(data.ok)}</b></div>
    <div><span>No cumplen</span><b>{formatNumber(data.no)}</b></div>
  </div>;
}

// Etiqueta dentro de cada tramo, como "Porcentaje del total" del Power BI; se oculta si la columna es angosta.
function ShareLabel(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) {
  const x = Number(props.x), y = Number(props.y), width = Number(props.width), height = Number(props.height), value = Number(props.value);
  if (!value || width < 46 || height < 18) return null;
  return <text x={x + width / 2} y={y + height / 2} fill={chartColors.surface} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{percentTwo.format(value)}</text>;
}

function ShareChart({ points, target, ariaLabel, axisLabel }: { points: SharePoint[]; target: number | null; ariaLabel: string; axisLabel: string }) {
  const data = points.map((point) => {
    const measured = point.ok + point.no;
    return { ...point, okShare: measured ? point.ok / measured : 0, noShare: measured ? point.no / measured : 0 };
  });
  // Con muchas columnas, el gráfico se desplaza en horizontal en lugar de comprimirlas.
  const minWidth = Math.max(data.length * 44, 320);
  // La etiqueta de la meta va a la derecha del gráfico, fuera de las columnas.
  return <div className="release-chart-scroll"><div className="release-chart release-chart-share" style={{ minWidth }} role="img" aria-label={ariaLabel}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 16, right: 84, left: 12, bottom: 8 }} barCategoryGap="12%">
    <CartesianGrid vertical={false} stroke={chartColors.grid} />
    <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fill: chartColors.axis, fontSize: 12 }} label={{ value: axisLabel, position: "insideBottom", offset: 0, fill: chartColors.axis, fontSize: 12 }} height={52} />
    <YAxis hide domain={[0, 1]} />
    <Tooltip cursor={{ fill: chartColors.grid }} content={<ShareTooltip />} />
    <Bar dataKey="okShare" name="Cumple" stackId="share" fill={chartColors.primary} maxBarSize={240} isAnimationActive={false}><LabelList dataKey="okShare" content={ShareLabel} /></Bar>
    <Bar dataKey="noShare" name="No cumple" stackId="share" fill={chartColors.secondary} maxBarSize={240} isAnimationActive={false}><LabelList dataKey="noShare" content={ShareLabel} /></Bar>
    {target !== null && <ReferenceLine y={target} stroke={chartColors.danger} strokeDasharray="4 4" strokeWidth={2} ifOverflow="extendDomain" label={{ value: `META: ${percentWhole.format(target)}`, position: "right", fill: chartColors.danger, fontSize: 12, fontWeight: 600 }} />}
  </BarChart></ResponsiveContainer></div></div>;
}

function ShareLegend() {
  return <div className="billing-chart-legend"><span><i className="release-legend-ok" /> Cumple (OK)</span><span><i className="release-legend-no" /> No cumple (NO)</span><span><i className="release-legend-target" /> Meta</span></div>;
}

/* ───────────── Pareto de razones (páginas Razones y Razones Día) ───────────── */

type ParetoPoint = { name: string; base: number; share: number; orders: number; total?: boolean };

function ParetoTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ParetoPoint;
  return <div style={chartTooltipStyle} className="release-chart-tooltip"><strong>{data.name}</strong>
    <div><span>{data.total ? "Total" : "Peso"}</span><b>{percentTwo.format(data.share)}</b></div>
    <div><span>Órdenes</span><b>{formatNumber(data.orders)}</b></div>
    {!data.total && <div><span>Acumulado</span><b>{percentTwo.format(data.base + data.share)}</b></div>}
  </div>;
}

function ParetoLabel(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) {
  const x = Number(props.x), y = Number(props.y), width = Number(props.width), height = Number(props.height), value = Number(props.value);
  if (!value || height < 16 || width < 26) return null;
  return <text x={x + width / 2} y={y + height / 2} fill={chartColors.surface} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>{percentWhole.format(value)}</text>;
}

function ReasonTick({ x, y, payload, compact = false }: { x?: number | string; y?: number | string; payload?: { value: string }; compact?: boolean }) {
  const text = payload?.value ?? "";
  const limit = compact ? 16 : 22;
  const short = text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  return <g transform={`translate(${Number(x)},${Number(y)})`}><title>{text}</title><text x={0} y={0} dy={10} textAnchor="end" transform={`rotate(${compact ? -55 : -35})`} fill={chartColors.axis} fontSize={compact ? 10 : 11}>{short}</text></g>;
}

function ParetoChart({ reasons, compact = false }: { reasons: ReleaseSummary["reasons"]; compact?: boolean }) {
  let cumulative = 0;
  const totalOrders = reasons.reduce((sum, item) => sum + item.orders, 0);
  const data: ParetoPoint[] = reasons.map((item) => {
    const share = item.share ?? 0;
    const point = { name: item.name, base: cumulative, share, orders: item.orders };
    cumulative += share;
    return point;
  });
  data.push({ name: "Total", base: 0, share: totalOrders ? 1 : 0, orders: totalOrders, total: true });
  // Compacto (Razones por día): cabe en medio ancho sin desplazarse; a todo el ancho, columnas más holgadas.
  const minWidth = Math.max(data.length * (compact ? 30 : 64), 320);
  return <div className="release-chart-scroll"><div className={`release-chart release-chart-pareto ${compact ? "compact" : ""}`} style={{ minWidth }} role="img" aria-label="Pareto de razones de incumplimiento"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barCategoryGap="14%">
    <CartesianGrid vertical={false} stroke={chartColors.grid} />
    <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={118} tick={<ReasonTick compact={compact} />} />
    <YAxis axisLine={false} tickLine={false} domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(value: number) => percentWhole.format(value)} tick={{ fill: chartColors.axis, fontSize: 12 }} width={48} />
    <Tooltip cursor={{ fill: chartColors.grid }} content={<ParetoTooltip />} />
    <Bar dataKey="base" stackId="pareto" fill="transparent" isAnimationActive={false} />
    <Bar dataKey="share" stackId="pareto" isAnimationActive={false}>
      {data.map((point) => <Cell key={point.name} fill={point.total ? chartColors.primary : chartColors.secondary} />)}
      <LabelList dataKey="share" content={ParetoLabel} />
    </Bar>
    <ReferenceLine y={0.8} stroke={chartColors.danger} strokeDasharray="4 4" strokeWidth={2} label={{ value: "PARETO: 80 %", position: "insideTopLeft", fill: chartColors.danger, fontSize: 12, fontWeight: 600 }} />
  </BarChart></ResponsiveContainer></div></div>;
}

/* ───────────── Piezas de tabla y detalle ───────────── */

function ComplianceChip({ value }: { value: ReleaseCompliance }) {
  const tone = value === "ok" ? "success" : value === "no" ? "danger" : "neutral";
  const Icon = value === "ok" ? CheckCircle2 : value === "no" ? TriangleAlert : value === "sinLiberar" ? Clock : MinusCircle;
  return <span className={`release-status ${tone}`}><Icon size={14} />{complianceLabels[value]}</span>;
}

function OrderType({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  return <span title={typeLabels[value] ?? value}>{value}</span>;
}

function SkeletonRows({ columns }: { columns: number }) {
  return <>{Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={columns}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>)}</>;
}

function rowHandlers(row: ReleaseRow, select: (row: ReleaseRow) => void) {
  return {
    tabIndex: 0,
    onClick: () => select(row),
    onKeyDown: (event: ReactKeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(row); } },
  };
}

/* ───────────── Acumulado: niveles Año › Trimestre › Mes ───────────── */

type Level = "year" | "quarter" | "month";
const levelLabels: Record<Level, string> = { year: "Año", quarter: "Trimestre", month: "Mes" };

// Agrupa la serie diaria del periodo (ya filtrada en SQL), como la jerarquía del Power BI responde al segmentador.
function groupDaily(daily: ReleaseSummary["daily"], level: Level): SharePoint[] {
  const groups = new Map<string, SharePoint>();
  for (const item of daily) {
    const year = Number(item.date.slice(0, 4));
    const month = Number(item.date.slice(5, 7));
    const quarter = Math.ceil(month / 3);
    const key = level === "year" ? String(year) : level === "quarter" ? `${year}-${quarter}` : `${year}-${String(month).padStart(2, "0")}`;
    const label = level === "year" ? String(year) : level === "quarter" ? `T${quarter} ${year}` : `${shortMonth(month)} ${year}`;
    const group = groups.get(key) ?? { key, label, ok: 0, no: 0 };
    group.ok += item.ok;
    group.no += item.no;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/* ───────────── Dashboard ───────────── */

export default function LiberacionDashboard({ mode }: { mode: ReleaseMode }) {
  const page = pages[mode];
  const hasTable = page.view !== null;
  // Las páginas de gráficos no muestran filas: piden una sola.
  const pageSize = hasTable ? tablePageSize : 1;
  const defaults = useMemo(() => initialFilters(), []);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterOptions, setFilterOptions] = useState<ReleaseFilterOptions | null>(null);
  const [summary, setSummary] = useState<ReleaseSummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [reasonsSyncedAt, setReasonsSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(defaults);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(defaults);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReleaseRow | null>(null);
  const [level, setLevel] = useState<Level>("year");

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      const { year, month, day, from, to, reason, search } = appliedFilters;
      if (year !== all) params.set("anio", year);
      if (month !== all) params.set("mes", month);
      if (day !== all) params.set("dia", day);
      if (from) params.set("fechaDesde", from);
      if (to) params.set("fechaHasta", to);
      if (page.view) params.set("vista", page.view);
      if (mode === "razonesDia" && reason !== all) params.set("razon", reason);
      if (hasTable && search) params.set("search", search);

      const response = await fetch(`/api/liberacion?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<ReleasePayload & { error?: string }>(response, "La API de liberación");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el indicador de liberación.");
      if (!payload.summary) throw new Error("La API necesita actualizarse para devolver el indicador de liberación.");

      setRows(payload.rows);
      setAvailableYears(payload.years ?? []);
      setFilterOptions(payload.filterOptions ?? null);
      setSummary(payload.summary);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLoadedAt(payload.loadedAt ?? null);
      setReasonsSyncedAt(payload.reasonsSyncedAt ?? null);
      setError("");
    } catch (loadError) {
      setRows([]);
      setFilterOptions(null);
      setSummary(null);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, hasTable, mode, page.view, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!selectedRow) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedRow(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRow]);

  const years = useMemo(() => availableYears.length ? availableYears : [Number(defaults.year)], [availableYears, defaults]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const reasonOptions = useMemo(() => toOptions((filterOptions?.reasons ?? []).filter((reason) => reason !== "CUMPLE")), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);
  const target = summary?.target ?? null;
  const dailyPoints = useMemo<SharePoint[]>(() => (summary?.daily ?? []).map((item) => ({ key: item.date, label: formatDate(item.date), ok: item.ok, no: item.no })), [summary]);
  const groupedPoints = useMemo(() => groupDaily(summary?.daily ?? [], level), [summary, level]);

  const updateDraft = (key: keyof DashboardFilters) => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => { setDraftFilters(defaults); setAppliedFilters(defaults); };
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = normalizeFilters(draftFilters);
    setDraftFilters(nextFilters);
    if (!sameFilters(nextFilters, appliedFilters)) setAppliedFilters(nextFilters);
  };
  const changePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > pagination.totalPages || targetPage === pagination.page) return;
    setPagination((current) => ({ ...current, page: targetPage }));
    void loadData(targetPage);
  };

  const summaryStrip = <div className="release-summary" aria-live="polite">{loading || !summary ? <span className="billing-skeleton release-summary-skeleton" /> : <>
    <div><span>Cumplimiento del periodo</span><strong>{formatRate(summary.compliance)}</strong><small>Meta {formatPercent(summary.target)}</small></div>
    <div><span>Cumplen</span><strong>{formatNumber(summary.ok)}</strong><small>OK</small></div>
    <div><span>No cumplen</span><strong>{formatNumber(summary.no)}</strong><small>{summary.withoutReason ? <Link href="/liberacion/control">{formatNumber(summary.withoutReason)} sin razón registrada</Link> : "Todas con razón registrada"}</small></div>
    <div><span>Fuera del indicador</span><strong>{formatNumber(summary.notReleased + summary.notMeasured)}</strong><small>{formatNumber(summary.notReleased)} sin liberar · {formatNumber(summary.notMeasured)} no medir</small></div>
  </>}</div>;

  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer" aria-label={`Orden de producción ${selectedRow.orderNumber}`}>
    <div className="billing-drawer-header"><div><span className="billing-panel-kicker">ORDEN DE PRODUCCIÓN</span><h2>{selectedRow.orderNumber}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
    <div className="release-drawer-status"><ComplianceChip value={selectedRow.compliance} /><span>{selectedRow.status ?? ""}</span></div>
    <div className="billing-drawer-total"><span>Fecha recomendada de liberación</span><strong>{fullDate(selectedRow.recommendedReleaseDate)}</strong><small>{selectedRow.actualReleaseDate ? `Liberada el ${fullDate(selectedRow.actualReleaseDate)}` : "Sin liberar"}</small></div>
    <dl className="billing-detail-list">
      <div><dt>SKU</dt><dd>{selectedRow.skuDescription ?? "—"}{selectedRow.sku ? ` (${selectedRow.sku})` : ""}</dd></div>
      <div><dt>Tipo</dt><dd>{selectedRow.type ? `${selectedRow.type} · ${typeLabels[selectedRow.type] ?? selectedRow.type}` : "—"}</dd></div>
      <div><dt>Línea</dt><dd>{selectedRow.line ?? "—"}</dd></div>
      <div><dt>Familia de producción</dt><dd>{selectedRow.family ?? "—"}</dd></div>
      <div><dt>Fecha de contabilización</dt><dd>{fullDate(selectedRow.postingDate)}</dd></div>
      <div><dt>Fecha prometida de entrega del ítem</dt><dd>{fullDate(selectedRow.promisedItemDate)}</dd></div>
      <div><dt>Observación de Planeación</dt><dd>{selectedRow.reason ?? "Sin razón registrada"}{selectedRow.reasonOriginal && selectedRow.reasonOriginal !== selectedRow.reason ? ` (registrada como «${selectedRow.reasonOriginal}»)` : ""}</dd></div>
      <div><dt>Comentario</dt><dd>{selectedRow.reasonComment ?? "—"}</dd></div>
      <div><dt>Cambio de fecha</dt><dd>{selectedRow.dateChanged ? "Sí, se reprogramó la orden" : "No"}</dd></div>
    </dl>
  </aside></>;

  const emptyRows = (columns: number, text: string) => <tr><td colSpan={columns} className="billing-table-state"><Search size={22} /><strong>{text}</strong><span>Prueba cambiando el periodo o el texto de búsqueda.</span></td></tr>;

  const reasonsTable = <section className="billing-panel release-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">ÓRDENES</span><h2>Órdenes con razón registrada</h2><p>{formatNumber(pagination.total)} órdenes · razón distinta de CUMPLE, ordenadas por descripción</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
    <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Código OP</th><th>Descripción de SKU</th><th>Observación de Planeación</th><th>Fecha recomendada</th><th>Tipo</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
      {loading ? <SkeletonRows columns={6} /> : rows.length ? rows.map((row) => <tr key={row.orderNumber} {...rowHandlers(row, setSelectedRow)}>
        <td><strong className="billing-docnum">{row.orderNumber}</strong></td>
        <td><span className="billing-group-cell">{row.skuDescription ?? "—"}</span></td>
        <td><span className="billing-group-cell">{row.reason}</span></td>
        <td>{fullDate(row.recommendedReleaseDate)}</td>
        <td><OrderType value={row.type} /></td>
        <td><ChevronRight size={16} className="billing-row-chevron" /></td>
      </tr>) : emptyRows(6, "No hay órdenes con razón registrada")}
    </tbody></table></div>
    <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="órdenes" onPageChange={changePage} />
  </section>;

  const controlTable = <section className="billing-panel release-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">PENDIENTES DE PLANEACIÓN</span><h2>Órdenes que no cumplen y no tienen razón</h2><p>{formatNumber(pagination.total)} órdenes · de la fecha recomendada más antigua a la más reciente</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
    <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Código OP</th><th>Descripción de SKU</th><th>Tipo</th><th>Línea</th><th>Fecha de contabilización</th><th>Fecha recomendada</th><th>Fecha real de liberación</th><th>Fecha prometida del ítem</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
      {loading ? <SkeletonRows columns={9} /> : rows.length ? rows.map((row) => <tr key={row.orderNumber} {...rowHandlers(row, setSelectedRow)}>
        <td><strong className="billing-docnum">{row.orderNumber}</strong></td>
        <td><span className="billing-group-cell">{row.skuDescription ?? "—"}</span></td>
        <td><OrderType value={row.type} /></td>
        <td>{row.line ?? "—"}</td>
        <td>{fullDate(row.postingDate)}</td>
        <td>{fullDate(row.recommendedReleaseDate)}</td>
        <td>{row.actualReleaseDate ? fullDate(row.actualReleaseDate) : <span className="release-muted">Sin liberar</span>}</td>
        <td>{fullDate(row.promisedItemDate)}</td>
        <td><ChevronRight size={16} className="billing-row-chevron" /></td>
      </tr>) : <tr><td colSpan={9} className="billing-table-state"><CheckCircle2 size={22} /><strong>No hay órdenes pendientes de razón</strong><span>Todas las órdenes que no cumplen en este periodo tienen razón registrada.</span></td></tr>}
    </tbody></table></div>
    <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="órdenes" onPageChange={changePage} />
  </section>;

  const chartSkeleton = <div className="billing-chart-skeleton release-chart-skeleton"><span /><span /><span /></div>;
  const emptyChart = (text: string) => <div className="billing-empty">{text}</div>;

  return <DashboardShell navigation={releaseNavigation} activeHref={page.href} title={page.title} className="release-shell" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> LOGÍSTICA</div><h1>{page.heading}</h1><p>{page.description}</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filtros</button></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className="billing-filterbar-primary">
        <label><CalendarDays size={15} /><span>Año</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}><option value={all}>Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value={all}>Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        <label><span>Día</span><select value={draftFilters.day} onChange={(event) => updateDraft("day")(event.target.value)}><option value={all}>Todos los días</option>{dayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {hasTable && <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar OP o SKU..." aria-label="Buscar orden o SKU" enterKeyHint="search" /></div>}
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Más filtros por fecha recomendada de liberación</span></div></div>
        <label className="billing-advanced-filter"><span>Desde</span><input type="date" value={draftFilters.from} onChange={(event) => updateDraft("from")(event.target.value)} /></label>
        <label className="billing-advanced-filter"><span>Hasta</span><input type="date" value={draftFilters.to} onChange={(event) => updateDraft("to")(event.target.value)} /></label>
        {mode === "razonesDia" && <FilterSelect label="Observación de Planeación" value={draftFilters.reason} emptyValue={all} emptyLabel="Todas las razones" options={reasonOptions} onChange={updateDraft("reason")} />}
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}

    {(mode === "cumplimiento" || mode === "acumulado") && summaryStrip}

    {mode === "cumplimiento" && <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">POR DÍA</span><h2>Indicador de liberación</h2><p className="release-panel-note">Una columna por fecha recomendada de liberación. Solo cuentan las órdenes que cumplen (OK) o no cumplen (NO).</p></div></div>
      <ShareLegend />
      {loading ? chartSkeleton : dailyPoints.length ? <ShareChart points={dailyPoints} target={target} axisLabel="Fecha" ariaLabel="Cumplimiento de liberación por día" /> : emptyChart("No hay órdenes medidas para el periodo seleccionado.")}
    </section>}

    {mode === "acumulado" && <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">ACUMULADO</span><h2>Indicador de liberación por {levelLabels[level].toLowerCase()}</h2><p className="release-panel-note">Responde al periodo elegido: con un mes elegido, cada nivel muestra solo ese mes.</p></div>
        <div className="release-level-switch" role="group" aria-label="Nivel del acumulado">{(Object.keys(levelLabels) as Level[]).map((value) => <button key={value} type="button" className={level === value ? "active" : ""} aria-pressed={level === value} onClick={() => setLevel(value)}>{levelLabels[value]}</button>)}</div></div>
      <ShareLegend />
      {loading ? chartSkeleton : groupedPoints.length ? <ShareChart points={groupedPoints} target={target} axisLabel={levelLabels[level]} ariaLabel={`Cumplimiento de liberación por ${levelLabels[level].toLowerCase()}`} /> : emptyChart("No hay órdenes medidas para el periodo seleccionado.")}
    </section>}

    {mode === "razones" && <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">PARETO</span><h2>% razones de incumplimiento</h2><p className="release-panel-note">Razones de las órdenes que no cumplen, de mayor a menor. La línea marca el 80 % del Pareto.</p></div></div>
      {loading ? chartSkeleton : summary?.reasons.length ? <ParetoChart reasons={summary.reasons} /> : emptyChart("No hay órdenes que no cumplan con razón registrada en el periodo seleccionado.")}
    </section>}

    {mode === "razonesDia" && <div className="release-two-column">
      {reasonsTable}
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">PARETO</span><h2>% razones de incumplimiento</h2><p className="release-panel-note">Razones de las órdenes que no cumplen en el periodo.</p></div></div>
        {loading ? chartSkeleton : summary?.reasons.length ? <ParetoChart reasons={summary.reasons} compact /> : emptyChart("No hay órdenes que no cumplan con razón registrada en el periodo seleccionado.")}
      </section>
    </div>}

    {mode === "control" && controlTable}

    <footer className="billing-footer"><span>{loadedAt ? `Órdenes de SAP cargadas ${formatDateTime(loadedAt)} · lunes a viernes a las 17:15` : "Órdenes de SAP: lunes a viernes a las 17:15"}{reasonsSyncedAt ? ` · razones de Planeación recibidas ${formatDateTime(reasonsSyncedAt)}` : ""}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
