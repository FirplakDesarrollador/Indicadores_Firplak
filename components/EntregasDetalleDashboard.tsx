"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Database, Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import TablePager from "@/components/dashboard/TablePager";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { billingNavigation } from "@/lib/dashboard/navigation";
import { dateValue, formatCurrency, formatDate, formatDateTime, formatMonthName, formatNumber } from "@/lib/dashboard/format";
import { toOptions, uniqueSorted } from "@/lib/dashboard/options";
import { type DeliveryPayload, type DeliveryRow, type DeliverySummary, deliveryNet } from "@/lib/facturacion/types";
import { companies } from "@/lib/metas/targets";

const pageSize = 50;
const initialPeriod = new Date();

type DeliveryFilters = {
  year: string;
  month: string;
  search: string;
  company: string;
  subgroup: string;
  group: string;
};

const initialFilters: DeliveryFilters = {
  year: String(initialPeriod.getFullYear()),
  month: String(initialPeriod.getMonth() + 1),
  search: "",
  company: "Todas",
  subgroup: "Todos",
  group: "Todos",
};

function sameFilters(a: DeliveryFilters, b: DeliveryFilters) {
  return (Object.keys(a) as Array<keyof DeliveryFilters>).every((key) => a[key] === b[key]);
}

function movementLabel(row: DeliveryRow) {
  return row.movementType || "Entrega";
}

// Devoluciones y notas crédito de devolución restan: se marcan para distinguirlas de las entregas.
function isReturn(row: DeliveryRow) {
  return Boolean(row.movementType && row.movementType !== "Entrega");
}

export default function EntregasDetalleDashboard() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [options, setOptions] = useState<DeliveryPayload["filterOptions"] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DeliveryFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DeliveryFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DeliveryRow | null>(null);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      const { year, month, search, company, subgroup, group } = appliedFilters;
      if (year !== "Todos") params.set("anio", year);
      if (month !== "Todos") params.set("mes", month);
      if (company !== "Todas") params.set("empresa", company);
      if (subgroup !== "Todos") params.set("subgrupoCliente", subgroup);
      if (group !== "Todos") params.set("grupoCliente", group);
      if (search) params.set("search", search);
      const response = await fetch(`/api/entregas?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<DeliveryPayload & { error?: string }>(response, "La API de entregas");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar las entregas.");
      setRows(payload.rows);
      setSummary(payload.summary ?? null);
      setAvailableYears(payload.years ?? []);
      setOptions(payload.filterOptions ?? null);
      setPagination(payload.pagination ?? { page: targetPage, pageSize, total: payload.rows.length, totalPages: 1 });
      setLastUpdated(payload.updatedAt);
      setError("");
    } catch (loadError) {
      setRows([]);
      setSummary(null);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las entregas.");
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

  const years = useMemo(() => availableYears.length ? availableYears : [initialPeriod.getFullYear()], [availableYears]);
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const companyOptions = toOptions(options?.companies ?? [...companies]);
  const subgroups = useMemo(() => toOptions(options?.customerSubgroups ?? uniqueSorted(rows.map((row) => row.customerSubgroup ?? ""))), [options, rows]);
  const groups = useMemo(() => toOptions(options?.customerGroups ?? uniqueSorted(rows.map((row) => row.customerGroup))), [options, rows]);
  const normalized = { ...draftFilters, search: draftFilters.search.trim() };
  const hasPendingFilters = !sameFilters(normalized, appliedFilters);

  const updateDraft = (key: keyof DeliveryFilters) => (value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => { setDraftFilters(initialFilters); setAppliedFilters(initialFilters); };
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftFilters(normalized);
    if (hasPendingFilters) setAppliedFilters(normalized);
  };
  const changePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > pagination.totalPages || targetPage === pagination.page) return;
    setPagination((current) => ({ ...current, page: targetPage }));
    void loadData(targetPage);
  };

  const totalsCaption = summary
    ? summary.returns !== undefined
      ? `Entregas ${formatCurrency(summary.delivered ?? 0)} · devoluciones ${formatCurrency(summary.returns)} · netas ${formatCurrency(deliveryNet(summary))}`
      : `Valor sin IVA ${formatCurrency(summary.valueWithoutVat)}`
    : "";

  const detailDrawer = selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer">
    <div className="billing-drawer-header"><div><span className="billing-panel-kicker">{movementLabel(selectedRow).toUpperCase()}</span><h2>{selectedRow.delivery}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div>
    <div className="billing-drawer-status"><span className="billing-status-dot" /> {selectedRow.deliveryStatus || "Sin estado"} <span>{formatDate(selectedRow.deliveryDate)}</span></div>
    <div className="billing-drawer-total"><span>Valor sin IVA</span><strong>{formatCurrency(selectedRow.valueWithoutVat)}</strong><small>{formatNumber(selectedRow.quantity)} unidades · {formatNumber(selectedRow.invoicedQuantity)} facturadas</small></div>
    <dl className="billing-detail-list">
      <div><dt>Empresa</dt><dd>{selectedRow.company ?? "—"}</dd></div>
      <div><dt>Mercado</dt><dd>{selectedRow.market || "—"}</dd></div>
      <div><dt>Cliente</dt><dd>{selectedRow.customer || "—"}</dd></div>
      <div><dt>Código de cliente</dt><dd>{selectedRow.customerCode || "—"}</dd></div>
      <div><dt>Grupo de cliente</dt><dd>{selectedRow.customerGroup || "—"}</dd></div>
      <div><dt>Subgrupo de cliente</dt><dd>{selectedRow.customerSubgroup ?? "—"}</dd></div>
      <div><dt>Centro de costos</dt><dd>{selectedRow.costCenter || "—"}</dd></div>
      <div><dt>Asesor</dt><dd>{selectedRow.advisor || "—"}</dd></div>
      <div><dt>Orden de venta</dt><dd>{selectedRow.salesOrder || "—"}</dd></div>
      {selectedRow.baseDocument && <div><dt>Documento base</dt><dd>{selectedRow.baseDocument}</dd></div>}
      <div><dt>Factura</dt><dd>{selectedRow.invoice ?? "—"}</dd></div>
      <div><dt>Referencia</dt><dd>{selectedRow.referenceCode || "—"}<small className="billing-detail-sub">{selectedRow.referenceDescription}</small></dd></div>
      <div><dt>Transportador</dt><dd>{selectedRow.carrier || "—"}</dd></div>
      <div><dt>Guía</dt><dd>{selectedRow.trackingNumber || "—"}</dd></div>
      <div><dt>Fecha de despacho</dt><dd>{selectedRow.dispatchDate ? formatDate(selectedRow.dispatchDate) : "—"}</dd></div>
      <div><dt>Entrega real</dt><dd>{selectedRow.actualDeliveryDate ? formatDate(selectedRow.actualDeliveryDate) : "—"}</dd></div>
      {selectedRow.deliveryIssue && <div><dt>Novedad</dt><dd>{selectedRow.deliveryIssue}</dd></div>}
    </dl>
  </aside></>;

  return <DashboardShell navigation={billingNavigation} activeHref="/facturacion-diaria/entregas" title="Detalle de entregas" className="billing-shell-detail" overlay={detailDrawer}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>Detalle de entregas</h1><p>Entregas, devoluciones y notas crédito de devolución por línea, con su valor sin IVA.</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={16} /> Filtros</button></div></div>
    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className="billing-filterbar-primary">
        <label><CalendarDays size={15} /><span>Periodo</span><select value={draftFilters.year} onChange={(event) => updateDraft("year")(event.target.value)}><option value="Todos">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Mes</span><select value={draftFilters.month} onChange={(event) => updateDraft("month")(event.target.value)}><option value="Todos">Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{formatMonthName(month)}</option>)}</select></label>
        <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}><Search size={16} /></button><input type="search" value={draftFilters.search} onChange={(event) => updateDraft("search")(event.target.value)} placeholder="Buscar entrega, cliente, OV, referencia o guía..." aria-label="Buscar entrega, cliente, orden de venta, referencia o guía" enterKeyHint="search" /></div>
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
      {showFilters && <div className="billing-advanced-filters">
        <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros de la entrega</span></div><small>Combina los criterios para afinar la consulta</small></div>
        <FilterSelect label="Empresa" value={draftFilters.company} emptyValue="Todas" emptyLabel="Todas las empresas" options={companyOptions} onChange={updateDraft("company")} />
        <FilterSelect label="Grupo de cliente" value={draftFilters.group} emptyValue="Todos" emptyLabel="Todos los grupos" options={groups} onChange={updateDraft("group")} />
        <FilterSelect label="Subgrupo de cliente" value={draftFilters.subgroup} emptyValue="Todos" emptyLabel="Todos los subgrupos" options={subgroups} onChange={updateDraft("subgroup")} />
        <div className="billing-advanced-filters-footer">{hasPendingFilters && <span>Hay cambios sin aplicar</span>}<button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>}
    </form>
    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}
    {!error && !loading && !options && <div className="billing-alert"><Database size={16} /><span>La API de informes conectada es una versión anterior: sin devoluciones ni filtros Empresa y Subgrupo de cliente hasta desplegar la versión nueva.</span></div>}
    <section className="billing-panel billing-table-panel">
      <div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE OPERATIVO</span><h2>Líneas de entrega</h2><p>{formatNumber(pagination.total)} líneas · página {pagination.page} de {pagination.totalPages}{totalsCaption && ` · ${totalsCaption}`}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={loading}><RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar</button></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha</th><th>Documento</th><th>Tipo</th><th>Cliente</th><th>Orden de venta</th><th>Referencia</th><th className="align-right">Cantidad</th><th className="align-right">Valor sin IVA</th><th>Estado</th><th aria-label="Abrir detalle" /></tr></thead>
        <tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={10}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : rows.length ? rows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelectedRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRow(row); } }}>
          <td><span className="billing-date-cell">{formatDate(row.deliveryDate)}</span><small>{row.deliveryDate ? dateValue(row.deliveryDate).getFullYear() : ""}</small></td>
          <td><strong className="billing-docnum">{row.delivery}</strong><small>{[row.company, row.baseDocument && `Base ${row.baseDocument}`].filter(Boolean).join(" · ")}</small></td>
          <td><span className={`billing-zone-tag ${isReturn(row) ? "delivery-return" : ""}`}>{movementLabel(row)}</span></td>
          <td><span className="billing-group-cell">{row.customer || "—"}</span><small>{row.customerSubgroup ?? row.customerGroup}</small></td>
          <td>{row.salesOrder || "—"}</td>
          <td><span className="billing-group-cell">{row.referenceCode || "—"}</span><small className="delivery-reference">{row.referenceDescription}</small></td>
          <td className="align-right">{formatNumber(row.quantity)}</td>
          <td className={`align-right number-cell ${isReturn(row) ? "credit-cell" : ""}`}>{formatCurrency(row.valueWithoutVat)}</td>
          <td>{row.deliveryStatus || "—"}</td>
          <td><ChevronRight size={16} className="billing-row-chevron" /></td>
        </tr>) : <tr><td colSpan={10} className="billing-table-state"><Search size={22} /><strong>No encontramos entregas</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}</tbody>
      </table></div>
      <TablePager shown={rows.length} total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} loading={loading} noun="líneas" onPageChange={changePage} />
    </section>
    <footer className="billing-footer"><span>{lastUpdated ? `Actualizado ${formatDateTime(lastUpdated)}` : "Actualización automática"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
