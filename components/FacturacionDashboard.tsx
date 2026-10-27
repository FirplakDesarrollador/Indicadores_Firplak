"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Database,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import TablePager from "@/components/dashboard/TablePager";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { billingNavigation } from "@/lib/dashboard/navigation";
import {
  dateValue,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonthName,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard/format";
import { type FilterOption, toOptions, uniqueSorted } from "@/lib/dashboard/options";
import type {
  BillingFilterOptions,
  BillingPayload,
  BillingRow,
  BillingSummary,
  DeliveryPayload,
  DeliverySummary,
} from "@/lib/facturacion/types";

type View = "Todos" | "Facturación" | "Notas crédito";

const emptySummary: BillingSummary = { invoiced: 0, creditNote: 0, net: 0, daily: [], zones: [] };
const emptyDeliverySummary: DeliverySummary = {
  deliveredQuantity: 0,
  invoicedQuantity: 0,
  valueWithoutVat: 0,
  daily: [],
  monthly: [],
  statuses: [],
};
const monthlyTargets: Record<string, { national: number; firplak: number }> = {
  "2026-01": { national: 375_000_000, firplak: 503_000_000 },
  "2026-02": { national: 375_000_000, firplak: 503_000_000 },
  "2026-03": { national: 375_000_000, firplak: 503_000_000 },
  "2026-04": { national: 375_000_000, firplak: 575_000_000 },
};
const initialPeriod = new Date();
const initialYear = String(initialPeriod.getFullYear());
const initialMonth = String(initialPeriod.getMonth() + 1);

type DashboardFilters = {
  year: string;
  month: string;
  search: string;
  customer: string;
  group: string;
  channel: string;
  zone: string;
  city: string;
};

const initialFilters: DashboardFilters = {
  year: initialYear,
  month: initialMonth,
  search: "",
  customer: "Todos",
  group: "Todos",
  channel: "Todos",
  zone: "Todas",
  city: "Todas",
};

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

type FacturacionDashboardProps = {
  mode?: "overview" | "detail";
};

export default function FacturacionDashboard({ mode = "overview" }: FacturacionDashboardProps) {
  const isDetailView = mode === "detail";
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterOptions, setFilterOptions] = useState<BillingFilterOptions | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("Todos");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllDailySummary, setShowAllDailySummary] = useState(false);
  const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: "50" });
      const { year, month, zone, channel, city, customer, group, search } = appliedFilters;
      if (year !== "Todos") params.set("anio", year);
      if (month !== "Todos") params.set("mes", month);
      if (zone !== "Todas") params.set("zona", zone);
      if (channel !== "Todos") params.set("mercado", channel);
      if (city !== "Todas") params.set("ciudad", city);
      if (customer !== "Todos") params.set("cliente", customer);
      if (group !== "Todos") params.set("grupoCliente", group);
      if (search) params.set("search", search);

      const [billingResponse, deliveryResponse] = await Promise.all([
        fetch(`/api/facturacion-diaria?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/entregas?${params.toString()}`, { cache: "no-store" }),
      ]);
      const [payload, deliveryPayload] = await Promise.all([
        readJsonPayload<BillingPayload & { error?: string }>(billingResponse, "La API de facturación"),
        readJsonPayload<DeliveryPayload & { error?: string }>(deliveryResponse, "La API de entregas"),
      ]);
      if (!billingResponse.ok) throw new Error(payload.error ?? "No fue posible cargar la información de facturación.");
      if (!deliveryResponse.ok) throw new Error(deliveryPayload.error ?? "No fue posible cargar la información de entregas.");
      if (!payload.summary || !deliveryPayload.summary) throw new Error("La API necesita actualizarse para devolver los resúmenes de facturación y entregas.");

      setRows(payload.rows);
      setAvailableYears(payload.years ?? []);
      setFilterOptions(payload.filterOptions ?? null);
      setSummary(payload.summary);
      setDeliverySummary(deliveryPayload.summary);
      setPagination(payload.pagination ?? { page: targetPage, pageSize: 50, total: payload.rows.length, totalPages: 1 });
      setLastUpdated(payload.updatedAt);
      setError("");
    } catch (loadError) {
      setRows([]);
      setAvailableYears([]);
      setFilterOptions(null);
      setSummary(null);
      setDeliverySummary(null);
      setPagination({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [appliedFilters]);

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

  const years = useMemo(() => availableYears.length ? availableYears : Array.from(new Set(rows.map((row) => dateValue(row.date).getFullYear()))).sort((a, b) => b - a), [availableYears, rows]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  // Las opciones vienen del catálogo de la API para todo el periodo; si la API aún no lo envía, se derivan de la página visible.
  const customers = useMemo<FilterOption[]>(() => filterOptions
    ? filterOptions.customers.map((customer) => ({ value: customer.code, label: customer.name }))
    : toOptions(uniqueSorted(rows.map((row) => row.customer))), [filterOptions, rows]);
  const groups = useMemo(() => toOptions(filterOptions?.customerGroups ?? uniqueSorted(rows.map((row) => row.customerGroup))), [filterOptions, rows]);
  const markets = useMemo(() => toOptions(filterOptions?.markets ?? uniqueSorted(rows.map((row) => row.channel))), [filterOptions, rows]);
  const zones = useMemo(() => toOptions(filterOptions?.zones ?? uniqueSorted(rows.map((row) => row.zone))), [filterOptions, rows]);
  // Con las parejas zona-ciudad de la API, la lista de ciudades sigue a la zona del borrador sin otra consulta.
  const cities = useMemo(() => {
    if (filterOptions?.cityZones) {
      const pairs = draftFilters.zone === "Todas" ? filterOptions.cityZones : filterOptions.cityZones.filter((pair) => pair.zone === draftFilters.zone);
      return toOptions(uniqueSorted(pairs.map((pair) => pair.city)));
    }
    return toOptions(filterOptions?.cities ?? uniqueSorted(rows.map((row) => row.city)));
  }, [draftFilters.zone, filterOptions, rows]);
  const hasUnfilteredDeliveryCriteria = appliedFilters.channel !== "Todos" || appliedFilters.city !== "Todas" || appliedFilters.zone !== "Todas";
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);
  // Los filtros de documento se aplican en la API; aquí solo queda la pestaña de notas crédito.
  const visibleRows = useMemo(() => rows.filter((row) => (activeView === "Notas crédito" ? row.creditNote > 0 : activeView === "Facturación" ? row.invoiced > 0 : true)), [activeView, rows]);
  const totals = summary ?? emptySummary;
  const deliveryTotals = deliverySummary ?? emptyDeliverySummary;
  const dailyData = useMemo(() => totals.daily.slice(-14).map((item) => ({ label: formatDate(item.date), facturado: item.invoiced, notas: item.creditNote, sort: item.date })), [totals.daily]);
  const dailySummaryRows = useMemo(() => {
    const billingByDate = new Map(totals.daily.map((item) => [item.date, item]));
    const deliveryByDate = new Map(deliveryTotals.daily.map((item) => [item.date, item]));
    const dates = Array.from(new Set([...billingByDate.keys(), ...deliveryByDate.keys()])).sort();
    const cumulativeBillingByMonth = new Map<string, number>();
    const cumulativeDeliveryByMonth = new Map<string, number>();
    const rows = dates.map((dateValueKey) => {
      const item = billingByDate.get(dateValueKey) ?? { date: dateValueKey, invoiced: 0, creditNote: 0 };
      const delivery = deliveryByDate.get(dateValueKey) ?? { date: dateValueKey, deliveredQuantity: 0, invoicedQuantity: 0, valueWithoutVat: 0 };
      const monthKey = dateValueKey.slice(0, 7);
      const cumulative = (cumulativeBillingByMonth.get(monthKey) ?? 0) + item.invoiced;
      const deliveryMonthTotal = (cumulativeDeliveryByMonth.get(monthKey) ?? 0) + delivery.valueWithoutVat;
      cumulativeBillingByMonth.set(monthKey, cumulative);
      cumulativeDeliveryByMonth.set(monthKey, deliveryMonthTotal);
      const target = monthlyTargets[monthKey];
      const date = dateValue(dateValueKey);
      return {
        ...item,
        deliveryDay: delivery.valueWithoutVat,
        deliveryMonthTotal,
        year: date.getFullYear(),
        month: new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date),
        day: date.getDate(),
        monthTotal: cumulative,
        net: item.invoiced - item.creditNote,
        nationalTarget: target?.national,
        firplakTarget: target?.firplak,
      };
    });
    return rows.reverse();
  }, [deliveryTotals.daily, totals.daily]);
  const displayedDailySummaryRows = showAllDailySummary ? dailySummaryRows : dailySummaryRows.slice(0, 7);
  const zoneData = useMemo(() => {
    const positiveTotal = totals.zones.reduce((total, item) => total + Math.max(item.net, 0), 0) || 1;
    return totals.zones.map((item) => ({ name: item.name, value: item.net, percent: Math.round((Math.max(item.net, 0) / positiveTotal) * 100) })).slice(0, 5);
  }, [totals.zones]);

  const updateDraft = (key: keyof DashboardFilters) => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  // La ciudad depende de la zona: al cambiar de zona se limpia, porque puede no pertenecer a la nueva.
  const handleZoneChange = (zone: string) => setDraftFilters((current) => ({ ...current, zone, city: "Todas" }));
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
  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer"><div className="billing-drawer-header"><div><span className="billing-panel-kicker">DETALLE DEL DOCUMENTO</span><h2>{selectedRow.docnum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div><div className="billing-drawer-status"><span className="billing-status-dot" /> Documento contabilizado <span>{formatDate(selectedRow.date)}</span></div><div className="billing-drawer-total"><span>Total neto</span><strong>{formatCurrency(selectedRow.net)}</strong><small>Facturado {formatCurrency(selectedRow.invoiced)} · NC {formatCurrency(selectedRow.creditNote)}</small></div><dl className="billing-detail-list"><div><dt>Cliente</dt><dd>{selectedRow.customer}</dd></div><div><dt>Grupo de cliente</dt><dd>{selectedRow.customerGroup}</dd></div><div><dt>Canal</dt><dd>{selectedRow.channel}</dd></div><div><dt>Zona</dt><dd>{selectedRow.zone}</dd></div><div><dt>Ciudad</dt><dd>{selectedRow.city}</dd></div></dl></aside></>;

  return <DashboardShell navigation={billingNavigation} activeHref={isDetailView ? "/facturacion-diaria/detalle" : "/facturacion-diaria"} title="Facturación diaria" className={isDetailView ? "billing-shell-detail" : ""} overlay={detailDrawer}>
        <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>Facturación detallada</h1><p>Consulta el comportamiento de la facturación, notas crédito y documentos por periodo.</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={16} /> Filtros</button></div></div>
        <form className="billing-filterbar" onSubmit={applyFilters}>
          <div className="billing-filterbar-primary">
            <label><CalendarDays size={15} /><span>Periodo</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}><option value="Todos">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
            <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value="Todos">Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
            <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar documento, cliente o ciudad..." aria-label="Buscar documento, cliente o ciudad" enterKeyHint="search" /></div>
            <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
          </div>
          {showFilters && <div className="billing-advanced-filters">
            <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros del documento</span></div><small>Combina los criterios para afinar la consulta</small></div>
            <FilterSelect label="Cliente" value={draftFilters.customer} emptyValue="Todos" emptyLabel="Todos los clientes" options={customers} onChange={updateDraft("customer")} />
            <FilterSelect label="Grupo de cliente" value={draftFilters.group} emptyValue="Todos" emptyLabel="Todos los grupos" options={groups} onChange={updateDraft("group")} />
            <FilterSelect label="Mercado" value={draftFilters.channel} emptyValue="Todos" emptyLabel="Todos los mercados" options={markets} onChange={updateDraft("channel")} />
            <FilterSelect label="Zona" value={draftFilters.zone} emptyValue="Todas" emptyLabel="Todas las zonas" options={zones} onChange={handleZoneChange} />
            <FilterSelect label="Ciudad" value={draftFilters.city} emptyValue="Todas" emptyLabel="Todas las ciudades" options={cities} onChange={updateDraft("city")} />
            <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
          </div>}
        </form>
        {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}
        <div className="billing-metrics-grid">{loading ? Array.from({ length: 3 }, (_, index) => <MetricSkeleton key={index} />) : <><MetricCard label="Facturación bruta" value={formatCompactCurrency(totals.invoiced)} detail={`${formatNumber(pagination.total)} documentos filtrados`} icon={TrendingUp} /><MetricCard label="Facturación neta" value={formatCompactCurrency(totals.net)} detail="Facturado menos notas crédito" icon={ArrowUpRight} /><MetricCard label="Notas crédito" value={formatCompactCurrency(totals.creditNote)} detail={`${formatPercent(totals.invoiced ? totals.creditNote / totals.invoiced : 0)} sobre la facturación`} icon={ArrowDownRight} /></>}</div>
        <div className="billing-analysis-grid"><section className="billing-panel billing-chart-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN DIARIA</span><h2>Facturación y notas crédito</h2></div><span className="billing-period-caption">{dailyData.length ? `${formatDate(dailyData[0].sort)} — ${formatDate(dailyData[dailyData.length - 1].sort)}` : "Sin datos"}</span></div><div className="billing-chart-legend"><span><i className="facturado" /> Facturado</span><span><i className="notas" /> Notas crédito</span></div>{loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : <div className="billing-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="facturadoGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.18} /><stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke={chartColors.grid} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={(value) => `$${formatNumber(Math.round(Number(value) / 1_000_000))} M`} width={64} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: chartColors.primary, fontWeight: 600 }} formatter={(value) => formatCurrency(Number(value))} /><Area type="monotone" dataKey="facturado" name="Facturado" stroke={chartColors.primary} strokeWidth={2.5} fill="url(#facturadoGradient)" /><Area type="monotone" dataKey="notas" name="Notas crédito" stroke={chartColors.secondary} strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div>}</section><section className="billing-panel billing-zone-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">DISTRIBUCIÓN</span><h2>Facturación neta por zona</h2></div></div>{loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <div className="billing-zone-list">{zoneData.length ? zoneData.map((item) => <div className="billing-zone-row" key={item.name}><div className="billing-zone-label"><span>{item.name}</span><strong>{formatCompactCurrency(item.value)}</strong></div><div className="billing-progress"><span style={{ width: `${item.percent}%` }} /></div><small>{item.percent}%</small></div>) : <div className="billing-empty">No hay zonas para los filtros seleccionados.</div>}</div>}</section></div>
        <section className="billing-panel billing-daily-summary-panel">
          <div className="billing-table-heading"><div><span className="billing-panel-kicker">RESUMEN DIARIO</span><h2>Facturación y entregas por día</h2><p>Acumulado mensual, entregas y metas configuradas</p>{hasUnfilteredDeliveryCriteria && <p>Las columnas de entregas no se filtran por mercado, zona ni ciudad: esos datos no existen en la tabla de entregas.</p>}</div><div className="billing-daily-summary-actions"><span className="billing-daily-summary-count">{dailySummaryRows.length ? `${dailySummaryRows.length} días` : "Sin datos"}</span>{dailySummaryRows.length > 7 && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllDailySummary((visible) => !visible)}>{showAllDailySummary ? "Mostrar menos" : "Ver todos los días"}</button>}</div></div>
          <div className="billing-table-scroll"><table className="billing-data-table billing-daily-summary-table"><thead><tr><th>Año</th><th>Mes</th><th>Día</th><th className="align-right">Ent día</th><th className="align-right">Ent mes total</th><th className="align-right">Fac día total</th><th className="align-right">Fac mes total</th><th className="align-right">Total NC</th><th className="align-right">Fac - NC</th><th className="align-right">Meta Nacional</th><th className="align-right">Meta Firplak</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={11}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : dailySummaryRows.length ? displayedDailySummaryRows.map((item) => <tr key={item.date}><td>{item.year}</td><td>{item.month}</td><td>{item.day}</td><td className="align-right delivery-cell">{item.deliveryDay ? formatCurrency(item.deliveryDay) : "—"}</td><td className="align-right delivery-cell">{item.deliveryMonthTotal ? formatCurrency(item.deliveryMonthTotal) : "—"}</td><td className="align-right number-cell">{formatCurrency(item.invoiced)}</td><td className="align-right number-cell">{formatCurrency(item.monthTotal)}</td><td className="align-right credit-cell">{item.creditNote ? formatCurrency(item.creditNote) : "—"}</td><td className="align-right net-cell">{formatCurrency(item.net)}</td><td className="align-right">{item.nationalTarget ? formatCurrency(item.nationalTarget) : "—"}</td><td className="align-right">{item.firplakTarget ? formatCurrency(item.firplakTarget) : "—"}</td></tr>) : <tr><td colSpan={11} className="billing-table-state"><strong>Sin datos diarios</strong></td></tr>}</tbody></table></div>
        </section>
        <section className="billing-panel billing-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE OPERATIVO</span><h2>Documentos de facturación</h2><p>{formatNumber(pagination.total)} registros encontrados · página {pagination.page} de {pagination.totalPages}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={isRefreshing}><RefreshCw size={15} className={isRefreshing ? "billing-spin" : ""} /> Actualizar</button></div></div><div className="billing-tabs" role="tablist">{(["Todos", "Facturación", "Notas crédito"] as View[]).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)} role="tab" aria-selected={activeView === view}>{view}{view === "Notas crédito" && <span>{formatNumber(rows.filter((row) => row.creditNote > 0).length)}</span>}</button>)}</div><div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha</th><th>DOCNUM</th><th>Grupo de cliente</th><th>Canal</th><th>Zona</th><th>Ciudad</th><th className="align-right">Facturado</th><th className="align-right">NC</th><th className="align-right">Neto</th><th aria-label="Abrir detalle" /></tr></thead><tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={10}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : visibleRows.length ? visibleRows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}><td><span className="billing-date-cell">{formatDate(row.date)}</span><small>{dateValue(row.date).getFullYear()}</small></td><td><strong className="billing-docnum">{row.docnum}</strong></td><td><span className="billing-group-cell">{row.customerGroup}</span><small>{row.customer}</small></td><td>{row.channel}</td><td><span className={`billing-zone-tag ${row.zone.toLowerCase().replaceAll(" ", "-")}`}>{row.zone}</span></td><td>{row.city}</td><td className="align-right number-cell">{formatCurrency(row.invoiced)}</td><td className="align-right number-cell credit-cell">{row.creditNote ? formatCurrency(row.creditNote) : "—"}</td><td className="align-right number-cell net-cell">{formatCurrency(row.net)}</td><td><ChevronRight size={16} className="billing-row-chevron" /></td></tr>) : <tr><td colSpan={10} className="billing-table-state"><Search size={22} /><strong>No encontramos documentos</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}</tbody></table></div><TablePager shown={visibleRows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="documentos" onPageChange={changePage} /></section>
        <footer className="billing-footer"><span>{lastUpdated ? `Actualizado ${formatDateTime(lastUpdated)}` : "Actualización automática"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
