"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  FileMinus,
  LayoutGrid,
  LogOut,
  ReceiptText,
} from "lucide-react";
import BrandPeak from "@/components/BrandPeak";
import { createClient } from "@/lib/supabase/client";

const accessCards = [
  {
    title: "Facturaci\u00f3n diaria",
    subtitle: "Indicadores comerciales y operativos",
    href: "/facturacion-diaria",
    icon: ReceiptText,
  },
  {
    title: "Notas crédito",
    subtitle: "Notas crédito frente a la facturación y sus causas",
    href: "/notas-credito",
    icon: FileMinus,
  },
];

export default function HomePage() {
  const [userName, setUserName] = useState("Usuario Firplak");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      setUserName(
        data.user?.user_metadata?.full_name ??
          data.user?.user_metadata?.name ??
          (email.split("@")[0] || "Usuario Firplak"),
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


        <footer className="portal-footer">
          <span>&copy; 2026 Firplak &middot; Portal interno</span>
        </footer>
      </section>
    </main>
  );
}
