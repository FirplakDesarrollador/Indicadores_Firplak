"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { FilterOption } from "@/lib/dashboard/options";

// Filtro de selección múltiple: botón con el resumen de lo elegido y panel con casillas.
// Los valores elegidos que ya no están en las opciones (por otro filtro) se muestran arriba para poder quitarlos.
const searchThreshold = 8;

export default function MultiSelectFilter({ label, values, options, emptyLabel, onChange, disabled, labelFor }: {
  label: string;
  values: string[];
  options: FilterOption[];
  emptyLabel: string;
  onChange: (values: string[]) => void;
  disabled?: boolean;
  // Nombre de un valor elegido que ya no está en las opciones (por ejemplo, código → nombre).
  labelFor?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("mousedown", handlePointer); document.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  const labels = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const missing = values.filter((value) => !labels.has(value));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = normalizedQuery ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery)) : options;

  const summary = values.length === 0
    ? emptyLabel
    : values.length === 1 ? (labels.get(values[0]) ?? labelFor?.(values[0]) ?? values[0]) : `${values.length} seleccionados`;

  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  return <div className="multi-select" ref={rootRef}>
    <span className="multi-select-label" id={labelId}>{label}</span>
    <button ref={triggerRef} type="button" className={`multi-select-trigger ${values.length ? "has-value" : ""}`} onClick={() => setOpen((visible) => !visible)} aria-haspopup="true" aria-expanded={open} aria-controls={panelId} aria-labelledby={`${labelId} ${panelId}-summary`} disabled={disabled}>
      <span id={`${panelId}-summary`} title={summary}>{summary}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div className="multi-select-panel" id={panelId} role="group" aria-labelledby={labelId}>
      {options.length > searchThreshold && <div className="multi-select-search"><Search size={14} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." aria-label={`Buscar en ${label.toLowerCase()}`} autoFocus /></div>}
      <ul className="multi-select-list">
        {missing.map((value) => <li key={`missing-${value}`}><label className="multi-select-option unavailable"><input type="checkbox" checked onChange={() => toggle(value)} /><span className="multi-select-check" aria-hidden="true"><Check size={12} /></span><span className="multi-select-option-text">{labelFor?.(value) ?? value}<small>Sin datos con los otros filtros</small></span></label></li>)}
        {visibleOptions.map((option) => {
          const checked = values.includes(option.value);
          return <li key={option.value}><label className="multi-select-option"><input type="checkbox" checked={checked} onChange={() => toggle(option.value)} /><span className="multi-select-check" aria-hidden="true">{checked && <Check size={12} />}</span><span className="multi-select-option-text">{option.label}</span></label></li>;
        })}
        {!visibleOptions.length && !missing.length && <li className="multi-select-empty">{options.length ? "Sin coincidencias" : "Sin opciones con los otros filtros"}</li>}
      </ul>
      <div className="multi-select-footer"><span>{values.length ? `${values.length} de ${options.length + missing.length}` : `${options.length} opciones`}</span><button type="button" onClick={() => onChange([])} disabled={!values.length}>Quitar selección</button></div>
    </div>}
  </div>;
}
