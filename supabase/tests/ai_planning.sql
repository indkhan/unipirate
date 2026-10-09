-- Disposable local DB only. Run after additive migrations, rolled back completely.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label;end if;end $$;
select pg_temp.assert_true(to_regclass('public.planning_jobs') is not null,'durable unified job queue exists');
select pg_temp.assert_true(to_regclass('public.task_proposals') is not null,'separate durable proposals exist');
select pg_temp.assert_true((select not enabled from public.planning_settings where id),'automatic rollout defaults off');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.lease_planning_jobs(uuid,integer)','execute'),'owners cannot lease private worker queue');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.save_task_proposals(uuid,uuid,text,jsonb)','execute'),'owners cannot forge planner proposals');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.planning_context_fingerprint(uuid,uuid)','execute'),'owners cannot hash another profile');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.enqueue_relevant_planning_scope(uuid,uuid)','execute'),'owners cannot enqueue another owner context');
select pg_temp.assert_true(not has_function_privilege('anon','public.enqueue_relevant_planning_scope(uuid,uuid)','execute'),'anonymous callers cannot enqueue context');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.enqueue_changed_owner_planning_context()','execute'),'owners cannot invoke the event trigger helper');
select pg_temp.assert_true(not has_function_privilege('anon','public.enqueue_changed_owner_planning_context()','execute'),'anonymous callers cannot invoke the event trigger helper');
select pg_temp.assert_true(not has_function_privilege('service_role','public.set_planner_model(text,jsonb)','execute'),'model writes require the actual authenticated admin');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000006001','planning-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000006002','planning-other@example.invalid'),
 ('00000000-0000-4000-8000-000000006003','planning-admin@example.invalid');
insert into public.courses(id,source_url,normalized_url,review_status,imported_by) values
 ('00000000-0000-4000-8000-000000006010','https://example.invalid/planning','https://example.invalid/planning','approved','00000000-0000-4000-8000-000000006001');
insert into public.applications(id,user_id,course_id) values
 ('00000000-0000-4000-8000-000000006020','00000000-0000-4000-8000-000000006001','00000000-0000-4000-8000-000000006010'),
 ('00000000-0000-4000-8000-000000006021','00000000-0000-4000-8000-000000006002','00000000-0000-4000-8000-000000006010');
update public.planning_settings set enabled=true where id;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006001","app_metadata":{}}',true);
select public.enqueue_planning_job('preliminary','00000000-0000-4000-8000-000000006020');
select public.enqueue_planning_job('preliminary','00000000-0000-4000-8000-000000006020');
select pg_temp.assert_true((select count(*)=1 from public.planning_jobs),'event idempotency is durable');
do $$ begin
 begin perform public.enqueue_planning_job('preliminary','00000000-0000-4000-8000-000000006021');raise exception 'foreign application accepted';exception when insufficient_privilege then null;end;
 begin perform public.set_planner_model('synthetic:free','{"id":"synthetic:free","pricing":{"prompt":"0","completion":"0"},"supported_parameters":["tools","tool_choice"]}');raise exception 'student model write accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
select public.lease_planning_jobs('00000000-0000-4000-8000-000000006030',1);
select public.save_task_proposals(j.id,'00000000-0000-4000-8000-000000006030',j.input_fingerprint,'[{"semantic_action_key":"verify:procedure","stage":"preliminary","title":"Confirm application instructions","description":null,"reason":"No reviewed applicable procedure","due_date":null,"verbatim_due":null,"evidence":[],"source_version_id":null,"legacy_task_key":null}]') from public.planning_jobs j where j.user_id='00000000-0000-4000-8000-000000006001';
select pg_temp.assert_true((select count(*)=0 from public.tasks where user_id='00000000-0000-4000-8000-000000006001'),'automatic planning creates no task row');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006003","app_metadata":{"role":"admin"}}',true);
select pg_temp.assert_true((select count(*)=0 from public.task_proposals),'admin has no private proposal read');
select pg_temp.assert_true((select count(*)=0 from public.planning_jobs),'admin has no private planning queue read');
select public.set_planner_model('synthetic:free','{"id":"synthetic:free","pricing":{"prompt":"0","completion":"0","request":"0"},"supported_parameters":["tools","tool_choice"]}');
select pg_temp.assert_true((select enabled and planner_model='synthetic:free' from public.planning_settings where id),'model selection does not change rollout');
do $$ begin
 begin perform public.set_planner_model('synthetic:free','{"id":"synthetic:free","pricing":{"prompt":"0","completion":"0.1"},"supported_parameters":["tools","tool_choice"]}');raise exception 'paid inference accepted';exception when check_violation then null;end;
 begin perform public.set_planner_model('synthetic:free','{"id":"synthetic:free","pricing":{"prompt":"0","completion":null},"supported_parameters":["tools","tool_choice"]}');raise exception 'unknown price accepted';exception when check_violation then null;end;
 begin perform public.set_planner_model('synthetic:free','{"id":"synthetic:free","pricing":{"prompt":"0","completion":"0"},"supported_parameters":["tools"]}');raise exception 'missing capability accepted';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006002","app_metadata":{}}',true);
select pg_temp.assert_true((select count(*)=0 from public.task_proposals),'other student has no proposal read');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006001","app_metadata":{}}',true);
select public.approve_task_proposals((select jsonb_agg(jsonb_build_object('id',id,'revision',revision)) from public.task_proposals));
select public.approve_task_proposals((select jsonb_agg(jsonb_build_object('id',id,'revision',revision)) from public.task_proposals));
select pg_temp.assert_true((select count(*)=1 and bool_and(task_key is null) from public.tasks),'approval retry creates one editable manual row');
-- A generator cannot bypass approval when the rollout flag is enabled.
insert into public.tasks(user_id,application_id,title,task_key) values('00000000-0000-4000-8000-000000006001','00000000-0000-4000-8000-000000006020','Unapproved automatic task','app:synthetic:generated');
select pg_temp.assert_true((select count(*)=1 from public.tasks),'database backstop suppresses new automatic task rows');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.admin_audit_events where table_name='planning_settings' and actor_user_id='00000000-0000-4000-8000-000000006003'),'shared model selection is audited');
rollback;
