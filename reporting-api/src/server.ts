import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getBillingReport } from "./db.js";
import type { BillingFilters } from "./types.js";

const port = Number(process.env.PORT || 8080);
const maxPageSize = Math.max(1, Number(process.env.REPORTING_MAX_PAGE_SIZE || 1000));

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function authorized(request: IncomingMessage) {
  const expected = process.env.REPORTING_API_TOKEN?.trim();
  if (!expected) return false;
  const value = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!value) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(value);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function validNumber(value: string | null, minimum: number, maximum: number) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= minimum && numberValue <= maximum ? numberValue : undefined;
}

function filtersFrom(requestUrl: URL): BillingFilters {
  const pageValue = Number(requestUrl.searchParams.get("page") || 1);
  const pageSizeValue = Number(requestUrl.searchParams.get("pageSize") || 1000);
  return {
    from: validDate(requestUrl.searchParams.get("fechaDesde")),
    to: validDate(requestUrl.searchParams.get("fechaHasta")),
    year: validNumber(requestUrl.searchParams.get("anio"), 1900, 2200),
    month: validNumber(requestUrl.searchParams.get("mes"), 1, 12),
    zone: requestUrl.searchParams.get("zona")?.trim() || undefined,
    customerGroup: requestUrl.searchParams.get("grupoCliente")?.trim() || undefined,
    search: requestUrl.searchParams.get("search")?.trim() || undefined,
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: Number.isInteger(pageSizeValue) && pageSizeValue > 0 ? Math.min(pageSizeValue, maxPageSize) : Math.min(1000, maxPageSize),
  };
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    json(response, 200, { status: "ok", service: "firplak-reporting-api" });
    return;
  }

  if (request.method !== "GET" || requestUrl.pathname !== "/api/v1/facturacion-diaria") {
    json(response, 404, { error: "Ruta no encontrada" });
    return;
  }

  if (!process.env.REPORTING_API_TOKEN) {
    json(response, 503, { error: "La API no tiene configurado REPORTING_API_TOKEN" });
    return;
  }
  if (!authorized(request)) {
    json(response, 401, { error: "No autorizado" });
    return;
  }

  try {
    const filters = filtersFrom(requestUrl);
    const result = await getBillingReport(filters);
    json(response, 200, {
      rows: result.rows,
      years: result.years,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.pageSize),
      },
      summary: result.summary,
      source: "sql-server",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error consultando la vista de informes", error);
    json(response, 502, { error: "No fue posible consultar la vista de informes" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Firplak Reporting API escuchando en http://127.0.0.1:${port} (cwd=${process.cwd()})`);
});
