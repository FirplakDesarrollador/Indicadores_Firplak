import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indicadores Firplak",
  description: "Centro de desempeño comercial y operativo de Firplak.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
