"use client";

import { BriefcaseBusiness, Plus } from "lucide-react";
import { groupReportsByArea, reports } from "@/lib/reports";
import type { Model } from "./permissions-model";

export default function RolesView({ model, loading, onOpen, onCreate }: { model: Model; loading: boolean; onOpen: (roleId: number) => void; onCreate: () => void }) {
  return <section className="billing-panel admin-table-panel">
    <div className="billing-table-heading admin-heading-actions"><div><span className="billing-panel-kicker">CARGOS</span><h2>Informes por cargo</h2><p>Cada persona tiene un cargo. Al cambiar los informes de un cargo, cambian para todas las personas que lo tienen.</p></div>
      <button type="button" className="billing-primary-button" onClick={onCreate}><Plus size={16} /> Nuevo cargo</button></div>
    <div className="billing-table-scroll"><table className="billing-data-table admin-table"><thead><tr><th>Cargo</th><th>Informes</th><th className="align-right">Personas</th></tr></thead><tbody>
      {loading && !model.roles.length ? <tr className="billing-skeleton-row"><td colSpan={3}><span className="billing-skeleton billing-skeleton-row-fill" /></td></tr>
        : model.roles.length ? model.roles.map((role) => {
          const groups = groupReportsByArea(reports.filter((report) => role.reports.has(report.slug)));
          return <tr key={role.id} tabIndex={0} onClick={() => onOpen(role.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(role.id); } }}>
            <td><span className="billing-group-cell">{role.name}</span>{role.description && <small>{role.description}</small>}</td>
            <td className="admin-wrap-cell"><span className="admin-badges">{groups.map((group) => <span key={group.id} className="admin-badge" title={group.items.map((item) => item.title).join(", ")}>{group.short}: {group.items.length}</span>)}</span></td>
            <td className="align-right number-cell">{role.members.length}</td>
          </tr>;
        })
        : <tr><td colSpan={3} className="billing-table-state"><BriefcaseBusiness size={22} /><strong>Aún no hay cargos</strong><span>Crea el primero, por ejemplo &quot;Director de ventas&quot;, y elige los informes que ve.</span></td></tr>}
    </tbody></table></div>
  </section>;
}
