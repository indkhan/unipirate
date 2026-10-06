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
  begin update public.programmes set legacy_course_id = null where id = '00000000-0000-4000-8000-000000000001'; raise exception 'legacy identity changed'; exception when raise_exception then if sqlerrm <> 'programme identity is immutable' then raise; end if; end;
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
insert into public.programmes(name,university_name,source_url) values
('Port one fixture','Synthetic institution','http://example.invalid:1/'),
('Port max fixture','Synthetic institution','https://example.invalid:65535?x=1#y');
select pg_temp.assert_true((select count(*) = 2 from public.programmes where source_url in ('http://example.invalid:1/','https://example.invalid:65535?x=1#y')), 'valid port boundaries retained verbatim');
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
select pg_temp.assert_true(not exists(select 1 from public.course_offering_versions where review_status <> 'verified'), 'pending research invisible publicly');
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
select pg_temp.assert_true(not exists(select * from course_versions_before except select * from public.course_offering_versions), 'all original immutable versions still present');
rollback;
