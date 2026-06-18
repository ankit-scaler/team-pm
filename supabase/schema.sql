-- =============================================================
--  Team PM — Supabase schema
--  Run this in the Supabase dashboard:  SQL Editor > New query > paste > Run
-- =============================================================

-- ---------- PROFILES ----------
-- One row per signed-in user. Auto-created on first login via trigger below.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  created_at  timestamptz not null default now()
);

-- ---------- TASKS ----------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  eta            date,                         -- target / due date
  status         text not null default 'To pick'
                   check (status in ('To pick', 'Working', 'In Review', 'Completed')),
  effort         text check (effort in ('Low', 'Med', 'High')),
  priority       text not null default 'Medium'
                   check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  assignee_id    uuid references public.profiles (id) on delete set null,  -- who picked it
  created_by     uuid references public.profiles (id) on delete set null,
  picked_date    timestamptz,                  -- set automatically when status first -> Working
  delivered_date date,                          -- set automatically when status -> Completed (editable)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx   on public.tasks (status);

-- ---------- STAKEHOLDERS (many-to-many) ----------
create table if not exists public.task_stakeholders (
  task_id    uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, profile_id)
);

-- ---------- STATUS HISTORY (drives reporting + Slack) ----------
create table if not exists public.task_status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  old_status  text,
  new_status  text not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists history_task_idx on public.task_status_history (task_id);
create index if not exists history_changed_idx on public.task_status_history (changed_at);

-- =============================================================
--  TRIGGERS
-- =============================================================

-- Auto-create a profile when a new auth user signs up (Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh, auto-stamp picked_date / delivered_date on status change.
create or replace function public.handle_task_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  -- First time it moves into "Working", record when it was picked up.
  if new.status = 'Working' and old.picked_date is null then
    new.picked_date := now();
  end if;

  -- When completed, stamp the delivered date if the user didn't set one.
  if new.status = 'Completed' and new.delivered_date is null then
    new.delivered_date := current_date;
  end if;

  return new;
end;
$$;

drop trigger if exists on_task_updated on public.tasks;
create trigger on_task_updated
  before update on public.tasks
  for each row execute function public.handle_task_update();

-- Log every status change into history.
-- SECURITY DEFINER so the trigger can write to task_status_history, which has RLS
-- enabled with no client-facing INSERT policy (history is written only by this trigger).
create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, new.assignee_id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_status_logged on public.tasks;
create trigger on_task_status_logged
  after insert or update on public.tasks
  for each row execute function public.log_status_change();

-- =============================================================
--  ROW LEVEL SECURITY
--  Internal team tool: any authenticated team member can read/write tasks.
-- =============================================================
alter table public.profiles            enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_stakeholders   enable row level security;
alter table public.task_status_history enable row level security;

-- Profiles: everyone signed in can read the directory; you can update your own row.
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Tasks: full collaborative access for any signed-in team member.
create policy "tasks readable by authenticated"
  on public.tasks for select to authenticated using (true);
create policy "tasks insertable by authenticated"
  on public.tasks for insert to authenticated with check (true);
create policy "tasks updatable by authenticated"
  on public.tasks for update to authenticated using (true);
create policy "tasks deletable by authenticated"
  on public.tasks for delete to authenticated using (true);

-- Stakeholders
create policy "stakeholders readable by authenticated"
  on public.task_stakeholders for select to authenticated using (true);
create policy "stakeholders writable by authenticated"
  on public.task_stakeholders for all to authenticated using (true) with check (true);

-- History: read-only to clients (written by triggers under definer rights).
create policy "history readable by authenticated"
  on public.task_status_history for select to authenticated using (true);

-- Realtime: let the board live-update.
alter publication supabase_realtime add table public.tasks;
