import { FileMinus, Table2, TrendingUp, type LucideIcon } from "lucide-react";

export type DashboardNavItem = { href: string; label: string; icon: LucideIcon };
export type DashboardNavGroup = { label: string; items: DashboardNavItem[] };

// Cada reporte muestra en el menú lateral solo su vista principal y su detalle.
export const billingNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/facturacion-diaria", label: "Facturación", icon: TrendingUp }] },
  { label: "ANÁLISIS", items: [{ href: "/facturacion-diaria/detalle", label: "Detalle de documentos", icon: Table2 }] },
];

export const creditNoteNavigation: DashboardNavGroup[] = [
  { label: "MENÚ PRINCIPAL", items: [{ href: "/notas-credito", label: "Notas crédito", icon: FileMinus }] },
  { label: "ANÁLISIS", items: [{ href: "/notas-credito/detalle", label: "Detalle de notas crédito", icon: Table2 }] },
];
