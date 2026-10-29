"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  Filter,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type {
  BillingPayload,
  BillingRow,
  BillingSummary,
  DeliveryPayload,
  DeliverySummary,
} from "@/lib/facturacion/types";

type View = "Resumen" | "Facturación" | "Notas crédito";

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
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
const marketOptions = ["Nacional", "Internacional"];
const initialPeriod = new Date();
const initialYear = String(initialPeriod.getFullYear());
const initialMonth = String(initialPeriod.getMonth() + 1);

function formatCurrency(value: number) { return currency.format(value); }
function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    const millions = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1_000_000);
    return `$${millions}M`;
  }
  return formatCurrency(value);
}
function dateValue(value: string) { return new Date(`${value}T12:00:00`); }
function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(dateValue(value)).replace(".", "");
}

async function readJsonPayload<T extends { error?: string }>(response: Response, sourceLabel: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.url.includes("/login")) {
      throw new Error("La sesión expiró. Vuelve a iniciar sesión para consultar los indicadores.");
    }
    throw new Error(`${sourceLabel} devolvió una respuesta no válida (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function MetricCard({ label, value, detail, trend, icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  icon: typeof TrendingUp;
}) {
  return <article className="billing-metric-card"><div className="billing-metric-icon blue"><Icon size={18} /></div><div className="billing-metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>{trend && <span className="billing-metric-trend"><ArrowUpRight size={13} />{trend}</span>}</article>;
}

function MetricSkeleton() {
  return <article className="billing-metric-card billing-skeleton-card"><span className="billing-skeleton billing-skeleton-icon" /><div><span className="billing-skeleton billing-skeleton-label" /><span className="billing-skeleton billing-skeleton-value" /><span className="billing-skeleton billing-skeleton-detail" /></div></article>;
}

function DocumentFilter({ label, value, emptyValue, emptyLabel, options, onChange, disabled }: {
  label: string;
  value: string;
  emptyValue: string;
  emptyLabel: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return <label className="billing-advanced-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value={emptyValue}>{emptyLabel}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

type FacturacionDashboardProps = {
  mode?: "overview" | "detail";
};

export default function FacturacionDashboard({ mode = "overview" }: FacturacionDashboardProps) {
  const isDetailView = mode === "detail";
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("Resumen");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedZone, setSelectedZone] = useState("Todas");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [selectedCustomer, setSelectedCustomer] = useState("Todos");
  const [selectedChannel, setSelectedChannel] = useState("Todos");
  const [selectedCity, setSelectedCity] = useState("Todas");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllDailySummary, setShowAllDailySummary] = useState(false);
  const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: "50" });
      if (selectedYear !== "Todos") params.set("anio", selectedYear);
      if (selectedMonth !== "Todos") params.set("mes", selectedMonth);
      if (selectedZone !== "Todas") params.set("zona", selectedZone);
      if (selectedGroup !== "Todos") params.set("grupoCliente", selectedGroup);
      if (search.trim()) params.set("search", search.trim());

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
      setSummary(payload.summary);
      setDeliverySummary(deliveryPayload.summary);
      setPagination(payload.pagination ?? { page: targetPage, pageSize: 50, total: payload.rows.length, totalPages: 1 });
      setLastUpdated(payload.updatedAt);
      setError("");
    } catch (loadError) {
      setRows([]);
      setAvailableYears([]);
      setSummary(null);
      setDeliverySummary(null);
      setPagination({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedGroup, selectedMonth, selectedYear, selectedZone]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const years = useMemo(() => availableYears.length ? availableYears : Array.from(new Set(rows.map((row) => dateValue(row.date).getFullYear()))).sort((a, b) => b - a), [availableYears, rows]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const customers = useMemo(() => Array.from(new Set(rows.map((row) => row.customer).filter(Boolean))).sort(), [rows]);
  const groups = useMemo(() => Array.from(new Set(rows.map((row) => row.customerGroup).filter(Boolean))).sort(), [rows]);
  const zones = useMemo(() => Array.from(new Set(rows.map((row) => row.zone).filter(Boolean))).sort(), [rows]);
  const cities = useMemo(() => Array.from(new Set(rows.map((row) => row.city).filter(Boolean))).sort(), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => (
    (activeView !== "Notas crédito" || row.creditNote > 0)
    && (selectedCustomer === "Todos" || row.customer === selectedCustomer)
    && (selectedGroup === "Todos" || row.customerGroup === selectedGroup)
    && (selectedChannel === "Todos" || row.channel === selectedChannel)
    && (selectedZone === "Todas" || row.zone === selectedZone)
    && (selectedCity === "Todas" || row.city === selectedCity)
  )), [activeView, rows, selectedChannel, selectedCity, selectedCustomer, selectedGroup, selectedZone]);
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

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.assign("/login"); };
  const resetFilters = () => { setSelectedYear(initialYear); setSelectedMonth(initialMonth); setSelectedZone("Todas"); setSelectedGroup("Todos"); setSelectedCustomer("Todos"); setSelectedChannel("Todos"); setSelectedCity("Todas"); setSearch(""); };
  const changePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > pagination.totalPages || targetPage === pagination.page) return;
    setPagination((current) => ({ ...current, page: targetPage }));
    void loadData(targetPage);
  };
  return <main className={`billing-shell ${isDetailView ? "billing-shell-detail" : ""}`}>
    <div className={`billing-sidebar-backdrop ${isSidebarOpen ? "visible" : ""}`} onClick={() => setIsSidebarOpen(false)} />
    <aside className={`billing-sidebar ${isSidebarOpen ? "open" : ""}`}>
      <div className="billing-brand-row"><div className="official-logo-wrap official-logo-wrap-dark"><Image className="official-logo-image" src="/brand/firplak-es-negativo.png" alt="Firplak" width={220} height={220} priority /></div><button className="billing-close-menu" onClick={() => setIsSidebarOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
      <nav className="billing-nav" aria-label="Navegación de facturación"><span className="billing-nav-label">MENÚ PRINCIPAL</span><Link className="billing-nav-item" href="/"><LayoutDashboard size={17} /> Resumen</Link><Link className={`billing-nav-item ${!isDetailView ? "active" : ""}`} href="/facturacion-diaria"><TrendingUp size={17} /> Facturación <span>01</span></Link><span className="billing-nav-label billing-nav-label-spaced">ANÁLISIS</span><Link className={`billing-nav-item ${isDetailView ? "active" : ""}`} href="/facturacion-diaria/detalle"><Table2 size={17} /> Detalle de documentos</Link></nav>
      <div className="billing-sidebar-bottom"><div className="billing-tip"><Database size={16} /><div><strong>Fuente de datos</strong><span>Vista SQL Server</span></div></div><button className="billing-nav-item"><CircleHelp size={17} /> Ayuda</button><div className="billing-profile"><div className="billing-avatar">DJ</div><div><strong>Usuario Firplak</strong><span>Sesión Microsoft 365</span></div><button onClick={handleSignOut} aria-label="Cerrar sesión"><LogOut size={15} /></button></div></div>
    </aside>

    <section className="billing-main"><header className="billing-topbar"><div className="billing-breadcrumbs"><button className="billing-mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button><Home size={14} /><ChevronRight size={14} /><span>Indicadores</span><ChevronRight size={14} /><strong>Facturación diaria</strong></div><div className="billing-top-actions"><button className="billing-help-button" aria-label="Ayuda"><CircleHelp size={18} /></button></div></header>
      <div className="billing-content">
        <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>Facturación detallada</h1><p>Consulta el comportamiento de la facturación, notas crédito y documentos por periodo.</p></div><div className="billing-heading-actions"><button className="billing-secondary-button" onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={16} /> Filtros</button></div></div>
        <div className="billing-filterbar">
          <div className="billing-filterbar-primary">
            <label><CalendarDays size={15} /><span>Periodo</span><select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} disabled={loading}><option value="Todos">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
            <label><span>Mes</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} disabled={loading}><option value="Todos">Todos los meses</option>{months.map((month) => <option key={month} value={String(month)}>{new Intl.DateTimeFormat("es-CO", { month: "long" }).format(new Date(2026, month - 1, 1))}</option>)}</select></label>
            <div className="billing-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, cliente o ciudad..." disabled={loading} /></div>
            <button className="billing-reset-button" onClick={resetFilters}>Limpiar</button>
          </div>
          {showFilters && <div className="billing-advanced-filters">
            <div className="billing-advanced-filters-heading"><div><Filter size={15} /><span>Filtros del documento</span></div><small>Combina los criterios para afinar la consulta</small></div>
            <DocumentFilter label="Cliente" value={selectedCustomer} emptyValue="Todos" emptyLabel="Todos los clientes" options={customers} onChange={setSelectedCustomer} disabled={loading} />
            <DocumentFilter label="Grupo de cliente" value={selectedGroup} emptyValue="Todos" emptyLabel="Todos los grupos" options={groups} onChange={setSelectedGroup} disabled={loading} />
            <DocumentFilter label="Mercado" value={selectedChannel} emptyValue="Todos" emptyLabel="Todos los mercados" options={marketOptions} onChange={setSelectedChannel} disabled={loading} />
            <DocumentFilter label="Zona" value={selectedZone} emptyValue="Todas" emptyLabel="Todas las zonas" options={zones} onChange={setSelectedZone} disabled={loading} />
            <DocumentFilter label="Ciudad" value={selectedCity} emptyValue="Todas" emptyLabel="Todas las ciudades" options={cities} onChange={setSelectedCity} disabled={loading} />
          </div>}
        </div>
        {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData(1)}>Reintentar</button></div>}
        <div className="billing-metrics-grid">{loading ? Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />) : <><MetricCard label="Facturación bruta" value={formatCompactCurrency(totals.invoiced)} detail={`${number.format(pagination.total)} documentos filtrados`} trend="12,4%" icon={TrendingUp} /><MetricCard label="Facturación neta" value={formatCompactCurrency(totals.net)} detail="Facturado menos notas crédito" icon={ArrowUpRight} /><MetricCard label="Notas crédito" value={formatCompactCurrency(totals.creditNote)} detail={`${totals.invoiced ? ((totals.creditNote / totals.invoiced) * 100).toFixed(1) : "0,0"}% sobre la facturación`} icon={ArrowDownRight} /><MetricCard label="Cumplimiento" value="94,8%" detail="Meta mensual nacional" trend="4,7%" icon={BarChart3} /></>}</div>
        <div className="billing-analysis-grid"><section className="billing-panel billing-chart-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">EVOLUCIÓN DIARIA</span><h2>Facturación y notas crédito</h2></div><span className="billing-period-caption">{dailyData.length ? `${formatDate(dailyData[0].sort)} — ${formatDate(dailyData[dailyData.length - 1].sort)}` : "Sin datos"}</span></div><div className="billing-chart-legend"><span><i className="facturado" /> Facturado</span><span><i className="notas" /> Notas crédito</span></div>{loading ? <div className="billing-chart-skeleton"><span /><span /><span /></div> : <div className="billing-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="facturadoGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#324354" stopOpacity={0.22} /><stop offset="100%" stopColor="#324354" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#F6F3EE" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7B8E90", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#7B8E90", fontSize: 11 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000000)}M`} width={45} /><Tooltip contentStyle={{ border: "0", borderRadius: 10, boxShadow: "0 10px 26px rgba(50,67,84,.12)", fontSize: 12 }} formatter={(value) => formatCurrency(Number(value))} /><Area type="monotone" dataKey="facturado" stroke="#324354" strokeWidth={2.5} fill="url(#facturadoGradient)" /><Area type="monotone" dataKey="notas" stroke="#7B8E90" strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div>}</section><section className="billing-panel billing-zone-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">DISTRIBUCIÓN</span><h2>Facturación neta por zona</h2></div><button className="billing-icon-action" aria-label="Más opciones">···</button></div>{loading ? <div className="billing-zone-skeleton"><span /><span /><span /></div> : <div className="billing-zone-list">{zoneData.length ? zoneData.map((item) => <div className="billing-zone-row" key={item.name}><div className="billing-zone-label"><span>{item.name}</span><strong>{formatCompactCurrency(item.value)}</strong></div><div className="billing-progress"><span style={{ width: `${item.percent}%` }} /></div><small>{item.percent}%</small></div>) : <div className="billing-empty">No hay zonas para los filtros seleccionados.</div>}</div>}</section></div>
        <section className="billing-panel billing-daily-summary-panel">
          <div className="billing-table-heading"><div><span className="billing-panel-kicker">RESUMEN DIARIO</span><h2>Facturación y entregas por día</h2><p>Acumulado mensual, entregas y metas configuradas</p></div><div className="billing-daily-summary-actions"><span className="billing-daily-summary-count">{dailySummaryRows.length ? `${dailySummaryRows.length} días` : "Sin datos"}</span>{dailySummaryRows.length > 7 && <button className="billing-secondary-button small" type="button" onClick={() => setShowAllDailySummary((visible) => !visible)}>{showAllDailySummary ? "Mostrar menos" : "Ver todos los días"}</button>}</div></div>
          <div className="billing-table-scroll"><table className="billing-data-table billing-daily-summary-table"><thead><tr><th>Año</th><th>Mes</th><th>Día</th><th className="align-right">Ent día</th><th className="align-right">Ent mes total</th><th className="align-right">Fac día total</th><th className="align-right">Fac mes total</th><th className="align-right">Total NC</th><th className="align-right">Fac - NC</th><th className="align-right">Meta Nacional</th><th className="align-right">Meta Firplak</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={11}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : dailySummaryRows.length ? displayedDailySummaryRows.map((item) => <tr key={item.date}><td>{item.year}</td><td>{item.month}</td><td>{item.day}</td><td className="align-right delivery-cell">{item.deliveryDay ? formatCurrency(item.deliveryDay) : "—"}</td><td className="align-right delivery-cell">{item.deliveryMonthTotal ? formatCurrency(item.deliveryMonthTotal) : "—"}</td><td className="align-right number-cell">{formatCurrency(item.invoiced)}</td><td className="align-right number-cell">{formatCurrency(item.monthTotal)}</td><td className="align-right credit-cell">{item.creditNote ? formatCurrency(item.creditNote) : "—"}</td><td className="align-right net-cell">{formatCurrency(item.net)}</td><td className="align-right">{item.nationalTarget ? formatCurrency(item.nationalTarget) : "—"}</td><td className="align-right">{item.firplakTarget ? formatCurrency(item.firplakTarget) : "—"}</td></tr>) : <tr><td colSpan={11} className="billing-table-state"><strong>Sin datos diarios</strong></td></tr>}</tbody></table></div>
        </section>
        <section className="billing-panel billing-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">DETALLE OPERATIVO</span><h2>Documentos de facturación</h2><p>{number.format(pagination.total)} registros encontrados · página {pagination.page} de {pagination.totalPages}</p></div><div className="billing-table-actions"><button className="billing-secondary-button small" onClick={() => void loadData(pagination.page)} disabled={isRefreshing}><RefreshCw size={15} className={isRefreshing ? "billing-spin" : ""} /> Actualizar</button><button className="billing-icon-action" aria-label="Más opciones">···</button></div></div><div className="billing-tabs" role="tablist">{(["Resumen", "Facturación", "Notas crédito"] as View[]).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)} role="tab" aria-selected={activeView === view}>{view}{view === "Notas crédito" && <span>{number.format(rows.filter((row) => row.creditNote > 0).length)}</span>}</button>)}</div><div className="billing-table-scroll"><table className="billing-data-table"><thead><tr><th>Fecha</th><th>DOCNUM</th><th>Grupo de cliente</th><th>Canal</th><th>Zona</th><th>Ciudad</th><th className="align-right">Facturado</th><th className="align-right">NC</th><th className="align-right">Neto</th><th aria-label="Abrir detalle" /></tr></thead><tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={10}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : visibleRows.length ? visibleRows.map((row) => <tr key={row.id} onClick={() => setSelectedRow(row)}><td><span className="billing-date-cell">{formatDate(row.date)}</span><small>{dateValue(row.date).getFullYear()}</small></td><td><strong className="billing-docnum">{row.docnum}</strong></td><td><span className="billing-group-cell">{row.customerGroup}</span><small>{row.customer}</small></td><td>{row.channel}</td><td><span className={`billing-zone-tag ${row.zone.toLowerCase().replaceAll(" ", "-")}`}>{row.zone}</span></td><td>{row.city}</td><td className="align-right number-cell">{formatCurrency(row.invoiced)}</td><td className="align-right number-cell credit-cell">{row.creditNote ? formatCurrency(row.creditNote) : "—"}</td><td className="align-right number-cell net-cell">{formatCurrency(row.net)}</td><td><ChevronRight size={16} className="billing-row-chevron" /></td></tr>) : <tr><td colSpan={10} className="billing-table-state"><Search size={22} /><strong>No encontramos documentos</strong><span>Prueba cambiando los filtros o el texto de búsqueda.</span></td></tr>}</tbody></table></div><div className="billing-table-footer"><span>Mostrando {visibleRows.length} de {number.format(pagination.total)} documentos</span><div><button onClick={() => changePage(pagination.page - 1)} disabled={loading || pagination.page <= 1} aria-label="Página anterior"><ChevronLeft size={15} /></button><strong>{pagination.page}</strong><button onClick={() => changePage(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} aria-label="Página siguiente"><ChevronRight size={15} /></button></div></div></section>
        <footer className="billing-footer"><span>{lastUpdated ? `Actualizado ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastUpdated))}` : "Actualización automática"}</span><span>Firplak · Portal interno</span></footer>
      </div></section>
    {selectedRow && <><button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" /><aside className="billing-detail-drawer"><div className="billing-drawer-header"><div><span className="billing-panel-kicker">DETALLE DEL DOCUMENTO</span><h2>{selectedRow.docnum}</h2></div><button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle"><X size={19} /></button></div><div className="billing-drawer-status"><span className="billing-status-dot" /> Documento contabilizado <span>{formatDate(selectedRow.date)}</span></div><div className="billing-drawer-total"><span>Total neto</span><strong>{formatCurrency(selectedRow.net)}</strong><small>Facturado {formatCurrency(selectedRow.invoiced)} · NC {formatCurrency(selectedRow.creditNote)}</small></div><dl className="billing-detail-list"><div><dt>Cliente</dt><dd>{selectedRow.customer}</dd></div><div><dt>Grupo de cliente</dt><dd>{selectedRow.customerGroup}</dd></div><div><dt>Canal</dt><dd>{selectedRow.channel}</dd></div><div><dt>Zona</dt><dd>{selectedRow.zone}</dd></div><div><dt>Ciudad</dt><dd>{selectedRow.city}</dd></div></dl><button className="billing-primary-button drawer-button"><FileText size={16} /> Ver documento</button></aside></>}
  </main>;
}
