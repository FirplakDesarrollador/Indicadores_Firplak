"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  Percent,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, type TooltipProps, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import ShareList from "@/components/dashboard/ShareList";
import TablePager from "@/components/dashboard/TablePager";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { creditNoteNavigation } from "@/lib/dashboard/navigation";
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
import { toOptions } from "@/lib/dashboard/options";
import type { CreditNoteFilterOptions, CreditNotePayload, CreditNoteRow, CreditNoteSummary } from "@/lib/notas-credito/types";

type DashboardFilters = {
  year: string;
  month: string;
  search: string;
  salesType: string;
  department: string;
  concept: string;
  creditType: string;
  seniorSeller: string;
};

// Por defecto el año en curso completo, para ver la evolución mensual del % frente a la meta.
const initialFilters: DashboardFilters = {
  year: String(new Date().getFullYear()),
  month: "Todos",
  search: "",
  salesType: "Todos",
  department: "Todos",
  concept: "Todos",
  creditType: "Todos",
  seniorSeller: "Todos",
};
const pageSize = 50;
const conceptPreviewCount = 8;

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

function formatRate(value: number | null) {
  return value === null ? "—" : formatPercent(value);
}

function monthLabel(year: number, month: number, withYear: boolean) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date(year, month - 1, 1)).replace(".", "");
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return withYear ? `${label} ${year}` : label;
}

function ChartTooltip({ active, payload, label, rows }: TooltipProps<number, string> & { rows: (data: Record<string, unknown>) => Array<[string, string]> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, unknown>;
  return <div style={chartTooltipStyle} className="credit-chart-tooltip"><strong>{label}</strong>{rows(data).map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b></div>)}</div>;
}

type SellerGroup = { name: string; total: number; documents: number; juniors: Array<{ name: string; total: number; documents: Array<{ docnum: string; value: number }> }> };

function groupSellers(sellers: CreditNoteSummary["sellers"]): SellerGroup[] {
  const seniors = new Map<string, Map<string, Array<{ docnum: string; value: number }>>>();
  for (const item of sellers) {
    const senior = item.seniorSeller || "Sin vendedor";
    const junior = item.juniorSeller || "Sin vendedor junior";
    const juniors = seniors.get(senior) ?? new Map<string, Array<{ docnum: string; value: number }>>();
    juniors.set(junior, [...(juniors.get(junior) ?? []), { docnum: item.docnum, value: item.creditNotes }]);
    seniors.set(senior, juniors);
  }
  return Array.from(seniors, ([name, juniors]) => {
    const juniorList = Array.from(juniors, ([juniorName, documents]) => ({ name: juniorName, total: documents.reduce((sum, doc) => sum + doc.value, 0), documents }))
      .sort((a, b) => b.total - a.total);
    return { name, total: juniorList.reduce((sum, junior) => sum + junior.total, 0), documents: juniorList.reduce((sum, junior) => sum + junior.documents.length, 0), juniors: juniorList };
  }).sort((a, b) => b.total - a.total);
}

export default function NotasCreditoDashboard({ mode = "overview" }: { mode?: "overview" | "detail" }) {
  const isDetailView = mode === "detail";
  const [rows, setRows] = useState<CreditNoteRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterOptions, setFilterOptions] = useState<CreditNoteFilterOptions | null>(null);
  const [summary, setSummary] = useState<CreditNoteSummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Los filtros se editan como borrador y solo consultan la API al aplicarlos (botón, lupa o Enter).
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllConcepts, setShowAllConcepts] = useState(false);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<CreditNoteRow | null>(null);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      const { year, month, search, salesType, department, concept, creditType, seniorSeller } = appliedFilters;
      if (year !== "Todos") params.set("anio", year);
      if (month !== "Todos") params.set("mes", month);
      if (salesType !== "Todos") params.set("tipoVentas", salesType);
      if (department !== "Todos") params.set("departamento", department);
      if (concept !== "Todos") params.set("concepto", concept);
      if (creditType !== "Todos") params.set("tipoNc", creditType);
      if (seniorSeller !== "Todos") params.set("vendedorSenior", seniorSeller);
      if (search) params.set("search", search);

      const response = await fetch(`/api/notas-credito?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<CreditNotePayload & { error?: string }>(response, "La API de notas crédito");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar las notas crédito.");
      if (!payload.summary) throw new Error("La API necesita actualizarse para devolver el resumen de notas crédito.");

      setRows(payload.rows);
      setAvailableYears(payload.years ?? []);
      setFilterOptions(payload.filterOptions ?? null);
      setSummary(payload.summary);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLastUpdated(payload.updatedAt);
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

  const years = useMemo(() => availableYears.length ? availableYears : [Number(initialFilters.year)], [availableYears]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const salesTypes = useMemo(() => toOptions(filterOptions?.salesTypes ?? []), [filterOptions]);
  const departments = useMemo(() => toOptions(filterOptions?.departments ?? []), [filterOptions]);
  const concepts = useMemo(() => toOptions(filterOptions?.concepts ?? []), [filterOptions]);
  const creditTypes = useMemo(() => toOptions(filterOptions?.creditTypeGroups ?? []), [filterOptions]);
  const seniorSellers = useMemo(() => toOptions(filterOptions?.seniorSellers ?? []), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);

  const monthly = useMemo(() => {
    const items = summary?.monthly ?? [];
    const multipleYears = new Set(items.map((item) => item.year)).size > 1;
    return items.map((item) => ({
      label: monthLabel(item.year, item.month, multipleYears),
      invoiced: item.invoiced,
      creditNotes: item.creditNotes,
      net: item.net,
      // Como en el Power BI, los meses sin % no se dibujan.
      rate: item.creditNoteRate ? item.creditNoteRate : null,
      previousRate: item.previousYearRate ? item.previousYearRate : null,
    }));
  }, [summary]);
  const departmentItems = useMemo(() => (summary?.departments ?? []).map((item) => ({ name: item.name ?? "Vacío", value: item.creditNotes })), [summary]);
  const creditTypeItems = useMemo(() => (summary?.creditTypeGroups ?? []).map((item) => ({ name: item.name ?? "Vacío", value: item.creditNotes })), [summary]);
  const conceptItems = useMemo(() => (summary?.concepts ?? []).map((item) => ({ name: item.name ?? "Sin concepto", value: item.creditNotes, detail: `${formatRate(item.rate)} de la facturación` })), [summary]);
  const displayedConcepts = showAllConcepts ? conceptItems : conceptItems.slice(0, conceptPreviewCount);
  const sellerGroups = useMemo(() => groupSellers(summary?.sellers ?? []), [summary]);

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

  const rate = summary?.creditNoteRate ?? null;
  const target = summary?.target ?? null;
  const rateDetail = target === null ? "Sin meta" : rate === null ? `Meta ${formatPercent(target)} · sin facturación en el periodo` : `Meta ${formatPercent(target)} · ${rate > target ? "por encima de la meta" : "dentro de la meta"}`;

  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer" aria-label={`Nota crédito ${selectedRow.docnum}`}>
    <div className="billing-drawer-header"><div><span className="billing-panel-kicker">NOTA CRÉDITO</span><h2>{selectedRow.docnum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
    <div className="billing-drawer-status"><span className="billing-status-dot" /> Contabilizada <span>{formatDate(selectedRow.date)} {selectedRow.date ? dateValue(selectedRow.date).getFullYear() : ""}</span></div>
    <div className="billing-drawer-total"><span>Valor de la nota</span><strong>{formatCurrency(selectedRow.creditNote)}</strong><small>{selectedRow.creditTypeGroup || "Sin tipo"} · {selectedRow.department || "Sin departamento"}</small></div>
    <dl className="billing-detail-list">
      <div><dt>Cliente</dt><dd>{selectedRow.customer}{selectedRow.customerCode ? ` (${selectedRow.customerCode})` : ""}</dd></div>
      <div><dt>Subgrupo de cliente</dt><dd>{selectedRow.customerSubgroup || "—"}</dd></div>
      <div><dt>Tipo de venta</dt><dd>{selectedRow.salesType || "—"}</dd></div>
      <div><dt>Territorio</dt><dd>{selectedRow.territory || "—"}</dd></div>
      <div><dt>Vendedor</dt><dd>{selectedRow.seniorSeller || "—"}{selectedRow.juniorSeller ? ` · ${selectedRow.juniorSeller}` : ""}</dd></div>
      <div><dt>Tipo NC</dt><dd>{selectedRow.creditType || "—"}</dd></div>
      <div><dt>Concepto</dt><dd>{selectedRow.concept || "—"}{selectedRow.conceptCode ? ` (${selectedRow.conceptCode})` : ""}</dd></div>
      <div><dt>Comentarios</dt><dd>{selectedRow.comments || "—"}</dd></div>
      <div><dt>Ciudad</dt><dd>{selectedRow.city || "—"}</dd></div>
      <div><dt>Teléfono</dt><dd>{selectedRow.phone || "—"}</dd></div>
      <div><dt>Obra</dt><dd>{selectedRow.project || "—"}</dd></div>
      <div><dt>Punto de venta</dt><dd>{selectedRow.storeName || selectedRow.storeCode || "—"}</dd></div>
    </dl>
  </aside></>;

  return <DashboardShell navigation={creditNoteNavigation} activeHref={isDetailView ? "/notas-credito/detalle" : "/notas-credito"} title={isDetailView ? "Detalle de notas crédito" : "Notas crédito"} className="credit-notes-shell" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> CARTERA</div><h1>{isDetailView ? "Detalle de notas crédito" : "Notas crédito"}</h1><p>{isDetailView ? "Consulta cada documento de nota crédito con su cliente, concepto, vendedor y comentarios." : "Consulta el peso de las notas crédito sobre la facturación y sus causas por departamento, concepto y vendedor."}</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filtros</button></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className="billing-filterbar-primary">
        <label><CalendarDays size={15} /><span>Periodo</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}><option value="Todos">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value="Todos">Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar documento, cliente o comentario..." aria-label="Buscar documento, cliente o comentario" enterKeyHint="search" /></div>
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros de las notas</span></div><small>Tipo de venta y vendedor también filtran la facturación</small></div>
        <FilterSelect label="Tipo de venta" value={draftFilters.salesType} emptyValue="Todos" emptyLabel="Todos los tipos" options={salesTypes} onChange={updateDraft("salesType")} />
        <FilterSelect label="Departamento" value={draftFilters.department} emptyValue="Todos" emptyLabel="Todos los departamentos" options={departments} onChange={updateDraft("department")} />
        <FilterSelect label="Concepto" value={draftFilters.concept} emptyValue="Todos" emptyLabel="Todos los conceptos" options={concepts} onChange={updateDraft("concept")} />
        <FilterSelect label="Tipo NC" value={draftFilters.creditType} emptyValue="Todos" emptyLabel="Todos los tipos NC" options={creditTypes} onChange={updateDraft("creditType")} />
        <FilterSelect label="Vendedor" value={draftFilters.seniorSeller} emptyValue="Todos" emptyLabel="Todos los vendedores" options={seniorSellers} onChange={updateDraft("seniorSeller")} />
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}

    {!isDetailView && <>
    <div className="credit-metrics-grid">{loading ? Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />) : <>
      <MetricCard label="Notas crédito" value={formatCompactCurrency(summary?.creditNotes ?? 0)} detail={`${formatNumber(pagination.total)} documentos`} icon={ReceiptText} />
      <MetricCard label="Facturación" value={formatCompactCurrency(summary?.invoiced ?? 0)} detail="Facturas del periodo" icon={TrendingUp} />
      <MetricCard label="Ventas netas" value={formatCompactCurrency(summary?.net ?? 0)} detail="Facturado menos notas crédito" icon={ArrowUpRight} />
      <MetricCard label="% sobre la facturación" value={formatRate(rate)} detail={rateDetail} icon={Percent} />
    </>}</div>

    <div className="credit-two-column-grid">
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN MENSUAL</span><h2>Facturación y notas crédito</h2></div></div>
        <div className="billing-chart-legend"><span><i className="credit-legend-solid" /> Facturado</span><span><i className="credit-legend-dashed" /> Notas crédito</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : monthly.length ? <div className="billing-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={(value) => `$${formatNumber(Math.round(Number(value) / 1_000_000))} M`} width={72} />
          <Tooltip cursor={{ stroke: chartColors.grid }} content={<ChartTooltip rows={(data) => [["Facturado", formatCurrency(Number(data.invoiced))], ["Notas crédito", formatCurrency(Number(data.creditNotes))], ["Ventas netas", formatCurrency(Number(data.net))]]} />} />
          <Line type="linear" dataKey="invoiced" name="Facturado" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }} isAnimationActive={false} />
          <Line type="linear" dataKey="creditNotes" name="Notas crédito" stroke={chartColors.secondary} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }} isAnimationActive={false} />
        </LineChart></ResponsiveContainer></div> : <div className="billing-empty">No hay datos mensuales para los filtros seleccionados.</div>}
      </section>
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">INDICADOR</span><h2>% de notas crédito frente a la meta</h2></div></div>
        <div className="billing-chart-legend"><span><i className="credit-legend-solid" /> % del periodo</span><span><i className="credit-legend-dashed" /> % del año anterior</span><span><i className="credit-legend-target" /> Meta {target === null ? "" : formatPercent(target)}</span></div>
        {loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : monthly.length ? <div className="billing-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={(value) => formatPercent(Number(value))} width={64} />
          <Tooltip cursor={{ stroke: chartColors.grid }} content={<ChartTooltip rows={(data) => [["% del periodo", formatRate(data.rate as number | null)], ["% del año anterior", formatRate(data.previousRate as number | null)], ["Meta", formatRate(target)]]} />} />
          {target !== null && <ReferenceLine y={target} stroke={chartColors.axis} strokeDasharray="2 4" strokeWidth={2} ifOverflow="extendDomain" />}
          <Line type="linear" dataKey="rate" name="% del periodo" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }} isAnimationActive={false} connectNulls={false} />
          <Line type="linear" dataKey="previousRate" name="% del año anterior" stroke={chartColors.secondary} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeWidth: 2, fill: chartColors.surface }} isAnimationActive={false} connectNulls={false} />
        </LineChart></ResponsiveContainer></div> : <div className="billing-empty">No hay datos mensuales para los filtros seleccionados.</div>}
      </section>
    </div>

    <div className="credit-two-column-grid">
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">DISTRIBUCIÓN</span><h2>Notas por departamento</h2></div></div>
        {loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <ShareList items={departmentItems} emptyText="No hay notas crédito para los filtros seleccionados." />}
      </section>
      <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">DISTRIBUCIÓN</span><h2>Notas por tipo NC</h2><p className="credit-panel-note">Solo ventas Exterior, Nacional o sin tipo de venta, como en el reporte anterior.</p></div></div>
        {loading ? <div className="billing-zone-skeleton"><span /><span /></div> : <ShareList items={creditTypeItems} emptyText="No hay notas de ventas Exterior o Nacional para los filtros seleccionados." />}
      </section>
    </div>

    <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">CAUSAS</span><h2>Notas por concepto</h2></div>{conceptItems.length > conceptPreviewCount && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllConcepts((visible) => !visible)} aria-expanded={showAllConcepts}>{showAllConcepts ? "Mostrar menos" : `Ver los ${conceptItems.length} conceptos`}</button>}</div>
      {loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <ShareList items={displayedConcepts} emptyText="No hay notas crédito para los filtros seleccionados." />}
    </section>

    <section className="billing-panel credit-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">RESPONSABLES</span><h2>Notas por vendedor</h2><p>Abre un vendedor para ver sus vendedores junior y documentos.</p></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table credit-seller-table"><thead><tr><th>Vendedor</th><th className="align-right">Documentos</th><th className="align-right">Notas crédito</th></tr></thead><tbody>
        {loading ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={3}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : sellerGroups.length ? sellerGroups.map((seller) => {
          const expanded = expandedSeller === seller.name;
          return [
            <tr key={seller.name} className="credit-seller-row"><td><button type="button" className="credit-seller-toggle" onClick={() => setExpandedSeller(expanded ? null : seller.name)} aria-expanded={expanded}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{seller.name}</button></td><td className="align-right">{formatNumber(seller.documents)}</td><td className="align-right number-cell">{formatCurrency(seller.total)}</td></tr>,
            ...(expanded ? seller.juniors.map((junior) => <tr key={`${seller.name}-${junior.name}`} className="credit-junior-row"><td><span>{junior.name}</span><small>{junior.documents.map((doc) => `${doc.docnum} (${formatCompactCurrency(doc.value)})`).join(" · ")}</small></td><td className="align-right">{formatNumber(junior.documents.length)}</td><td className="align-right number-cell">{formatCurrency(junior.total)}</td></tr>) : []),
          ];
        }) : <tr><td colSpan={3} className="billing-table-state"><strong>Sin vendedores para los filtros seleccionados</strong></td></tr>}
      </tbody></table></div>
    </section>

    </>}

    {isDetailView && <section className="billing-panel credit-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE</span><h2>Documentos de notas crédito</h2><p>{formatNumber(pagination.total)} registros encontrados · página {pagination.page} de {pagination.totalPages}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha</th><th>Documento</th><th>Cliente</th><th>Tipo de venta</th><th>Concepto</th><th>Vendedor</th><th className="align-right">Valor</th><th aria-label="Abrir detalle" /></tr></thead><tbody>
        {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}>
          <td><span className="billing-date-cell">{formatDate(row.date)}</span><small>{row.date ? dateValue(row.date).getFullYear() : ""}</small></td>
          <td><strong className="billing-docnum">{row.docnum}</strong><small>{row.creditTypeGroup || "Sin tipo"}</small></td>
          <td><span className="billing-group-cell">{row.customer}</span><small>{row.customerSubgroup}</small></td>
          <td>{row.salesType || "—"}</td>
          <td><span className="billing-group-cell">{row.concept || "Sin concepto"}</span><small>{row.department || "Sin departamento"}</small></td>
          <td>{row.seniorSeller || "—"}</td>
          <td className="align-right number-cell credit-cell">{formatCurrency(row.creditNote)}</td>
          <td><ChevronRight size={16} className="billing-row-chevron" /></td>
        </tr>) : <tr><td colSpan={8} className="billing-table-state"><Search size={22} /><strong>No encontramos notas crédito</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}
      </tbody></table></div>
      <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="documentos" onPageChange={changePage} />
    </section>}

    <footer className="billing-footer"><span>{lastUpdated ? `Actualizado ${formatDateTime(lastUpdated)}` : "Actualización automática"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
