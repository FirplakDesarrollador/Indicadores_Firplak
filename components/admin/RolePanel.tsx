"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Trash2, UserPlus, X } from "lucide-react";
import AdminOverlay from "./AdminOverlay";
import PeopleList from "./PeopleList";
import ReportPicker from "./ReportPicker";
import { displayName, emailPattern, parseEmails, reportTitle, type AccessChange, type Model, type PendingChange, type RoleRow } from "./permissions-model";

// Crear o editar un cargo: nombre, informes que incluye y personas que lo tienen.
export default function RolePanel({ role, model, onClose, onSubmit }: {
  role: RoleRow | null;
  model: Model;
  onClose: () => void;
  onSubmit: (pending: PendingChange) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.reports ?? []));
  const [members, setMembers] = useState<string[]>(() => [...(role?.members ?? [])]);
  const [memberInput, setMemberInput] = useState("");
  const [error, setError] = useState("");

  const originalReports = useMemo(() => role?.reports ?? new Set<string>(), [role]);
  const originalMembers = useMemo(() => new Set(role?.members ?? []), [role]);
  const added = [...selected].filter((slug) => !originalReports.has(slug));
  const removed = [...originalReports].filter((slug) => !selected.has(slug));
  const newMembers = members.filter((email) => !originalMembers.has(email));
  const removedMembers = [...originalMembers].filter((email) => !members.includes(email));
  const reportsChanged = added.length + removed.length > 0;
  // Quienes conservan el cargo reciben o pierden los informes que cambien.
  const keptMembers = members.filter((email) => originalMembers.has(email));

  const addMembers = (event: FormEvent) => {
    event.preventDefault();
    const emails = parseEmails(memberInput);
    const invalid = emails.filter((email) => !emailPattern.test(email));
    if (invalid.length) return setError(`Correo no válido: ${invalid.join(", ")}`);
    setMembers((current) => [...current, ...emails.filter((email) => !current.includes(email))]);
    setMemberInput("");
    setError("");
  };

  const save = () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return setError("Escribe el nombre del cargo.");
    const duplicate = model.roles.find((other) => other.id !== role?.id && other.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) return setError(`Ya existe el cargo ${duplicate.name}.`);
    if (!selected.size) return setError("Selecciona al menos un informe.");

    const changes: AccessChange[] = [];
    const summary: string[] = [];
    const movedFrom = (email: string) => {
      const previous = model.userByEmail.get(email)?.roleId;
      return previous && previous !== role?.id ? ` (deja el cargo ${model.roleById.get(previous)?.name})` : "";
    };

    if (!role) {
      changes.push({ op: "create_role", name: trimmedName, description: description.trim(), report_slugs: [...selected], emails: members });
      summary.push(`Crear el cargo ${trimmedName} con ${selected.size} informe${selected.size === 1 ? "" : "s"}: ${[...selected].map(reportTitle).join(", ")}`);
      for (const email of members) summary.push(`Asignar el cargo a ${email}${movedFrom(email)}`);
      return onSubmit({ title: `Nuevo cargo: ${trimmedName}`, changes, summary, affected: members });
    }

    if (trimmedName !== role.name || description.trim() !== (role.description ?? "")) {
      changes.push({ op: "update_role", role_id: role.id, name: trimmedName, description: description.trim() });
      summary.push(trimmedName !== role.name ? `Cambiar el nombre a ${trimmedName}` : "Cambiar la descripción");
    }
    for (const slug of added) { changes.push({ op: "role_add_report", role_id: role.id, report_slug: slug }); summary.push(`Agregar ${reportTitle(slug)}`); }
    for (const slug of removed) { changes.push({ op: "role_remove_report", role_id: role.id, report_slug: slug }); summary.push(`Quitar ${reportTitle(slug)}`); }
    for (const email of newMembers) { changes.push({ op: "assign_role", email, role_id: role.id }); summary.push(`Asignar el cargo a ${email}${movedFrom(email)}`); }
    for (const email of removedMembers) { changes.push({ op: "unassign_role", email }); summary.push(`Quitar el cargo a ${email}`); }
    if (!changes.length) return setError("No hay cambios para guardar.");

    const affected = Array.from(new Set([...(reportsChanged ? keptMembers : []), ...newMembers, ...removedMembers]));
    setError("");
    onSubmit({ title: `Cargo ${trimmedName}`, changes, summary, affected });
  };

  const remove = () => {
    if (!role) return;
    if (!window.confirm(`¿Eliminar el cargo ${role.name}?`)) return;
    onSubmit({ title: `Eliminar el cargo ${role.name}`, changes: [{ op: "delete_role", role_id: role.id }], summary: [`Eliminar el cargo ${role.name} (${role.reports.size} informes)`], affected: [] });
  };

  const footer = <div className="admin-actions">
    {role && <button type="button" className="billing-secondary-button admin-danger-button" onClick={remove} disabled={role.members.length > 0} title={role.members.length ? "Cambia de cargo a sus personas antes de eliminarlo" : undefined}><Trash2 size={15} /> Eliminar</button>}
    <button type="button" className="billing-secondary-button" onClick={onClose}>Cancelar</button>
    <button type="button" className="billing-primary-button" onClick={save}>Guardar…</button>
  </div>;

  return <AdminOverlay variant="drawer" kicker={role ? "CARGO" : "NUEVO CARGO"} title={role ? role.name : "Nuevo cargo"} onClose={onClose} footer={footer}>
    <label className="admin-field"><span>Nombre del cargo</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ej.: Auxiliar de ventas" /></label>
    <label className="admin-field"><span>Descripción (opcional)</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} placeholder="Para qué se usa este cargo" /></label>

    <div className="admin-section">
      <span className="admin-label">Informes del cargo</span>
      <ReportPicker selected={selected} onChange={setSelected} />
      {role && reportsChanged && <PeopleList emails={keptMembers} userByEmail={model.userByEmail} label="Este cambio de informes afecta a {n} persona{s} con este cargo." />}
    </div>

    <div className="admin-section">
      <span className="admin-label">Personas con este cargo ({members.length})</span>
      <form className="admin-inline-form" onSubmit={addMembers}>
        <input list="admin-known-users" value={memberInput} onChange={(event) => setMemberInput(event.target.value)} placeholder="Correo, o varios separados por coma" aria-label="Agregar personas al cargo" autoComplete="off" />
        <datalist id="admin-known-users">{model.users.map((user) => <option key={user.email} value={user.email}>{user.name}</option>)}</datalist>
        <button type="submit" className="billing-secondary-button small"><UserPlus size={15} /> Agregar</button>
      </form>
      {members.length ? <ul className="admin-people">{members.map((email) => {
        const user = model.userByEmail.get(email);
        const otherRole = user?.roleId && user.roleId !== role?.id ? model.roleById.get(user.roleId)?.name : "";
        return <li key={email}>
          <span><strong>{displayName(user) || email}</strong>{user?.name && <small>{email}</small>}{otherRole && <small className="admin-warning-text">Hoy tiene el cargo {otherRole}; lo cambiará.</small>}{!originalMembers.has(email) && <small>Nuevo</small>}</span>
          <button type="button" className="admin-icon-button" onClick={() => setMembers((current) => current.filter((item) => item !== email))} aria-label={`Quitar a ${email} del cargo`}><X size={15} /></button>
        </li>;
      })}</ul> : <p className="admin-panel-note">Nadie tiene este cargo todavía.</p>}
    </div>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
  </AdminOverlay>;
}
