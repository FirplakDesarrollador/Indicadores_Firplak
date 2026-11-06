"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { groupReportsByArea, reports } from "@/lib/reports";
import { displayName, type Model } from "./permissions-model";

type Viewer = { email: string; via: string[] };

// Quién ve cada informe y por qué vía (cargo o excepción). Los administradores ven todos y no se listan.
export default function ReportsView({ model, onOpenUser }: { model: Model; onOpenUser: (email: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  const viewers = useMemo(() => {
    const bySlug = new Map<string, Viewer[]>();
    for (const report of reports) {
      const list: Viewer[] = [];
      for (const user of model.users) {
        if (user.isAdmin || !user.effective.has(report.slug)) continue;
        const via: string[] = [];
        const role = user.roleId ? model.roleById.get(user.roleId) : undefined;
        if (role?.reports.has(report.slug)) via.push(`Cargo ${role.name}`);
        if (user.exceptions.has(report.slug)) via.push("Excepción");
        list.push({ email: user.email, via });
      }
      bySlug.set(report.slug, list);
    }
    return bySlug;
  }, [model]);

  const adminCount = model.users.filter((user) => user.isAdmin).length;

  return <section className="billing-panel">
    <div className="billing-panel-heading"><div><span className="billing-panel-kicker">INFORMES</span><h2>Quién ve cada informe</h2><p className="admin-panel-note">Además, los {adminCount} administradores ven todos los informes.</p></div></div>
    {groupReportsByArea(reports).map((area) => <div key={area.id} className="admin-report-area">
      <h3 className="admin-area-title">{area.label}</h3>
      <ul className="admin-report-list">{area.items.map((report) => {
        const list = viewers.get(report.slug) ?? [];
        const roles = model.roles.filter((role) => role.reports.has(report.slug));
        const isOpen = open === report.slug;
        return <li key={report.slug}>
          <button type="button" className="admin-report-row" onClick={() => setOpen(isOpen ? null : report.slug)} aria-expanded={isOpen}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="admin-report-name"><strong>{report.title}</strong><small>{roles.length ? `Cargos: ${roles.map((role) => role.name).join(", ")}` : "Ningún cargo lo incluye"}</small></span>
            <span className="admin-count">{list.length} persona{list.length === 1 ? "" : "s"}</span>
          </button>
          {isOpen && (list.length ? <ul className="admin-people">{list.map((viewer) => {
            const user = model.userByEmail.get(viewer.email);
            return <li key={viewer.email}><button type="button" className="admin-person-button" onClick={() => onOpenUser(viewer.email)}><strong>{displayName(user)}</strong>{user?.name && <small>{viewer.email}</small>}</button><span className="admin-badges">{viewer.via.map((via) => <span key={via} className={`admin-badge ${via === "Excepción" ? "pending" : ""}`}>{via}</span>)}</span></li>;
          })}</ul> : <p className="admin-panel-note admin-indent">Solo los administradores ven este informe.</p>)}
        </li>;
      })}</ul>
    </div>)}
  </section>;
}
