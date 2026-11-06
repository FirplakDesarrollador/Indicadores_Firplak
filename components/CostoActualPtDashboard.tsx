"use client";

import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  Download,
  Factory,
  Layers,
  Package,
  PackageSearch,
  Search,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import ShareList from "@/components/dashboard/ShareList";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { productCostNavigation } from "@/lib/dashboard/navigation";
import type { ProductCostAlert, ProductCostPayload, ProductCostProduct, ProductCostRow, ProductCostSummary } from "@/lib/costo-actual-pt/types";

type ProductOption = ProductCostPayload["filterOptions"]["products"][number];
type AppliedFilters = { code: string | null; alert: ProductCostAlert | "" };

const initialFilters: AppliedFilters = { code: null, alert: "" };
const compositionPreviewCount = 10;
const searchLimit = 50;
// Cada nivel de SortPath agrega ".0001": el padre de una línea es su ruta sin los últimos 5 caracteres.
const pathSegmentLength = 5;

const alertOptions: Array<{ value: ProductCostAlert; label: string; summaryKey: keyof ProductCostSummary["alerts"]; help: string }> = [
  { value: "inactivo", label: "Ítems inactivos", summaryKey: "inactive", help: "Componentes marcados como inactivos en SAP" },
  { value: "sinCosto", label: "Sin costo en SAP", summaryKey: "noCost", help: "Sin costo promedio en la bodega de la lista, MP-01 ni PT-01" },
  { value: "moCif", label: "MO y CIF a la vez", summaryKey: "laborAndOverhead", help: "Artículos con las dos clasificaciones: no se costean" },
  { value: "estructura", label: "Estructura de la lista", summaryKey: "structure", help: "Ciclos en la lista o tope de niveles" },
];

const unitCost = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 });

function formatCost(value: number) { return unitCost.format(value); }
function formatQuantity(value: number) { return quantity.format(value); }

function ancestorsOf(path: string, level: number) {
  return Array.from({ length: Math.max(level - 2, 0) }, (_, index) => path.slice(0, path.length - pathSegmentLength * (index + 1)));
}

function classificationLabel(row: ProductCostRow) {
  if (row.hasChildren) return "Subensamble";
  return row.classification ?? "—";
}

// Detalle de las tarjetas MP, MO y CIF: participación en el costo total del producto.
function shareOfTotal(value: number, total: number, label: string) {
  return total > 0 ? `${label}: ${formatPercent(value / total)} del total` : label;
}

export default function CostoActualPtDashboard() {
  const [product, setProduct] = useState<ProductCostProduct | null>(null);
  const [rows, setRows] = useState<ProductCostRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [summary, setSummary] = useState<ProductCostSummary | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // El producto y la alerta aplicados consultan la API; la búsqueda y la alerta en borrador esperan a "Aplicar".
  const [applied, setApplied] = useState<AppliedFilters>(initialFilters);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftAlert, setDraftAlert] = useState<ProductCostAlert | "">("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAllComposition, setShowAllComposition] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (applied.code) params.set("codigo", applied.code);
      if (applied.code && applied.alert) params.set("alerta", applied.alert);
      const response = await fetch(`/api/costo-actual-pt?${params.toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<ProductCostPayload & { error?: string }>(response, "La API de costo de producto terminado");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el costo de producto terminado.");
      if (applied.code && !payload.product) throw new Error(`No encontramos el producto ${applied.code} en la última carga.`);

      setProduct(payload.product);
      setRows(payload.rows ?? []);
      setTruncated(Boolean(payload.truncated));
      setSummary(payload.summary);
      setLoadedAt(payload.loadedAt);
      setError("");
    } catch (loadError) {
      setProduct(null);
      setRows([]);
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { setCollapsed(new Set()); setShowAllComposition(false); }, [applied.code]);

  const searchProducts = async (term: string) => {
    setSubmittedSearch(term);
    if (term.length < 2) {
      setSearchResults(null);
      setSearchMessage("Escribe al menos 2 caracteres del código o la descripción.");
      return;
    }
    setSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/costo-actual-pt?${new URLSearchParams({ search: term }).toString()}`, { cache: "no-store" });
      const payload = await readJsonPayload<ProductCostPayload & { error?: string }>(response, "La API de costo de producto terminado");
      if (!response.ok) throw new Error(payload.error ?? "No fue posible buscar productos.");
      setSearchResults(payload.filterOptions?.products ?? []);
    } catch (searchError) {
      setSearchResults(null);
      setSearchMessage(searchError instanceof Error ? searchError.message : "No fue posible buscar productos.");
    } finally {
      setSearching(false);
    }
  };

  const selectProduct = (option: ProductOption) => {
    setApplied({ code: option.code, alert: "" });
    setDraftAlert("");
    setDraftSearch(option.code);
    setSubmittedSearch(option.code);
    setSearchResults(null);
    setSearchMessage("");
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = draftSearch.trim();
    setDraftSearch(term);
    if (term !== submittedSearch && term !== applied.code) void searchProducts(term);
    if (applied.code && draftAlert !== applied.alert) setApplied((current) => ({ ...current, alert: draftAlert }));
  };

  const resetFilters = () => {
    setDraftSearch("");
    setDraftAlert("");
    setSubmittedSearch("");
    setSearchResults(null);
    setSearchMessage("");
    setApplied(initialFilters);
  };

  const showAlert = (alert: ProductCostAlert | "") => {
    setDraftAlert(alert);
    setApplied((current) => ({ ...current, alert }));
  };

  const hasPendingFilters = (draftSearch.trim() !== submittedSearch && draftSearch.trim() !== applied.code) || (Boolean(applied.code) && draftAlert !== applied.alert);
  const isTree = !applied.alert;

  // Subtotal de cada subensamble con las líneas ya cargadas: en la tabla su costo es 0 porque está en sus hijos.
  const subtotals = useMemo(() => {
    const totals = new Map<string, { mp: number; mo: number; cif: number; total: number }>();
    if (!isTree) return totals;
    for (const row of rows) {
      if (row.hasChildren) continue;
      for (const ancestor of ancestorsOf(row.path, row.level)) {
        const current = totals.get(ancestor) ?? { mp: 0, mo: 0, cif: 0, total: 0 };
        current.mp += row.rawMaterialCost;
        current.mo += row.laborCost;
        current.cif += row.overheadCost;
        current.total += row.totalCost;
        totals.set(ancestor, current);
      }
    }
    return totals;
  }, [rows, isTree]);

  const visibleRows = useMemo(
    () => (isTree ? rows.filter((row) => !ancestorsOf(row.path, row.level).some((ancestor) => collapsed.has(ancestor))) : rows),
    [rows, collapsed, isTree],
  );
  const headerPaths = useMemo(() => rows.filter((row) => row.hasChildren).map((row) => row.path), [rows]);
  const compositionItems = useMemo(
    () => (summary?.compositionWithoutOverhead ?? []).map((item) => ({ name: item.description || item.code, value: item.totalCost, detail: item.code })),
    [summary],
  );
  const displayedComposition = showAllComposition ? compositionItems : compositionItems.slice(0, compositionPreviewCount);

  const toggleRow = (path: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  const exportHref = applied.code ? `/api/costo-actual-pt/export?${new URLSearchParams({ codigo: applied.code }).toString()}` : "/api/costo-actual-pt/export";
  const activeAlert = alertOptions.find((option) => option.value === applied.alert);

  return <DashboardShell navigation={productCostNavigation} activeHref="/costo-actual-pt" title="Costo de producto terminado" className="product-cost-shell">
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> CONTABILIDAD</div><h1>Costo de producto terminado</h1><p>Consulta el costo actual de un producto desglosado en materia prima, mano de obra y CIF, con su lista de materiales completa.</p></div>
      <div className="billing-heading-actions"><a className="billing-secondary-button pc-download-button" href={exportHref} download aria-label={applied.code ? `Descargar la lista de materiales de ${applied.code} en Excel` : "Descargar el informe completo de todos los productos en Excel"}><Download size={16} /> {applied.code ? "Descargar producto" : "Descargar todo"}</a></div></div>

    <form className="billing-filterbar" onSubmit={applyFilters}>
      <div className="billing-filterbar-primary pc-filterbar-primary">
        <div className="billing-search" role="search"><button className="billing-search-button" type="submit" aria-label="Buscar producto" disabled={searching}><Search size={16} /></button><input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Buscar producto por código o descripción..." aria-label="Buscar producto por código o descripción" enterKeyHint="search" /></div>
        <label><TriangleAlert size={15} /><span>Alertas</span><select value={draftAlert} onChange={(event) => setDraftAlert(event.target.value as ProductCostAlert | "")} disabled={!applied.code}><option value="">Todas las líneas</option>{alertOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="billing-filter-actions"><button className="billing-reset-button" type="button" onClick={resetFilters}>Limpiar</button><button className="billing-primary-button" type="submit" disabled={searching || !hasPendingFilters}>Aplicar filtros</button></div>
      </div>
    </form>

    {(searching || searchResults || searchMessage) && <section className="billing-panel pc-results-panel" aria-live="polite"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">BÚSQUEDA</span><h2>{searching ? "Buscando productos..." : searchResults ? `${formatNumber(searchResults.length)} producto${searchResults.length === 1 ? "" : "s"} para “${submittedSearch}”` : "Búsqueda de productos"}</h2>{searchResults?.length === searchLimit && <p className="pc-panel-note">Se muestran los primeros {searchLimit}. Escribe más del código o la descripción para afinar.</p>}</div></div>
      {searching ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : searchMessage ? <div className="billing-empty">{searchMessage}</div> : searchResults?.length ? <ul className="pc-results-list">{searchResults.map((option) => <li key={option.code}><button type="button" onClick={() => selectProduct(option)}><strong>{option.code}</strong><span>{option.description}</span><ChevronRight size={16} aria-hidden="true" /></button></li>)}</ul> : <div className="billing-empty">No encontramos productos con ese código o descripción.</div>}
    </section>}

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData()}>Reintentar</button></div>}

    {!applied.code && !error && <section className="billing-panel pc-empty-panel"><PackageSearch size={28} aria-hidden="true" /><h2>Elige un producto</h2><p>Busca un producto por su código o descripción para ver su costo y su lista de materiales. Con <strong>Descargar todo</strong> obtienes el informe completo de todos los productos en Excel (.xlsx).</p></section>}

    {applied.code && !error && <>
      <section className="billing-panel pc-product-panel"><span className="billing-panel-kicker">PRODUCTO</span>
        {loading || !product ? <div className="billing-zone-skeleton"><span /><span /></div> : <><h2>{product.description}</h2><p><strong>{product.code}</strong> · {product.unit || "Sin unidad"} · {formatNumber(product.lines)} líneas en {formatNumber(Math.max(product.levels - 1, 0))} nivel{product.levels === 2 ? "" : "es"} de la lista</p></>}
      </section>

      <div className="pc-metrics-grid">{loading || !summary ? Array.from({ length: 6 }, (_, index) => <MetricSkeleton key={index} />) : <>
        <MetricCard label="Costo MP" value={formatCurrency(summary.rawMaterialCost)} detail={shareOfTotal(summary.rawMaterialCost, summary.totalCost, "Materia prima")} icon={Package} />
        <MetricCard label="Costo MO" value={formatCurrency(summary.laborCost)} detail={shareOfTotal(summary.laborCost, summary.totalCost, "Mano de obra")} icon={Users} />
        <MetricCard label="Costo CIF" value={formatCurrency(summary.overheadCost)} detail={shareOfTotal(summary.overheadCost, summary.totalCost, "Costos indirectos")} icon={Factory} />
        <MetricCard label="Costo total" value={formatCurrency(summary.totalCost)} detail="MP + MO + CIF" icon={Coins} />
        <MetricCard label="Costo sin CIF" value={formatCurrency(summary.costWithoutOverhead)} detail="MP + MO" icon={Layers} />
        <MetricCard label="Costo sin MO" value={formatCurrency(summary.totalCost - summary.laborCost)} detail="MP + CIF" icon={Wrench} />
      </>}</div>

      <div className="pc-two-column-grid">
        <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">CONTROL</span><h2>Líneas con alerta</h2><p className="pc-panel-note">{summary ? `${formatNumber(summary.alerts.total)} de ${formatNumber(product?.lines ?? 0)} líneas tienen al menos una alerta.` : " "}</p></div></div>
          {loading || !summary ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <ul className="pc-alert-list">{alertOptions.map((option) => {
            const count = summary.alerts[option.summaryKey];
            const highlighted = option.value === "inactivo" && count > 0;
            return <li key={option.value} className={highlighted ? "pc-alert-highlight" : ""}><div><strong>{option.label}</strong><small>{option.help}</small></div><span className="pc-alert-count">{formatNumber(count)}</span>{count > 0 && applied.alert !== option.value ? <button type="button" className="billing-secondary-button small" onClick={() => showAlert(option.value)}>Ver líneas</button> : <span className="pc-alert-spacer" aria-hidden="true" />}</li>;
          })}</ul>}
        </section>

        <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">COMPOSICIÓN</span><h2>Costo sin CIF por componente</h2><p className="pc-panel-note">Materia prima y mano de obra; sin CIF.</p></div>{compositionItems.length > compositionPreviewCount && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllComposition((visible) => !visible)} aria-expanded={showAllComposition}>{showAllComposition ? "Mostrar menos" : `Ver los ${compositionItems.length} componentes`}</button>}</div>
          {loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <ShareList items={displayedComposition} emptyText="Este producto no tiene componentes con costo de materia prima o mano de obra." shareLabel="del costo sin CIF" />}
        </section>
      </div>

      <section className="billing-panel pc-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">LISTA DE MATERIALES</span><h2>{activeAlert ? `Líneas con alerta: ${activeAlert.label.toLowerCase()}` : "Componentes del producto"}</h2><p>{activeAlert ? `${formatNumber(rows.length)} líneas. Se muestran sin la jerarquía.` : "Los subensambles muestran el subtotal de sus componentes. Ábrelos o ciérralos para recorrer los niveles."}</p></div>
        <div className="billing-table-actions">{activeAlert ? <button className="billing-secondary-button small" type="button" onClick={() => showAlert("")}>Ver todas las líneas</button> : headerPaths.length > 0 && <><button className="billing-secondary-button small" type="button" onClick={() => setCollapsed(new Set())}>Abrir todo</button><button className="billing-secondary-button small" type="button" onClick={() => setCollapsed(new Set(headerPaths))}>Cerrar todo</button></>}</div></div>
        {truncated && <div className="billing-alert pc-inline-alert"><TriangleAlert size={16} /><span>La lista supera el máximo de líneas en pantalla. Descarga el producto para verla completa.</span></div>}
        <div className="billing-table-scroll"><table className="billing-data-table pc-bom-table"><thead><tr><th>Componente</th><th>Clasificación</th><th className="align-right">Cantidad</th><th className="align-right">Costo unitario</th><th className="align-right">MP</th><th className="align-right">MO</th><th className="align-right">CIF</th><th className="align-right">Total</th></tr></thead><tbody>
          {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : visibleRows.length ? visibleRows.map((row) => {
            const subtotal = row.hasChildren ? subtotals.get(row.path) : undefined;
            const isCollapsed = collapsed.has(row.path);
            const indent = { "--pc-level": isTree ? row.level - 2 : 0 } as CSSProperties;
            const money = (own: number, sub?: number) => row.hasChildren ? (sub === undefined ? "—" : <span className="pc-subtotal">{formatCurrency(sub)}</span>) : formatCurrency(own);
            return <tr key={row.path} className={row.hasChildren ? "pc-header-row" : ""}>
              <td><div className="pc-component-cell" style={indent}>{isTree && row.hasChildren ? <button type="button" className="pc-tree-toggle" onClick={() => toggleRow(row.path)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? "Abrir" : "Cerrar"} ${row.code}`}>{isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button> : <span className="pc-tree-spacer" aria-hidden="true" />}<div><strong>{row.code}</strong><small title={row.description}>{row.description || "Sin descripción"}</small>{row.alert && <span className={`pc-alert-badge ${row.alerts.inactive ? "pc-alert-badge-strong" : ""}`}><TriangleAlert size={12} aria-hidden="true" /> {row.alert}</span>}</div></div></td>
              <td><span className="pc-class-badge">{classificationLabel(row)}</span>{!isTree && <small>Nivel {row.level}</small>}</td>
              <td className="align-right number-cell">{formatQuantity(row.quantity)}<small>{row.unit}</small></td>
              <td className="align-right number-cell">{row.hasChildren ? "—" : formatCost(row.unitCost)}</td>
              <td className="align-right number-cell">{money(row.rawMaterialCost, subtotal?.mp)}</td>
              <td className="align-right number-cell">{money(row.laborCost, subtotal?.mo)}</td>
              <td className="align-right number-cell">{money(row.overheadCost, subtotal?.cif)}</td>
              <td className="align-right number-cell"><strong>{money(row.totalCost, subtotal?.total)}</strong></td>
            </tr>;
          }) : <tr><td colSpan={8} className="billing-table-state"><Search size={22} /><strong>{activeAlert ? "No hay líneas con esa alerta" : "Este producto no tiene líneas"}</strong></td></tr>}
        </tbody></table></div>
      </section>
    </>}

    <footer className="billing-footer"><span>{loadedAt ? `Costos calculados el ${formatDateTime(loadedAt)} · se recalculan cada hora` : "Los costos se recalculan cada hora"}</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
