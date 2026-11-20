-- Metas comerciales: la meta de Firplak se divide en Firplak Nacional y Firplak Exterior.
-- Ejecutar una sola vez en el editor SQL de Supabase, después de 20261109_metas_comerciales.sql y ANTES de desplegar
-- el portal que muestra los segmentos nuevos.
-- Decisión del desarrollador (2026-11-09) y reglas del filtro en llm-wiki/bi/facturacion-diaria.md.
--
-- commercial_targets.company guarda el segmento de la meta: 'Firplak Nacional', 'Firplak Exterior', 'Viventta' o 'CEFI'.
-- Las metas ya guardadas como 'Firplak' pasan a 'Firplak Nacional' (revisarlas y repartir la parte de Exterior).

begin;

alter table public.commercial_targets drop constraint if exists commercial_targets_company_check;

-- Si ya existe la meta Nacional del mismo mes, la de 'Firplak' se suma a ella; si no, se renombra.
update public.commercial_targets n
set billing_target = n.billing_target + f.billing_target,
    delivery_target = n.delivery_target + f.delivery_target
from public.commercial_targets f
where f.company = 'Firplak' and n.company = 'Firplak Nacional' and n.year = f.year and n.month = f.month;

delete from public.commercial_targets f
where f.company = 'Firplak'
  and exists (select 1 from public.commercial_targets n where n.company = 'Firplak Nacional' and n.year = f.year and n.month = f.month);

update public.commercial_targets set company = 'Firplak Nacional' where company = 'Firplak';

alter table public.commercial_targets add constraint commercial_targets_company_check
  check (company in ('Firplak Nacional', 'Firplak Exterior', 'Viventta', 'CEFI'));

commit;

-- Validación:
--   select company, count(*) from public.commercial_targets group by company;   -- no debe aparecer 'Firplak'
--
-- Rollback (vuelve a juntar Nacional y Exterior en 'Firplak'):
-- begin;
-- alter table public.commercial_targets drop constraint commercial_targets_company_check;
-- insert into public.commercial_targets (year, month, company, billing_target, delivery_target)
--   select year, month, 'Firplak', sum(billing_target), sum(delivery_target)
--   from public.commercial_targets where company in ('Firplak Nacional', 'Firplak Exterior') group by year, month;
-- delete from public.commercial_targets where company in ('Firplak Nacional', 'Firplak Exterior');
-- alter table public.commercial_targets add constraint commercial_targets_company_check check (company in ('Firplak', 'Viventta', 'CEFI'));
-- commit;
