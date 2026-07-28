-- Team PM — migration v19: Metrics Impact tracker
--   metric_impacts: one row per (task, metric) capturing before/after impact.
--   impact_statuses: admin-managed status options (like the other registries).

create table if not exists public.metric_impacts (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks (id) on delete cascade,
  metric         text not null,
  metric_type    text,                       -- Leading | Lagging | Non-Tangible
  pre_label      text,
  pre_value      text,                       -- value can be non-numeric
  pre_desc       text,
  pre_updated_at timestamptz,                -- when the pre value was last written
  post_label     text,
  post_value     text,
  post_desc      text,
  post_updated_at timestamptz,              -- when the post value was last written
  status         text,                       -- an impact_statuses.name
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (task_id, metric)
);

alter table public.metric_impacts enable row level security;
drop policy if exists metric_impacts_read on public.metric_impacts;
create policy metric_impacts_read on public.metric_impacts
  for select to authenticated using (true);
-- Writes go through the service-role client in admin/MO-guarded server actions.

-- Admin-managed status options (Improved / Regression / Stable / To be updated).
create table if not exists public.impact_statuses (
  name       text primary key,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.impact_statuses enable row level security;
drop policy if exists impact_statuses_read on public.impact_statuses;
create policy impact_statuses_read on public.impact_statuses
  for select to authenticated using (true);

insert into public.impact_statuses (name, position) values
  ('Improved', 10), ('Regression', 20), ('Stable', 30), ('To be updated', 40)
on conflict (name) do nothing;
