"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Database,
  Download,
  Filter,
  Gauge,
  History,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CumulativeChart, { buildCumulativeData, type CumulativeChartPoint } from "@/components/dashboard/CumulativeChart";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import TablePager from "@/components/dashboard/TablePager";
import { canViewReport, getUserAccess } from "@/lib/auth/access";
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
import { toOptions, uniqueSorted } from "@/lib/dashboard/options";
import {
  type BillingFilterOptions,
  type BillingPayload,
  type BillingRow,
  type BillingSummary,
  type DeliveryPayload,
  type DeliverySummary,
  deliveryNet,
} from "@/lib/facturacion/types";
import { daysInMonth, todayIso } from "@/lib/metas/calendar";
import {
  buildTargetSeries,
  type CommercialTargetsYear,
  type Company,
  companies,
  elapsedWorkingDays,
  loadCommercialTargets,
  pointAt,
} from "@/lib/metas/targets";
import { createClient } from "@/lib/supabase/client";

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
const initialPeriod = new Date();
const initialYear = String(initialPeriod.getFullYear());
const initialMonth = String(initialPeriod.getMonth() + 1);
const visibleZoneCount = 5;

type DashboardFilters = {
  year: string;
  month: string;
  search: string;
  company: string;
  subgroup: string;
  group: string;
  channel: string;
  zone: string;
  city: string;
};

const initialFilters: DashboardFilters = {
  year: initialYear,
  month: initialMonth,
  search: "",
  company: "Todas",
  subgroup: "Todos",
  group: "Todos",
  channel: "Todos",
  zone: "Todas",
  city: "Todas",
};

// Filtros aplicados como parámetros de la API; la tabla y la descarga usan los mismos.
function filterParams({ year, month, zone, channel, city, company, subgroup, group, search }: DashboardFilters) {
  const params = new URLSearchParams();
  if (year !== "Todos") params.set("anio", year);
  if (month !== "Todos") params.set("mes", month);
  if (zone !== "Todas") params.set("zona", zone);
  if (channel !== "Todos") params.set("mercado", channel);
  if (city !== "Todas") params.set("ciudad", city);
  if (company !== "Todas") params.set("empresa", company);
  if (subgroup !== "Todos") params.set("subgrupoCliente", subgroup);
  if (group !== "Todos") params.set("grupoCliente", group);
  if (search) params.set("search", search);
  return params;
}

// Filtros del panel "Más filtros"; el botón muestra cuántos están activos.
const advancedFilterKeys = ["search", "group", "subgroup", "zone", "city"] as const satisfies readonly (keyof DashboardFilters)[];

function dayBefore(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function dailyNet(item: BillingSummary["daily"][number]) {
  return item.net ?? item.invoiced - item.creditNote;
}

const millionsTick = (value: unknown) => `$${formatNumber(Math.round(Number(value) / 1_000_000))} M`;

type FacturacionDashboardProps = {
  mode?: "overview" | "detail";
};

export default function FacturacionDashboard({ mode = "overview" }: FacturacionDashboardProps) {
  const isDetailView = mode === "detail";
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterOptions, setFilterOptions] = useState<BillingFilterOptions | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [targetsData, setTargetsData] = useState<CommercialTargetsYear | null>(null);
  const [targetsError, setTargetsError] = useState("");
  const [canEditTargets, setCanEditTargets] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("Todos");
  // Los filtros se aplican al elegirlos (decisión del desarrollador, 2026-11-11); solo la búsqueda espera Enter o la lupa.
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // "Hasta ayer": al presentar temprano, el día en curso apenas empieza; meta y real se cortan en el día anterior.
  const [untilYesterday, setUntilYesterday] = useState(false);
  const [showAllDailySummary, setShowAllDailySummary] = useState(false);
  const [showAllZones, setShowAllZones] = useState(false);
  const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const params = filterParams(appliedFilters);
      // "Hasta ayer" corta toda la página en la consulta: tarjetas, gráficas, zonas, tabla diaria y entregas.
      if (untilYesterday && !isDetailView) params.set("fechaHasta", dayBefore(todayIso()));
      params.set("page", String(targetPage));
      params.set("pageSize", "50");

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
  }, [appliedFilters, isDetailView, untilYesterday]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Las metas viven en Supabase (commercial_targets); se leen por año y se filtran por empresa en el navegador.
  const targetYear = appliedFilters.year === "Todos" ? null : Number(appliedFilters.year);
  useEffect(() => {
    if (isDetailView || targetYear === null) { setTargetsData(null); return; }
    let cancelled = false;
    loadCommercialTargets(supabase, targetYear)
      .then((data) => { if (!cancelled) { setTargetsData(data); setTargetsError(""); } })
      .catch((targetError) => {
        console.error("No fue posible cargar las metas comerciales", targetError);
        if (!cancelled) { setTargetsData(null); setTargetsError("No fue posible cargar las metas comerciales."); }
      });
    return () => { cancelled = true; };
  }, [isDetailView, supabase, targetYear]);

  // El acceso a Metas solo se ofrece a quien puede editarlas; el middleware protege la ruta de todos modos.
  useEffect(() => {
    getUserAccess(supabase).then((access) => setCanEditTargets(canViewReport(access, "metas-comerciales"))).catch(() => setCanEditTargets(false));
  }, [supabase]);

  useEffect(() => {
    if (!selectedRow) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedRow(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRow]);

  const years = useMemo(() => availableYears.length ? availableYears : Array.from(new Set(rows.map((row) => dateValue(row.date).getFullYear()))).sort((a, b) => b - a), [availableYears, rows]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  // Las opciones vienen del catálogo de la API para todo el periodo; si la API aún no lo envía, se derivan de la página visible.
  const companyOptions = useMemo(() => toOptions(filterOptions?.companies ?? [...companies]), [filterOptions]);
  const subgroups = useMemo(() => toOptions(filterOptions?.customerSubgroups ?? uniqueSorted(rows.map((row) => row.customerSubgroup ?? ""))), [filterOptions, rows]);
  const groups = useMemo(() => toOptions(filterOptions?.customerGroups ?? uniqueSorted(rows.map((row) => row.customerGroup))), [filterOptions, rows]);
  const markets = useMemo(() => toOptions(filterOptions?.markets ?? uniqueSorted(rows.map((row) => row.channel))), [filterOptions, rows]);
  const zones = useMemo(() => toOptions(filterOptions?.zones ?? uniqueSorted(rows.map((row) => row.zone))), [filterOptions, rows]);
  // Con las parejas zona-ciudad de la API, la lista de ciudades sigue a la zona del borrador sin otra consulta.
  const cities = useMemo(() => {
    if (filterOptions?.cityZones) {
      const pairs = appliedFilters.zone === "Todas" ? filterOptions.cityZones : filterOptions.cityZones.filter((pair) => pair.zone === appliedFilters.zone);
      return toOptions(uniqueSorted(pairs.map((pair) => pair.city)));
    }
    return toOptions(filterOptions?.cities ?? uniqueSorted(rows.map((row) => row.city)));
  }, [appliedFilters.zone, filterOptions, rows]);
  // Entregas se filtra por mercado (TipoVentas de la entrega) pero no tiene zona ni ciudad.
  const hasUnfilteredDeliveryCriteria = appliedFilters.city !== "Todas" || appliedFilters.zone !== "Todas";
  const activeAdvancedFilters = advancedFilterKeys.filter((key) => appliedFilters[key] !== initialFilters[key]).length;
  const hasPendingSearch = searchDraft.trim() !== appliedFilters.search;
  // La API anterior a feat/facturacion-metas-empresa no envía companies ni customerSubgroups e ignora empresa y subgrupoCliente.
  const apiLacksCompanyFilters = Boolean(filterOptions && !filterOptions.companies);
  // Los filtros de documento se aplican en la API; aquí solo queda la pestaña de notas crédito.
  const visibleRows = useMemo(() => rows.filter((row) => (activeView === "Notas crédito" ? row.creditNote > 0 : activeView === "Facturación" ? row.invoiced > 0 : true)), [activeView, rows]);
  const totals = summary ?? emptySummary;
  const deliveryTotals = deliverySummary ?? emptyDeliverySummary;
  const netDeliveries = deliveryNet(deliveryTotals);

  // Metas del periodo: meta diaria = meta mensual / días laborales; el acumulado se corta en hoy o en el fin del periodo.
  const periodMonths = useMemo(() => appliedFilters.month === "Todos" ? months : [Number(appliedFilters.month)], [appliedFilters.month, months]);
  const targetSeries = useMemo(() => targetYear === null ? null : buildTargetSeries(targetsData, targetYear, periodMonths, appliedFilters.company as Company | "Todas", appliedFilters.channel), [appliedFilters.channel, appliedFilters.company, periodMonths, targetYear, targetsData]);
  const cutDay = untilYesterday && !isDetailView ? dayBefore(todayIso()) : todayIso();
  const cutoff = useMemo(() => {
    if (targetYear === null) return cutDay;
    const lastMonth = periodMonths[periodMonths.length - 1];
    const periodEnd = `${targetYear}-${String(lastMonth).padStart(2, "0")}-${String(daysInMonth(targetYear, lastMonth)).padStart(2, "0")}`;
    return cutDay < periodEnd ? cutDay : periodEnd;
  }, [cutDay, periodMonths, targetYear]);
  // Con "Hasta ayer" la API ya devuelve todo cortado en el día anterior (fechaHasta), así que los totales sirven tal cual.
  const billingCut = { net: totals.net, invoiced: totals.invoiced, creditNote: totals.creditNote };
  const deliveryCut = { net: netDeliveries, delivered: deliveryTotals.delivered, returns: deliveryTotals.returns };
  const targetToDate = targetSeries ? pointAt(targetSeries.points, cutoff) : null;
  const billingTargetToDate = targetToDate?.billingCumulative ?? 0;
  const deliveryTargetToDate = targetToDate?.deliveryCumulative ?? 0;
  const workingDaysElapsed = targetSeries ? elapsedWorkingDays(targetSeries.points, cutoff) : 0;
  const workingDaysTotal = targetSeries ? targetSeries.points.filter((point) => point.working).length : 0;
  const periodLabel = appliedFilters.month === "Todos" ? `del año ${appliedFilters.year}` : `de ${formatMonthName(Number(appliedFilters.month)).toLowerCase()}`;
  const targetDetail = (total: number) => targetYear === null
    ? "Elige un año para ver las metas"
    : total
      ? `Meta ${periodLabel}: ${formatCompactCurrency(total)} · ${workingDaysElapsed} de ${workingDaysTotal} días laborales`
      : targetsError || "Sin meta registrada para el periodo";

  // Ventas netas acumuladas frente a la meta acumulada, día a día: dos líneas ascendentes.
  // En la gráfica solo aparecen los días laborales; lo de sábados y festivos suma al acumulado (buildCumulativeData).
  // Ventas y entregas comparten una sola gráfica: ambas series usan las mismas fechas para quedar alineadas.
  const hasCumulativeTarget = Boolean(targetSeries?.billingTotal);
  const cumulativeData = useMemo(() => {
    const billingByDate = new Map(totals.daily.map((item) => [item.date, dailyNet(item)]));
    const deliveryByDate = new Map(deliveryTotals.daily.map((item) => [item.date, deliveryNet(item)]));
    const dates = targetSeries
      ? targetSeries.points.map((point) => point.date)
      : Array.from(new Set([...billingByDate.keys(), ...deliveryByDate.keys()])).sort();
    const billing = buildCumulativeData({
      dates,
      valuesByDate: billingByDate,
      targetByDate: hasCumulativeTarget ? new Map(targetSeries?.points.map((point) => [point.date, point.billingCumulative]) ?? []) : null,
      cutoff,
    });
    const delivery = buildCumulativeData({ dates, valuesByDate: deliveryByDate, targetByDate: null, cutoff });
    return billing.map((point, index) => ({
      date: point.date,
      label: point.label,
      ventas: point.real,
      entregas: delivery[index]?.real ?? null,
      meta: point.meta,
    }));
  }, [cutoff, deliveryTotals.daily, hasCumulativeTarget, targetSeries, totals.daily]);
  const cumulativeLines = [
    { dataKey: "ventas", name: "Ventas netas acumuladas", color: chartColors.primary },
    { dataKey: "entregas", name: "Entregas netas acumuladas", color: chartColors.delivery },
    // Ventas y entregas comparten la meta: se dibuja una sola línea de meta acumulada.
    ...(hasCumulativeTarget ? [{ dataKey: "meta", name: "Meta acumulada", color: chartColors.secondary, dashed: true }] : []),
  ];
  // Recuadro de la gráfica: diferencia del día entre la facturación neta acumulada y la meta acumulada.
  const cumulativeTooltipExtras = (point: CumulativeChartPoint) =>
    typeof point.ventas === "number" && typeof point.meta === "number" ? [{ label: "Diferencia facturación neta vs. meta", value: point.ventas - point.meta }] : [];
  const missingTargetNote = !loading && !hasCumulativeTarget && targetYear !== null
    ? <p className="billing-panel-note">No hay meta registrada para este periodo y empresa.{canEditTargets && <> Regístrala en <Link href="/metas-comerciales">Metas comerciales</Link>.</>}</p>
    : null;

  const dailyData = useMemo(() => totals.daily.slice(-14).map((item) => ({ label: formatDate(item.date), facturado: item.invoiced, notas: item.creditNote, sort: item.date })), [totals.daily]);
  const dailySummaryRows = useMemo(() => {
    const billingByDate = new Map(totals.daily.map((item) => [item.date, item]));
    const deliveryByDate = new Map(deliveryTotals.daily.map((item) => [item.date, item]));
    const targetByDate = new Map(targetSeries?.points.map((point) => [point.date, point]) ?? []);
    const dates = Array.from(new Set([...billingByDate.keys(), ...deliveryByDate.keys()])).sort();
    const cumulativeBillingByMonth = new Map<string, number>();
    const cumulativeDeliveryByMonth = new Map<string, number>();
    const summaryRows = dates.map((dateValueKey) => {
      const item = billingByDate.get(dateValueKey) ?? { date: dateValueKey, invoiced: 0, creditNote: 0 };
      const delivery = deliveryByDate.get(dateValueKey);
      const deliveryDay = delivery ? deliveryNet(delivery) : 0;
      const monthKey = dateValueKey.slice(0, 7);
      const net = dailyNet(item);
      const cumulative = (cumulativeBillingByMonth.get(monthKey) ?? 0) + net;
      const deliveryMonthTotal = (cumulativeDeliveryByMonth.get(monthKey) ?? 0) + deliveryDay;
      cumulativeBillingByMonth.set(monthKey, cumulative);
      cumulativeDeliveryByMonth.set(monthKey, deliveryMonthTotal);
      const target = targetByDate.get(dateValueKey);
      const date = dateValue(dateValueKey);
      return {
        ...item,
        deliveryDay,
        deliveryMonthTotal,
        year: date.getFullYear(),
        month: new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date),
        day: date.getDate(),
        monthNetTotal: cumulative,
        net,
        targetDay: target?.billingDay ?? 0,
        targetCumulative: target?.billingCumulative ?? 0,
        // Diferencia = facturación neta acumulada del mes − meta del mes a ese día (negativa: por debajo de la meta).
        targetDifference: target ? cumulative - target.billingCumulative : null,
      };
    });
    return summaryRows.reverse();
  }, [deliveryTotals.daily, targetSeries, totals.daily]);
  const displayedDailySummaryRows = showAllDailySummary ? dailySummaryRows : dailySummaryRows.slice(0, 7);
  const zoneData = useMemo(() => {
    const positiveTotal = totals.zones.reduce((total, item) => total + Math.max(item.net, 0), 0) || 1;
    return totals.zones.map((item) => ({ name: item.name, value: item.net, percent: Math.round((Math.max(item.net, 0) / positiveTotal) * 100) }));
  }, [totals.zones]);
  const displayedZones = showAllZones ? zoneData : zoneData.slice(0, visibleZoneCount);

  const setFilter = (key: keyof DashboardFilters) => (value: string) => setAppliedFilters((current) => ({ ...current, [key]: value }));
  // La ciudad depende de la zona: al cambiar de zona se limpia, porque puede no pertenecer a la nueva.
  const handleZoneChange = (zone: string) => setAppliedFilters((current) => ({ ...current, zone, city: "Todas" }));
  const resetFilters = () => { setSearchDraft(""); setAppliedFilters(initialFilters); };
  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = searchDraft.trim();
    setSearchDraft(search);
    setAppliedFilters((current) => current.search === search ? current : { ...current, search });
  };
  const changePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > pagination.totalPages || targetPage === pagination.page) return;
    setPagination((current) => ({ ...current, page: targetPage }));
    void loadData(targetPage);
  };
  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer"><div className="billing-drawer-header"><div><span className="billing-panel-kicker">DETALLE DEL DOCUMENTO</span><h2>{selectedRow.docnum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div><div className="billing-drawer-status"><span className="billing-status-dot" /> Documento contabilizado <span>{formatDate(selectedRow.date)}</span></div><div className="billing-drawer-total"><span>Total neto</span><strong>{formatCurrency(selectedRow.net)}</strong><small>Facturado {formatCurrency(selectedRow.invoiced)} · NC {formatCurrency(selectedRow.creditNote)}</small></div><dl className="billing-detail-list"><div><dt>Empresa</dt><dd>{selectedRow.company ?? "—"}</dd></div><div><dt>Cliente</dt><dd>{selectedRow.customer}</dd></div><div><dt>Grupo de cliente</dt><dd>{selectedRow.customerGroup}</dd></div><div><dt>Subgrupo de cliente</dt><dd>{selectedRow.customerSubgroup ?? "—"}</dd></div><div><dt>Canal</dt><dd>{selectedRow.channel}</dd></div><div><dt>Zona</dt><dd>{selectedRow.zone}</dd></div><div><dt>Ciudad</dt><dd>{selectedRow.city}</dd></div></dl></aside></>;

  const exportQuery = filterParams(appliedFilters).toString();
  const exportHref = `/api/facturacion-diaria/export${exportQuery ? `?${exportQuery}` : ""}`;
  const cutoffLabel = untilYesterday ? `hasta ayer (${formatDate(cutoff)})` : "a la fecha";
  const complianceDetail = (target: number) => target ? `Real frente a la meta acumulada ${cutoffLabel}` : `Sin meta acumulada ${cutoffLabel}`;

  return <DashboardShell navigation={billingNavigation} activeHref={isDetailView ? "/facturacion-diaria/detalle" : "/facturacion-diaria"} title="Facturación y entregas diaria" className={isDetailView ? "billing-shell-detail" : ""} overlay={detailDrawer}>
        <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>{isDetailView ? "Detalle de facturas" : "Facturación y entregas diaria"}</h1><p>{isDetailView ? "Facturas y notas crédito por documento, con los filtros aplicados." : "Consulta el comportamiento de la facturación, las entregas y su cumplimiento frente a las metas del periodo."}</p></div>{isDetailView && <div className="billing-heading-actions"><a className="billing-secondary-button billing-download-button" href={exportHref} download aria-label="Descargar en Excel las facturas con los filtros aplicados"><Download size={16} /> Descargar</a></div>}</div>
        {/* Barra compacta y fija al desplazarse: cada filtro se aplica al elegirlo. */}
        <form className="billing-filterbar billing-filterbar-sticky" onSubmit={applySearch} aria-label="Filtros">
            <div className="billing-quick-actions">
              <button type="button" className={`billing-secondary-button small ${showFilters ? "active" : ""}`} onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters} aria-controls="billing-more-filters"><SlidersHorizontal size={15} /> Más filtros{activeAdvancedFilters > 0 && <span className="billing-filter-count">{activeAdvancedFilters}</span>}</button>
              {!isDetailView && <button type="button" className={`billing-secondary-button small billing-toggle-button ${untilYesterday ? "active" : ""}`} onClick={() => setUntilYesterday((value) => !value)} aria-pressed={untilYesterday} title="Corta la meta, las ventas y las entregas en el día anterior"><History size={15} /> Hasta ayer</button>}
              <button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button>
            </div>
          <div className="billing-quick-filters">
            <label className="billing-quick-filter"><CalendarDays size={15} /><span>Año</span><select value={appliedFilters.year} onChange={(event) => setFilter("year")(event.target.value)}><option value="Todos">Todos</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
            <label className="billing-quick-filter"><span>Mes</span><select value={appliedFilters.month} onChange={(event) => setFilter("month")(event.target.value)}><option value="Todos">Todos</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
            <label className="billing-quick-filter"><span>Empresa</span><select value={appliedFilters.company} onChange={(event) => setFilter("company")(event.target.value)}><option value="Todas">Todas</option>{companyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="billing-quick-filter"><span>Mercado</span><select value={appliedFilters.channel} onChange={(event) => setFilter("channel")(event.target.value)}><option value="Todos">Todos</option>{markets.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          {showFilters && <div className="billing-advanced-filters" id="billing-more-filters">
            <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Más filtros</span></div><small>Se aplican al elegirlos</small></div>
            <div className="billing-search billing-advanced-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading || !hasPendingSearch}><Search size={16} /></button><input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Buscar documento, cliente o ciudad..." aria-label="Buscar documento, cliente o ciudad (Enter para buscar)" enterKeyHint="search" /></div>
            <FilterSelect label="Grupo de cliente" value={appliedFilters.group} emptyValue="Todos" emptyLabel="Todos los grupos" options={groups} onChange={setFilter("group")} />
            <FilterSelect label="Subgrupo de cliente" value={appliedFilters.subgroup} emptyValue="Todos" emptyLabel="Todos los subgrupos" options={subgroups} onChange={setFilter("subgroup")} />
            <FilterSelect label="Zona" value={appliedFilters.zone} emptyValue="Todas" emptyLabel="Todas las zonas" options={zones} onChange={handleZoneChange} />
            <FilterSelect label="Ciudad" value={appliedFilters.city} emptyValue="Todas" emptyLabel="Todas las ciudades" options={cities} onChange={setFilter("city")} />
          </div>}
        </form>
        {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}
        {!error && apiLacksCompanyFilters && <div className="billing-alert"><Database size={16} /><span>La API de informes conectada es una versión anterior: los filtros Empresa y Subgrupo de cliente no se aplican hasta desplegar la versión nueva.</span></div>}
        <div className="billing-metrics-grid billing-metrics-compact" aria-label="Ventas y entregas frente a la meta">{loading ? Array.from({ length: 6 }, (_, index) => <MetricSkeleton key={index} />) : <>
          <MetricCard label="Ventas netas" value={formatCompactCurrency(billingCut.net)} detail={`Facturación ${formatCompactCurrency(billingCut.invoiced)} − NC ${formatCompactCurrency(billingCut.creditNote)}`} icon={TrendingUp} />
          <MetricCard label="Meta" value={billingTargetToDate ? formatCompactCurrency(billingTargetToDate) : "Sin meta"} detail={targetDetail(targetSeries?.billingTotal ?? 0)} icon={Target} />
          <MetricCard label="Cumplimiento de facturación" value={billingTargetToDate ? formatPercent(billingCut.net / billingTargetToDate) : "—"} detail={complianceDetail(billingTargetToDate)} icon={Gauge} />
          <MetricCard label="Entregas netas" value={formatCompactCurrency(deliveryCut.net)} detail={deliveryCut.returns !== undefined ? `Entregas ${formatCompactCurrency(deliveryCut.delivered ?? 0)} − devoluciones ${formatCompactCurrency(deliveryCut.returns)}` : "Valor sin IVA de las entregas del periodo"} icon={Truck} />
          <MetricCard label="Meta" value={deliveryTargetToDate ? formatCompactCurrency(deliveryTargetToDate) : "Sin meta"} detail={targetDetail(targetSeries?.deliveryTotal ?? 0)} icon={Target} />
          <MetricCard label="Cumplimiento de entregas" value={deliveryTargetToDate ? formatPercent(deliveryCut.net / deliveryTargetToDate) : "—"} detail={complianceDetail(deliveryTargetToDate)} icon={Gauge} />
        </>}</div>
        <div className="billing-cumulative-grid">
          <CumulativeChart kicker="ACUMULADOS" title="Ventas y entregas netas frente a la meta" lines={cumulativeLines} data={cumulativeData} loading={loading} ariaLabel={`Ventas netas acumuladas ${formatCompactCurrency(billingCut.net)} frente a una meta ${cutoffLabel} de ${formatCompactCurrency(billingTargetToDate)}; entregas netas acumuladas ${formatCompactCurrency(deliveryCut.net)} frente a una meta ${cutoffLabel} de ${formatCompactCurrency(deliveryTargetToDate)}`} emptyText="No hay ventas ni entregas para los filtros seleccionados." note={missingTargetNote} tooltipExtras={cumulativeTooltipExtras} />
        </div>
        <div className="billing-analysis-grid"><section className="billing-panel billing-chart-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN DIARIA</span><h2>Facturación y notas crédito</h2></div><span className="billing-period-caption">{dailyData.length ? `${formatDate(dailyData[0].sort)} — ${formatDate(dailyData[dailyData.length - 1].sort)}` : "Sin datos"}</span></div><div className="billing-chart-legend"><span><i className="facturado" /> Facturado</span><span><i className="notas" /> Notas crédito</span></div>{loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : <div className="billing-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="facturadoGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.18} /><stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke={chartColors.grid} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={millionsTick} width={64} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: chartColors.primary, fontWeight: 600 }} formatter={(value) => formatCurrency(Number(value))} /><Area type="monotone" dataKey="facturado" name="Facturado" stroke={chartColors.primary} strokeWidth={2.5} fill="url(#facturadoGradient)" /><Area type="monotone" dataKey="notas" name="Notas crédito" stroke={chartColors.secondary} strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div>}</section>
          <section className="billing-panel billing-zone-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">DISTRIBUCIÓN</span><h2>Ventas netas por zona</h2></div>{zoneData.length > visibleZoneCount && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllZones((visible) => !visible)} aria-expanded={showAllZones}>{showAllZones ? "Ver principales" : `Ver todas (${zoneData.length})`}</button>}</div>{loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <div className="billing-zone-list">{displayedZones.length ? displayedZones.map((item) => <div className="billing-zone-row" key={item.name}><div className="billing-zone-label"><span>{item.name}</span><strong>{formatCompactCurrency(item.value)}</strong></div><div className="billing-progress"><span style={{ width: `${item.percent}%` }} /></div><small>{item.percent}%</small></div>) : <div className="billing-empty">No hay zonas para los filtros seleccionados.</div>}</div>}</section></div>
        <section className="billing-panel billing-daily-summary-panel">
          <div className="billing-table-heading"><div><span className="billing-panel-kicker">RESUMEN DIARIO</span><h2>Facturación y entregas por día</h2><p>Entregas netas, facturación neta (facturación − NC) con su acumulado mensual, meta y diferencia frente a la meta del mes</p>{hasUnfilteredDeliveryCriteria && <p>Las columnas de entregas no se filtran por zona ni ciudad: esos datos no existen en la tabla de entregas.</p>}</div><div className="billing-daily-summary-actions"><span className="billing-daily-summary-count">{dailySummaryRows.length ? `${dailySummaryRows.length} días` : "Sin datos"}</span>{dailySummaryRows.length > 7 && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllDailySummary((visible) => !visible)}>{showAllDailySummary ? "Mostrar menos" : "Ver todos los días"}</button>}</div></div>
          <div className="billing-table-scroll"><table className="billing-data-table billing-daily-summary-table"><thead><tr><th>Día</th><th>Año</th><th>Mes</th><th className="align-right">Entr día</th><th className="align-right">Entr mes</th><th className="align-right">Fac día neta</th><th className="align-right">Meta día</th><th className="align-right">Fac mes neta</th><th className="align-right">Meta mes</th><th className="align-right">Diferencia</th><th className="align-right">Fac día bruta</th><th className="align-right">Total NC</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={12}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : dailySummaryRows.length ? displayedDailySummaryRows.map((item) => <tr key={item.date}><td className="billing-day-cell">{item.day}</td><td>{item.year}</td><td>{item.month}</td><td className="align-right delivery-cell">{item.deliveryDay ? formatCurrency(item.deliveryDay) : "—"}</td><td className="align-right delivery-cell">{item.deliveryMonthTotal ? formatCurrency(item.deliveryMonthTotal) : "—"}</td><td className="align-right net-cell">{formatCurrency(item.net)}</td><td className="align-right">{item.targetDay ? formatCurrency(item.targetDay) : "—"}</td><td className="align-right net-cell">{formatCurrency(item.monthNetTotal)}</td><td className="align-right">{item.targetCumulative ? formatCurrency(item.targetCumulative) : "—"}</td><td className={`align-right billing-difference-cell ${item.targetDifference !== null && item.targetDifference < 0 ? "negative" : ""}`}>{item.targetDifference !== null && item.targetCumulative ? `${item.targetDifference > 0 ? "+" : ""}${formatCurrency(item.targetDifference)}` : "—"}</td><td className="align-right number-cell">{formatCurrency(item.invoiced)}</td><td className="align-right credit-cell">{item.creditNote ? formatCurrency(item.creditNote) : "—"}</td></tr>) : <tr><td colSpan={12} className="billing-table-state"><strong>Sin datos diarios</strong></td></tr>}</tbody></table></div>
        </section>
        <section className="billing-panel billing-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE OPERATIVO</span><h2>Documentos de facturación</h2><p>{formatNumber(pagination.total)} registros encontrados · página {pagination.page} de {pagination.totalPages}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={isRefreshing}><RefreshCw size={15} className={isRefreshing ? "billing-spin" : ""} /> Actualizar</button></div></div><div className="billing-tabs" role="tablist">{(["Todos", "Facturación", "Notas crédito"] as View[]).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)} role="tab" aria-selected={activeView === view}>{view}{view === "Notas crédito" && <span>{formatNumber(rows.filter((row) => row.creditNote > 0).length)}</span>}</button>)}</div><div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha</th><th>DOCNUM</th><th>Empresa</th><th>Grupo de cliente</th><th>Canal</th><th>Zona</th><th>Ciudad</th><th className="align-right">Facturado</th><th className="align-right">NC</th><th className="align-right">Neto</th><th aria-label="Abrir detalle" /></tr></thead><tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={11}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : visibleRows.length ? visibleRows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}><td><span className="billing-date-cell">{formatDate(row.date)}</span><small>{dateValue(row.date).getFullYear()}</small></td><td><strong className="billing-docnum">{row.docnum}</strong></td><td>{row.company ?? "—"}</td><td><span className="billing-group-cell">{row.customerGroup}</span><small>{row.customer}</small></td><td>{row.channel}</td><td><span className={`billing-zone-tag ${row.zone.toLowerCase().replaceAll(" ", "-")}`}>{row.zone}</span></td><td>{row.city}</td><td className="align-right number-cell">{formatCurrency(row.invoiced)}</td><td className="align-right number-cell credit-cell">{row.creditNote ? formatCurrency(row.creditNote) : "—"}</td><td className="align-right number-cell net-cell">{formatCurrency(row.net)}</td><td><ChevronRight size={16} className="billing-row-chevron" /></td></tr>) : <tr><td colSpan={11} className="billing-table-state"><Search size={22} /><strong>No encontramos documentos</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}</tbody></table></div><TablePager shown={visibleRows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="documentos" onPageChange={changePage} /></section>
        <footer className="billing-footer"><span>{lastUpdated ? `Actualizado ${formatDateTime(lastUpdated)}` : "Actualización automática"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
