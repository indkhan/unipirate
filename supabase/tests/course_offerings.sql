-- Run ONLY on the orchestrator's disposable DB after all migrations.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/course_offerings.sql <local connection>
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end; $$;
insert into auth.users(id, email) values ('00000000-0000-4000-8000-000000000091', 'course-test@example.invalid');
insert into public.courses(id, source_url, normalized_url, review_status, imported_by)
values ('00000000-0000-4000-8000-000000000092','https://example.invalid/legacy','https://example.invalid/legacy','approved','00000000-0000-4000-8000-000000000091');
insert into public.applications(id,user_id,course_id,status)
values ('00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092','applied');
insert into public.tasks(id,user_id,application_id,title,done)
values ('00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093','Personal edit preserved',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{"role":"admin"}}',true);
insert into public.programmes(id,legacy_course_id,name,university_name,degree,source_url)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000092','Synthetic programme','Synthetic institution',null,'https://example.invalid/programme');
insert into public.course_offerings(id,programme_id,intake_term,intake_year,applicant_group,applicability) values
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','winter',2027,'non-EU','{"qualification_country":"XX"}'),
('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','summer',2027,'non-EU','{"qualification_country":"XX"}'),
('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','winter',2027,'EU','{}');
insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
values ('00000000-0000-4000-8000-000000000002',1,'verified','2026-10-06T13:00:00Z','00000000-0000-4000-8000-000000000091',
'[{"key":"closing","kind":"deadline","status":"verified","verbatim":"Synthetic closing 15 July 2027","applicability":"Synthetic non-EU","evidence":[{"source_url":"https://example.invalid/official?year=2027#closing","source_quote":"Synthetic closing 15 July 2027","retrieved_at":"2026-10-06T12:00:00Z","last_verified_at":"2026-10-06T13:00:00Z","verified_by":"00000000-0000-4000-8000-000000000091","source_hash":null}],"route":null,"deadline_kind":"application_closing","date":"2027-07-15","time":null,"timezone":null}]');
insert into public.course_offering_versions(offering_id,version) values
('00000000-0000-4000-8000-000000000002',2), ('00000000-0000-4000-8000-000000000003',1), ('00000000-0000-4000-8000-000000000004',1);
select pg_temp.assert_true((select count(*) = 3 from public.course_offerings), 'intakes and applicant groups coexist');
select pg_temp.assert_true((select count(*) = 4 from public.course_offering_versions), 'admin sees pending research and history');
do $$ begin
  begin insert into public.course_offering_versions(offering_id,version,review_status) values ('00000000-0000-4000-8000-000000000002',3,'verified'); raise exception 'accepted missing reviewer'; exception when check_violation then null; end;
  begin insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability) values ('00000000-0000-4000-8000-000000000001','winter',2027,'non-EU','{"qualification_country":"XX"}'); raise exception 'duplicate scope accepted'; exception when unique_violation then null; end;
end $$;
-- Regression: a canonical name correction keeps tracking and historical facts.
create temp table course_versions_before as select * from public.course_offering_versions;
update public.programmes set name = 'Corrected synthetic programme' where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select name = 'Corrected synthetic programme' and legacy_course_id = '00000000-0000-4000-8000-000000000092' from public.programmes where id = '00000000-0000-4000-8000-000000000001'), 'name corrected without replacing canonical identity');
select pg_temp.assert_true(not exists (select * from course_versions_before except select * from public.course_offering_versions) and not exists (select * from public.course_offering_versions except select * from course_versions_before), 'all old versions unchanged after correction');
select pg_temp.assert_true((select count(*) = 3 from public.course_offerings where programme_id = '00000000-0000-4000-8000-000000000001'), 'offering links preserved after correction');
select pg_temp.assert_true((select count(*) = 1 from public.admin_audit_events where table_name = 'programmes' and row_id = '00000000-0000-4000-8000-000000000001' and actor_user_id = '00000000-0000-4000-8000-000000000091' and programme_correction->'old'->>'name' = 'Synthetic programme' and programme_correction->'new'->>'name' = 'Corrected synthetic programme'), 'meaningful correction audited with actor and before/after');
update public.programmes set name = name where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*) = 1 from public.admin_audit_events where table_name = 'programmes' and row_id = '00000000-0000-4000-8000-000000000001'), 'no-op correction does not create audit noise');
do $$ begin
  begin update public.programmes set name = ' ' where id = '00000000-0000-4000-8000-000000000001'; raise exception 'blank label accepted'; exception when check_violation then null; end;
  begin update public.programmes set legacy_course_id = null where id = '00000000-0000-4000-8000-000000000001'; raise exception 'legacy identity changed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions), 'anon sees reviewed version only');
select pg_temp.assert_true((select count(*) = 1 from public.course_offerings), 'pending-only scopes hidden');
select pg_temp.assert_true((select facts->0->>'verbatim' = 'Synthetic closing 15 July 2027' from public.course_offering_versions), 'wording survives');
do $$ begin
  begin insert into public.programmes(name,university_name,source_url) values ('forbidden','forbidden','https://example.invalid'); raise exception 'anon inserted programme'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions), 'legacy importer cannot see pending catalogue');
do $$ begin
  begin insert into public.course_offering_versions(offering_id,version) values ('00000000-0000-4000-8000-000000000002',3); raise exception 'owner inserted draft'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions), 'other user cannot see pending catalogue');
do $$ begin
  update public.programmes set name = 'Unauthorized correction' where id = '00000000-0000-4000-8000-000000000001';
  if found then raise exception 'other user corrected canonical programme'; end if;
end $$;
reset role;
do $$ begin
  begin update public.programmes set id = '00000000-0000-4000-8000-000000000090' where id = '00000000-0000-4000-8000-000000000001'; raise exception 'canonical identity changed'; exception when raise_exception then if sqlerrm <> 'programme identity is immutable' then raise; end if; end;
  begin update public.programmes set legacy_course_id = null where id = '00000000-0000-4000-8000-000000000001'; raise exception 'legacy link changed'; exception when raise_exception then if sqlerrm <> 'programme identity is immutable' then raise; end if; end;
end $$;
do $$ begin
  begin update public.course_offering_versions set version = 99; raise exception 'history overwritten'; exception when raise_exception then if sqlerrm <> 'course catalogue history is append-only' then raise; end if; end;
  begin delete from public.course_offerings; raise exception 'scope deleted'; exception when raise_exception then if sqlerrm <> 'course catalogue history is append-only' then raise; end if; end;
end $$;
select pg_temp.assert_true((select status = 'applied' and course_id = '00000000-0000-4000-8000-000000000092' from public.applications where id = '00000000-0000-4000-8000-000000000093'), 'legacy application identity and status preserved');
select pg_temp.assert_true((select done and title = 'Personal edit preserved' from public.tasks where id = '00000000-0000-4000-8000-000000000094'), 'completed personal task preserved');
select pg_temp.assert_true(not public.valid_offering_facts('[{}]',true), 'missing evidence rejected');
select pg_temp.assert_true(not public.valid_offering_facts('{}',false), 'invalid payload rejected');
select pg_temp.assert_true(not public.valid_offering_applicability('{"country":null}'), 'missing applicability value rejected');
select pg_temp.assert_true(not public.valid_offering_facts((select jsonb_set(facts,'{0,date}','"2027-02-29"') from public.course_offering_versions where version = 1 and review_status = 'verified'),true), 'impossible date rejected');
select pg_temp.assert_true(not public.valid_offering_facts((select jsonb_set(facts,'{0,evidence}','[]') from public.course_offering_versions where version = 1 and review_status = 'verified'),true), 'unsupported verified fact rejected');
rollback;
