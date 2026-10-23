import sql from "mssql";
import type { BillingFilters, BillingRow, BillingSummary } from "./types.js";

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const normalized = String(value ?? "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function dateValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function safeIdentifier(value: string, variableName: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${variableName} tiene un identificador no válido`);
  }
  return `[${value}]`;
}

function reportSource() {
  const database = required("REPORT_DB_NAME");
  const schemaName = process.env.REPORT_DB_TABLE_SCHEMA?.trim() || "dbo";
  const tableName = process.env.REPORT_DB_TABLE?.trim() || "Informe_ventas";
  return `${safeIdentifier(database, "REPORT_DB_NAME")}.${safeIdentifier(schemaName, "REPORT_DB_TABLE_SCHEMA")}.${safeIdentifier(tableName, "REPORT_DB_TABLE")}`;
}

function getPool() {
  if (!poolPromise) {
    const instanceName = process.env.REPORT_DB_INSTANCE_NAME?.trim();
    const connectionTimeout = positiveInteger(process.env.REPORT_DB_CONNECTION_TIMEOUT_MS, 30000);
    const requestTimeout = positiveInteger(process.env.REPORT_DB_REQUEST_TIMEOUT_MS, 60000);
    const config: sql.config = {
      server: required("REPORT_DB_SERVER"),
      database: required("REPORT_DB_NAME"),
      user: required("REPORT_DB_USER"),
      password: required("REPORT_DB_PASSWORD"),
      connectionTimeout,
      requestTimeout,
      options: {
        encrypt: process.env.REPORT_DB_ENCRYPT === "true",
        trustServerCertificate: process.env.REPORT_DB_TRUST_SERVER_CERTIFICATE === "true",
        ...(instanceName ? { instanceName } : {}),
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };

    if (!instanceName) {
      const port = Number(process.env.REPORT_DB_PORT || 1433);
      if (Number.isInteger(port) && port > 0) config.port = port;
    }
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

function addFilters(request: sql.Request, filters: BillingFilters) {
  const predicates: string[] = [];

  if (filters.year && filters.month) {
    predicates.push("v.[FechaContabilizacion] >= DATEFROMPARTS(@year, @month, 1)");
    predicates.push("v.[FechaContabilizacion] < DATEADD(month, 1, DATEFROMPARTS(@year, @month, 1))");
    request.input("year", sql.Int, filters.year);
    request.input("month", sql.Int, filters.month);
  } else if (filters.year) {
    predicates.push("v.[FechaContabilizacion] >= DATEFROMPARTS(@year, 1, 1)");
    predicates.push("v.[FechaContabilizacion] < DATEFROMPARTS(@year + 1, 1, 1)");
    request.input("year", sql.Int, filters.year);
  } else if (filters.month) {
    predicates.push("MONTH(v.[FechaContabilizacion]) = @month");
    request.input("month", sql.Int, filters.month);
  }

  if (filters.from) {
    predicates.push("v.[FechaContabilizacion] >= @fromDate");
    request.input("fromDate", sql.Date, filters.from);
  }
  if (filters.to) {
    predicates.push("v.[FechaContabilizacion] <= @toDate");
    request.input("toDate", sql.Date, filters.to);
  }
  if (filters.zone) {
    predicates.push("CONVERT(nvarchar(100), v.[Zona]) = @zone");
    request.input("zone", sql.NVarChar(100), filters.zone);
  }
  if (filters.customerGroup) {
    predicates.push("CONVERT(nvarchar(100), v.[GrupoCliente]) = @customerGroup");
    request.input("customerGroup", sql.NVarChar(100), filters.customerGroup);
  }
  if (filters.search) {
    predicates.push(`(
      CHARINDEX(@search, LOWER(CONVERT(nvarchar(255), v.[NombreCliente]))) > 0 OR
      CHARINDEX(@search, LOWER(CONVERT(nvarchar(50), v.[CodCliente]))) > 0 OR
      CHARINDEX(@search, LOWER(CONVERT(nvarchar(50), v.[DocNum]))) > 0 OR
      CHARINDEX(@search, LOWER(CONVERT(nvarchar(100), v.[Ciudad]))) > 0
    )`);
    request.input("search", sql.NVarChar(200), filters.search.toLowerCase());
  }

  return predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
}

function normalizeRow(row: Record<string, unknown>, index: number): BillingRow {
  const date = dateValue(row.date);
  const docnum = textValue(row.docnum, "—");
  const valueTotal = numberValue(row.valueTotal);
  const creditCode = textValue(row.creditCode);
  const creditType = textValue(row.creditType);
  const isCreditNote = Boolean(creditCode || creditType);
  const amount = Math.abs(valueTotal);

  return {
    id: `${date}-${docnum}-${index}`,
    date,
    docnum,
    customer: textValue(row.customer, "Sin cliente"),
    customerGroup: textValue(row.customerGroup, "Sin grupo"),
    channel: textValue(row.channel, "Sin canal"),
    zone: textValue(row.zone, "Sin zona"),
    city: textValue(row.city, "—"),
    invoiced: isCreditNote ? 0 : amount,
    creditNote: isCreditNote ? amount : 0,
    net: isCreditNote ? -amount : valueTotal,
    customerCode: textValue(row.customerCode),
    documentType: textValue(row.documentType),
    creditCode,
    creditType,
    seniorSeller: textValue(row.seniorSeller),
    juniorSeller: textValue(row.juniorSeller),
    territory: textValue(row.territory),
    valueTotal,
  };
}

export async function getBillingReport(filters: BillingFilters) {
  const pool = await getPool();
  const source = reportSource();
  const offset = (filters.page - 1) * filters.pageSize;

  console.log(`[DB] Consultando ${source} (page=${filters.page}, pageSize=${filters.pageSize})`);

  const request = pool.request();
  const where = addFilters(request, filters);
  request.input("offset", sql.Int, offset);
  request.input("pageSize", sql.Int, filters.pageSize);

  const query = `
    SELECT
      CONVERT(date, v.[FechaContabilizacion]) AS [date],
      CONVERT(nvarchar(50), v.[DocNum]) AS [docnum],
      CONVERT(nvarchar(255), v.[NombreCliente]) AS [customer],
      CONVERT(nvarchar(100), v.[GrupoCliente]) AS [customerGroup],
      CONVERT(nvarchar(100), v.[TipoVentas]) AS [channel],
      CONVERT(nvarchar(100), v.[Zona]) AS [zone],
      CONVERT(nvarchar(100), v.[Ciudad]) AS [city],
      CONVERT(nvarchar(50), v.[CodCliente]) AS [customerCode],
      CONVERT(nvarchar(50), v.[CodigoTipoNC]) AS [creditCode],
      CONVERT(nvarchar(100), v.[TiposNC]) AS [creditType],
      CONVERT(nvarchar(100), v.[VendedorSenior]) AS [seniorSeller],
      CONVERT(nvarchar(100), v.[VendedorJunior]) AS [juniorSeller],
      CONVERT(nvarchar(100), v.[Territorio]) AS [territory],
      CONVERT(decimal(38, 6), v.[ValorTotal]) AS [valueTotal],
      CASE WHEN v.[TipoDocumento] LIKE N'Nota%' OR NULLIF(CONVERT(nvarchar(50), v.[CodigoTipoNC]), '') IS NOT NULL OR NULLIF(CONVERT(nvarchar(100), v.[TiposNC]), '') IS NOT NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS [isCredit],
      ROW_NUMBER() OVER (ORDER BY v.[FechaContabilizacion] DESC, v.[DocNum] DESC) AS [rowNumber]
    INTO #filtered
    FROM ${source} AS v
    ${where};

    SELECT [date], [docnum], [customer], [customerGroup], [channel], [zone], [city], [customerCode], [creditCode], [creditType], [seniorSeller], [juniorSeller], [territory], [valueTotal]
    FROM #filtered
    WHERE [rowNumber] > @offset AND [rowNumber] <= (@offset + @pageSize)
    ORDER BY [rowNumber];

    SELECT COUNT_BIG(1) AS [total] FROM #filtered;

    SELECT
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN 0 ELSE ABS([valueTotal]) END), 0) AS [invoiced],
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN ABS([valueTotal]) ELSE 0 END), 0) AS [creditNote],
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN -ABS([valueTotal]) ELSE [valueTotal] END), 0) AS [net]
    FROM #filtered;

    SELECT [date],
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN 0 ELSE ABS([valueTotal]) END), 0) AS [invoiced],
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN ABS([valueTotal]) ELSE 0 END), 0) AS [creditNote]
    FROM #filtered
    GROUP BY [date]
    ORDER BY [date];

    SELECT COALESCE([zone], 'Sin zona') AS [name],
      COALESCE(SUM(CASE WHEN [isCredit] = 1 THEN -ABS([valueTotal]) ELSE [valueTotal] END), 0) AS [net]
    FROM #filtered
    GROUP BY COALESCE([zone], 'Sin zona')
    ORDER BY [net] DESC;

    SELECT DISTINCT YEAR(v.[FechaContabilizacion]) AS [year]
    FROM ${source} AS v
    WHERE v.[FechaContabilizacion] IS NOT NULL
    ORDER BY [year] DESC;

    DROP TABLE #filtered;
  `;

  const result = await request.query(query);
  const recordsets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
  const rows = (recordsets[0] ?? []).map((row, index) => normalizeRow(row, index));
  const total = numberValue(recordsets[1]?.[0]?.total);
  const summaryRow = recordsets[2]?.[0] ?? {};
  const daily = (recordsets[3] ?? []).map((row) => ({
    date: dateValue(row.date),
    invoiced: numberValue(row.invoiced),
    creditNote: numberValue(row.creditNote),
  }));
  const zones = (recordsets[4] ?? []).map((row) => ({
    name: textValue(row.name, "Sin zona"),
    net: numberValue(row.net),
  }));
  const years = (recordsets[5] ?? [])
    .map((row) => numberValue(row.year))
    .filter((year) => year > 0);
  const summary: BillingSummary = {
    invoiced: numberValue(summaryRow.invoiced),
    creditNote: numberValue(summaryRow.creditNote),
    net: numberValue(summaryRow.net),
    daily,
    zones,
  };

  return { rows, total, summary, years };
}
