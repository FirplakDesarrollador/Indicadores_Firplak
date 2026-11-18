"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Database,
  Eye,
  FileText,
  Filter,
  ReceiptText,
  RefreshCw,
  Search,
  Sigma,
  SlidersHorizontal,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import ShareList from "@/components/dashboard/ShareList";
import TablePager from "@/components/dashboard/TablePager";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { dateValue, formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatMonthName, formatNumber } from "@/lib/dashboard/format";
import { commercialNavigation } from "@/lib/dashboard/navigation";
import { type FilterOption, toOptions } from "@/lib/dashboard/options";
import type {
  CodeName,
  CommercialBreakdownRow,
  CommercialFilterOptions,
  CommercialOpenStage,
  CommercialPayload,
  CommercialRow,
  CommercialStage,
  CommercialSummary,
  CommercialView,
} from "@/lib/consolidado-comercial/types";

type DashboardFilters = {
  year: string;
  month: string;
  view: CommercialView;
  search: string;
  channel: string;
  segment: string;
  advisor: string;
  costCenter: string;
  orderType: string;
  deliveryStatus: string;
  offerState: string;
  validity: string;
  blocked: string;
};

type StageTab = CommercialOpenStage | "Todas";
type BreakdownKey = "byAdvisor" | "bySegment" | "byCostCenter";

const currentDate = new Date();
// Por defecto, la vista acordada con Comercial y la facturación del mes en curso.
const initialFilters: DashboardFilters = {
  year: String(currentDate.getFullYear()),
  month: String(currentDate.getMonth() + 1),
  view: "default",
  search: "",
  channel: "Todos",
  segment: "Todos",
  advisor: "Todos",
  costCenter: "Todos",
  orderType: "Todos",
  deliveryStatus: "Todos",
  offerState: "Todos",
  validity: "Todos",
  blocked: "Todos",
};
const pageSize = 50;
const breakdownPreviewCount = 10;
const yearOptions = Array.from({ length: 3 }, (_, index) => currentDate.getFullYear() - index);
const months = Array.from({ length: 12 }, (_, index) => index + 1);

const stageInfo: Record<CommercialStage, { label: string; short: string; icon: LucideIcon }> = {
  A_OFERTA: { label: "A · Ofertas abiertas", short: "Ofertas", icon: FileText },
  B_OV: { label: "B · OV pendientes", short: "OV", icon: ClipboardList },
  C_TRANSITO: { label: "C · Tránsito", short: "Tránsito", icon: Truck },
  D_FACTURACION: { label: "D · Facturación neta", short: "Facturación", icon: ReceiptText },
};
const openStages: CommercialOpenStage[] = ["A_OFERTA", "B_OV", "C_TRANSITO"];

const breakdownTabs: Array<{ key: BreakdownKey; label: string; column: string }> = [
  { key: "byAdvisor", label: "Asesor", column: "Asesor" },
  { key: "bySegment", label: "Segmento", column: "Segmento" },
  { key: "byCostCenter", label: "Centro de costos", column: "Centro de costos" },
];

const blockedOptions: FilterOption[] = [{ value: "sin", label: "Sin bloqueo" }, { value: "solo", label: "Solo bloqueadas" }];
const validityOptions: FilterOption[] = [{ value: "Vigente", label: "Vigentes" }, { value: "Vencida", label: "Vencidas" }];

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

function codeNameOptions(items: CodeName[] | undefined): FilterOption[] {
  return (items ?? []).map((item) => ({ value: item.code, label: item.name && item.name !== item.code ? `${item.code} · ${item.name}` : item.code }));
}

const periodDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
function periodLabel(period: CommercialPayload["period"] | null) {
  if (!period) return "";
  return `${periodDate.format(dateValue(period.from))} al ${periodDate.format(dateValue(period.to))}`;
}

function fullDate(value: string) {
  return value ? periodDate.format(dateValue(value)) : "—";
}

// Estado propio de cada etapa: vigencia y estado en ofertas, tipo y bloqueo en OV, status de entrega en tránsito.
function stageStatus(row: CommercialRow) {
  if (row.stage === "A_OFERTA") return { main: row.validity || "—", detail: row.offerStateName || row.offerState || "Sin estado" };
  if (row.stage === "B_OV") {
    const blocked = row.orderBlock || (row.lineBlocked ? "Línea bloqueada" : "");
    return { main: row.orderTypeName || row.orderType || "Sin tipo de OV", detail: blocked || "Sin bloqueo" };
  }
  return { main: row.deliveryStatusName || row.deliveryStatus || "Sin status", detail: row.projectedBillingDate ? `ProyFAC ${formatDate(row.projectedBillingDate)}` : "Sin fecha ProyFAC" };
}

function BreakdownTable({ rows, column, loading, labelFor }: {
  rows: CommercialBreakdownRow[];
  column: string;
  loading: boolean;
  labelFor: (name: string) => string;
}) {
  return <div className="billing-table-scroll"><table className="billing-data-table cc-breakdown-table"><thead><tr><th>{column}</th>{openStages.map((stage) => <th key={stage} className="align-right">{stageInfo[stage].short}</th>)}<th className="align-right">{stageInfo.D_FACTURACION.short}</th><th className="align-right">Total</th></tr></thead><tbody>
    {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={6}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => {
      const label = labelFor(row.name);
      return <tr key={row.name}><td><span className="billing-group-cell">{row.name}</span>{label !== row.name && <small>{label}</small>}</td><td className="align-right number-cell">{formatCurrency(row.offers)}</td><td className="align-right number-cell">{formatCurrency(row.orders)}</td><td className="align-right number-cell">{formatCurrency(row.transit)}</td><td className="align-right number-cell">{formatCurrency(row.billing)}</td><td className="align-right number-cell cc-total-cell">{formatCurrency(row.total)}</td></tr>;
    }) : <tr><td colSpan={6} className="billing-table-state"><strong>Sin datos para los filtros seleccionados</strong></td></tr>}
  </tbody></table></div>;
}

export default function ConsolidadoComercialDashboard({ mode = "overview" }: { mode?: "overview" | "detail" }) {
  const isDetailView = mode === "detail";
  const [rows, setRows] = useState<CommercialRow[]>([]);
  const [summary, setSummary] = useState<CommercialSummary | null>(null);
  const [filterOptions, setFilterOptions] = useState<CommercialFilterOptions | null>(null);
  const [period, setPeriod] = useState<CommercialPayload["period"] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [stageTab, setStageTab] = useState<StageTab>("Todas");
  const [showFilters, setShowFilters] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownKey>("byAdvisor");
  const [showAllBreakdown, setShowAllBreakdown] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CommercialRow | null>(null);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      // El resumen no usa las filas del detalle: pide una sola.
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(isDetailView ? pageSize : 1) });
      const filters = appliedFilters;
      params.set("vista", filters.view);
      // Mes en curso: sin anio/mes la API toma del día 1 hasta hoy; con ellos, el mes completo.
      const isCurrentMonth = filters.year === String(currentDate.getFullYear()) && filters.month === String(currentDate.getMonth() + 1);
      if (!isCurrentMonth) {
        params.set("anio", filters.year);
        if (filters.month !== "Todos") params.set("mes", filters.month);
      }
      const optional: Array<[keyof DashboardFilters, string]> = [
        ["channel", "canal"], ["segment", "segmento"], ["advisor", "asesor"], ["costCenter", "centroCostos"],
        ["orderType", "tipoOV"], ["deliveryStatus", "statusEntrega"], ["offerState", "estadoOferta"],
        ["validity", "vigencia"], ["blocked", "bloqueo"],
      ];
      for (const [key, param] of optional) if (filters[key] !== "Todos") params.set(param, filters[key]);
      if (isDetailView && filters.search) params.set("search", filters.search);
      if (isDetailView && stageTab !== "Todas") params.set("etapa", stageTab);

      const response = await fetch(`/api/consolidado-comercial?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<CommercialPayload & { error?: string }>(response, "La API del consolidado comercial");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el consolidado comercial.");
      if (!payload.summary) throw new Error("La API necesita actualizarse para devolver el consolidado comercial.");

      setRows(payload.rows);
      setSummary(payload.summary);
      setFilterOptions(payload.filterOptions ?? null);
      setPeriod(payload.period ?? null);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLoadedAt(payload.loadedAt);
      setError("");
    } catch (loadError) {
      setRows([]);
      setSummary(null);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, isDetailView, stageTab]);

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

  const channels = useMemo(() => toOptions(filterOptions?.channels ?? []), [filterOptions]);
  const segments = useMemo(() => toOptions(filterOptions?.segments ?? []), [filterOptions]);
  const advisors = useMemo(() => toOptions(filterOptions?.advisors ?? []), [filterOptions]);
  const costCenters = useMemo(() => codeNameOptions(filterOptions?.costCenters), [filterOptions]);
  const orderTypes = useMemo(() => codeNameOptions(filterOptions?.orderTypes), [filterOptions]);
  const deliveryStatuses = useMemo(() => codeNameOptions(filterOptions?.deliveryStatuses), [filterOptions]);
  const offerStates = useMemo(() => codeNameOptions(filterOptions?.offerStates), [filterOptions]);
  const costCenterNames = useMemo(() => new Map((filterOptions?.costCenters ?? []).map((item) => [item.code, item.name])), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);

  const stageTotals = useMemo(() => new Map((summary?.stages ?? []).map((stage) => [stage.stage, stage])), [summary]);
  const compositionItems = useMemo(() => (summary?.stages ?? []).map((stage) => ({
    name: stageInfo[stage.stage].label,
    value: stage.amount,
    detail: `${formatNumber(stage.documents)} documentos`,
  })), [summary]);
  const breakdownRows = summary?.[breakdown] ?? [];
  const displayedBreakdown = showAllBreakdown ? breakdownRows : breakdownRows.slice(0, breakdownPreviewCount);
  const activeBreakdown = breakdownTabs.find((tab) => tab.key === breakdown) ?? breakdownTabs[0];
  const breakdownLabel = useCallback((name: string) => {
    if (breakdown !== "byCostCenter") return name;
    const costCenterName = costCenterNames.get(name);
    return costCenterName && costCenterName !== name ? costCenterName : name;
  }, [breakdown, costCenterNames]);

  const updateDraft = (key: keyof DashboardFilters) => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => { setDraftFilters(initialFilters); setAppliedFilters(initialFilters); setStageTab("Todas"); };
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

  const viewNote = appliedFilters.view === "default"
    ? "Vista acordada con Comercial: Canal B2C (Firplak Home y Ecommerce), sin Donaciones."
    : "Todos los canales y segmentos, sin las reglas de la vista acordada.";
  const loadedText = loadedAt ? `Ofertas, OV y tránsito cargados ${formatDateTime(loadedAt)}` : "Ofertas, OV y tránsito: sin hora de carga";

  const detailDrawer = selectedRow && (() => {
    const status = stageStatus(selectedRow);
    return <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer" aria-label={`${stageInfo[selectedRow.stage].short} ${selectedRow.docNum}`}>
      <div className="billing-drawer-header"><div><span className="billing-panel-kicker">{stageInfo[selectedRow.stage].label.toUpperCase()}</span><h2>{selectedRow.docNum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
      <div className="billing-drawer-status"><span className="billing-status-dot" /> {status.main} <span>{fullDate(selectedRow.documentDate)}</span></div>
      <div className="billing-drawer-total"><span>Saldo abierto</span><strong>{formatCurrency(selectedRow.balance)}</strong><small>Valor de la línea {formatCurrency(selectedRow.lineValue)} · {selectedRow.inDefault ? "cuenta en la vista acordada" : "fuera de la vista acordada"}</small></div>
      <dl className="billing-detail-list">
        <div><dt>Cliente</dt><dd>{selectedRow.customer || "—"}{selectedRow.customerCode ? ` (${selectedRow.customerCode})` : ""}</dd></div>
        <div><dt>Canal</dt><dd>{selectedRow.channel || "—"}</dd></div>
        <div><dt>Subgrupo · segmento</dt><dd>{selectedRow.customerSubgroup || "—"} · {selectedRow.segment || "—"}</dd></div>
        <div><dt>Asesor</dt><dd>{selectedRow.advisor || "Sin asesor"}</dd></div>
        <div><dt>Centro de costos</dt><dd>{selectedRow.costCenter || "—"}{selectedRow.costCenterName ? ` · ${selectedRow.costCenterName}` : ""}</dd></div>
        <div><dt>Tipo de ventas</dt><dd>{selectedRow.salesType || "—"}</dd></div>
        {selectedRow.stage === "A_OFERTA" && <>
          <div><dt>Válida hasta</dt><dd>{fullDate(selectedRow.validUntil)} · {selectedRow.validity || "—"}</dd></div>
          <div><dt>Estado de la oferta</dt><dd>{selectedRow.offerStateName || selectedRow.offerState || "Sin estado"}</dd></div>
        </>}
        {selectedRow.stage !== "A_OFERTA" && <div><dt>Tipo OV</dt><dd>{selectedRow.orderTypeName || selectedRow.orderType || "Sin tipo de OV"}</dd></div>}
        {selectedRow.stage === "B_OV" && <div><dt>Bloqueo</dt><dd>{selectedRow.orderBlock || "Sin bloqueo de OV"}{selectedRow.lineBlocked ? " · línea bloqueada" : ""}</dd></div>}
        {selectedRow.stage === "C_TRANSITO" && <>
          <div><dt>Status entrega</dt><dd>{selectedRow.deliveryStatusName || selectedRow.deliveryStatus || "Sin status"}</dd></div>
          <div><dt>Fecha ProyFAC</dt><dd>{fullDate(selectedRow.projectedBillingDate)}</dd></div>
        </>}
        {selectedRow.stage !== "A_OFERTA" && <div><dt>Fecha de despacho</dt><dd>{fullDate(selectedRow.dispatchDate)}</dd></div>}
        <div><dt>Artículo</dt><dd>{selectedRow.itemCode || "—"}{selectedRow.description ? ` · ${selectedRow.description}` : ""}</dd></div>
        <div><dt>Cantidad abierta</dt><dd>{formatNumber(selectedRow.openQuantity)} de {formatNumber(selectedRow.quantity)}</dd></div>
        <div><dt>DocEntry · LineNum</dt><dd>{selectedRow.docEntry} · {selectedRow.lineNum}</dd></div>
      </dl>
    </aside></>;
  })();

  return <DashboardShell navigation={commercialNavigation} activeHref={isDetailView ? "/consolidado-comercial/detalle" : "/consolidado-comercial"} title={isDetailView ? "Detalle de ofertas, OV y tránsito" : "Consolidado comercial"} className="commercial-shell" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>{isDetailView ? "Detalle de ofertas, OV y tránsito" : "Consolidado comercial"}</h1><p>{isDetailView ? "Consulta cada línea abierta de ofertas, órdenes de venta y entregas pendientes de facturar." : "Ofertas abiertas, OV pendientes y tránsito al momento de la consulta, más la facturación neta del periodo."}</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filtros</button></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className={`billing-filterbar-primary ${isDetailView ? "" : "cc-filterbar-primary"}`}>
        {!isDetailView && <>
          <label><CalendarDays size={15} /><span>Facturación</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value="Todos">Todo el año</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        </>}
        <label><Eye size={15} /><span>Vista</span><select value={draftFilters.view} onChange={(event) => updateDraft("view")(event.target.value)}><option value="default">Acordada (B2C)</option><option value="todo">Todos los canales</option></select></label>
        {isDetailView && <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar documento, cliente o artículo..." aria-label="Buscar documento, cliente o artículo" enterKeyHint="search" /></div>}
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros del consolidado</span></div><small>Los filtros de una sola etapa no quitan las demás etapas</small></div>
        <FilterSelect label="Canal" value={draftFilters.channel} emptyValue="Todos" emptyLabel="Todos los canales" options={channels} onChange={updateDraft("channel")} />
        <FilterSelect label="Segmento" value={draftFilters.segment} emptyValue="Todos" emptyLabel="Todos los segmentos" options={segments} onChange={updateDraft("segment")} />
        <FilterSelect label="Asesor" value={draftFilters.advisor} emptyValue="Todos" emptyLabel="Todos los asesores" options={advisors} onChange={updateDraft("advisor")} />
        <FilterSelect label="Centro de costos" value={draftFilters.costCenter} emptyValue="Todos" emptyLabel="Todos los centros" options={costCenters} onChange={updateDraft("costCenter")} />
        <FilterSelect label="Tipo OV (OV y tránsito)" value={draftFilters.orderType} emptyValue="Todos" emptyLabel="Todos los tipos" options={orderTypes} onChange={updateDraft("orderType")} />
        <FilterSelect label="Bloqueo (OV)" value={draftFilters.blocked} emptyValue="Todos" emptyLabel="Con y sin bloqueo" options={blockedOptions} onChange={updateDraft("blocked")} />
        <FilterSelect label="Status entrega (tránsito)" value={draftFilters.deliveryStatus} emptyValue="Todos" emptyLabel="Todos los status" options={deliveryStatuses} onChange={updateDraft("deliveryStatus")} />
        <FilterSelect label="Estado de la oferta" value={draftFilters.offerState} emptyValue="Todos" emptyLabel="Todos los estados" options={offerStates} onChange={updateDraft("offerState")} />
        <FilterSelect label="Vigencia (ofertas)" value={draftFilters.validity} emptyValue="Todos" emptyLabel="Vigentes y vencidas" options={validityOptions} onChange={updateDraft("validity")} />
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(pagination.page)}>Reintentar</button></div>}

    {!isDetailView && <>
      <div className="cc-metrics-grid">{loading ? Array.from({ length: 5 }, (_, index) => <MetricSkeleton key={index} />) : <>
        {openStages.map((stage) => {
          const total = stageTotals.get(stage);
          return <MetricCard key={stage} label={stageInfo[stage].label} value={formatCompactCurrency(total?.amount ?? 0)} detail={`${formatNumber(total?.documents ?? 0)} documentos · ${formatNumber(total?.lines ?? 0)} líneas`} icon={stageInfo[stage].icon} />;
        })}
        <MetricCard label={stageInfo.D_FACTURACION.label} value={formatCompactCurrency(stageTotals.get("D_FACTURACION")?.amount ?? 0)} detail={period ? `Del ${periodLabel(period)}` : "Facturas menos notas crédito"} icon={ReceiptText} />
        <MetricCard label="Total comercial" value={formatCompactCurrency(summary?.total ?? 0)} detail="A + B + C + D · no es ingreso contable" icon={Sigma} />
      </>}</div>
      <p className="cc-view-note">{viewNote} Ofertas, OV y tránsito son el saldo abierto ahora; la facturación es la del periodo elegido.</p>

      <div className="cc-two-column-grid">
        <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">COMPOSICIÓN</span><h2>Peso de cada etapa en el total</h2></div></div>
          {loading ? <div className="billing-zone-skeleton"><span /><span /><span /><span /></div> : <ShareList items={compositionItems} emptyText="No hay saldos para los filtros seleccionados." shareLabel="del total" />}
        </section>
        <section className="billing-panel cc-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DESGLOSE</span><h2>Consolidado por {activeBreakdown.label.toLowerCase()}</h2><p>{formatNumber(breakdownRows.length)} {breakdownRows.length === 1 ? "registro" : "registros"} · ordenados por total</p></div>{breakdownRows.length > breakdownPreviewCount && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllBreakdown((visible) => !visible)} aria-expanded={showAllBreakdown}>{showAllBreakdown ? "Mostrar menos" : `Ver los ${breakdownRows.length}`}</button>}</div>
          <div className="billing-tabs" role="tablist">{breakdownTabs.map((tab) => <button key={tab.key} type="button" className={breakdown === tab.key ? "active" : ""} onClick={() => { setBreakdown(tab.key); setShowAllBreakdown(false); }} role="tab" aria-selected={breakdown === tab.key}>{tab.label}</button>)}</div>
          <BreakdownTable rows={displayedBreakdown} column={activeBreakdown.column} loading={loading} labelFor={breakdownLabel} />
        </section>
      </div>
    </>}

    {isDetailView && <section className="billing-panel cc-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE</span><h2>Líneas abiertas</h2><p>{formatNumber(pagination.total)} líneas encontradas · página {pagination.page} de {pagination.totalPages} · {viewNote}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
      <div className="billing-tabs" role="tablist">{(["Todas", ...openStages] as StageTab[]).map((tab) => {
        const count = tab === "Todas" ? openStages.reduce((sum, stage) => sum + (stageTotals.get(stage)?.lines ?? 0), 0) : stageTotals.get(tab)?.lines ?? 0;
        return <button key={tab} type="button" className={stageTab === tab ? "active" : ""} onClick={() => setStageTab(tab)} role="tab" aria-selected={stageTab === tab} disabled={loading}>{tab === "Todas" ? "Todas" : stageInfo[tab].short}{summary && <span>{formatNumber(count)}</span>}</button>;
      })}</div>
      <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Etapa</th><th>Documento</th><th>Cliente</th><th>Asesor</th><th>Estado</th><th>Artículo</th><th className="align-right">Saldo</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => {
          const status = stageStatus(row);
          return <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}>
            <td><span className="cc-stage-tag">{stageInfo[row.stage].short}</span></td>
            <td><strong className="billing-docnum">{row.docNum}</strong><small>{fullDate(row.documentDate)}</small></td>
            <td><span className="billing-group-cell">{row.customer || "—"}</span><small>{[row.channel, row.segment].filter(Boolean).join(" · ")}</small></td>
            <td>{row.advisor || "Sin asesor"}</td>
            <td><span className="billing-group-cell">{status.main}</span><small>{status.detail}</small></td>
            <td><span className="billing-group-cell">{row.itemCode || "—"}</span><small className="cc-description">{row.description}</small></td>
            <td className="align-right number-cell">{formatCurrency(row.balance)}</td>
            <td><ChevronRight size={16} className="billing-row-chevron" /></td>
          </tr>;
        }) : <tr><td colSpan={8} className="billing-table-state"><Search size={22} /><strong>No encontramos líneas abiertas</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}
      </tbody></table></div>
      <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="líneas" onPageChange={changePage} />
    </section>}

    <footer className="billing-footer"><span>{loadedText}{period && !isDetailView ? ` · Facturación del ${periodLabel(period)}` : ""}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
