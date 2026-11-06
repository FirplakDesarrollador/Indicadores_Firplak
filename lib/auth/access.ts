import type { SupabaseClient } from "@supabase/supabase-js";

export type UserAccess = { isAdmin: boolean; roleName: string | null; reportSlugs: string[] };

// Permisos efectivos del usuario de la sesión: administrador, informes de su cargo y excepciones individuales.
// public.current_user_access() lee el correo del JWT, así que sirve en el navegador y en el servidor.
export async function getUserAccess(supabase: SupabaseClient): Promise<UserAccess> {
  const { data, error } = await supabase.rpc("current_user_access");
  if (error) throw error;
  const access = (data ?? {}) as { is_admin?: boolean; role_name?: string | null; report_slugs?: string[] };
  return {
    isAdmin: Boolean(access.is_admin),
    roleName: access.role_name ?? null,
    reportSlugs: access.report_slugs ?? [],
  };
}

// Los administradores ven todos los informes (decisión del 2026-10-27).
export function canViewReport(access: UserAccess, slug: string) {
  return access.isAdmin || access.reportSlugs.includes(slug);
}
