"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronDown, ChevronRight, Database, Download, History, Search } from "lucide-react";
import { formatDateTime } from "@/lib/dashboard/format";
import { actorLabel, auditTarget, auditText, channelLabels, reportTitle, type AuditEntry, type SupportChannel } from "./permissions-model";

const maxRows = 2000;
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return isoDate(date); };

type Kind = "" | "cargo" | "excepcion" | "admin";
const kindOf = (action: string): Kind => action.includes("admin") ? "admin" : action.endsWith("_report") && !action.startsWith("role_") ? "excepcion" : "cargo";

function supportText(entry: AuditEntry) {
  if (!entry.request) return entry.actor === "sql" ? "Script SQL" : "Sin soporte (antes del 2026-11-06)";
  return `${channelLabels[entry.request.channel]}: ${entry.request.reference}`;
}

// Excel en español separa columnas con punto y coma; el BOM conserva las tildes.
function downloadCsv(rows: AuditEntry[]) {
  const header = ["Fecha y hora", "Cambio", "Persona", "Cargo", "Informe", "Hecho por", "Medio", "Referencia", "Solicitado por", "Aprobado por", "Observación", "Detalle", "Personas con el cargo"];
  const lines = rows.map((entry) => [
    formatDateTime(entry.at), auditText(entry), entry.email ?? "", entry.role_name ?? "", reportTitle(entry.report_slug), actorLabel(entry.actor),
    entry.request ? channelLabels[entry.request.channel] : "", entry.request?.reference ?? "", entry.request?.requested_by ?? "", entry.request?.approved_by ?? "",
    entry.request?.notes ?? "", entry.detail ?? "", (entry.affected_emails ?? []).join(", "),
  ]);
  const csv = [header, ...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `historial-permisos_${isoDate(new Date())}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditView({ supabase, initialSearch, refreshKey }: { supabase: SupabaseClient; initialSearch: string; refreshKey: number }) {
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [channel, setChannel] = useState<"" | SupportChannel>("");
  const [kind, setKind] = useState<Kind>("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    const { data, error: loadError } = await supabase.from("permission_audit")
      .select("id, action, email, report_slug, role_id, role_name, detail, affected_emails, actor, at, request:access_change_requests(id, channel, reference, requested_by, approved_by, notes, created_by, created_at)")
      .gte("at", new Date(`${from}T00:00:00`).toISOString()).lt("at", end.toISOString())
      .order("at", { ascending: false }).order("id", { ascending: false }).limit(maxRows);
    if (loadError) setError(`No fue posible cargar el historial: ${loadError.message}`);
    else { setEntries((data ?? []) as unknown as AuditEntry[]); setError(""); }
    setLoading(false);
  }, [from, supabase, to]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (channel && entry.request?.channel !== channel) return false;
      if (kind && kindOf(entry.action) !== kind) return false;
      if (!term) return true;
      const haystack = [entry.email, entry.role_name, reportTitle(entry.report_slug), entry.actor, entry.request?.requested_by, entry.request?.approved_by, entry.request?.reference, ...(entry.affected_emails ?? [])].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [channel, entries, kind, search]);

  return <section className="billing-panel admin-table-panel">
    <div className="billing-table-heading admin-heading-actions"><div><span className="billing-panel-kicker">HISTORIAL</span><h2>Registro de modificaciones</h2><p>Qué se cambió, quién lo hizo, cuándo y con qué soporte. {rows.length} de {entries.length} registros{entries.length === maxRows ? ` (se muestran los ${maxRows} más recientes; acota las fechas)` : ""}.</p></div>
      <button type="button" className="billing-secondary-button" onClick={() => downloadCsv(rows)} disabled={!rows.length}><Download size={16} /> Exportar CSV</button></div>
    <div className="admin-toolbar">
      <div className="admin-filters">
        <label className="admin-inline-field">Desde <input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} /></label>
        <label className="admin-inline-field">Hasta <input type="date" value={to} min={from} onChange={(event) => event.target.value && setTo(event.target.value)} /></label>
        <select className="admin-select" value={kind} onChange={(event) => setKind(event.target.value as Kind)} aria-label="Tipo de cambio"><option value="">Todos los cambios</option><option value="cargo">Cargos</option><option value="excepcion">Excepciones</option><option value="admin">Administradores</option></select>
        <select className="admin-select" value={channel} onChange={(event) => setChannel(event.target.value as "" | SupportChannel)} aria-label="Medio de la solicitud"><option value="">Todos los medios</option>{(Object.keys(channelLabels) as SupportChannel[]).map((option) => <option key={option} value={option}>{channelLabels[option]}</option>)}</select>
      </div>
      <label className="admin-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Persona, cargo, informe, solicitante…" aria-label="Buscar en el historial" /></label>
    </div>
    {error && <div className="billing-alert admin-inset"><Database size={16} /><span>{error}</span><button onClick={() => void load()}>Reintentar</button></div>}
    <div className="billing-table-scroll"><table className="billing-data-table admin-table"><thead><tr><th>Fecha y hora</th><th>Cambio</th><th>Persona</th><th>Hecho por</th><th>Soporte</th><th>Solicitó</th><th>Aprobó</th></tr></thead><tbody>
      {loading && !entries.length ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={7}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>)
        : rows.length ? rows.map((entry) => {
          const isOpen = open === entry.id;
          const toggle = () => setOpen(isOpen ? null : entry.id);
          return <Fragment key={entry.id}>
            <tr tabIndex={0} onClick={toggle} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } }} aria-expanded={isOpen}>
              <td><span className="admin-row-toggle">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{formatDateTime(entry.at)}</span></td>
              <td className="admin-wrap-cell">{auditText(entry)}</td>
              <td>{auditTarget(entry)}</td>
              <td>{actorLabel(entry.actor)}</td>
              <td className="admin-reference-cell" title={supportText(entry)}>{entry.request ? <><span className="admin-badge">{channelLabels[entry.request.channel]}</span> {entry.request.reference}</> : <span className="admin-muted">{supportText(entry)}</span>}</td>
              <td>{entry.request?.requested_by ?? "—"}</td>
              <td>{entry.request?.approved_by ?? "—"}</td>
            </tr>
            {isOpen && <tr className="admin-detail-row"><td colSpan={7}><dl className="admin-detail-list">
              <div><dt>Cambio</dt><dd>{auditText(entry)}{entry.detail ? ` · ${entry.detail}` : ""}</dd></div>
              <div><dt>Hecho por</dt><dd>{actorLabel(entry.actor)} · {formatDateTime(entry.at)}</dd></div>
              {entry.request && <>
                <div><dt>Medio</dt><dd>{channelLabels[entry.request.channel]}</dd></div>
                <div><dt>Referencia</dt><dd>{entry.request.channel === "planner" ? <a href={entry.request.reference} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{entry.request.reference}</a> : entry.request.reference}</dd></div>
                <div><dt>Solicitado por</dt><dd>{entry.request.requested_by}</dd></div>
                <div><dt>Aprobado por</dt><dd>{entry.request.approved_by}</dd></div>
                {entry.request.notes && <div><dt>Observación</dt><dd>{entry.request.notes}</dd></div>}
                <div><dt>Soporte n.º</dt><dd>{entry.request.id} (agrupa todos los cambios guardados juntos)</dd></div>
              </>}
              {entry.affected_emails && <div><dt>Personas con el cargo en ese momento ({entry.affected_emails.length})</dt><dd>{entry.affected_emails.join(", ") || "Ninguna"}</dd></div>}
            </dl></td></tr>}
          </Fragment>;
        })
        : <tr><td colSpan={7} className="billing-table-state"><History size={22} /><strong>No hay cambios en esta vista</strong><span>Prueba con otras fechas o filtros.</span></td></tr>}
    </tbody></table></div>
  </section>;
}
