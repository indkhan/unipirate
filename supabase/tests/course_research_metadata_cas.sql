-- Synthetic fixtures only: root runs on a fully migrated disposable DB, never linked/live.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/course_research_metadata_cas.sql <disposable connection>
-- Everything rolls back. This fixture does not publish research or call providers.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end; $$;
create function pg_temp.expect_rejected(command text, state text, label text) returns void language plpgsql as $$
declare caught text; before_rows jsonb; after_rows jsonb;
begin
  select jsonb_agg(to_jsonb(c) order by id) into before_rows from public.courses c where id::text like '00000000-0000-4000-8000-00000000121%';
  begin execute command; exception when others then get stacked diagnostics caught = returned_sqlstate; end;
  select jsonb_agg(to_jsonb(c) order by id) into after_rows from public.courses c where id::text like '00000000-0000-4000-8000-00000000121%';
  perform pg_temp.assert_true(caught = state, label || ': expected SQLSTATE ' || state || ', got ' || coalesce(caught, 'success'));
  perform pg_temp.assert_true(before_rows is not distinct from after_rows, label || ': no mutation, including updated_at');
end; $$;

insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000001201','metadata-cas-admin@example.invalid'),
('00000000-0000-4000-8000-000000001202','metadata-cas-owner@example.invalid');
create temp table cas_fixture as
select jsonb_build_object('research',jsonb_build_object(
  'format','up-course-01/v1','status','incomplete',
  'identity',jsonb_build_object('name','Synthetic Computing','university','Synthetic University','source_url','https://www.daad.de/synthetic-cas'),
  'paste',repeat('Synthetic literal paste ',8000),
  'observations',(select jsonb_agg(jsonb_build_object('url','https://www.daad.de/synthetic-cas','origin','web',
    'retrieved_at','2026-10-07T12:00:00Z','content',rpad('Synthetic Computing Synthetic University capture ' || i,20000,'x')) order by i) from generate_series(1,11) i),
  'offerings','[]'::jsonb,'unscoped','[]'::jsonb,'conflicts','[]'::jsonb,'issues','[]'::jsonb),
  'sibling',jsonb_build_object('capture',repeat('Synthetic sibling ',6000),'literal','[null,false," retain "]'::jsonb),
  'research_reconciliations','[{"forged":true}]'::jsonb) as original;
alter table cas_fixture add column next jsonb;
update cas_fixture set next=jsonb_set(original,'{research,issues}','["Synthetic manual recovery; still pending"]');
grant select on cas_fixture to authenticated, anon;
insert into public.courses(id,source_url,normalized_url,name,university_name,review_status,imported_by,field_extraction,updated_at)
select ('00000000-0000-4000-8000-00000000121' || i)::uuid,'https://www.daad.de/synthetic-cas-' || i,'https://www.daad.de/synthetic-cas-' || i,
  'Synthetic Computing','Synthetic University',case when i in (1,2,7) then 'pending'::public.course_review_status when i=8 then 'rejected'::public.course_review_status else 'approved'::public.course_review_status end,
  '00000000-0000-4000-8000-000000001202'::uuid,
  case when i=4 then null when i=5 then 'null'::jsonb when i=3 then original-'research' when i=7 then '{}'::jsonb else original end,
  '2000-01-01T00:00:00Z'::timestamptz from cas_fixture cross join generate_series(1,8) i;

-- Grants, safe path and invoker mode are part of the executable contract.
select pg_temp.assert_true((select not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text)'::regprocedure),'invoker with fixed empty search_path');
select pg_temp.assert_true(has_function_privilege('authenticated','public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text)','EXECUTE'),'authenticated grant');
select pg_temp.assert_true(not has_function_privilege('anon','public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text)','EXECUTE'),'anon denied grant');
select pg_temp.assert_true(not has_function_privilege('service_role','public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text)','EXECUTE'),'no service-role escalation');

create temp table cas_baseline as select (select count(*) from public.course_offering_versions) versions, (select count(*) from public.admin_audit_events where course_reconciliation is not null) journals;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001201","app_metadata":{"role":"admin"}}',true);
-- Large payloads are neither capped nor truncated; returned row is the actual stored row.
do $$ declare returned public.courses; begin
  returned := public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',(select original from cas_fixture),false,(select next from cas_fixture),'recovery');
  perform pg_temp.assert_true(returned.field_extraction=(select next from cas_fixture),'large exact recovery result');
  perform pg_temp.assert_true(to_jsonb(returned)=(select to_jsonb(c) from public.courses c where id=returned.id),'actual updated course returned');
  perform pg_temp.assert_true(returned.review_status='pending' and returned.updated_at>'2000-01-01T00:00:00Z','pending lifecycle and existing timestamp trigger');
  perform pg_temp.assert_true(jsonb_array_length(returned.field_extraction->'research'->'observations')=11 and length(returned.field_extraction->'research'->>'paste')=192000,'all captures and complete paste retained');
  perform pg_temp.assert_true((returned.field_extraction-'research')=(select original-'research' from cas_fixture),'all raw siblings retained');
end; $$;
-- Same raw JSON can be saved again without turning it into reviewed history.
select pg_temp.assert_true((public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',next,false,next,'recovery')).field_extraction=next,'unchanged large metadata save succeeds') from cas_fixture;
-- Concurrent sibling edit between read and CAS makes the old complete snapshot stale.
update public.courses set field_extraction=jsonb_set(field_extraction,'{sibling,literal}','[null,false," newer sibling "]') where id='00000000-0000-4000-8000-000000001212';
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001212',original,false,next,'recovery') from cas_fixture$q$,'23514','stale sibling snapshot');
select pg_temp.assert_true((select field_extraction->'sibling'->'literal'='[null,false," newer sibling "]'::jsonb from public.courses where id='00000000-0000-4000-8000-000000001212'),'new sibling edit survives stale CAS');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',original,false,next,'recovery') from cas_fixture$q$,'23514','stale research snapshot');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',next,false,next-'sibling','recovery') from cas_fixture$q$,'23514','sibling loss');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',next,false,jsonb_set(next,'{research,status}','"verified"'),'recovery') from cas_fixture$q$,'23514','cannot verify by saving');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001216',original,false,next,'recovery') from cas_fixture$q$,'23514','approved recovery forbidden');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001218',original,false,next,'recovery') from cas_fixture$q$,'23514','rejected recovery forbidden');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,next-'sibling'-'research_reconciliations','recovery') from cas_fixture$q$,'23514','unmarked pending row forbidden');

-- Marker path also rejects a concurrent sibling edit using the complete old snapshot.
update public.courses set field_extraction=jsonb_set(field_extraction,'{sibling,literal}','[null,false," marker sibling edit "]') where id='00000000-0000-4000-8000-000000001213';
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',original-'research',false,original,'marker') from cas_fixture$q$,'23514','stale canonical sibling snapshot');
update public.courses set field_extraction=(select original-'research' from cas_fixture) where id='00000000-0000-4000-8000-000000001213';

-- Canonical marker: preserve large siblings and the exact raw research value.
do $$ declare returned public.courses; begin
  returned := public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',(select original-'research' from cas_fixture),false,(select original from cas_fixture),'marker');
  perform pg_temp.assert_true(returned.field_extraction=(select original from cas_fixture) and returned.review_status='approved','canonical marker retains raw draft and siblings');
  perform pg_temp.assert_true(to_jsonb(returned)=(select to_jsonb(c) from public.courses c where id=returned.id),'actual canonical returned');
end; $$;
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',original,false,next,'marker') from cas_fixture$q$,'23514','existing marker cannot be replaced');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','pending canonical forbidden');
update public.courses set review_status='approved',conflicts_with='00000000-0000-4000-8000-000000001213' where id='00000000-0000-4000-8000-000000001217';
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','conflict submission is not canonical');
update public.courses set review_status='pending',conflicts_with=null where id='00000000-0000-4000-8000-000000001217';

-- Change lifecycle after a caller's read while keeping metadata byte-equivalent.
update public.courses set review_status='approved' where id='00000000-0000-4000-8000-000000001211';
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001211',next,false,next,'recovery') from cas_fixture$q$,'23514','lifecycle race');

-- SQL NULL and JSON null are distinct; neither a null flag nor JSON null is a wildcard.
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001214','{}',false,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','object cannot match SQL NULL');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001214','null',false,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','JSON null cannot match SQL NULL');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001215',null,true,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','SQL NULL cannot match JSON null');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001215','null',false,jsonb_build_object('research',original->'research'),'marker') from cas_fixture$q$,'23514','JSON null is not normalized to an empty object');
select pg_temp.assert_true((select field_extraction='null'::jsonb from public.courses where id='00000000-0000-4000-8000-000000001215'),'JSON null remains unchanged');
select pg_temp.assert_true((public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001214',null,true,jsonb_build_object('research',(select original->'research' from cas_fixture)),'marker')).review_status='approved','explicit SQL NULL marker success');

-- Missing/invalid arguments and missing row must fail, never pretend success.
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata(null,'{}',false,'{}','marker')$q$,'23514','missing ID');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001219','{}',false,'{}','marker')$q$,'23514','missing row');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',null,'{}','marker')$q$,'23514','missing null discriminator');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,null,'marker')$q$,'23514','missing new metadata');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,'[]','marker')$q$,'23514','array metadata');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,'{}','publish')$q$,'23514','unsupported mode');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',true,'{}','marker')$q$,'23514','inconsistent null expectation');
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001217','{}',false,'{}',null)$q$,'23514','missing mode');

-- Forced UPDATE exception must roll back the RPC and return no success row.
reset role;
create function pg_temp.fail_metadata_update() returns trigger language plpgsql as $$
begin raise check_violation using message='Synthetic metadata update failure'; end; $$;
create trigger cas_fixture_failure before update on public.courses for each row execute function pg_temp.fail_metadata_update();
set local role authenticated;
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',original,false,next,'recovery') from cas_fixture$q$,'23514','lifecycle guard remains fail closed');
-- Use a fresh pending research row to reach the failing trigger.
reset role;
drop trigger cas_fixture_failure on public.courses;
update public.courses set review_status='pending' where id='00000000-0000-4000-8000-000000001213';
create trigger cas_fixture_failure before update on public.courses for each row execute function pg_temp.fail_metadata_update();
set local role authenticated;
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',original,false,next,'recovery') from cas_fixture$q$,'23514','UPDATE exception rollback');
reset role;
drop trigger cas_fixture_failure on public.courses;

-- Ordinary authenticated importer and anonymous callers cannot use the function.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001202","app_metadata":{}}',true);
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213',original,false,next,'recovery') from cas_fixture$q$,'42501','owner nonadmin denied');
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213','{}',false,'{}','recovery')$q$,'42501','admin role without authenticated identity denied');
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_rejected($q$select public.compare_and_set_course_research_metadata('00000000-0000-4000-8000-000000001213','{}',false,'{}','recovery')$q$,'42501','anonymous execute denied');
reset role;
select pg_temp.assert_true((select count(*)=(select versions from cas_baseline) from public.course_offering_versions),'CAS creates no offering versions');
select pg_temp.assert_true((select count(*)=(select journals from cas_baseline) from public.admin_audit_events where course_reconciliation is not null),'CAS creates no protected publication journal');
rollback;
