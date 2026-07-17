-- =============================================================
--  Team PM — migration v12
--  Adhoc requests get a real assignee (the Module Owner assigned to review it),
--  so they behave like tasks: shown with an assignee and filterable by person.
--  Run in Supabase: SQL Editor > New query > paste > Run. Additive & idempotent.
-- =============================================================

alter table public.adhoc_requests
  add column if not exists assignee_id uuid references public.profiles (id) on delete set null;

create index if not exists adhoc_requests_assignee_idx
  on public.adhoc_requests (assignee_id);
