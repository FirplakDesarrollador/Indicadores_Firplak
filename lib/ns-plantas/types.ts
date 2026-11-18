// Contrato de GET /api/v1/ns-plantas (llm-wiki/bi/ns-plantas.md, sección 3).
export type NsPlantsCompliance = "cumplio" | "incumplio" | "enCurso";

export type NsPlantsRow = {
  id: number;
  docNum: number;
  createdAt: string;
  itemCode: string;
  item: string;
  plannedQty: number;
  orderType: string | null;
  orderSource: string | null;
  warehouse: string;
  status: string;
  releaseDate: string;
  closeDate: string | null;
  adjustedCloseDate: string | null;
  family: string | null;
  plant: string;
  buffer: number | null;
  idealDate: string | null;
  compliance: NsPlantsCompliance;
  delayReason: string | null;
  delayReason2: string | null;
};

// measured = OP con fecha ideal anterior a hoy, las únicas que cuentan en el %; late = measured - onTime.
export type NsPlantsTotals = {
  measured: number;
  onTime: number;
  late: number;
  serviceLevel: number | null;
};

export type NsPlantsSummary = NsPlantsTotals & {
  target: number;
  total: number;
  inProgress: number;
  closedEarly: number;
  daily: Array<{ date: string; measured: number; onTime: number; serviceLevel: number | null }>;
  monthly: Array<NsPlantsTotals & { year: number; month: number }>;
  plants: Array<NsPlantsTotals & { name: string }>;
  delayReasons: Array<{ name: string | null; late: number }>;
};

export type NsPlantsFilterOptions = {
  plants: string[];
};

export type NsPlantsPayload = {
  rows: NsPlantsRow[];
  years: number[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: NsPlantsSummary;
  filterOptions: NsPlantsFilterOptions;
  source: "sql-server";
  loadedAt: string | null;
  updatedAt: string;
};
