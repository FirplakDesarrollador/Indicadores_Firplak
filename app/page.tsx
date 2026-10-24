"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Download,
  Filter,
  Layers,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CargaView from "./components/CargaView";

type Period = "Este mes" | "Últimos 90 días" | "Este año";
type Report = "Resumen" | "Planner" | "Performance" | "Ventas" | "Operaciones" | "Clientes";

const palette = {
  navy: "#123552",
  cyan: "#0f9f9a",
  orange: "#ef8354",
  yellow: "#efb44a",
  purple: "#8c72ca",
};

// --- Datos Reporte Ventas / Resumen ---
const monthlyData = [
  { name: "Ene", value: 510, target: 490 },
  { name: "Feb", value: 545, target: 520 },
  { name: "Mar", value: 530, target: 535 },
  { name: "Abr", value: 605, target: 560 },
  { name: "May", value: 625, target: 590 },
  { name: "Jun", value: 670, target: 620 },
  { name: "Jul", value: 705, target: 650 },
  { name: "Ago", value: 690, target: 680 },
  { name: "Sep", value: 742, target: 700 },
];

const channelData = [
  { name: "Distribuidores", value: 47, fill: palette.navy },
  { name: "E-commerce", value: 31, fill: palette.cyan },
  { name: "Proyectos", value: 22, fill: palette.orange },
];

const regionData = [
  { name: "Antioquia", revenue: 242, growth: 14.2 },
  { name: "Bogotá", revenue: 207, growth: 9.8 },
  { name: "Costa", revenue: 161, growth: 7.1 },
  { name: "Eje Cafetero", revenue: 84, growth: 4.3 },
];

const productData = [
  { name: "Lavaplatos", value: 38, color: palette.navy },
  { name: "Grifería", value: 27, color: palette.cyan },
  { name: "Sanitarios", value: 21, color: palette.orange },
  { name: "Accesorios", value: 14, color: palette.yellow },
];

// --- Datos Reporte Performance ---
const performanceMonthlyData = [
  { name: "Ene", oee: 82.1, otif: 91.2, target: 85.0 },
  { name: "Feb", oee: 83.4, otif: 92.0, target: 85.0 },
  { name: "Mar", oee: 84.0, otif: 91.8, target: 85.0 },
  { name: "Abr", oee: 85.2, otif: 93.1, target: 85.0 },
  { name: "May", oee: 85.8, otif: 93.7, target: 85.0 },
  { name: "Jun", oee: 86.5, otif: 94.2, target: 85.0 },
  { name: "Jul", oee: 86.9, otif: 94.0, target: 85.0 },
  { name: "Ago", oee: 87.1, otif: 94.5, target: 85.0 },
  { name: "Sep", oee: 87.4, otif: 94.8, target: 85.0 },
];

const bottleneckData = [
  { name: "Setups y Moldes", value: 42, fill: palette.navy },
  { name: "Mantenimiento", value: 28, fill: palette.cyan },
  { name: "Espera Materiales", value: 18, fill: palette.orange },
  { name: "Ajustes de Calidad", value: 12, fill: palette.yellow },
];

const plantPerformanceData = [
  { name: "Planta Guarne", rate: 96.4 },
  { name: "Planta Rionegro", rate: 94.2 },
  { name: "CEDI Principal", rate: 93.8 },
  { name: "Proyectos Esp.", rate: 91.5 },
];

const linePerformanceData = [
  { name: "Lavaplatos", value: 36, color: palette.navy },
  { name: "Bañeras & Spas", value: 28, color: palette.cyan },
  { name: "Mármol Sint.", value: 22, color: palette.orange },
  { name: "Muebles & Grif.", value: 14, color: palette.yellow },
];

// --- Datos Reporte Operaciones ---
const operationMonthlyData = [
  { name: "Ene", value: 420, target: 400 },
  { name: "Feb", value: 440, target: 415 },
  { name: "Mar", value: 465, target: 450 },
  { name: "Abr", value: 490, target: 470 },
  { name: "May", value: 520, target: 500 },
  { name: "Jun", value: 540, target: 520 },
  { name: "Jul", value: 580, target: 550 },
  { name: "Ago", value: 610, target: 580 },
  { name: "Sep", value: 635, target: 600 },
];

const navItems = [
  { label: "Resumen" as Report, icon: LayoutDashboard },
  { label: "Planner" as Report, icon: Layers, badge: "WIPL" },
  { label: "Performance" as Report, icon: Activity },
  { label: "Ventas" as Report, icon: TrendingUp, badge: "3" },
  { label: "Operaciones" as Report, icon: Package },
  { label: "Clientes" as Report, icon: Users },
];

const tabOptionsMap: Record<Report, string[]> = {
  Resumen: ["Resumen", "Canales", "Regiones", "Productos"],
  Planner: ["Capacidad & WIPL", "Atrasos", "Planes", "Detalle de Tareas"],
  Performance: ["General", "Eficiencia OEE", "Logística OTIF", "Calidad FPY"],
  Ventas: ["Resumen", "Canales", "Regiones", "Productos"],
  Operaciones: ["General", "Producción", "Inventarios", "Despachos"],
  Clientes: ["General", "Distribuidores", "Satisfacción CSAT", "Cartera"],
};

const tooltipStyle = {
  background: "#123552",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
  padding: "8px 12px",
};

function formatMillions(value: number) {
  return `$${value.toLocaleString("es-CO")} M`;
}

function MetricCard({
  label,
  value,
  change,
  positive = true,
  icon: Icon,
  tone,
  detail,
}: {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  icon: typeof TrendingUp;
  tone: "navy" | "cyan" | "orange" | "purple";
  detail: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={19} strokeWidth={2.2} />
      </div>
      <div className="metric-copy">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className={`metric-change ${positive ? "positive" : "negative"}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
          <span className="change-caption">vs. mes anterior</span>
        </div>
      </div>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-action">
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function NavIcon({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return <span className={`nav-item-icon ${active ? "active" : ""}`}>{children}</span>;
}

export default function Dashboard() {
  const [activeReport, setActiveReport] = useState<Report>("Resumen");
  const [activeTab, setActiveTab] = useState<string>("Resumen");
  const [period, setPeriod] = useState<Period>("Este mes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("Todas las regiones");

  const availableTabs = tabOptionsMap[activeReport] || ["General"];

  const handleSelectReport = (report: Report) => {
    setActiveReport(report);
    setActiveTab(tabOptionsMap[report][0]);
    setIsSidebarOpen(false);
  };

  const periodLabel = useMemo(() => {
    if (period === "Últimos 90 días") return "Jul 01 — Sep 30, 2026";
    if (period === "Este año") return "Ene 01 — Sep 30, 2026";
    return "Sep 01 — Sep 30, 2026";
  }, [period]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <main className="app-shell">
      <div className={`sidebar-backdrop ${isSidebarOpen ? "visible" : ""}`} onClick={() => setIsSidebarOpen(false)} />
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>F</span></div>
          <div className="brand-name">firplak<span>.</span></div>
          <button className="close-sidebar" onClick={() => setIsSidebarOpen(false)} aria-label="Cerrar menú"><X size={19} /></button>
        </div>

        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <button className="workspace-switcher">
          <span className="workspace-avatar">F</span>
          <span className="workspace-name">Firplak Colombia</span>
          <ChevronDown size={15} />
        </button>

        <nav className="main-nav" aria-label="Navegación principal">
          <div className="nav-group-label">REPORTES PRINCIPALES</div>
          {navItems.map(({ label, icon: Icon, badge }) => (
            <button
              className={`nav-item ${activeReport === label ? "selected" : ""}`}
              key={label}
              onClick={() => handleSelectReport(label)}
            >
              <NavIcon active={activeReport === label}><Icon size={18} /></NavIcon>
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}

          <div className="nav-group-label secondary-label">ACCESOS DIRECTOS</div>
          <button
            className={`nav-item ${activeReport === "Planner" ? "selected" : ""}`}
            onClick={() => handleSelectReport("Planner")}
          >
            <NavIcon active={activeReport === "Planner"}><Layers size={18} /></NavIcon>
            <span>Análisis de Planner</span>
          </button>
          <button
            className={`nav-item ${activeReport === "Performance" ? "selected" : ""}`}
            onClick={() => handleSelectReport("Performance")}
          >
            <NavIcon active={activeReport === "Performance"}><Activity size={18} /></NavIcon>
            <span>Performance</span>
          </button>
          <button className="nav-item"><NavIcon><BarChart3 size={18} /></NavIcon><span>Todos los Reportes</span></button>
          <button className="nav-item"><NavIcon><Target size={18} /></NavIcon><span>Metas 2026</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="tip-card">
            <div className="tip-icon"><Sparkles size={17} /></div>
            <div>
              <strong>Capacidad & WIPL</strong>
              <p>Monitoreo de flujo, WIPL configurable y balanceo operativo.</p>
              <button onClick={() => handleSelectReport("Planner")}>Ver Capacidad <ArrowUpRight size={13} /></button>
            </div>
          </div>
          <button className="nav-item"><NavIcon><Settings2 size={18} /></NavIcon><span>Configuración</span></button>
          <div className="profile-row">
            <div className="profile-avatar">DJ</div>
            <div className="profile-copy"><strong>Daniel Jiménez</strong><span>Administrador</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
            <div className="breadcrumbs">
              <span>Inicio</span>
              <ChevronRight size={14} />
              <span>Reportes</span>
              <ChevronRight size={14} />
              <strong>{activeReport === "Planner" ? "Capacidad Operativa & WIPL (Planner)" : activeReport}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Ayuda"><CircleHelp size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button>
            <div className="topbar-divider" />
            <div className="topbar-profile"><div className="profile-avatar small">DJ</div><ChevronDown size={14} /></div>
          </div>
        </header>

        <div className="page-content">
          {/* VISTA ESPECÍFICA: PLANNER / CAPACIDAD OPERATIVA & WIPL */}
          {activeReport === "Planner" ? (
            <div style={{ marginTop: "6px" }}>
              <CargaView />
            </div>
          ) : (
            <>
              <section className="hero-row">
                <div>
                  <div className="hero-kicker">
                    <span className="live-dot" /> Datos actualizados hace 12 min · Reporte: {activeReport}
                  </div>
                  <h1>
                    {activeReport === "Performance"
                      ? "Reporte de Performance"
                      : activeReport === "Operaciones"
                      ? "Reporte de Operaciones"
                      : activeReport === "Ventas"
                      ? "Reporte de Ventas"
                      : activeReport === "Clientes"
                      ? "Reporte de Clientes"
                      : "Hola, Daniel 👋"}
                  </h1>
                  <p className="hero-subtitle">
                    {activeReport === "Performance"
                      ? "Indicadores de eficiencia en manufactura (OEE), cumplimiento logístico (OTIF) y tiempos de entrega en Firplak."
                      : activeReport === "Operaciones"
                      ? "Flujo de producción, control de inventario y estado de despachos de planta."
                      : activeReport === "Ventas"
                      ? "Evolución de ingresos comerciales, cumplimiento de cuotas y distribución por canales."
                      : activeReport === "Clientes"
                      ? "Satisfacción de distribuidores, estado de pedidos y cartera de clientes Firplak."
                      : "Esta es la lectura consolidada del desempeño integral de Firplak."}
                  </p>
                </div>
                <div className="hero-actions">
                  <button className={`outline-button ${isRefreshing ? "spinning" : ""}`} onClick={handleRefresh}>
                    <RefreshCw size={16} /> Actualizar
                  </button>
                  <button className="primary-button">
                    <Download size={16} /> Exportar {activeReport}
                  </button>
                </div>
              </section>

              <section className="filter-toolbar">
                <div className="tabs" role="tablist" aria-label={`Vistas de ${activeReport}`}>
                  {availableTabs.map((tab) => (
                    <button
                      key={tab}
                      className={`tab ${activeTab === tab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                      role="tab"
                      aria-selected={activeTab === tab}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="filter-actions">
                  <div className="period-select">
                    <CalendarDays size={16} />
                    <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Periodo">
                      <option>Este mes</option>
                      <option>Últimos 90 días</option>
                      <option>Este año</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                  <button className={`filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={16} /> Filtros <span className="filter-count">1</span>
                  </button>
                </div>
              </section>

              {showFilters && (
                <div className="filter-panel">
                  <div className="filter-panel-label"><Filter size={15} /> Filtros activos</div>
                  <label>
                    Planta / Región
                    <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
                      <option>Todas las regiones</option>
                      <option>Planta Guarne</option>
                      <option>Planta Rionegro</option>
                      <option>CEDI Principal</option>
                      <option>Antioquia</option>
                      <option>Bogotá</option>
                      <option>Costa</option>
                    </select>
                  </label>
                  <label>
                    Línea
                    <select defaultValue="Consolidado">
                      <option>Consolidado</option>
                      <option>Lavaplatos</option>
                      <option>Bañeras y Spas</option>
                      <option>Mármol Sintético</option>
                      <option>Grifería</option>
                    </select>
                  </label>
                  <button className="clear-filter" onClick={() => setSelectedRegion("Todas las regiones")}>Limpiar</button>
                </div>
              )}

              <div className="date-note">
                <CalendarDays size={14} /> Mostrando {periodLabel} <span>•</span> {activeReport === "Performance" ? "Tasas porcentuales y métricas de tiempo" : "COP, millones"}
              </div>

              {/* VISTA ESPECÍFICA: PERFORMANCE */}
              {activeReport === "Performance" && (
                <>
                  <section className="metrics-grid" aria-label="Indicadores clave de performance">
                    <MetricCard
                      label="Cumplimiento OTIF"
                      value="94.8%"
                      change="2.4 pp"
                      icon={CheckCircle2}
                      tone="cyan"
                      detail="Meta: 92.0%"
                    />
                    <MetricCard
                      label="Eficiencia OEE Planta"
                      value="87.4%"
                      change="3.1 pp"
                      icon={Activity}
                      tone="navy"
                      detail="Meta: 85.0%"
                    />
                    <MetricCard
                      label="Lead Time Promedio"
                      value="4.1 días"
                      change="-0.8 d"
                      icon={Clock}
                      tone="orange"
                      detail="Meta: <= 5.0 d"
                    />
                    <MetricCard
                      label="Calidad First-Pass (FPY)"
                      value="99.2%"
                      change="0.4 pp"
                      icon={Sparkles}
                      tone="purple"
                      detail="Merma: 0.8%"
                    />
                  </section>

                  <section className="dashboard-grid top-charts">
                    <article className="card trend-card">
                      <SectionHeading eyebrow="EFICIENCIA OPERATIVA MENSUAL" title="Evolución OEE vs. OTIF Logístico" action="Ver análisis" />
                      <div className="chart-legend">
                        <span><i className="legend-dot sales" />OTIF (%)</span>
                        <span><i className="legend-dot" style={{ background: palette.navy }} />OEE Planta (%)</span>
                        <span><i className="legend-dot target" />Meta (85%)</span>
                        <span className="chart-period">{period === "Este mes" ? "2026" : period}</span>
                      </div>
                      <div className="large-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={performanceMonthlyData} margin={{ top: 12, right: 5, left: -18, bottom: 0 }}>
                            <defs>
                              <linearGradient id="otifGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={palette.cyan} stopOpacity={0.25} />
                                <stop offset="100%" stopColor={palette.cyan} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="4 4" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8a98a5", fontSize: 11 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8a98a5", fontSize: 11 }} tickFormatter={(val) => `${val}%`} domain={[75, 100]} ticks={[75, 80, 85, 90, 95, 100]} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              itemStyle={{ color: "#fff" }}
                              formatter={(value, name) => [`${value}%`, name === "otif" ? "OTIF Entregas" : name === "oee" ? "OEE Planta" : "Meta"]}
                            />
                            <Area type="monotone" dataKey="target" stroke="#b6c3ca" strokeWidth={2} strokeDasharray="6 5" fill="none" dot={false} />
                            <Area type="monotone" dataKey="oee" stroke={palette.navy} strokeWidth={2.5} fill="none" dot={{ r: 3, fill: palette.navy }} />
                            <Area type="monotone" dataKey="otif" stroke={palette.cyan} strokeWidth={3} fill="url(#otifGradient)" activeDot={{ r: 5, fill: palette.cyan, stroke: "#fff", strokeWidth: 3 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-footnote">
                        <span className="trend-up"><ArrowUpRight size={14} /> +3.6 pp</span> mejora acumulada en OEE en el año vs. promedio 2025
                      </div>
                    </article>

                    <article className="card channel-card">
                      <SectionHeading eyebrow="CAUSAS DE INEFICIENCIA" title="Distribución de Paradas" action="Detalle paradas" />
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={bottleneckData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={67} outerRadius={97} paddingAngle={3} stroke="none">
                              {bottleneckData.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center">
                          <strong>94.8%</strong>
                          <span>disponibilidad</span>
                        </div>
                      </div>
                      <div className="channel-list">
                        {bottleneckData.map((item) => (
                          <div className="channel-row" key={item.name}>
                            <span className="channel-name"><i style={{ background: item.fill }} />{item.name}</span>
                            <strong>{item.value}%</strong>
                            <span className="channel-value">{Math.round(item.value * 1.8)} hrs</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </section>

                  <section className="dashboard-grid bottom-charts">
                    <article className="card regions-card">
                      <SectionHeading eyebrow="CUMPLIMIENTO DE ENTREGA" title="OTIF por Centro y Planta" action="Ver centros" />
                      <div className="region-summary">
                        <div><span>Planta más eficiente</span><strong>Planta Guarne</strong></div>
                        <div><span>OTIF Promedio</span><strong>94,8%</strong></div>
                        <div><span>Variación neta</span><strong className="green-text">+2,4 pp</strong></div>
                      </div>
                      <div className="region-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={plantPerformanceData} layout="vertical" margin={{ left: 5, right: 5, top: 3, bottom: 0 }} barCategoryGap="28%">
                            <CartesianGrid horizontal={false} vertical stroke="#edf1f3" strokeDasharray="3 3" />
                            <XAxis type="number" hide domain={[80, 100]} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#647481", fontSize: 11 }} width={98} />
                            <Tooltip cursor={{ fill: "#f4f7f8" }} contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, "Cumplimiento OTIF"]} />
                            <Bar dataKey="rate" fill={palette.cyan} radius={[0, 5, 5, 0]} barSize={15} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="card product-card">
                      <SectionHeading eyebrow="LÍNEAS PRODUCTIVAS" title="Distribución de Carga y Eficiencia" action="Líneas" />
                      <div className="product-body">
                        <div className="product-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={linePerformanceData} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
                                {linePerformanceData.map((line) => (
                                  <Cell key={line.name} fill={line.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="product-center">
                            <strong>4</strong>
                            <span>líneas</span>
                          </div>
                        </div>
                        <div className="product-legend">
                          {linePerformanceData.map((line) => (
                            <div key={line.name}>
                              <span><i style={{ background: line.color }} />{line.name}</span>
                              <strong>{line.value}%</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="insight-box">
                        <Sparkles size={16} />
                        <span><strong>Insight:</strong> La optimización de cambio de moldes en Lavaplatos elevó el OEE al 89.5% este mes.</span>
                      </div>
                    </article>
                  </section>
                </>
              )}

              {/* VISTAS RESUMEN, VENTAS, OPERACIONES, CLIENTES */}
              {activeReport !== "Performance" && (
                <>
                  <section className="metrics-grid" aria-label="Indicadores principales">
                    <MetricCard
                      label={activeReport === "Operaciones" ? "Producción neta" : "Ventas netas"}
                      value={activeReport === "Operaciones" ? "14.820 und" : "$742 M"}
                      change={activeReport === "Operaciones" ? "9.4%" : "18.4%"}
                      icon={activeReport === "Operaciones" ? Package : ShoppingBag}
                      tone="navy"
                      detail={activeReport === "Operaciones" ? "Meta: 14.200 und" : "Meta: $700 M"}
                    />
                    <MetricCard
                      label="Cumplimiento"
                      value={activeReport === "Operaciones" ? "104.3%" : "106%"}
                      change="4.8 pp"
                      icon={Target}
                      tone="cyan"
                      detail={activeReport === "Operaciones" ? "+4.3 pp sobre meta" : "+6 pp sobre meta"}
                    />
                    <MetricCard
                      label={activeReport === "Operaciones" ? "Capacidad utilizada" : "Margen bruto"}
                      value={activeReport === "Operaciones" ? "88.2%" : "32.8%"}
                      change="2.1%"
                      icon={BarChart3}
                      tone="orange"
                      detail={activeReport === "Operaciones" ? "Meta: 85.0%" : "Meta: 30.0%"}
                    />
                    <MetricCard
                      label={activeReport === "Clientes" ? "Clientes activos" : "Pedidos activos"}
                      value={activeReport === "Clientes" ? "428 cuentas" : "1.284"}
                      change="11.7%"
                      icon={activeReport === "Clientes" ? Users : Package}
                      tone="purple"
                      detail={activeReport === "Clientes" ? "NPS 78 ptos" : "Ticket prom. $578 K"}
                    />
                  </section>

                  <section className="dashboard-grid top-charts">
                    <article className="card trend-card">
                      <SectionHeading
                        eyebrow={activeReport === "Operaciones" ? "UNIDADES PRODUCIDAS" : "INGRESOS NETOS"}
                        title={activeReport === "Operaciones" ? "Evolución de manufactura" : "Evolución de ventas"}
                        action="Ver detalle"
                      />
                      <div className="chart-legend">
                        <span><i className="legend-dot sales" />{activeReport === "Operaciones" ? "Producción" : "Ventas"}</span>
                        <span><i className="legend-dot target" />Meta</span>
                        <span className="chart-period">{period === "Este mes" ? "2026" : period}</span>
                      </div>
                      <div className="large-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={activeReport === "Operaciones" ? operationMonthlyData : monthlyData}
                            margin={{ top: 12, right: 5, left: -18, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={palette.cyan} stopOpacity={0.25} />
                                <stop offset="100%" stopColor={palette.cyan} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="4 4" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8a98a5", fontSize: 11 }} dy={10} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#8a98a5", fontSize: 11 }}
                              tickFormatter={(value) => (activeReport === "Operaciones" ? `${value}` : `$${value}`)}
                              domain={activeReport === "Operaciones" ? [350, 700] : [400, 800]}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              itemStyle={{ color: "#fff" }}
                              formatter={(value, name) => [
                                activeReport === "Operaciones" ? `${value} und` : `$${value} M`,
                                name === "value" ? (activeReport === "Operaciones" ? "Producción" : "Ventas") : "Meta",
                              ]}
                            />
                            <Area type="monotone" dataKey="target" stroke="#b6c3ca" strokeWidth={2} strokeDasharray="6 5" fill="none" dot={false} />
                            <Area type="monotone" dataKey="value" stroke={palette.cyan} strokeWidth={3} fill="url(#salesGradient)" activeDot={{ r: 5, fill: palette.cyan, stroke: "#fff", strokeWidth: 3 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-footnote">
                        <span className="trend-up"><ArrowUpRight size={14} /> 18,4%</span> crecimiento acumulado vs. 2025
                      </div>
                    </article>

                    <article className="card channel-card">
                      <SectionHeading eyebrow="MIX COMERCIAL" title="Ventas por canal" action="Ver canales" />
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={67} outerRadius={97} paddingAngle={3} stroke="none">
                              <Cell fill={palette.navy} />
                              <Cell fill={palette.cyan} />
                              <Cell fill={palette.orange} />
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center">
                          <strong>$742 M</strong>
                          <span>total ventas</span>
                        </div>
                      </div>
                      <div className="channel-list">
                        {channelData.map((channel) => (
                          <div className="channel-row" key={channel.name}>
                            <span className="channel-name"><i style={{ background: channel.fill }} />{channel.name}</span>
                            <strong>{channel.value}%</strong>
                            <span className="channel-value">{formatMillions(Math.round((742 * channel.value) / 100))}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </section>

                  <section className="dashboard-grid bottom-charts">
                    <article className="card regions-card">
                      <SectionHeading eyebrow="DISTRIBUCIÓN GEOGRÁFICA" title="Desempeño por región" action="Ver todas" />
                      <div className="region-summary">
                        <div><span>Región líder</span><strong>Antioquia</strong></div>
                        <div><span>Participación</span><strong>32,6%</strong></div>
                        <div><span>Variación anual</span><strong className="green-text">+14,2%</strong></div>
                      </div>
                      <div className="region-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={regionData} layout="vertical" margin={{ left: 5, right: 5, top: 3, bottom: 0 }} barCategoryGap="28%">
                            <CartesianGrid horizontal={false} vertical stroke="#edf1f3" strokeDasharray="3 3" />
                            <XAxis type="number" hide domain={[0, 270]} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#647481", fontSize: 11 }} width={87} />
                            <Tooltip cursor={{ fill: "#f4f7f8" }} contentStyle={tooltipStyle} formatter={(value) => [`$${value} M`, "Ventas"]} />
                            <Bar dataKey="revenue" fill={palette.navy} radius={[0, 5, 5, 0]} barSize={15} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="card product-card">
                      <SectionHeading eyebrow="CATEGORÍAS" title="Participación por producto" action="Catálogo" />
                      <div className="product-body">
                        <div className="product-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={productData} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
                                {productData.map((product) => (
                                  <Cell key={product.name} fill={product.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="product-center">
                            <strong>4</strong>
                            <span>líneas</span>
                          </div>
                        </div>
                        <div className="product-legend">
                          {productData.map((product) => (
                            <div key={product.name}>
                              <span><i style={{ background: product.color }} />{product.name}</span>
                              <strong>{product.value}%</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="insight-box">
                        <Sparkles size={16} />
                        <span><strong>Insight:</strong> Lavaplatos concentra la mayor oportunidad de crecimiento.</span>
                      </div>
                    </article>
                  </section>
                </>
              )}
            </>
          )}

          <footer className="page-footer">
            <span>© 2026 Firplak · Centro de indicadores</span>
            <span><span className="status-dot" /> Conexión a datos estable</span>
            <span className="footer-help"><Search size={14} /> Buscar en indicadores</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
