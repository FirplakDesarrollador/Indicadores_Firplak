"use client";

import { type FormEvent, useState } from "react";
import AdminOverlay from "./AdminOverlay";
import ReportPicker from "./ReportPicker";
import { emailPattern, parseEmails, reportTitle, type AccessChange, type Model, type PendingChange } from "./permissions-model";

// Dar acceso a una o varias personas, aunque aún no hayan iniciado sesión: un cargo y, si hace falta, excepciones.
export default function GrantDialog({ model, onClose, onSubmit }: { model: Model; onClose: () => void; onSubmit: (pending: PendingChange) => void }) {
  const [emailsText, setEmailsText] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [extra, setExtra] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const emails = parseEmails(emailsText);
  const roleReports = (roleId ? model.roleById.get(roleId)?.reports : undefined) ?? new Set<string>();
  const changingRole = roleId ? emails.filter((email) => { const current = model.userByEmail.get(email)?.roleId; return current && current !== roleId; }) : [];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = emails.filter((email) => !emailPattern.test(email));
    if (!emails.length) return setError("Escribe al menos un correo.");
    if (invalid.length) return setError(`Correo no válido: ${invalid.join(", ")}`);
    const exceptions = [...extra].filter((slug) => !roleReports.has(slug));
    if (!roleId && !exceptions.length) return setError("Elige un cargo o al menos un informe.");

    const changes: AccessChange[] = [];
    const summary: string[] = [];
    const role = roleId ? model.roleById.get(roleId) : undefined;
    for (const email of emails) {
      if (role) {
        changes.push({ op: "assign_role", email, role_id: role.id });
        const previous = model.userByEmail.get(email)?.roleId;
        summary.push(`${email}: cargo ${role.name}${previous && previous !== role.id ? ` (antes: ${model.roleById.get(previous)?.name})` : ""}`);
      }
      for (const slug of exceptions) {
        changes.push({ op: "grant_report", email, report_slug: slug });
        summary.push(`${email}: excepción ${reportTitle(slug)}`);
      }
    }
    setError("");
    onSubmit({ title: emails.length === 1 ? `Dar acceso a ${emails[0]}` : `Dar acceso a ${emails.length} personas`, changes, summary, affected: emails });
  };

  return <AdminOverlay variant="modal" kicker="NUEVO ACCESO" title="Dar acceso" onClose={onClose}>
    <form className="admin-form" onSubmit={submit} noValidate>
      <label className="admin-field"><span>Correos de Microsoft 365</span>
        <textarea value={emailsText} onChange={(event) => setEmailsText(event.target.value)} rows={3} placeholder="nombre.apellido@firplak.com, otra.persona@firplak.com" />
        <small>{emails.length ? `${emails.length} correo${emails.length === 1 ? "" : "s"}` : "Separa varios correos con coma o salto de línea. Sirve para quien aún no ha iniciado sesión."}</small>
      </label>
      <label className="admin-field"><span>Cargo</span>
        <select value={roleId ?? ""} onChange={(event) => setRoleId(event.target.value ? Number(event.target.value) : null)}>
          <option value="">Sin cargo (solo excepciones)</option>
          {model.roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.reports.size} informes)</option>)}
        </select>
        {!model.roles.length && <small>Aún no hay cargos: créalos en la pestaña Cargos.</small>}
        {changingRole.length > 0 && <small className="admin-warning-text">{changingRole.length === 1 ? `${changingRole[0]} ya tiene otro cargo; se cambiará.` : `${changingRole.length} personas ya tienen otro cargo; se cambiará.`}</small>}
      </label>
      <div className="admin-section">
        <span className="admin-label">Excepciones (informes adicionales al cargo)</span>
        <ReportPicker selected={extra} onChange={setExtra} locked={roleReports} />
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" className="billing-secondary-button" onClick={onClose}>Cancelar</button>
        <button type="submit" className="billing-primary-button">Continuar…</button>
      </div>
    </form>
  </AdminOverlay>;
}
