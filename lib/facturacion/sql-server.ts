import sql from "mssql";
import type { BillingPayload, BillingRow } from "./types";

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function isSqlServerConfigured() {
  return Boolean(
    process.env.SQL_SERVER_HOST &&
      process.env.SQL_SERVER_DATABASE &&
      process.env.SQL_SERVER_USER &&
      process.env.SQL_SERVER_PASSWORD,
  );
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const key = Object.keys(row).find((candidate) =>
    aliases.some((alias) => candidate.toLowerCase() === alias.toLowerCase()),
  );
  return key ? row[key] : undefined;
}

function normalizeDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeRow(row: Record<string, unknown>, index: number): BillingRow {
  const date = normalizeDate(pick(row, ["Fecha", "fecha", "Date", "BillingDate"]));
  const invoiced = normalizeNumber(
    pick(row, ["TotalFacturado", "Facturado", "FacDiaTotal", "InvoiceTotal", "invoiced"]),
  );
  const creditNote = normalizeNumber(
    pick(row, ["TotalNC", "FacNC", "NotaCredito", "CreditNote", "creditNote"]),
  );

  return {
    id: String(pick(row, ["DOCNUM", "DocNum", "Documento", "id"]) ?? `${date}-${index}`),
    date,
    docnum: String(pick(row, ["DOCNUM", "DocNum", "Documento"]) ?? "—"),
    customer: String(pick(row, ["Cliente", "Customer", "NombreCliente"]) ?? "Sin cliente"),
    customerGroup: String(
      pick(row, ["GrupoCliente", "Grupo de Cliente", "CustomerGroup", "U_GrupoCliente"]) ??
        "Sin grupo",
    ),
    channel: String(pick(row, ["Canal", "GrupoCanal", "Channel"]) ?? "Sin canal"),
    zone: String(pick(row, ["Zona", "TipoVenta", "U_TipoVentas", "Zone"]) ?? "Nacional"),
    city: String(pick(row, ["Ciudad", "City"]) ?? "—"),
    invoiced,
    creditNote,
    net: normalizeNumber(pick(row, ["Neto", "TotalNeto", "NetTotal"])) || invoiced - creditNote,
  };
}

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: process.env.SQL_SERVER_HOST!,
      port: Number(process.env.SQL_SERVER_PORT ?? 1433),
      user: process.env.SQL_SERVER_USER!,
      password: process.env.SQL_SERVER_PASSWORD!,
      database: process.env.SQL_SERVER_DATABASE!,
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT !== "false",
        trustServerCertificate: process.env.SQL_SERVER_TRUST_CERTIFICATE === "true",
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    });
  }
  return poolPromise;
}

function safeViewName(value: string) {
  if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+){0,2}$/.test(value)) {
    throw new Error("SQL_SERVER_FACTURACION_VIEW tiene un nombre no válido");
  }
  return value
    .split(".")
    .map((part) => `[${part}]`)
    .join(".");
}

export async function getBillingData(): Promise<BillingPayload> {
  if (!isSqlServerConfigured()) {
    throw new Error("SQL Server no está configurado");
  }

  const viewName = safeViewName(process.env.SQL_SERVER_FACTURACION_VIEW ?? "dbo.vw_FacturacionDiaria");
  const pool = await getPool();
  const result = await pool.request().query(`SELECT TOP (10000) * FROM ${viewName}`);
  const rows = result.recordset.map((row, index) => normalizeRow(row as Record<string, unknown>, index));

  return { rows, source: "sql-server", updatedAt: new Date().toISOString() };
}
