-- Team PM — migration v20: Teams
--   teams:        admin-created groups, each with a leader.
--   team_members: membership with a pending/accepted status. A person can be in
--                 many teams; the leader is auto-added as an accepted member.

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  leader_id  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending',   -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create index if not exists team_members_profile_idx on public.team_members (profile_id);
create index if not exists team_members_team_idx on public.team_members (team_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Everyone signed in can READ teams + memberships (needed for the join screen,
-- the org view and the board/tasks filter). All WRITES go through the
-- service-role client inside admin/leader-guarded server actions.
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated using (true);

drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated using (true);
