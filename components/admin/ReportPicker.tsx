"use client";

import { groupReportsByArea, reports } from "@/lib/reports";

// Informes agrupados por área, con casilla por área. `locked` son los que ya llegan por el cargo.
export default function ReportPicker({ selected, onChange, locked, disabled = false, lockedLabel = "Por cargo" }: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  locked?: Set<string>;
  disabled?: boolean;
  lockedLabel?: string;
}) {
  const isLocked = (slug: string) => Boolean(locked?.has(slug)) && !selected.has(slug);
  const toggle = (slugs: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const slug of slugs) {
      if (checked) next.add(slug);
      else next.delete(slug);
    }
    onChange(next);
  };

  return <div className="admin-picker">{groupReportsByArea(reports).map((area) => {
    const editable = area.items.map((report) => report.slug).filter((slug) => !isLocked(slug));
    const checkedCount = area.items.filter((report) => selected.has(report.slug) || locked?.has(report.slug)).length;
    const allChecked = editable.length > 0 && editable.every((slug) => selected.has(slug));
    return <fieldset key={area.id} className="admin-picker-area" disabled={disabled}>
      <legend className="admin-picker-heading">
        <label className="admin-check"><input type="checkbox" checked={allChecked} disabled={disabled || !editable.length} onChange={(event) => toggle(editable, event.target.checked)} aria-label={`Todos los ${area.label.toLowerCase()}`} /> {area.label}</label>
        <span className="admin-count">{checkedCount}/{area.items.length}</span>
      </legend>
      {area.items.map((report) => {
        const lockedReport = isLocked(report.slug);
        return <label key={report.slug} className="admin-check admin-picker-item">
          <input type="checkbox" checked={lockedReport || selected.has(report.slug)} disabled={lockedReport} onChange={(event) => toggle([report.slug], event.target.checked)} />
          <span>{report.title}</span>
          {lockedReport && <span className="admin-badge muted">{lockedLabel}</span>}
          {!lockedReport && locked?.has(report.slug) && <span className="admin-badge muted">También por cargo</span>}
        </label>;
      })}
    </fieldset>;
  })}</div>;
}
