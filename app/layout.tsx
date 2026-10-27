import type { Metadata, Viewport } from "next";
import { Jost, Montserrat } from "next/font/google";
import "./globals.css";
import "./styles/login.css";
import "./styles/portal.css";
import "./styles/billing.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-montserrat", display: "swap" });
const jost = Jost({ subsets: ["latin"], weight: ["300"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  title: "Portal de indicadores | Firplak",
  description: "Accesos a las plataformas de indicadores de Firplak.",
};

export const viewport: Viewport = {
  themeColor: "#324354",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
