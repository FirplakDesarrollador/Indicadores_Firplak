"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Factory,
  Filter,
  CalendarDays,
  Gauge,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, type TooltipProps, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import TablePager from "@/components/dashboard/TablePager";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { nsPlantsNavigation } from "@/lib/dashboard/navigation";
import { dateValue, formatDate, formatDateTime, formatMonthName, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { toOptions, type FilterOption } from "@/lib/dashboard/options";
import type { NsPlantsCompliance, NsPlantsFilterOptions, NsPlantsPayload, NsPlantsRow, NsPlantsSummary } from "@/lib/ns-plantas/types";

type DashboardFilters = {
  year: string;
  month: string;
  week: string;
  day: string;
  from: string;
  to: string;
  plant: string;
  compliance: string;
  search: string;
};

const all = "Todos";
const detailPageSize = 50;

// Por defecto, el mes en curso (respuesta 7 de Manufactura). El detalle abre en las incumplidas, como la página "NS Ordenes".
function initialFiltersFor(isDetailView: boolean): DashboardFilters {
  const today = new Date();
  return {
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
    week: all,
    day: all,
    from: "",
    to: "",
    plant: all,
    compliance: isDetailView ? "incumplio" : all,
    search: "",
  };
}

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

const complianceLabels: Record<NsPlantsCompliance, string> = { cumplio: "Cumplió", incumplio: "Incumplió", enCurso: "En curso" };
const complianceOptions: FilterOption[] = (Object.keys(complianceLabels) as NsPlantsCompliance[]).map((value) => ({ value, label: complianceLabels[value] }));
const weekOptions: FilterOption[] = Array.from({ length: 54 }, (_, index) => ({ value: String(index + 1), label: `Semana ${index + 1}` }));
const dayOptions: FilterOption[] = Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
const noReasonLabel = "Sin razón de atraso";

function formatRate(value: number | null) {
  return value === null ? "—" : formatPercent(value);
}

function monthLabel(month: number) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(2026, month - 1, 1)).replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function fullDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(dateValue(value)).replace(".", "");
}

function ChartTooltip({ active, payload, label, rows }: TooltipProps<number, string> & { rows: (data: Record<string, unknown>) => Array<[string, string]> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, unknown>;
  return <div style={chartTooltipStyle} className="ns-chart-tooltip"><strong>{label}</strong>{rows(data).map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b></div>)}</div>;
}

// Estado frente a la meta: color, icono y texto (la lectura no depende solo del color).
function TargetStatus({ value, target }: { value: number | null; target: number }) {
  if (value === null) return <span className="ns-status neutral">Sin órdenes medidas</span>;
  const meets = value >= target;
  return <span className={`ns-status ${meets ? "success" : "danger"}`}>{meets ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}{meets ? "Cumple la meta" : "Bajo la meta"}</span>;
}

function ComplianceChip({ value }: { value: NsPlantsCompliance }) {
  const tone = value === "cumplio" ? "success" : value === "incumplio" ? "danger" : "neutral";
  const Icon = value === "cumplio" ? CheckCircle2 : value === "incumplio" ? TriangleAlert : Clock;
  return <span className={`ns-status ${tone}`}><Icon size={14} />{complianceLabels[value]}</span>;
}

// Incumplidas por razón: barras horizontales con el conteo y el peso sobre el total de incumplidas.
function ReasonList({ items }: { items: NsPlantsSummary["delayReasons"] }) {
  const total = items.reduce((sum, item) => sum + item.late, 0) || 1;
  if (!items.length) return <div className="billing-empty">No hay órdenes incumplidas para los filtros seleccionados.</div>;
  return <div className="billing-zone-list">{items.map((item) => {
    const name = item.name ?? noReasonLabel;
    const share = item.late / total;
    return <div className={`billing-zone-row ${item.name === null ? "ns-reason-missing" : ""}`} key={name}><div className="billing-zone-label"><span title={name}>{name}</span><strong>{formatNumber(item.late)}</strong></div><div className="billing-progress"><span style={{ width: `${Math.round(share * 100)}%` }} /></div><small>{formatPercent(share)} de las incumplidas</small></div>;
  })}</div>;
}

export default function NsPlantasDashboard({ mode = "overview" }: { mode?: "overview" | "detail" }) {
  const isDetailView = mode === "detail";
  const initialFilters = useMemo(() => initialFiltersFor(isDetailView), [isDetailView]);
  // La vista principal no muestra filas: pide una sola para no traer el detalle.
  const pageSize = isDetailView ? detailPageSize : 1;
  const [rows, setRows] = useState<NsPlantsRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterOptions, setFilterOptions] = useState<NsPlantsFilterOptions | null>(null);
  const [summary, setSummary] = useState<NsPlantsSummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<NsPlantsRow | null>(null);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      const { year, month, week, day, from, to, plant, compliance, search } = appliedFilters;
      if (year !== all) params.set("anio", year);
      if (month !== all) params.set("mes", month);
      if (week !== all) params.set("semana", week);
      if (day !== all) params.set("dia", day);
      if (from) params.set("fechaDesde", from);
      if (to) params.set("fechaHasta", to);
      if (plant !== all) params.set("planta", plant);
      if (isDetailView && compliance !== all) params.set("cumplimiento", compliance);
      if (isDetailView && search) params.set("search", search);

      const response = await fetch(`/api/ns-plantas?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<NsPlantsPayload & { error?: string }>(response, "La API del nivel de servicio");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el nivel de servicio de plantas.");
      if (!payload.summary) throw new Error("La API necesita actualizarse para devolver el nivel de servicio de plantas.");

      setRows(payload.rows);
      setAvailableYears(payload.years ?? []);
      setFilterOptions(payload.filterOptions ?? null);
      setSummary(payload.summary);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLoadedAt(payload.loadedAt ?? null);
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
  }, [appliedFilters, isDetailView, pageSize]);

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

  const years = useMemo(() => availableYears.length ? availableYears : [Number(initialFilters.year)], [availableYears, initialFilters]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const plants = useMemo(() => toOptions(filterOptions?.plants ?? []), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);

  const target = summary?.target ?? null;
  const daily = useMemo(() => (summary?.daily ?? []).map((item) => ({ ...item, label: formatDate(item.date) })), [summary]);
  const monthly = useMemo(() => (summary?.monthly ?? []).map((item) => ({ ...item, label: monthLabel(item.month) })), [summary]);
  const monthlyYear = summary?.monthly[0]?.year ?? (appliedFilters.year !== all ? Number(appliedFilters.year) : new Date().getFullYear());

  const updateDraft = (key: keyof DashboardFilters) => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => { setDraftFilters(initialFilters); setAppliedFilters(initialFilters); };
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

  const serviceLevel = summary?.serviceLevel ?? null;
  const serviceDetail = target === null ? "" : serviceLevel === null ? `Meta ${formatPercent(target)} · sin órdenes vencidas en el periodo` : `Meta ${formatPercent(target)} · ${serviceLevel >= target ? "cumple la meta" : "bajo la meta"}`;
  const percentTick = (value: unknown) => formatPercent(Number(value));

  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer" aria-label={`Orden de fabricación ${selectedRow.docNum}`}>
    <div className="billing-drawer-header"><div><span className="billing-panel-kicker">ORDEN DE FABRICACIÓN</span><h2>{selectedRow.docNum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
    <div className="ns-drawer-status"><ComplianceChip value={selectedRow.compliance} /><span>{selectedRow.status}</span></div>
    <div className="billing-drawer-total"><span>Fecha ideal de entrega</span><strong>{fullDate(selectedRow.idealDate)}</strong><small>Amortiguador de {selectedRow.buffer ?? "—"} días hábiles desde la liberación</small></div>
    <dl className="billing-detail-list">
      <div><dt>Artículo</dt><dd>{selectedRow.item || "—"} ({selectedRow.itemCode})</dd></div>
      <div><dt>Cantidad planeada</dt><dd>{formatNumber(selectedRow.plannedQty)}</dd></div>
      <div><dt>Planta</dt><dd>{selectedRow.plant}{selectedRow.family && selectedRow.family !== selectedRow.plant ? ` · familia ${selectedRow.family}` : ""}</dd></div>
      <div><dt>Creación</dt><dd>{fullDate(selectedRow.createdAt)}</dd></div>
      <div><dt>Liberación</dt><dd>{fullDate(selectedRow.releaseDate)}</dd></div>
      <div><dt>Cierre</dt><dd>{fullDate(selectedRow.closeDate)}{selectedRow.adjustedCloseDate && selectedRow.adjustedCloseDate !== selectedRow.closeDate ? ` (cuenta como ${fullDate(selectedRow.adjustedCloseDate)}: cierre en sábado)` : ""}</dd></div>
      <div><dt>Razón de retraso</dt><dd>{selectedRow.delayReason ?? (selectedRow.compliance === "incumplio" ? noReasonLabel : "—")}</dd></div>
      <div><dt>Razón de retraso 2</dt><dd>{selectedRow.delayReason2 ?? "—"}</dd></div>
      <div><dt>Tipo de orden</dt><dd>{selectedRow.orderType ?? "—"}</dd></div>
      <div><dt>Tipo de pedido</dt><dd>{selectedRow.orderSource ?? "—"}</dd></div>
      <div><dt>Bodega</dt><dd>{selectedRow.warehouse}</dd></div>
    </dl>
  </aside></>;

  return <DashboardShell navigation={nsPlantsNavigation} activeHref={isDetailView ? "/ns-plantas/detalle" : "/ns-plantas"} title={isDetailView ? "Detalle de órdenes" : "Nivel de servicio de plantas"} className="ns-plants-shell" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> MANUFACTURA</div><h1>{isDetailView ? "Detalle de órdenes de fabricación" : "Nivel de servicio de plantas"}</h1><p>{isDetailView ? "Consulta cada orden con su fecha ideal de entrega, su cierre y la razón de retraso." : "Órdenes de fabricación cerradas a tiempo frente a su fecha ideal de entrega. Solo cuentan las órdenes cuya fecha ideal ya pasó."}</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filtros</button></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className="billing-filterbar-primary">
        <label><CalendarDays size={15} /><span>Año</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}><option value={all}>Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value={all}>Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        <label><Factory size={15} /><span>Planta</span><select value={draftFilters.plant} onChange={(event) => updateDraft("plant")(event.target.value)}><option value={all}>Todas las plantas</option>{plants.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {isDetailView && <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar orden o artículo..." aria-label="Buscar orden o artículo" enterKeyHint="search" /></div>}
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Más filtros por fecha ideal de entrega</span></div><small>La semana va de domingo a sábado</small></div>
        <FilterSelect label="Semana" value={draftFilters.week} emptyValue={all} emptyLabel="Todas las semanas" options={weekOptions} onChange={updateDraft("week")} />
        <FilterSelect label="Día del mes" value={draftFilters.day} emptyValue={all} emptyLabel="Todos los días" options={dayOptions} onChange={updateDraft("day")} />
        <label className="billing-advanced-filter"><span>Desde</span><input type="date" value={draftFilters.from} onChange={(event) => updateDraft("from")(event.target.value)} /></label>
        <label className="billing-advanced-filter"><span>Hasta</span><input type="date" value={draftFilters.to} onChange={(event) => updateDraft("to")(event.target.value)} /></label>
        {isDetailView && <FilterSelect label="Cumplimiento" value={draftFilters.compliance} emptyValue={all} emptyLabel="Todas las órdenes" options={complianceOptions} onChange={updateDraft("compliance")} />}
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}

    {!isDetailView && <>
    <div className="ns-metrics-grid">{loading ? Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />) : <>
      <MetricCard label="Nivel de servicio" value={formatRate(serviceLevel)} detail={serviceDetail} icon={Gauge} />
      <MetricCard label="Órdenes medidas" value={formatNumber(summary?.measured ?? 0)} detail={`${formatNumber(summary?.onTime ?? 0)} cumplidas · fecha ideal anterior a hoy`} icon={CheckCircle2} />
      <MetricCard label="Incumplidas" value={formatNumber(summary?.late ?? 0)} detail="Cerradas después de su fecha ideal o vencidas sin cerrar" icon={TriangleAlert} />
      <MetricCard label="Aún en plazo" value={formatNumber((summary?.inProgress ?? 0) + (summary?.closedEarly ?? 0))} detail={`${formatNumber(summary?.inProgress ?? 0)} abiertas · ${formatNumber(summary?.closedEarly ?? 0)} ya cerradas; se miden al vencer su plazo`} icon={Clock} />
    </>}</div>

    <div className="ns-two-column-grid">
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN DIARIA</span><h2>Nivel de servicio por fecha ideal</h2></div></div>
        <div className="billing-chart-legend"><span><i className="ns-legend-solid" /> Nivel de servicio</span><span><i className="ns-legend-target" /> Meta {target === null ? "" : formatPercent(target)}</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : daily.length ? <div className="billing-chart" role="img" aria-label="Nivel de servicio por día de la fecha ideal de entrega"><ResponsiveContainer width="100%" height="100%"><LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={16} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={percentTick} domain={[0, 1]} width={64} />
          <Tooltip cursor={{ stroke: chartColors.grid }} content={<ChartTooltip rows={(data) => [["Nivel de servicio", formatRate(data.serviceLevel as number | null)], ["Cumplidas", formatNumber(Number(data.onTime))], ["Medidas", formatNumber(Number(data.measured))]]} />} />
          {target !== null && <ReferenceLine y={target} stroke={chartColors.axis} strokeDasharray="2 4" strokeWidth={2} />}
          <Line type="linear" dataKey="serviceLevel" name="Nivel de servicio" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }} isAnimationActive={false} connectNulls={false} />
        </LineChart></ResponsiveContainer></div> : <div className="billing-empty">No hay órdenes con fecha ideal vencida para los filtros seleccionados.</div>}
      </section>
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN MENSUAL</span><h2>Nivel de servicio por mes de {monthlyYear}</h2><p className="ns-panel-note">Siempre el año completo: solo responde al año y a la planta.</p></div></div>
        <div className="billing-chart-legend"><span><i className="ns-legend-bar" /> Nivel de servicio</span><span><i className="ns-legend-target" /> Meta {target === null ? "" : formatPercent(target)}</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : monthly.length ? <div className="billing-chart" role="img" aria-label={`Nivel de servicio por mes de ${monthlyYear}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={percentTick} domain={[0, 1]} width={64} />
          <Tooltip cursor={{ fill: chartColors.grid }} content={<ChartTooltip rows={(data) => [["Nivel de servicio", formatRate(data.serviceLevel as number | null)], ["Cumplidas", formatNumber(Number(data.onTime))], ["Incumplidas", formatNumber(Number(data.late))], ["Medidas", formatNumber(Number(data.measured))]]} />} />
          {target !== null && <ReferenceLine y={target} stroke={chartColors.axis} strokeDasharray="2 4" strokeWidth={2} />}
          <Bar dataKey="serviceLevel" name="Nivel de servicio" fill={chartColors.primary} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        </BarChart></ResponsiveContainer></div> : <div className="billing-empty">No hay órdenes medidas en {monthlyYear} para los filtros seleccionados.</div>}
      </section>
    </div>

    <div className="ns-two-column-grid">
      <section className="billing-panel ns-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">PLANTAS</span><h2>Nivel de servicio por planta</h2><p>Meta de {target === null ? "—" : formatPercent(target)} para cada planta.</p></div></div>
        <div className="billing-table-scroll"><table className="billing-data-table ns-plant-table"><thead><tr><th>Planta</th><th className="align-right">Medidas</th><th className="align-right">Incumplidas</th><th className="align-right">Nivel</th><th>Frente a la meta</th></tr></thead><tbody>
          {loading ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={5}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : summary?.plants.length ? summary.plants.map((plant) => <tr key={plant.name}>
            <td><strong>{plant.name}</strong></td>
            <td className="align-right">{formatNumber(plant.measured)}</td>
            <td className="align-right">{formatNumber(plant.late)}</td>
            <td className="align-right number-cell">{formatRate(plant.serviceLevel)}</td>
            <td>{target !== null && <TargetStatus value={plant.serviceLevel} target={target} />}</td>
          </tr>) : <tr><td colSpan={5} className="billing-table-state"><strong>Sin órdenes medidas para los filtros seleccionados</strong></td></tr>}
        </tbody></table></div>
      </section>
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">CAUSAS</span><h2>Incumplidas por razón de retraso</h2><p className="ns-panel-note">La razón se registra en SAP; &quot;{noReasonLabel}&quot; son las incumplidas que no la tienen.</p></div></div>
        {loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <ReasonList items={summary?.delayReasons ?? []} />}
      </section>
    </div>
    </>}

    {isDetailView && <section className="billing-panel ns-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE</span><h2>Órdenes de fabricación</h2><p>{formatNumber(pagination.total)} órdenes encontradas · página {pagination.page} de {pagination.totalPages}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha ideal</th><th>Orden</th><th>Artículo</th><th>Planta</th><th>Liberación</th><th>Cierre</th><th>Cumplimiento</th><th>Razón de retraso</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={9}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}>
          <td><span className="billing-date-cell">{row.idealDate ? formatDate(row.idealDate) : "—"}</span><small>{row.idealDate ? dateValue(row.idealDate).getFullYear() : ""}</small></td>
          <td><strong className="billing-docnum">{row.docNum}</strong><small>{row.itemCode}</small></td>
          <td><span className="billing-group-cell">{row.item || "—"}</span><small>{formatNumber(row.plannedQty)} unidades</small></td>
          <td><span className="billing-group-cell">{row.plant}</span><small>{row.family ?? ""}</small></td>
          <td>{formatDate(row.releaseDate)}</td>
          <td>{row.adjustedCloseDate ? formatDate(row.adjustedCloseDate) : <span className="ns-muted">Abierta</span>}</td>
          <td><ComplianceChip value={row.compliance} /></td>
          <td><span className="billing-group-cell">{row.delayReason ?? (row.compliance === "incumplio" ? noReasonLabel : "—")}</span></td>
          <td><ChevronRight size={16} className="billing-row-chevron" /></td>
        </tr>) : <tr><td colSpan={9} className="billing-table-state"><Search size={22} /><strong>No encontramos órdenes</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}
      </tbody></table></div>
      <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="órdenes" onPageChange={changePage} />
    </section>}

    <footer className="billing-footer"><span>{loadedAt ? `Datos de SAP cargados ${formatDateTime(loadedAt)} · se actualizan a las 6:00 y a las 17:00` : "Se actualiza a las 6:00 y a las 17:00"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
