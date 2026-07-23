-- Team PM — migration v17
--   1. programs & tracks become admin-managed registries (were hard-coded).
--   2. tasks/adhoc gain eta_tbd so an ETA can be an explicit "to be decided".

-- ── Programs & tracks registries ─────────────────────────────
create table if not exists public.programs (
  name       text primary key,
  created_at timestamptz not null default now()
);
create table if not exists public.tracks (
  name       text primary key,
  created_at timestamptz not null default now()
);

alter table public.programs enable row level security;
alter table public.tracks enable row level security;

drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select to authenticated using (true);
drop policy if exists tracks_read on public.tracks;
create policy tracks_read on public.tracks for select to authenticated using (true);
-- Writes only via the service-role client in admin-guarded server actions.

insert into public.programs (name) values
  ('Academy'), ('DevOps'), ('AIML'), ('DSML')
on conflict (name) do nothing;

insert into public.tracks (name) values
  ('DSA'), ('Full Stack'), ('Backend'), ('Machine Learning'),
  ('Data Science'), ('Data Analytics'), ('DevOps'), ('FDE')
on conflict (name) do nothing;

-- ── ETA "to be decided" ──────────────────────────────────────
alter table public.tasks          add column if not exists eta_tbd boolean not null default false;
alter table public.adhoc_requests add column if not exists eta_tbd boolean not null default false;
