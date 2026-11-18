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
};

export type CodeName = { code: string; name: string };

export type CommercialFilterOptions = {
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
  period: { from: string; to: string };
  summary: CommercialSummary;
  filterOptions: CommercialFilterOptions;
  source: "sql-server";
  loadedAt: string | null;
  updatedAt: string;
};
