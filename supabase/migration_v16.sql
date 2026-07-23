-- Team PM — migration v16 (admin activity log)
--
-- Append-only record of who did what. Written by server actions via the
-- service-role client; read only by the admin Activity page (also service-role,
-- behind an admin redirect). RLS is enabled with NO policies, so regular
-- clients can neither read nor write it.

create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_name   text not null default 'Someone',
  action       text not null,            -- created | updated | deleted | moved
  entity_type  text not null,            -- task | adhoc | kr | metric | membership | role | user
  entity_id    text,
  entity_label text,
  summary      text not null,
  program      text,
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;
-- No policies on purpose: only the service-role client touches this table.
