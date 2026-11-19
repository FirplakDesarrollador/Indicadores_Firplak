import { NextRequest, NextResponse } from "next/server";
import { getMoldesData } from "@/lib/moldes/service";
import type { MoldCategoryKey } from "@/lib/moldes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_CATEGORIES = new Set<MoldCategoryKey>([
  "Todos",
  "REPARACION_RAPIDA",
  "REPARACION_ESPECIAL",
  "MOLDE_NUEVO",
  "MODELO_NUEVO",
]);

function defaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${d}` };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const def = defaultDateRange();
    const startDate = sp.get("desde") || def.start;
    const endDate = sp.get("hasta") || def.end;
    const rawCat = (sp.get("categoria") || "Todos") as MoldCategoryKey;
    const category = VALID_CATEGORIES.has(rawCat) ? rawCat : "Todos";

    const payload = await getMoldesData({
      startDate,
      endDate,
      category,
      plant: sp.get("planta") ?? "Todos",
      status: sp.get("estado") ?? "Todos",
      defect: sp.get("defecto") ?? "Todos",
      responsible: sp.get("responsable") ?? "Todos",
      search: sp.get("search") ?? "",
      page: Number(sp.get("page") ?? 1) || 1,
      pageSize: Number(sp.get("pageSize") ?? 50) || 50,
    });

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("No fue posible cargar los indicadores de moldes", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los datos de moldes en Supabase.",
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
