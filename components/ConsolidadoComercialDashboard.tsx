"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
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
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import MultiSelectFilter from "@/components/dashboard/MultiSelectFilter";
import ShareList from "@/components/dashboard/ShareList";
import TablePager from "@/components/dashboard/TablePager";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { dateValue, formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatMonthName, formatNumber } from "@/lib/dashboard/format";
import { commercialNavigation } from "@/lib/dashboard/navigation";
import type { FilterOption } from "@/lib/dashboard/options";
import {
  availableValues,
  emptyListFilters,
  listFilterConfig,
  listFilterKeys,
  type ListFilterKey,
  type ListFilters,
  parseCombinations,
  pruneSelections,
  sameValues,
} from "@/lib/consolidado-comercial/filters";
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

type DashboardFilters = ListFilters & {
  year: string;
  month: string;
  view: CommercialView;
  search: string;
  // Aplica el periodo también a A, B y C (cada etapa con su fecha). Por defecto no: todo lo abierto.
  dateFilter: boolean;
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
  dateFilter: false,
  ...emptyListFilters,
};
const pageSize = 50;
const filtersStorageKey = "consolidado-comercial:filtros";

// Parámetros de la API con los filtros aplicados. Los usan la consulta de la pantalla y la descarga en Excel, para que
// la descarga traiga exactamente lo que se ve (sin paginación).
function commercialParams(filters: DashboardFilters, stageTab: StageTab, withDetail: boolean) {
  const params = new URLSearchParams();
  params.set("vista", filters.view);
  if (filters.dateFilter) params.set("filtrarFecha", "1");
  // Mes en curso: sin anio/mes la API toma del día 1 hasta hoy; con ellos, el mes completo.
  const isCurrentMonth = filters.year === String(currentDate.getFullYear()) && filters.month === String(currentDate.getMonth() + 1);
  if (!isCurrentMonth) {
    params.set("anio", filters.year);
    if (filters.month !== "Todos") params.set("mes", filters.month);
  }
  // Selección múltiple: un parámetro repetido por cada valor elegido.
  for (const key of listFilterKeys) for (const value of filters[key]) params.append(listFilterConfig[key].param, value);
  if (withDetail && filters.search) params.set("search", filters.search);
  if (withDetail && stageTab !== "Todas") params.set("etapa", stageTab);
  return params;
}

// Filtros guardados en la sesión del navegador. Se validan campo por campo: lo que no sea válido vuelve al valor inicial.
function readStoredFilters(): { filters: DashboardFilters; stageTab: StageTab; includeOffers: boolean } | null {
  try {
    const raw = window.sessionStorage.getItem(filtersStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { filters?: Partial<Record<keyof DashboardFilters, unknown>>; stageTab?: unknown; includeOffers?: unknown };
    const source = parsed.filters ?? {};
    const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
    const filters: DashboardFilters = {
      year: text(source.year, initialFilters.year),
      month: text(source.month, initialFilters.month),
      view: source.view === "todo" ? "todo" : "default",
      search: text(source.search, ""),
      dateFilter: source.dateFilter === true,
      ...emptyListFilters,
    };
    for (const key of listFilterKeys) {
      const values = source[key];
      filters[key] = Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
    }
    const stageTab = (["Todas", ...openStages] as string[]).includes(String(parsed.stageTab)) ? parsed.stageTab as StageTab : "Todas";
    return { filters, stageTab, includeOffers: parsed.includeOffers !== false };
  } catch {
    return null;
  }
}
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

// Filtros avanzados en el orden en que se muestran.
const listFilterFields: Array<{ key: ListFilterKey; label: string; emptyLabel: string }> = [
  { key: "channel", label: "Canal", emptyLabel: "Todos los canales" },
  { key: "segment", label: "Segmento", emptyLabel: "Todos los segmentos" },
  { key: "advisor", label: "Asesor", emptyLabel: "Todos los asesores" },
  { key: "costCenter", label: "Centro de costos", emptyLabel: "Todos los centros" },
  { key: "orderType", label: "Tipo OV (ofertas, OV y tránsito)", emptyLabel: "Todos los tipos" },
  { key: "blocked", label: "Bloqueo (OV)", emptyLabel: "Con y sin bloqueo" },
  { key: "deliveryStatus", label: "Status entrega (tránsito)", emptyLabel: "Todos los status" },
  { key: "offerState", label: "Estado de la oferta", emptyLabel: "Todos los estados" },
  { key: "validity", label: "Vigencia (ofertas)", emptyLabel: "Vigentes y vencidas" },
];

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return a.year === b.year && a.month === b.month && a.view === b.view && a.search === b.search && a.dateFilter === b.dateFilter
    && listFilterKeys.every((key) => sameValues(a[key], b[key]));
}

function codeNameOptions(items: CodeName[] | undefined): FilterOption[] {
  return (items ?? []).map((item) => ({ value: item.code, label: item.name && item.name !== item.code ? `${item.code} · ${item.name}` : item.code }));
}

function valueOptions(values: string[] | undefined): FilterOption[] {
  return (values ?? []).map((value) => ({ value, label: value }));
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
// withDueDate: agrega el vencimiento de la oferta cuando la tabla no tiene su columna (pestaña Todas).
function stageStatus(row: CommercialRow, withDueDate = false) {
  if (row.stage === "A_OFERTA") {
    const state = row.offerStateName || row.offerState || "Sin estado";
    return { main: row.validity || "—", detail: withDueDate && row.validUntil ? `Vence ${fullDate(row.validUntil)} · ${state}` : state };
  }
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
  const [detailTotal, setDetailTotal] = useState<CommercialPayload["detailTotal"] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [stageTab, setStageTab] = useState<StageTab>("Todas");
  const [restored, setRestored] = useState(false);
  // Interruptor de la tarjeta A: si está apagado, las ofertas no suman en el total comercial ni en los totales derivados.
  const [includeOffers, setIncludeOffers] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownKey>("byAdvisor");
  const [showAllBreakdown, setShowAllBreakdown] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CommercialRow | null>(null);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = commercialParams(appliedFilters, isDetailView ? stageTab : "Todas", isDetailView);
      // El resumen no usa las filas del detalle: pide una sola.
      params.set("page", String(targetPage));
      params.set("pageSize", String(isDetailView ? pageSize : 1));

      const response = await fetch(`/api/consolidado-comercial?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<CommercialPayload & { error?: string }>(response, "La API del consolidado comercial");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el consolidado comercial.");
      if (!payload.summary) throw new Error("La API necesita actualizarse para devolver el consolidado comercial.");

      setRows(payload.rows);
      setSummary(payload.summary);
      setFilterOptions(payload.filterOptions ?? null);
      setPeriod(payload.period ?? null);
      setDetailTotal(payload.detailTotal ?? null);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLoadedAt(payload.loadedAt);
      setError("");
    } catch (loadError) {
      setRows([]);
      setDetailTotal(null);
      setSummary(null);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, isDetailView, stageTab]);

  // Los filtros aplicados y la pestaña de etapa se comparten entre el consolidado y el detalle durante la sesión de la
  // pestaña del navegador. Se leen al montar (antes de la primera consulta) y se guardan al aplicarlos.
  useEffect(() => {
    const stored = readStoredFilters();
    if (stored) {
      setAppliedFilters(stored.filters);
      setDraftFilters(stored.filters);
      setStageTab(stored.stageTab);
      setIncludeOffers(stored.includeOffers);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { window.sessionStorage.setItem(filtersStorageKey, JSON.stringify({ filters: appliedFilters, stageTab, includeOffers })); } catch { /* sin almacenamiento: los filtros no se comparten */ }
  }, [restored, appliedFilters, stageTab, includeOffers]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => void loadData(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadData, restored]);

  useEffect(() => {
    if (!selectedRow) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedRow(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRow]);

  // Catálogo completo de cada filtro (para los nombres y el orden) y combinaciones de la vista y el periodo consultados.
  const catalogs = useMemo<Record<ListFilterKey, FilterOption[]>>(() => ({
    channel: valueOptions(filterOptions?.channels),
    segment: valueOptions(filterOptions?.segments),
    advisor: valueOptions(filterOptions?.advisors),
    costCenter: codeNameOptions(filterOptions?.costCenters),
    orderType: codeNameOptions(filterOptions?.orderTypes),
    deliveryStatus: codeNameOptions(filterOptions?.deliveryStatuses),
    offerState: codeNameOptions(filterOptions?.offerStates),
    validity: validityOptions,
    blocked: blockedOptions,
  }), [filterOptions]);
  const combinations = useMemo(() => parseCombinations(filterOptions), [filterOptions]);
  // Opciones de cada filtro: solo los valores que existen con los demás filtros en borrador (listas dependientes).
  // Sin combinaciones (API anterior) se muestra el catálogo completo.
  const listOptions = useMemo(() => {
    const result = {} as Record<ListFilterKey, FilterOption[]>;
    for (const key of listFilterKeys) {
      if (!combinations) { result[key] = catalogs[key]; continue; }
      const available = availableValues(combinations, draftFilters, key);
      const known = catalogs[key].filter((option) => available.has(option.value));
      const knownValues = new Set(known.map((option) => option.value));
      const extra = Array.from(available).filter((value) => !knownValues.has(value)).sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));
      result[key] = [...known, ...extra];
    }
    return result;
  }, [catalogs, combinations, draftFilters]);
  const catalogLabels = useMemo(() => {
    const result = {} as Record<ListFilterKey, Map<string, string>>;
    for (const key of listFilterKeys) result[key] = new Map(catalogs[key].map((option) => [option.value, option.label]));
    return result;
  }, [catalogs]);
  const costCenterNames = useMemo(() => new Map((filterOptions?.costCenters ?? []).map((item) => [item.code, item.name])), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);

  const stageTotals = useMemo(() => new Map((summary?.stages ?? []).map((stage) => [stage.stage, stage])), [summary]);
  // En la pestaña Ofertas el vencimiento va en su propia columna; en Todas, debajo del estado de la oferta.
  const showDueColumn = stageTab === "A_OFERTA";
  const detailColumns = showDueColumn ? 9 : 8;
  // Total del detalle (todas las páginas). La API lo calcula con etapa y búsqueda; con la API anterior, sin búsqueda,
  // sale de los totales por etapa, que tienen los mismos filtros.
  // La API nueva agrupa las ofertas por documento (detailTotal.rows); la anterior devuelve una fila por línea.
  const offersGrouped = detailTotal?.rows !== undefined;
  const tableTotal = useMemo(() => {
    if (detailTotal) return { rows: detailTotal.rows ?? detailTotal.lines, lines: detailTotal.lines, balance: detailTotal.balance };
    if (appliedFilters.search) return null;
    const stages = stageTab === "Todas" ? openStages : [stageTab];
    return stages.reduce((total, stage) => {
      const lines = stageTotals.get(stage)?.lines ?? 0;
      return { rows: total.rows + lines, lines: total.lines + lines, balance: total.balance + (stageTotals.get(stage)?.amount ?? 0) };
    }, { rows: 0, lines: 0, balance: 0 });
  }, [detailTotal, appliedFilters.search, stageTab, stageTotals]);
  // Filas de cada pestaña: ofertas por documento (si la API ya agrupa); OV y tránsito por línea.
  const tabCount = (stage: CommercialOpenStage) => {
    const totals = stageTotals.get(stage);
    return (stage === "A_OFERTA" && offersGrouped ? totals?.documents : totals?.lines) ?? 0;
  };
  const commercialTotal = (summary?.total ?? 0) - (includeOffers ? 0 : stageTotals.get("A_OFERTA")?.amount ?? 0);
  const compositionItems = useMemo(() => (summary?.stages ?? [])
    .filter((stage) => includeOffers || stage.stage !== "A_OFERTA")
    .map((stage) => ({
      name: stageInfo[stage.stage].label,
      value: stage.amount,
      detail: `${formatNumber(stage.documents)} documentos`,
    })), [summary, includeOffers]);
  // Sin ofertas, la columna Total del desglose tampoco las suma y el orden se recalcula.
  const breakdownRows = useMemo(() => {
    const rows = summary?.[breakdown] ?? [];
    if (includeOffers) return rows;
    return rows.map((row) => ({ ...row, total: row.total - row.offers })).sort((a, b) => b.total - a.total);
  }, [summary, breakdown, includeOffers]);
  const displayedBreakdown = showAllBreakdown ? breakdownRows : breakdownRows.slice(0, breakdownPreviewCount);
  const activeBreakdown = breakdownTabs.find((tab) => tab.key === breakdown) ?? breakdownTabs[0];
  const breakdownLabel = useCallback((name: string) => {
    if (breakdown !== "byCostCenter") return name;
    const costCenterName = costCenterNames.get(name);
    return costCenterName && costCenterName !== name ? costCenterName : name;
  }, [breakdown, costCenterNames]);

  const updateDraft = (key: "year" | "month" | "search") => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  // Al cambiar un filtro de lista, los demás pierden los valores que ya no existen con la nueva selección.
  const updateList = (key: ListFilterKey) => (values: string[]) => setDraftFilters((current) => {
    const next = { ...current, [key]: values };
    return combinations ? { ...next, ...pruneSelections(combinations, next, key) } : next;
  });
  // La vista cambia el universo de las listas: se aplica de inmediato, junto con lo que haya en borrador.
  const changeView = (view: CommercialView) => {
    const nextFilters = normalizeFilters({ ...draftFilters, view });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };
  const resetFilters = () => { setDraftFilters(initialFilters); setAppliedFilters(initialFilters); setStageTab("Todas"); setIncludeOffers(true); };
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
  // Qué fechas aplican según lo consultado (period viene de la API con el periodo realmente usado).
  const periodNote = period?.dateFilter && period.openTo
    ? `Ofertas, OV y tránsito filtrados por su fecha del ${periodLabel({ from: period.from, to: period.openTo })}; facturación del ${periodLabel(period)}.`
    : "Ofertas, OV y tránsito son el saldo abierto ahora; la facturación es la del periodo elegido.";
  // Descarga del detalle: mismos filtros aplicados, pestaña de etapa y búsqueda que la tabla, todas las páginas.
  const exportHref = `/api/consolidado-comercial/export?${commercialParams(appliedFilters, stageTab, true).toString()}`;
  const loadedText = loadedAt ? `Ofertas, OV y tránsito cargados ${formatDateTime(loadedAt)}` : "Ofertas, OV y tránsito: sin hora de carga";

  const detailDrawer = selectedRow && (() => {
    const status = stageStatus(selectedRow);
    return <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer" aria-label={`${stageInfo[selectedRow.stage].short} ${selectedRow.docNum}`}>
      <div className="billing-drawer-header"><div><span className="billing-panel-kicker">{stageInfo[selectedRow.stage].label.toUpperCase()}</span><h2>{selectedRow.docNum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
      <div className="billing-drawer-status"><span className="billing-status-dot" /> {status.main} <span>{fullDate(selectedRow.documentDate)}</span></div>
      <div className="billing-drawer-total"><span>Saldo abierto</span><strong>{formatCurrency(selectedRow.balance)}</strong><small>{(selectedRow.lines ?? 1) > 1 ? `Valor de sus ${selectedRow.lines} líneas` : "Valor de la línea"} {formatCurrency(selectedRow.lineValue)} · {selectedRow.inDefault ? "cuenta en la vista acordada" : "fuera de la vista acordada"}</small></div>
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
        {(selectedRow.lines ?? 1) === 1 && <div><dt>Artículo</dt><dd>{selectedRow.itemCode || "—"}{selectedRow.description ? ` · ${selectedRow.description}` : ""}</dd></div>}
        {(selectedRow.lines ?? 1) > 1 ? <div><dt>Líneas de la oferta</dt><dd>{formatNumber(selectedRow.lines ?? 1)} artículos con saldo abierto</dd></div> : <div><dt>Cantidad abierta</dt><dd>{formatNumber(selectedRow.openQuantity)} de {formatNumber(selectedRow.quantity)}</dd></div>}
        {(selectedRow.lines ?? 1) > 1 ? <div><dt>DocEntry</dt><dd>{selectedRow.docEntry}</dd></div> : <div><dt>DocEntry · LineNum</dt><dd>{selectedRow.docEntry} · {selectedRow.lineNum}</dd></div>}
      </dl>
    </aside></>;
  })();

  return <DashboardShell navigation={commercialNavigation} activeHref={isDetailView ? "/consolidado-comercial/detalle" : "/consolidado-comercial"} title={isDetailView ? "Detalle de ofertas, OV y tránsito" : "Consolidado comercial"} className="commercial-shell" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>{isDetailView ? "Detalle de ofertas, OV y tránsito" : "Consolidado comercial"}</h1><p>{isDetailView ? "Consulta cada línea abierta de ofertas, órdenes de venta y entregas pendientes de facturar." : "Ofertas abiertas, OV pendientes y tránsito al momento de la consulta, más la facturación neta del periodo."}</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filtros</button></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className={`billing-filterbar-primary ${isDetailView ? "cc-filterbar-detail" : "cc-filterbar-primary"}`}>
        <label><CalendarDays size={15} /><span>Periodo</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value="Todos">Todo el año</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        <label><Eye size={15} /><span>Vista</span><select value={draftFilters.view} onChange={(event) => changeView(event.target.value as CommercialView)} disabled={loading}><option value="default">Acordada (B2C)</option><option value="todo">Todos los canales</option></select></label>
        {isDetailView && <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar documento, cliente o artículo..." aria-label="Buscar documento, cliente o artículo" enterKeyHint="search" /></div>}
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      <div className="cc-date-scope"><button type="button" role="switch" aria-checked={draftFilters.dateFilter} className="cc-switch" onClick={() => setDraftFilters((current) => ({ ...current, dateFilter: !current.dateFilter }))}><span className="cc-switch-track" aria-hidden="true"><span className="cc-switch-thumb" /></span>Filtrar ofertas, OV y tránsito por el periodo</button><small>{draftFilters.dateFilter ? "Ofertas por fecha de cierre, OV por fecha de despacho de la línea y tránsito por Fecha ProyFAC; sin esa fecha no entran. El mes se toma completo." : "Apagado: ofertas, OV y tránsito muestran todo el saldo abierto; el periodo solo filtra la facturación."}</small></div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros del consolidado</span></div><small>Puedes elegir varios valores; cada lista muestra solo lo que existe con los demás filtros</small></div>
        {listFilterFields.map(({ key, label, emptyLabel }) => <MultiSelectFilter key={key} label={label} values={draftFilters[key]} options={listOptions[key]} emptyLabel={emptyLabel} onChange={updateList(key)} labelFor={(value) => catalogLabels[key].get(value) ?? value} />)}
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(pagination.page)}>Reintentar</button></div>}

    {!isDetailView && <>
      <div className="cc-metrics-grid">{loading ? Array.from({ length: 5 }, (_, index) => <MetricSkeleton key={index} />) : <>
        {openStages.map((stage) => {
          const total = stageTotals.get(stage);
          const isOffers = stage === "A_OFERTA";
          return <MetricCard key={stage} label={stageInfo[stage].label} value={formatCompactCurrency(total?.amount ?? 0)} detail={`${formatNumber(total?.documents ?? 0)} documentos · ${formatNumber(total?.lines ?? 0)} líneas`} icon={stageInfo[stage].icon} muted={isOffers && !includeOffers}
            action={isOffers ? <button type="button" role="switch" aria-checked={includeOffers} className="cc-switch" onClick={() => setIncludeOffers((value) => !value)}><span className="cc-switch-track" aria-hidden="true"><span className="cc-switch-thumb" /></span>{includeOffers ? "Suma en el total" : "No suma en el total"}</button> : undefined} />;
        })}
        <MetricCard label={stageInfo.D_FACTURACION.label} value={formatCompactCurrency(stageTotals.get("D_FACTURACION")?.amount ?? 0)} detail={period ? `Del ${periodLabel(period)}` : "Facturas menos notas crédito"} icon={ReceiptText} />
        <MetricCard label="Total comercial" value={formatCompactCurrency(commercialTotal)} detail={`${includeOffers ? "A + B + C + D" : "B + C + D, sin ofertas"} · no es ingreso contable`} icon={Sigma} />
      </>}</div>
      <p className="cc-view-note">{viewNote} {periodNote}</p>

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

    {isDetailView && <section className="billing-panel cc-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE</span><h2>Saldos abiertos</h2><p>{formatNumber(pagination.total)} registros{offersGrouped ? " (ofertas por documento; OV y tránsito por línea)" : ""} · página {pagination.page} de {pagination.totalPages} · {viewNote} {period?.dateFilter ? periodNote : ""}</p></div><div className="billing-table-actions"><a className="billing-secondary-button small billing-download-button" href={exportHref} download aria-label="Descargar en Excel las filas del detalle con los filtros aplicados"><Download size={15} /> Exportar a Excel</a><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
      <div className="billing-tabs" role="tablist">{(["Todas", ...openStages] as StageTab[]).map((tab) => {
        const count = tab === "Todas" ? openStages.reduce((sum, stage) => sum + tabCount(stage), 0) : tabCount(tab);
        return <button key={tab} type="button" className={stageTab === tab ? "active" : ""} onClick={() => setStageTab(tab)} role="tab" aria-selected={stageTab === tab} disabled={loading}>{tab === "Todas" ? "Todas" : stageInfo[tab].short}{summary && <span>{formatNumber(count)}</span>}</button>;
      })}</div>
      <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Etapa</th><th>Documento</th>{showDueColumn && <th>Vence</th>}<th>Cliente</th><th>Asesor</th><th>Estado</th><th>Artículo</th><th className="align-right">Saldo</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={detailColumns}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => {
          const status = stageStatus(row, !showDueColumn);
          return <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}>
            <td><span className="cc-stage-tag">{stageInfo[row.stage].short}</span></td>
            <td><strong className="billing-docnum">{row.docNum}</strong><small>{row.stage === "A_OFERTA" ? `Creada ${fullDate(row.documentDate)}` : fullDate(row.documentDate)}</small></td>
            {showDueColumn && <td><span className="billing-date-cell">{fullDate(row.validUntil)}</span><small>{row.validity || "—"}</small></td>}
            <td><span className="billing-group-cell">{row.customer || "—"}</span><small>{[row.channel, row.segment].filter(Boolean).join(" · ")}</small></td>
            <td>{row.advisor || "Sin asesor"}</td>
            <td><span className="billing-group-cell">{status.main}</span><small>{status.detail}</small></td>
            <td>{(row.lines ?? 1) > 1 ? <><span className="billing-group-cell">{row.description}</span><small>Varias líneas del documento</small></> : <><span className="billing-group-cell">{row.itemCode || "—"}</span><small className="cc-description">{row.description}</small></>}</td>
            <td className="align-right number-cell">{formatCurrency(row.balance)}</td>
            <td><ChevronRight size={16} className="billing-row-chevron" /></td>
          </tr>;
        }) : <tr><td colSpan={detailColumns} className="billing-table-state"><Search size={22} /><strong>No encontramos líneas abiertas</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}
      </tbody>
        {!loading && rows.length > 0 && tableTotal && <tfoot><tr className="cc-total-row"><td colSpan={detailColumns - 2}><strong>Total</strong><small>{formatNumber(tableTotal.rows)} registros{tableTotal.rows !== tableTotal.lines ? ` · ${formatNumber(tableTotal.lines)} líneas de SAP` : ""}{stageTab === "Todas" ? "" : ` de ${stageInfo[stageTab].short.toLowerCase()}`} · todas las páginas</small></td><td className="align-right number-cell">{formatCurrency(tableTotal.balance)}</td><td /></tr></tfoot>}
      </table></div>
      <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="registros" onPageChange={changePage} />
    </section>}

    <footer className="billing-footer"><span>{loadedText}{period && !isDetailView ? ` · Facturación del ${periodLabel(period)}` : ""}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
