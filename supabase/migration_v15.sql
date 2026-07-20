-- Team PM — migration v15 (KRs become admin-managed, shared for everyone)
--
-- KRs were a hard-coded array in app/(app)/krs/page.tsx. This moves them into a
-- table so admins can add/remove them live. Seeded with the existing content so
-- nothing is lost. Read by everyone; writes go through admin-guarded server
-- actions using the service-role client (no client write policy).

create table if not exists public.krs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  valid_for   text not null default 'Instructor Team',
  metric_type text not null default 'Leading' check (metric_type in ('Leading', 'Lagging')),
  section     text not null default 'kr' check (section in ('kr', 'good-practice')),
  points      text[] not null default '{}',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.krs enable row level security;

drop policy if exists krs_read on public.krs;
create policy krs_read on public.krs
  for select to authenticated using (true);

-- Seed the current KRs (only if the table is empty, so re-running is safe).
insert into public.krs (code, name, valid_for, metric_type, section, points, position)
select * from (values
  ('KR 1', 'Module Ratings', 'Instructor Team', 'Leading', 'kr', array[
    $$Module ratings should primarily reflect content quality and learning experience and should be evaluated separately from RI delivery impact.$$,
    $$Evaluation should account for: Script quality, Assignment quality, Contest quality, AI assignment additions and integrations, Overall module flow and coherence.$$,
    $$RI delivery impact should be handled through a separate improvement mechanism: Low RI ratings → Feedback → Training → Re-delivery → Re-evaluation.$$,
    $$Average module ratings should be maintained in the range of 4.7–4.8.$$,
    $$Introduce an incremental improvement tracking system to compare module performance against older batches and measure the impact of improvements.$$,
    $$Module completion metrics should clearly define whether completion is considered before Shivank's final approval or after final review and closure.$$,
    $$Additional metric: % of modules delivered within timelines after complete review and QA.$$
  ], 10),
  ('KR 1a', 'Retention in Class', 'Instructor Team', 'Leading', 'kr', array[
    $$Learner retention should measure how consistently learners attend classes throughout the module lifecycle.$$,
    $$Strong content quality and learning flow should directly contribute towards improved learner consistency and attendance.$$,
    $$Factors affecting retention should be normalized before evaluation: Same number of classes across comparisons, RI impact to be isolated from content evaluation, Batch timing variations to be considered separately.$$,
    $$Average attendance should not decrease due to content quality or poor learning flow.$$,
    $$Build a structured learner feedback tagging system through a dedicated POC/agent to classify feedback into: Technical difficulty, Poor flow, Pace issues, Assignment difficulty, Lack of engagement, Delivery concerns.$$
  ], 20),
  ('KR 3', 'ETA / TAT of Deliverables', 'Instructor Team', 'Leading', 'kr', array[
    $$Library-level or module-level changes should have clearly defined extended TATs compared to smaller operational changes.$$,
    $$Introduce a structured review cycle for older content within a rolling 15–60 day review window.$$,
    $$Content reviews and quality improvements should not be solely dependent on RIs, especially when such reviews are not directly linked to their incentives.$$,
    $$Create a centralised ownership mechanism for: Script audits, Assignment audits, Contest reviews, AI integration checks.$$,
    $$Existing review workflows currently managed manually by RIs should gradually move toward structured review ownership.$$
  ], 30),
  ('KR 4', 'Instructor-led Cue Card Rating', 'Ankit Mishra', 'Leading', 'kr', array[
    $$Valid cue card feedback should be reviewed and approved by Module Owners before implementation.$$,
    $$Cue cards should be continuously updated based on: Learner confusion points, Instructor feedback, Script mismatches, Delivery gaps.$$,
    $$The primary objective should be to maintain minimal or zero low-rated cue cards.$$,
    $$Build periodic audits to ensure: Cue cards are aligned with scripts, Learning objectives are maintained, Delivery quality remains standardized across instructors.$$
  ], 40),
  ('KR 6', 'NPS', 'Instructor Team', 'Lagging', 'kr', array[
    $$NPS should be evaluated at a complete program level while isolating content-driven improvements separately. Overall program NPS should remain above 55.$$,
    $$Scaler 3.0 impact should be tracked through: Before vs. after Scaler 3.0 comparisons, Module-level sentiment tracking, Learning experience improvements.$$,
    $$Content-related feedback should be actively tagged and categorised into: Technical quality, Curriculum relevance, Content depth, AI integration quality, Assignment quality, Learning flow.$$,
    $$Cross-functional recommendations should be actively shared with relevant teams wherever trends are identified (e.g., Placement readiness gaps → Placement Team, Interview communication gaps → Program Team, Assignment overload → Curriculum Team).$$
  ], 60),
  ('KR 7', 'AI Judges', 'Instructor Team + Ankit', 'Leading', 'kr', array[
    $$Ensure all judges are thoroughly tested before rollout. Any implications mean we would be accountable for the learner experience.$$,
    $$Across all judges, move the adherence to 120 unique learners experiencing it.$$,
    $$Based on the feedback of various judges, we may also need to improvise the curriculum.$$
  ], 70),
  ('GP 1', 'AI-Native Curriculum Adoption', 'Instructor Team', 'Leading', 'good-practice', array[
    $$Track adoption and quality of AI-native additions across programs.$$,
    $$Ensure AI integrations are not treated as add-on modules but embedded into the learning journey.$$,
    $$Review: AI assignment quality, AI project relevance, AI interview preparedness, AI workflow integrations.$$,
    $$Periodically validate AI additions with industry experts (IEs).$$
  ], 80),
  ('GP 2', 'Content Improvement Velocity', 'Instructor Team', 'Leading', 'good-practice', array[
    $$Measure the speed and consistency of implementing validated content improvements.$$,
    $$Track: Time taken from issue identification to implementation, Number of validated improvements shipped monthly, Repeat issue reduction percentage.$$,
    $$The goal should be continuous incremental improvement across all programmes.$$
  ], 90)
) as seed(code, name, valid_for, metric_type, section, points, position)
where not exists (select 1 from public.krs);
