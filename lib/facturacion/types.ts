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
