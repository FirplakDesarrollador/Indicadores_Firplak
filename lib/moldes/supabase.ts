const PAGE_SIZE = 1000;

function getMoldesConfig() {
  const url = (process.env.SUPABASE_MOLDES_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_MOLDES_SERVICE_ROLE_KEY || process.env.SUPABASE_MOLDES_ANON_KEY || "";
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_MOLDES_URL o SUPABASE_MOLDES_SERVICE_ROLE_KEY en las variables de entorno.",
    );
  }
  return { url, key };
}

function buildHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

function parseTotalFromContentRange(header: string | null): number | null {
  if (!header) return null;
  const slash = header.indexOf("/");
  if (slash === -1) return null;
  const total = Number(header.slice(slash + 1));
  return Number.isFinite(total) ? total : null;
}

export async function fetchAllSupabaseRows<T>(table: string, queryString: string): Promise<T[]> {
  const { url, key } = getMoldesConfig();
  const baseUrl = `${url}/rest/v1/${encodeURIComponent(table)}?${queryString}`;
  const hasExplicitLimit = /(?:^|&)limit=/.test(queryString);

  const firstRes = await fetch(baseUrl, {
    headers: buildHeaders(
      key,
      hasExplicitLimit
        ? undefined
        : {
            Range: `0-${PAGE_SIZE - 1}`,
            Prefer: "count=exact",
          },
    ),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!firstRes.ok && firstRes.status !== 206) {
    const body = await firstRes.text().catch(() => "");
    throw new Error(`Error consultando ${table} en Supabase (${firstRes.status}): ${body.slice(0, 200)}`);
  }

  const firstPage = (await firstRes.json()) as T[];
  if (hasExplicitLimit) return firstPage;

  const total = parseTotalFromContentRange(firstRes.headers.get("content-range"));
  if (!total || total <= firstPage.length) return firstPage;

  const offsets: number[] = [];
  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
    offsets.push(start);
  }

  // Consultamos en lotes de hasta 6 peticiones paralelas para evitar saturar PostgREST.
  const restPages: T[] = [];
  for (let i = 0; i < offsets.length; i += 6) {
    const batch = offsets.slice(i, i + 6);
    const results = await Promise.all(
      batch.map(async (start) => {
        const end = Math.min(start + PAGE_SIZE - 1, total - 1);
        const res = await fetch(baseUrl, {
          headers: buildHeaders(key, { Range: `${start}-${end}` }),
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        });
        if (res.status === 416) return [] as T[];
        if (!res.ok && res.status !== 206) {
          throw new Error(`Error paginando ${table} (${res.status})`);
        }
        return (await res.json()) as T[];
      }),
    );
    for (const chunk of results) restPages.push(...chunk);
  }

  return [...firstPage, ...restPages];
}
