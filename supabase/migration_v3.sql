-- =============================================================
--  Team PM — Migration v3  (task links)
--  Run in Supabase: SQL Editor > New query > paste > Run
-- =============================================================

-- Optional per-task links: a Slack thread/message and a relevant sheet/doc.
alter table public.tasks
  add column if not exists slack_link text,
  add column if not exists sheet_link text;
