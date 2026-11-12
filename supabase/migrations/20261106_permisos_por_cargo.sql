-- Permisos por cargo y trazabilidad de cada cambio.
-- Ejecutar una sola vez en el editor SQL de Supabase, después de 20261027_permisos_informes.sql.
-- Ejecutar ANTES de desplegar el portal que la usa: el middleware lee public.current_user_access().
-- Diseño y decisiones: llm-wiki/concepts/security-and-secrets.md
--
-- - Un cargo por persona (user_job_roles). Cada cargo agrupa informes (job_role_reports).
-- - report_permissions se conserva para las excepciones individuales.
-- - Acceso efectivo = administrador, o informes del cargo, o excepciones.
-- - Todo cambio hecho desde el portal lleva su soporte (access_change_requests): medio (correo o tarea
--   de Planner), referencia, quién lo solicitó, quién lo aprobó. Quién lo hizo y cuándo los pone el servidor.
-- - El navegador ya no escribe en las tablas: todo pasa por public.apply_access_change(), en una transacción.

begin;

-- ── Cargos ──────────────────────────────────────────────────────────────

create table if not exists public.job_roles (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 2 and 80),
  description text check (description is null or length(description) <= 300),
  created_by text not null default public.current_email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_roles_name_key on public.job_roles (lower(trim(name)));

create table if not exists public.job_role_reports (
  role_id bigint not null references public.job_roles (id),
  report_slug text not null check (report_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  granted_by text not null default public.current_email(),
  granted_at timestamptz not null default now(),
  primary key (role_id, report_slug)
);

create index if not exists job_role_reports_slug_idx on public.job_role_reports (report_slug);

-- Un cargo por persona: el correo es la llave primaria.
create table if not exists public.user_job_roles (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  role_id bigint not null references public.job_roles (id),
  assigned_by text not null default public.current_email(),
  assigned_at timestamptz not null default now()
);

create index if not exists user_job_roles_role_idx on public.user_job_roles (role_id);

-- ── Soporte de cada cambio ──────────────────────────────────────────────

create table if not exists public.access_change_requests (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('correo', 'planner')),
  reference text not null check (length(trim(reference)) between 3 and 500),
  requested_by text not null check (requested_by = lower(requested_by) and requested_by ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  approved_by text not null check (length(trim(approved_by)) between 2 and 200),
  notes text check (notes is null or length(notes) <= 1000),
  created_by text not null default public.current_email(),
  created_at timestamptz not null default now(),
  -- La tarea de Planner se identifica por su enlace.
  constraint access_change_requests_planner_link check (channel <> 'planner' or reference ~* '^https://')
);

create index if not exists access_change_requests_created_idx on public.access_change_requests (created_at desc);

-- ── Historial ampliado ──────────────────────────────────────────────────

alter table public.permission_audit alter column email drop not null;
alter table public.permission_audit add column if not exists request_id bigint references public.access_change_requests (id);
alter table public.permission_audit add column if not exists role_id bigint;
alter table public.permission_audit add column if not exists role_name text;
alter table public.permission_audit add column if not exists detail text;
-- Personas que tenían el cargo cuando cambió su lista de informes: responde "¿quién podía ver X en tal fecha?".
alter table public.permission_audit add column if not exists affected_emails text[];

alter table public.permission_audit drop constraint if exists permission_audit_action_check;
alter table public.permission_audit add constraint permission_audit_action_check check (action in (
  'grant_report', 'revoke_report', 'grant_admin', 'revoke_admin',
  'assign_role', 'unassign_role',
  'create_role', 'update_role', 'delete_role', 'role_add_report', 'role_remove_report'
));

create index if not exists permission_audit_email_idx on public.permission_audit (email);
create index if not exists permission_audit_request_idx on public.permission_audit (request_id);

-- Los triggers escriben el historial. Desde el portal (sesión con correo) exigen el soporte de la transacción;
-- desde el editor SQL (sin sesión) el actor queda como 'sql'.
create or replace function public.audit_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(nullif(public.current_email(), ''), 'sql');
  v_request bigint := nullif(current_setting('app.access_request_id', true), '')::bigint;
  v_role_id bigint;
  v_role_name text;
  v_detail text;
  v_affected text[];
begin
  if v_request is null and v_actor <> 'sql' then
    raise exception 'Todo cambio de permisos necesita su soporte (correo o tarea de Planner).';
  end if;

  if tg_table_name = 'report_permissions' then
    insert into public.permission_audit (action, email, report_slug, actor, request_id)
    values (
      case when tg_op = 'INSERT' then 'grant_report' else 'revoke_report' end,
      coalesce(new.email, old.email), coalesce(new.report_slug, old.report_slug), v_actor, v_request
    );

  elsif tg_table_name = 'app_admins' then
    insert into public.permission_audit (action, email, actor, request_id)
    values (case when tg_op = 'INSERT' then 'grant_admin' else 'revoke_admin' end, coalesce(new.email, old.email), v_actor, v_request);

  elsif tg_table_name = 'user_job_roles' then
    if tg_op = 'UPDATE' and new.role_id = old.role_id then
      return new;
    end if;
    if tg_op = 'DELETE' then
      select name into v_role_name from public.job_roles where id = old.role_id;
      insert into public.permission_audit (action, email, role_id, role_name, actor, request_id)
      values ('unassign_role', old.email, old.role_id, v_role_name, v_actor, v_request);
    else
      select name into v_role_name from public.job_roles where id = new.role_id;
      if tg_op = 'UPDATE' then
        select 'Cargo anterior: ' || name into v_detail from public.job_roles where id = old.role_id;
      end if;
      insert into public.permission_audit (action, email, role_id, role_name, detail, actor, request_id)
      values ('assign_role', new.email, new.role_id, v_role_name, v_detail, v_actor, v_request);
    end if;

  elsif tg_table_name = 'job_role_reports' then
    v_role_id := coalesce(new.role_id, old.role_id);
    select name into v_role_name from public.job_roles where id = v_role_id;
    select coalesce(array_agg(email order by email), '{}') into v_affected from public.user_job_roles where role_id = v_role_id;
    insert into public.permission_audit (action, report_slug, role_id, role_name, affected_emails, actor, request_id)
    values (
      case when tg_op = 'INSERT' then 'role_add_report' else 'role_remove_report' end,
      coalesce(new.report_slug, old.report_slug), v_role_id, v_role_name, v_affected, v_actor, v_request
    );

  elsif tg_table_name = 'job_roles' then
    if tg_op = 'UPDATE' then
      if new.name is not distinct from old.name and new.description is not distinct from old.description then
        return new;
      end if;
      v_detail := case when new.name is distinct from old.name then 'Nombre anterior: ' || old.name else 'Cambió la descripción' end;
    end if;
    insert into public.permission_audit (action, role_id, role_name, detail, actor, request_id)
    values (
      case tg_op when 'INSERT' then 'create_role' when 'UPDATE' then 'update_role' else 'delete_role' end,
      coalesce(new.id, old.id), coalesce(new.name, old.name), v_detail, v_actor, v_request
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_job_roles_audit on public.user_job_roles;
create trigger user_job_roles_audit
  after insert or update or delete on public.user_job_roles
  for each row execute function public.audit_permission_change();

drop trigger if exists job_role_reports_audit on public.job_role_reports;
create trigger job_role_reports_audit
  after insert or delete on public.job_role_reports
  for each row execute function public.audit_permission_change();

drop trigger if exists job_roles_audit on public.job_roles;
create trigger job_roles_audit
  after insert or update or delete on public.job_roles
  for each row execute function public.audit_permission_change();

-- ── Acceso efectivo del usuario de la sesión ────────────────────────────

create or replace function public.current_user_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_admin', public.is_admin(),
    'role_name', (
      select r.name from public.user_job_roles u join public.job_roles r on r.id = u.role_id
      where u.email = public.current_email()
    ),
    'report_slugs', coalesce((
      select jsonb_agg(slug order by slug) from (
        select report_slug as slug from public.report_permissions where email = public.current_email()
        union
        select jr.report_slug from public.user_job_roles u join public.job_role_reports jr on jr.role_id = u.role_id
        where u.email = public.current_email()
      ) s
    ), '[]'::jsonb)
  )
$$;

-- ── Aplicar cambios con su soporte ──────────────────────────────────────
-- p_request: { channel, reference, requested_by, approved_by, notes }
-- p_changes: arreglo de { op, email?, report_slug?, role_id?, name?, description?, report_slugs?, emails? }
create or replace function public.apply_access_change(p_request jsonb, p_changes jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
  v_change jsonb;
  v_op text;
  v_email text;
  v_slug text;
  v_role_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar permisos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'No hay cambios para guardar.';
  end if;

  insert into public.access_change_requests (channel, reference, requested_by, approved_by, notes)
  values (
    p_request ->> 'channel',
    trim(p_request ->> 'reference'),
    lower(trim(p_request ->> 'requested_by')),
    trim(p_request ->> 'approved_by'),
    nullif(trim(coalesce(p_request ->> 'notes', '')), '')
  )
  returning id into v_request_id;

  -- Solo vive en esta transacción; los triggers lo leen para enlazar el historial.
  perform set_config('app.access_request_id', v_request_id::text, true);

  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_op := v_change ->> 'op';
    v_email := lower(trim(v_change ->> 'email'));
    v_slug := v_change ->> 'report_slug';
    v_role_id := (v_change ->> 'role_id')::bigint;

    case v_op
      when 'grant_report' then
        insert into public.report_permissions (email, report_slug) values (v_email, v_slug) on conflict do nothing;
      when 'revoke_report' then
        delete from public.report_permissions where email = v_email and report_slug = v_slug;
      when 'grant_admin' then
        insert into public.app_admins (email) values (v_email) on conflict do nothing;
      when 'revoke_admin' then
        delete from public.app_admins where email = v_email;
      when 'assign_role' then
        insert into public.user_job_roles (email, role_id) values (v_email, v_role_id)
        on conflict (email) do update set role_id = excluded.role_id, assigned_by = excluded.assigned_by, assigned_at = now()
        where public.user_job_roles.role_id <> excluded.role_id;
      when 'unassign_role' then
        delete from public.user_job_roles where email = v_email;
      when 'create_role' then
        insert into public.job_roles (name, description)
        values (trim(v_change ->> 'name'), nullif(trim(coalesce(v_change ->> 'description', '')), ''))
        returning id into v_role_id;
        insert into public.job_role_reports (role_id, report_slug)
        select v_role_id, value from jsonb_array_elements_text(coalesce(v_change -> 'report_slugs', '[]'::jsonb));
        insert into public.user_job_roles (email, role_id)
        select lower(trim(value)), v_role_id from jsonb_array_elements_text(coalesce(v_change -> 'emails', '[]'::jsonb))
        on conflict (email) do update set role_id = excluded.role_id, assigned_by = excluded.assigned_by, assigned_at = now();
      when 'update_role' then
        update public.job_roles
        set name = trim(v_change ->> 'name'), description = nullif(trim(coalesce(v_change ->> 'description', '')), ''), updated_at = now()
        where id = v_role_id;
      when 'role_add_report' then
        insert into public.job_role_reports (role_id, report_slug) values (v_role_id, v_slug) on conflict do nothing;
      when 'role_remove_report' then
        delete from public.job_role_reports where role_id = v_role_id and report_slug = v_slug;
      when 'delete_role' then
        if exists (select 1 from public.user_job_roles where role_id = v_role_id) then
          raise exception 'El cargo tiene personas asignadas: cámbialas de cargo antes de eliminarlo.';
        end if;
        delete from public.job_role_reports where role_id = v_role_id;
        delete from public.job_roles where id = v_role_id;
      else
        raise exception 'Cambio no reconocido: %', v_op;
    end case;
  end loop;

  return v_request_id;
end;
$$;

-- ── RLS y permisos ──────────────────────────────────────────────────────

alter table public.job_roles enable row level security;
alter table public.job_role_reports enable row level security;
alter table public.user_job_roles enable row level security;
alter table public.access_change_requests enable row level security;

drop policy if exists job_roles_select on public.job_roles;
create policy job_roles_select on public.job_roles for select to authenticated using (public.is_admin());
drop policy if exists job_role_reports_select on public.job_role_reports;
create policy job_role_reports_select on public.job_role_reports for select to authenticated using (public.is_admin());
drop policy if exists user_job_roles_select on public.user_job_roles;
create policy user_job_roles_select on public.user_job_roles for select to authenticated
  using (email = public.current_email() or public.is_admin());
drop policy if exists access_change_requests_select on public.access_change_requests;
create policy access_change_requests_select on public.access_change_requests for select to authenticated using (public.is_admin());

revoke all on public.job_roles, public.job_role_reports, public.user_job_roles, public.access_change_requests from anon;
grant select on public.job_roles, public.job_role_reports, public.user_job_roles, public.access_change_requests to authenticated;

-- Las escrituras directas desde el navegador quedan cerradas: solo apply_access_change().
revoke insert, delete on public.app_admins, public.report_permissions from authenticated;

revoke all on function public.apply_access_change(jsonb, jsonb) from public, anon;
grant execute on function public.apply_access_change(jsonb, jsonb) to authenticated;
revoke all on function public.current_user_access() from public, anon;
grant execute on function public.current_user_access() to authenticated;

commit;

-- Validación (solo lectura):
-- select * from public.current_user_access();                         -- con sesión; en el editor devuelve is_admin = false
-- select id, name, (select count(*) from public.user_job_roles u where u.role_id = r.id) as personas from public.job_roles r;
-- select a.at, a.action, a.email, a.role_name, a.report_slug, r.channel, r.reference, r.requested_by, r.approved_by
--   from public.permission_audit a left join public.access_change_requests r on r.id = a.request_id order by a.at desc limit 20;
--
-- Rollback (borra los cargos y los soportes; las excepciones y los administradores se conservan):
-- begin;
-- drop function if exists public.apply_access_change(jsonb, jsonb), public.current_user_access();
-- drop table if exists public.user_job_roles, public.job_role_reports, public.job_roles cascade;
-- alter table public.permission_audit drop column if exists request_id, drop column if exists role_id,
--   drop column if exists role_name, drop column if exists detail, drop column if exists affected_emails;
-- drop table if exists public.access_change_requests;
-- delete from public.permission_audit where email is null
--   or action not in ('grant_report', 'revoke_report', 'grant_admin', 'revoke_admin');
-- alter table public.permission_audit alter column email set not null;
-- alter table public.permission_audit drop constraint if exists permission_audit_action_check;
-- alter table public.permission_audit add constraint permission_audit_action_check
--   check (action in ('grant_report', 'revoke_report', 'grant_admin', 'revoke_admin'));
-- grant insert, delete on public.app_admins, public.report_permissions to authenticated;
-- -- Restaurar audit_permission_change() con la versión de 20261027_permisos_informes.sql.
-- commit;
-- Y volver a desplegar el portal anterior (el que escribe directo en las tablas).
