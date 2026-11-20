import { NextRequest, NextResponse } from "next/server";

const noStore = { "Cache-Control": "no-store, max-age=0" };
const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Reenvía en streaming la descarga .xlsx que genera la Reporting API, con los mismos filtros que tiene la pantalla.
// La API escribe números y fechas como celdas numéricas, así que Excel los reconoce sin conversión.
export async function proxyXlsxExport(request: NextRequest, { apiPath, fileName, label, timeoutMs }: {
  apiPath: string;
  fileName: string;
  label: string;
  timeoutMs: number;
}) {
  const reportingApiUrl = process.env.REPORTING_API_URL?.replace(/\/+$/, "");
  if (!reportingApiUrl) {
    return NextResponse.json(
      { error: "REPORTING_API_URL no está configurada. La aplicación requiere la API de informes." },
      { status: 503, headers: noStore },
    );
  }

  try {
    const target = new URL(`${reportingApiUrl}${apiPath}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "page" && key !== "pageSize") target.searchParams.set(key, value);
    });
    const headers = new Headers({ Accept: xlsxContentType });
    const apiToken = process.env.REPORTING_API_TOKEN;
    if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

    // Si el usuario cancela la descarga, también se cancela la consulta en la API.
    const response = await fetch(target, {
      headers,
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({ error: `No fue posible descargar ${label}.` }));
      return NextResponse.json(payload, { status: response.ok ? 502 : response.status, headers: noStore });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": response.headers.get("content-type") ?? xlsxContentType,
        "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error(`No fue posible descargar ${label}`, error);
    return NextResponse.json({ error: `No fue posible descargar ${label}.` }, { status: 502, headers: noStore });
  }
}
