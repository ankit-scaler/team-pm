-- =============================================================
--  Team PM — Migration v6  (dynamic KRs)
--  Run in Supabase: SQL Editor > New query > paste > Run
-- =============================================================

create table if not exists public.krs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  target      text not null default '',
  current     text not null default '',
  status      text not null default 'On track'
                check (status in ('On track', 'At risk', 'Behind', 'Achieved')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.krs enable row level security;

-- Everyone signed in can read KRs.
create policy "krs readable by authenticated"
  on public.krs for select to authenticated using (true);

-- Only admins can insert/update/delete.
-- This uses a subquery on profiles.role so it's enforced at the DB level,
-- not just the UI.
create policy "krs writable by admin"
  on public.krs for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Seed with starter KRs (safe to re-run — uses ON CONFLICT DO NOTHING on unique id).
-- Delete these from the UI if you don't want them.
insert into public.krs (name, target, current, status, sort_order) values
  ('Increase I2H by 10% across all programs', '10%', '—', 'On track', 1),
  ('Maintain NPS above 70 for all tracks', '70+', '—', 'On track', 2),
  ('Achieve 90% class rating across Academy', '90%', '—', 'At risk', 3),
  ('Launch 5 new modules in DSML track', '5', '—', 'On track', 4),
  ('Reduce cue card rating below-avg to < 5%', '< 5%', '—', 'Behind', 5),
  ('Complete PSP reviews for 100% of cohorts', '100%', '—', 'On track', 6);
