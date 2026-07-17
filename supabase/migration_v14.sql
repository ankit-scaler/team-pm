-- Team PM — migration v14 (metrics registry: admins can add AND delete metrics)
--
-- Until now "metrics" were just free-text values living in tasks.metrics /
-- adhoc_requests.metrics arrays, with a hardcoded default list. That made
-- deletion impossible (a built-in metric would always reappear). This adds a
-- single source of truth so admins can add and remove metrics for real.

create table if not exists public.metrics (
  name       text primary key,
  created_at timestamptz not null default now()
);

alter table public.metrics enable row level security;

-- Everyone signed in can read the list (to populate pickers). Writes happen
-- only through the service-role client in admin-guarded server actions, so no
-- client insert/update/delete policy is granted.
drop policy if exists metrics_read on public.metrics;
create policy metrics_read on public.metrics
  for select to authenticated using (true);

-- Seed: the built-in defaults + everything already used on tasks/adhoc.
insert into public.metrics (name) values
  ('I2H'), ('NPS'), ('Class Ratings'), ('Cue Card Ratings'), ('Module Ratings'), ('PSP')
on conflict (name) do nothing;

insert into public.metrics (name)
select distinct m
from (
  select unnest(metrics) as m from public.tasks
  union all
  select unnest(metrics) as m from public.adhoc_requests
) s
where m is not null and m <> ''
on conflict (name) do nothing;

-- Delete a metric everywhere: from the registry AND from every task/adhoc that
-- carries it. Runs as owner (security definer); execute is restricted to the
-- service role so only our admin-guarded server action can call it.
create or replace function public.delete_metric(p_metric text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.metrics where name = p_metric;
  update public.tasks
     set metrics = array_remove(metrics, p_metric)
   where p_metric = any(metrics);
  update public.adhoc_requests
     set metrics = array_remove(metrics, p_metric)
   where p_metric = any(metrics);
end;
$$;

revoke execute on function public.delete_metric(text) from public, anon, authenticated;
grant execute on function public.delete_metric(text) to service_role;
