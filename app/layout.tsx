import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import "./styles/login.css";
import "./styles/portal.css";
import "./styles/billing.css";
import "./styles/credit-notes.css";
import "./styles/product-cost.css";
import "./styles/targets.css";
import "./styles/admin.css";
import "./styles/user-menu.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "Portal de indicadores | Firplak",
  description: "Accesos a las plataformas de indicadores de Firplak.",
};

export const viewport: Viewport = {
  themeColor: "#324354",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
