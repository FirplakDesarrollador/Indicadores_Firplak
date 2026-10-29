import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal de indicadores | Firplak",
  description: "Accesos a las plataformas de indicadores de Firplak.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
