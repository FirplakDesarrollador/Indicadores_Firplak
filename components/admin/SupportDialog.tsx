"use client";

import { type FormEvent, useState } from "react";
import { Mail, SquareKanban } from "lucide-react";
import AdminOverlay from "./AdminOverlay";
import PeopleList from "./PeopleList";
import { channelLabels, emailPattern, normalizeEmail, type PendingChange, type SupportChannel, type SupportRequest, type UserRow } from "./permissions-model";

const emptySupport: SupportRequest = { channel: "correo", reference: "", requested_by: "", approved_by: "", notes: "" };
const visibleSummary = 8;

// Todo cambio se guarda con su soporte. Quién lo hizo y cuándo lo pone el servidor.
export default function SupportDialog({ pending, userByEmail, saving, error, onCancel, onConfirm }: {
  pending: PendingChange;
  userByEmail: Map<string, UserRow>;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (support: SupportRequest) => void;
}) {
  const [support, setSupport] = useState<SupportRequest>(emptySupport);
  const [formError, setFormError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const set = (field: keyof SupportRequest, value: string) => setSupport((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = support.reference.trim();
    const requestedBy = normalizeEmail(support.requested_by);
    if (reference.length < 3) return setFormError(support.channel === "planner" ? "Pega el enlace de la tarea de Planner." : "Escribe el asunto y la fecha del correo.");
    if (support.channel === "planner" && !/^https:\/\//i.test(reference)) return setFormError("El enlace de la tarea de Planner debe empezar por https://.");
    if (!emailPattern.test(requestedBy)) return setFormError("Escribe el correo de quien solicitó el cambio.");
    if (support.approved_by.trim().length < 2) return setFormError("Escribe quién aprobó el cambio.");
    setFormError("");
    onConfirm({ ...support, reference, requested_by: requestedBy, approved_by: support.approved_by.trim(), notes: support.notes.trim() });
  };

  const summary = showAll ? pending.summary : pending.summary.slice(0, visibleSummary);

  return <AdminOverlay variant="modal" layer={1} kicker="SOPORTE DEL CAMBIO" title={pending.title} onClose={saving ? () => undefined : onCancel}>
    <form className="admin-form" onSubmit={submit} noValidate>
      <div className="admin-summary">
        <span className="admin-label">Cambios ({pending.summary.length})</span>
        <ul>{summary.map((line, index) => <li key={index}>{line}</li>)}</ul>
        {pending.summary.length > visibleSummary && <button type="button" className="admin-link-button" onClick={() => setShowAll((value) => !value)}>{showAll ? "Ver menos" : `Ver los ${pending.summary.length - visibleSummary} restantes`}</button>}
        <PeopleList emails={pending.affected} userByEmail={userByEmail} label="Cambia el acceso de {n} persona{s}." />
      </div>

      <fieldset className="admin-channel">
        <legend className="admin-label">Medio de la solicitud</legend>
        {(Object.keys(channelLabels) as SupportChannel[]).map((channel) => <label key={channel} className={`admin-channel-option ${support.channel === channel ? "active" : ""}`}>
          <input type="radio" name="channel" value={channel} checked={support.channel === channel} onChange={() => set("channel", channel)} />
          {channel === "correo" ? <Mail size={16} /> : <SquareKanban size={16} />} {channelLabels[channel]}
        </label>)}
      </fieldset>

      <label className="admin-field"><span>{support.channel === "planner" ? "Enlace de la tarea de Planner" : "Asunto y fecha del correo"}</span>
        <input value={support.reference} onChange={(event) => set("reference", event.target.value)} placeholder={support.channel === "planner" ? "https://tasks.office.com/…" : "Acceso a informes de ventas · 2026-11-06"} autoComplete="off" />
      </label>
      <div className="admin-field-row">
        <label className="admin-field"><span>Solicitado por (correo)</span>
          <input type="email" value={support.requested_by} onChange={(event) => set("requested_by", event.target.value)} placeholder="nombre.apellido@firplak.com" autoComplete="off" />
        </label>
        <label className="admin-field"><span>Aprobado por</span>
          <input value={support.approved_by} onChange={(event) => set("approved_by", event.target.value)} placeholder="Nombre o correo de quien aprobó" autoComplete="off" />
        </label>
      </div>
      <label className="admin-field"><span>Observación (opcional)</span>
        <textarea value={support.notes} onChange={(event) => set("notes", event.target.value)} rows={2} maxLength={1000} />
      </label>

      {(formError || error) && <p className="admin-form-error" role="alert">{formError || error}</p>}
      <div className="admin-actions">
        <button type="button" className="billing-secondary-button" onClick={onCancel} disabled={saving}>Volver</button>
        <button type="submit" className="billing-primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  </AdminOverlay>;
}
