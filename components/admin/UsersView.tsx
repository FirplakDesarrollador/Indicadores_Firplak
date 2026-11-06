"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/dashboard/format";
import { reports } from "@/lib/reports";
import { displayName, isPending, type Model, type UserRow } from "./permissions-model";

type Filter = "todos" | "pendientes" | "sin-cargo" | "administradores";
const filterLabels: Record<Filter, string> = { todos: "Todos", pendientes: "Pendientes", "sin-cargo": "Sin cargo", administradores: "Administradores" };

export default function UsersView({ model, loading, currentEmail, onOpen }: { model: Model; loading: boolean; currentEmail: string; onOpen: (email: string) => void }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [reportFilter, setReportFilter] = useState("");

  const counts = useMemo(() => ({
    pendientes: model.users.filter(isPending).length,
    "sin-cargo": model.users.filter((row) => !row.isAdmin && row.roleId === null).length,
  }), [model]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return model.users.filter((row) => {
      if (filter === "pendientes" && !isPending(row)) return false;
      if (filter === "sin-cargo" && (row.isAdmin || row.roleId !== null)) return false;
      if (filter === "administradores" && !row.isAdmin) return false;
      if (roleFilter && String(row.roleId ?? "") !== roleFilter) return false;
      if (reportFilter && !row.isAdmin && !row.effective.has(reportFilter)) return false;
      return !term || row.email.includes(term) || row.name.toLowerCase().includes(term);
    });
  }, [filter, model, reportFilter, roleFilter, search]);

  const reportCell = (row: UserRow) => {
    if (row.isAdmin) return <>Todos <small>Administrador</small></>;
    const roleReports = row.roleId ? model.roleById.get(row.roleId)?.reports : undefined;
    const extra = [...row.exceptions].filter((slug) => !roleReports?.has(slug)).length;
    return <>{row.effective.size} de {reports.length}{extra > 0 && <small>{extra} por excepción</small>}</>;
  };

  return <section className="billing-panel admin-table-panel">
    <div className="billing-table-heading"><div><span className="billing-panel-kicker">USUARIOS</span><h2>Quién ve qué</h2><p>{model.users.length} usuarios · {counts.pendientes} pendientes de acceso</p></div></div>
    <div className="admin-toolbar">
      <div className="billing-tabs" role="tablist">{(Object.keys(filterLabels) as Filter[]).map((option) => <button key={option} type="button" role="tab" aria-selected={filter === option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>{filterLabels[option]}{(option === "pendientes" || option === "sin-cargo") && counts[option] > 0 && <span>{counts[option]}</span>}</button>)}</div>
      <div className="admin-filters">
        <select className="admin-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filtrar por cargo"><option value="">Todos los cargos</option>{model.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
        <select className="admin-select" value={reportFilter} onChange={(event) => setReportFilter(event.target.value)} aria-label="Filtrar por informe"><option value="">Todos los informes</option>{reports.map((report) => <option key={report.slug} value={report.slug}>{report.title}</option>)}</select>
        <label className="admin-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar por nombre o correo" /></label>
      </div>
    </div>
    <div className="billing-table-scroll"><table className="billing-data-table admin-table"><thead><tr><th>Usuario</th><th>Cargo</th><th>Informes</th><th>Último ingreso</th></tr></thead><tbody>
      {loading && !model.users.length ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="billing-skeleton-row"><td colSpan={4}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>)
        : rows.length ? rows.map((row) => <tr key={row.email} tabIndex={0} onClick={() => onOpen(row.email)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(row.email); } }}>
          <td><span className="billing-group-cell">{displayName(row)}{row.email === currentEmail ? " (tú)" : ""}</span><small>{row.name ? row.email : ""}</small><span className="admin-badges">{isPending(row) && <span className="admin-badge pending">Pendiente de acceso</span>}{row.isAdmin && <span className="admin-badge"><ShieldCheck size={12} /> Administrador</span>}{!row.hasLoggedIn && <span className="admin-badge muted">Sin ingresar</span>}</span></td>
          <td>{row.roleId ? model.roleById.get(row.roleId)?.name : <span className="admin-muted">Sin cargo</span>}</td>
          <td>{reportCell(row)}</td>
          <td>{row.lastLogin ? formatDateTime(row.lastLogin) : "—"}</td>
        </tr>)
        : <tr><td colSpan={4} className="billing-table-state"><Search size={22} /><strong>No hay usuarios en esta vista</strong><span>{filter === "pendientes" ? "Nadie está esperando acceso." : "Prueba con otra búsqueda o da acceso a alguien nuevo."}</span></td></tr>}
    </tbody></table></div>
  </section>;
}
