// Contrato de GET /api/v1/liberacion (llm-wiki/bi/liberacion.md, sección 3).
export type ReleaseCompliance = "ok" | "no" | "sinLiberar" | "noMedir";
export type ReleaseView = "detalle" | "razones" | "control";

export type ReleaseRow = {
  orderNumber: number;
  type: string | null;
  sku: string | null;
  skuDescription: string | null;
  line: string | null;
  family: string | null;
  status: string | null;
  postingDate: string | null;
  recommendedReleaseDate: string;
  actualReleaseDate: string | null;
  promisedItemDate: string | null;
  compliance: ReleaseCompliance;
  // Razón normalizada (agrupa variantes del Excel) y el texto tal como se registró; null si la OP no tiene razón.
  reason: string | null;
  reasonOriginal: string | null;
  reasonComment: string | null;
  dateChanged: boolean;
};

// compliance = ok / (ok + no); null si no hay OP medidas.
export type ReleaseTotals = { ok: number; no: number; compliance: number | null };

export type ReleaseSummary = ReleaseTotals & {
  target: number;
  total: number;
  notReleased: number;
  notMeasured: number;
  withoutReason: number;
  daily: Array<ReleaseTotals & { date: string }>;
  monthly: Array<ReleaseTotals & { year: number; month: number }>;
  yearly: Array<ReleaseTotals & { year: number }>;
  // Razones de las OP que no cumplen, de mayor a menor; share = orders / suma de orders.
  reasons: Array<{ name: string; orders: number; share: number | null }>;
};

export type ReleaseFilterOptions = { reasons: string[] };

export type ReleasePayload = {
  rows: ReleaseRow[];
  years: number[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: ReleaseSummary;
  filterOptions: ReleaseFilterOptions;
  source: string;
  loadedAt: string | null;
  reasonsSyncedAt: string | null;
  updatedAt: string;
};
