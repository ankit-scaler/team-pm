-- =============================================================
--  Team PM — Migration v4  (metrics)
--  Run in Supabase: SQL Editor > New query > paste > Run
-- =============================================================

-- Metrics work just like tags: a text array on the task, with autocomplete
-- from a starter list plus anything anyone has typed before.
alter table public.tasks
  add column if not exists metrics text[] not null default '{}';

create index if not exists tasks_metrics_idx on public.tasks using gin (metrics);
