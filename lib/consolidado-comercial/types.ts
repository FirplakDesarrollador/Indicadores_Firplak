// Contrato de GET /api/v1/consolidado-comercial (reporting-api, src/types.ts).
// Reglas y decisiones: llm-wiki/proyectos/consolidado-comercial.md.
export type CommercialStage = "A_OFERTA" | "B_OV" | "C_TRANSITO" | "D_FACTURACION";
export type CommercialOpenStage = Exclude<CommercialStage, "D_FACTURACION">;
export type CommercialView = "default" | "todo";

export type CommercialStageTotal = {
  stage: CommercialStage;
  amount: number;
  lines: number;
  documents: number;
};

export type CommercialBreakdownRow = {
  name: string;
  offers: number;
  orders: number;
  transit: number;
  billing: number;
  total: number;
};

export type CommercialSummary = {
  stages: CommercialStageTotal[];
  total: number;
  byAdvisor: CommercialBreakdownRow[];
  bySegment: CommercialBreakdownRow[];
  byCostCenter: CommercialBreakdownRow[];
};

export type CommercialRow = {
  id: string;
  stage: CommercialOpenStage;
  docEntry: number;
  lineNum: number;
  docNum: number;
  documentDate: string;
  validUntil: string;
  validity: string;
  customerCode: string;
  customer: string;
  channel: string;
  customerSubgroup: string;
  segment: string;
  advisor: string;
  costCenter: string;
  costCenterName: string;
  costCenterSource: string;
  orderType: string;
  orderTypeName: string;
  deliveryStatus: string;
  deliveryStatusName: string;
  offerState: string;
  offerStateName: string;
  dispatchDate: string;
  projectedBillingDate: string;
  salesType: string;
  orderBlock: string;
  lineBlocked: boolean;
  itemCode: string;
  description: string;
  quantity: number;
  openQuantity: number;
  lineValue: number;
  balance: number;
  inDefault: boolean;
  // Líneas de SAP que reúne la fila: las ofertas van una fila por documento. Opcional: API anterior (1).
  lines?: number;
};

export type CodeName = { code: string; name: string };

// Campos de cada combinación, en el orden en que llegan (reporting-api, commercialCombinationFields).
export const commercialCombinationFields = [
  "stage", "channel", "segment", "advisor", "costCenter", "orderType", "deliveryStatus", "offerState", "validity", "blocked",
] as const;
export type CommercialCombinationField = (typeof commercialCombinationFields)[number];

export type CommercialFilterOptions = {
  // Combinaciones que existen en la vista y el periodo consultados; "" = el filtro no aplica a esa etapa.
  combinations?: { fields: CommercialCombinationField[]; rows: string[][] };
  channels: string[];
  segments: string[];
  advisors: string[];
  costCenters: CodeName[];
  orderTypes: CodeName[];
  deliveryStatuses: CodeName[];
  offerStates: CodeName[];
};

export type CommercialPayload = {
  rows: CommercialRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  // openTo: fin del periodo para A, B y C; dateFilter: si se les aplicó (filtrarFecha). Opcionales: API anterior.
  period: { from: string; to: string; openTo?: string; dateFilter?: boolean };
  // Líneas y saldo de todo el detalle filtrado (todas las páginas), con etapa y búsqueda. Opcional: API anterior.
  detailTotal?: { rows?: number; lines: number; balance: number };
  summary: CommercialSummary;
  filterOptions: CommercialFilterOptions;
  source: "sql-server";
  loadedAt: string | null;
  updatedAt: string;
};
