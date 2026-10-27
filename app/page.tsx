"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  ChartNoAxesCombined,
  ExternalLink,
  LayoutGrid,
  LogOut,
  ReceiptText,
  TableProperties,
  Target,
  UsersRound,
} from "lucide-react";
import BrandPeak from "@/components/BrandPeak";
import { createClient } from "@/lib/supabase/client";

type PortalCard = {
  title: string;
  subtitle: string;
  icon: typeof BarChart3;
};

const accessCards = [
  {
    title: "Facturaci\u00f3n diaria",
    subtitle: "Indicadores comerciales y operativos",
    href: "/facturacion-diaria",
    icon: ReceiptText,
  },
];

const plannedCards: PortalCard[] = [
  { title: "Resumen comercial", subtitle: "Pr\u00f3ximamente", icon: BarChart3 },
  { title: "Detalle de documentos", subtitle: "Pr\u00f3ximamente", icon: TableProperties },
  { title: "Comparativos", subtitle: "Pr\u00f3ximamente", icon: ChartNoAxesCombined },
  { title: "Equipos y usuarios", subtitle: "Pr\u00f3ximamente", icon: UsersRound },
  { title: "Metas y cumplimiento", subtitle: "Pr\u00f3ximamente", icon: Target },
];

export default function HomePage() {
  const [userName, setUserName] = useState("Usuario Firplak");
  const [userEmail, setUserEmail] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      setUserEmail(email);
      setUserName(
        data.user?.user_metadata?.full_name ??
          data.user?.user_metadata?.name ??
          email.split("@")[0] ??
          "Usuario Firplak",
      );
    });
  }, [supabase]);

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
          <div className="portal-account">{userEmail || "Cuenta corporativa"}</div>
        </div>

        <section className="portal-apps-section" aria-labelledby="apps-heading">
          <div className="portal-section-heading">
            <div className="portal-section-kicker"><LayoutGrid size={15} /> CENTRO DE INDICADORES</div>
            <h2 id="apps-heading">Mis accesos</h2>
          </div>

          <div className="access-grid" aria-label="Accesos habilitados">
            {accessCards.map(({ title, subtitle, href, icon: Icon }) => (
              <Link className="access-card" href={href} key={href}>
                <div className="access-icon"><Icon size={40} strokeWidth={1.75} /></div>
                <div className="access-card-copy">
                  <span className="access-type">BUSINESS INTELLIGENCE</span>
                  <h2>{title}</h2>
                  <p>{subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="portal-services-section" aria-labelledby="planned-heading">
          <div className="portal-services-heading">
            <div className="empty-line" />
            <div className="empty-copy">
              <strong id="planned-heading">M&aacute;s aplicaciones pr&oacute;ximamente</strong>
              <span>Los m&oacute;dulos habilitados para tu perfil aparecer&aacute;n aqu&iacute;.</span>
            </div>
            <div className="empty-line" />
          </div>

          <div className="planned-grid">
            {plannedCards.map(({ title, subtitle, icon: Icon }) => (
              <article className="planned-card" key={title}>
                <div className="planned-icon"><Icon size={25} strokeWidth={1.8} /></div>
                <div className="planned-copy">
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="portal-footer">
          <span>&copy; 2026 Firplak &middot; Portal interno</span>
          <span><ExternalLink size={13} /> Accesos gestionados por tu organizaci&oacute;n</span>
        </footer>
      </section>
    </main>
  );
}
