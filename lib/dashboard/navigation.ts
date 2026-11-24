import { BarChart3, Boxes, CalendarRange, ChartColumnStacked, ClipboardList, Factory, FileMinus, Gauge, Handshake, ListOrdered, ShieldCheck, Table2, Target, TrendingUp, Truck, type LucideIcon } from "lucide-react";

export type DashboardNavItem = { href: string; label: string; icon: LucideIcon };
export type DashboardNavGroup = { label: string; items: DashboardNavItem[] };

// Cada reporte muestra en el menú lateral su vista principal y sus detalles.
export const billingNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/facturacion-diaria", label: "Facturación y entregas", icon: TrendingUp }] },
  {
    label: "ANÁLISIS",
    items: [
      { href: "/facturacion-diaria/detalle", label: "Detalle de facturas", icon: Table2 },
      { href: "/facturacion-diaria/entregas", label: "Detalle de entregas", icon: Truck },
    ],
  },
];

// Metas: se abre desde el menú del perfil (informe metas-comerciales) y se vuelve a facturación desde aquí.
export const targetsNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/metas-comerciales", label: "Metas comerciales", icon: Target }] },
  { label: "INFORMES", items: [{ href: "/facturacion-diaria", label: "Facturación y entregas", icon: TrendingUp }] },
];

export const creditNoteNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/notas-credito", label: "Notas crédito", icon: FileMinus }] },
  { label: "ANÁLISIS", items: [{ href: "/notas-credito/detalle", label: "Detalle de notas crédito", icon: Table2 }] },
];

export const commercialNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/consolidado-comercial", label: "Consolidado comercial", icon: Handshake }] },
  { label: "ANÁLISIS", items: [{ href: "/consolidado-comercial/detalle", label: "Detalle de ofertas, OV y tránsito", icon: Table2 }] },
];

// Costo de PT tiene una sola vista: el detalle es la lista de materiales del producto elegido.
export const productCostNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/costo-actual-pt", label: "Costo de producto", icon: Boxes }] },
];

export const nsPlantsNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/ns-plantas", label: "Nivel de servicio", icon: Factory }] },
  { label: "ANÁLISIS", items: [{ href: "/ns-plantas/detalle", label: "Detalle de órdenes", icon: Table2 }] },
];

// PKT: la matriz con las tarjetas en la vista principal y las gráficas en su propia página.
export const pktNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/pkt", label: "PKT", icon: Gauge }] },
  { label: "ANÁLISIS", items: [{ href: "/pkt/graficas", label: "Gráficas del PKT", icon: BarChart3 }] },
];

// Las 5 páginas del Power BI, en el mismo orden.
export const releaseNavigation: DashboardNavGroup[] = [
  {
    label: "MENÚ PRINCIPAL",
    items: [
      { href: "/liberacion", label: "Cumplimiento liberación", icon: ChartColumnStacked },
      { href: "/liberacion/acumulado", label: "Cumplimiento acumulado", icon: CalendarRange },
    ],
  },
  {
    label: "ANÁLISIS",
    items: [
      { href: "/liberacion/razones-dia", label: "Razones por día", icon: ListOrdered },
      { href: "/liberacion/razones", label: "Razones de incumplimiento", icon: BarChart3 },
      { href: "/liberacion/control", label: "Control", icon: ClipboardList },
    ],
  },
];

export const adminNavigation: DashboardNavGroup[] = [
  { label: "ADMINISTRACIÓN", items: [{ href: "/admin/permisos", label: "Permisos de informes", icon: ShieldCheck }] },
];
