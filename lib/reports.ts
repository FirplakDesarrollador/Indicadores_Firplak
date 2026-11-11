import { Boxes, FileMinus, ReceiptText, Target, type LucideIcon } from "lucide-react";

// Catálogo de informes del portal. El slug es el que se guarda en public.report_permissions.
// Un informe nuevo no lo ve nadie hasta que un administrador lo agrega a un cargo o lo asigna a una persona en /admin/permisos.

// Áreas que agrupan los informes en el portal y en la administración, en este orden.
export const reportAreas = [
  { id: "ventas", label: "Informes de ventas", short: "Ventas" },
  { id: "contabilidad", label: "Informes de contabilidad", short: "Contabilidad" },
  { id: "financiera", label: "Informes financieros", short: "Financiera" },
  { id: "logistica", label: "Informes de logística", short: "Logística" },
] as const;

export type ReportArea = (typeof reportAreas)[number]["id"];

export type ReportDefinition = {
  slug: string;
  area: ReportArea;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  pagePaths: string[];
  apiPaths: string[];
  // Herramienta de gestión: se asigna en /admin/permisos como un informe, pero no tiene card en el portal;
  // se abre desde el menú del perfil.
  tool?: boolean;
};

export const reports: ReportDefinition[] = [
  {
    slug: "facturacion-diaria",
    area: "ventas",
    title: "Facturación y entregas diaria",
    subtitle: "Indicadores comerciales y operativos",
    href: "/facturacion-diaria",
    icon: ReceiptText,
    pagePaths: ["/facturacion-diaria"],
    apiPaths: ["/api/facturacion-diaria", "/api/entregas"],
  },
  {
    // Edición de metas mensuales y días laborales. Las metas se guardan en Supabase (commercial_targets) y su RLS
    // usa este mismo slug: quien ve facturacion-diaria solo las lee; quien tiene metas-comerciales las edita.
    slug: "metas-comerciales",
    area: "ventas",
    title: "Metas comerciales",
    subtitle: "Metas mensuales de facturación y entregas por empresa",
    href: "/metas-comerciales",
    icon: Target,
    pagePaths: ["/metas-comerciales"],
    apiPaths: [],
    tool: true,
  },
  {
    slug: "notas-credito",
    area: "ventas",
    title: "Notas crédito",
    subtitle: "Notas crédito frente a la facturación y sus causas",
    href: "/notas-credito",
    icon: FileMinus,
    pagePaths: ["/notas-credito"],
    apiPaths: ["/api/notas-credito"],
  },
  {
    slug: "costo-actual-pt",
    area: "contabilidad",
    title: "Costo de producto terminado",
    subtitle: "Costo actual en MP, MO y CIF por lista de materiales",
    href: "/costo-actual-pt",
    icon: Boxes,
    pagePaths: ["/costo-actual-pt"],
    // Incluye /api/costo-actual-pt/export (la descarga en CSV).
    apiPaths: ["/api/costo-actual-pt"],
  },
];

// Informes agrupados por área; omite las áreas que aún no tienen informes.
export function groupReportsByArea<T extends { area: ReportArea }>(items: T[]) {
  return reportAreas
    .map((area) => ({ ...area, items: items.filter((item) => item.area === area.id) }))
    .filter((group) => group.items.length > 0);
}

export const adminPath = "/admin";

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function reportForPath(pathname: string) {
  return reports.find((report) => [...report.pagePaths, ...report.apiPaths].some((prefix) => matchesPath(pathname, prefix)));
}

export function isAdminPath(pathname: string) {
  return matchesPath(pathname, adminPath);
}
