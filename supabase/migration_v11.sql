-- =============================================================
--  Team PM — migration v11 (RBAC: roles + program scoping)
--  Adds per-program memberships so people are scoped to their program(s).
--  Run in Supabase: SQL Editor > New query > paste > Run. Idempotent.
--
--  Model:
--    profiles.role = 'admin' (global superuser) | 'member' (everyone else)
--    program_memberships(profile_id, program, role) — role 'mo' | 'user'
--    A member with NO memberships = pending (no access until assigned).
-- =============================================================

create table if not exists public.program_memberships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  program    text not null,
  role       text not null default 'user' check (role in ('mo', 'user')),
  created_at timestamptz not null default now(),
  primary key (profile_id, program)
);

create index if not exists program_memberships_profile_idx
  on public.program_memberships (profile_id);

alter table public.program_memberships enable row level security;

-- Readable by any signed-in member (needed for scoping + the management UI).
-- No client write policy: memberships are written only by the service-role
-- client inside admin/MO-guarded server actions.
drop policy if exists "memberships readable by authenticated" on public.program_memberships;
create policy "memberships readable by authenticated"
  on public.program_memberships for select to authenticated using (true);

-- -------------------------------------------------------------
-- Seed so current users keep access the moment scoping turns on:
-- give everyone a 'user' membership for every program they've already
-- been assigned to or created a task in.
-- -------------------------------------------------------------
insert into public.program_memberships (profile_id, program, role)
select distinct assignee_id, program, 'user'
from public.tasks
where assignee_id is not null and program is not null
on conflict (profile_id, program) do nothing;

insert into public.program_memberships (profile_id, program, role)
select distinct created_by, program, 'user'
from public.tasks
where created_by is not null and program is not null
on conflict (profile_id, program) do nothing;

-- -------------------------------------------------------------
-- Bootstrap at least one admin (edit the email if needed).
-- -------------------------------------------------------------
update public.profiles set role = 'admin' where email = 'riya.bhurse@scaler.com';
