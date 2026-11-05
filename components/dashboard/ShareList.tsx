import { formatCompactCurrency, formatPercent } from "@/lib/dashboard/format";

export type ShareItem = { name: string; value: number; detail?: string };

// Barras horizontales con el peso de cada categoría sobre el total (solo valores positivos).
// Reemplaza a las tortas del Power BI: se leen mejor con muchas categorías y no dependen del color.
export default function ShareList({ items, emptyText, shareLabel = "de las notas" }: {
  items: ShareItem[];
  emptyText: string;
  shareLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  if (!items.length) return <div className="billing-empty">{emptyText}</div>;
  return <div className="billing-zone-list">{items.map((item) => {
    const share = Math.max(item.value, 0) / total;
    return <div className="billing-zone-row" key={item.name}><div className="billing-zone-label"><span title={item.name}>{item.name}</span><strong>{formatCompactCurrency(item.value)}</strong></div><div className="billing-progress"><span style={{ width: `${Math.round(share * 100)}%` }} /></div><small>{formatPercent(share)} {shareLabel}{item.detail ? ` · ${item.detail}` : ""}</small></div>;
  })}</div>;
}
