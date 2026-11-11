export type BillingSource = "sql-server";

export type BillingRow = {
  id: string;
  date: string;
  docnum: string;
  customer: string;
  customerGroup: string;
  channel: string;
  zone: string;
  city: string;
  company?: string;
  customerSubgroup?: string;
  invoiced: number;
  creditNote: number;
  net: number;
};

export type BillingPayload = {
  rows: BillingRow[];
  years?: number[];
  source: BillingSource;
  updatedAt: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: BillingSummary;
  filterOptions?: BillingFilterOptions;
};

export type BillingFilterOptions = {
  markets: string[];
  cities: string[];
  zones: string[];
  customerGroups: string[];
  customers: Array<{ code: string; name: string }>;
  cityZones?: Array<{ zone: string; city: string }>;
  customerSubgroups?: string[];
  companies?: string[];
};

export type BillingSummary = {
  invoiced: number;
  creditNote: number;
  net: number;
  daily: Array<{ date: string; invoiced: number; creditNote: number; net?: number }>;
  zones: Array<{ name: string; net: number }>;
};

export type DeliveryRow = {
  id: string;
  docEntry: number;
  lineNum: number;
  deliveryDate: string;
  delivery: number;
  invoice: number | null;
  advisor: string;
  customerCode: string;
  customer: string;
  customerGroup: string;
  costCenter: string;
  salesOrder: string;
  referenceCode: string;
  referenceDescription: string;
  quantity: number;
  invoicedQuantity: number;
  valueWithoutVat: number;
  carrier: string;
  trackingNumber: string;
  dispatchDate: string;
  deliveryStatus: string;
  deliveryIssue: string;
  actualDeliveryDate: string;
  // Desde la carga con devoluciones (punto 8). movementType: Entrega, Devolución o Nota crédito devolución
  // (estas dos con cantidad y valor negativos). baseDocument: entrega o factura de origen.
  company?: string;
  customerSubgroup?: string;
  movementType?: string;
  baseDocument?: string;
  market?: string;
};

// Valores en ValorSinIVA, sin documentos anulados. delivered = entregas, returns = devoluciones + NC de devolución
// (positivo), net = delivered - returns. Con la API anterior solo existe valueWithoutVat (entregas brutas).
export type DeliveryTotals = {
  deliveredQuantity: number;
  invoicedQuantity: number;
  valueWithoutVat: number;
  delivered?: number;
  returns?: number;
  net?: number;
};

export type DeliverySummary = DeliveryTotals & {
  daily: Array<DeliveryTotals & { date: string }>;
  monthly: Array<DeliveryTotals & { year: number; month: number }>;
  statuses: Array<{ name: string; total: number }>;
};

export type DeliveryPayload = {
  rows: DeliveryRow[];
  years?: number[];
  source: BillingSource;
  updatedAt: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary?: DeliverySummary;
  filterOptions?: { customerGroups?: string[]; customerSubgroups?: string[]; companies?: string[] };
};

export function deliveryNet(totals: DeliveryTotals) {
  return totals.net ?? totals.valueWithoutVat;
}
