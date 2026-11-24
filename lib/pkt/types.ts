// Contrato de GET /api/v1/pkt (llm-wiki/bi/pkt.md, sección 3). Dinero en pesos; porcentajes como fracción.

export type PktSummary = {
  ytdSales: number;
  projectedSales: number;
  previousYearSales: number | null;
  salesVariation: number | null;
  salesVariationPct: number | null;
  ktno: number;
  previousKtno: number | null;
  pkt: number | null;
  previousPkt: number | null;
};

export type PktStatementRow = {
  type: "group" | "concept" | "total";
  group: string;
  name: string;
  order: number;
  previousYear: number | null;
  currentYear: number;
  variation: number | null;
  variationPct: number | null;
};

export type PktAnnualPoint = {
  year: number;
  month: number;
  cutoffDate: string;
  ktno: number;
  projectedSales: number;
  pkt: number | null;
  partial: boolean;
};

export type PktMonthlyPoint = {
  month: number;
  cutoffDate: string;
  ktno: number;
  projectedSales: number;
  pkt: number | null;
};

export type PktPayload = {
  period: { year: number; month: number; cutoffDate: string; previousCutoffDate: string };
  periods: Array<{ year: number; months: number[] }>;
  summary: PktSummary;
  statement: PktStatementRow[];
  series: { annualClose: PktAnnualPoint[]; monthly: PktMonthlyPoint[] };
  source: "sql-server";
  updatedAt: string | null;
};
