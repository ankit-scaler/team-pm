-- =============================================================
--  Team PM — migration v9
--  Lets adhoc requests create a Google Calendar block (like tasks): stores the
--  created event id so it can be updated/removed later.
--  Run in Supabase: SQL Editor > New query > paste > Run. Additive & idempotent.
-- =============================================================

alter table public.adhoc_requests
  add column if not exists calendar_event_id text;

-- Let signed-in team members delete adhoc requests from the UI.
create policy "adhoc deletable by authenticated"
  on public.adhoc_requests for delete to authenticated using (true);
