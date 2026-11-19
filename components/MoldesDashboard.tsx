"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Factory,
  Filter,
  Gauge,
  Package,
  RefreshCw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import DashboardShell from "@/components/dashboard/DashboardShell";
import FilterSelect from "@/components/dashboard/FilterSelect";
import { MetricCard, MetricSkeleton } from "@/components/dashboard/MetricCard";
import TablePager from "@/components/dashboard/TablePager";
import { chartColors, chartTooltipStyle } from "@/lib/brand";
import { readJsonPayload } from "@/lib/dashboard/fetch";
import {
  dateValue,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/dashboard/format";
import { moldesNavigation } from "@/lib/dashboard/navigation";
import { toOptions } from "@/lib/dashboard/options";
import type {
  MoldCategoryKey,
  MoldFilterOptions,
  MoldOrderRow,
  MoldPayload,
  MoldSummary,
} from "@/lib/moldes/types";

type DashboardFilters = {
  startDate: string;
  endDate: string;
  category: MoldCategoryKey;
  plant: string;
  status: string;
  defect: string;
  responsible: string;
  search: string;
};

type OverviewTab = "indicadores" | "indisponibilidad" | "vueltas";

function getDefaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${d}` };
}

const defaultRange = getDefaultRange();

const initialFilters: DashboardFilters = {
  startDate: defaultRange.start,
  endDate: defaultRange.end,
  category: "Todos",
  plant: "Todos",
  status: "Todos",
  defect: "Todos",
  responsible: "Todos",
  search: "",
};

const pageSize = 50;
const decimalFmt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

const CATEGORIES: Array<{ key: MoldCategoryKey; label: string; icon: typeof Wrench }> = [
  { key: "Todos", label: "Todos", icon: Boxes },
  { key: "REPARACION_RAPIDA", label: "Reparación rápida", icon: Zap },
  { key: "REPARACION_ESPECIAL", label: "Reparación especial", icon: Wrench },
  { key: "MOLDE_NUEVO", label: "Molde nuevo", icon: Package },
  { key: "MODELO_NUEVO", label: "Modelo nuevo", icon: Sparkles },
];

const OVERVIEW_TABS: Array<{ id: OverviewTab; label: string }> = [
  { id: "indicadores", label: "Indicadores y Nivel de Servicio" },
  { id: "indisponibilidad", label: "Índice de Indisponibilidad" },
  { id: "vueltas", label: "Vueltas y Programación" },
];

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return { ...filters, search: filters.search.trim() };
}

function sameFilters(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(a) as Array<keyof DashboardFilters>).every((key) => a[key] === b[key]);
}

function formatDecimal(value: number) {
  return decimalFmt.format(value);
}

function formatRate(value: number | null) {
  return value === null ? "N/D" : formatPercent(value / 100);
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime()) || cur > endD) return dates;
  let guard = 0;
  while (cur <= endD && guard < 45) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard += 1;
  }
  return dates;
}

function serviceTone(rate: number | null, target = 90): "ok" | "warn" | "danger" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= target) return "ok";
  if (rate >= 70) return "warn";
  return "danger";
}

function monthLabel(year: number, month: number, withYear: boolean) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "short" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return withYear ? `${label} ${year}` : label;
}

function ChartTooltip({
  active,
  payload,
  label,
  rows,
}: TooltipProps<number, string> & { rows: (data: Record<string, unknown>) => Array<[string, string]> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as Record<string, unknown>;
  return (
    <div style={chartTooltipStyle} className="moldes-chart-tooltip">
      <strong>{label}</strong>
      {rows(data).map(([name, value]) => (
        <div key={name}>
          <span>{name}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function ServiceCard({
  title,
  rate,
  target,
  statsText,
  ruleText,
}: {
  title: string;
  rate: number | null;
  target?: number;
  statsText: string;
  ruleText: string;
}) {
  const tone = serviceTone(rate, target ?? 90);
  const widthPct = rate === null ? 0 : Math.max(0, Math.min(100, rate));
  const badgeLabel =
    tone === "neutral" ? "Sin datos" : tone === "ok" ? "En meta" : tone === "warn" ? "Alerta" : "Crítico";

  return (
    <article className="moldes-service-card">
      <div className="moldes-service-header">
        <div>
          <span>{title}</span>
          <strong>{formatRate(rate)}</strong>
        </div>
        <span className={`moldes-service-badge ${tone}`}>{badgeLabel}</span>
      </div>
      <div className="moldes-gauge-track" aria-hidden="true">
        <div className={`moldes-gauge-fill ${tone}`} style={{ width: `${widthPct}%` }} />
      </div>
      <div className="moldes-service-stats">
        <span>{statsText}</span>
      </div>
      <p className="moldes-rule-note">{ruleText}</p>
    </article>
  );
}

export default function MoldesDashboard({ mode = "overview" }: { mode?: "overview" | "detail" }) {
  const isDetailView = mode === "detail";
  const [activeTab, setActiveTab] = useState<OverviewTab>("indicadores");
  const [rows, setRows] = useState<MoldOrderRow[]>([]);
  const [periodRows, setPeriodRows] = useState<MoldOrderRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<MoldFilterOptions | null>(null);
  const [summary, setSummary] = useState<MoldSummary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MoldOrderRow | null>(null);

  // Inputs de operarios locales (como en App_Moldes) para productividad HH.
  const [numOperarios, setNumOperarios] = useState<string>("");
  const [operariosPorDia, setOperariosPorDia] = useState<Record<string, string>>({});
  const [selectedRef, setSelectedRef] = useState<string>("");

  const loadData = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
          desde: appliedFilters.startDate,
          hasta: appliedFilters.endDate,
          categoria: appliedFilters.category,
        });
        if (appliedFilters.plant !== "Todos") params.set("planta", appliedFilters.plant);
        if (appliedFilters.status !== "Todos") params.set("estado", appliedFilters.status);
        if (appliedFilters.defect !== "Todos") params.set("defecto", appliedFilters.defect);
        if (appliedFilters.responsible !== "Todos") params.set("responsable", appliedFilters.responsible);
        if (appliedFilters.search) params.set("search", appliedFilters.search);

        const response = await fetch(`/api/moldes?${params.toString()}`, { cache: "no-store" });
        const payload = await readJsonPayload<MoldPayload & { error?: string }>(
          response,
          "La API de moldes",
        );
        if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar los indicadores de moldes.");

        setRows(payload.rows ?? []);
        setPeriodRows(payload.periodRows ?? []);
        setFilterOptions(payload.filterOptions ?? null);
        setSummary(payload.summary);
        setPagination(
          payload.pagination ?? { page: targetPage, pageSize, total: payload.rows?.length ?? 0, totalPages: 1 },
        );
        setLastUpdated(payload.updatedAt ?? "");
        setError("");
      } catch (loadError) {
        setRows([]);
        setPeriodRows([]);
        setSummary(null);
        setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar la información.");
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(1), 180);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!selectedRow) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRow(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRow]);

  const rapidaDates = useMemo(
    () => getDatesInRange(appliedFilters.startDate, appliedFilters.endDate),
    [appliedFilters.startDate, appliedFilters.endDate],
  );

  const totalRapidaOperarios = useMemo(
    () =>
      rapidaDates.reduce((sum, date) => {
        const val = Number(operariosPorDia[date] || 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0),
    [rapidaDates, operariosPorDia],
  );

  const plants = useMemo(() => toOptions(filterOptions?.plants ?? []), [filterOptions]);
  const statuses = useMemo(() => toOptions(filterOptions?.statuses ?? []), [filterOptions]);
  const defects = useMemo(() => toOptions(filterOptions?.defects ?? []), [filterOptions]);
  const responsibles = useMemo(() => toOptions(filterOptions?.responsibles ?? []), [filterOptions]);
  const hasPendingFilters = !sameFilters(normalizeFilters(draftFilters), appliedFilters);

  const isRapidaMode = appliedFilters.category === "REPARACION_RAPIDA";

  const generalProductivity = useMemo(() => {
    const ops = Number(numOperarios);
    if (!summary || !Number.isFinite(ops) || ops <= 0) return null;
    return summary.deliveredInRangeCount / ops;
  }, [summary, numOperarios]);

  const rapidaHH = useMemo(() => {
    if (!summary || totalRapidaOperarios <= 0) return null;
    return summary.rapida.totalMoldesReparados / totalRapidaOperarios;
  }, [summary, totalRapidaOperarios]);

  const selectedRefStats = useMemo(() => {
    if (!summary || !selectedRef) return null;
    return (
      summary.indisponibilityByRef.find((r) => r.referencia === selectedRef) ?? {
        referencia: selectedRef,
        totalMoldes: 0,
        enReparacionActual: 0,
        totalDiasFuera: 0,
        promedioDiasFuera: 0,
        daysInMonth: 30,
        indice: 0,
      }
    );
  }, [summary, selectedRef]);

  const monthly = useMemo(() => {
    const items = summary?.monthly ?? [];
    const multipleYears = new Set(items.map((item) => item.year)).size > 1;
    return items.map((item) => ({
      ...item,
      label: monthLabel(item.year, item.month, multipleYears),
    }));
  }, [summary]);

  const updateDraft = (key: keyof DashboardFilters) => (value: string) =>
    setDraftFilters((current) => ({ ...current, [key]: value }));

  const selectCategory = (cat: MoldCategoryKey) => {
    setDraftFilters((c) => ({ ...c, category: cat }));
    setAppliedFilters((c) => ({ ...c, category: cat }));
  };

  const resetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };

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

  const exportIndisponibilidadCsv = () => {
    if (!summary) return;
    const lines = ["Referencia,Total_Moldes,En_Reparacion_Actual,Dias_Fuera,Promedio_Dias_Fuera,Indice_Pct"];
    for (const row of summary.indisponibilityByRef) {
      const ref = `"${row.referencia.replace(/"/g, '""')}"`;
      lines.push(
        `${ref},${row.totalMoldes},${row.enReparacionActual},${row.totalDiasFuera},${row.promedioDiasFuera},${row.indice}`,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indisponibilidad_moldes_${appliedFilters.startDate}_${appliedFilters.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detailDrawer = selectedRow && (
    <>
      <button className="billing-drawer-backdrop" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle" />
      <aside className="billing-detail-drawer" aria-label={`Orden ${selectedRow.moldCode}`}>
        <div className="billing-drawer-header">
          <div>
            <span className="billing-panel-kicker">ORDEN DE MOLDE · #{selectedRow.numericId}</span>
            <h2>{selectedRow.moldCode}</h2>
          </div>
          <button onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle">
            <X size={19} />
          </button>
        </div>
        <div className="billing-drawer-status">
          <span className="billing-status-dot" /> {selectedRow.status}
          <span>{selectedRow.expectedDate ? formatDate(selectedRow.expectedDate) : "Sin F. esperada"}</span>
        </div>
        <div className="billing-drawer-total">
          <span>Cumplimiento de orden</span>
          <strong>{selectedRow.isCompliant ? "Cumple" : "No cumple / Atrasado"}</strong>
          <small>
            {selectedRow.weightLabel} · Planta {selectedRow.plant}
          </small>
        </div>
        <dl className="billing-detail-list">
          <div><dt>Molde</dt><dd>{selectedRow.title}</dd></div>
          <div><dt>Categoría</dt><dd>{selectedRow.category}</dd></div>
          <div><dt>Defectos</dt><dd>{selectedRow.defectsRaw || "—"}</dd></div>
          <div><dt>Fecha entrada</dt><dd>{selectedRow.entryDate ?? "—"}</dd></div>
          <div><dt>Fecha esperada</dt><dd>{selectedRow.expectedDate ?? "—"}</dd></div>
          <div><dt>Fecha entrega</dt><dd>{selectedRow.deliveryDate ?? "Pendiente"}</dd></div>
          <div><dt>Días fuera</dt><dd>{formatDecimal(selectedRow.daysOut)} días</dd></div>
          <div><dt>Responsable</dt><dd>{selectedRow.responsible}</dd></div>
          <div><dt>Observaciones</dt><dd>{selectedRow.observations || "—"}</dd></div>
        </dl>
      </aside>
    </>
  );

  return (
    <DashboardShell
      navigation={moldesNavigation}
      activeHref={isDetailView ? "/moldes/detalle" : "/moldes"}
      title={isDetailView ? "Historial y auditoría de moldes" : "Indicadores de moldes"}
      className="moldes-shell"
      overlay={detailDrawer}
    >
      <div className="billing-heading-row">
        <div>
          <div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> OPERACIONES (REF. APP_MOLDES)</div>
          <h1>{isDetailView ? "Historial y auditoría de moldes" : "Indicadores de moldes"}</h1>
          <p>
            {isDetailView
              ? "Registro deduplicado por evento (código + fecha de entrada) con trazabilidad de cumplimiento."
              : "Nivel de servicio, ponderación de Reparación Rápida, Pareto de defectos e Índice de indisponibilidad por referencia."}
          </p>
        </div>
        <div className="billing-heading-actions">
          <button
            className="billing-secondary-button"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={16} /> Filtros
          </button>
        </div>
      </div>

      <form className="billing-filterbar" onSubmit={applyFilters}>
        <div className="billing-filterbar-primary">
          <label>
            <CalendarDays size={15} />
            <span>Desde</span>
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) => updateDraft("startDate")(event.target.value)}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              type="date"
              value={draftFilters.endDate}
              onChange={(event) => updateDraft("endDate")(event.target.value)}
            />
          </label>
          <div className="billing-search" role="search">
            <button className="billing-search-button" type="submit" aria-label="Buscar" disabled={loading}>
              <Search size={16} />
            </button>
            <input
              type="search"
              value={draftFilters.search}
              onChange={(event) => updateDraft("search")(event.target.value)}
              placeholder="Buscar código, molde, defecto o responsable..."
              aria-label="Buscar código, molde, defecto o responsable"
              enterKeyHint="search"
            />
          </div>
          <div className="billing-filter-actions">
            <button className="billing-reset-button" type="button" onClick={resetFilters}>
              Limpiar
            </button>
            <button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>
              Aplicar filtros
            </button>
          </div>
        </div>

        <div className="moldes-cat-bar" role="group" aria-label="Categoría de reparación">
          <span className="moldes-cat-label">Categoría:</span>
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const count =
              key === "Todos" || !summary ? null : summary.categoryBreakdown[key];
            return (
              <button
                key={key}
                type="button"
                className={`moldes-cat-pill ${appliedFilters.category === key ? "active" : ""}`}
                onClick={() => selectCategory(key)}
              >
                <Icon size={14} />
                {label}
                {count !== null && <small>({formatNumber(count)})</small>}
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="billing-advanced-filters">
            <div className="billing-advanced-filters-heading">
              <div><Filter size={15} /><span>Filtros avanzados</span></div>
              <small>Todos los filtros se aplican en el servidor</small>
            </div>
            <FilterSelect label="Planta" value={draftFilters.plant} emptyValue="Todos" emptyLabel="Todas las plantas" options={plants} onChange={updateDraft("plant")} />
            <FilterSelect label="Estado" value={draftFilters.status} emptyValue="Todos" emptyLabel="Todos los estados" options={statuses} onChange={updateDraft("status")} />
            <FilterSelect label="Defecto" value={draftFilters.defect} emptyValue="Todos" emptyLabel="Todos los defectos" options={defects} onChange={updateDraft("defect")} />
            <FilterSelect label="Responsable" value={draftFilters.responsible} emptyValue="Todos" emptyLabel="Todos los responsables" options={responsibles} onChange={updateDraft("responsible")} />
            <div className="billing-advanced-filters-footer">
              {hasPendingFilters && <span>Hay cambios sin aplicar</span>}
              <button className="billing-primary-button" type="submit" disabled={loading || !hasPendingFilters}>
                Aplicar filtros
              </button>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="billing-alert">
          <Database size={16} />
          <span>{error}</span>
          <button onClick={() => void loadData(1)}>Reintentar</button>
        </div>
      )}

      {!isDetailView && (
        <>
          <div className="moldes-tabs" role="tablist" aria-label="Vistas de indicadores de moldes">
            {OVERVIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                className={`moldes-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "indicadores" && !isRapidaMode && (
            <>
              <div className="moldes-metrics-grid">
                {loading || !summary ? (
                  Array.from({ length: 4 }, (_, idx) => <MetricSkeleton key={idx} />)
                ) : (
                  <>
                    <MetricCard
                      label="Comprometidos"
                      value={formatNumber(summary.committedCount)}
                      detail="Fecha esperada dentro del rango"
                      icon={CalendarDays}
                    />
                    <MetricCard
                      label="Entregados a tiempo"
                      value={formatNumber(summary.onTimeCount)}
                      detail={`${formatNumber(summary.deliveredInRangeCount)} entregados totales en rango`}
                      icon={CheckCircle2}
                    />
                    <MetricCard
                      label="Pendientes / Atrasados"
                      value={formatNumber(summary.pendingCount)}
                      detail={`${formatNumber(summary.previousDelayedCount)} atrasados de periodos previos`}
                      icon={AlertTriangle}
                    />
                    <MetricCard
                      label="Productividad (por operario)"
                      value={generalProductivity !== null ? formatDecimal(generalProductivity) : "—"}
                      detail="Ingresa el # de operarios abajo para calcular"
                      icon={Users}
                    />
                  </>
                )}
              </div>

              <div className="moldes-two-column-grid">
                {loading || !summary ? (
                  <MetricSkeleton />
                ) : (
                  <ServiceCard
                    title="Nivel de servicio (Meta 95%)"
                    rate={summary.serviceLevelPct}
                    target={summary.serviceTargetPct}
                    statsText={`${formatNumber(summary.onTimeCount)} a tiempo de ${formatNumber(summary.committedCount)} comprometidos`}
                    ruleText="Regla App_Moldes: Entregados a tiempo (F. Entrega <= F. Esperada) / Comprometidos (F. Esperada en rango). Sin comprometidos = N/D."
                  />
                )}

                <section className="billing-panel">
                  <div className="billing-panel-heading">
                    <div>
                      <span className="billing-panel-kicker">CÁLCULO DE PRODUCTIVIDAD</span>
                      <h2>Operarios del periodo</h2>
                    </div>
                  </div>
                  <div className="moldes-inline-input">
                    <label htmlFor="moldes-ops-input" className="moldes-cat-label">
                      Número de operarios
                    </label>
                    <input
                      id="moldes-ops-input"
                      type="number"
                      min="1"
                      placeholder="Ej: 4"
                      value={numOperarios}
                      onChange={(e) => setNumOperarios(e.target.value)}
                    />
                  </div>
                  <p className="moldes-rule-note">
                    Productividad = Entregados en el rango ({formatNumber(summary?.deliveredInRangeCount ?? 0)}) / Operarios.
                  </p>
                </section>
              </div>

              <section className="billing-panel">
                <div className="billing-panel-heading">
                  <div>
                    <span className="billing-panel-kicker">PARETO DE DEFECTOS</span>
                    <h2>Top 10 problemas reportados</h2>
                  </div>
                </div>
                <div className="billing-chart-legend">
                  <span><i className="moldes-legend-dot moldes-legend-primary" /> Frecuencia</span>
                  <span><i className="moldes-legend-dot moldes-legend-warning" /> % Acumulado</span>
                </div>
                {loading || !summary ? (
                  <div className="billing-chart-skeleton"><span /><span /><span /></div>
                ) : summary.paretoDefects.length ? (
                  <div className="billing-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={summary.paretoDefects} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                        <CartesianGrid vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} width={44} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={(v) => `${v}%`} width={48} />
                        <Tooltip
                          cursor={{ fill: chartColors.grid, opacity: 0.25 }}
                          content={
                            <ChartTooltip
                              rows={(data) => [
                                ["Frecuencia", formatNumber(Number(data.count))],
                                ["% Acumulado", `${data.cumulativePct}%`],
                              ]}
                            />
                          }
                        />
                        <Bar yAxisId="left" dataKey="count" fill={chartColors.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke={chartColors.delivery} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="billing-empty">Sin defectos registrados en este periodo.</div>
                )}
              </section>

              <section className="billing-panel moldes-table-panel">
                <div className="billing-table-heading">
                  <div>
                    <span className="billing-panel-kicker">DETALLE DEL PERIODO</span>
                    <h2>Comprometidos y entregados</h2>
                    <p>Mostrando {formatNumber(periodRows.length)} órdenes del periodo (clic para ver detalle).</p>
                  </div>
                </div>
                <div className="billing-table-scroll">
                  <table className="billing-data-table">
                    <thead>
                      <tr>
                        <th>Serial</th>
                        <th>Molde</th>
                        <th>F. Esperada</th>
                        <th>F. Entrega</th>
                        <th>Estado</th>
                        <th>Etiqueta</th>
                        <th>Cumple</th>
                        <th aria-label="Abrir detalle" />
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }, (_, idx) => (
                          <tr key={idx} className="billing-skeleton-row"><td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>
                        ))
                      ) : periodRows.length ? (
                        periodRows.slice(0, 50).map((row) => (
                          <tr
                            key={row.id}
                            tabIndex={0}
                            onClick={() => setSelectedRow(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedRow(row);
                              }
                            }}
                          >
                            <td><strong className="billing-docnum">{row.moldCode}</strong><small>{row.plant}</small></td>
                            <td><span className="billing-group-cell">{row.title}</span><small>{row.defectsRaw}</small></td>
                            <td>{row.expectedDate ?? "—"}</td>
                            <td>{row.deliveryDate ?? "Pendiente"}</td>
                            <td>{row.status}</td>
                            <td><span className={`moldes-tag-pill ${row.tag}`}>{row.tag}</span></td>
                            <td>
                              <span className={`moldes-status-pill ${row.isCompliant ? "ok" : "danger"}`}>
                                {row.isCompliant ? "A tiempo" : "Atrasado"}
                              </span>
                            </td>
                            <td><ChevronRight size={16} className="billing-row-chevron" /></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={8} className="billing-table-state"><strong>Sin órdenes para los filtros seleccionados</strong></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "indicadores" && isRapidaMode && (
            <>
              <section className="billing-panel">
                <div className="billing-panel-heading">
                  <div>
                    <span className="billing-panel-kicker">REPARACIÓN RÁPIDA · OPERARIOS POR DÍA</span>
                    <h2>Configuración de capacidad ({rapidaDates.length} días)</h2>
                  </div>
                  <strong>Total operarios: {formatNumber(totalRapidaOperarios)}</strong>
                </div>
                {rapidaDates.length > 0 ? (
                  <div className="moldes-ops-grid">
                    {rapidaDates.map((d) => (
                      <label key={d} className="moldes-ops-day">
                        <span>{formatDate(d)}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={operariosPorDia[d] ?? ""}
                          onChange={(e) =>
                            setOperariosPorDia((prev) => ({ ...prev, [d]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="moldes-rule-note">Ajusta un rango de hasta 45 días para ingresar operarios por día.</p>
                )}
              </section>

              <div className="moldes-service-grid">
                {loading || !summary ? (
                  Array.from({ length: 3 }, (_, idx) => <MetricSkeleton key={idx} />)
                ) : (
                  <>
                    <ServiceCard
                      title="Productividad (vs Meta 24/día)"
                      rate={summary.rapida.productividadPct}
                      target={90}
                      statsText={`${formatDecimal(summary.rapida.totalMoldesReparados)} reparados pond. / ${formatNumber(summary.rapida.metaTotal)} meta`}
                      ruleText="Regla: Reparados ponderados / (24 × días del rango). Pesos: MS ×1, FV ×1, Desmanchado MS ×⅓, Desmanchado FV ×½, Brillado ×½."
                    />
                    <ServiceCard
                      title="Nivel de Servicio (Rápida)"
                      rate={summary.rapida.nivelServicioPct}
                      target={90}
                      statsText={`${formatNumber(summary.rapida.moldesEntregados)} entregados / ${formatNumber(summary.rapida.moldesEsperados)} esperados`}
                      ruleText="Regla App_Moldes: Entregados en rango cuyo código está en BD_moldes (F. Esperada en rango) / Moldes esperados."
                    />
                    <ServiceCard
                      title="Prod. Hora Hombre (Meta 3.4)"
                      rate={rapidaHH !== null ? Math.min(100, (rapidaHH / summary.rapida.metaPorPersona) * 100) : null}
                      target={100}
                      statsText={
                        rapidaHH !== null
                          ? `${formatDecimal(rapidaHH)} moldes/operario (Meta: ${summary.rapida.metaPorPersona})`
                          : "Ingresa operarios por día arriba"
                      }
                      ruleText="Regla: Total reparados ponderados / Suma de operarios del periodo. Meta referencia: 3.4 moldes/operario."
                    />
                  </>
                )}
              </div>

              <div className="moldes-metrics-grid">
                {loading || !summary ? (
                  Array.from({ length: 4 }, (_, idx) => <MetricSkeleton key={idx} />)
                ) : (
                  <>
                    <MetricCard
                      label="MS (Mármol Sintético ×1)"
                      value={formatNumber(summary.rapida.countMS)}
                      detail="Peso unitario = 1"
                      icon={Boxes}
                    />
                    <MetricCard
                      label="FV (Fibra de Vidrio ×1)"
                      value={formatNumber(summary.rapida.countFV)}
                      detail="Peso unitario = 1"
                      icon={Wrench}
                    />
                    <MetricCard
                      label="Desmanchado MS (×⅓)"
                      value={formatNumber(summary.rapida.countDesmanchadoMS)}
                      detail="Aporta 0,33 por molde"
                      icon={Activity}
                    />
                    <MetricCard
                      label="Desmanchado FV (×½) · Brillado"
                      value={`${formatNumber(summary.rapida.countDesmanchadoFV)} · ${formatNumber(summary.rapida.countBrillado)}`}
                      detail="Aporta 0,50 por molde"
                      icon={Zap}
                    />
                  </>
                )}
              </div>

              <section className="billing-panel">
                <div className="billing-panel-heading">
                  <div>
                    <span className="billing-panel-kicker">PARETO DE DEFECTOS · REPARACIÓN RÁPIDA</span>
                    <h2>Top 10 defectos en entregas rápidas</h2>
                  </div>
                </div>
                {loading || !summary ? (
                  <div className="billing-chart-skeleton"><span /><span /><span /></div>
                ) : summary.paretoDefects.length ? (
                  <div className="billing-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={summary.paretoDefects} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                        <CartesianGrid vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} width={44} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} tickFormatter={(v) => `${v}%`} width={48} />
                        <Tooltip
                          cursor={{ fill: chartColors.grid, opacity: 0.25 }}
                          content={
                            <ChartTooltip
                              rows={(data) => [
                                ["Frecuencia", formatNumber(Number(data.count))],
                                ["% Acumulado", `${data.cumulativePct}%`],
                              ]}
                            />
                          }
                        />
                        <Bar yAxisId="left" dataKey="count" fill={chartColors.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke={chartColors.delivery} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="billing-empty">Sin reparaciones rápidas entregadas en este periodo.</div>
                )}
              </section>
            </>
          )}

          {activeTab === "indisponibilidad" && (
            <>
              <section className="billing-panel">
                <div className="billing-panel-heading">
                  <div>
                    <span className="billing-panel-kicker">ANÁLISIS POR REFERENCIA</span>
                    <h2>Consulta individual de indisponibilidad</h2>
                  </div>
                </div>
                <div className="moldes-ref-selector">
                  <label>
                    <span className="moldes-cat-label">Referencia (nombre_articulo)</span>
                    <select value={selectedRef} onChange={(e) => setSelectedRef(e.target.value)}>
                      <option value="">Selecciona una referencia...</option>
                      {(summary?.referencias ?? []).map((ref) => (
                        <option key={ref} value={ref}>{ref}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {selectedRefStats && (
                  <div className="moldes-metrics-grid" style={{ marginTop: "1rem" }}>
                    <MetricCard
                      label="Índice de indisponibilidad"
                      value={formatRate(selectedRefStats.indice)}
                      detail={`Sobre ${selectedRefStats.daysInMonth} días del mes`}
                      icon={Gauge}
                    />
                    <MetricCard
                      label="Promedio días fuera"
                      value={formatDecimal(selectedRefStats.promedioDiasFuera)}
                      detail={`${formatNumber(selectedRefStats.totalDiasFuera)} días totales solapados`}
                      icon={Activity}
                    />
                    <MetricCard
                      label="Moldes activos (no destruidos)"
                      value={formatNumber(selectedRefStats.totalMoldes)}
                      detail="Base de la referencia"
                      icon={Boxes}
                    />
                    <MetricCard
                      label="En reparación actual"
                      value={formatNumber(selectedRefStats.enReparacionActual)}
                      detail="Según BD_moldes vigente"
                      icon={Wrench}
                    />
                  </div>
                )}
              </section>

              <section className="billing-panel moldes-table-panel">
                <div className="billing-table-heading">
                  <div>
                    <span className="billing-panel-kicker">CONSOLIDADO POR REFERENCIA</span>
                    <h2>Referencias con indisponibilidad &gt; 0%</h2>
                    <p>Ordenado de mayor a menor índice en el periodo {appliedFilters.startDate} a {appliedFilters.endDate}.</p>
                  </div>
                  <div className="billing-table-actions">
                    <button
                      type="button"
                      className="billing-secondary-button small"
                      onClick={exportIndisponibilidadCsv}
                      disabled={!summary?.indisponibilityByRef.length}
                    >
                      <Download size={15} /> Exportar CSV
                    </button>
                  </div>
                </div>
                <div className="billing-table-scroll">
                  <table className="billing-data-table">
                    <thead>
                      <tr>
                        <th>Referencia</th>
                        <th className="align-right">Moldes activos</th>
                        <th className="align-right">En rep. actual</th>
                        <th className="align-right">Días fuera</th>
                        <th className="align-right">Prom. días fuera</th>
                        <th className="align-right">Índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }, (_, idx) => (
                          <tr key={idx} className="billing-skeleton-row"><td colSpan={6}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>
                        ))
                      ) : summary?.indisponibilityByRef.length ? (
                        summary.indisponibilityByRef.map((item) => (
                          <tr key={item.referencia}>
                            <td><strong>{item.referencia}</strong></td>
                            <td className="align-right">{formatNumber(item.totalMoldes)}</td>
                            <td className="align-right">{formatNumber(item.enReparacionActual)}</td>
                            <td className="align-right number-cell">{formatNumber(item.totalDiasFuera)}</td>
                            <td className="align-right number-cell">{formatDecimal(item.promedioDiasFuera)}</td>
                            <td className="align-right number-cell">
                              <span className={`moldes-status-pill ${item.indice >= 30 ? "danger" : item.indice >= 15 ? "warn" : "ok"}`}>
                                {formatRate(item.indice)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={6} className="billing-table-state"><strong>Sin indisponibilidad registrada en este periodo</strong></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "vueltas" && (
            <>
              <div className="moldes-metrics-grid">
                {loading || !summary ? (
                  Array.from({ length: 4 }, (_, idx) => <MetricSkeleton key={idx} />)
                ) : (
                  <>
                    <MetricCard
                      label="Moldes disponibles"
                      value={formatNumber(summary.availableMoldsCount)}
                      detail={`${formatNumber(summary.activeMoldsCount)} moldes activos en maestro`}
                      icon={Boxes}
                    />
                    <MetricCard
                      label="Vueltas por reparación"
                      value={formatDecimal(summary.turnsPerRepair)}
                      detail="Vueltas acumuladas / órdenes periodo"
                      icon={RotateCw}
                    />
                    <MetricCard
                      label="Total vueltas acumuladas"
                      value={formatNumber(summary.totalAccumulatedTurns)}
                      detail="Suma del maestro de moldes"
                      icon={TrendingUp}
                    />
                    <MetricCard
                      label="Unidades fabricadas"
                      value={formatNumber(summary.fabricatedUnits)}
                      detail="ordenes_fabricacion (pendiente = false)"
                      icon={Factory}
                    />
                  </>
                )}
              </div>

              <section className="billing-panel">
                <div className="billing-panel-heading">
                  <div>
                    <span className="billing-panel-kicker">PROGRAMACIÓN</span>
                    <h2>Reparaciones de moldes vs unidades fabricadas</h2>
                  </div>
                </div>
                <div className="billing-chart-legend">
                  <span><i className="moldes-legend-dot moldes-legend-primary" /> Rápidas</span>
                  <span><i className="moldes-legend-dot moldes-legend-secondary" /> Especiales</span>
                  <span><i className="moldes-legend-dot moldes-legend-warning" /> Unidades fabricadas</span>
                </div>
                {loading ? (
                  <div className="billing-chart-skeleton"><span /><span /><span /></div>
                ) : monthly.length ? (
                  <div className="billing-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} width={48} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: chartColors.axis, fontSize: 12 }} width={58} />
                        <Tooltip
                          cursor={{ fill: chartColors.grid, opacity: 0.25 }}
                          content={
                            <ChartTooltip
                              rows={(data) => [
                                ["Rápidas", formatNumber(Number(data.rapidOrders))],
                                ["Especiales", formatNumber(Number(data.specialOrders))],
                                ["Unidades fabricadas", formatNumber(Number(data.fabricatedUnits))],
                              ]}
                            />
                          }
                        />
                        <Bar yAxisId="left" dataKey="rapidOrders" stackId="rep" fill={chartColors.primary} isAnimationActive={false} />
                        <Bar yAxisId="left" dataKey="specialOrders" stackId="rep" fill={chartColors.secondary} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Line yAxisId="right" type="linear" dataKey="fabricatedUnits" stroke={chartColors.delivery} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="billing-empty">Sin datos mensuales disponibles.</div>
                )}
              </section>

              <section className="billing-panel moldes-table-panel">
                <div className="billing-table-heading">
                  <div>
                    <span className="billing-panel-kicker">ANÁLISIS DE VUELTAS</span>
                    <h2>Top 30 moldes por vueltas acumuladas</h2>
                  </div>
                </div>
                <div className="billing-table-scroll">
                  <table className="billing-data-table">
                    <thead>
                      <tr>
                        <th>Serial</th>
                        <th>Nombre</th>
                        <th>Planta</th>
                        <th>Estado</th>
                        <th>Defecto frecuente</th>
                        <th className="align-right">Vueltas act.</th>
                        <th className="align-right">Vueltas acum.</th>
                        <th className="align-right">Reparaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }, (_, idx) => (
                          <tr key={idx} className="billing-skeleton-row"><td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>
                        ))
                      ) : summary?.topCriticalMolds.length ? (
                        summary.topCriticalMolds.map((mold) => (
                          <tr key={mold.id}>
                            <td><strong className="billing-docnum">{mold.serial}</strong></td>
                            <td>{mold.name}</td>
                            <td>{mold.plant}</td>
                            <td>{mold.status}</td>
                            <td>{mold.topDefect}</td>
                            <td className="align-right">{formatNumber(mold.currentTurns)}</td>
                            <td className="align-right number-cell">{formatNumber(mold.accumulatedTurns)}</td>
                            <td className="align-right">{formatNumber(mold.repairCount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={8} className="billing-table-state"><strong>Sin moldes disponibles</strong></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {isDetailView && (
        <section className="billing-panel moldes-table-panel">
          <div className="billing-table-heading">
            <div>
              <span className="billing-panel-kicker">HISTORIAL Y AUDITORÍA</span>
              <h2>Órdenes de moldes</h2>
              <p>
                {formatNumber(pagination.total)} registros encontrados · página {pagination.page} de{" "}
                {pagination.totalPages}
              </p>
            </div>
            <div className="billing-table-actions">
              <button
                className="billing-secondary-button small"
                onClick={() => void loadData(pagination.page)}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "billing-spin" : ""} /> Actualizar
              </button>
            </div>
          </div>

          <div className="billing-table-scroll">
            <table className="billing-data-table">
              <thead>
                <tr>
                  <th>F. Esperada</th>
                  <th>Serial / Planta</th>
                  <th>Molde</th>
                  <th>Defectos</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Cumple</th>
                  <th aria-label="Abrir detalle" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }, (_, idx) => (
                    <tr key={idx} className="billing-skeleton-row">
                      <td colSpan={8}><span className="billing-skeleton billing-skeleton-row-fill" /></td>
                    </tr>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelectedRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedRow(row);
                        }
                      }}
                    >
                      <td>
                        <span className="billing-date-cell">{row.expectedDate ? formatDate(row.expectedDate) : "—"}</span>
                        <small>{row.expectedDate ? dateValue(row.expectedDate).getFullYear() : ""}</small>
                      </td>
                      <td>
                        <strong className="billing-docnum">{row.moldCode}</strong>
                        <small>{row.plant}</small>
                      </td>
                      <td>
                        <span className="billing-group-cell">{row.title}</span>
                        <small>{row.responsible}</small>
                      </td>
                      <td>{row.defectsRaw}</td>
                      <td>{row.category}</td>
                      <td>{row.status}</td>
                      <td>
                        <span className={`moldes-status-pill ${row.isCompliant ? "ok" : "danger"}`}>
                          {row.isCompliant ? "A tiempo" : "Atrasado"}
                        </span>
                      </td>
                      <td><ChevronRight size={16} className="billing-row-chevron" /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="billing-table-state">
                      <Search size={22} />
                      <strong>No encontramos órdenes de moldes</strong>
                      <span>Prueba cambiando el rango de fechas, la categoría o los filtros.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePager
            shown={rows.length}
            total={pagination.total}
            page={pagination.page}
            totalPages={pagination.totalPages}
            loading={loading}
            noun="órdenes"
            onPageChange={changePage}
          />
        </section>
      )}

      <footer className="billing-footer">
        <span>{lastUpdated ? `Actualizado ${formatDateTime(lastUpdated)}` : "Actualización automática"}</span>
        <span>Firplak · Portal interno</span>
      </footer>
    </DashboardShell>
  );
}
