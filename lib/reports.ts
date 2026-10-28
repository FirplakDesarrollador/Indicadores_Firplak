import { FileMinus, ReceiptText, type LucideIcon } from "lucide-react";

// Catálogo de informes del portal. El slug es el que se guarda en public.report_permissions.
// Un informe nuevo no lo ve nadie hasta que un administrador lo asigna en /admin/permisos.
export type ReportDefinition = {
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  pagePaths: string[];
  apiPaths: string[];
};

export const reports: ReportDefinition[] = [
  {
    slug: "facturacion-diaria",
    title: "Facturación diaria",
    subtitle: "Indicadores comerciales y operativos",
    href: "/facturacion-diaria",
    icon: ReceiptText,
    pagePaths: ["/facturacion-diaria"],
    apiPaths: ["/api/facturacion-diaria", "/api/entregas"],
  },
  {
    slug: "notas-credito",
    title: "Notas crédito",
    subtitle: "Notas crédito frente a la facturación y sus causas",
    href: "/notas-credito",
    icon: FileMinus,
    pagePaths: ["/notas-credito"],
    apiPaths: ["/api/notas-credito"],
  },
];

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
