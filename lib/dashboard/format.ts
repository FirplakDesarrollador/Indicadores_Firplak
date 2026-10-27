// Formatos es-CO compartidos por los dashboards (docs/manual-identidad-web.md).
const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const millionsNumber = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatCurrency(value: number) { return currency.format(value); }
export function formatNumber(value: number) { return number.format(value); }
export function formatPercent(value: number) { return percent.format(value); }
export function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${millionsNumber.format(Math.abs(value) / 1_000_000)} M`;
  }
  return formatCurrency(value);
}
export function formatMonthName(month: number) {
  const name = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(new Date(2026, month - 1, 1));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function dateValue(value: string) { return new Date(`${value}T12:00:00`); }
export function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(dateValue(value)).replace(".", "");
}
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
