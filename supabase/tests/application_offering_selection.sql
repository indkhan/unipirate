-- Root-owned disposable DB ONLY, after applying reserved 00103. No live execution.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/application_offering_selection.sql <isolated connection>
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end; $$;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000701','proc-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000702','proc-other@example.invalid'),
 ('00000000-0000-4000-8000-000000000703','proc-admin@example.invalid');
insert into public.courses(id,source_url,normalized_url,review_status,imported_by) values
 ('00000000-0000-4000-8000-000000000710','https://example.invalid/proc-a','https://example.invalid/proc-a','approved','00000000-0000-4000-8000-000000000701'),
 ('00000000-0000-4000-8000-000000000711','https://example.invalid/proc-b','https://example.invalid/proc-b','approved','00000000-0000-4000-8000-000000000701');
insert into public.applications(id,user_id,course_id,status) values
 ('00000000-0000-4000-8000-000000000720','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000710','planning'),
 ('00000000-0000-4000-8000-000000000721','00000000-0000-4000-8000-000000000703','00000000-0000-4000-8000-000000000710','applied');
insert into public.tasks(id,user_id,application_id,title,done,task_key,generated_active,has_personal_edits,preferred_bucket) values
 ('00000000-0000-4000-8000-000000000722','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000720','Completed personal history',true,'app:00000000-0000-4000-8000-000000000720:offering:00000000-0000-4000-8000-000000000740:process:vpd_request',false,true,'later');
create temp table proc_tasks_before as select * from public.tasks where id='00000000-0000-4000-8000-000000000722';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000703","app_metadata":{"role":"admin"}}',true);
insert into public.programmes(id,legacy_course_id,name,university_name,source_url) values
 ('00000000-0000-4000-8000-000000000730','00000000-0000-4000-8000-000000000710','Synthetic PROC programme A','Synthetic university','https://example.invalid/proc-a'),
 ('00000000-0000-4000-8000-000000000731','00000000-0000-4000-8000-000000000711','Synthetic PROC programme B','Synthetic university','https://example.invalid/proc-b');
insert into public.course_offerings(id,programme_id,intake_term,intake_year,applicant_group,applicability) values
 ('00000000-0000-4000-8000-000000000740','00000000-0000-4000-8000-000000000730','winter',2027,'Synthetic group','{}'),
 ('00000000-0000-4000-8000-000000000741','00000000-0000-4000-8000-000000000730','summer',2027,'Synthetic other group','{}'),
 ('00000000-0000-4000-8000-000000000742','00000000-0000-4000-8000-000000000731','winter',2027,'Synthetic group','{}'),
 ('00000000-0000-4000-8000-000000000743','00000000-0000-4000-8000-000000000730','winter',2028,'Synthetic group','{}');
-- One literal synthetic route proves evidence preservation; empty facts remain reviewed unknowns.
insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values
 ('00000000-0000-4000-8000-000000000740',1,'verified','2026-10-08T00:00:00Z','00000000-0000-4000-8000-000000000703','[{"key":"route","kind":"route","status":"verified","verbatim":"Synthetic VPD then university route","applicability":"Synthetic group","evidence":[{"source_url":"https://example.invalid/proc-a?intake=2027#route","source_quote":"Synthetic VPD then university route","retrieved_at":"2026-10-07T00:00:00Z","last_verified_at":"2026-10-08T00:00:00Z","verified_by":"00000000-0000-4000-8000-000000000703","source_hash":null}],"route":"vpd_then_university","deadline_kind":null,"date":null,"time":null,"timezone":null}]'),
 ('00000000-0000-4000-8000-000000000741',1,'verified','2026-10-08T00:00:00Z','00000000-0000-4000-8000-000000000703','[]'),
 ('00000000-0000-4000-8000-000000000742',1,'verified','2026-10-08T00:00:00Z','00000000-0000-4000-8000-000000000703','[]');
insert into public.course_offering_versions(offering_id,version) values ('00000000-0000-4000-8000-000000000743',1);
create temp table proc_versions_before as select * from public.course_offering_versions where offering_id between '00000000-0000-4000-8000-000000000740' and '00000000-0000-4000-8000-000000000743';
select pg_temp.assert_true((select offering_id is null and offering_applicant_context is null from public.applications where id='00000000-0000-4000-8000-000000000720'),'old applications start unresolved');
-- Admin may select only their OWN application. Read privilege is not update authority.
update public.applications set offering_id='00000000-0000-4000-8000-000000000740',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000721';
select pg_temp.assert_true((select status='applied' and offering_id='00000000-0000-4000-8000-000000000740' from public.applications where id='00000000-0000-4000-8000-000000000721'),'admin owner selection keeps status');
do $$ begin
 update public.applications set offering_id='00000000-0000-4000-8000-000000000740',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000720';
 if found then raise exception 'admin changed another owner selection'; end if;
 begin update public.applications set offering_id='00000000-0000-4000-8000-000000000743',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000721';raise exception 'admin used pending-only research';exception when raise_exception then if sqlerrm <> 'Offering selection must match this application course and reported applicant group' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000701","app_metadata":{}}',true);
update public.applications set offering_id='00000000-0000-4000-8000-000000000740',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000720';
select pg_temp.assert_true((select user_id='00000000-0000-4000-8000-000000000701' and status='planning' and course_id='00000000-0000-4000-8000-000000000710' and offering_id='00000000-0000-4000-8000-000000000740' from public.applications where id='00000000-0000-4000-8000-000000000720'),'owner context preserves UUID/course/status');
do $$ begin
 begin update public.applications set offering_id='00000000-0000-4000-8000-000000000742' where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted wrong programme';exception when raise_exception then if sqlerrm <> 'Offering selection must match this application course and reported applicant group' then raise;end if;end;
 begin update public.applications set offering_id='00000000-0000-4000-8000-000000000741' where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted wrong group';exception when raise_exception then if sqlerrm <> 'Offering selection must match this application course and reported applicant group' then raise;end if;end;
 begin update public.applications set offering_id='00000000-0000-4000-8000-000000000799' where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted missing FK target';exception when raise_exception then if sqlerrm <> 'Offering selection must match this application course and reported applicant group' then raise;end if;end;
 begin update public.applications set course_id='00000000-0000-4000-8000-000000000711' where id='00000000-0000-4000-8000-000000000720';raise exception 'changed course without reselecting';exception when raise_exception then if sqlerrm <> 'Offering selection must match this application course and reported applicant group' then raise;end if;end;
 begin update public.applications set offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true,"payer":true}' where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted extra payer authority';exception when check_violation then null;end;
 begin update public.applications set offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":false}' where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted unconfirmed group';exception when check_violation then null;end;
 begin update public.applications set offering_id=null where id='00000000-0000-4000-8000-000000000720';raise exception 'accepted unmatched null context';exception when check_violation then null;end;
end $$;
-- Explicit context switch and nullable clear preserve every stored task byte.
update public.applications set offering_id='00000000-0000-4000-8000-000000000741',offering_applicant_context='{"applicant_group":"Synthetic other group","confirmed":true}' where id='00000000-0000-4000-8000-000000000720';
select pg_temp.assert_true((select status='planning' and offering_id='00000000-0000-4000-8000-000000000741' from public.applications where id='00000000-0000-4000-8000-000000000720'),'explicit summer/group context switch');
update public.applications set offering_id=null,offering_applicant_context=null where id='00000000-0000-4000-8000-000000000720';
select pg_temp.assert_true((select done and not generated_active and has_personal_edits and preferred_bucket='later' and title='Completed personal history' from public.tasks where id='00000000-0000-4000-8000-000000000722'),'completed/edited/inactive history unchanged');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000702","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*)=0 from public.applications where id='00000000-0000-4000-8000-000000000720'),'other owner cannot read selection');
do $$ begin
 update public.applications set offering_id='00000000-0000-4000-8000-000000000740',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000720';if found then raise exception 'other owner changed selection';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true((select count(*)=0 from public.applications where id='00000000-0000-4000-8000-000000000720'),'anon cannot read selection');
do $$ begin
 begin update public.applications set offering_id='00000000-0000-4000-8000-000000000740',offering_applicant_context='{"applicant_group":"Synthetic group","confirmed":true}' where id='00000000-0000-4000-8000-000000000720';if found then raise exception 'anon changed selection';end if;exception when insufficient_privilege then null;end;
 begin insert into public.applications(user_id,course_id,offering_id,offering_applicant_context) values ('00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000710','00000000-0000-4000-8000-000000000740','{"applicant_group":"Synthetic group","confirmed":true}');raise exception 'anon inserted selection';exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.assert_true(exists(select 1 from pg_constraint where conrelid='public.applications'::regclass and conname='applications_offering_id_fkey' and contype='f' and confrelid='public.course_offerings'::regclass),'real offering FK exists');
select pg_temp.assert_true(not exists(select * from proc_versions_before except select * from public.course_offering_versions where offering_id between '00000000-0000-4000-8000-000000000740' and '00000000-0000-4000-8000-000000000743'),'immutable evidence unchanged');
select pg_temp.assert_true(not public.valid_application_offering_context('{}'),'missing context rejected');
select pg_temp.assert_true(not public.valid_application_offering_context('{"applicant_group":"Synthetic group","confirmed":"true"}'),'string truth cannot confirm');
select pg_temp.assert_true(not public.valid_application_offering_context('{"applicant_group":"\u00a0","confirmed":true}'),'JS blank group rejected');
select pg_temp.assert_true(not public.valid_application_offering_context('{"applicant_group":"Synthetic group","confirmed":true,"__proto__":"x"}'),'unknown/reserved context rejected');
select pg_temp.assert_true(not exists(select * from proc_tasks_before except select * from public.tasks where id='00000000-0000-4000-8000-000000000722') and not exists(select * from public.tasks where id='00000000-0000-4000-8000-000000000722' except select * from proc_tasks_before),'all stored task bytes survive context switches');
rollback;
