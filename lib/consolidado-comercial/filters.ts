// Filtros de selección múltiple del consolidado comercial y sus listas dependientes.
// Replica cómo filtra GET /api/v1/consolidado-comercial: un filtro que solo existe en una etapa no saca las filas
// de las demás etapas, y en D (facturación) solo aplican canal, segmento, asesor y centro de costos.
import type { CommercialFilterOptions, CommercialStage } from "@/lib/consolidado-comercial/types";

export const listFilterKeys = [
  "channel", "segment", "advisor", "costCenter", "orderType", "deliveryStatus", "offerState", "validity", "blocked",
] as const;
export type ListFilterKey = (typeof listFilterKeys)[number];
export type ListFilters = Record<ListFilterKey, string[]>;

// Parámetro de la API y etapas a las que aplica cada filtro.
export const listFilterConfig: Record<ListFilterKey, { param: string; stages: CommercialStage[] }> = {
  channel: { param: "canal", stages: ["A_OFERTA", "B_OV", "C_TRANSITO", "D_FACTURACION"] },
  segment: { param: "segmento", stages: ["A_OFERTA", "B_OV", "C_TRANSITO", "D_FACTURACION"] },
  advisor: { param: "asesor", stages: ["A_OFERTA", "B_OV", "C_TRANSITO", "D_FACTURACION"] },
  costCenter: { param: "centroCostos", stages: ["A_OFERTA", "B_OV", "C_TRANSITO", "D_FACTURACION"] },
  orderType: { param: "tipoOV", stages: ["A_OFERTA", "B_OV", "C_TRANSITO"] },
  deliveryStatus: { param: "statusEntrega", stages: ["C_TRANSITO"] },
  offerState: { param: "estadoOferta", stages: ["A_OFERTA"] },
  validity: { param: "vigencia", stages: ["A_OFERTA"] },
  blocked: { param: "bloqueo", stages: ["B_OV"] },
};

export const emptyListFilters: ListFilters = {
  channel: [], segment: [], advisor: [], costCenter: [], orderType: [], deliveryStatus: [], offerState: [], validity: [], blocked: [],
};

export type Combination = Record<ListFilterKey, string> & { stage: CommercialStage };

export function parseCombinations(options: CommercialFilterOptions | null): Combination[] | null {
  const source = options?.combinations;
  if (!source) return null;
  return source.rows.map((row) => Object.fromEntries(source.fields.map((field, index) => [field, row[index] ?? ""])) as Combination);
}

// ¿La combinación pasa el filtro? Si el filtro no aplica a su etapa, pasa (como en la API).
function passes(combination: Combination, key: ListFilterKey, selected: string[]) {
  if (!selected.length || !listFilterConfig[key].stages.includes(combination.stage)) return true;
  return selected.includes(combination[key]);
}

// Valores del filtro `key` que existen con los demás filtros elegidos.
export function availableValues(combinations: Combination[], filters: ListFilters, key: ListFilterKey) {
  const values = new Set<string>();
  for (const combination of combinations) {
    const value = combination[key];
    if (!value || !listFilterConfig[key].stages.includes(combination.stage)) continue;
    if (listFilterKeys.every((other) => other === key || passes(combination, other, filters[other]))) values.add(value);
  }
  return values;
}

// Después de cambiar `changed`, quita de los demás filtros los valores que ya no existen. Repite hasta que no cambie
// nada, porque quitar un valor puede dejar sin datos a otro.
export function pruneSelections(combinations: Combination[], filters: ListFilters, changed: ListFilterKey): ListFilters {
  let current = filters;
  for (let round = 0; round < listFilterKeys.length; round += 1) {
    let modified = false;
    const next = { ...current };
    for (const key of listFilterKeys) {
      if (key === changed || !current[key].length) continue;
      const available = availableValues(combinations, current, key);
      const kept = current[key].filter((value) => available.has(value));
      if (kept.length !== current[key].length) { next[key] = kept; modified = true; }
    }
    current = next;
    if (!modified) break;
  }
  return current;
}

export function sameValues(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}
