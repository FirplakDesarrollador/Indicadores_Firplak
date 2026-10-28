import type { SupabaseClient } from "@supabase/supabase-js";

export type UserAccess = { isAdmin: boolean; reportSlugs: string[] };

// Permisos del usuario de la sesión. RLS solo devuelve sus propias filas, así que sirve en el navegador y en el servidor.
export async function getUserAccess(supabase: SupabaseClient, email: string): Promise<UserAccess> {
  const normalizedEmail = email.trim().toLowerCase();
  const [admins, permissions] = await Promise.all([
    supabase.from("app_admins").select("email").eq("email", normalizedEmail).maybeSingle(),
    supabase.from("report_permissions").select("report_slug").eq("email", normalizedEmail),
  ]);
  if (admins.error) throw admins.error;
  if (permissions.error) throw permissions.error;
  return {
    isAdmin: Boolean(admins.data),
    reportSlugs: (permissions.data ?? []).map((row) => row.report_slug as string),
  };
}

// Los administradores ven todos los informes (decisión del 2026-10-27).
export function canViewReport(access: UserAccess, slug: string) {
  return access.isAdmin || access.reportSlugs.includes(slug);
}
