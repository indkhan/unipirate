-- Lease hardening for approval-first planning (#60).
-- Wall-clock lease checks must use clock_timestamp(), not transaction-start now():
-- a long worker transaction could otherwise treat an expired lease as valid and
-- persist proposals or advance cursors after its lease was reassigned. Audit
-- timestamps (updated_at/available_at defaults) intentionally keep now().
-- Also closes a null service-RPC lease-limit bypass, aligns the save-path
-- deadline check with the approval-path Europe/Berlin date, and scopes
-- publication fan-out to the worker's verified-applicability contract
-- (exact programme, applicant group and confirmed selection).
-- No new tables or columns; only function bodies are replaced.

-- A null p_limit previously skipped the 1..20 bound (null comparison is not
-- true), letting a service caller lease an unbounded batch. Fail closed.
create or replace function public.lease_planning_jobs(p_worker uuid,p_limit integer default 5)
returns setof public.planning_jobs language plpgsql security definer set search_path='' as $$
begin
 if p_worker is null or p_limit is null or p_limit not between 1 and 20 then raise check_violation using message='Invalid worker lease';end if;
 update public.planning_jobs set state='failed',lease_owner=null,lease_until=null,error_code='lease_expired',updated_at=now() where state='running' and lease_until<pg_catalog.clock_timestamp() and attempts>=3;
 return query update public.planning_jobs j set state='running',lease_owner=p_worker,lease_until=pg_catalog.clock_timestamp()+interval '5 minutes',attempts=j.attempts+1,updated_at=now()
 where j.id in(select id from public.planning_jobs where ((state='queued' and available_at<=pg_catalog.clock_timestamp()) or (state='running' and lease_until<pg_catalog.clock_timestamp())) and attempts<3 and (event='research' or (select enabled from public.planning_settings where id)) order by created_at for update skip locked limit p_limit)
 returning j.*;
end $$;
revoke all on function public.lease_planning_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function public.lease_planning_jobs(uuid,integer) to service_role;

create or replace function public.finish_planning_job(p_id uuid,p_worker uuid,p_success boolean,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_success is null or (not p_success and (p_error_code is null or p_error_code not in ('provider_unavailable','quota','timeout','invalid_output','stale_context','persistence_failed'))) then raise check_violation using message='Safe error code required';end if;
 update public.planning_jobs set state=case when p_success then 'succeeded' when attempts<3 then 'queued' else 'failed' end,
 available_at=pg_catalog.clock_timestamp()+interval '30 seconds'*power(2,attempts),lease_owner=null,lease_until=null,error_code=case when p_success then null else p_error_code end,updated_at=now()
 where id=p_id and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp();
 return found;
end $$;
revoke all on function public.finish_planning_job(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_planning_job(uuid,uuid,boolean,text) to service_role;

-- Same ten-field candidate contract as 20261010000500; only the lease check
-- uses the live clock and the deadline check uses the approval-path Berlin date,
-- so a proposal can save and still pass approval around midnight UTC/Berlin.
create or replace function public.save_task_proposals(p_job_id uuid,p_worker uuid,p_input_fingerprint text,p_candidates jsonb)
returns setof public.task_proposals language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; candidate jsonb; ev jsonb; material text;
 prior public.task_proposals%rowtype; target public.tasks%rowtype; offering public.course_offerings%rowtype;
 reviewed public.course_offering_versions%rowtype; proposal public.task_proposals%rowtype; fields text[]; next_status text;
begin
 select * into job from public.planning_jobs where id=p_job_id and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp() for update;
 if not found or job.event='research' then raise insufficient_privilege using message='Active planning lease required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(job.user_id::text || ':' || coalesce(job.application_id::text,'general'),0));
 if p_input_fingerprint is distinct from job.input_fingerprint or p_input_fingerprint is distinct from public.planning_context_fingerprint(job.user_id,job.application_id) then raise check_violation using message='stale_context';end if;
 if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>100 then raise check_violation using message='Bounded proposal batch required';end if;
 select * into app from public.applications where id=job.application_id and user_id=job.user_id;
 if job.application_id is not null and (not found or app.status<>'planning') then return;end if;
 update public.task_proposals set status='needs_recheck',updated_at=now()
   where user_id=job.user_id and application_id is not distinct from job.application_id and status='pending' and input_fingerprint<>p_input_fingerprint;
 for candidate in select value from jsonb_array_elements(p_candidates) loop
   if jsonb_typeof(candidate) is distinct from 'object' or not(candidate ?& array['semantic_action_key','stage','title','description','reason','due_date','verbatim_due','evidence','source_version_id','legacy_task_key'])
     or (select count(*) from jsonb_object_keys(candidate))<>10
     or exists(select 1 from unnest(array['semantic_action_key','stage','title','reason']) k where jsonb_typeof(candidate->k) is distinct from 'string')
     or exists(select 1 from unnest(array['description','due_date','verbatim_due','source_version_id','legacy_task_key']) k where jsonb_typeof(candidate->k) not in ('string','null'))
     or length(candidate->>'semantic_action_key') not between 1 and 500
     or length(btrim(candidate->>'title')) not between 1 and 200
     or length(candidate->>'reason') not between 1 and 2000
     or length(candidate->>'description')>2000 or length(candidate->>'verbatim_due')>12000
     or candidate->>'stage' not in ('preliminary','verified')
     or jsonb_typeof(candidate->'evidence') is distinct from 'array' or jsonb_array_length(candidate->'evidence')>30
   then raise check_violation using message='Invalid proposal candidate';end if;
   if candidate->>'stage'='preliminary' and (candidate->'due_date'<>'null'::jsonb or candidate->'verbatim_due'<>'null'::jsonb or candidate->'source_version_id'<>'null'::jsonb or jsonb_array_length(candidate->'evidence')<>0) then raise check_violation using message='Preliminary proposals cannot claim official dates';end if;
   reviewed:=null;offering:=null;
   if candidate->>'stage'='verified' then
     select v.* into reviewed from public.course_offering_versions v where v.id=(candidate->>'source_version_id')::uuid and v.offering_id=app.offering_id and v.review_status='verified'
       and v.version=(select max(version) from public.course_offering_versions where offering_id=app.offering_id and review_status='verified');
     if not found or jsonb_array_length(candidate->'evidence')=0
       or not exists(select 1 from public.admin_audit_events audit where audit.course_reconciliation->>'format'='up-course-01/reconciliation-v1' and audit.course_reconciliation->'version'->>'id'=reviewed.id::text)
     then raise check_violation using message='Current committed immutable publication required';end if;
     select * into offering from public.course_offerings where id=reviewed.offering_id;
     if offering.applicant_group is distinct from app.offering_applicant_context->>'applicant_group' then raise check_violation using message='Exact reviewed applicant scope required';end if;
     for ev in select value from jsonb_array_elements(candidate->'evidence') loop
       if jsonb_typeof(ev) is distinct from 'object' or (select count(*) from jsonb_object_keys(ev))<>3 or not(ev ?& array['source_url','source_quote','last_verified_at'])
         or not exists(select 1 from jsonb_array_elements(reviewed.facts) f cross join lateral jsonb_array_elements(f->'evidence') e
          where f->>'status'='verified' and f->>'applicability'=offering.applicant_group and e->>'source_url'=ev->>'source_url' and e->>'source_quote'=ev->>'source_quote'
          and e->>'last_verified_at'=ev->>'last_verified_at' and ev->>'last_verified_at' is not null)
       then raise check_violation using message='Proposal evidence must be verbatim reviewed evidence';end if;
     end loop;
     if candidate->>'due_date' is not null and ((candidate->>'due_date') !~ '^\d{4}-\d{2}-\d{2}$' or (candidate->>'due_date')::date<(pg_catalog.clock_timestamp() at time zone 'Europe/Berlin')::date or not exists(select 1 from jsonb_array_elements(reviewed.facts) f where f->>'status'='verified' and f->>'kind'='deadline' and f->>'applicability'=offering.applicant_group and f->>'verbatim'=candidate->>'verbatim_due')) then raise check_violation using message='Current literal reviewed deadline required';end if;
   end if;
   -- Hash literal material facts, not wording, reviewer timestamps or publication version.
   material:=encode(sha256(convert_to(jsonb_build_object('stage',candidate->>'stage','date',candidate->'due_date','literal',candidate->'verbatim_due',
     'evidence',(select coalesce(jsonb_agg(jsonb_build_object('url',e->>'source_url','quote',e->>'source_quote') order by e->>'source_url',e->>'source_quote'),'[]'::jsonb) from jsonb_array_elements(candidate->'evidence') e))::text,'UTF8')),'hex');
   select * into prior from public.task_proposals where user_id=job.user_id and application_id is not distinct from job.application_id and semantic_action_key=candidate->>'semantic_action_key' for update;
   if found then
     if prior.status='superseded' then continue;end if;
     if prior.material_fingerprint=material then
       -- Refresh only applicability metadata. Never reopen a dismissal or create an update for rewording.
       update public.task_proposals set input_fingerprint=p_input_fingerprint,source_version_id=reviewed.id,
         status=case when status='needs_recheck' then 'pending' else status end,updated_at=now() where id=prior.id returning * into proposal;
       if prior.approved_task_id is not null and prior.status in ('pending','needs_recheck') then
         select * into target from public.tasks where id=prior.approved_task_id and user_id=job.user_id for update;
         if found and target.planning_revision is distinct from prior.base_task_revision then
           update public.task_proposals set base_task_revision=target.planning_revision,
             before_task=jsonb_build_object('id',target.id,'title',target.title,'description',target.description,'due_date',target.due_date,'done',target.done,'planning_revision',target.planning_revision),
             revision=revision+1,updated_at=now() where id=prior.id returning * into proposal;
         end if;
       end if;
       return next proposal;continue;
     end if;
     target:=null;
     if prior.approved_task_id is not null then
       select * into target from public.tasks where id=prior.approved_task_id and user_id=job.user_id and application_id is not distinct from job.application_id for update;
       if not found then continue;end if; -- Retained tombstone: never replace a deleted task.
     end if;
     fields:='{}';
     if prior.title is distinct from candidate->>'title' then fields:=array_append(fields,'title');end if;
     if prior.description is distinct from candidate->>'description' then fields:=array_append(fields,'description');end if;
     if prior.due_date is distinct from (candidate->>'due_date')::date or prior.verbatim_due is distinct from candidate->>'verbatim_due' then fields:=array_append(fields,'due_date');end if;
     next_status:='pending';
     update public.task_proposals set stage=candidate->>'stage',title=candidate->>'title',description=candidate->>'description',reason=candidate->>'reason',
       due_date=(candidate->>'due_date')::date,verbatim_due=candidate->>'verbatim_due',evidence=candidate->'evidence',source_version_id=reviewed.id,
       offering_id=offering.id,intake_term=offering.intake_term,intake_year=offering.intake_year,applicant_group=offering.applicant_group,
       input_fingerprint=p_input_fingerprint,material_fingerprint=material,status=next_status,revision=revision+1,
       base_task_revision=target.planning_revision,before_task=case when target.id is not null then jsonb_build_object('id',target.id,'title',target.title,'description',target.description,'due_date',target.due_date,'done',target.done,'planning_revision',target.planning_revision) else null end,
       change_fields=fields,updated_at=now() where id=prior.id returning * into proposal;
   else
     -- Existing deterministic history is already student-owned; do not duplicate or rewrite it.
     if candidate->>'legacy_task_key' is not null and exists(select 1 from public.tasks where user_id=job.user_id and task_key=candidate->>'legacy_task_key') then continue;end if;
     insert into public.task_proposals(user_id,application_id,course_id,semantic_action_key,stage,title,description,reason,due_date,verbatim_due,evidence,source_version_id,offering_id,intake_term,intake_year,applicant_group,input_fingerprint,material_fingerprint,legacy_task_key)
     values(job.user_id,job.application_id,job.course_id,candidate->>'semantic_action_key',candidate->>'stage',candidate->>'title',candidate->>'description',candidate->>'reason',(candidate->>'due_date')::date,candidate->>'verbatim_due',candidate->'evidence',reviewed.id,offering.id,offering.intake_term,offering.intake_year,offering.applicant_group,p_input_fingerprint,material,candidate->>'legacy_task_key')
     on conflict(user_id,application_id,semantic_action_key) do nothing returning * into proposal;
     if not found then continue;end if;
   end if;
   return next proposal;
 end loop;
end $$;

create or replace function public.advance_planning_job(p_id uuid,p_worker uuid,p_current_cursor bigint,p_next_cursor bigint,p_complete boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then
  raise insufficient_privilege using message='Worker credentials required';
 end if;
 if p_id is null or p_worker is null or p_current_cursor is null or p_next_cursor is null or p_complete is null
   or p_current_cursor<0 or p_next_cursor<p_current_cursor or (not p_complete and p_next_cursor=p_current_cursor) then
  raise check_violation using message='Invalid planning cursor progress';
 end if;
 update public.planning_jobs set cursor=p_next_cursor,
   state=case when p_complete then 'succeeded' else 'queued' end,
   attempts=case when p_next_cursor>p_current_cursor then 0 else attempts end,
   available_at=pg_catalog.clock_timestamp(),lease_owner=null,lease_until=null,error_code=null,updated_at=now()
 where id=p_id and event<>'research' and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp() and cursor=p_current_cursor;
 return found;
end $$;
revoke all on function public.advance_planning_job(uuid,uuid,bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.advance_planning_job(uuid,uuid,bigint,bigint,boolean) to service_role;

create or replace function public.retire_missing_planning_proposals(
 p_job_id uuid,p_worker uuid,p_input_fingerprint text,p_supported_action_keys text[]
) returns integer language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; prefix text; changed integer;
begin
 select * into job from public.planning_jobs where id=p_job_id and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp() for update;
 if not found or job.event<>'verified' or job.application_id is null then raise insufficient_privilege using message='Active verified planning lease required';end if;
 if p_supported_action_keys is null or cardinality(p_supported_action_keys)>10000
   or exists(select 1 from unnest(p_supported_action_keys) k where k is null or length(k) not between 1 and 500)
 then raise check_violation using message='Bounded complete supported action keys required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(job.user_id::text||':'||job.application_id::text,0));
 select * into app from public.applications where id=job.application_id and user_id=job.user_id for share;
 if not found or app.offering_id is null or app.status<>'planning' then raise check_violation using message='stale_context';end if;
 perform 1 from public.course_offerings where id=app.offering_id for share;
 if p_input_fingerprint is distinct from job.input_fingerprint or p_input_fingerprint is distinct from public.planning_context_fingerprint(job.user_id,job.application_id)
   or not exists(select 1 from public.course_offering_versions v where v.id=job.source_version_id and v.offering_id=app.offering_id and v.review_status='verified'
      and v.version=(select max(version) from public.course_offering_versions where offering_id=app.offering_id and review_status='verified'))
 then raise check_violation using message='stale_context';end if;
 prefix:='app:'||app.id::text||':offering:'||app.offering_id::text||':';
 update public.task_proposals p set status='needs_recheck',revision=revision+1,updated_at=now()
 where p.user_id=job.user_id and p.application_id=app.id and p.status='pending'
   and (p.offering_id=app.offering_id or (p.offering_id is null and left(p.semantic_action_key,length(prefix))=prefix))
   and not(p.semantic_action_key=any(p_supported_action_keys));
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function public.retire_missing_planning_proposals(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.retire_missing_planning_proposals(uuid,uuid,text,text[]) to service_role;

-- Same stale-refresh contract as 20261010001300; only the lease check uses the
-- live clock so a worker cannot refresh on an expired lease.
create or replace function public.refresh_planning_job(p_id uuid,p_worker uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; version_id uuid; next_event text; fingerprint text; pending_research boolean;
begin
 select * into job from public.planning_jobs where id=p_id and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp() for update;
 if not found then return false;end if;
 select * into app from public.applications where id=job.application_id and user_id=job.user_id;
 update public.planning_jobs set state='succeeded',error_code='stale_context',lease_owner=null,lease_until=null,updated_at=now() where id=job.id;
 if job.application_id is not null and (app.id is null or app.status<>'planning') then return true;end if;
 if job.event='research' then
  select review_status='pending' into pending_research from public.courses where id=app.course_id;
  if pending_research is distinct from true then return true;end if;
  next_event:='research';
 else
  version_id:=public.current_planning_source_version(job.user_id,job.application_id);
  next_event:=case when version_id is null then 'preliminary' else 'verified' end;
 end if;
 fingerprint:=public.planning_context_fingerprint(job.user_id,job.application_id);
 -- Stale refresh does not replay a full completed catalogue or reset persisted progress.
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(job.user_id,job.application_id,app.course_id,next_event,fingerprint,version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 return true;
end $$;
revoke all on function public.refresh_planning_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.refresh_planning_job(uuid,uuid) to service_role;

-- Same retry contract as 20261010001300; the requeue timestamp uses the live
-- clock. Cursor is intentionally preserved on the conflict path: a same-scope
-- retry requeues the existing failed row (keeping its persisted cursor) instead
-- of resetting progress to zero.
create or replace function public.retry_planning_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare historical public.planning_jobs%rowtype; app public.applications%rowtype; course public.courses%rowtype;
 current_job public.planning_jobs%rowtype; version_id uuid; next_event text; fingerprint text;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 -- Ownership is checked before any locks or source reads; admin does not grant private access.
 select * into historical from public.planning_jobs where id=p_job_id and user_id=auth.uid();
 if not found then raise insufficient_privilege using message='Owned failed job required';end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('planning-rules',0));
 if historical.course_id is not null then
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('planning-course:'||historical.course_id::text,0));
 end if;
 perform 1 from public.profiles where user_id=auth.uid() for share;
 if historical.application_id is not null then
  select * into app from public.applications where id=historical.application_id and user_id=auth.uid() for share;
  if not found or app.status<>'planning' then return jsonb_build_object('status','obsolete','job_id',null);end if;
  if app.course_id is distinct from historical.course_id then
   perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('planning-course:'||app.course_id::text,0));
  end if;
  select * into course from public.courses where id=app.course_id for share;
  if not found then return jsonb_build_object('status','obsolete','job_id',null);end if;
  if app.offering_id is not null then perform 1 from public.course_offerings where id=app.offering_id for share;end if;
 end if;
 select * into historical from public.planning_jobs where id=p_job_id and user_id=auth.uid() for update;
 if historical.state<>'failed' then raise check_violation using message='Only a failed saved job can be retried';end if;
 fingerprint:=public.planning_context_fingerprint(auth.uid(),historical.application_id);
 if historical.event='research' then
  if app.id is null or course.review_status<>'pending' then return jsonb_build_object('status','obsolete','job_id',null);end if;
  next_event:='research';
 elsif historical.event='preliminary' and historical.input_fingerprint=fingerprint then
  next_event:='preliminary';
 else
  version_id:=public.current_planning_source_version(auth.uid(),historical.application_id);
  next_event:=case when version_id is null then 'preliminary' else 'verified' end;
 end if;
 fingerprint:=public.planning_context_fingerprint(auth.uid(),historical.application_id);
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(auth.uid(),historical.application_id,app.course_id,next_event,fingerprint,version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do update set
  state=case when planning_jobs.state='failed' then 'queued' else planning_jobs.state end,
  attempts=case when planning_jobs.state='failed' then 0 else planning_jobs.attempts end,
  error_code=case when planning_jobs.state='failed' then null else planning_jobs.error_code end,
  available_at=case when planning_jobs.state='failed' then pg_catalog.clock_timestamp() else planning_jobs.available_at end
 returning * into current_job;
 return jsonb_build_object('status',case when current_job.state='queued' then 'queued' else 'existing' end,'job_id',current_job.id);
end $$;
revoke all on function public.retry_planning_job(uuid) from public,anon;
grant execute on function public.retry_planning_job(uuid) to authenticated;

-- The dispatch scan is a liveness check, so it uses the live clock.
create or replace function private.dispatch_planning_jobs() returns bigint
language plpgsql security definer set search_path='' as $$
declare config private.planning_dispatch%rowtype;credential text;request_id bigint;
begin
 if not exists(select 1 from public.planning_jobs where
   (state='queued' and available_at<=pg_catalog.clock_timestamp() or state='running' and lease_until<pg_catalog.clock_timestamp())
   and (event='research' or (select enabled from public.planning_settings where id))) then return null;end if;
 select * into config from private.planning_dispatch where id;
 if not found then return null;end if;
 select decrypted_secret into credential from vault.decrypted_secrets where id=config.secret_id;
 if credential is null then return null;end if;
 select net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;

-- Verified fan-out matches the worker's applicability contract: exact
-- programme, applicant group and confirmed selection. Unconfirmed or
-- programme-mismatched applications receive no verified job here; the
-- relevant-event path still offers them preliminary work. Queuing while the
-- rollout flag is off is intentional: the lease gate holds non-research jobs
-- until enablement, so enabling later picks up already-queued publications.
create or replace function public.enqueue_published_offering_planning() returns trigger language plpgsql security definer set search_path='' as $$
declare version public.course_offering_versions%rowtype; app public.applications%rowtype;
begin
 if new.course_reconciliation->>'format' is distinct from 'up-course-01/reconciliation-v1' then return new;end if;
 select * into version from public.course_offering_versions where id=(new.course_reconciliation->'version'->>'id')::uuid and review_status='verified' and reviewed_by=new.actor_user_id;
 if not found then return new;end if;
 for app in select a.* from public.applications a join public.course_offerings o on o.id=a.offering_id
   join public.programmes programme on programme.id=o.programme_id
   where a.offering_id=version.offering_id and a.status='planning' and o.applicant_group=a.offering_applicant_context->>'applicant_group'
   and programme.legacy_course_id=a.course_id and a.offering_applicant_context->>'confirmed'='true'
 loop
   insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
   values(app.user_id,app.id,app.course_id,'verified',public.planning_context_fingerprint(app.user_id,app.id),version.id)
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 end loop;
 return new;
end $$;

-- Trade-off: flag-off keeps legacy direct generation (task_key inserts pass
-- through) and flag-on reroutes every automatic candidate through
-- approval-first proposals. The backstop therefore only suppresses when the
-- rollout is enabled; disabling the flag restores the pre-approval behavior
-- instead of blocking generation. Body is otherwise unchanged.
create or replace function public.guard_automatic_task_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.task_key is not null and (select enabled from public.planning_settings where id) then
   if auth.uid() is not null and auth.uid()<>new.user_id then raise insufficient_privilege using message='Owned task event required';end if;
   if new.application_id is not null and not exists(select 1 from public.applications where id=new.application_id and user_id=new.user_id) then raise insufficient_privilege using message='Owned application required';end if;
   insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint)
   values(new.user_id,new.application_id,(select course_id from public.applications where id=new.application_id),'preliminary',public.planning_context_fingerprint(new.user_id,new.application_id))
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
   return null;
 end if;
 return new;
end $$;
