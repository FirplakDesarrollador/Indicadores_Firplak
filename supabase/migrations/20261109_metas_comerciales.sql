-- Metas comerciales mensuales (facturación y entregas) por empresa y días laborales de cada mes.
-- Ejecutar una sola vez en el editor SQL de Supabase, después de 20261106_permisos_por_cargo.sql.
-- Ejecutar ANTES de desplegar el portal que la usa: /metas-comerciales y /facturacion-diaria leen estas tablas.
-- Diseño y decisiones: llm-wiki/bi/facturacion-diaria.md
--
-- - Una meta de facturación y una de entregas por mes y por empresa (Firplak, Viventta, CEFI).
-- - Los días laborales son por mes (no por empresa). El portal propone lunes a viernes menos festivos
--   de Colombia y quien edita puede corregir el número.
-- - Leen: quien ve facturacion-diaria o metas-comerciales. Escriben: quien tiene metas-comerciales (y administradores).
-- - Cada cambio queda en commercial_targets_audit con el valor anterior, el nuevo, quién y cuándo.

begin;

-- ── Permiso por informe para RLS ────────────────────────────────────────

create or replace function public.has_report_access(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce((public.current_user_access() -> 'report_slugs') ? p_slug, false)
$$;

revoke all on function public.has_report_access(text) from public, anon;
grant execute on function public.has_report_access(text) to authenticated;

-- ── Tablas ──────────────────────────────────────────────────────────────

create table if not exists public.commercial_targets (
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  company text not null check (company in ('Firplak', 'Viventta', 'CEFI')),
  billing_target numeric(18, 2) not null default 0 check (billing_target >= 0),
  delivery_target numeric(18, 2) not null default 0 check (delivery_target >= 0),
  updated_by text not null default public.current_email(),
  updated_at timestamptz not null default now(),
  primary key (year, month, company)
);

create table if not exists public.commercial_working_days (
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  working_days int not null check (working_days between 1 and 31),
  updated_by text not null default public.current_email(),
  updated_at timestamptz not null default now(),
  primary key (year, month)
);

create table if not exists public.commercial_targets_audit (
  id bigint generated always as identity primary key,
  table_name text not null,
  year int not null,
  month int not null,
  company text,
  old_values jsonb,
  new_values jsonb not null,
  actor text not null default public.current_email(),
  at timestamptz not null default now()
);

create index if not exists commercial_targets_audit_at_idx on public.commercial_targets_audit (at desc);

-- ── Quién y cuándo, e historial ─────────────────────────────────────────

create or replace function public.commercial_targets_stamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := public.current_email();
  new.updated_at := now();
  return new;
end;
$$;

-- security definer: el historial lo escribe el trigger; el navegador no tiene permiso de insertar en él.
create or replace function public.commercial_targets_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) - 'updated_by' - 'updated_at' end;
  v_new jsonb := to_jsonb(new) - 'updated_by' - 'updated_at';
begin
  -- Un guardado que no cambia valores no deja rastro.
  if v_old is not distinct from v_new then
    return new;
  end if;
  insert into public.commercial_targets_audit (table_name, year, month, company, old_values, new_values)
  values (tg_table_name, new.year, new.month, v_new ->> 'company', v_old, v_new);
  return new;
end;
$$;

drop trigger if exists commercial_targets_stamp on public.commercial_targets;
create trigger commercial_targets_stamp before insert or update on public.commercial_targets
  for each row execute function public.commercial_targets_stamp();
drop trigger if exists commercial_working_days_stamp on public.commercial_working_days;
create trigger commercial_working_days_stamp before insert or update on public.commercial_working_days
  for each row execute function public.commercial_targets_stamp();

drop trigger if exists commercial_targets_audit on public.commercial_targets;
create trigger commercial_targets_audit after insert or update on public.commercial_targets
  for each row execute function public.commercial_targets_audit_change();
drop trigger if exists commercial_working_days_audit on public.commercial_working_days;
create trigger commercial_working_days_audit after insert or update on public.commercial_working_days
  for each row execute function public.commercial_targets_audit_change();

-- ── Guardar un año completo en una transacción ──────────────────────────
-- p_months: arreglo de { month, working_days, targets: [{ company, billing_target, delivery_target }] }
-- security invoker: las políticas de RLS de abajo deciden si el usuario puede escribir.

create or replace function public.save_commercial_targets(p_year int, p_months jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_month jsonb;
  v_target jsonb;
begin
  if not public.has_report_access('metas-comerciales') then
    raise exception 'No tienes permiso para editar las metas comerciales.' using errcode = '42501';
  end if;

  for v_month in select * from jsonb_array_elements(coalesce(p_months, '[]'::jsonb)) loop
    if (v_month ->> 'working_days') is not null then
      insert into public.commercial_working_days (year, month, working_days)
      values (p_year, (v_month ->> 'month')::int, (v_month ->> 'working_days')::int)
      on conflict (year, month) do update set working_days = excluded.working_days;
    end if;

    for v_target in select * from jsonb_array_elements(coalesce(v_month -> 'targets', '[]'::jsonb)) loop
      insert into public.commercial_targets (year, month, company, billing_target, delivery_target)
      values (
        p_year,
        (v_month ->> 'month')::int,
        v_target ->> 'company',
        coalesce((v_target ->> 'billing_target')::numeric, 0),
        coalesce((v_target ->> 'delivery_target')::numeric, 0)
      )
      on conflict (year, month, company) do update
        set billing_target = excluded.billing_target, delivery_target = excluded.delivery_target;
    end loop;
  end loop;
end;
$$;

revoke all on function public.save_commercial_targets(int, jsonb) from public, anon;
grant execute on function public.save_commercial_targets(int, jsonb) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────

alter table public.commercial_targets enable row level security;
alter table public.commercial_working_days enable row level security;
alter table public.commercial_targets_audit enable row level security;

drop policy if exists commercial_targets_select on public.commercial_targets;
create policy commercial_targets_select on public.commercial_targets for select to authenticated
  using (public.has_report_access('facturacion-diaria') or public.has_report_access('metas-comerciales'));
drop policy if exists commercial_targets_insert on public.commercial_targets;
create policy commercial_targets_insert on public.commercial_targets for insert to authenticated
  with check (public.has_report_access('metas-comerciales'));
drop policy if exists commercial_targets_update on public.commercial_targets;
create policy commercial_targets_update on public.commercial_targets for update to authenticated
  using (public.has_report_access('metas-comerciales'))
  with check (public.has_report_access('metas-comerciales'));

drop policy if exists commercial_working_days_select on public.commercial_working_days;
create policy commercial_working_days_select on public.commercial_working_days for select to authenticated
  using (public.has_report_access('facturacion-diaria') or public.has_report_access('metas-comerciales'));
drop policy if exists commercial_working_days_insert on public.commercial_working_days;
create policy commercial_working_days_insert on public.commercial_working_days for insert to authenticated
  with check (public.has_report_access('metas-comerciales'));
drop policy if exists commercial_working_days_update on public.commercial_working_days;
create policy commercial_working_days_update on public.commercial_working_days for update to authenticated
  using (public.has_report_access('metas-comerciales'))
  with check (public.has_report_access('metas-comerciales'));

drop policy if exists commercial_targets_audit_select on public.commercial_targets_audit;
create policy commercial_targets_audit_select on public.commercial_targets_audit for select to authenticated
  using (public.has_report_access('metas-comerciales'));

grant select, insert, update on public.commercial_targets, public.commercial_working_days to authenticated;
grant select on public.commercial_targets_audit to authenticated;

commit;

-- Validación:
--   select public.has_report_access('metas-comerciales');
--   select * from public.commercial_targets order by year, month, company;
--   select * from public.commercial_targets_audit order by at desc limit 20;
--
-- Rollback (borra las metas guardadas):
-- begin;
-- drop table if exists public.commercial_targets_audit, public.commercial_targets, public.commercial_working_days;
-- drop function if exists public.save_commercial_targets(int, jsonb), public.commercial_targets_audit_change(),
--   public.commercial_targets_stamp(), public.has_report_access(text);
-- commit;
