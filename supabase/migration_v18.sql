-- Team PM — migration v18: tags, efforts, priorities become admin-managed lists.
-- (metrics, programs, tracks already have registries.) Status stays fixed.

-- ── Tags ─────────────────────────────────────────────────────
create table if not exists public.tags (
  name       text primary key,
  created_at timestamptz not null default now()
);
alter table public.tags enable row level security;
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select to authenticated using (true);

-- seed from tags already used on tasks
insert into public.tags (name)
select distinct t from (select unnest(tags) as t from public.tasks) s
where t is not null and t <> ''
on conflict (name) do nothing;

-- ── Efforts ──────────────────────────────────────────────────
create table if not exists public.efforts (
  name       text primary key,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.efforts enable row level security;
drop policy if exists efforts_read on public.efforts;
create policy efforts_read on public.efforts for select to authenticated using (true);
insert into public.efforts (name, position) values ('Low', 10), ('Med', 20), ('High', 30)
on conflict (name) do nothing;

-- ── Priorities ───────────────────────────────────────────────
create table if not exists public.priorities (
  name       text primary key,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.priorities enable row level security;
drop policy if exists priorities_read on public.priorities;
create policy priorities_read on public.priorities for select to authenticated using (true);
insert into public.priorities (name, position) values
  ('Low', 10), ('Medium', 20), ('High', 30), ('Urgent', 40)
on conflict (name) do nothing;

-- ── Drop the check constraints so new effort/priority values are allowed ──
alter table public.tasks drop constraint if exists tasks_effort_check;
alter table public.tasks drop constraint if exists tasks_priority_check;
