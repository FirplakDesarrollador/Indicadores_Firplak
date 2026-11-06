"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { displayName, type UserRow } from "./permissions-model";

// "Esto afecta a N personas" con el botón para ver el detalle.
export default function PeopleList({ emails, userByEmail, label }: { emails: string[]; userByEmail: Map<string, UserRow>; label: string }) {
  const [open, setOpen] = useState(false);
  if (!emails.length) return null;
  return <div className="admin-impact">
    <div className="admin-impact-row">
      <Users size={16} />
      <span>{label.replace("{n}", String(emails.length)).replace("{s}", emails.length === 1 ? "" : "s")}</span>
      <button type="button" className="admin-link-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Ocultar" : "Ver personas"}</button>
    </div>
    {open && <ul className="admin-people">{emails.map((email) => {
      const user = userByEmail.get(email);
      return <li key={email}><strong>{displayName(user) || email}</strong>{user?.name && <small>{email}</small>}</li>;
    })}</ul>}
  </div>;
}
