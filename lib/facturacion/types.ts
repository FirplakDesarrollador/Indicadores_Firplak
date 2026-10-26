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
};

export type BillingSummary = {
  invoiced: number;
  creditNote: number;
  net: number;
  daily: Array<{ date: string; invoiced: number; creditNote: number }>;
  zones: Array<{ name: string; net: number }>;
};

export type DeliveryRow = {
  id: string;
  deliveryDate: string;
  delivery: number;
  quantity: number;
  invoicedQuantity: number;
  valueWithoutVat: number;
  deliveryStatus: string;
};

export type DeliverySummary = {
  deliveredQuantity: number;
  invoicedQuantity: number;
  valueWithoutVat: number;
  daily: Array<{
    date: string;
    deliveredQuantity: number;
    invoicedQuantity: number;
    valueWithoutVat: number;
  }>;
  monthly: Array<{
    year: number;
    month: number;
    deliveredQuantity: number;
    invoicedQuantity: number;
    valueWithoutVat: number;
  }>;
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
};
