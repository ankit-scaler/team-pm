-- Team PM — migration v21: once-per-day guard for the daily reminder digest.
--   reminder_sends: one row per calendar day the digest went out. The endpoint
--   sends only if today's row is absent, so the scheduled cron sends its first
--   run of the day and any repeat/accidental hit no-ops — no reliance on a
--   fragile user-agent check.

create table if not exists public.reminder_sends (
  sent_on    date primary key,
  created_at timestamptz not null default now()
);

alter table public.reminder_sends enable row level security;
-- No client policy: only the service-role client (in the cron endpoint) touches
-- this table, and service-role bypasses RLS.
