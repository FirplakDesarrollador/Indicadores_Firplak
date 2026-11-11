import type { NextRequest } from "next/server";
import { proxyXlsxExport } from "@/lib/dashboard/xlsxExportProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// La descarga se reenvía en streaming; aplica la duración máxima de la función.
export const maxDuration = 300;

export function GET(request: NextRequest) {
  return proxyXlsxExport(request, {
    apiPath: "/api/v1/entregas/export",
    fileName: "entregas.xlsx",
    label: "las entregas",
    timeoutMs: (maxDuration - 10) * 1000,
  });
}
