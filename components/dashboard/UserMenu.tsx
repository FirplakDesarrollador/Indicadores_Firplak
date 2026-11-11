"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";

// Perfil del usuario (nombre y correo). Abre las herramientas de gestión que el usuario puede usar: permisos
// (administradores) y metas comerciales (informe metas-comerciales). Sin ninguna, se muestra sin menú.
export default function UserMenu({ isAdmin, canEditTargets = false, variant, children }: {
  isAdmin: boolean;
  canEditTargets?: boolean;
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

  if (!isAdmin && !canEditTargets) return <div className={`user-menu user-menu-${variant}`}><div className="user-menu-identity">{children}</div></div>;

  return <div className={`user-menu user-menu-${variant}`} ref={containerRef}>
    <button type="button" className="user-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Abrir menú del perfil" onClick={() => setOpen((value) => !value)}>
      <span className="user-menu-identity">{children}</span>
      <ChevronDown size={16} className="user-menu-chevron" aria-hidden="true" />
    </button>
    {open && <div className="user-menu-popover" role="menu">
      {isAdmin && <Link role="menuitem" className="user-menu-item" href="/admin/permisos" onClick={() => setOpen(false)}><ShieldCheck size={16} /> Permisos de informes</Link>}
      {canEditTargets && <Link role="menuitem" className="user-menu-item" href="/metas-comerciales" onClick={() => setOpen(false)}><Target size={16} /> Metas comerciales</Link>}
    </div>}
  </div>;
}
