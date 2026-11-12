export type FilterOption = { value: string; label: string };

export function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}
