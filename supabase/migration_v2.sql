-- =============================================================
--  Team PM — Migration v2  (tags + admin)
--  Run this in Supabase: SQL Editor > New query > paste > Run
--  Safe to run on an existing project; it only adds things.
-- =============================================================

-- ---------- TAGS ----------
-- Tags are stored as a text array directly on the task. Autocomplete in the UI
-- is built from the distinct tags already used across all tasks, and you can
-- type a brand-new tag to create it on the spot.
alter table public.tasks
  add column if not exists tags text[] not null default '{}';

create index if not exists tasks_tags_idx on public.tasks using gin (tags);

-- ---------- ADMIN ----------
-- Everyone signs in as 'member'. Make yourself an admin so the Admin tab appears
-- and you can manage / remove users. Replace the email with YOUR login email:
update public.profiles set role = 'admin' where email = 'you@yourcompany.com';

-- (Repeat the line above for any other admins you want.)
