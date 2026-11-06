"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

// Panel lateral (drawer) o diálogo centrado. Escape cierra; el foco entra al abrir.
export default function AdminOverlay({ variant, kicker, title, onClose, footer, children, layer = 0 }: {
  variant: "drawer" | "modal";
  kicker: string;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  // Un diálogo abierto sobre un panel usa layer 1.
  layer?: 0 | 1;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // Solo al abrir: enfocar el panel y escuchar Escape.
  useEffect(() => {
    ref.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Solo cierra la capa de arriba.
      const layers = document.querySelectorAll("[data-admin-layer]");
      if (layers[layers.length - 1] === ref.current) closeRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <>
    <button type="button" className={`billing-drawer-backdrop admin-backdrop layer-${layer}`} onClick={onClose} aria-label="Cerrar" tabIndex={-1} />
    <aside ref={ref} data-admin-layer className={`admin-overlay ${variant === "drawer" ? "billing-detail-drawer admin-drawer" : "admin-modal"} layer-${layer}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="billing-drawer-header"><div><span className="billing-panel-kicker">{kicker}</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <div className="admin-overlay-body">{children}</div>
      {footer && <div className="admin-overlay-footer">{footer}</div>}
    </aside>
  </>;
}
