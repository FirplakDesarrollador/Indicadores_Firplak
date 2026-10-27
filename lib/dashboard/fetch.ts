// Lee la respuesta del proxy; si el middleware redirigió al login, la sesión expiró.
export async function readJsonPayload<T extends { error?: string }>(response: Response, sourceLabel: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.url.includes("/login")) {
      throw new Error("La sesión expiró. Vuelve a iniciar sesión para consultar los indicadores.");
    }
    throw new Error(`${sourceLabel} devolvió una respuesta no válida (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}
