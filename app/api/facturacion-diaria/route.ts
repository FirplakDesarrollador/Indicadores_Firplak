import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const reportingApiUrl = process.env.REPORTING_API_URL?.replace(/\/+$/, "");
    if (reportingApiUrl) {
      const target = new URL(`${reportingApiUrl}/api/v1/facturacion-diaria`);
      request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
      const headers = new Headers({ Accept: "application/json" });
      const apiToken = process.env.REPORTING_API_TOKEN;
      if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

      const response = await fetch(target, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      });
      const payload = await response.json().catch(() => ({ error: "Respuesta inválida de la API de informes." }));
      return NextResponse.json(payload, {
        status: response.status,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    return NextResponse.json(
      { error: "REPORTING_API_URL no está configurada. La aplicación requiere la API de informes." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("No fue posible cargar la vista de facturación", error);
    return NextResponse.json(
      { error: "No fue posible consultar la vista de facturación en SQL Server." },
      { status: 502 },
    );
  }
}
