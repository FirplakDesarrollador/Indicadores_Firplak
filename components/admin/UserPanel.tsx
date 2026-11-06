"use client";

import { useMemo, useState } from "react";
import { History, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/dashboard/format";
import AdminOverlay from "./AdminOverlay";
import ReportPicker from "./ReportPicker";
import { displayName, reportTitle, type AccessChange, type Model, type PendingChange, type UserRow } from "./permissions-model";

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((item) => b.has(item));

// Cargo, excepciones y rol de administrador de una persona. Los cambios se guardan con el botón.
export default function UserPanel({ user, model, currentEmail, onClose, onSubmit, onShowHistory }: {
  user: UserRow;
  model: Model;
  currentEmail: string;
  onClose: () => void;
  onSubmit: (pending: PendingChange) => void;
  onShowHistory: (email: string) => void;
}) {
  const [roleId, setRoleId] = useState<number | null>(user.roleId);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [exceptions, setExceptions] = useState(() => new Set(user.exceptions));
  const [error, setError] = useState("");

  const roleReports = useMemo(() => (roleId ? model.roleById.get(roleId)?.reports : undefined) ?? new Set<string>(), [model, roleId]);
  const dirty = roleId !== user.roleId || isAdmin !== user.isAdmin || !sameSet(exceptions, user.exceptions);

  const save = () => {
    const email = user.email;
    const changes: AccessChange[] = [];
    const summary: string[] = [];
    if (roleId !== user.roleId) {
      if (roleId) {
        changes.push({ op: "assign_role", email, role_id: roleId });
        summary.push(`Asignar el cargo ${model.roleById.get(roleId)?.name}${user.roleId ? ` (antes: ${model.roleById.get(user.roleId)?.name})` : ""}`);
      } else {
        changes.push({ op: "unassign_role", email });
        summary.push(`Quitar el cargo ${model.roleById.get(user.roleId!)?.name}`);
      }
    }
    for (const slug of exceptions) if (!user.exceptions.has(slug)) {
      changes.push({ op: "grant_report", email, report_slug: slug });
      summary.push(`Excepción: dar acceso a ${reportTitle(slug)}`);
    }
    for (const slug of user.exceptions) if (!exceptions.has(slug)) {
      changes.push({ op: "revoke_report", email, report_slug: slug });
      summary.push(`Excepción: quitar el acceso a ${reportTitle(slug)}`);
    }
    if (isAdmin !== user.isAdmin) {
      if (!isAdmin && email === currentEmail && !window.confirm("Vas a quitarte el rol de administrador y perderás el acceso a esta página. ¿Continuar?")) return;
      changes.push({ op: isAdmin ? "grant_admin" : "revoke_admin", email });
      summary.push(isAdmin ? "Dar el rol de administrador" : "Quitar el rol de administrador");
    }
    if (!changes.length) return setError("No hay cambios para guardar.");
    setError("");
    onSubmit({ title: `Permisos de ${displayName(user)}`, changes, summary, affected: [email] });
  };

  const footer = <div className="admin-actions">
    <button type="button" className="billing-secondary-button" onClick={onClose}>Cancelar</button>
    <button type="button" className="billing-primary-button" onClick={save} disabled={!dirty}>Guardar…</button>
  </div>;

  return <AdminOverlay variant="drawer" kicker="PERMISOS DE USUARIO" title={displayName(user)} onClose={onClose} footer={footer}>
    <p className="admin-panel-note">{user.name ? `${user.email} · ` : ""}{user.lastLogin ? `Último ingreso: ${formatDateTime(user.lastLogin)}` : "Aún no ha iniciado sesión"}</p>
    <button type="button" className="admin-link-button admin-history-link" onClick={() => onShowHistory(user.email)}><History size={14} /> Ver su historial</button>

    <label className="admin-field"><span>Cargo</span>
      <select value={roleId ?? ""} onChange={(event) => setRoleId(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Sin cargo</option>
        {model.roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.reports.size} informes)</option>)}
      </select>
    </label>

    <label className="admin-check admin-admin-toggle"><input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} /> <ShieldCheck size={16} /> Administrador <small>Ve todos los informes y administra los permisos.</small></label>

    <div className="admin-section">
      <span className="admin-label">Informes</span>
      <p className="admin-panel-note">Los marcados &quot;Por cargo&quot; los da el cargo; los demás que marques son excepciones solo para esta persona.{isAdmin ? " Como administrador ve todos los informes." : ""}</p>
      <ReportPicker selected={exceptions} onChange={setExceptions} locked={roleReports} />
    </div>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
  </AdminOverlay>;
}
