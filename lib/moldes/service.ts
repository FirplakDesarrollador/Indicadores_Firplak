import { fetchAllSupabaseRows } from "@/lib/moldes/supabase";
import type {
  MoldCategoryKey,
  MoldFilterOptions,
  MoldIndisponibilityRefRow,
  MoldMasterRow,
  MoldMonthlyItem,
  MoldOrderRow,
  MoldParetoItem,
  MoldPayload,
  MoldRapidaSummary,
  MoldSummary,
} from "@/lib/moldes/types";

type RawBdMoldesRow = {
  id: number;
  "Título": string | null;
  "CODIGO MOLDE": string | null;
  "DEFECTOS A REPARAR": string | null;
  "FECHA ENTRADA": string | null;
  "FECHA ESPERADA": string | null;
  "FECHA ENTREGA": string | null;
  ESTADO: string | null;
  OBSERVACIONES: string | null;
  Responsable: string | null;
  "Tipo de reparacion": string | null;
  Tipo: string | null;
};

type RawHistoricoRow = {
  id: number;
  pk_id: number;
  titulo: string | null;
  codigo_molde: string | null;
  defectos_a_reparar: string | null;
  fecha_entrada: string | null;
  fecha_esperada: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  observaciones: string | null;
  responsable: string | null;
  tipo_de_reparacion: string | null;
  tipo: string | null;
};

type RawMoldeMaster = {
  id: number;
  serial: string | null;
  estado: string | null;
  vueltas_actuales: number | null;
  vueltas_acumuladas: number | null;
  nombre_articulo: string | null;
  descripcion_molde: string | null;
};

type RawPlantaMolde = {
  numero_de_serie: string | null;
  planta: string | null;
};

type RawOrdenFabricacion = {
  cantidad: number | null;
  fecha_entrega_real: string | null;
};

export type MoldQueryParams = {
  startDate: string;
  endDate: string;
  category: MoldCategoryKey;
  plant: string;
  status: string;
  defect: string;
  responsible: string;
  search: string;
  page: number;
  pageSize: number;
};

const ACTIVE_STATES = new Set([
  "en reparación",
  "en reparacion",
  "en espera - produccion",
  "en espera - producción",
  "en espera produccion",
  "en espera - moldes",
  "en espera - reparación",
  "en espera moldes",
]);

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeSerial(value: string): string {
  return value.replace(/^0+/, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function normalizeStatus(value: string | null | undefined): string {
  const cleaned = cleanText(value);
  if (!cleaned) return "PROCESO";
  const lower = cleaned.toLowerCase();
  if (lower === "en reparacion" || lower === "en reparación") return "En reparacion";
  if (lower === "entregado") return "Entregado";
  if (lower === "destruido") return "Destruido";
  if (lower === "en espera - moldes") return "En espera - Moldes";
  if (lower === "en espera - produccion" || lower === "en espera - producción") return "En espera - Produccion";
  return cleaned;
}

function parseDefects(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function classifyCategory(
  rawType: string,
  repairType: string,
): Exclude<MoldCategoryKey, "Todos"> | "OTRO" {
  const tip = rawType.trim().toUpperCase();
  const tr = repairType.trim().toUpperCase();
  if (tip === "MOLDE NUEVO") return "MOLDE_NUEVO";
  if (tr.includes("MODELO")) return "MODELO_NUEVO";
  if (tr.includes("RAPIDA") || tr.includes("RÁPIDA")) return "REPARACION_RAPIDA";
  if (tr.includes("ESPECIAL")) return "REPARACION_ESPECIAL";
  return "OTRO";
}

function classifyWeight(
  defectsRaw: string,
  repairType: string,
  plantVal: string,
): { weight: number; label: string; kind: "MS" | "FV" | "DESM_MS" | "DESM_FV" | "BRILLADO" | "OTHER" } {
  const d = defectsRaw.toLowerCase();
  const t = repairType.toLowerCase();
  const desmanchado = d.includes("desmanch") || t.includes("desmanch");
  const brillado = /\bbrillado\b/i.test(d) || /\bbrillado\b/i.test(t);
  const isMS = plantVal.includes("MS");
  const isFV = plantVal.includes("FV");

  if (desmanchado) {
    if (isFV) return { weight: 0.5, label: "Desmanchado FV (×½)", kind: "DESM_FV" };
    return { weight: 1 / 3, label: "Desmanchado MS (×⅓)", kind: "DESM_MS" };
  }
  if (brillado) {
    return { weight: 0.5, label: "Brillado (×½)", kind: "BRILLADO" };
  }
  if (isMS) return { weight: 1, label: "MS (×1)", kind: "MS" };
  if (isFV) return { weight: 1, label: "FV (×1)", kind: "FV" };
  return { weight: 1, label: "S/C (×1)", kind: "OTHER" };
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

function diffDaysOut(startIso: string | null, endIso: string | null): number {
  if (!startIso) return 0;
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const endStr = endIso ?? new Date().toISOString().slice(0, 10);
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const days = Math.round((end - start) / 86_400_000);
  return days <= 0 ? 0.5 : days;
}

function daysInMonthOf(dateIso: string): number {
  const [y, m] = dateIso.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Deduplicación oficial de App_Moldes (indicators.service.ts):
 * Agrupa por (codigo_molde | fecha_entrada), prioriza registros con fecha_entrega
 * y luego el de mayor id.
 */
function deduplicateHistorico(
  rows: RawHistoricoRow[],
  plantBySerial: Map<string, string>,
  plantByNormSerial: Map<string, string>,
): MoldOrderRow[] {
  const groups = new Map<string, RawHistoricoRow>();

  for (const r of rows) {
    const code = cleanText(r.codigo_molde).toUpperCase();
    const entry = normalizeDate(r.fecha_entrada) ?? "";
    const key = `${code}|${entry}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, r);
      continue;
    }
    const rDelivered = Boolean(normalizeDate(r.fecha_entrega));
    const exDelivered = Boolean(normalizeDate(existing.fecha_entrega));
    if (rDelivered && !exDelivered) {
      groups.set(key, r);
    } else if (rDelivered === exDelivered && r.id > existing.id) {
      groups.set(key, r);
    }
  }

  return Array.from(groups.values()).map((r) => {
    const moldCode = cleanText(r.codigo_molde) || "Sin código";
    const normCode = normalizeSerial(moldCode);
    const plant = plantBySerial.get(moldCode) ?? plantByNormSerial.get(normCode) ?? "Sin planta";
    const entryDate = normalizeDate(r.fecha_entrada);
    const expectedDate = normalizeDate(r.fecha_esperada);
    const deliveryDate = normalizeDate(r.fecha_entrega);
    const status = normalizeStatus(r.estado);
    const defectsRaw = cleanText(r.defectos_a_reparar);
    const repairTypeRaw = cleanText(r.tipo_de_reparacion);
    const rawType = cleanText(r.tipo);
    const weightInfo = classifyWeight(defectsRaw, repairTypeRaw, plant.toUpperCase());

    return {
      id: `hist-${r.id}`,
      numericId: r.id,
      source: "historico",
      title: cleanText(r.titulo) || "Sin descripción",
      moldCode,
      plant,
      defectsRaw,
      defects: parseDefects(defectsRaw),
      entryDate,
      expectedDate,
      deliveryDate,
      status,
      observations: cleanText(r.observaciones),
      responsible: cleanText(r.responsable) || "Sin responsable",
      repairTypeRaw,
      rawType,
      category: classifyCategory(rawType, repairTypeRaw),
      daysOut: diffDaysOut(entryDate, deliveryDate),
      isCompliant: Boolean(deliveryDate && expectedDate && deliveryDate <= expectedDate),
      tag: "comprometido",
      deliveryWeight: weightInfo.weight,
      weightLabel: weightInfo.label,
    };
  });
}

function buildParetoDefects(rows: MoldOrderRow[]): MoldParetoItem[] {
  const counts = new Map<string, number>();
  let totalCount = 0;

  for (const row of rows) {
    for (const def of row.defects) {
      const lower = def.toLowerCase();
      if (lower === "molde nuevo" || lower === "modelo nuevo") continue;
      counts.set(def, (counts.get(def) ?? 0) + 1);
      totalCount += 1;
    }
  }

  const sorted = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let running = 0;
  return sorted.map((item) => {
    running += item.count;
    return {
      name: item.name,
      count: item.count,
      cumulativePct: totalCount > 0 ? Number(((running / totalCount) * 100).toFixed(1)) : 0,
    };
  });
}

function isRapidaTarget(row: { repairTypeRaw: string; defectsRaw: string }): boolean {
  const t = row.repairTypeRaw.toLowerCase();
  const d = row.defectsRaw.toLowerCase();
  return (
    t.includes("rapida") ||
    t.includes("rápida") ||
    t.includes("desmanch") ||
    t.includes("brill") ||
    d.includes("rapida") ||
    d.includes("rápida") ||
    d.includes("desmanch") ||
    d.includes("brill")
  );
}

function computeRapidaSummary(
  deduplicated: MoldOrderRow[],
  bdRows: RawBdMoldesRow[],
  dateRange: { start: string; end: string },
  plantBySerial: Map<string, string>,
  plantByNormSerial: Map<string, string>,
): MoldRapidaSummary {
  const numDays = Math.max(1, diffDaysInclusive(dateRange.start, dateRange.end));
  const metaTotal = 24 * numDays;
  const metaPorPersona = 3.4;

  const reparados = deduplicated.filter((r) => {
    const isDelivered = r.status.toLowerCase().includes("entrega");
    return (
      isRapidaTarget(r) &&
      isDelivered &&
      Boolean(r.deliveryDate && r.deliveryDate >= dateRange.start && r.deliveryDate <= dateRange.end)
    );
  });

  let countMS = 0;
  let countFV = 0;
  let countDesmanchadoMS = 0;
  let countDesmanchadoFV = 0;
  let countBrillado = 0;
  let countOther = 0;
  let totalMoldesReparados = 0;

  for (const r of reparados) {
    const w = classifyWeight(r.defectsRaw, r.repairTypeRaw, r.plant.toUpperCase());
    totalMoldesReparados += w.weight;
    if (w.kind === "MS") countMS += 1;
    else if (w.kind === "FV") countFV += 1;
    else if (w.kind === "DESM_MS") countDesmanchadoMS += 1;
    else if (w.kind === "DESM_FV") countDesmanchadoFV += 1;
    else if (w.kind === "BRILLADO") countBrillado += 1;
    else countOther += 1;
  }

  // Esperados desde BD_moldes (estado actual) con FECHA ESPERADA en el rango.
  const esperadosList: MoldOrderRow[] = bdRows
    .filter((r) => {
      const fEsp = normalizeDate(r["FECHA ESPERADA"]);
      if (!fEsp || fEsp < dateRange.start || fEsp > dateRange.end) return false;
      return isRapidaTarget({
        repairTypeRaw: cleanText(r["Tipo de reparacion"]),
        defectsRaw: cleanText(r["DEFECTOS A REPARAR"]),
      });
    })
    .map((r) => {
      const moldCode = cleanText(r["CODIGO MOLDE"]) || "Sin código";
      const plant =
        plantBySerial.get(moldCode) ?? plantByNormSerial.get(normalizeSerial(moldCode)) ?? "Sin planta";
      const entryDate = normalizeDate(r["FECHA ENTRADA"]);
      const expectedDate = normalizeDate(r["FECHA ESPERADA"]);
      const deliveryDate = normalizeDate(r["FECHA ENTREGA"]);
      const defectsRaw = cleanText(r["DEFECTOS A REPARAR"]);
      const repairTypeRaw = cleanText(r["Tipo de reparacion"]);
      const weightInfo = classifyWeight(defectsRaw, repairTypeRaw, plant.toUpperCase());

      return {
        id: `bd-${r.id}`,
        numericId: r.id,
        source: "BD_moldes",
        title: cleanText(r["Título"]) || "Sin descripción",
        moldCode,
        plant,
        defectsRaw,
        defects: parseDefects(defectsRaw),
        entryDate,
        expectedDate,
        deliveryDate,
        status: normalizeStatus(r.ESTADO),
        observations: cleanText(r.OBSERVACIONES),
        responsible: cleanText(r.Responsable) || "Sin responsable",
        repairTypeRaw,
        rawType: cleanText(r.Tipo),
        category: "REPARACION_RAPIDA",
        daysOut: diffDaysOut(entryDate, deliveryDate),
        isCompliant: Boolean(deliveryDate && expectedDate && deliveryDate <= expectedDate),
        tag: "comprometido",
        deliveryWeight: weightInfo.weight,
        weightLabel: weightInfo.label,
      };
    });

  const expectedCodes = new Set(esperadosList.map((r) => r.moldCode.toUpperCase()));

  const entregadosList = deduplicated.filter((r) => {
    const st = r.status.toLowerCase();
    const isDestruido = st.includes("destruido");
    const isDelivered = st.includes("entrega");
    if (!isDelivered && !isDestruido) return false;
    const refDate = r.deliveryDate || (isDestruido ? r.expectedDate : null);
    if (!refDate || refDate < dateRange.start || refDate > dateRange.end) return false;
    return expectedCodes.has(r.moldCode.toUpperCase());
  });

  const moldesEsperados = esperadosList.length;
  const moldesEntregados = entregadosList.length;
  const productividadPct = metaTotal > 0 ? (totalMoldesReparados / metaTotal) * 100 : 0;
  const nivelServicioPct = moldesEsperados > 0 ? (moldesEntregados / moldesEsperados) * 100 : null;

  return {
    totalMoldesReparados: Number(totalMoldesReparados.toFixed(1)),
    rawRepairedCount: reparados.length,
    countMS,
    countFV,
    countDesmanchadoMS,
    countDesmanchadoFV,
    countBrillado,
    countOther,
    moldesEsperados,
    moldesEntregados,
    numDays,
    metaTotal,
    metaPorPersona,
    productividadPct: Number(productividadPct.toFixed(1)),
    nivelServicioPct: nivelServicioPct !== null ? Number(nivelServicioPct.toFixed(1)) : null,
    reparados: reparados.slice(0, 100),
    esperadosList: esperadosList.slice(0, 100),
    entregadosList: entregadosList.slice(0, 100),
  };
}

function computeIndisponibilityByRef(
  moldRows: RawMoldeMaster[],
  bdRows: RawBdMoldesRow[],
  deduplicatedAll: MoldOrderRow[],
  dateRange: { start: string; end: string },
): { rows: MoldIndisponibilityRefRow[]; referencias: string[] } {
  const today = new Date().toISOString().slice(0, 10);
  const daysInMonth = daysInMonthOf(dateRange.end);

  const refMap = new Map<string, string[]>();
  for (const m of moldRows) {
    const ref = cleanText(m.nombre_articulo);
    const serial = cleanText(m.serial);
    const status = cleanText(m.estado).toLowerCase();
    if (!ref || !serial || status.includes("destruido")) continue;
    const list = refMap.get(ref) ?? [];
    list.push(serial.toUpperCase());
    refMap.set(ref, list);
  }

  const activosSet = new Set<string>();
  for (const r of bdRows) {
    const st = cleanText(r.ESTADO).toLowerCase();
    if (st.includes("reparacion") || st.includes("reparación") || st.includes("espera")) {
      activosSet.add(cleanText(r["CODIGO MOLDE"]).toUpperCase());
    }
  }

  const eventsBySerial = new Map<string, MoldOrderRow[]>();
  for (const ev of deduplicatedAll) {
    if (!ev.entryDate || ev.entryDate > dateRange.end) continue;
    const st = ev.status.toLowerCase();
    if (!st.includes("reparacion") && !st.includes("reparación") && !st.includes("espera") && !st.includes("entregado")) {
      continue;
    }
    const key = ev.moldCode.toUpperCase();
    const list = eventsBySerial.get(key) ?? [];
    list.push(ev);
    eventsBySerial.set(key, list);
  }

  const result: MoldIndisponibilityRefRow[] = [];
  for (const [referencia, serials] of refMap.entries()) {
    const totalMoldes = serials.length;
    if (!totalMoldes) continue;

    let enReparacionActual = 0;
    let totalDiasFuera = 0;

    for (const serial of serials) {
      if (activosSet.has(serial)) enReparacionActual += 1;

      for (const ev of eventsBySerial.get(serial) ?? []) {
        const st = ev.status.toLowerCase();
        // En App_Moldes solo suman días los eventos en reparación / espera (o que estuvieron en taller durante el rango)
        if (!ev.entryDate) continue;
        if (!(st.includes("reparacion") || st.includes("reparación") || st.includes("espera"))) continue;
        const endRaw = ev.deliveryDate ?? today;
        const overlapStart = ev.entryDate > dateRange.start ? ev.entryDate : dateRange.start;
        const overlapEnd = endRaw < dateRange.end ? endRaw : dateRange.end;
        if (overlapEnd < overlapStart) continue;
        totalDiasFuera += diffDaysInclusive(overlapStart, overlapEnd);
      }
    }

    const promedioDiasFuera = totalDiasFuera / totalMoldes;
    const indice = (promedioDiasFuera / daysInMonth) * 100;
    if (indice > 0 || enReparacionActual > 0) {
      result.push({
        referencia,
        totalMoldes,
        enReparacionActual,
        totalDiasFuera,
        promedioDiasFuera: Number(promedioDiasFuera.toFixed(2)),
        daysInMonth,
        indice: Number(indice.toFixed(2)),
      });
    }
  }

  return {
    rows: result.sort((a, b) => b.indice - a.indice),
    referencias: Array.from(refMap.keys()).sort((a, b) => a.localeCompare(b, "es")),
  };
}

export async function getMoldesData(params: MoldQueryParams): Promise<MoldPayload> {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = params.startDate || `${today.slice(0, 7)}-01`;
  const endDate = params.endDate || today;
  const dateRange = { start: startDate, end: endDate };

  const bdSelect = [
    "id",
    encodeURIComponent("Título"),
    encodeURIComponent("CODIGO MOLDE"),
    encodeURIComponent("DEFECTOS A REPARAR"),
    encodeURIComponent("FECHA ENTRADA"),
    encodeURIComponent("FECHA ESPERADA"),
    encodeURIComponent("FECHA ENTREGA"),
    "ESTADO",
    "OBSERVACIONES",
    "Responsable",
    encodeURIComponent("Tipo de reparacion"),
    "Tipo",
  ].join(",");

  // Consultamos histórico con margen hacia atrás para capturar atrasados previos y solapamientos de indisponibilidad.
  const histLookbackYear = Math.max(2021, Number(startDate.slice(0, 4)) - 1);

  const [bdRows, histRows, moldRows, plantRows, ofRows, minYearRow, maxYearRow] = await Promise.all([
    fetchAllSupabaseRows<RawBdMoldesRow>("BD_moldes", `select=${bdSelect}`),
    fetchAllSupabaseRows<RawHistoricoRow>(
      "base_datos_historico_moldes",
      `select=id,pk_id,titulo,codigo_molde,defectos_a_reparar,fecha_entrada,fecha_esperada,fecha_entrega,estado,observaciones,responsable,tipo_de_reparacion,tipo&fecha_entrada=gte.${histLookbackYear}-01-01`,
    ),
    fetchAllSupabaseRows<RawMoldeMaster>(
      "moldes",
      "select=id,serial,estado,vueltas_actuales,vueltas_acumuladas,nombre_articulo,descripcion_molde",
    ),
    fetchAllSupabaseRows<RawPlantaMolde>("planta_moldes", "select=numero_de_serie,planta"),
    fetchAllSupabaseRows<RawOrdenFabricacion>(
      "ordenes_fabricacion",
      `select=cantidad,fecha_entrega_real&pendiente=eq.false&fecha_entrega_real=gte.${startDate}T00:00:00&fecha_entrega_real=lte.${endDate}T23:59:59`,
    ),
    fetchAllSupabaseRows<{ fecha_entrada: string | null }>(
      "base_datos_historico_moldes",
      "select=fecha_entrada&fecha_entrada=not.is.null&order=fecha_entrada.asc&limit=1",
    ),
    fetchAllSupabaseRows<{ fecha_entrada: string | null }>(
      "base_datos_historico_moldes",
      "select=fecha_entrada&fecha_entrada=not.is.null&order=fecha_entrada.desc&limit=1",
    ),
  ]);

  const plantBySerial = new Map<string, string>();
  const plantByNormSerial = new Map<string, string>();
  for (const p of plantRows) {
    const serial = cleanText(p.numero_de_serie);
    const plant = cleanText(p.planta);
    if (serial && plant) {
      if (!plantBySerial.has(serial)) plantBySerial.set(serial, plant);
      const norm = normalizeSerial(serial);
      if (norm && !plantByNormSerial.has(norm)) plantByNormSerial.set(norm, plant);
    }
  }

  const deduplicatedAll = deduplicateHistorico(histRows, plantBySerial, plantByNormSerial);

  // Filtros de dimensión (se aplican en el servidor antes de calcular KPIs y tablas).
  const searchLower = params.search.trim().toLowerCase();
  const dimensionFiltered = deduplicatedAll.filter((o) => {
    if (params.plant && params.plant !== "Todos" && o.plant !== params.plant) return false;
    if (params.status && params.status !== "Todos" && o.status !== params.status) return false;
    if (params.defect && params.defect !== "Todos" && !o.defects.includes(params.defect)) return false;
    if (params.responsible && params.responsible !== "Todos" && o.responsible !== params.responsible) {
      return false;
    }
    if (searchLower) {
      const hay = [o.moldCode, o.title, o.defectsRaw, o.responsible, o.observations, o.plant]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });

  // A. Comprometidos: fecha_esperada en el rango.
  const committedAll = dimensionFiltered.filter(
    (r) => Boolean(r.expectedDate && r.expectedDate >= startDate && r.expectedDate <= endDate),
  );

  // B. Entregados: fecha_entrega en rango (o Destruido con fecha_esperada en rango).
  const deliveredAll = dimensionFiltered.filter((r) => {
    const isDestruido = r.status.toLowerCase().includes("destruido");
    const refDate = r.deliveryDate || (isDestruido ? r.expectedDate : null);
    return Boolean(refDate && refDate >= startDate && refDate <= endDate);
  });

  // C. Atrasados previos: esperados antes de startDate y aún activos.
  const prevDelayedAll = dimensionFiltered.filter((r) => {
    const stLower = r.status.toLowerCase();
    return Boolean(
      r.expectedDate &&
      r.expectedDate < startDate &&
      ACTIVE_STATES.has(stLower) &&
      !stLower.includes("destruido"),
    );
  });

  // Desglose por categoría antes de filtrar la categoría seleccionada.
  const categoryBreakdown: Record<Exclude<MoldCategoryKey, "Todos">, number> = {
    REPARACION_RAPIDA: 0,
    REPARACION_ESPECIAL: 0,
    MOLDE_NUEVO: 0,
    MODELO_NUEVO: 0,
  };
  const unifiedForBreakdown = new Map<string, MoldOrderRow>();
  for (const r of [...committedAll, ...deliveredAll]) unifiedForBreakdown.set(r.id, r);
  for (const r of unifiedForBreakdown.values()) {
    if (r.category !== "OTRO") categoryBreakdown[r.category] += 1;
  }

  const byCategory = (list: MoldOrderRow[]) =>
    params.category === "Todos" ? list : list.filter((r) => r.category === params.category);

  const committedCat = byCategory(committedAll);
  const deliveredCat = byCategory(deliveredAll);
  const prevDelayedCat = byCategory(prevDelayedAll);

  const deliveredIds = new Set(deliveredCat.map((r) => r.id));

  const onTimeCount = committedCat.filter((r) =>
    Boolean(r.deliveryDate && r.expectedDate && r.deliveryDate <= r.expectedDate),
  ).length;
  const pendingCount = committedCat.filter(
    (r) => !r.deliveryDate && !r.status.toLowerCase().includes("destruido"),
  ).length;

  const serviceLevelPct =
    committedCat.length > 0 ? Number(((onTimeCount / committedCat.length) * 100).toFixed(1)) : null;

  // Tabla unificada del período (Comprometidos + Atrasados previos + Entregados en rango).
  const periodMap = new Map<string, MoldOrderRow>();
  for (const r of committedCat) {
    const inBoth = deliveredIds.has(r.id);
    const cumple = r.deliveryDate && r.expectedDate
      ? r.deliveryDate <= r.expectedDate
      : r.expectedDate
        ? today <= r.expectedDate
        : true;
    periodMap.set(r.id, { ...r, tag: inBoth ? "ambos" : "comprometido", isCompliant: cumple });
  }
  for (const r of prevDelayedCat) {
    if (!periodMap.has(r.id)) {
      periodMap.set(r.id, { ...r, tag: "comprometido", isCompliant: false });
    }
  }
  for (const r of deliveredCat) {
    if (!periodMap.has(r.id)) {
      const cumple = Boolean(r.deliveryDate && r.expectedDate && r.deliveryDate <= r.expectedDate);
      periodMap.set(r.id, { ...r, tag: "entregado", isCompliant: cumple });
    }
  }
  const periodRows = Array.from(periodMap.values()).sort((a, b) =>
    (a.expectedDate ?? "").localeCompare(b.expectedDate ?? ""),
  );

  // Rápida KPIs (exacto a App_Moldes).
  const rapida = computeRapidaSummary(
    dimensionFiltered,
    bdRows,
    dateRange,
    plantBySerial,
    plantByNormSerial,
  );

  // Pareto de defectos sobre comprometidos (o reparados en Rápida).
  const paretoSource = params.category === "REPARACION_RAPIDA" ? rapida.reparados : committedCat;
  const paretoDefects = buildParetoDefects(paretoSource);

  // Indisponibilidad por referencia.
  const indisponibility = computeIndisponibilityByRef(moldRows, bdRows, deduplicatedAll, dateRange);

  // Maestro de moldes + Vueltas + Programación mensual.
  const orderStatsBySerial = new Map<string, { count: number; daysOut: number; defects: Map<string, number> }>();
  for (const o of periodRows) {
    const key = o.moldCode.toUpperCase();
    const stat = orderStatsBySerial.get(key) ?? { count: 0, daysOut: 0, defects: new Map() };
    stat.count += 1;
    stat.daysOut += o.daysOut;
    for (const d of o.defects) stat.defects.set(d, (stat.defects.get(d) ?? 0) + 1);
    orderStatsBySerial.set(key, stat);
  }

  const moldMasters: MoldMasterRow[] = moldRows
    .filter((m) => cleanText(m.serial) && cleanText(m.estado) !== "Baja")
    .map((m) => {
      const serial = cleanText(m.serial);
      const plant =
        plantBySerial.get(serial) ?? plantByNormSerial.get(normalizeSerial(serial)) ?? "Sin planta";
      const st = orderStatsBySerial.get(serial.toUpperCase());
      const topDefect = st
        ? Array.from(st.defects.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
        : "—";
      return {
        id: m.id,
        serial,
        name: cleanText(m.nombre_articulo) || cleanText(m.descripcion_molde) || "Sin nombre",
        status: cleanText(m.estado) || "Indefinido",
        plant,
        currentTurns: Number(m.vueltas_actuales ?? 0),
        accumulatedTurns: Number(m.vueltas_acumuladas ?? 0),
        repairCount: st?.count ?? 0,
        totalDaysOut: Number((st?.daysOut ?? 0).toFixed(1)),
        topDefect,
      };
    })
    .filter((m) => (params.plant && params.plant !== "Todos" ? m.plant === params.plant : true))
    .sort((a, b) => b.accumulatedTurns - a.accumulatedTurns);

  const availableMoldsCount = moldMasters.filter((m) => m.status === "Disponible").length;
  const activeMoldsCount = moldMasters.filter((m) => !m.status.toLowerCase().includes("destruido")).length;
  const totalAccumulatedTurns = moldMasters.reduce((sum, m) => sum + m.accumulatedTurns, 0);
  const turnsPerRepair = periodRows.length > 0 ? totalAccumulatedTurns / periodRows.length : 0;

  const fabricatedByMonth = new Map<string, number>();
  let fabricatedUnits = 0;
  for (const row of ofRows) {
    const dt = normalizeDate(row.fecha_entrega_real);
    const qty = Number(row.cantidad ?? 0);
    if (dt && Number.isFinite(qty)) {
      fabricatedUnits += qty;
      const ym = dt.slice(0, 7);
      fabricatedByMonth.set(ym, (fabricatedByMonth.get(ym) ?? 0) + qty);
    }
  }

  const monthlyBuckets = new Map<string, MoldOrderRow[]>();
  for (const r of periodRows) {
    const dt = r.expectedDate ?? r.entryDate;
    if (!dt) continue;
    const ym = dt.slice(0, 7);
    const arr = monthlyBuckets.get(ym) ?? [];
    arr.push(r);
    monthlyBuckets.set(ym, arr);
  }
  for (const ym of fabricatedByMonth.keys()) {
    if (!monthlyBuckets.has(ym)) monthlyBuckets.set(ym, []);
  }
  const monthly: MoldMonthlyItem[] = Array.from(monthlyBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, bucket]) => ({
      year: Number(ym.slice(0, 4)),
      month: Number(ym.slice(5, 7)),
      orders: bucket.length,
      rapidOrders: bucket.filter((o) => o.category === "REPARACION_RAPIDA").length,
      specialOrders: bucket.filter((o) => o.category === "REPARACION_ESPECIAL").length,
      newMoldOrders: bucket.filter((o) => o.category === "MOLDE_NUEVO" || o.category === "MODELO_NUEVO").length,
      fabricatedUnits: fabricatedByMonth.get(ym) ?? 0,
    }));

  // Opciones de filtro.
  const plantsSet = new Set<string>(plantBySerial.values());
  const statusesSet = new Set<string>();
  const defectsSet = new Set<string>();
  const responsiblesSet = new Set<string>();
  for (const o of deduplicatedAll) {
    if (o.status) statusesSet.add(o.status);
    for (const d of o.defects) defectsSet.add(d);
    if (o.responsible) responsiblesSet.add(o.responsible);
  }

  const filterOptions: MoldFilterOptions = {
    plants: Array.from(plantsSet).sort((a, b) => a.localeCompare(b, "es")),
    statuses: Array.from(statusesSet).sort((a, b) => a.localeCompare(b, "es")),
    defects: Array.from(defectsSet).sort((a, b) => a.localeCompare(b, "es")),
    responsibles: Array.from(responsiblesSet).sort((a, b) => a.localeCompare(b, "es")),
  };

  // Paginación sobre las órdenes del período (para /moldes/detalle) o todas si hay búsqueda.
  const sortedForDetail = [...periodRows].sort((a, b) =>
    (b.expectedDate ?? b.entryDate ?? "").localeCompare(a.expectedDate ?? a.entryDate ?? ""),
  );
  const total = sortedForDetail.length;
  const pageSize = Math.max(1, Math.min(200, params.pageSize || 50));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, params.page || 1));
  const startIdx = (page - 1) * pageSize;

  const minYear = Number((minYearRow[0]?.fecha_entrada ?? "2021-01-01").slice(0, 4)) || 2021;
  const maxYear = Number((maxYearRow[0]?.fecha_entrada ?? today).slice(0, 4)) || new Date().getFullYear();
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) years.push(y);

  const summary: MoldSummary = {
    dateRange,
    committedCount: committedCat.length,
    deliveredInRangeCount: deliveredCat.length,
    onTimeCount,
    pendingCount,
    previousDelayedCount: prevDelayedCat.length,
    serviceLevelPct,
    serviceTargetPct: 95,
    categoryBreakdown,
    rapida,
    paretoDefects,
    indisponibilityByRef: indisponibility.rows,
    referencias: indisponibility.referencias,
    availableMoldsCount,
    activeMoldsCount,
    totalAccumulatedTurns,
    turnsPerRepair: Number(turnsPerRepair.toFixed(2)),
    fabricatedUnits,
    monthly,
    topCriticalMolds: moldMasters.slice(0, 30),
  };

  return {
    rows: sortedForDetail.slice(startIdx, startIdx + pageSize),
    periodRows: sortedForDetail.slice(0, 200),
    molds: moldMasters.slice(0, 50),
    years,
    pagination: { page, pageSize, total, totalPages },
    summary,
    filterOptions,
    source: "supabase",
    updatedAt: new Date().toISOString(),
  };
}
