"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronRight, Home, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import BrandPeak from "@/components/BrandPeak";
import type { DashboardNavGroup } from "@/lib/dashboard/navigation";
import { createClient } from "@/lib/supabase/client";

function initialsFrom(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? "").slice(0, 2);
  return initials.toUpperCase() || "FP";
}

// Estructura común de los dashboards: barra lateral con menú y perfil, barra superior y contenido.
export default function DashboardShell({ navigation, activeHref, title, className = "", overlay, children }: {
  navigation: DashboardNavGroup[];
  activeHref: string;
  title: string;
  className?: string;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [userProfile, setUserProfile] = useState({ name: "Usuario Firplak", email: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const name = data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? (email.split("@")[0] || "Usuario Firplak");
      setUserProfile({ name, email });
    });
  }, [supabase]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsSidebarOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.assign("/login"); };

  return <main className={`billing-shell ${className}`}>
    <div className={`billing-sidebar-backdrop ${isSidebarOpen ? "visible" : ""}`} onClick={() => setIsSidebarOpen(false)} />
    <aside className={`billing-sidebar ${isSidebarOpen ? "open" : ""}`}>
      <BrandPeak className="brand-peak billing-sidebar-peak" />
      <div className="billing-brand-row"><Image className="brand-logo" src="/brand/firplak-wordmark-negativo.png" alt="Firplak" width={536} height={82} priority /><button className="billing-close-menu" onClick={() => setIsSidebarOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
      <nav className="billing-nav" aria-label="Navegación de indicadores">{navigation.map((group, groupIndex) => <Fragment key={group.label}><span className={`billing-nav-label ${groupIndex > 0 ? "billing-nav-label-spaced" : ""}`}>{group.label}</span>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} className={`billing-nav-item ${href === activeHref ? "active" : ""}`} href={href}><Icon size={17} /> {label}</Link>)}</Fragment>)}</nav>
      <div className="billing-sidebar-bottom"><div className="billing-profile"><div className="billing-avatar" aria-hidden="true">{initialsFrom(userProfile.name)}</div><div><strong title={userProfile.name}>{userProfile.name}</strong><span title={userProfile.email}>{userProfile.email || "Sesión Microsoft 365"}</span></div><button onClick={handleSignOut} aria-label="Cerrar sesión"><LogOut size={15} /></button></div></div>
    </aside>

    <section className="billing-main"><header className="billing-topbar"><div className="billing-breadcrumbs"><button className="billing-mobile-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button><Home size={14} /><ChevronRight size={14} /><Link className="billing-breadcrumb-link" href="/">Indicadores</Link><ChevronRight size={14} /><strong>{title}</strong></div></header>
      <div className="billing-content">{children}</div></section>
    {overlay}
  </main>;
}
