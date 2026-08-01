-- Three things:
--   1. is_admin() was called unwrapped in every admin policy. Wrapping it in a
--      subquery lets the planner cache the result as an InitPlan instead of
--      re-evaluating per row — the same shape already used for
--      (select auth.uid()) everywhere else in this schema.
--   2. The admin write grant on tasks (20260712150000) reached every row,
--      including students' private manual to-dos. It is narrowed to the
--      definition-linked copies the admin sync actually touches, and the
--      now-subsumed "admin read" policy on the same table goes away.
--   3. Task rows still carrying pre-definition generated keys are stuck: nothing
--      regenerates those keys, and a non-null task_key makes the manual edit and
--      delete paths skip the row.
-- Policies cannot be altered in place, so each is dropped and recreated.

-- ------------------------------------------------------------- reference data

drop policy "admin write" on public.countries;
create policy "admin write" on public.countries
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy "admin write" on public.qualifications;
create policy "admin write" on public.qualifications
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- -------------------------------------------------------------------- rules

drop policy "public read non-draft" on public.rules;
create policy "public read non-draft" on public.rules
  for select using (status <> 'draft' or (select public.is_admin()));

drop policy "admin write" on public.rules;
create policy "admin write" on public.rules
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- ------------------------------------------------------------------ courses

drop policy "read approved or own" on public.courses;
create policy "read approved or own" on public.courses
  for select using (
    review_status = 'approved'
    or imported_by = (select auth.uid())
    or (select public.is_admin())
  );

drop policy "admin write" on public.courses;
create policy "admin write" on public.courses
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- ------------------------------------------------- user-owned tables (reads)

drop policy "admin read" on public.profiles;
create policy "admin read" on public.profiles
  for select using ((select public.is_admin()));

drop policy "admin read" on public.applications;
create policy "admin read" on public.applications
  for select using ((select public.is_admin()));

drop policy "read own" on public.answer_reports;
create policy "read own" on public.answer_reports
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy "admin update" on public.answer_reports;
create policy "admin update" on public.answer_reports
  for update using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy "assistant_messages read own" on public.assistant_messages;
create policy "assistant_messages read own" on public.assistant_messages
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy "admin read" on public.admin_audit_events;
create policy "admin read" on public.admin_audit_events
  for select using ((select public.is_admin()));

-- ------------------------------------------------------- assistant + courses

drop policy "kb_chunks admin write" on public.kb_chunks;
create policy "kb_chunks admin write" on public.kb_chunks
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy "admin manage course task definitions" on public.course_task_definitions;
create policy "admin manage course task definitions" on public.course_task_definitions
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy "admin manage course task source reviews" on public.course_task_source_reviews;
create policy "admin manage course task source reviews" on public.course_task_source_reviews
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- -------------------------------------------------------------------- tasks

-- "admin write" (for all) already subsumed "admin read" (for select) — policies
-- are OR'd, so is_admin() ran twice per row on every admin read. One policy
-- replaces both, and it only reaches rows the definition sync owns:
-- prepareCourseTaskDefinitionSync emits keys for definition-linked rows only,
-- so students' manual and rule-generated tasks are no longer admin-visible.
drop policy "admin read" on public.tasks;
drop policy "admin write" on public.tasks;
create policy "admin sync course task copies" on public.tasks
  for all
  using ((select public.is_admin()) and course_task_definition_id is not null)
  with check ((select public.is_admin()) and course_task_definition_id is not null);

-- Pre-definition generated course-task keys. Nothing produces app:<id>:submit or
-- app:<id>:req:<hash> any more, and a non-null task_key excludes the row from
-- updateManualTask/deleteManualTask — so these rows can be neither edited nor
-- deleted by the student who owns them. Hand them over as manual tasks.
update public.tasks
set task_key = null
where course_task_definition_id is null
  and (task_key like 'app:%:submit' or task_key like 'app:%:req:%');

-- Written on every generated task, never read. The rule id is already inside
-- task_key ('rule:<id>:step:<n>'), so no information is lost.
alter table public.tasks drop column generated_from_rule_id;
