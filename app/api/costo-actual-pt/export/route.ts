import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// La descarga completa (.xlsx) pesa unos 25 MB. Se reenvía en streaming (sin acumularla en memoria), así que
// no aplica el límite de 4,5 MB de las respuestas normales de Vercel; sí aplica la duración máxima.
export const maxDuration = 300;

const noStore = { "Cache-Control": "no-store, max-age=0" };
const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: NextRequest) {
  const reportingApiUrl = process.env.REPORTING_API_URL?.replace(/\/+$/, "");
  if (!reportingApiUrl) {
    return NextResponse.json(
      { error: "REPORTING_API_URL no está configurada. La aplicación requiere la API de informes." },
      { status: 503, headers: noStore },
    );
  }

  try {
    const target = new URL(`${reportingApiUrl}/api/v1/costo-actual-pt/export`);
    const code = request.nextUrl.searchParams.get("codigo");
    if (code) target.searchParams.set("codigo", code);
    const headers = new Headers({ Accept: xlsxContentType });
    const apiToken = process.env.REPORTING_API_TOKEN;
    if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

    // Si el usuario cancela la descarga, también se cancela la consulta en la API.
    const response = await fetch(target, {
      headers,
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout((maxDuration - 10) * 1000)]),
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({ error: "No fue posible generar la descarga." }));
      return NextResponse.json(payload, { status: response.ok ? 502 : response.status, headers: noStore });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": response.headers.get("content-type") ?? xlsxContentType,
        "Content-Disposition": response.headers.get("content-disposition") ?? 'attachment; filename="costo-actual-pt.xlsx"',
      },
    });
  } catch (error) {
    console.error("No fue posible descargar el costo de producto terminado", error);
    return NextResponse.json(
      { error: "No fue posible descargar el costo de producto terminado." },
      { status: 502, headers: noStore },
    );
  }
}
