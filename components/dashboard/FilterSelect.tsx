import type { FilterOption } from "@/lib/dashboard/options";

export default function FilterSelect({ label, value, emptyValue, emptyLabel, options, onChange, disabled }: {
  label: string;
  value: string;
  emptyValue: string;
  emptyLabel: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <label className="billing-advanced-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value={emptyValue}>{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
