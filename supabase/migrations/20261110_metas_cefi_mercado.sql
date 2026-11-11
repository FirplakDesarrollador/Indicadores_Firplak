-- Metas comerciales: la meta de CEFI se divide en CEFI Nacional y CEFI Exterior, igual que Firplak.
-- Ejecutar una sola vez en el editor SQL de Supabase, después de 20261109_metas_nacional_exterior.sql y ANTES de
-- desplegar el portal que muestra los segmentos nuevos.
-- Decisión del desarrollador (2026-11-10): CEFI vende en Nacional y en Exterior y se filtra por mercado.
--
-- commercial_targets.company guarda el segmento: 'Firplak Nacional', 'Firplak Exterior', 'Viventta',
-- 'CEFI Nacional' o 'CEFI Exterior'. Las metas ya guardadas como 'CEFI' pasan a 'CEFI Nacional'
-- (revisarlas y repartir la parte de Exterior).

begin;

alter table public.commercial_targets drop constraint if exists commercial_targets_company_check;

-- Si ya existe la meta CEFI Nacional del mismo mes, la de 'CEFI' se suma a ella; si no, se renombra.
update public.commercial_targets n
set billing_target = n.billing_target + c.billing_target,
    delivery_target = n.delivery_target + c.delivery_target
from public.commercial_targets c
where c.company = 'CEFI' and n.company = 'CEFI Nacional' and n.year = c.year and n.month = c.month;

delete from public.commercial_targets c
where c.company = 'CEFI'
  and exists (select 1 from public.commercial_targets n where n.company = 'CEFI Nacional' and n.year = c.year and n.month = c.month);

update public.commercial_targets set company = 'CEFI Nacional' where company = 'CEFI';

alter table public.commercial_targets add constraint commercial_targets_company_check
  check (company in ('Firplak Nacional', 'Firplak Exterior', 'Viventta', 'CEFI Nacional', 'CEFI Exterior'));

commit;

-- Validación:
--   select company, count(*) from public.commercial_targets group by company;   -- no debe aparecer 'CEFI'
--
-- Rollback (vuelve a juntar CEFI Nacional y CEFI Exterior en 'CEFI'):
-- begin;
-- alter table public.commercial_targets drop constraint commercial_targets_company_check;
-- insert into public.commercial_targets (year, month, company, billing_target, delivery_target)
--   select year, month, 'CEFI', sum(billing_target), sum(delivery_target)
--   from public.commercial_targets where company in ('CEFI Nacional', 'CEFI Exterior') group by year, month;
-- delete from public.commercial_targets where company in ('CEFI Nacional', 'CEFI Exterior');
-- alter table public.commercial_targets add constraint commercial_targets_company_check
--   check (company in ('Firplak Nacional', 'Firplak Exterior', 'Viventta', 'CEFI'));
-- commit;
