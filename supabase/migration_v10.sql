-- =============================================================
--  Team PM — migration v10
--  Adhoc requests get a delivered_date that auto-stamps when they hit
--  'Completed' (mirrors how tasks work). Idempotent — safe to run repeatedly.
--  Run in Supabase: SQL Editor > New query > paste > Run.
-- =============================================================

alter table public.adhoc_requests
  add column if not exists delivered_date date;

-- Stamp delivered_date the first time an adhoc becomes Completed (on insert or update).
create or replace function public.handle_adhoc_update()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Completed' and new.delivered_date is null then
    new.delivered_date := current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists on_adhoc_updated on public.adhoc_requests;
create trigger on_adhoc_updated
  before insert or update on public.adhoc_requests
  for each row execute function public.handle_adhoc_update();
