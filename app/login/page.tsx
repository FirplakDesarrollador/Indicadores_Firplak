"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const authErrorMessages: Record<string, string> = {
  missing_code: "No se recibió el código de autenticación. Intenta nuevamente.",
  auth_callback: "No fue posible completar el inicio de sesión. Intenta nuevamente.",
};

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.replace("/");
    });

    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) setErrorMessage(authErrorMessages[errorCode] ?? "Ocurrió un error de autenticación.");
  }, []);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");

    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo,
        scopes: "email",
      },
    });

    if (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
      return;
    }

    if (data.url) window.location.assign(data.url);
  };

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand-lockup"><div className="brand-mark"><span>F</span></div><div className="brand-name">firplak<span>.</span></div></div>
        <div className="login-brand-content">
          <div className="login-kicker"><BarChart3 size={15} /> CENTRO DE INDICADORES</div>
          <h1>Decisiones claras,<br /><em>datos en movimiento.</em></h1>
          <p>Una lectura unificada del desempeño comercial y operativo de Firplak.</p>
          <div className="login-points"><span><CheckCircle2 size={15} /> Información consolidada</span><span><CheckCircle2 size={15} /> Acceso seguro con Microsoft 365</span></div>
        </div>
        <div className="login-brand-footer">Firplak Colombia <span>·</span> Plataforma interna</div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-mark"><div className="brand-mark"><span>F</span></div></div>
          <div className="login-form-kicker">BIENVENIDO DE NUEVO</div>
          <h2>Ingresa a tu espacio</h2>
          <p className="login-description">Usa tu cuenta corporativa para consultar los indicadores de Firplak.</p>

          <button className="microsoft-button" onClick={handleMicrosoftLogin} disabled={isLoading}>
            <span className="microsoft-logo"><i /><i /><i /><i /></span>
            <span>{isLoading ? "Conectando con Microsoft…" : "Continuar con Microsoft 365"}</span>
            {!isLoading && <ArrowRight size={17} />}
          </button>

          {errorMessage && <div className="login-error" role="alert">{errorMessage}</div>}

          <div className="login-security"><ShieldCheck size={17} /><span>Autenticación administrada por Microsoft Entra ID.<br />Solo usuarios autorizados pueden acceder.</span></div>
          <p className="login-terms">Al continuar, aceptas las políticas internas de uso de la plataforma.</p>
        </div>
      </section>
    </main>
  );
}
