-- Synthetic fixtures ONLY. Root runs this on a migrated disposable DB, never linked/live.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/course_reconciliation_audit.sql <disposable connection>
-- No credentials, academic assertions, permanent fixture data or permission changes survive.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end; $$;
create function pg_temp.expect_state(command text, expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute command; exception when others then get stacked diagnostics caught = returned_sqlstate; end;
  if caught is distinct from expected then raise exception 'expected SQLSTATE %, got % for %',expected,caught,command; end if;
end; $$;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000901','reconciliation-admin@example.invalid'),
('00000000-0000-4000-8000-000000000902','reconciliation-owner@example.invalid');
insert into public.courses(id,source_url,normalized_url,name,university_name,review_status,imported_by) values
('00000000-0000-4000-8000-000000000911','https://www.daad.de/synthetic-audit-canonical','https://www.daad.de/synthetic-audit-canonical','Synthetic Computing','Synthetic University','approved','00000000-0000-4000-8000-000000000902'),
('00000000-0000-4000-8000-000000000912','https://www.daad.de/synthetic-audit-other','https://www.daad.de/synthetic-audit-other','Other Synthetic Computing','Synthetic University','approved','00000000-0000-4000-8000-000000000902'),
('00000000-0000-4000-8000-000000000915','https://www.daad.de/synthetic-audit-pending','https://www.daad.de/synthetic-audit-pending','Synthetic Computing','Synthetic University','pending','00000000-0000-4000-8000-000000000902');
create temp table reconciliation_fixture(draft jsonb not null, keys text[] not null, decisions jsonb not null);
insert into reconciliation_fixture
select jsonb_build_object(
  'format','up-course-01/v1','status','incomplete',
  'identity',jsonb_build_object('name','Synthetic Computing','university','Synthetic University','source_url','https://www.daad.de/synthetic-audit-submission'),
  'observations',jsonb_build_array(
    jsonb_build_object('url','https://www.daad.de/synthetic-audit-submission','origin','web','retrieved_at',captured,
      'content',E'Synthetic Computing Synthetic University Winter 2027 Non-EU applicants\nIELTS 6.5.\n[University](https://synthetic-university.de/application.pdf)'),
    jsonb_build_object('url','https://synthetic-university.de/application.pdf','origin','web','retrieved_at',captured,'content','Synthetic instruction: certified transcript.')
  ),
  'offerings',jsonb_build_array(jsonb_build_object(
    'intake_term','winter','intake_year',2027,'applicant_group','Non-EU applicants',
    'applicability',jsonb_build_object('source_scope','Winter 2027 Non-EU applicants'),
    'scope',jsonb_build_object('source_url','https://www.daad.de/synthetic-audit-submission','source_quote','Winter 2027 Non-EU applicants'),
    'facts',jsonb_build_array(
      jsonb_build_object('key','english','kind','language','status','pending','verbatim','IELTS 6.5.','applicability','Non-EU applicants',
        'route',null,'deadline_kind',null,'date',null,'time',null,'timezone',null,
        'evidence',jsonb_build_array(jsonb_build_object('source_url','https://www.daad.de/synthetic-audit-submission','source_quote','IELTS 6.5.',
          'retrieved_at',captured,'last_verified_at',null,'verified_by',null,'source_hash',null))),
      jsonb_build_object('key','document','kind','document','status','pending','verbatim','Synthetic instruction: certified transcript.','applicability','Non-EU applicants',
        'route',null,'deadline_kind',null,'date',null,'time',null,'timezone',null,
        'evidence',jsonb_build_array(jsonb_build_object('source_url','https://synthetic-university.de/application.pdf','source_quote','Synthetic instruction: certified transcript.',
          'retrieved_at',captured,'last_verified_at',null,'verified_by',null,'source_hash',null)))
    )
  )), 'conflicts','[]'::jsonb,'issues','[]'::jsonb
),array['english'],jsonb_build_array(jsonb_build_object('key','english','reason','Synthetic test only: compared full stored captures and reconciled field applicability.'))
from (select to_char((clock_timestamp()-interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') captured) capture;
grant select on reconciliation_fixture to authenticated, anon;
-- Owner inserts valid pending data AND a fake sibling journal. No trusted history results.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000902","app_metadata":{}}',true);
insert into public.courses(id,source_url,normalized_url,name,university_name,review_status,imported_by,conflicts_with,field_extraction)
select '00000000-0000-4000-8000-000000000913','https://www.daad.de/synthetic-audit-submission','https://www.daad.de/synthetic-audit-submission',
  'Synthetic Computing','Synthetic University','pending','00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000911',
  jsonb_build_object('research',draft,'research_reconciliations',jsonb_build_array(jsonb_build_object('marker','owner-fake','reviewed_by','00000000-0000-4000-8000-000000000901','reviewed_at','2099-01-01T00:00:00Z')))
from reconciliation_fixture;
select pg_temp.expect_state($q$insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,course_reconciliation) values ('00000000-0000-4000-8000-000000000901','courses','00000000-0000-4000-8000-000000000911','update','{"fake":true}')$q$,'42501');
select pg_temp.assert_true((select count(*)=0 from public.admin_audit_events),'nonadmin cannot read protected audit history');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
insert into public.programmes(id,legacy_course_id,name,university_name,source_url) values
('00000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000911','Synthetic Computing','Synthetic University','https://www.daad.de/synthetic-audit-submission'),
('00000000-0000-4000-8000-000000000922','00000000-0000-4000-8000-000000000912','Other Synthetic Computing','Synthetic University','https://www.daad.de/synthetic-audit-other');
insert into public.course_offerings(id,programme_id,intake_term,intake_year,applicant_group,applicability) values
('00000000-0000-4000-8000-000000000931','00000000-0000-4000-8000-000000000921','winter',2027,'Non-EU applicants','{"source_scope":"Winter 2027 Non-EU applicants"}'),
('00000000-0000-4000-8000-000000000932','00000000-0000-4000-8000-000000000922','winter',2027,'Non-EU applicants','{"source_scope":"Winter 2027 Non-EU applicants"}');
insert into public.course_offering_versions(offering_id,version,facts)
select '00000000-0000-4000-8000-000000000931',1,draft->'offerings'->0->'facts' from reconciliation_fixture;
update public.programmes set degree='Synthetic audit fixture' where id='00000000-0000-4000-8000-000000000921';
reset role;
create function pg_temp.publish_fixture(version integer) returns jsonb language sql as $publish$
  select to_jsonb(public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,version,keys,decisions,(select field_extraction->'research' from public.courses where id='00000000-0000-4000-8000-000000000913'))) from reconciliation_fixture
$publish$;
create function pg_temp.reject_draft(path text[], value jsonb) returns void language plpgsql as $$
begin
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',jsonb_set((select draft from reconciliation_fixture),path,value)) where id='00000000-0000-4000-8000-000000000913';
  perform pg_temp.expect_state('select pg_temp.publish_fixture(2)','23514');
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',(select draft from reconciliation_fixture)) where id='00000000-0000-4000-8000-000000000913';
end; $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_state('select pg_temp.publish_fixture(2)','42501');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000902","app_metadata":{}}',true);
select pg_temp.expect_state('select pg_temp.publish_fixture(2)','42501');
-- An authenticated role with no user cannot execute even with a forged admin claim.
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_state('select pg_temp.publish_fixture(2)','42501');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_state($q$insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,course_reconciliation) values ('00000000-0000-4000-8000-000000000901','courses','00000000-0000-4000-8000-000000000911','update','{"fake":true}')$q$,'42501');
select pg_temp.expect_state($q$update public.admin_audit_events set course_reconciliation='{"fake":true}'$q$,'42501');
select pg_temp.expect_state('delete from public.admin_audit_events','42501');
select pg_temp.assert_true(not has_function_privilege('anon','public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb,jsonb)','execute'),'anon/public execution revoked');
select pg_temp.assert_true(not has_function_privilege('service_role','public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb,jsonb)','execute'),'no service-role execution grant');
select pg_temp.assert_true((select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid='public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb,jsonb)'::regprocedure),'fixed search path');
select pg_temp.assert_true(to_regprocedure('public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb)') is null,'no old revision-free overload');
-- No caller-provided observations/actor/time parameter exists.
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,array['english'],'[]'::jsonb,(select draft from reconciliation_fixture),'{"reviewed_by":"forged","observations":[]}'::jsonb)$q$,'42883');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000932',0,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000931',0,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
update public.courses set field_extraction=jsonb_build_object('research',(select draft from reconciliation_fixture)) where id='00000000-0000-4000-8000-000000000915';
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000915','00000000-0000-4000-8000-000000000931',0,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',1,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,0,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,array['unknown'],jsonb_build_array(jsonb_build_object('key','unknown','reason','Synthetic unsupported key must not publish.')),(select draft from reconciliation_fixture))$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,array['english','english'],decisions,draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,keys,'[]',draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,keys,jsonb_set(decisions,'{0,reason}','"short"'),draft) from reconciliation_fixture$q$,'23514');
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,keys,jsonb_set(decisions,'{0,reviewed_by}','"00000000-0000-4000-8000-000000000902"'),draft) from reconciliation_fixture$q$,'23514');
select pg_temp.reject_draft('{identity,name}','"Wrong synthetic identity"');
select pg_temp.reject_draft('{offerings,0,intake_year}','2030');
select pg_temp.reject_draft('{offerings,0,applicant_group}','"EU applicants"');
select pg_temp.reject_draft('{offerings,0,applicability,source_scope}','"Fabricated scope"');
select pg_temp.reject_draft('{offerings,0,scope,source_quote}','"Fabricated scope"');
select pg_temp.reject_draft('{offerings,0,facts,0,evidence,0,source_quote}','"Fabricated quote"');
select pg_temp.reject_draft('{offerings,0,facts,0,evidence,0,verified_by}','"00000000-0000-4000-8000-000000000902"');
select pg_temp.reject_draft('{offerings,0,facts,0,date}','"2027-05-01"');
select pg_temp.reject_draft('{offerings,0,facts,0,evidence,0,retrieved_at}','"2027-02-30T00:00:00Z"');

-- Required raw revision token and boundary shapes: each failed call is a subtransaction.
do $boundary$
declare supplied text; command text; caught text; detail text; path text[]; edited jsonb;
begin
  foreach supplied in array array['null::jsonb', '''null''::jsonb', '''[]''::jsonb', '''"caller facts"''::jsonb', 'jsonb_set(draft,''{status}'',''"caller supplied"'')'] loop
    command := 'select public.publish_course_research_version(''00000000-0000-4000-8000-000000000913'',''00000000-0000-4000-8000-000000000931'',0,2,keys,decisions,' || supplied || ') from reconciliation_fixture';
    caught:=null; detail:=null;
    begin execute command; exception when others then get stacked diagnostics caught=returned_sqlstate, detail=message_text; end;
    perform pg_temp.assert_true(caught='23514' and detail='research changed; reload and review again','invalid/caller-supplied token rejected');
  end loop;
  foreach supplied in array array['null::text[]','array[null]::text[]','array['''']::text[]','array[[''english'']]::text[]'] loop
    perform pg_temp.expect_state('select public.publish_course_research_version(''00000000-0000-4000-8000-000000000913'',''00000000-0000-4000-8000-000000000931'',0,2,' || supplied || ',decisions,draft) from reconciliation_fixture','23514');
  end loop;
  foreach supplied in array array['null::jsonb','''null''::jsonb','''{}''::jsonb','''[null]''::jsonb','decisions->0 - ''reason''','jsonb_build_array(decisions->0 - ''reason'')','jsonb_build_array(decisions->0 - ''key'')','jsonb_set(decisions,''{0,key}'',''null'')','jsonb_set(decisions,''{0,reason}'',''null'')'] loop
    perform pg_temp.expect_state('select public.publish_course_research_version(''00000000-0000-4000-8000-000000000913'',''00000000-0000-4000-8000-000000000931'',0,2,keys,' || supplied || ',draft) from reconciliation_fixture','23514');
  end loop;
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,keys,decisions) from reconciliation_fixture$q$,'42883');
  perform pg_temp.expect_state($q$select public.publish_course_research_version(p_submitted_course_id=>'00000000-0000-4000-8000-000000000913',p_offering_id=>'00000000-0000-4000-8000-000000000931',p_offering_index=>0,p_version=>2,p_decisions=>decisions,p_expected_research=>draft) from reconciliation_fixture$q$,'42883');
  perform pg_temp.expect_state($q$select public.publish_course_research_version(p_submitted_course_id=>'00000000-0000-4000-8000-000000000913',p_offering_id=>'00000000-0000-4000-8000-000000000931',p_offering_index=>0,p_version=>2,p_accepted_keys=>keys,p_expected_research=>draft) from reconciliation_fixture$q$,'42883');
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,'malformed'::text[],decisions,draft) from reconciliation_fixture$q$,'22P02');

  perform pg_temp.expect_state($q$select public.publish_course_research_version(null,'00000000-0000-4000-8000-000000000931',0,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913',null,0,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',null,2,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,null,keys,decisions,draft) from reconciliation_fixture$q$,'23514');
  foreach path slice 1 in array array[
    array['offerings','0','facts','0','verbatim'], array['offerings','0','facts','0','evidence'],
    array['observations','0','content',null,null], array['offerings','0','scope',null,null], array['conflicts',null,null,null,null]
  ] loop
    path:=array_remove(path,null);
    edited:=jsonb_set((select draft from reconciliation_fixture),path,'"changed after initial read"');
    update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',edited) where id='00000000-0000-4000-8000-000000000913';
    caught:=null; detail:=null;
    begin
      perform public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,keys,decisions,draft) from reconciliation_fixture;
    exception when others then get stacked diagnostics caught=returned_sqlstate, detail=message_text; end;
    perform pg_temp.assert_true(caught='23514' and detail='research changed; reload and review again','stale fact/evidence/observation/scope/conflict token rejected before interpretation');
    perform pg_temp.assert_true((select count(*)=1 from public.course_offering_versions where offering_id='00000000-0000-4000-8000-000000000931'),'stale token creates no version');
    perform pg_temp.assert_true((select count(*)=0 from public.admin_audit_events where course_reconciliation is not null),'stale token creates no journal');
    update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',(select draft from reconciliation_fixture)) where id='00000000-0000-4000-8000-000000000913';
  end loop;
end $boundary$;

-- A stored known capture conflict cannot be selected under a new alias, even with a decision.
do $conflict$ declare edited jsonb; pending jsonb; alternatives jsonb; begin
  edited:=(select draft from reconciliation_fixture);
  pending:=edited->'offerings'->0->'facts'->0;
  alternatives:=jsonb_build_array(jsonb_build_object('key','english','kind','language','verbatim','IELTS 6.5.','applicability','Non-EU applicants','route',null,'deadline_kind',null,'evidence',jsonb_build_array(jsonb_build_object('source_url','https://www.daad.de/synthetic-audit-submission','source_quote','IELTS 6.5.'))),
    jsonb_build_object('key','other','kind','language','verbatim','IELTS 7.0.','applicability','Non-EU applicants','route',null,'deadline_kind',null,'evidence',jsonb_build_array(jsonb_build_object('source_url','https://www.daad.de/synthetic-audit-submission','source_quote','IELTS 7.0.'))));
  edited:=jsonb_set(edited,'{observations,0,content}',to_jsonb((edited->'observations'->0->>'content') || E'\nIELTS 7.0.'));
  edited:=jsonb_set(edited,'{conflicts}',jsonb_build_array(jsonb_build_object('offering',0,'key','english','alternatives',alternatives)));
  edited:=jsonb_set(edited,'{offerings,0,facts}',jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(pending,'{status}','"unresolved"'),'{verbatim}','null'),'{evidence}',(pending->'evidence') || jsonb_build_array(jsonb_set(pending->'evidence'->0,'{source_quote}','"IELTS 7.0."'))),jsonb_set(pending,'{key}','"alias"')));
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',edited) where id='00000000-0000-4000-8000-000000000913';
  perform pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000931',0,2,array['alias'],'[{"key":"alias","reason":"Explicit reconciliation cannot settle the retained source conflict."}]',(select field_extraction->'research' from public.courses where id='00000000-0000-4000-8000-000000000913'))$q$,'23514');
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',(select draft from reconciliation_fixture)) where id='00000000-0000-4000-8000-000000000913';
end $conflict$;
-- Existing chronology still rejects a genuinely future retrieval; server review time isn't inflated.
do $$ declare future text; edited jsonb; begin
  future:=to_char((clock_timestamp()+interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  edited:=jsonb_set(jsonb_set((select draft from reconciliation_fixture),'{observations,0,retrieved_at}',to_jsonb(future)),'{offerings,0,facts,0,evidence,0,retrieved_at}',to_jsonb(future));
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',edited) where id='00000000-0000-4000-8000-000000000913';
  perform pg_temp.expect_state('select pg_temp.publish_fixture(2)','23514');
  update public.courses set field_extraction=jsonb_set(field_extraction,'{research}',(select draft from reconciliation_fixture)) where id='00000000-0000-4000-8000-000000000913';
end $$;
select pg_temp.assert_true((select count(*)=0 from public.admin_audit_events where course_reconciliation is not null and row_id='00000000-0000-4000-8000-000000000911'),'all rejection paths leave no trusted journal');
select pg_temp.assert_true((select count(*)=1 from public.course_offering_versions where offering_id='00000000-0000-4000-8000-000000000931'),'all rejection paths leave only original pending snapshot');
select pg_temp.publish_fixture(2);
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_events where course_reconciliation is not null and row_id='00000000-0000-4000-8000-000000000911'),'one genuine event; owner fake never imported');
select pg_temp.assert_true((select field_extraction->'research_reconciliations'->0->>'marker'='owner-fake' from public.courses where id='00000000-0000-4000-8000-000000000913'),'original untrusted JSON remains verbatim');
select pg_temp.assert_true((select a.actor_user_id='00000000-0000-4000-8000-000000000901' and a.created_at=v.reviewed_at and v.reviewed_by=a.actor_user_id
  and a.course_reconciliation->>'reviewed_by'=a.actor_user_id::text
  and (a.course_reconciliation->>'reviewed_at')::timestamptz=a.created_at
  and a.course_reconciliation->'version'=jsonb_build_object('id',v.id,'offering_id',v.offering_id,'version',v.version)
  and a.course_reconciliation->'observations'=f.draft->'observations'
  and a.course_reconciliation->'identity'=f.draft->'identity'
  and a.course_reconciliation->'scope'=(f.draft->'offerings'->0) - 'facts'
  and a.course_reconciliation->'decisions'=f.decisions and a.course_reconciliation->'accepted_keys'=to_jsonb(f.keys)
  from public.admin_audit_events a join public.course_offering_versions v on v.id=(a.course_reconciliation->'version'->>'id')::uuid cross join reconciliation_fixture f
  where a.row_id='00000000-0000-4000-8000-000000000911' and a.course_reconciliation is not null),'DB actor/time/captures/identity/scope/decisions/exact version links');
select pg_temp.assert_true((select v.facts->0->>'status'='verified'
  and v.facts->0->'evidence'->0->>'verified_by'=v.reviewed_by::text
  and (v.facts->0->'evidence'->0->>'last_verified_at')::timestamptz=v.reviewed_at
  and (v.facts->0->'evidence'->0) - array['verified_by','last_verified_at']=(f.draft->'offerings'->0->'facts'->0->'evidence'->0) - array['verified_by','last_verified_at']
  and v.facts->1->>'status'='unresolved' and v.facts->1->'verbatim'='null'::jsonb
  and v.facts->1->'evidence'=f.draft->'offerings'->0->'facts'->1->'evidence'
  and v.facts->0->'date'='null'::jsonb and v.facts->1->'date'='null'::jsonb
  from public.course_offering_versions v cross join reconciliation_fixture f where v.offering_id='00000000-0000-4000-8000-000000000931' and v.version=2),'narrow timestamp binding preserves literal capture; unknown fields remain unverified');
reset role;
create temp table reconciliation_history_before as select * from public.admin_audit_events;
create temp table reconciliation_versions_before as select * from public.course_offering_versions where offering_id='00000000-0000-4000-8000-000000000931';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
insert into public.course_offering_versions(offering_id,version,facts) select '00000000-0000-4000-8000-000000000931',3,draft->'offerings'->0->'facts' from reconciliation_fixture;
select pg_temp.publish_fixture(4);
reset role;
select pg_temp.assert_true(not exists(select * from reconciliation_history_before except select * from public.admin_audit_events),'all genuine prior history/status/programme payloads preserved');
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_events where row_id='00000000-0000-4000-8000-000000000921' and programme_correction->'new'->>'degree'='Synthetic audit fixture' and course_reconciliation is null),'existing programme_correction payload preserved independently');
select pg_temp.assert_true(not exists(select * from reconciliation_versions_before except select * from public.course_offering_versions),'original versions untouched');
select pg_temp.assert_true((select count(*)=2 from public.admin_audit_events where course_reconciliation is not null and row_id='00000000-0000-4000-8000-000000000911'),'repeat adds only a new genuine event');
-- Inject failures inside each write boundary. Both statements belong to the RPC transaction.
create function pg_temp.reject_reconciliation_audit() returns trigger language plpgsql as $$
begin if new.course_reconciliation is not null and new.row_id='00000000-0000-4000-8000-000000000911' then raise insufficient_privilege using message='synthetic audit write denial'; end if; return new; end; $$;
create trigger test_reconciliation_audit_failure before insert on public.admin_audit_events for each row execute function pg_temp.reject_reconciliation_audit();
set local role authenticated;
select pg_temp.expect_state('select pg_temp.publish_fixture(5)','42501');
reset role;
select pg_temp.assert_true((select count(*)=4 from public.course_offering_versions where offering_id='00000000-0000-4000-8000-000000000931'),'audit failure rolls back newly inserted version');
select pg_temp.assert_true((select count(*)=2 from public.admin_audit_events where course_reconciliation is not null and row_id='00000000-0000-4000-8000-000000000911'),'audit failure leaves no event');
drop trigger test_reconciliation_audit_failure on public.admin_audit_events;
create function pg_temp.reject_reconciliation_version() returns trigger language plpgsql as $$
begin if new.offering_id='00000000-0000-4000-8000-000000000931' and new.version=5 then raise check_violation using message='synthetic version write failure'; end if; return new; end; $$;
create trigger test_reconciliation_version_failure before insert on public.course_offering_versions for each row execute function pg_temp.reject_reconciliation_version();
set local role authenticated;
select pg_temp.expect_state('select pg_temp.publish_fixture(5)','23514');
select pg_temp.expect_state('select pg_temp.publish_fixture(2)','23514');
reset role;
select pg_temp.assert_true((select count(*)=4 from public.course_offering_versions where offering_id='00000000-0000-4000-8000-000000000931'),'version failure/duplicate leaves snapshots unchanged');
select pg_temp.assert_true((select count(*)=2 from public.admin_audit_events where course_reconciliation is not null and row_id='00000000-0000-4000-8000-000000000911'),'version failure leaves no orphan journal');
select pg_temp.assert_true((select review_status='pending' and conflicts_with='00000000-0000-4000-8000-000000000911' from public.courses where id='00000000-0000-4000-8000-000000000913'),'RPC does not modify submission/canonical lifecycle');

-- Initial publication uses the approved canonical row itself. The exact RAW snapshot
-- survives identity approval and unrelated metadata/updated_at changes.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
insert into public.courses(id,source_url,normalized_url,name,university_name,review_status,imported_by,field_extraction,updated_at) select '00000000-0000-4000-8000-000000000916','https://www.daad.de/synthetic-audit-initial','https://www.daad.de/synthetic-audit-initial','Synthetic Computing','Synthetic University','pending','00000000-0000-4000-8000-000000000902',jsonb_build_object('research',draft,'unrelated','before approval'),'2000-01-01T00:00:00Z'::timestamptz from reconciliation_fixture;
reset role;
create temp table initial_research_snapshot as select field_extraction->'research' expected, updated_at previous_updated_at from public.courses where id='00000000-0000-4000-8000-000000000916';
grant select on initial_research_snapshot to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
update public.courses set review_status='approved',field_extraction=jsonb_set(field_extraction,'{unrelated}','"after approval"') where id='00000000-0000-4000-8000-000000000916';
insert into public.programmes(id,legacy_course_id,name,university_name,source_url) values
('00000000-0000-4000-8000-000000000923','00000000-0000-4000-8000-000000000916','Synthetic Computing','Synthetic University','https://www.daad.de/synthetic-audit-submission');
insert into public.course_offerings(id,programme_id,intake_term,intake_year,applicant_group,applicability) values
('00000000-0000-4000-8000-000000000933','00000000-0000-4000-8000-000000000923','winter',2027,'Non-EU applicants','{"source_scope":"Winter 2027 Non-EU applicants"}');
-- Same raw token, wrong programme relationship: not merely a token failure.
select pg_temp.expect_state($q$select public.publish_course_research_version('00000000-0000-4000-8000-000000000916','00000000-0000-4000-8000-000000000931',0,1,keys,decisions,expected) from reconciliation_fixture cross join initial_research_snapshot$q$,'23514');
select public.publish_course_research_version('00000000-0000-4000-8000-000000000916','00000000-0000-4000-8000-000000000933',0,1,keys,decisions,expected) from reconciliation_fixture cross join initial_research_snapshot;
select pg_temp.assert_true((select c.review_status='approved' and c.field_extraction->>'unrelated'='after approval' and c.field_extraction->'research'=s.expected and c.updated_at is distinct from s.previous_updated_at from public.courses c cross join initial_research_snapshot s where c.id='00000000-0000-4000-8000-000000000916'),'identity approval and unrelated metadata preserve exact research token');
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_events where row_id='00000000-0000-4000-8000-000000000916' and course_reconciliation->>'submitted_course_id'='00000000-0000-4000-8000-000000000916'),'same-row canonical publication journals initial version');
reset role;
create temp table durable_journal_before as select id,created_at,course_reconciliation from public.admin_audit_events where course_reconciliation is not null;
create temp table durable_versions_before as select * from public.course_offering_versions where review_status='verified' and offering_id in ('00000000-0000-4000-8000-000000000931','00000000-0000-4000-8000-000000000933');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000901","app_metadata":{"role":"admin"}}',true);
select public.resolve_course_conflict('00000000-0000-4000-8000-000000000913',false);
reset role;
select pg_temp.assert_true(not exists(select 1 from public.courses where id='00000000-0000-4000-8000-000000000913'),'keep-original deletes submitted row');
select pg_temp.assert_true(not exists(select id,created_at,course_reconciliation from durable_journal_before except select id,created_at,course_reconciliation from public.admin_audit_events),'deleted submission cannot erase full immutable journal');
select pg_temp.assert_true((select count(*)=2 from public.admin_audit_events a cross join reconciliation_fixture f where a.row_id='00000000-0000-4000-8000-000000000911'
  and a.course_reconciliation->>'submitted_course_id'='00000000-0000-4000-8000-000000000913'
  and a.course_reconciliation->'observations'=f.draft->'observations' and a.course_reconciliation->'identity'=f.draft->'identity'
  and a.course_reconciliation->'decisions'=f.decisions
  and exists(select 1 from public.course_offering_versions v where v.id=(a.course_reconciliation->'version'->>'id')::uuid and v.offering_id=(a.course_reconciliation->'version'->>'offering_id')::uuid and v.version=(a.course_reconciliation->'version'->>'version')::integer)),'keep-original retains captures/submitted ID/identity/decisions/version links');
-- Account deletion nulls the audit actor FK, but never the immutable payload or
-- version reviewer UUID. Run last, with root role, so no deleted actor is reused.
delete from auth.users where id='00000000-0000-4000-8000-000000000901';
select pg_temp.assert_true(not exists(select id,created_at,course_reconciliation from durable_journal_before except select id,created_at,course_reconciliation from public.admin_audit_events),'reviewer deletion preserves exact payload and review time');
select pg_temp.assert_true(not exists(select * from durable_versions_before except select * from public.course_offering_versions),'reviewer deletion preserves immutable version reviewer UUID/time/facts');
select pg_temp.assert_true((select count(*)=3 from public.admin_audit_events where course_reconciliation is not null and actor_user_id is null and course_reconciliation->>'reviewed_by'='00000000-0000-4000-8000-000000000901' and (course_reconciliation->>'reviewed_at')::timestamptz=created_at),'deleted reviewer remains attributable in durable payload');

rollback;
