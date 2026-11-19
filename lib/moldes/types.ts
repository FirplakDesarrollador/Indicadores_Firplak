export type MoldCategoryKey =
  | "Todos"
  | "REPARACION_RAPIDA"
  | "REPARACION_ESPECIAL"
  | "MOLDE_NUEVO"
  | "MODELO_NUEVO";

export type MoldOrderTag = "comprometido" | "entregado" | "ambos";

export type MoldOrderRow = {
  id: string;
  numericId: number;
  source: "BD_moldes" | "historico";
  title: string;
  moldCode: string;
  plant: string;
  defectsRaw: string;
  defects: string[];
  entryDate: string | null;
  expectedDate: string | null;
  deliveryDate: string | null;
  status: string;
  observations: string;
  responsible: string;
  repairTypeRaw: string;
  rawType: string;
  category: Exclude<MoldCategoryKey, "Todos"> | "OTRO";
  daysOut: number;
  isCompliant: boolean;
  tag: MoldOrderTag;
  deliveryWeight: number;
  weightLabel: string;
};

export type MoldMasterRow = {
  id: number;
  serial: string;
  name: string;
  status: string;
  plant: string;
  currentTurns: number;
  accumulatedTurns: number;
  repairCount: number;
  totalDaysOut: number;
  topDefect: string;
};

export type MoldParetoItem = {
  name: string;
  count: number;
  cumulativePct: number;
};

export type MoldIndisponibilityRefRow = {
  referencia: string;
  totalMoldes: number;
  enReparacionActual: number;
  totalDiasFuera: number;
  promedioDiasFuera: number;
  daysInMonth: number;
  indice: number;
};

export type MoldRapidaSummary = {
  totalMoldesReparados: number;
  rawRepairedCount: number;
  countMS: number;
  countFV: number;
  countDesmanchadoMS: number;
  countDesmanchadoFV: number;
  countBrillado: number;
  countOther: number;
  moldesEsperados: number;
  moldesEntregados: number;
  numDays: number;
  metaTotal: number;
  metaPorPersona: number;
  productividadPct: number;
  nivelServicioPct: number | null;
  reparados: MoldOrderRow[];
  esperadosList: MoldOrderRow[];
  entregadosList: MoldOrderRow[];
};

export type MoldMonthlyItem = {
  year: number;
  month: number;
  orders: number;
  rapidOrders: number;
  specialOrders: number;
  newMoldOrders: number;
  fabricatedUnits: number;
};

export type MoldSummary = {
  dateRange: { start: string; end: string };
  committedCount: number;
  deliveredInRangeCount: number;
  onTimeCount: number;
  pendingCount: number;
  previousDelayedCount: number;
  serviceLevelPct: number | null;
  serviceTargetPct: number;
  categoryBreakdown: Record<Exclude<MoldCategoryKey, "Todos">, number>;
  rapida: MoldRapidaSummary;
  paretoDefects: MoldParetoItem[];
  indisponibilityByRef: MoldIndisponibilityRefRow[];
  referencias: string[];
  availableMoldsCount: number;
  activeMoldsCount: number;
  totalAccumulatedTurns: number;
  turnsPerRepair: number;
  fabricatedUnits: number;
  monthly: MoldMonthlyItem[];
  topCriticalMolds: MoldMasterRow[];
};

export type MoldFilterOptions = {
  plants: string[];
  statuses: string[];
  defects: string[];
  responsibles: string[];
};

export type MoldPayload = {
  rows: MoldOrderRow[];
  periodRows: MoldOrderRow[];
  molds: MoldMasterRow[];
  years: number[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: MoldSummary;
  filterOptions: MoldFilterOptions;
  source: "supabase";
  updatedAt: string;
};
