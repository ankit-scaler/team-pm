-- =============================================================
--  Team PM — migration v13
--  Adhoc requests get a metrics field (like tasks), so they feed the admin
--  program summary's per-person metric tally.
--  Run in Supabase: SQL Editor > New query > paste > Run. Additive & idempotent.
-- =============================================================

alter table public.adhoc_requests
  add column if not exists metrics text[] not null default '{}';
