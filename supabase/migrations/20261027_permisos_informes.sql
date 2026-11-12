-- Permisos por informe del portal de Indicadores.
-- Ejecutar una sola vez en el editor SQL de Supabase (proyecto del portal).
-- Diseño y decisiones: llm-wiki/concepts/security-and-secrets.md
--
-- - Un permiso por usuario y por informe (report_permissions). El catálogo de informes vive en lib/reports.ts.
-- - Los administradores (app_admins) ven todos los informes y administran permisos desde /admin/permisos.
-- - app_users registra a quien inicia sesión, para que el administrador vea a los pendientes de acceso.
-- - Las reglas se aplican con RLS sobre la sesión del usuario: no se necesita la clave de servicio.

begin;

-- Correo del usuario de la sesión, en minúsculas (Microsoft 365 vía Supabase Auth).
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create table if not exists public.app_users (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  full_name text,
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.app_admins (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  granted_by text not null default public.current_email(),
  granted_at timestamptz not null default now()
);

create table if not exists public.report_permissions (
  email text not null check (email = lower(email) and position('@' in email) > 1),
  report_slug text not null check (report_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  granted_by text not null default public.current_email(),
  granted_at timestamptz not null default now(),
  primary key (email, report_slug)
);

create table if not exists public.permission_audit (
  id bigint generated always as identity primary key,
  action text not null check (action in ('grant_report', 'revoke_report', 'grant_admin', 'revoke_admin')),
  email text not null,
  report_slug text,
  actor text not null,
  at timestamptz not null default now()
);

create index if not exists permission_audit_at_idx on public.permission_audit (at desc);

-- security definer: las políticas de app_admins consultan la propia tabla sin recursión de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where email = public.current_email())
$$;

-- Historial: lo escriben los triggers, nunca el navegador.
create or replace function public.audit_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'report_permissions' then
    insert into public.permission_audit (action, email, report_slug, actor)
    values (
      case when tg_op = 'INSERT' then 'grant_report' else 'revoke_report' end,
      coalesce(new.email, old.email),
      coalesce(new.report_slug, old.report_slug),
      coalesce(nullif(public.current_email(), ''), 'sql')
    );
  else
    insert into public.permission_audit (action, email, actor)
    values (
      case when tg_op = 'INSERT' then 'grant_admin' else 'revoke_admin' end,
      coalesce(new.email, old.email),
      coalesce(nullif(public.current_email(), ''), 'sql')
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists report_permissions_audit on public.report_permissions;
create trigger report_permissions_audit
  after insert or delete on public.report_permissions
  for each row execute function public.audit_permission_change();

drop trigger if exists app_admins_audit on public.app_admins;
create trigger app_admins_audit
  after insert or delete on public.app_admins
  for each row execute function public.audit_permission_change();

-- La página de permisos nunca puede quedar sin administrador.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.app_admins) <= 1 then
    raise exception 'No se puede quitar al último administrador.';
  end if;
  return old;
end;
$$;

drop trigger if exists app_admins_keep_one on public.app_admins;
create trigger app_admins_keep_one
  before delete on public.app_admins
  for each row execute function public.prevent_last_admin_removal();

-- RLS
alter table public.app_users enable row level security;
alter table public.app_admins enable row level security;
alter table public.report_permissions enable row level security;
alter table public.permission_audit enable row level security;

drop policy if exists app_users_select on public.app_users;
create policy app_users_select on public.app_users for select to authenticated
  using (email = public.current_email() or public.is_admin());
drop policy if exists app_users_insert_self on public.app_users;
create policy app_users_insert_self on public.app_users for insert to authenticated
  with check (email = public.current_email());
drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users for update to authenticated
  using (email = public.current_email()) with check (email = public.current_email());

drop policy if exists app_admins_select on public.app_admins;
create policy app_admins_select on public.app_admins for select to authenticated
  using (email = public.current_email() or public.is_admin());
drop policy if exists app_admins_insert on public.app_admins;
create policy app_admins_insert on public.app_admins for insert to authenticated
  with check (public.is_admin());
drop policy if exists app_admins_delete on public.app_admins;
create policy app_admins_delete on public.app_admins for delete to authenticated
  using (public.is_admin());

drop policy if exists report_permissions_select on public.report_permissions;
create policy report_permissions_select on public.report_permissions for select to authenticated
  using (email = public.current_email() or public.is_admin());
drop policy if exists report_permissions_insert on public.report_permissions;
create policy report_permissions_insert on public.report_permissions for insert to authenticated
  with check (public.is_admin());
drop policy if exists report_permissions_delete on public.report_permissions;
create policy report_permissions_delete on public.report_permissions for delete to authenticated
  using (public.is_admin());

drop policy if exists permission_audit_select on public.permission_audit;
create policy permission_audit_select on public.permission_audit for select to authenticated
  using (public.is_admin());

revoke all on public.app_users, public.app_admins, public.report_permissions, public.permission_audit from anon;
grant select, insert, update on public.app_users to authenticated;
grant select, insert, delete on public.app_admins, public.report_permissions to authenticated;
grant select on public.permission_audit to authenticated;

-- Administradores iniciales (decisión del 2026-10-27).
insert into public.app_admins (email, granted_by) values
  ('analista.desarrollador@firplak.com', 'sql'),
  ('daniel.jimenez@firplak.com', 'sql'),
  ('milton.rendon@firplak.com', 'sql'),
  ('analista2.desarrollo@firplak.com', 'sql'),
  ('alejandro.isaza@firplak.com', 'sql'),
  ('ismael.correa@firplak.com', 'sql')
on conflict (email) do nothing;

commit;

-- Validación (solo lectura):
-- select email, granted_at from public.app_admins order by email;
-- select * from public.permission_audit order by at desc limit 10;
--
-- Rollback (borra todos los permisos):
-- drop table if exists public.permission_audit, public.report_permissions, public.app_admins, public.app_users cascade;
-- drop function if exists public.audit_permission_change(), public.prevent_last_admin_removal(), public.is_admin(), public.current_email();
