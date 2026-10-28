"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Database, Search, ShieldCheck, UserPlus } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { adminNavigation } from "@/lib/dashboard/navigation";
import { formatDateTime } from "@/lib/dashboard/format";
import { reports } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";

type AppUser = { email: string; full_name: string | null; last_login_at: string };
type Permission = { email: string; report_slug: string };
type Admin = { email: string };
type AuditEntry = { id: number; action: string; email: string; report_slug: string | null; actor: string; at: string };
type UserRow = { email: string; name: string; lastLogin: string; isAdmin: boolean; slugs: Set<string>; hasLoggedIn: boolean };
type View = "todos" | "pendientes" | "administradores";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reportTitles = new Map(reports.map((report) => [report.slug, report.title]));

// Pendiente de acceso: no es administrador y no tiene ningún informe asignado.
function isPending(row: UserRow) {
  return !row.isAdmin && row.slugs.size === 0;
}

function auditText(entry: AuditEntry) {
  const report = entry.report_slug ? reportTitles.get(entry.report_slug) ?? entry.report_slug : "";
  switch (entry.action) {
    case "grant_report": return `Dio acceso a ${report}`;
    case "revoke_report": return `Quitó el acceso a ${report}`;
    case "grant_admin": return "Dio el rol de administrador";
    case "revoke_admin": return "Quitó el rol de administrador";
    default: return entry.action;
  }
}

export default function PermissionsAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [currentEmail, setCurrentEmail] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("todos");
  const [newEmail, setNewEmail] = useState("");
  const [newSlugs, setNewSlugs] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [userResult, permissionResult, adminResult, auditResult] = await Promise.all([
      supabase.from("app_users").select("email, full_name, last_login_at").order("last_login_at", { ascending: false }),
      supabase.from("report_permissions").select("email, report_slug"),
      supabase.from("app_admins").select("email"),
      supabase.from("permission_audit").select("id, action, email, report_slug, actor, at").order("at", { ascending: false }).limit(20),
    ]);
    const failed = [userResult, permissionResult, adminResult, auditResult].find((result) => result.error);
    if (failed?.error) {
      setError(`No fue posible cargar los permisos: ${failed.error.message}`);
    } else {
      setUsers((userResult.data ?? []) as AppUser[]);
      setPermissions((permissionResult.data ?? []) as Permission[]);
      setAdmins((adminResult.data ?? []) as Admin[]);
      setAudit((auditResult.data ?? []) as AuditEntry[]);
      setError("");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentEmail((data.user?.email ?? "").toLowerCase()));
    void loadData();
  }, [loadData, supabase]);

  // Une a quienes ya iniciaron sesión con quienes tienen permisos asignados por correo.
  const rows = useMemo<UserRow[]>(() => {
    const byEmail = new Map<string, UserRow>();
    const ensure = (email: string) => {
      const existing = byEmail.get(email);
      if (existing) return existing;
      const row: UserRow = { email, name: "", lastLogin: "", isAdmin: false, slugs: new Set(), hasLoggedIn: false };
      byEmail.set(email, row);
      return row;
    };
    for (const user of users) Object.assign(ensure(user.email), { name: user.full_name ?? "", lastLogin: user.last_login_at, hasLoggedIn: true });
    for (const permission of permissions) ensure(permission.email).slugs.add(permission.report_slug);
    for (const admin of admins) ensure(admin.email).isAdmin = true;
    return Array.from(byEmail.values()).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "es"));
  }, [admins, permissions, users]);

  const pendingCount = rows.filter(isPending).length;
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (view === "pendientes" && !isPending(row)) return false;
      if (view === "administradores" && !row.isAdmin) return false;
      return !term || row.email.includes(term) || row.name.toLowerCase().includes(term);
    });
  }, [rows, search, view]);

  const runChange = async (key: string, change: () => PromiseLike<{ error: { message: string } | null }>) => {
    setSavingKey(key);
    const { error: changeError } = await change();
    if (changeError) setError(`No se guardó el cambio: ${changeError.message}`);
    await loadData();
    setSavingKey("");
  };

  const toggleReport = (row: UserRow, slug: string) => runChange(`${row.email}:${slug}`, () => row.slugs.has(slug)
    ? supabase.from("report_permissions").delete().eq("email", row.email).eq("report_slug", slug)
    : supabase.from("report_permissions").insert({ email: row.email, report_slug: slug }));

  const toggleAdmin = (row: UserRow) => {
    if (row.isAdmin) {
      const message = row.email === currentEmail
        ? "Vas a quitarte el rol de administrador y perderás el acceso a esta página. ¿Continuar?"
        : `¿Quitar el rol de administrador a ${row.email}?`;
      if (!window.confirm(message)) return;
    }
    void runChange(`${row.email}:admin`, () => row.isAdmin
      ? supabase.from("app_admins").delete().eq("email", row.email)
      : supabase.from("app_admins").insert({ email: row.email }));
  };

  const removeAllReports = (row: UserRow) => {
    if (!window.confirm(`¿Quitar todos los informes a ${row.email}?`)) return;
    void runChange(`${row.email}:all`, () => supabase.from("report_permissions").delete().eq("email", row.email));
  };

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!emailPattern.test(email)) { setFormError("Escribe un correo válido."); return; }
    if (!newSlugs.length) { setFormError("Selecciona al menos un informe."); return; }
    setFormError("");
    await runChange(`${email}:new`, () => supabase.from("report_permissions").upsert(
      newSlugs.map((slug) => ({ email, report_slug: slug })),
      { onConflict: "email,report_slug", ignoreDuplicates: true },
    ));
    setNewEmail("");
    setNewSlugs([]);
  };

  const busy = Boolean(savingKey);

  return <DashboardShell navigation={adminNavigation} activeHref="/admin/permisos" title="Permisos de informes" className="admin-shell">
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> ADMINISTRACIÓN</div><h1>Permisos de informes</h1><p>Decide qué informes puede ver cada usuario. Los administradores ven todos los informes.</p></div></div>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData()}>Reintentar</button></div>}

    <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">NUEVO ACCESO</span><h2>Dar acceso por correo</h2><p className="admin-panel-note">Sirve también para usuarios que aún no han iniciado sesión.</p></div></div>
      <form className="admin-add-form" onSubmit={addUser} noValidate>
        <label className="admin-field"><span>Correo de Microsoft 365</span><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nombre.apellido@firplak.com" autoComplete="off" /></label>
        <fieldset className="admin-report-options"><legend>Informes</legend>{reports.map((report) => <label key={report.slug} className="admin-check"><input type="checkbox" checked={newSlugs.includes(report.slug)} onChange={(event) => setNewSlugs((current) => event.target.checked ? [...current, report.slug] : current.filter((slug) => slug !== report.slug))} /> {report.title}</label>)}</fieldset>
        <button className="billing-primary-button" type="submit" disabled={busy}><UserPlus size={16} /> Dar acceso</button>
        {formError && <p className="admin-form-error" role="alert">{formError}</p>}
      </form>
    </section>

    <section className="billing-panel admin-table-panel"><div className="billing-table-heading"><div><span className="billing-panel-kicker">USUARIOS</span><h2>Permisos por usuario</h2><p>{rows.length} usuarios · {pendingCount} pendientes de acceso</p></div></div>
      <div className="admin-toolbar">
        <div className="billing-tabs" role="tablist">{(["todos", "pendientes", "administradores"] as View[]).map((option) => <button key={option} type="button" role="tab" aria-selected={view === option} className={view === option ? "active" : ""} onClick={() => setView(option)}>{option === "todos" ? "Todos" : option === "pendientes" ? "Pendientes" : "Administradores"}{option === "pendientes" && pendingCount > 0 && <span>{pendingCount}</span>}</button>)}</div>
        <label className="admin-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar por nombre o correo" /></label>
      </div>
      <div className="billing-table-scroll"><table className="billing-data-table admin-table"><thead><tr><th>Usuario</th><th>Último ingreso</th>{reports.map((report) => <th key={report.slug} className="align-center">{report.title}</th>)}<th className="align-center">Administrador</th><th aria-label="Acciones" /></tr></thead><tbody>
        {loading && !rows.length ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={reports.length + 4}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>)
          : visibleRows.length ? visibleRows.map((row) => <tr key={row.email}>
            <td><span className="billing-group-cell">{row.name || row.email}{row.email === currentEmail ? " (tú)" : ""}</span><small>{row.name ? row.email : ""}</small><span className="admin-badges">{isPending(row) && <span className="admin-badge pending">Pendiente de acceso</span>}{row.isAdmin && <span className="admin-badge"><ShieldCheck size={12} /> Administrador</span>}{!row.hasLoggedIn && <span className="admin-badge muted">Sin ingresar</span>}</span></td>
            <td>{row.lastLogin ? formatDateTime(row.lastLogin) : "—"}</td>
            {reports.map((report) => <td key={report.slug} className="align-center"><label className="admin-check admin-check-cell" title={row.isAdmin ? "Los administradores ven todos los informes" : undefined}><input type="checkbox" checked={row.isAdmin || row.slugs.has(report.slug)} disabled={row.isAdmin || busy} onChange={() => void toggleReport(row, report.slug)} aria-label={`${report.title} para ${row.email}`} /></label></td>)}
            <td className="align-center"><label className="admin-check admin-check-cell"><input type="checkbox" checked={row.isAdmin} disabled={busy} onChange={() => toggleAdmin(row)} aria-label={`Administrador: ${row.email}`} /></label></td>
            <td>{row.slugs.size > 0 && <button type="button" className="billing-secondary-button small" disabled={busy} onClick={() => removeAllReports(row)}>Quitar informes</button>}</td>
          </tr>)
          : <tr><td colSpan={reports.length + 4} className="billing-table-state"><Search size={22} /><strong>No hay usuarios en esta vista</strong><span>{view === "pendientes" ? "Nadie está esperando acceso." : "Prueba con otra búsqueda o agrega un usuario por correo."}</span></td></tr>}
      </tbody></table></div>
    </section>

    <section className="billing-panel"><div className="billing-panel-heading"><div><span className="billing-panel-kicker">HISTORIAL</span><h2>Últimos cambios</h2></div></div>
      {audit.length ? <ol className="admin-audit">{audit.map((entry) => <li key={entry.id}><strong>{auditText(entry)}</strong> <span>a {entry.email}</span><small>{entry.actor === "sql" ? "Script inicial" : entry.actor} · {formatDateTime(entry.at)}</small></li>)}</ol> : <div className="billing-empty">{loading ? "Cargando…" : "Aún no hay cambios registrados."}</div>}
    </section>

    <footer className="billing-footer"><span>Los cambios aplican en la siguiente consulta del usuario.</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
