-- Simplification pass: every piece of data keeps exactly one source of truth.
--   1. countries/qualifications become static catalogs in the checker code —
--      three countries and six boards were already hard-coded in the UI maps,
--      so the tables were a second copy.
--   2. checks.profile was buildProfile(checks.answers), stored; the result
--      page now derives it. answers becomes the single questionnaire store
--      (profiles.country_code was a third copy of one answer).
--   3. Audit rows keep what the audit log renders; the full old/new row
--      snapshots were written on every admin edit and never read.
--   4. course_task_source_reviews stored a diff that is recomputable from the
--      course facts and current definitions; the admin tasks view now shows
--      that diff live and the queue table goes.
--   5. Revision counters (tasks.definition_revision,
--      course_task_definitions.revision) were written and compared nowhere —
--      has_personal_edits/admin_change_state carry the whole state machine.

-- ------------------------------------------------ 1. reference data → code

drop table public.qualifications;
drop type public.qualification_level;
drop table public.countries cascade; -- drops the rules/kb_chunks/profiles FKs
alter table public.profiles drop column country_code;

-- --------------------------------------- 2. answers is the questionnaire

-- Pre-answers rows (before 20260705143000) and pre-IB-checker IB submissions
-- cannot be re-derived under the current answers schema; they are early test
-- checks with no claim path left.
delete from public.checks where answers is null;
delete from public.checks
  where answers ->> 'curriculumType' = 'ib' and not (answers ? 'ibFullDiploma');
-- The gceSchoolYears question was removed; the strict answers schema would
-- reject rows still carrying it.
update public.checks set answers = answers - 'gceSchoolYears'
  where answers ? 'gceSchoolYears';
update public.profiles set answers = answers - 'gceSchoolYears'
  where answers ? 'gceSchoolYears';

create or replace function public.claim_check(
  p_check_id uuid,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  check_row public.checks%rowtype;
  actor uuid := (select auth.uid());
begin
  if actor is null or p_token_hash is null then
    return false;
  end if;

  select * into check_row
  from public.checks
  where id = p_check_id
  for update;

  if check_row.id is null
    or check_row.owner_token_hash is null
    or check_row.owner_token_hash <> p_token_hash
    or (check_row.claimed_by is not null and check_row.claimed_by <> actor)
  then
    return false;
  end if;

  if check_row.claimed_by = actor then
    return true;
  end if;

  insert into public.profiles (user_id, answers)
  values (actor, check_row.answers)
  on conflict (user_id) do update
  set answers = excluded.answers;

  update public.checks
  set claimed_by = actor,
      claimed_at = now()
  where id = p_check_id;

  return true;
end;
$$;

alter table public.checks alter column answers set not null;
alter table public.checks drop column profile; -- column-level grant goes with it
grant select (answers) on table public.checks to anon, authenticated;

-- ------------------------------------------------------- 3. audit slimming

create or replace function public.audit_admin_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_key text;
begin
  if tg_table_name = 'rules' then
    status_key := 'status';
  elsif tg_table_name = 'courses' then
    status_key := 'review_status';
  else
    raise exception 'audit_admin_update is not configured for %.%', tg_table_schema, tg_table_name;
  end if;

  insert into public.admin_audit_events (
    actor_user_id, table_name, row_id, action, old_status, new_status
  ) values (
    auth.uid(), tg_table_name, new.id, lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) ->> status_key else null end,
    to_jsonb(new) ->> status_key
  );
  return new;
end;
$$;

create or replace function public.audit_course_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_events (
    actor_user_id, table_name, row_id, action, old_status, new_status
  ) values (
    auth.uid(), tg_table_name, new.id, lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) ->> 'status' else null end,
    coalesce(to_jsonb(new) ->> 'status', to_jsonb(new) ->> 'retired_at', 'active')
  );
  return new;
end;
$$;

alter table public.admin_audit_events
  drop column old_row,
  drop column new_row;

-- ------------------------------------------- 4. insert-only answer reports

drop trigger set_updated_at on public.answer_reports;
drop policy "admin update" on public.answer_reports;
alter table public.answer_reports
  drop column status,
  drop column updated_at;

alter table public.applications drop column notes;

-- ------------------------------------------------------ 5. one review queue

drop table public.course_task_source_reviews;
drop type public.course_task_source_change;
drop type public.course_task_source_review_status;

-- -------------------------------------------------- 6. revision counters

alter table public.tasks drop column definition_revision;
alter table public.course_task_definitions drop column revision;
