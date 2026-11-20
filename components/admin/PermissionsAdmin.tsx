"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, UserPlus } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { adminNavigation } from "@/lib/dashboard/navigation";
import { createClient } from "@/lib/supabase/client";
import AuditView from "./AuditView";
import GrantDialog from "./GrantDialog";
import ReportsView from "./ReportsView";
import RolePanel from "./RolePanel";
import RolesView from "./RolesView";
import SupportDialog from "./SupportDialog";
import UserPanel from "./UserPanel";
import UsersView from "./UsersView";
import { buildModel, type PendingChange, type PermissionData, type SupportRequest } from "./permissions-model";

type Tab = "usuarios" | "cargos" | "informes" | "historial";
const tabLabels: Record<Tab, string> = { usuarios: "Usuarios", cargos: "Cargos", informes: "Informes", historial: "Historial" };
const emptyData: PermissionData = { users: [], roles: [], roleReports: [], userRoles: [], exceptions: [], admins: [] };

// Administración de permisos: cargos, excepciones, administradores e historial con soporte.
// Diseño: llm-wiki/concepts/security-and-secrets.md · Tablas: supabase/migrations/20261106_permisos_por_cargo.sql
export default function PermissionsAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [currentEmail, setCurrentEmail] = useState("");
  const [data, setData] = useState<PermissionData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("usuarios");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditKey, setAuditKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<number | "new" | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      supabase.from("app_users").select("email, full_name, last_login_at"),
      supabase.from("job_roles").select("id, name, description"),
      supabase.from("job_role_reports").select("role_id, report_slug"),
      supabase.from("user_job_roles").select("email, role_id"),
      supabase.from("report_permissions").select("email, report_slug"),
      supabase.from("app_admins").select("email"),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(`No fue posible cargar los permisos: ${failed.error.message}`);
    } else {
      const [users, roles, roleReports, userRoles, exceptions, admins] = results.map((result) => result.data ?? []);
      setData({
        users: users as PermissionData["users"],
        roles: roles as PermissionData["roles"],
        roleReports: roleReports as PermissionData["roleReports"],
        userRoles: userRoles as PermissionData["userRoles"],
        exceptions: exceptions as PermissionData["exceptions"],
        admins: (admins as { email: string }[]).map((row) => row.email),
      });
      setError("");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: auth }) => setCurrentEmail((auth.user?.email ?? "").toLowerCase()));
    void loadData();
  }, [loadData, supabase]);

  const model = useMemo(() => buildModel(data), [data]);
  const userRow = selectedUser ? model.userByEmail.get(selectedUser) : undefined;
  const roleRow = typeof selectedRole === "number" ? model.roleById.get(selectedRole) ?? null : null;

  const openUser = useCallback((email: string) => { setSelectedRole(null); setSelectedUser(email); }, []);
  const showHistory = useCallback((email: string) => { setSelectedUser(null); setAuditSearch(email); setTab("historial"); }, []);
  const requestSupport = useCallback((change: PendingChange) => { setSaveError(""); setPending(change); }, []);

  const confirm = async (support: SupportRequest) => {
    if (!pending) return;
    setSaving(true);
    const { error: saveFailure } = await supabase.rpc("apply_access_change", { p_request: support, p_changes: pending.changes });
    setSaving(false);
    if (saveFailure) {
      setSaveError(`No se guardó el cambio: ${saveFailure.message}`);
      return;
    }
    setNotice(`Guardado: ${pending.title.charAt(0).toLowerCase()}${pending.title.slice(1)} (${pending.summary.length} cambio${pending.summary.length === 1 ? "" : "s"}).`);
    setPending(null);
    setSelectedUser(null);
    setSelectedRole(null);
    setGrantOpen(false);
    setAuditKey((value) => value + 1);
    await loadData();
  };

  const overlay = <>
    {userRow && <UserPanel key={userRow.email} user={userRow} model={model} currentEmail={currentEmail} onClose={() => setSelectedUser(null)} onSubmit={requestSupport} onShowHistory={showHistory} />}
    {selectedRole !== null && (selectedRole === "new" || roleRow) && <RolePanel key={String(selectedRole)} role={roleRow} model={model} onClose={() => setSelectedRole(null)} onSubmit={requestSupport} />}
    {grantOpen && <GrantDialog model={model} onClose={() => setGrantOpen(false)} onSubmit={requestSupport} />}
    {pending && <SupportDialog pending={pending} userByEmail={model.userByEmail} saving={saving} error={saveError} onCancel={() => setPending(null)} onConfirm={(support) => void confirm(support)} />}
  </>;

  return <DashboardShell navigation={adminNavigation} activeHref="/admin/permisos" title="Permisos de informes" className="admin-shell" overlay={overlay}>
    <div className="billing-heading-row"><div><div className="billing-eyebrow">CENTRO DE INDICADORES <span>·</span> ADMINISTRACIÓN</div><h1>Permisos de informes</h1><p>Cada persona ve los informes de su cargo y sus excepciones. Los administradores ven todos. Cada cambio queda registrado con su soporte.</p></div>
      <button type="button" className="billing-primary-button" onClick={() => setGrantOpen(true)} disabled={loading && !data.users.length}><UserPlus size={16} /> Dar acceso</button></div>

    {error && <div className="billing-alert"><Database size={16} /><span>{error}</span><button onClick={() => void loadData()}>Reintentar</button></div>}
    {notice && <p className="admin-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></p>}

    <div className="billing-tabs admin-main-tabs" role="tablist">{(Object.keys(tabLabels) as Tab[]).map((option) => <button key={option} type="button" role="tab" aria-selected={tab === option} className={tab === option ? "active" : ""} onClick={() => { setTab(option); if (option !== "historial") setAuditSearch(""); }}>{tabLabels[option]}</button>)}</div>

    {tab === "usuarios" && <UsersView model={model} loading={loading} currentEmail={currentEmail} onOpen={openUser} />}
    {tab === "cargos" && <RolesView model={model} loading={loading} onOpen={(id) => { setSelectedUser(null); setSelectedRole(id); }} onCreate={() => { setSelectedUser(null); setSelectedRole("new"); }} />}
    {tab === "informes" && <ReportsView model={model} onOpenUser={openUser} />}
    {tab === "historial" && <AuditView key={auditSearch} supabase={supabase} initialSearch={auditSearch} refreshKey={auditKey} />}

    <footer className="billing-footer"><span>Los cambios aplican en la siguiente consulta del usuario.</span><span>Firplak · Portal interno</span></footer>
  </DashboardShell>;
}
