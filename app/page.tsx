"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Info,
  LayoutGrid,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import BrandPeak from "@/components/BrandPeak";
import { canViewReport, getUserAccess, type UserAccess } from "@/lib/auth/access";
import { reports } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";

const adminCard = {
  slug: "admin-permisos",
  title: "Administración de permisos",
  subtitle: "Quién puede ver cada informe",
  href: "/admin/permisos",
  icon: ShieldCheck,
  type: "ADMINISTRACIÓN",
};

export default function HomePage() {
  const [userName, setUserName] = useState("Usuario Firplak");
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // El middleware redirige aquí con ?acceso=denegado cuando falta el permiso de un informe.
    setAccessDenied(new URLSearchParams(window.location.search).get("acceso") === "denegado");
    supabase.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email ?? "";
      setUserName(
        data.user?.user_metadata?.full_name ??
          data.user?.user_metadata?.name ??
          (email.split("@")[0] || "Usuario Firplak"),
      );
      try {
        setAccess(await getUserAccess(supabase, email));
      } catch {
        setAccessError(true);
      }
    });
  }, [supabase]);

  const accessCards = useMemo(() => {
    if (!access) return [];
    const reportCards = reports
      .filter((report) => canViewReport(access, report.slug))
      .map((report) => ({ ...report, type: "BUSINESS INTELLIGENCE" }));
    return access.isAdmin ? [...reportCards, adminCard] : reportCards;
  }, [access]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <div className="portal-brand-lockup">
            <Image
              className="brand-logo"
              src="/brand/firplak-wordmark-positivo.png"
              alt="Firplak"
              width={536}
              height={82}
              priority
            />
          </div>
          <div className="portal-brand-subtitle">Portal de indicadores</div>
        </div>

        <div className="portal-welcome">
          <span>&iexcl;Bienvenido!</span>
          <strong>{userName}</strong>
        </div>

        <button className="portal-logout" onClick={handleSignOut}>
          <LogOut size={18} />
          Salir
        </button>
      </header>

      <section className="portal-content">
        <div className="portal-intro">
          <BrandPeak className="brand-peak portal-peak" />
          <div>
            <div className="portal-eyebrow"><BarChart3 size={15} /> ESPACIO DE TRABAJO</div>
            <h1>Aplicaciones disponibles</h1>
            <p>Selecciona una plataforma para continuar.</p>
          </div>
        </div>

        <section className="portal-apps-section" aria-labelledby="apps-heading">
          <div className="portal-section-heading">
            <div className="portal-section-kicker"><LayoutGrid size={15} /> CENTRO DE INDICADORES</div>
            <h2 id="apps-heading">Mis accesos</h2>
          </div>

          {accessDenied && <p className="portal-notice" role="alert"><Info size={16} /> No tienes acceso a ese informe. Si lo necesitas, pide el permiso a un administrador.</p>}
          {accessError && <p className="portal-notice" role="alert"><Info size={16} /> No fue posible cargar tus permisos. Recarga la p&aacute;gina; si el problema sigue, avisa a un administrador.</p>}
          {access && !accessCards.length && <p className="portal-notice"><Info size={16} /> A&uacute;n no tienes informes asignados. Pide acceso a un administrador.</p>}

          <div className="access-grid" aria-label="Accesos habilitados" aria-busy={!access && !accessError}>
            {accessCards.map(({ slug, title, subtitle, href, icon: Icon, type }) => (
              <Link className="access-card" href={href} key={slug}>
                <div className="access-icon"><Icon size={40} strokeWidth={1.75} /></div>
                <div className="access-card-copy">
                  <span className="access-type">{type}</span>
                  <h2>{title}</h2>
                  <p>{subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>


        <footer className="portal-footer">
          <span>&copy; 2026 Firplak &middot; Portal interno</span>
        </footer>
      </section>
    </main>
  );
}
