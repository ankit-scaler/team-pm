-- =============================================================
--  Team PM — migration v7
--  Adds: Google Calendar integration (Task 1), Slack adhoc requests (Task 3).
--  Run in Supabase: SQL Editor > New query > paste > Run.
-- =============================================================

-- ---------- Task 1: calendar block ----------
-- Store the Google Calendar event id we create for a task so we can update /
-- delete the block when the ETA changes or the task is removed.
alter table public.tasks
  add column if not exists calendar_event_id text;

-- Per-user Google refresh tokens (creator "connects" their calendar once).
-- Server-only: RLS is enabled with NO policies, so the anon/authenticated
-- clients can never read it. Only the service-role client (which bypasses RLS)
-- touches this table.
create table if not exists public.google_credentials (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text not null,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.google_credentials enable row level security;

-- ---------- Task 3: adhoc requests from Slack ----------
-- One row per adhoc request. Two sources:
--   'slack'  — posted by the Instructor-flow workflow into #instructor-adhoc-request-1,
--              written by the Slack events endpoint (service-role client).
--   'manual' — added by a team member via the "+ Adhoc" button in the app.
-- Readable by any signed-in team member; insertable by any signed-in member (manual).
create table if not exists public.adhoc_requests (
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'slack' check (source in ('slack', 'manual')),
  slack_ts          text unique,                 -- message ts; dedup key (null for manual)
  slack_channel     text,
  permalink         text,
  title             text,                        -- short label (manual entries / display)
  raised_by         text,
  program           text,
  batch             text,
  module            text,
  beneficiary       text,
  problem           text,
  learners_impact   text,
  risk_if_not_done  text,
  outcome           text,
  module_owner      text,
  stakeholder       text,
  raw               jsonb,                       -- full parsed field map (safety net)
  created_by        uuid references public.profiles (id) on delete set null,
  posted_at         timestamptz,                 -- when it was posted in Slack
  created_at        timestamptz not null default now()
);

create index if not exists adhoc_requests_created_idx
  on public.adhoc_requests (created_at desc);

alter table public.adhoc_requests enable row level security;

drop policy if exists "adhoc readable by authenticated" on public.adhoc_requests;
create policy "adhoc readable by authenticated"
  on public.adhoc_requests for select to authenticated using (true);
drop policy if exists "adhoc insertable by authenticated" on public.adhoc_requests;
create policy "adhoc insertable by authenticated"
  on public.adhoc_requests for insert to authenticated with check (true);
