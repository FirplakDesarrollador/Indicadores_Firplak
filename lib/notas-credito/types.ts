// Contrato de GET /api/v1/notas-credito (llm-wiki/bi/notas-credito.md, sección 3).
export type CreditNoteRow = {
  id: string;
  date: string;
  docnum: string;
  customerCode: string;
  customer: string;
  customerSubgroup: string;
  territory: string;
  salesType: string;
  seniorSeller: string;
  juniorSeller: string;
  creditType: string;
  creditTypeGroup: string;
  conceptCode: string;
  concept: string;
  department: string;
  comments: string;
  city: string;
  phone: string;
  project: string;
  storeCode: string;
  storeName: string;
  creditNote: number;
};

export type CreditNoteMonth = {
  year: number;
  month: number;
  invoiced: number;
  creditNotes: number;
  net: number;
  creditNoteRate: number | null;
  previousYearRate: number | null;
};

export type CreditNoteSummary = {
  creditNotes: number;
  invoiced: number;
  net: number;
  creditNoteRate: number | null;
  target: number;
  monthly: CreditNoteMonth[];
  departments: Array<{ name: string | null; creditNotes: number }>;
  concepts: Array<{ name: string | null; creditNotes: number; rate: number | null }>;
  creditTypeGroups: Array<{ name: string | null; creditNotes: number }>;
  sellers: Array<{ seniorSeller: string; juniorSeller: string; docnum: string; creditNotes: number }>;
};

export type CreditNoteFilterOptions = {
  salesTypes: string[];
  departments: string[];
  concepts: string[];
  creditTypeGroups: string[];
  seniorSellers: string[];
};

export type CreditNotePayload = {
  rows: CreditNoteRow[];
  years: number[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: CreditNoteSummary;
  filterOptions: CreditNoteFilterOptions;
  source: "sql-server";
  updatedAt: string;
};
