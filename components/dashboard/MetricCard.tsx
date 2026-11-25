import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// action: control opcional al pie de la tarjeta (por ejemplo, un interruptor). muted: la tarjeta se ve atenuada.
export function MetricCard({ label, value, detail, icon: Icon, action, muted = false }: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  action?: ReactNode;
  muted?: boolean;
}) {
  return <article className={`billing-metric-card${muted ? " metric-card-muted" : ""}`}><div className="billing-metric-icon blue"><Icon size={18} /></div><div className="billing-metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>{action && <div className="metric-card-action">{action}</div>}</article>;
}

export function MetricSkeleton() {
  return <article className="billing-metric-card billing-skeleton-card"><span className="billing-skeleton billing-skeleton-icon" /><div><span className="billing-skeleton billing-skeleton-label" /><span className="billing-skeleton billing-skeleton-value" /><span className="billing-skeleton billing-skeleton-detail" /></div></article>;
}
