"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { createClient } from "@/lib/supabase/client";
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

type Period = "Este mes" | "Últimos 90 días" | "Este año";
type Tab = "Resumen" | "Canales" | "Regiones" | "Productos";

const palette = {
  navy: "#123552",
  cyan: "#0f9f9a",
  orange: "#ef8354",
  yellow: "#efb44a",
  purple: "#8c72ca",
};

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

const navItems = [
  { label: "Resumen", icon: LayoutDashboard },
  { label: "Ventas", icon: TrendingUp },
  { label: "Operación", icon: Package },
  { label: "Clientes", icon: Users },
];

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
  const [userEmail, setUserEmail] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("Resumen");
  const [period, setPeriod] = useState<Period>("Este mes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("Todas las regiones");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
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
          <div className="nav-group-label">MENU PRINCIPAL</div>
          {navItems.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${label === "Resumen" ? "selected" : ""}`} key={label}>
              <NavIcon active={label === "Resumen"}><Icon size={18} /></NavIcon>
              <span>{label}</span>
              {label === "Ventas" && <span className="nav-badge">3</span>}
            </button>
          ))}
          <div className="nav-group-label secondary-label">REPORTES</div>
          <button className="nav-item"><NavIcon><BarChart3 size={18} /></NavIcon><span>Reportes</span></button>
          <button className="nav-item"><NavIcon><Target size={18} /></NavIcon><span>Metas</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="tip-card">
            <div className="tip-icon"><Sparkles size={17} /></div>
            <div>
              <strong>Nueva lectura</strong>
              <p>Compara el desempeño por región en segundos.</p>
              <button>Ver novedades <ArrowUpRight size={13} /></button>
            </div>
          </div>
          <button className="nav-item"><NavIcon><Settings2 size={18} /></NavIcon><span>Configuración</span></button>
          <div className="profile-row">
            <div className="profile-avatar">DJ</div>
            <div className="profile-copy"><strong>{userEmail || "Usuario Firplak"}</strong><span>Sesión Microsoft 365</span></div>
            <button className="logout-button" onClick={handleSignOut} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
            <div className="breadcrumbs"><span>Inicio</span><ChevronRight size={14} /><strong>Resumen ejecutivo</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Ayuda"><CircleHelp size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button>
            <div className="topbar-divider" />
            <div className="topbar-profile"><div className="profile-avatar small">DJ</div><ChevronDown size={14} /></div>
          </div>
        </header>

        <div className="page-content">
          <section className="hero-row">
            <div>
              <div className="hero-kicker"><span className="live-dot" /> Datos actualizados hace 12 min</div>
              <h1>Hola, Daniel <span>👋</span></h1>
              <p className="hero-subtitle">Esta es la lectura del desempeño de Firplak.</p>
            </div>
            <div className="hero-actions">
              <button className={`outline-button ${isRefreshing ? "spinning" : ""}`} onClick={handleRefresh}><RefreshCw size={16} /> Actualizar</button>
              <button className="primary-button"><Download size={16} /> Exportar reporte</button>
            </div>
          </section>

          <section className="filter-toolbar">
            <div className="tabs" role="tablist" aria-label="Vistas del dashboard">
              {(["Resumen", "Canales", "Regiones", "Productos"] as Tab[]).map((tab) => (
                <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab}>{tab}</button>
              ))}
            </div>
            <div className="filter-actions">
              <div className="period-select"><CalendarDays size={16} /><select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Periodo"><option>Este mes</option><option>Últimos 90 días</option><option>Este año</option></select><ChevronDown size={14} /></div>
              <button className={`filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters(!showFilters)}><Filter size={16} /> Filtros <span className="filter-count">1</span></button>
            </div>
          </section>

          {showFilters && (
            <div className="filter-panel">
              <div className="filter-panel-label"><Filter size={15} /> Filtros activos</div>
              <label>Región<select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}><option>Todas las regiones</option><option>Antioquia</option><option>Bogotá</option><option>Costa</option><option>Eje Cafetero</option></select></label>
              <label>Fuente<select defaultValue="Consolidado"><option>Consolidado</option><option>Ventas directas</option><option>Distribuidores</option></select></label>
              <button className="clear-filter" onClick={() => setSelectedRegion("Todas las regiones")}>Limpiar</button>
            </div>
          )}

          <div className="date-note"><CalendarDays size={14} /> Mostrando {periodLabel} <span>•</span> COP, millones</div>

          <section className="metrics-grid" aria-label="Indicadores principales">
            <MetricCard label="Ventas netas" value="$742 M" change="18.4%" icon={ShoppingBag} tone="navy" detail="Meta: $700 M" />
            <MetricCard label="Cumplimiento" value="106%" change="4.8 pp" icon={Target} tone="cyan" detail="+6 pp sobre meta" />
            <MetricCard label="Margen bruto" value="32.8%" change="2.1%" icon={BarChart3} tone="orange" detail="Meta: 30.0%" />
            <MetricCard label="Pedidos activos" value="1.284" change="11.7%" icon={Package} tone="purple" detail="Ticket prom. $578 K" />
          </section>

          <section className="dashboard-grid top-charts">
            <article className="card trend-card">
              <SectionHeading eyebrow="INGRESOS NETOS" title="Evolución de ventas" action="Ver detalle" />
              <div className="chart-legend"><span><i className="legend-dot sales" />Ventas</span><span><i className="legend-dot target" />Meta</span><span className="chart-period">{period === "Este mes" ? "2026" : period}</span></div>
              <div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyData} margin={{ top: 12, right: 5, left: -18, bottom: 0 }}><defs><linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette.cyan} stopOpacity={0.25} /><stop offset="100%" stopColor={palette.cyan} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9eef1" strokeDasharray="4 4" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8a98a5", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8a98a5", fontSize: 11 }} tickFormatter={(value) => `$${value}`} domain={[400, 800]} ticks={[400, 500, 600, 700, 800]} /><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} formatter={(value, name) => [`$${value} M`, name === "value" ? "Ventas" : "Meta"]} /><Area type="monotone" dataKey="target" stroke="#b6c3ca" strokeWidth={2} strokeDasharray="6 5" fill="none" dot={false} /><Area type="monotone" dataKey="value" stroke={palette.cyan} strokeWidth={3} fill="url(#salesGradient)" activeDot={{ r: 5, fill: palette.cyan, stroke: "#fff", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
              <div className="chart-footnote"><span className="trend-up"><ArrowUpRight size={14} /> 18,4%</span> crecimiento acumulado vs. 2025</div>
            </article>

            <article className="card channel-card">
              <SectionHeading eyebrow="MIX COMERCIAL" title="Ventas por canal" action="Ver canales" />
              <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={67} outerRadius={97} paddingAngle={3} stroke="none"><Cell fill={palette.navy} /><Cell fill={palette.cyan} /><Cell fill={palette.orange} /></Pie><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>$742 M</strong><span>total ventas</span></div></div>
              <div className="channel-list">{channelData.map((channel) => <div className="channel-row" key={channel.name}><span className="channel-name"><i style={{ background: channel.fill }} />{channel.name}</span><strong>{channel.value}%</strong><span className="channel-value">{formatMillions(Math.round((742 * channel.value) / 100))}</span></div>)}</div>
            </article>
          </section>

          <section className="dashboard-grid bottom-charts">
            <article className="card regions-card">
              <SectionHeading eyebrow="DISTRIBUCIÓN GEOGRÁFICA" title="Desempeño por región" action="Ver todas" />
              <div className="region-summary"><div><span>Región líder</span><strong>Antioquia</strong></div><div><span>Participación</span><strong>32,6%</strong></div><div><span>Variación anual</span><strong className="green-text">+14,2%</strong></div></div>
              <div className="region-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={regionData} layout="vertical" margin={{ left: 5, right: 5, top: 3, bottom: 0 }} barCategoryGap="28%"><CartesianGrid horizontal={false} vertical stroke="#edf1f3" strokeDasharray="3 3" /><XAxis type="number" hide domain={[0, 270]} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#647481", fontSize: 11 }} width={87} /><Tooltip cursor={{ fill: "#f4f7f8" }} contentStyle={tooltipStyle} formatter={(value) => [`$${value} M`, "Ventas"]} /><Bar dataKey="revenue" fill={palette.navy} radius={[0, 5, 5, 0]} barSize={15} /></BarChart></ResponsiveContainer></div>
            </article>

            <article className="card product-card">
              <SectionHeading eyebrow="CATEGORÍAS" title="Participación por producto" action="Catálogo" />
              <div className="product-body"><div className="product-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={productData} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">{productData.map((product) => <Cell key={product.name} fill={product.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} /></PieChart></ResponsiveContainer><div className="product-center"><strong>4</strong><span>líneas</span></div></div><div className="product-legend">{productData.map((product) => <div key={product.name}><span><i style={{ background: product.color }} />{product.name}</span><strong>{product.value}%</strong></div>)}</div></div>
              <div className="insight-box"><Sparkles size={16} /><span><strong>Insight:</strong> Lavaplatos concentra la mayor oportunidad de crecimiento.</span></div>
            </article>
          </section>

          <footer className="page-footer"><span>© 2026 Firplak · Centro de indicadores</span><span><span className="status-dot" /> Conexión a datos estable</span><span className="footer-help"><Search size={14} /> Buscar en indicadores</span></footer>
        </div>
      </section>
    </main>
  );
}
