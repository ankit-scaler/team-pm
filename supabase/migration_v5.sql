-- =============================================================
--  Team PM — Migration v5  (program + track)
--  Run in Supabase: SQL Editor > New query > paste > Run
-- =============================================================

alter table public.tasks
  add column if not exists program text,
  add column if not exists track text;

create index if not exists tasks_program_idx on public.tasks (program);
create index if not exists tasks_track_idx on public.tasks (track);
