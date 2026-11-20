import { reports } from "@/lib/reports";

// Filas tal como llegan de Supabase (supabase/migrations/20261106_permisos_por_cargo.sql).
export type AppUser = { email: string; full_name: string | null; last_login_at: string };
export type Role = { id: number; name: string; description: string | null };
export type RoleReport = { role_id: number; report_slug: string };
export type UserRole = { email: string; role_id: number };
export type ReportException = { email: string; report_slug: string };
export type ChangeRequest = {
  id: number;
  channel: SupportChannel;
  reference: string;
  requested_by: string;
  approved_by: string;
  notes: string | null;
  created_by: string;
  created_at: string;
};
export type AuditEntry = {
  id: number;
  action: string;
  email: string | null;
  report_slug: string | null;
  role_id: number | null;
  role_name: string | null;
  detail: string | null;
  affected_emails: string[] | null;
  actor: string;
  at: string;
  request: ChangeRequest | null;
};

export type PermissionData = {
  users: AppUser[];
  roles: Role[];
  roleReports: RoleReport[];
  userRoles: UserRole[];
  exceptions: ReportException[];
  admins: string[];
};

export type UserRow = {
  email: string;
  name: string;
  lastLogin: string;
  hasLoggedIn: boolean;
  isAdmin: boolean;
  roleId: number | null;
  exceptions: Set<string>;
  // Informes que ve por su cargo o por excepción (sin contar el rol de administrador).
  effective: Set<string>;
};

export type RoleRow = Role & { reports: Set<string>; members: string[] };

export type Model = { users: UserRow[]; roles: RoleRow[]; roleById: Map<number, RoleRow>; userByEmail: Map<string, UserRow> };

// Operaciones que entiende public.apply_access_change().
export type AccessChange =
  | { op: "grant_report" | "revoke_report"; email: string; report_slug: string }
  | { op: "grant_admin" | "revoke_admin"; email: string }
  | { op: "assign_role"; email: string; role_id: number }
  | { op: "unassign_role"; email: string }
  | { op: "create_role"; name: string; description: string; report_slugs: string[]; emails: string[] }
  | { op: "update_role"; role_id: number; name: string; description: string }
  | { op: "role_add_report" | "role_remove_report"; role_id: number; report_slug: string }
  | { op: "delete_role"; role_id: number };

// Lo que un panel entrega para pedir el soporte antes de guardar.
export type PendingChange = { title: string; changes: AccessChange[]; summary: string[]; affected: string[] };

export type SupportChannel = "correo" | "planner";
export type SupportRequest = { channel: SupportChannel; reference: string; requested_by: string; approved_by: string; notes: string };

export const channelLabels: Record<SupportChannel, string> = { correo: "Correo", planner: "Tarea de Planner" };

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const reportTitles = new Map(reports.map((report) => [report.slug, report.title]));
export const reportTitle = (slug: string | null) => (slug ? reportTitles.get(slug) ?? slug : "");

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

// Separa correos escritos o pegados con comas, punto y coma, espacios o saltos de línea.
export function parseEmails(value: string) {
  return Array.from(new Set(value.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean)));
}

export function buildModel(data: PermissionData): Model {
  const roleById = new Map<number, RoleRow>();
  for (const role of data.roles) roleById.set(role.id, { ...role, reports: new Set(), members: [] });
  for (const item of data.roleReports) roleById.get(item.role_id)?.reports.add(item.report_slug);

  const userByEmail = new Map<string, UserRow>();
  const ensure = (email: string) => {
    let row = userByEmail.get(email);
    if (!row) {
      row = { email, name: "", lastLogin: "", hasLoggedIn: false, isAdmin: false, roleId: null, exceptions: new Set(), effective: new Set() };
      userByEmail.set(email, row);
    }
    return row;
  };
  for (const user of data.users) Object.assign(ensure(user.email), { name: user.full_name ?? "", lastLogin: user.last_login_at, hasLoggedIn: true });
  for (const item of data.exceptions) ensure(item.email).exceptions.add(item.report_slug);
  for (const email of data.admins) ensure(email).isAdmin = true;
  for (const item of data.userRoles) {
    ensure(item.email).roleId = item.role_id;
    roleById.get(item.role_id)?.members.push(item.email);
  }

  for (const row of userByEmail.values()) {
    const roleReports = row.roleId ? roleById.get(row.roleId)?.reports : undefined;
    row.effective = new Set([...(roleReports ?? []), ...row.exceptions]);
  }

  const users = Array.from(userByEmail.values()).sort((a, b) => displayName(a).localeCompare(displayName(b), "es"));
  for (const role of roleById.values()) role.members.sort((a, b) => displayName(userByEmail.get(a)).localeCompare(displayName(userByEmail.get(b)), "es"));
  const roles = Array.from(roleById.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { users, roles, roleById, userByEmail };
}

export function displayName(row: { name: string; email: string } | undefined) {
  return row ? row.name || row.email : "";
}

// Sin rol de administrador, sin cargo y sin excepciones: inició sesión o fue invitado, pero no ve nada.
export function isPending(row: UserRow) {
  return !row.isAdmin && row.roleId === null && row.exceptions.size === 0;
}

export function auditText(entry: AuditEntry) {
  const report = reportTitle(entry.report_slug);
  const role = entry.role_name ?? "(cargo eliminado)";
  switch (entry.action) {
    case "grant_report": return `Excepción: dio acceso a ${report}`;
    case "revoke_report": return `Excepción: quitó el acceso a ${report}`;
    case "grant_admin": return "Dio el rol de administrador";
    case "revoke_admin": return "Quitó el rol de administrador";
    case "assign_role": return `Asignó el cargo ${role}`;
    case "unassign_role": return `Quitó el cargo ${role}`;
    case "create_role": return `Creó el cargo ${role}`;
    case "update_role": return `Editó el cargo ${role}`;
    case "delete_role": return `Eliminó el cargo ${role}`;
    case "role_add_report": return `Agregó ${report} al cargo ${role}`;
    case "role_remove_report": return `Quitó ${report} del cargo ${role}`;
    default: return entry.action;
  }
}

// A quién o a qué se aplicó el cambio, para la columna del historial.
export function auditTarget(entry: AuditEntry) {
  if (entry.email) return entry.email;
  if (entry.action.startsWith("role_")) return `${entry.affected_emails?.length ?? 0} personas con el cargo`;
  return "—";
}

export function actorLabel(actor: string) {
  return actor === "sql" ? "Script SQL" : actor;
}
