-- Synthetic disposable-only transaction fixture. SQL NOT EXECUTED by foundation writer.
-- Run AFTER 00101 + 00102 as postgres: psql -X -v ON_ERROR_STOP=1 -f this-file.
-- Sequential claims are NOT concurrency evidence. Root owns concurrent clients.
\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims','{}',true);
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end; $$;
create function pg_temp.expect_state(command text,expected text) returns void language plpgsql as $$
declare caught text; begin
 begin execute command; exception when others then get stacked diagnostics caught=returned_sqlstate; end;
 if caught is distinct from expected then raise exception 'expected %, got % for %',expected,caught,command; end if;
end; $$;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000003101','history-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000003102','history-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000003103','history-other@example.invalid'),
 ('00000000-0000-4000-8000-000000003104','history-progress@example.invalid');
insert into public.rules(id,slug,conditions,outcomes,source_url,source_quote)
 values('00000000-0000-4000-8000-000000003111','synthetic-history-rule','{}','{"path":"direct"}',
 'https://example.invalid/history',' Original literal quote ');
insert into public.courses(id,source_url,normalized_url,review_status,imported_by)
 values('00000000-0000-4000-8000-000000003141','https://example.invalid/history-course','https://example.invalid/history-course','approved','00000000-0000-4000-8000-000000003104');
insert into public.applications(id,user_id,course_id,status)
 values('00000000-0000-4000-8000-000000003142','00000000-0000-4000-8000-000000003104','00000000-0000-4000-8000-000000003141','applied');
insert into public.tasks(id,user_id,application_id,title,done,task_key,has_personal_edits,description,preferred_bucket,due_date)
 values('00000000-0000-4000-8000-000000003143','00000000-0000-4000-8000-000000003104','00000000-0000-4000-8000-000000003142','Personal history wording',true,'rule:00000000-0000-4000-8000-000000003111:step:0',true,'Personal history details','later','2027-01-02');
create temp table preserved_progress as select to_jsonb(t) payload,'task' kind from public.tasks t where id='00000000-0000-4000-8000-000000003143'
 union all select to_jsonb(a),'application' from public.applications a where id='00000000-0000-4000-8000-000000003142';
create temp table fixture_metadata(value jsonb);
grant select,insert,update on fixture_metadata to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003101","app_metadata":{"role":"admin"}}',true);
update public.rule_drafts set raw_snapshot=jsonb_set(raw_snapshot,'{last_verified_at}','"2000-01-01T00:00:00Z"') where rule_id='00000000-0000-4000-8000-000000003111';
select public.publish_rule_version(rule_id,revision,raw_snapshot,null,'verified') from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000003111';
reset role;
insert into fixture_metadata select jsonb_build_object('formatVersion',1,
 'evaluatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'engineRevision','unipirate/evaluate+dmat+gce@d2367b9','selectedVersionIds',jsonb_build_array(id::text),'selectionIssues','[]'::jsonb)
 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000003111' and version_number=1;
set local role service_role;
select set_config('request.jwt.claims','{}',true);
insert into public.checks(id,answers,result,owner_token_hash,assessment_metadata)
 select '00000000-0000-4000-8000-000000003121',
 '{"targetDegree":"bachelor","curriculumType":"other","certificateCountry":"in","nationality":"in","visaApplicationCountry":"sa","targetField":"cs","intake":{"term":"winter","year":2026}}',
 '{"path":"direct","aps":"unknown","testAS":"unknown","dMAT":"unknown","documents":[],"stepsDetailed":[],"citations":[{"ruleId":"00000000-0000-4000-8000-000000003111","sourceUrl":"https://example.invalid/history","verifiedAt":"2000-01-01T00:00:00Z","claim":" Original literal quote ","status":"verified","supports":["path"]}],"unknowns":[]}',
 'synthetic-history-token',value from fixture_metadata;
-- Forged JSON marker is just legacy payload; the protected column is still NULL.
insert into public.checks(id,answers,result,owner_token_hash)
 select '00000000-0000-4000-8000-000000003122','{"synthetic":"legacy"}',
 jsonb_build_object('assessment_metadata',value,'formatVersion',1,'forgedVerdict','direct'),'synthetic-legacy-token' from fixture_metadata;
-- Zero selected IDs is a valid uncovered assessment, not a fabricated fallback.
insert into public.checks(id,answers,result,assessment_metadata)
 select '00000000-0000-4000-8000-000000003124','{}','{"path":"unknown"}',jsonb_set(value,'{selectedVersionIds}','[]') from fixture_metadata;
-- Signed-in initial ownership remains supported by private INSERT.
insert into public.checks(id,answers,result,claimed_by,claimed_at,assessment_metadata)
 select '00000000-0000-4000-8000-000000003123','{}','{}','00000000-0000-4000-8000-000000003103',now(),value from fixture_metadata;
reset role;
create temp table original_checks as select id,to_jsonb(c)-'claimed_by'-'claimed_at' payload from public.checks c where id in
 ('00000000-0000-4000-8000-000000003121','00000000-0000-4000-8000-000000003122','00000000-0000-4000-8000-000000003123','00000000-0000-4000-8000-000000003124');
select pg_temp.assert_true((select assessment_metadata is null and result ? 'assessment_metadata' from public.checks where id='00000000-0000-4000-8000-000000003122'),'forged legacy marker remains NULL authority');
-- ACLs cover both the table and EVERY column, including newly added authority.
do $$ declare role_name text; c record; begin
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.checks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'table privilege leaked to %',role_name; end if;
  for c in select attname from pg_attribute where attrelid='public.checks'::regclass and attnum>0 and not attisdropped loop
   if has_column_privilege(role_name,'public.checks',c.attname,'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'column privilege leaked: %.%',role_name,c.attname; end if;
  end loop;
 end loop;
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) values (''{}'',''{}'',''{}'')','42501');
select pg_temp.expect_state('insert into public.checks(answers,result) values (''{}'',''{}'')','42501');
select pg_temp.expect_state('select id from public.checks','42501');
select pg_temp.expect_state('select assessment_metadata,owner_token_hash,claimed_by from public.checks','42501');
select pg_temp.expect_state('update public.checks set claimed_by=auth.uid(),claimed_at=now() where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set result=''{}'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.assert_true((select count(*)=1 from public.get_shared_check('00000000-0000-4000-8000-000000003121')),'exact UUID share lookup');
select pg_temp.assert_true((select count(*)=0 from public.get_shared_check('00000000-0000-4000-8000-000000003199')),'missing UUID empty');
select pg_temp.assert_true((select array_agg(key order by key)=array['answers','assessment_metadata','created_at','id','result'] from public.get_shared_check('00000000-0000-4000-8000-000000003121') c cross join lateral jsonb_object_keys(to_jsonb(c)) key),'shared projection has no ownership/profile fields');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003101","app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) values (''{}'',''{}'',''{}'')','42501');
select pg_temp.expect_state('insert into public.checks(answers,result) values (''{}'',''{}'')','42501');
select pg_temp.expect_state('select id from public.checks','42501');
select pg_temp.expect_state('select assessment_metadata,owner_token_hash,claimed_by from public.checks','42501');
select pg_temp.expect_state('update public.checks set claimed_by=auth.uid(),claimed_at=now() where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set result=''{}'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.assert_true((select count(*)=1 from public.get_shared_check('00000000-0000-4000-8000-000000003121')),'exact UUID share lookup');
select pg_temp.assert_true((select count(*)=0 from public.get_shared_check('00000000-0000-4000-8000-000000003199')),'missing UUID empty');
select pg_temp.assert_true((select array_agg(key order by key)=array['answers','assessment_metadata','created_at','id','result'] from public.get_shared_check('00000000-0000-4000-8000-000000003121') c cross join lateral jsonb_object_keys(to_jsonb(c)) key),'shared projection has no ownership/profile fields');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{}',true);
-- Real INSERT rejection, not just validator booleans.
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',''{}''::jsonb from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',value || ''{"extra":true}''::jsonb from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{formatVersion}'',''2'') from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{evaluatedAt}'',''"2026-02-30T00:00:00Z"'') from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{engineRevision}'',''"latest"'') from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{selectedVersionIds}'',jsonb_build_array(value->''selectedVersionIds''->0,value->''selectedVersionIds''->0)) from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{selectedVersionIds}'',''["00000000-0000-4000-8000-000000003199"]'') from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{selectedVersionIds}'',''[1]'') from fixture_metadata','23514');
select pg_temp.expect_state('insert into public.checks(answers,result,assessment_metadata) select ''{}'',''{}'',jsonb_set(value,''{evaluatedAt}'',to_jsonb(to_char((now()-interval ''1 microsecond'') at time zone ''UTC'',''YYYY-MM-DD"T"HH24:MI:SS.US"Z"''))) from fixture_metadata','23514');
select pg_temp.expect_state('update public.checks set id=''00000000-0000-4000-8000-000000003198'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set answers=''{"changed":true}'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set result=''{"changed":true}'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set created_at=now()+interval ''1 second'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set owner_token_hash=''replacement'' where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set assessment_metadata=null where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set assessment_metadata=(select value from fixture_metadata) where id=''00000000-0000-4000-8000-000000003122''','42501');
select pg_temp.expect_state('update public.checks set claimed_by=''00000000-0000-4000-8000-000000003102'',claimed_at=now() where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('delete from public.checks where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('truncate public.checks','42501');
reset role;
-- Even a drifted TRUNCATE grant cannot erase rows hidden by browser RLS.
grant truncate on public.checks to anon,authenticated;
set local role anon;
select pg_temp.expect_state('truncate public.checks','42501');
reset role;
set local role authenticated;
select pg_temp.expect_state('truncate public.checks','42501');
reset role;
revoke truncate on public.checks from anon,authenticated;
-- Original input/authority freezes also apply to owner context, including legacy upgrades.
select pg_temp.expect_state('update public.checks set claimed_by=null where id=''00000000-0000-4000-8000-000000003123''','42501');
select pg_temp.expect_state('update public.checks set assessment_metadata=(select value from fixture_metadata) where id=''00000000-0000-4000-8000-000000003122''','42501');
select pg_temp.expect_state('update public.checks set claimed_by=null,claimed_at=null where id=''00000000-0000-4000-8000-000000003123''','42501');
select pg_temp.expect_state('delete from public.checks where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('truncate public.checks','42501');
-- Preserve original V1 body after a real V2 publication, no new check snapshot store.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003101","app_metadata":{"role":"admin"}}',true);
update public.rule_drafts set raw_snapshot=jsonb_set(jsonb_set(raw_snapshot,'{source_quote}','"Replacement literal quote"'),'{conditions}','{"target_degree":"master"}'),intake_from=4053,intake_until=4054
 where rule_id='00000000-0000-4000-8000-000000003111';
select public.publish_rule_version(d.rule_id,d.revision,d.raw_snapshot,v.id,'verified') from public.rule_drafts d join public.rule_versions v on v.rule_id=d.rule_id and v.version_number=1 where d.rule_id='00000000-0000-4000-8000-000000003111';
reset role;
select pg_temp.assert_true((select c.result->>'path'='direct' and v.version_number=1 and v.raw_snapshot->>'source_quote'=' Original literal quote ' from public.checks c join public.rule_versions v on v.id=(c.assessment_metadata->'selectedVersionIds'->>0)::uuid where c.id='00000000-0000-4000-8000-000000003121'),'V1 original verdict and exact evidence remain after V2');
-- Selector/evaluator half-open/intake/no-revival/publication-race behavior is executed
-- in assessment.test.ts + versioning.test.ts, not imitated by a second SQL engine.
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true(public.result_viewer('00000000-0000-4000-8000-000000003121','synthetic-history-token')='anonymous_owner','unclaimed anonymous owner');
select pg_temp.assert_true(public.result_viewer('00000000-0000-4000-8000-000000003121','wrong')='public','wrong token public');
select pg_temp.expect_state('select public.claim_check(''00000000-0000-4000-8000-000000003121'',''synthetic-history-token'')','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true(not public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'claim requires actor');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003198"}',true);
select pg_temp.assert_true(not public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'claim requires extant actor');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003102"}',true);
select pg_temp.assert_true(not public.claim_check('00000000-0000-4000-8000-000000003121','wrong'),'wrong token rejected');
reset role;
-- Inject profile-copy failure and assert the ENTIRE claim transaction rolled back.
create function pg_temp.fail_profile_copy() returns trigger language plpgsql as $$
begin raise exception using errcode='P0001',message='synthetic profile-copy failure'; end; $$;
create trigger synthetic_history_profile_fault before insert or update on public.profiles for each row execute function pg_temp.fail_profile_copy();
set local role authenticated;
select pg_temp.expect_state('select public.claim_check(''00000000-0000-4000-8000-000000003121'',''synthetic-history-token'')','P0001');
reset role;
drop trigger synthetic_history_profile_fault on public.profiles;
select pg_temp.assert_true((select claimed_by is null and claimed_at is null from public.checks where id='00000000-0000-4000-8000-000000003121') and not exists(select 1 from public.profiles where user_id='00000000-0000-4000-8000-000000003102'),'failed copy left unclaimed row and no profile');
set local role authenticated;
select pg_temp.assert_true(public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'legitimate first claim');
select pg_temp.assert_true(public.result_viewer('00000000-0000-4000-8000-000000003121',null)='claimed_owner','claimed owner view');
reset role;
create temp table claimed_once as select to_jsonb(c) payload from public.checks c where id='00000000-0000-4000-8000-000000003121';
create temp table profile_once as select to_jsonb(p) payload from public.profiles p where user_id='00000000-0000-4000-8000-000000003102';
set local role authenticated;
select pg_temp.assert_true(public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'same owner idempotent');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003103"}',true);
select pg_temp.assert_true(not public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'competing owner rejected sequentially');
select pg_temp.assert_true(public.result_viewer('00000000-0000-4000-8000-000000003123',null)='claimed_owner','signed-in initial ownership');
reset role;
select pg_temp.assert_true((select to_jsonb(c)=o.payload from public.checks c cross join claimed_once o where c.id='00000000-0000-4000-8000-000000003121'),'idempotent and competing claim leave row identical');
select pg_temp.assert_true((select to_jsonb(p)=o.payload from public.profiles p cross join profile_once o where p.user_id='00000000-0000-4000-8000-000000003102'),'idempotent and competing claim leave profile identical');
select pg_temp.assert_true((select p.answers=c.answers from public.profiles p join public.checks c on c.claimed_by=p.user_id where c.id='00000000-0000-4000-8000-000000003121'),'profile copied original answers');
select set_config('request.jwt.claims','{}',true);
delete from auth.users where id='00000000-0000-4000-8000-000000003102';
select pg_temp.assert_true((select claimed_by is null and claimed_at is not null from public.checks where id='00000000-0000-4000-8000-000000003121'),'account deletion succeeds and retains tombstone');
select pg_temp.assert_true((select c.claimed_at=(o.payload->>'claimed_at')::timestamptz from public.checks c cross join claimed_once o where c.id='00000000-0000-4000-8000-000000003121'),'claim timestamp retained exactly');
set local role anon;
select pg_temp.assert_true(public.result_viewer('00000000-0000-4000-8000-000000003121','synthetic-history-token')='public','old token cannot reopen tombstone');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000003103"}',true);
select pg_temp.assert_true(not public.claim_check('00000000-0000-4000-8000-000000003121','synthetic-history-token'),'new account cannot reclaim tombstone');
reset role;
set local role service_role;
select pg_temp.expect_state('update public.checks set claimed_at=null where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.expect_state('update public.checks set claimed_by=''00000000-0000-4000-8000-000000003103'' where id=''00000000-0000-4000-8000-000000003121''','42501');
reset role;
select pg_temp.expect_state('update public.checks set claimed_at=null where id=''00000000-0000-4000-8000-000000003121''','42501');
select pg_temp.assert_true(not exists(select 1 from public.checks c join original_checks o on o.id=c.id where to_jsonb(c)-'claimed_by'-'claimed_at' is distinct from o.payload),'ALL original payloads byte-equivalent JSONB across claims/account deletion');
select pg_temp.assert_true((select to_jsonb(t)=p.payload from public.tasks t join preserved_progress p on p.kind='task' where t.id='00000000-0000-4000-8000-000000003143'),'personal task done/text/date/logical key unchanged');
select pg_temp.assert_true((select to_jsonb(a)=p.payload from public.applications a join preserved_progress p on p.kind='application' where a.id='00000000-0000-4000-8000-000000003142'),'application unchanged');
rollback;
