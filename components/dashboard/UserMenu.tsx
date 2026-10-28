"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import Link from "next/link";

// Perfil del usuario (nombre y correo). A los administradores les abre el acceso a la administración de permisos;
// a los demás se muestra sin menú, porque no tendría opciones.
export default function UserMenu({ isAdmin, variant, children }: {
  isAdmin: boolean;
  variant: "sidebar" | "header";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  if (!isAdmin) return <div className={`user-menu user-menu-${variant}`}><div className="user-menu-identity">{children}</div></div>;

  return <div className={`user-menu user-menu-${variant}`} ref={containerRef}>
    <button type="button" className="user-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Abrir menú del perfil" onClick={() => setOpen((value) => !value)}>
      <span className="user-menu-identity">{children}</span>
      <ChevronDown size={16} className="user-menu-chevron" aria-hidden="true" />
    </button>
    {open && <div className="user-menu-popover" role="menu">
      <Link role="menuitem" className="user-menu-item" href="/admin/permisos" onClick={() => setOpen(false)}><ShieldCheck size={16} /> Permisos de informes</Link>
    </div>}
  </div>;
}
