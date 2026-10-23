export type BillingFilters = {
  from?: string;
  to?: string;
  year?: number;
  month?: number;
  zone?: string;
  customerGroup?: string;
  search?: string;
  page: number;
  pageSize: number;
};

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
  customerCode?: string;
  documentType?: string;
  creditCode?: string;
  creditType?: string;
  seniorSeller?: string;
  juniorSeller?: string;
  territory?: string;
  valueTotal?: number;
};

export type BillingApiResponse = {
  rows: BillingRow[];
  years: number[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: BillingSummary;
  source: "sql-server";
  updatedAt: string;
};

export type BillingSummary = {
  invoiced: number;
  creditNote: number;
  net: number;
  daily: Array<{ date: string; invoiced: number; creditNote: number }>;
  zones: Array<{ name: string; net: number }>;
};
