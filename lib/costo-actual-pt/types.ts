// Contrato de GET /api/v1/costo-actual-pt (llm-wiki/bi/costo-actual-pt.md, sección 3).
export type ProductCostAlert = "inactivo" | "sinCosto" | "moCif" | "estructura";

export type ProductCostProduct = {
  code: string;
  description: string;
  unit: string;
  levels: number;
  lines: number;
};

export type ProductCostRow = {
  path: string;
  level: number;
  code: string;
  description: string;
  unit: string;
  warehouse: string;
  hasChildren: boolean;
  classification: "MP" | "MO" | "CIF" | null;
  quantity: number;
  unitCost: number;
  rawMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  alert: string | null;
  alerts: { inactive: boolean; noCost: boolean; laborAndOverhead: boolean; structure: boolean };
};

export type ProductCostSummary = {
  rawMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  costWithoutOverhead: number;
  averageCost: number;
  averageCostWithoutOverhead: number;
  alerts: { inactive: number; noCost: number; laborAndOverhead: number; structure: number; total: number };
  compositionWithoutOverhead: Array<{ code: string; description: string; totalCost: number }>;
};

export type ProductCostPayload = {
  product: ProductCostProduct | null;
  rows: ProductCostRow[];
  truncated: boolean;
  summary: ProductCostSummary | null;
  filterOptions: { products: Array<{ code: string; description: string }> };
  source: "sql-server";
  loadedAt: string | null;
  updatedAt: string;
};
