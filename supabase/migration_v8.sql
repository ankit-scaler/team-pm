-- =============================================================
--  Team PM — migration v8
--  Adds status + ETA to adhoc requests so they appear on the Board
--  (in the column matching their status) and can be moved across stages.
--  Run in Supabase: SQL Editor > New query > paste > Run. Additive & idempotent.
-- =============================================================

alter table public.adhoc_requests
  add column if not exists status text not null default 'To pick'
    check (status in ('To pick', 'Working', 'In Review', 'Completed'));

alter table public.adhoc_requests
  add column if not exists eta date;

-- Let any signed-in team member move an adhoc card across stages on the Board.
drop policy if exists "adhoc updatable by authenticated" on public.adhoc_requests;
create policy "adhoc updatable by authenticated"
  on public.adhoc_requests for update to authenticated using (true) with check (true);
