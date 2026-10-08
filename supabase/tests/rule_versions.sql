-- UP-RULES-01: synthetic disposable-only gate. No real DB/service execution here.
-- Root: psql -X -v ON_ERROR_STOP=1 -f supabase/tests/rule_versions.sql <disposable connection>
begin;
select set_config('request.jwt.claims','{}',true);
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end; $$;
create function pg_temp.expect_state(command text, expected text) returns void language plpgsql as $$
declare caught text;
begin
  begin execute command; exception when others then get stacked diagnostics caught = returned_sqlstate; end;
  if caught is distinct from expected then raise exception 'expected SQLSTATE %, got % for %',expected,caught,command; end if;
end; $$;
create function pg_temp.assert_denied(command text) returns void language plpgsql as $$
declare affected bigint;
begin
  begin execute command; get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'unauthorized write succeeded: %',command; end if;
  exception when insufficient_privilege then null; end;
end; $$;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000001101','rule-admin@example.invalid'),
('00000000-0000-4000-8000-000000001102','rule-student@example.invalid');
insert into public.rules(id,slug,conditions,outcomes,source_url,source_quote,notes) values
('00000000-0000-4000-8000-000000001111','synthetic-versioning-rule','{"target_degree":"bachelor"}',
'{"path":"unknown","documents":["Synthetic document"],"steps":[{"order":0,"text":"Synthetic step"}],"note":"Synthetic only"}',
'https://example.invalid/rule?literal=1#quote','Synthetic source quote', 'Synthetic note');
insert into public.courses(id,source_url,normalized_url,review_status,imported_by) values
('00000000-0000-4000-8000-000000001121','https://example.invalid/rule-test','https://example.invalid/rule-test','approved','00000000-0000-4000-8000-000000001102');
insert into public.applications(id,user_id,course_id,status) values
('00000000-0000-4000-8000-000000001122','00000000-0000-4000-8000-000000001102','00000000-0000-4000-8000-000000001121','applied');
insert into public.tasks(id,user_id,application_id,title,done,task_key,has_personal_edits,description,preferred_bucket) values
('00000000-0000-4000-8000-000000001123','00000000-0000-4000-8000-000000001102','00000000-0000-4000-8000-000000001122','Personal wording',true,'rule:00000000-0000-4000-8000-000000001111:step:0',true,'Personal details','later');
create temp table preserved_tasks as select to_jsonb(t) row from public.tasks t where id='00000000-0000-4000-8000-000000001123';
create temp table preserved_apps as select to_jsonb(a) row from public.applications a where id='00000000-0000-4000-8000-000000001122';
create temp table rule_preview(revision bigint, raw jsonb, predecessor uuid);
grant all on rule_preview to authenticated;
create function pg_temp.publish_command(approval text) returns text language sql as $$
  select format('select public.publish_rule_version(%L,%s,%L::jsonb,%L::uuid,%L::public.rule_status)',
    '00000000-0000-4000-8000-000000001111',revision,raw,predecessor,approval) from rule_preview
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001101","app_metadata":{"role":"admin"}}',true);
update public.rule_drafts set raw_snapshot=jsonb_set(raw_snapshot,'{last_verified_at}','"2026-10-06T12:00:00+00:00"'),
  effective_from='2026-01-01',effective_until='2028-01-01',intake_from=4052,intake_until=4056
where rule_id='00000000-0000-4000-8000-000000001111';
select pg_temp.assert_true((select revision=2 and edited_by=auth.uid() from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),'draft revision and actor stamped by database');
select pg_temp.assert_true((select status='draft' from public.rules where id='00000000-0000-4000-8000-000000001111'),'draft save never publishes');
insert into rule_preview select revision,raw_snapshot,null from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111';
select pg_temp.expect_state('update public.rules set status=''beta'' where id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('delete from public.rule_drafts where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rule_drafts set revision=999 where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rule_drafts set edited_by=''00000000-0000-4000-8000-000000001102'' where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rule_drafts set raw_snapshot=jsonb_set(raw_snapshot,''{status}'',''"verified"'') where rule_id=''00000000-0000-4000-8000-000000001111''','23514');
-- Shape/scope and exact-token stale guards are independent.
select pg_temp.expect_state(format('select public.publish_rule_version(%L,1,%L,null,''beta'')','00000000-0000-4000-8000-000000001111',(select raw from rule_preview)),'23514');
select pg_temp.expect_state(format('select public.publish_rule_version(%L,2,%L,null,''beta'')','00000000-0000-4000-8000-000000001111',(select raw - 'notes' from rule_preview)),'23514');
select pg_temp.expect_state('update public.rule_drafts set effective_until=effective_from where rule_id=''00000000-0000-4000-8000-000000001111''','23514');
select pg_temp.expect_state('update public.rule_drafts set intake_until=intake_from where rule_id=''00000000-0000-4000-8000-000000001111''','23514');
select pg_temp.expect_state('update public.rule_drafts set effective_from=''2027-02-29'' where rule_id=''00000000-0000-4000-8000-000000001111''','22008');
select pg_temp.expect_state('update public.rule_drafts set intake_from=20000 where rule_id=''00000000-0000-4000-8000-000000001111''','23514');
-- Bad evidence can be saved for editing but cannot be published.
update public.rule_drafts set raw_snapshot=jsonb_set(raw_snapshot,'{last_verified_at}','"2999-01-01T00:00:00Z"') where rule_id='00000000-0000-4000-8000-000000001111';
update rule_preview set revision=(select revision from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),raw=(select raw_snapshot from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111');
select pg_temp.expect_state(pg_temp.publish_command('beta'),'23514');
update public.rule_drafts set raw_snapshot=jsonb_set(raw_snapshot,'{last_verified_at}','"2026-10-06T12:00:00+00:00"') where rule_id='00000000-0000-4000-8000-000000001111';
update rule_preview set revision=(select revision from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),raw=(select raw_snapshot from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111');
select pg_temp.expect_state(pg_temp.publish_command('draft'),'23514');
do $$ begin execute pg_temp.publish_command('beta'); end $$;
select pg_temp.expect_state(pg_temp.publish_command('beta'),'23514'); -- same preview: one successor only
select pg_temp.assert_true((select count(*)=1 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111'),'one beta publication');
select pg_temp.assert_true((select v.raw_snapshot=jsonb_set(p.raw,'{status}','"beta"') and v.reviewed_by=auth.uid() and v.reviewed_at=v.published_at and v.provenance='human_publication' and v.version_number=1 and v.supersedes_version_id is null from public.rule_versions v cross join rule_preview p where v.rule_id='00000000-0000-4000-8000-000000001111'),'full raw body/evidence preserved; database review authority');
select pg_temp.assert_true((select r.id=v.rule_id and r.source_url=v.raw_snapshot->>'source_url' and r.source_quote=v.raw_snapshot->>'source_quote' and r.last_verified_at=(v.raw_snapshot->>'last_verified_at')::timestamptz and r.updated_at=v.published_at from public.rules r join public.rule_versions v on v.rule_id=r.id where r.id='00000000-0000-4000-8000-000000001111'),'compatibility mirror and same clock');
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_events where row_id='00000000-0000-4000-8000-000000001111' and rule_publication is not null),'one protected publication journal');
select pg_temp.assert_true((select e.actor_user_id=v.reviewed_by and e.created_at=v.published_at and e.rule_publication->>'reviewed_by'=v.reviewed_by::text and (e.rule_publication->>'version_id')::uuid=v.id from public.admin_audit_events e join public.rule_versions v on v.id=(e.rule_publication->>'version_id')::uuid where v.rule_id='00000000-0000-4000-8000-000000001111'),'journal references immutable snapshot and server attribution');
select pg_temp.expect_state('update public.rules set source_quote=''forged'' where id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rules set status=''draft'' where id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('delete from public.rules where id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rule_versions set raw_snapshot=''{}'' where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('delete from public.rule_versions where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,rule_publication) values (auth.uid(),''rules'',''00000000-0000-4000-8000-000000001111'',''update'',''{}'')','42501');
-- Revision can remain unchanged across explicit reverification; predecessor must advance.
update rule_preview set predecessor=(select id from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=1);
do $$ begin execute pg_temp.publish_command('verified'); end $$;
select pg_temp.expect_state(pg_temp.publish_command('verified'),'23514');
update rule_preview set predecessor=(select id from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=2);
do $$ begin execute pg_temp.publish_command('verified'); end $$;
select pg_temp.assert_true((select count(*)=3 and max(version_number)=3 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111'),'beta, verified and reverification append');
select pg_temp.assert_true((select count(*)=2 from public.rule_versions n join public.rule_versions p on n.supersedes_version_id=p.id and n.rule_id=p.rule_id and n.version_number=p.version_number+1 where n.rule_id='00000000-0000-4000-8000-000000001111'),'linear same-rule predecessor chain');
-- Future applicability is legal and is not an invented verification date.
update public.rule_drafts set effective_from='2998-01-01',effective_until='2999-01-01',intake_from=5996,intake_until=5999 where rule_id='00000000-0000-4000-8000-000000001111';
update rule_preview set revision=(select revision from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),raw=(select raw_snapshot from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),predecessor=(select id from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=3);
do $$ begin execute pg_temp.publish_command('verified'); end $$;
select pg_temp.assert_true((select effective_from='2998-01-01' and intake_from=5996 and (raw_snapshot->>'last_verified_at')::timestamptz<published_at from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=4),'future effective scope stored separately');
-- Boundary assertions describe schema bounds, not the app selector (root owns it).
select pg_temp.assert_true((select 2026*2=intake_from and 2026*2+1>=intake_from and 2027*2+1<intake_until and not (2028*2<intake_until) from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=1),'stored summer/winter interval lower inclusive upper exclusive');
select pg_temp.assert_true((select date '2026-01-01'>=effective_from and date '2027-12-31'<effective_until and not (date '2028-01-01'<effective_until) from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=1),'stored assessment interval lower inclusive upper exclusive');
-- Authenticated non-admin and anonymous cannot publish, inspect or save workspace.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001102","app_metadata":{"role":"student"}}',true);
select pg_temp.expect_state(pg_temp.publish_command('verified'),'42501');
select pg_temp.assert_true((select count(*)=0 from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001111'),'workspace admin-only');
select pg_temp.assert_denied('update public.rule_drafts set intake_from=4052 where rule_id=''00000000-0000-4000-8000-000000001111''');
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_state('select public.publish_rule_version(''00000000-0000-4000-8000-000000001111'',1,''{}'',null,''verified'')','42501');
select pg_temp.assert_true((select count(*)=4 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111'),'published history readable anonymously');
set local role service_role;
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_state('select public.publish_rule_version(''00000000-0000-4000-8000-000000001111'',1,''{}'',null,''verified'')','42501');
select pg_temp.expect_state('update public.rules set notes=''service overwrite'' where id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('update public.rule_versions set version_number=99 where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('delete from public.rule_versions where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('insert into public.admin_audit_events(table_name,row_id,action,rule_publication) values (''rules'',''00000000-0000-4000-8000-000000001111'',''update'',''{}'')','42501');
select pg_temp.expect_state('update public.admin_audit_events set rule_publication=''{}'' where row_id=''00000000-0000-4000-8000-000000001111'' and rule_publication is not null','42501');
select pg_temp.expect_state('delete from public.admin_audit_events where row_id=''00000000-0000-4000-8000-000000001111'' and rule_publication is not null','42501');
reset role;
select pg_temp.expect_state('truncate public.admin_audit_events','42501');
-- Prove the UID guard even if an operator accidentally adds service RPC privilege.
grant execute on function public.publish_rule_version(uuid,bigint,jsonb,uuid,public.rule_status) to service_role;
grant select,update on public.rule_drafts to service_role;
set local role service_role;
select pg_temp.expect_state('select public.publish_rule_version(''00000000-0000-4000-8000-000000001111'',1,''{}'',null,''verified'')','42501');
select pg_temp.expect_state('update public.rule_drafts set revision=999,edited_by=''00000000-0000-4000-8000-000000001102'' where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
reset role;
revoke all on public.rule_drafts from service_role;
revoke execute on function public.publish_rule_version(uuid,bigint,jsonb,uuid,public.rule_status) from service_role;
-- Owner-trigger defenses remain effective even if table write grants drift.
grant insert,update,delete on public.rule_versions to authenticated;
grant update,delete on public.admin_audit_events to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000001101","app_metadata":{"role":"admin"}}',true);
select pg_temp.expect_state('insert into public.rule_versions select * from public.rule_versions where rule_id=''00000000-0000-4000-8000-000000001111'' limit 1','42501');
-- With no write RLS policies these updates filter to zero rows.
select pg_temp.assert_denied('update public.rule_versions set version_number=99 where rule_id=''00000000-0000-4000-8000-000000001111''');
reset role;
-- Evidence/shape guards are basic boundary validation, never educational logic.
select pg_temp.assert_true(not public.valid_rule_publication_snapshot((select raw from rule_preview)-'source_quote','00000000-0000-4000-8000-000000001111',now()),'missing evidence key rejected');
select pg_temp.assert_true(not public.valid_rule_publication_snapshot(jsonb_set((select raw from rule_preview),'{source_quote}','"   "'),'00000000-0000-4000-8000-000000001111',now()),'blank evidence rejected');
select pg_temp.assert_true(not public.valid_rule_publication_snapshot(jsonb_set((select raw from rule_preview),'{outcomes}','{}'),'00000000-0000-4000-8000-000000001111',now()),'empty outcomes rejected');
select pg_temp.assert_true(not public.valid_rule_publication_snapshot(jsonb_set((select raw from rule_preview),'{last_verified_at}','"2027-02-29T00:00:00Z"'),'00000000-0000-4000-8000-000000001111',now()),'impossible evidence date rejected');
select pg_temp.assert_true(not public.valid_rule_publication_snapshot(jsonb_set((select raw from rule_preview),'{reviewed_by}','"00000000-0000-4000-8000-000000001102"'),'00000000-0000-4000-8000-000000001111',now()),'raw JSON is not reviewer authority');
-- Superuser mutation still hits immutable triggers (not an RLS-only promise).
select pg_temp.expect_state('update public.rule_versions set version_number=99 where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('delete from public.rule_versions where rule_id=''00000000-0000-4000-8000-000000001111''','42501');
select pg_temp.expect_state('truncate public.rule_versions','42501');
-- All three fault sites must roll back version+journal+compatibility together.
create function pg_temp.fail_publication() returns trigger language plpgsql as $$
begin raise exception using errcode='P0001',message='synthetic publication fault'; end; $$;
create temp table atomic_before as select to_jsonb(r) mirror from public.rules r where id='00000000-0000-4000-8000-000000001111';
grant select on atomic_before to authenticated;
update rule_preview set predecessor=(select id from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and version_number=4);
create trigger synthetic_fault after insert on public.rule_versions for each row execute function pg_temp.fail_publication();
set local role authenticated;
select pg_temp.expect_state(pg_temp.publish_command('beta'),'P0001');
reset role;
drop trigger synthetic_fault on public.rule_versions;
create trigger synthetic_fault before insert on public.admin_audit_events for each row when (new.rule_publication is not null) execute function pg_temp.fail_publication();
set local role authenticated;
select pg_temp.expect_state(pg_temp.publish_command('beta'),'P0001');
reset role;
drop trigger synthetic_fault on public.admin_audit_events;
create trigger synthetic_fault after update on public.rules for each row execute function pg_temp.fail_publication();
set local role authenticated;
select pg_temp.expect_state(pg_temp.publish_command('beta'),'P0001');
reset role;
drop trigger synthetic_fault on public.rules;
select pg_temp.assert_true((select count(*)=4 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111'),'failed transactions left no version');
select pg_temp.assert_true((select count(*)=4 from public.admin_audit_events where row_id='00000000-0000-4000-8000-000000001111' and rule_publication is not null),'failed transactions left no journal');
select pg_temp.assert_true((select to_jsonb(r)=b.mirror from public.rules r cross join atomic_before b where id='00000000-0000-4000-8000-000000001111'),'failed transactions left mirror untouched');
-- Synthetic legacy baseline: simulate migration capture under schema-owner control
-- ONLY inside this disposable transaction. This does not prove a real migration
-- backfill; root must also preload a legacy sentinel BEFORE applying the migration.
insert into public.rules(id,slug,conditions,outcomes,source_url,source_quote,last_verified_at,notes) values
('00000000-0000-4000-8000-000000001131','synthetic-legacy-capture','{}','{"note":"Synthetic legacy"}',
'https://example.invalid/legacy?preserve=1#evidence','Synthetic legacy literal quote','2000-01-01T12:34:56Z','Synthetic legacy note');
alter table public.rules disable trigger protect_rule_compatibility;
update public.rules set status='beta' where id='00000000-0000-4000-8000-000000001131';
alter table public.rules enable trigger protect_rule_compatibility;
create temp table legacy_before as select to_jsonb(r) snapshot from public.rules r where id='00000000-0000-4000-8000-000000001131';
alter table public.rule_versions disable trigger protect_rule_version_insert;
insert into public.rule_versions(rule_id,version_number,raw_snapshot,status,provenance,captured_at)
select '00000000-0000-4000-8000-000000001131',1,snapshot,'beta','legacy_capture',clock_timestamp() from legacy_before;
select pg_temp.expect_state('insert into public.rule_versions(rule_id,version_number,raw_snapshot,status,provenance,captured_at,reviewed_by) select ''00000000-0000-4000-8000-000000001131'',1,snapshot,''beta'',''legacy_capture'',clock_timestamp(),''00000000-0000-4000-8000-000000001101'' from legacy_before','23514');
alter table public.rule_versions enable trigger protect_rule_version_insert;
select pg_temp.assert_true((select raw_snapshot=b.snapshot and reviewed_by is null and reviewed_at is null and published_at is null and captured_at is not null and effective_from is null and effective_until is null and intake_from is null and intake_until is null from public.rule_versions v cross join legacy_before b where v.rule_id='00000000-0000-4000-8000-000000001131'),'synthetic legacy exact evidence/full snapshot, unknown approval/scope');
grant select on legacy_before to authenticated;
set local role authenticated;
update public.rule_drafts set raw_snapshot=jsonb_set((select snapshot from legacy_before),'{status}','"draft"') where rule_id='00000000-0000-4000-8000-000000001131';
select public.publish_rule_version('00000000-0000-4000-8000-000000001131',2,
(select raw_snapshot from public.rule_drafts where rule_id='00000000-0000-4000-8000-000000001131'),
(select id from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001131' and version_number=1),'verified');
select pg_temp.assert_true((select count(*)=2 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001131'),'first human publication appends after legacy capture');
select pg_temp.assert_true((select raw_snapshot=b.snapshot from public.rule_versions v cross join legacy_before b where rule_id='00000000-0000-4000-8000-000000001131' and version_number=1),'legacy snapshot unchanged after human publication');
reset role;
-- Reviewer UUIDs are historical data; auth account deletion only nulls legacy FK.
delete from auth.users where id='00000000-0000-4000-8000-000000001101';
select pg_temp.assert_true((select count(*)=4 from public.rule_versions where rule_id='00000000-0000-4000-8000-000000001111' and reviewed_by='00000000-0000-4000-8000-000000001101'),'immutable reviewer survives account deletion');
select pg_temp.assert_true((select count(*)=4 from public.admin_audit_events where row_id='00000000-0000-4000-8000-000000001111' and rule_publication->>'reviewed_by'='00000000-0000-4000-8000-000000001101' and actor_user_id is null),'journal payload retains deleted reviewer attribution');
select pg_temp.assert_true((select to_jsonb(t)=p.row from public.tasks t cross join preserved_tasks p where id='00000000-0000-4000-8000-000000001123'),'task UUID/key/completion/personal edits unchanged');
select pg_temp.assert_true((select to_jsonb(a)=p.row from public.applications a cross join preserved_apps p where id='00000000-0000-4000-8000-000000001122'),'application identity and progress unchanged');
-- Every migration capture present must retain honest unknown history. Root also
-- runs a pre-migration legacy sentinel gate to prove actual capture fidelity.
select pg_temp.assert_true(not exists (select 1 from public.rule_versions where provenance='legacy_capture' and (reviewed_by is not null or reviewed_at is not null or published_at is not null or captured_at is null or effective_from is not null or effective_until is not null or intake_from is not null or intake_until is not null)),'legacy captures have no invented human/effective history');
rollback;
