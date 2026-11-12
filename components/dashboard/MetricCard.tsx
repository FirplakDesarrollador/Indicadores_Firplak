import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return <article className="billing-metric-card"><div className="billing-metric-icon blue"><Icon size={18} /></div><div className="billing-metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

export function MetricSkeleton() {
  return <article className="billing-metric-card billing-skeleton-card"><span className="billing-skeleton billing-skeleton-icon" /><div><span className="billing-skeleton billing-skeleton-label" /><span className="billing-skeleton billing-skeleton-value" /><span className="billing-skeleton billing-skeleton-detail" /></div></article>;
}
