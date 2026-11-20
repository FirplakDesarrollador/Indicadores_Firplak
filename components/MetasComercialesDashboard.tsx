"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Database, RotateCcw, Save } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { targetsNavigation } from "@/lib/dashboard/navigation";
import { formatCurrency, formatMonthName, formatNumber } from "@/lib/dashboard/format";
import { suggestedWorkingDays } from "@/lib/metas/calendar";
import { loadCommercialTargets, type TargetSegment, targetSegments } from "@/lib/metas/targets";
import { createClient } from "@/lib/supabase/client";

// Borrador editable: importes como texto de dígitos para no perder lo que se escribe.
// Una sola meta para ventas y entregas (2026-11-09): se guarda igual en billing_target y delivery_target.
type MonthDraft = {
  month: number;
  workingDays: string;
  amounts: Record<TargetSegment, string>;
};
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const currentYear = new Date().getFullYear();

function emptySegments(): Record<TargetSegment, string> {
  return { "Firplak Nacional": "", "Firplak Exterior": "", Viventta: "", "CEFI Nacional": "", "CEFI Exterior": "" };
}

function digits(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function amount(value: string) {
  return Number(value || 0);
}

function serialize(draft: MonthDraft[]) {
  return JSON.stringify(draft);
}

export default function MetasComercialesDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [year, setYear] = useState(currentYear);
  const [draft, setDraft] = useState<MonthDraft[]>([]);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const data = await loadCommercialTargets(supabase, year);
      const next = months.map<MonthDraft>((month) => {
        const amounts = emptySegments();
        for (const target of data.targets.filter((item) => item.month === month)) {
          amounts[target.segment] = target.billingTarget ? String(Math.round(target.billingTarget)) : "";
        }
        return { month, workingDays: String(data.workingDays.get(month) ?? suggestedWorkingDays(year, month)), amounts };
      });
      setDraft(next);
      setSaved(serialize(next));
      setError("");
    } catch (loadError) {
      console.error("No fue posible cargar las metas", loadError);
      setDraft([]);
      setSaved("");
      setError("No fue posible cargar las metas. Verifica que la migración 20261109_metas_comerciales.sql esté aplicada en Supabase.");
    } finally {
      setLoading(false);
    }
  }, [supabase, year]);

  useEffect(() => { void load(); }, [load]);

  const isDirty = draft.length > 0 && serialize(draft) !== saved;
  const invalidMonths = draft.filter((item) => { const days = Number(item.workingDays); return !Number.isInteger(days) || days < 1 || days > 31; });

  const updateAmount = (month: number, company: TargetSegment, value: string) => setDraft((current) => current.map((item) => item.month === month ? { ...item, amounts: { ...item.amounts, [company]: digits(value) } } : item));
  const updateDays = (month: number, value: string) => setDraft((current) => current.map((item) => item.month === month ? { ...item, workingDays: value.replace(/\D/g, "").slice(0, 2) } : item));
  const resetDays = (month: number) => updateDays(month, String(suggestedWorkingDays(year, month)));
  const discard = () => { if (saved) setDraft(JSON.parse(saved) as MonthDraft[]); setNotice(""); };

  const save = async () => {
    if (invalidMonths.length) return;
    setSaving(true);
    setNotice("");
    try {
      const payload = draft.map((item) => ({
        month: item.month,
        working_days: Number(item.workingDays),
        targets: targetSegments.map((company) => ({ company, billing_target: amount(item.amounts[company]), delivery_target: amount(item.amounts[company]) })),
      }));
      const { error: saveError } = await supabase.rpc("save_commercial_targets", { p_year: year, p_months: payload });
      if (saveError) throw saveError;
      setSaved(serialize(draft));
      setError("");
      setNotice(`Metas de ${year} guardadas.`);
    } catch (saveError) {
      console.error("No fue posible guardar las metas", saveError);
      setError(saveError instanceof Error && saveError.message ? saveError.message : "No fue posible guardar las metas.");
    } finally {
      setSaving(false);
    }
  };

  const yearTotals = useMemo(() => targetSegments.reduce((totals, company) => ({ ...totals, [company]: draft.reduce((total, item) => total + amount(item.amounts[company]), 0) }), {} as Record<TargetSegment, number>), [draft]);
  const yearTotal = targetSegments.reduce((total, company) => total + yearTotals[company], 0);
  const years = Array.from({ length: 5 }, (_, index) => currentYear + 1 - index);

  return <DashboardShell navigation={targetsNavigation} activeHref="/metas-comerciales" title="Metas comerciales" className="targets-shell">
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> COMERCIAL</div><h1>Metas comerciales</h1><p>Registra la meta mensual por empresa; la de Firplak se divide en Nacional y Exterior. La misma meta se usa para ventas y para entregas. La meta diaria es la meta del mes dividida entre sus días laborales.</p></div></div>

    <div className="billing-filterbar targets-toolbar">
      <label className="targets-year"><CalendarDays size={15} /><span>Año</span><select value={year} onChange={(event) => setYear(Number(event.target.value))} disabled={saving}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="targets-actions">{isDirty && <span>Hay cambios sin guardar</span>}<button type="button" className="billing-reset-button" onClick={discard} disabled={!isDirty || saving}>Descartar</button><button type="button" className="billing-primary-button" onClick={() => void save()} disabled={!isDirty || saving || invalidMonths.length > 0}><Save size={16} /> {saving ? "Guardando…" : "Guardar metas"}</button></div>
    </div>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void load()}>Reintentar</button></div>}
    {notice && <div className="targets-notice" role="status">{notice}</div>}

    <section className="billing-panel targets-panel">
      <div className="billing-table-heading"><div><span className="billing-panel-kicker">VENTAS Y ENTREGAS · {year}</span><h2>Meta mensual por empresa y mercado</h2><p>Los días laborales se calculan de lunes a viernes sin festivos de Colombia; puedes corregirlos. Aplican a ventas y a entregas.</p></div><div className="targets-year-total"><span>Total del año</span><strong>{formatCurrency(yearTotal)}</strong></div></div>
      <div className="billing-table-scroll"><table className="billing-data-table targets-table"><thead><tr><th>Mes</th><th className="align-right">Días laborales</th>{targetSegments.map((company) => <th key={company} className="align-right">{company}</th>)}<th className="align-right">Total del mes</th><th className="align-right">Meta diaria</th></tr></thead>
        <tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={targetSegments.length + 4}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>) : draft.map((item) => {
          const total = targetSegments.reduce((sum, company) => sum + amount(item.amounts[company]), 0);
          const days = Number(item.workingDays);
          const suggested = suggestedWorkingDays(year, item.month);
          const invalid = !Number.isInteger(days) || days < 1 || days > 31;
          return <tr key={item.month}>
            <td>{formatMonthName(item.month)}</td>
            <td className="align-right"><div className="targets-days"><input className={invalid ? "invalid" : ""} inputMode="numeric" value={item.workingDays} onChange={(event) => updateDays(item.month, event.target.value)} aria-label={`Días laborales de ${formatMonthName(item.month)}`} aria-invalid={invalid} />{days !== suggested && <button type="button" onClick={() => resetDays(item.month)} title={`Volver al valor calculado (${suggested})`} aria-label={`Volver a ${suggested} días calculados`}><RotateCcw size={14} /></button>}</div></td>
            {targetSegments.map((company) => <td key={company} className="align-right"><input className="targets-amount" inputMode="numeric" value={item.amounts[company] ? formatNumber(amount(item.amounts[company])) : ""} placeholder="0" onChange={(event) => updateAmount(item.month, company, event.target.value)} aria-label={`Meta de ${company} en ${formatMonthName(item.month)}`} /></td>)}
            <td className="align-right number-cell">{formatCurrency(total)}</td>
            <td className="align-right">{total && !invalid ? formatCurrency(total / days) : "—"}</td>
          </tr>;
        })}</tbody>
        {!loading && draft.length > 0 && <tfoot><tr><td>Total</td><td className="align-right">{formatNumber(draft.reduce((sum, item) => sum + (Number(item.workingDays) || 0), 0))}</td>{targetSegments.map((company) => <td key={company} className="align-right">{formatCurrency(yearTotals[company])}</td>)}<td className="align-right">{formatCurrency(yearTotal)}</td><td /></tr></tfoot>}
      </table></div>
    </section>
    <footer className="billing-footer"><span>Cada cambio queda registrado con su autor y fecha.</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
