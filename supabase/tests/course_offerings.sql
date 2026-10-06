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
select pg_temp.assert_true((select count(*) = 3 from public.course_offerings where programme_id = '00000000-0000-4000-8000-000000000001'), 'intakes and applicant groups coexist');
select pg_temp.assert_true((select count(*) = 4 from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'admin sees pending research and history');
do $$ begin
  begin insert into public.course_offering_versions(offering_id,version,review_status) values ('00000000-0000-4000-8000-000000000002',3,'verified'); raise exception 'accepted missing reviewer'; exception when insufficient_privilege then null; end;
  begin insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability) values ('00000000-0000-4000-8000-000000000001','winter',2027,'non-EU','{"qualification_country":"XX"}'); raise exception 'duplicate scope accepted'; exception when unique_violation then null; end;
end $$;
-- Separately prove the metadata CHECK under a local role that bypasses RLS.
set local role service_role;
do $$ begin
  begin insert into public.course_offering_versions(offering_id,version,review_status) values ('00000000-0000-4000-8000-000000000002',3,'verified'); raise exception 'constraint accepted missing reviewer'; exception when check_violation then null; end;
end $$;
set local role authenticated;
-- Regression: a canonical name correction keeps tracking and historical facts.
create temp table course_versions_before as select * from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');
update public.programmes set name = 'Corrected synthetic programme' where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select name = 'Corrected synthetic programme' and legacy_course_id = '00000000-0000-4000-8000-000000000092' from public.programmes where id = '00000000-0000-4000-8000-000000000001'), 'name corrected without replacing canonical identity');
select pg_temp.assert_true(not exists (select * from course_versions_before except select * from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')) and not exists (select * from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004') except select * from course_versions_before), 'all old versions unchanged after correction');
select pg_temp.assert_true((select count(*) = 3 from public.course_offerings where programme_id = '00000000-0000-4000-8000-000000000001'), 'offering links preserved after correction');
select pg_temp.assert_true((select count(*) = 1 from public.admin_audit_events where table_name = 'programmes' and row_id = '00000000-0000-4000-8000-000000000001' and actor_user_id = '00000000-0000-4000-8000-000000000091' and programme_correction->'old'->>'name' = 'Synthetic programme' and programme_correction->'new'->>'name' = 'Corrected synthetic programme'), 'meaningful correction audited with actor and before/after');
update public.programmes set name = name where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*) = 1 from public.admin_audit_events where table_name = 'programmes' and row_id = '00000000-0000-4000-8000-000000000001'), 'no-op correction does not create audit noise');
do $$ begin
  begin update public.programmes set name = ' ' where id = '00000000-0000-4000-8000-000000000001'; raise exception 'blank label accepted'; exception when check_violation then null; end;
  begin update public.programmes set legacy_course_id = null where id = '00000000-0000-4000-8000-000000000001'; raise exception 'legacy identity changed'; exception when raise_exception then if sqlerrm <> 'programme identity is immutable' then raise; end if; end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'anon sees reviewed version only');
select pg_temp.assert_true((select count(*) = 1 from public.course_offerings where programme_id = '00000000-0000-4000-8000-000000000001'), 'pending-only scopes hidden');
select pg_temp.assert_true((select facts->0->>'verbatim' = 'Synthetic closing 15 July 2027' from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'wording survives');
do $$ begin
  begin insert into public.programmes(name,university_name,source_url) values ('forbidden','forbidden','https://example.invalid'); raise exception 'anon inserted programme'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'legacy importer cannot see pending catalogue');
do $$ begin
  begin insert into public.course_offering_versions(offering_id,version) values ('00000000-0000-4000-8000-000000000002',3); raise exception 'owner inserted draft'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*) = 1 from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'other user cannot see pending catalogue');
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
  begin update public.course_offering_versions set version = 99 where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'); raise exception 'history overwritten'; exception when raise_exception then if sqlerrm <> 'course catalogue history is append-only' then raise; end if; end;
  begin delete from public.course_offerings where programme_id = '00000000-0000-4000-8000-000000000001'; raise exception 'scope deleted'; exception when raise_exception then if sqlerrm <> 'course catalogue history is append-only' then raise; end if; end;
end $$;
select pg_temp.assert_true((select status = 'applied' and course_id = '00000000-0000-4000-8000-000000000092' from public.applications where id = '00000000-0000-4000-8000-000000000093'), 'legacy application identity and status preserved');
select pg_temp.assert_true((select done and title = 'Personal edit preserved' from public.tasks where id = '00000000-0000-4000-8000-000000000094'), 'completed personal task preserved');
select pg_temp.assert_true(not public.valid_offering_facts('[{}]',true), 'missing evidence rejected');
select pg_temp.assert_true(not public.valid_offering_facts('{}',false), 'invalid payload rejected');
select pg_temp.assert_true(not public.valid_offering_applicability('{"country":null}'), 'missing applicability value rejected');
select pg_temp.assert_true(not public.valid_offering_facts((select jsonb_set(facts,'{0,date}','"2027-02-29"') from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1 and review_status = 'verified'),true), 'impossible date rejected');
select pg_temp.assert_true(not public.valid_offering_facts((select jsonb_set(facts,'{0,evidence}','[]') from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1 and review_status = 'verified'),true), 'unsupported verified fact rejected');

-- Integrity regressions for additive migration 00101. Everything rolls back.
create function pg_temp.expect_state(command text, expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute command; exception when others then get stacked diagnostics caught = returned_sqlstate; end;
  if caught is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, caught, command; end if;
end;
$$;
create function pg_temp.assert_denied(command text) returns void language plpgsql as $$
declare affected bigint;
begin
  begin
    execute command;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'unauthorized write succeeded: %', command; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;
create function pg_temp.synthetic_deadline(closing text, audience text, reviewer text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'key','closing','kind','deadline','status','verified',
    'verbatim','Synthetic closing ' || closing || ' for ' || audience,
    'applicability',audience,'route',null,'deadline_kind','application_closing',
    'date',closing,'time',null,'timezone',null,'evidence',jsonb_build_array(jsonb_build_object(
      'source_url','https://Example.invalid:443/official?intake=2027#closing',
      'source_quote','Synthetic closing ' || closing || ' for ' || audience,
      'retrieved_at','2026-10-06T12:00:00Z','last_verified_at','2026-10-06T13:00:00Z',
      'verified_by',reviewer,'source_hash',null
    ))
  ))
$$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{"role":"admin"}}',true);
-- Fresh forged reviewer is rejected even when the outer reviewer is the caller.
select pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,3,''verified'',now(),%L,%L)',
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000091',
  pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000099')), '42501');
select pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,3,''verified'',now(),%L,%L)',
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',
  pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000091')), '42501');
-- Pending AI data stays pending, with no reviewer/verification timestamp.
insert into public.course_offering_versions(offering_id,version,facts)
values ('00000000-0000-4000-8000-000000000002',4,
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000091'),'{0,status}','"pending"'),'{0,date}','null'),'{0,evidence,0,verified_by}','null'),'{0,evidence,0,last_verified_at}','null'));
-- Independent published deadlines, matching their synthetic source wording.
insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values
('00000000-0000-4000-8000-000000000003',2,'verified',now(),'00000000-0000-4000-8000-000000000091',pg_temp.synthetic_deadline('2027-01-15','non-EU','00000000-0000-4000-8000-000000000091')),
('00000000-0000-4000-8000-000000000004',2,'verified',now(),'00000000-0000-4000-8000-000000000091',pg_temp.synthetic_deadline('2027-08-15','EU','00000000-0000-4000-8000-000000000091'));
select pg_temp.assert_true((select facts->0->>'date' = '2027-01-15' from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000003' and version = 2), 'published summer deadline is independent');
select pg_temp.assert_true((select facts->0->>'date' = '2027-08-15' from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000004' and version = 2), 'published EU winter deadline is independent');
select pg_temp.assert_true((select facts->0->>'date' = '2027-07-15' from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1), 'published non-EU winter deadline unchanged');

-- A second real reviewer may carry forward an exact established capture.
reset role;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000095','second-reviewer@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000095","app_metadata":{"role":"admin"}}',true);
insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
select offering_id,3,'verified',now(),'00000000-0000-4000-8000-000000000095',facts
from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1;
select pg_temp.assert_true((select facts->0->'evidence'->0->>'verified_by' = '00000000-0000-4000-8000-000000000091' from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 3), 'historical reviewer preserved by exact carry-forward');
select pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,5,''verified'',now(),%L,%L)',
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',
  (select jsonb_set(facts,'{0,evidence,0,source_hash}','"altered"') from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1)), '42501');
select pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,5,''verified'',now(),%L,%L)',
  '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000095',
  (select facts from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1)), '42501');
select pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,5,''verified'',now(),%L,%L)',
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',
  (select jsonb_set(facts,'{0,applicability}','"different group"') from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = 1)), '42501');

-- A narrow shared source URL contract: exact query/hash retention and bad host/port denial.
do $$ declare url text; begin
  foreach url in array array['https://example.invalid:bad/','https://example.invalid:65536/','https://example.invalid:0/','https://-bad.invalid/','https://bad-.invalid/','https://bad..invalid/','https://user@example.invalid/','https://999.999.999.999/','https://example.invalid/back\slash'] loop
    perform pg_temp.expect_state(format('insert into public.programmes(name,university_name,source_url) values (''invalid fixture'',''fixture'',%L)',url), '23514');
    perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,5,''verified'',now(),%L,%L)',
      '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',
      jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000095'),'{0,evidence,0,source_url}',to_jsonb(url))), '23514');
  end loop;
end $$;
insert into public.programmes(id,name,university_name,source_url) values
('00000000-0000-4000-8000-000000000006','Port one fixture','Synthetic institution','http://example.invalid:1/'),
('00000000-0000-4000-8000-000000000007','Port max fixture','Synthetic institution','https://example.invalid:65535?x=1#y');
select pg_temp.assert_true((select count(*) = 2 from public.programmes where id in ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007') and source_url in ('http://example.invalid:1/','https://example.invalid:65535?x=1#y')), 'valid port boundaries retained verbatim');
-- A changed capture becomes fresh evidence only when the current admin attests it.
insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
values ('00000000-0000-4000-8000-000000000002',5,'verified',now(),'00000000-0000-4000-8000-000000000095',
  jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000095'),'{0,evidence,0,source_hash}','"new reviewer attestation"'));
insert into public.programmes(id,name,university_name,source_url)
values ('00000000-0000-4000-8000-000000000005','Draft with no link','Synthetic institution','https://Example.invalid:443/p?year=2027#closing');
select pg_temp.assert_true((select source_url = 'https://Example.invalid:443/p?year=2027#closing' from public.programmes where id = '00000000-0000-4000-8000-000000000005'), 'programme source URL retained verbatim');
select pg_temp.assert_true((select facts->0->'evidence'->0->>'source_url' = 'https://Example.invalid:443/official?intake=2027#closing' from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000003' and version = 2), 'capture source URL retained verbatim');

-- Pending and conflict courses must stay deletable via their existing operations.
insert into public.courses(id,source_url,normalized_url,review_status,imported_by,conflicts_with) values
('00000000-0000-4000-8000-000000000096','https://example.invalid/conflict','https://example.invalid/conflict','pending','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092'),
('00000000-0000-4000-8000-000000000099','https://example.invalid/pending','https://example.invalid/pending','pending','00000000-0000-4000-8000-000000000091',null),
('00000000-0000-4000-8000-000000000100','https://example.invalid/new-canonical','https://example.invalid/new-canonical','approved',null,null);
select pg_temp.expect_state('update public.programmes set legacy_course_id = ''00000000-0000-4000-8000-000000000099'' where id = ''00000000-0000-4000-8000-000000000005''','23514');
select pg_temp.expect_state('insert into public.programmes(legacy_course_id,name,university_name,source_url) values (''00000000-0000-4000-8000-000000000096'',''invalid link'',''fixture'',''https://example.invalid/'')','23514');
update public.programmes set legacy_course_id = '00000000-0000-4000-8000-000000000100' where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.assert_true((select legacy_course_id = '00000000-0000-4000-8000-000000000100' from public.programmes where id = '00000000-0000-4000-8000-000000000005'), 'draft identity attaches approved course once');
select pg_temp.assert_true((select count(*) = 1 from public.admin_audit_events where table_name = 'programmes' and row_id = '00000000-0000-4000-8000-000000000005' and programme_correction->'old'->'legacy_course_id' = 'null'::jsonb and programme_correction->'new'->>'legacy_course_id' = '00000000-0000-4000-8000-000000000100'), 'one-time legacy attachment audited');
select pg_temp.expect_state('update public.programmes set legacy_course_id = null where id = ''00000000-0000-4000-8000-000000000005''','P0001');
select pg_temp.expect_state('update public.courses set review_status = ''pending'' where id = ''00000000-0000-4000-8000-000000000100''','23514');
-- Preserve reminder identity/completion when the conflict application merges.
reset role;
insert into public.applications(id,user_id,course_id) values ('00000000-0000-4000-8000-000000000097','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000096');
insert into public.tasks(id,user_id,application_id,title,done) values ('00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000097','Completed conflict personal edit',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{}}',true);
select public.remove_my_course('00000000-0000-4000-8000-000000000099');
select pg_temp.assert_true(not exists(select 1 from public.courses where id = '00000000-0000-4000-8000-000000000099'), 'importer removed pending course');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{"role":"admin"}}',true);
select public.resolve_course_conflict('00000000-0000-4000-8000-000000000096',true);
select pg_temp.assert_true(not exists(select 1 from public.courses where id = '00000000-0000-4000-8000-000000000096'), 'conflict submission deleted without FK obstruction');
select pg_temp.assert_true((select application_id = '00000000-0000-4000-8000-000000000093' and done and title = 'Completed conflict personal edit' from public.tasks where id = '00000000-0000-4000-8000-000000000098'), 'conflict personal task identity and edits retained');

-- Full role/write matrix, with actual table commands rather than UI guards.
create function pg_temp.assert_catalogue_writes_denied() returns void language plpgsql as $$
begin
  perform pg_temp.assert_denied('insert into public.programmes(name,university_name,source_url) values (''denied'',''fixture'',''https://example.invalid/'')');
  perform pg_temp.assert_denied('insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability) values (''00000000-0000-4000-8000-000000000001'',''winter'',2028,''denied'',''{}'')');
  perform pg_temp.assert_denied('insert into public.course_offering_versions(offering_id,version) values (''00000000-0000-4000-8000-000000000002'',99)');
  perform pg_temp.assert_denied('update public.programmes set name = ''denied'' where id = ''00000000-0000-4000-8000-000000000001''');
  perform pg_temp.assert_denied('update public.course_offerings set intake_year = 2028 where id = ''00000000-0000-4000-8000-000000000002''');
  perform pg_temp.assert_denied('update public.course_offering_versions set review_status = ''verified'' where offering_id = ''00000000-0000-4000-8000-000000000002''');
  perform pg_temp.assert_denied('delete from public.programmes where id = ''00000000-0000-4000-8000-000000000001''');
  perform pg_temp.assert_denied('delete from public.course_offerings where id = ''00000000-0000-4000-8000-000000000002''');
  perform pg_temp.assert_denied('delete from public.course_offering_versions where offering_id = ''00000000-0000-4000-8000-000000000002''');
end;
$$;
select pg_temp.assert_denied('delete from public.course_offering_versions where offering_id = ''00000000-0000-4000-8000-000000000002''');
select pg_temp.assert_denied('update public.course_offerings set intake_year = 2028 where id = ''00000000-0000-4000-8000-000000000002''');
select pg_temp.assert_denied('update public.course_offering_versions set version = 99 where offering_id = ''00000000-0000-4000-8000-000000000002''');
select pg_temp.assert_denied('delete from public.course_offerings where id = ''00000000-0000-4000-8000-000000000002''');
select pg_temp.assert_denied('delete from public.programmes where id = ''00000000-0000-4000-8000-000000000001''');
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_catalogue_writes_denied();
select pg_temp.assert_true(not exists(select 1 from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004') and review_status <> 'verified'), 'pending research invisible publicly');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","app_metadata":{}}',true);
select pg_temp.assert_catalogue_writes_denied();
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","app_metadata":{}}',true);
select pg_temp.assert_catalogue_writes_denied();
reset role;
select pg_temp.expect_state('delete from public.course_offering_versions where offering_id = ''00000000-0000-4000-8000-000000000002''','P0001');
select pg_temp.assert_true((select legacy_course_id = '00000000-0000-4000-8000-000000000092' from public.programmes where id = '00000000-0000-4000-8000-000000000001'), 'canonical identity retained after conflict resolution');
select pg_temp.assert_true((select status = 'applied' and course_id = '00000000-0000-4000-8000-000000000092' from public.applications where id = '00000000-0000-4000-8000-000000000093'), 'original application values retained after conflict resolution');
select pg_temp.assert_true((select done and title = 'Personal edit preserved' from public.tasks where id = '00000000-0000-4000-8000-000000000094'), 'original completed personal task retained');
select pg_temp.assert_true(not exists(select * from course_versions_before except select * from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'all original immutable versions still present');
-- 00102: actual insert/correction failures, not merely helper predicates.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000095","app_metadata":{"role":"admin"}}',true);
do $$ declare blank text; field text; capture jsonb; invalid text; n integer := 20; valid text; begin
  foreach blank in array array[E'\t',E'\n',U&'\00A0',U&'\2000\2028\2029\FEFF'] loop
    foreach field in array array['name','university_name','degree'] loop
      perform pg_temp.expect_state(format('update public.programmes set %I = %L where id = %L',field,blank,'00000000-0000-4000-8000-000000000001'),'23514');
    end loop;
    perform pg_temp.expect_state(format('insert into public.programmes(name,university_name,source_url) values (%L,''fixture'',''https://example.invalid/'')',blank),'23514');
    perform pg_temp.expect_state(format('insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability) values (%L,''winter'',2029,%L,''{}'')','00000000-0000-4000-8000-000000000001',blank),'23514');
    foreach capture in array array[jsonb_build_object('country',blank),jsonb_build_object('country',jsonb_build_array(blank))] loop
      perform pg_temp.expect_state(format('insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability) values (%L,''winter'',2029,''fixture'',%L)','00000000-0000-4000-8000-000000000001',capture),'23514');
    end loop;
    foreach field in array array['key','applicability','verbatim','timezone','source_quote','source_hash'] loop
      capture := pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000095');
      -- Timezone is tested with valid date/time so its blankness is the failure.
      capture := jsonb_set(capture,'{0,time}','"12:00:00"');
      capture := jsonb_set(capture,case when field in ('source_quote','source_hash') then array['0','evidence','0',field] else array['0',field] end,to_jsonb(blank));
      perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,99,''verified'',now(),%L,%L)','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',capture),'23514');
    end loop;
  end loop;
  foreach invalid in array array['2026-10-05T24:00:00Z','2026-02-29T12:00:00Z','2026-10-05T12:00:60Z','2026-10-05T12:00:00+16:00','2026-10-05T12:00:00+01:60','2026-10-05T12:00:00+0530','2026-10-05T12:00:00+1600','0000-01-01T12:00:00Z',E'2026-10-05T12:00:00Z\n'] loop
    foreach field in array array['retrieved_at','last_verified_at'] loop
      capture := jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000095'),array['0','evidence','0',field],to_jsonb(invalid));
      perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,99,''verified'',now(),%L,%L)','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000095',capture),'23514');
    end loop;
  end loop;
  foreach invalid in array array['infinity','-infinity','10000-01-01T00:00:00Z','0001-01-01 BC'] loop
    perform pg_temp.expect_state(format('insert into public.programmes(name,university_name,source_url,created_at) values (''fixture'',''fixture'',''https://example.invalid/'',%L)',invalid),'23514');
    perform pg_temp.expect_state(format('insert into public.course_offerings(programme_id,intake_term,intake_year,applicant_group,applicability,created_at) values (%L,''winter'',2029,''fixture'',''{}'',%L)','00000000-0000-4000-8000-000000000001',invalid),'23514');
    perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,created_at) values (%L,99,%L)','00000000-0000-4000-8000-000000000002',invalid),'23514');
    perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by) values (%L,99,''rejected'',%L,%L)','00000000-0000-4000-8000-000000000002',invalid,'00000000-0000-4000-8000-000000000095'),'23514');
  end loop;
  foreach valid in array array['2024-02-29T12:00Z','2026-10-05T12:00:00.123456Z','2026-10-05T12:00:00+05:30','2026-10-05T12:00:00-15:59'] loop
    capture := jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-000000000095'),'{0,evidence,0,retrieved_at}',to_jsonb(valid));
    insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
      values ('00000000-0000-4000-8000-000000000002',n,'verified',now(),'00000000-0000-4000-8000-000000000095',capture);
    perform pg_temp.assert_true((select facts->0->'evidence'->0->>'retrieved_at' = valid from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = n),'timestamp preserved verbatim');
    n := n + 1;
  end loop;
end $$;
-- 00103: matching authenticated actor cannot smuggle alternative UUID spelling.
-- A fixture with alphabetic hex demonstrates that accepted case is retained.
reset role;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-0000000000ab','course-reviewer-syntax@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000ab","app_metadata":{"role":"admin"}}',true);
do $$ declare reviewer text; n integer := 30; capture jsonb; begin
  foreach reviewer in array array['000000000000400080000000000000ab','{00000000-0000-4000-8000-0000000000ab}'] loop
    perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,99,''verified'',now(),%L,%L)',
      '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000ab',
      pg_temp.synthetic_deadline('2027-07-15','non-EU',reviewer)), '23514');
  end loop;
  foreach reviewer in array array['00000000-0000-4000-8000-0000000000ab','00000000-0000-4000-8000-0000000000AB'] loop
    capture := jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU',reviewer),'{0,evidence,0,retrieved_at}','"2026-10-06T12:00:00.123456+05:30"');
    insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
      values ('00000000-0000-4000-8000-000000000002',n,'verified',now(),'00000000-0000-4000-8000-0000000000ab',capture);
    perform pg_temp.assert_true((select facts->0->'evidence'->0->>'verified_by' = reviewer
      and facts->0->'evidence'->0->>'retrieved_at' = '2026-10-06T12:00:00.123456+05:30'
      from public.course_offering_versions where offering_id = '00000000-0000-4000-8000-000000000002' and version = n),'canonical reviewer case and colon offset retained verbatim');
    n := n + 1;
  end loop;
end $$;
-- 00104: chronology follows source instants at JS millisecond precision.
-- These are actual inserts: the .0010000/.0009999 pair was admitted before
-- repair, while submillisecond equality was incorrectly rejected by SQL.
do $$ declare pair record; capture jsonb; n integer := 40; begin
  for pair in select * from (values
    ('2026-10-06T12:00:00.0010000Z','2026-10-06T12:00:00.0009999Z',false),
    ('2026-10-06T12:00:00.0009999Z','2026-10-06T12:00:00.0000001Z',true),
    ('2026-10-06T23:59:59.9999999Z','2026-10-06T23:59:59.9990000Z',true),
    ('2026-10-06T23:59:59.9999999Z','2026-10-07T00:00:00Z',true),
    ('2026-10-07T00:00:00.001+01:00','2026-10-06T23:00:00.0009999Z',false),
    ('2026-10-07T00:00:00.001+01:00','2026-10-06T23:00:00.0019999Z',true),
    ('2026-10-06T12:00:00.1Z','2026-10-06T12:00:00.10Z',true),
    ('2026-10-06T12:00:00Z','2026-10-06T12:00:00.000Z',true)
  ) as cases(retrieved,verified,accepted) loop
    capture := jsonb_set(jsonb_set(pg_temp.synthetic_deadline('2027-07-15','non-EU','00000000-0000-4000-8000-0000000000ab'),
      '{0,evidence,0,retrieved_at}',to_jsonb(pair.retrieved)), '{0,evidence,0,last_verified_at}',to_jsonb(pair.verified));
    if pair.accepted then
      insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
        values ('00000000-0000-4000-8000-000000000002',n,'verified',now(),'00000000-0000-4000-8000-0000000000ab',capture);
      perform pg_temp.assert_true((select facts = capture from public.course_offering_versions
        where offering_id = '00000000-0000-4000-8000-000000000002' and version = n),'complete capture retained verbatim under millisecond chronology');
    else
      perform pg_temp.expect_state(format('insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts) values (%L,%s,''verified'',now(),%L,%L)',
        '00000000-0000-4000-8000-000000000002',n,'00000000-0000-4000-8000-0000000000ab',capture),'23514');
    end if;
    n := n + 1;
  end loop;
end $$;
select pg_temp.assert_true(not exists(select * from course_versions_before except select * from public.course_offering_versions where offering_id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')), 'chronology repair leaves old reviewed history unchanged');
rollback;
