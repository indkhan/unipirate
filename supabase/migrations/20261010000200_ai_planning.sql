-- Approval-first planning: one durable queue, owner-only proposals, no automatic task writes.
create table public.planning_settings (
  id boolean primary key default true check(id), enabled boolean not null default false,
  planner_model text check(length(planner_model) between 1 and 200),
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
insert into public.planning_settings(id) values(true);
alter table public.planning_settings enable row level security;
create policy "read planning rollout" on public.planning_settings for select to authenticated using(true);
grant select on public.planning_settings to authenticated;
grant all on public.planning_settings to service_role;

alter table public.tasks add column planning_revision bigint not null default 1;
create function public.bump_task_planning_revision() returns trigger language plpgsql set search_path='' as $$
begin new.planning_revision := old.planning_revision + 1; return new; end $$;
create trigger bump_planning_revision before update on public.tasks for each row execute function public.bump_task_planning_revision();

create table public.planning_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade, course_id uuid references public.courses(id) on delete cascade,
  event text not null check(event in ('research','preliminary','verified')),
  input_fingerprint text not null check(input_fingerprint ~ '^[0-9a-f]{64}$'),
  source_version_id uuid references public.course_offering_versions(id) on delete restrict,
  state text not null default 'queued' check(state in ('queued','running','succeeded','failed')),
  attempts integer not null default 0 check(attempts between 0 and 3),
  lease_owner uuid, lease_until timestamptz, available_at timestamptz not null default now(),
  error_code text check(error_code in ('provider_unavailable','quota','timeout','invalid_output','stale_context','persistence_failed','lease_expired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((state='running')=(lease_owner is not null and lease_until is not null)),
  check((event='verified')=(source_version_id is not null)),
  unique nulls not distinct(user_id,application_id,event,input_fingerprint,source_version_id)
);
create index planning_jobs_dispatch_idx on public.planning_jobs(available_at,created_at) where state in ('queued','running');
alter table public.planning_jobs enable row level security;
create policy "owner planning progress" on public.planning_jobs for select to authenticated using(user_id=(select auth.uid()));
grant select on public.planning_jobs to authenticated;
grant all on public.planning_jobs to service_role;

create table public.task_proposals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade, course_id uuid references public.courses(id) on delete cascade,
  semantic_action_key text not null check(length(semantic_action_key) between 1 and 500),
  stage text not null check(stage in ('preliminary','verified')),
  title text not null check(length(btrim(title)) between 1 and 200), description text check(length(description)<=2000),
  reason text not null check(length(reason) between 1 and 2000), due_date date, verbatim_due text check(length(verbatim_due)<=12000),
  evidence jsonb not null default '[]' check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)<=30),
  source_version_id uuid references public.course_offering_versions(id) on delete restrict,
  offering_id uuid references public.course_offerings(id) on delete restrict, intake_term text, intake_year integer, applicant_group text,
  input_fingerprint text not null, material_fingerprint text not null,
  status text not null default 'pending' check(status in ('pending','approved','dismissed','superseded','needs_recheck')),
  revision bigint not null default 1, approved_revision bigint, approved_task_id uuid,
  -- No task FK: deletion must retain a tombstone and must never resurrect the approved task.
  approval_fingerprint text, base_task_revision bigint, before_task jsonb, change_fields text[] not null default '{}',
  legacy_task_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct(user_id,application_id,semantic_action_key),
  check(stage <> 'preliminary' or (due_date is null and verbatim_due is null and source_version_id is null)),
  check(stage <> 'verified' or (source_version_id is not null and offering_id is not null and applicant_group is not null and jsonb_array_length(evidence)>0)),
  check(due_date is null or verbatim_due is not null)
);
create index task_proposals_owner_pending_idx on public.task_proposals(user_id,created_at) where status in ('pending','needs_recheck');
alter table public.task_proposals enable row level security;
create policy "owner proposal read" on public.task_proposals for select to authenticated using(user_id=(select auth.uid()));
grant select on public.task_proposals to authenticated;
grant all on public.task_proposals to service_role;

-- Hash the context, never persist full private profiles in queue rows or logs.
create function public.planning_context_fingerprint(p_user uuid,p_application uuid)
returns text language sql stable security definer set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object(
   'profile',(select answers from public.profiles where user_id=p_user),
   'application',(select jsonb_build_object('course',a.course_id,'status',a.status,'offering',a.offering_id,'context',a.offering_applicant_context) from public.applications a where a.id=p_application and a.user_id=p_user),
   'course',(select jsonb_build_object('updated',c.updated_at,'review',c.review_status) from public.courses c join public.applications a on a.course_id=c.id where a.id=p_application and a.user_id=p_user),
   'version',(select max(v.version) from public.course_offering_versions v join public.applications a on a.offering_id=v.offering_id where a.id=p_application and a.user_id=p_user and v.review_status='verified'),
   'definitions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.course_task_definitions d join public.applications a on a.course_id=d.course_id where a.id=p_application and a.user_id=p_user),
   'rules',(select coalesce(jsonb_agg(v.id order by v.id),'[]'::jsonb) from public.rule_versions v),
   'completed',(select coalesce(jsonb_agg(t.id order by t.id),'[]'::jsonb) from public.tasks t where t.user_id=p_user and t.application_id is not distinct from p_application and t.done)
 )::text,'UTF8')),'hex');
$$;
revoke all on function public.planning_context_fingerprint(uuid,uuid) from public,anon,authenticated;
grant execute on function public.planning_context_fingerprint(uuid,uuid) to service_role;
create function public.get_planning_context_fingerprint(p_application_id uuid default null)
returns text language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or (p_application_id is not null and not exists(select 1 from public.applications where id=p_application_id and user_id=auth.uid())) then raise insufficient_privilege using message='Owned application required';end if;
 return public.planning_context_fingerprint(auth.uid(),p_application_id);
end $$;
revoke all on function public.get_planning_context_fingerprint(uuid) from public,anon;
grant execute on function public.get_planning_context_fingerprint(uuid) to authenticated;

create function public.enqueue_planning_job(p_event text,p_application_id uuid default null,p_source_version_id uuid default null)
returns public.planning_jobs language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); app public.applications%rowtype; fingerprint text; result public.planning_jobs%rowtype;
begin
 if owner_id is null or p_event not in ('research','preliminary','verified') then raise insufficient_privilege using message='Authenticated planning event required';end if;
 if p_application_id is not null then
   select * into app from public.applications where id=p_application_id and user_id=owner_id;
   if not found then raise insufficient_privilege using message='Owned application required';end if;
 elsif p_event in ('research','verified') then raise check_violation using message='Course planning requires an application';end if;
 if (p_event='verified') is distinct from (p_source_version_id is not null) then raise check_violation using message='Verified event requires a published offering';end if;
 if p_event='verified' and not exists(select 1 from public.course_offering_versions v where v.id=p_source_version_id and v.offering_id=app.offering_id and v.review_status='verified' and v.version=(select max(version) from public.course_offering_versions where offering_id=app.offering_id and review_status='verified')) then raise check_violation using message='Current reviewed offering required';end if;
 fingerprint:=public.planning_context_fingerprint(owner_id,p_application_id);
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(owner_id,p_application_id,app.course_id,p_event,fingerprint,p_source_version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do update set
   state=case when planning_jobs.state='failed' then 'queued' else planning_jobs.state end,
   attempts=case when planning_jobs.state='failed' then 0 else planning_jobs.attempts end,
   error_code=case when planning_jobs.state='failed' then null else planning_jobs.error_code end,
   available_at=case when planning_jobs.state='failed' then now() else planning_jobs.available_at end
 returning * into result;
 return result;
end $$;
revoke all on function public.enqueue_planning_job(text,uuid,uuid) from public,anon;
grant execute on function public.enqueue_planning_job(text,uuid,uuid) to authenticated;

create function public.lease_planning_jobs(p_worker uuid,p_limit integer default 5)
returns setof public.planning_jobs language plpgsql security definer set search_path='' as $$
begin
 if p_worker is null or p_limit not between 1 and 20 then raise check_violation using message='Invalid worker lease';end if;
 update public.planning_jobs set state='failed',lease_owner=null,lease_until=null,error_code='lease_expired',updated_at=now() where state='running' and lease_until<now() and attempts>=3;
 return query update public.planning_jobs j set state='running',lease_owner=p_worker,lease_until=now()+interval '5 minutes',attempts=j.attempts+1,updated_at=now()
 where j.id in(select id from public.planning_jobs where ((state='queued' and available_at<=now()) or (state='running' and lease_until<now())) and attempts<3 and (event='research' or (select enabled from public.planning_settings where id)) order by created_at for update skip locked limit p_limit)
 returning j.*;
end $$;
revoke all on function public.lease_planning_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function public.lease_planning_jobs(uuid,integer) to service_role;

create function public.finish_planning_job(p_id uuid,p_worker uuid,p_success boolean,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_success is null or (not p_success and (p_error_code is null or p_error_code not in ('provider_unavailable','quota','timeout','invalid_output','stale_context','persistence_failed'))) then raise check_violation using message='Safe error code required';end if;
 update public.planning_jobs set state=case when p_success then 'succeeded' when attempts<3 then 'queued' else 'failed' end,
 available_at=now()+interval '30 seconds'*power(2,attempts),lease_owner=null,lease_until=null,error_code=case when p_success then null else p_error_code end,updated_at=now()
 where id=p_id and state='running' and lease_owner=p_worker and lease_until>now();
 return found;
end $$;
revoke all on function public.finish_planning_job(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_planning_job(uuid,uuid,boolean,text) to service_role;

create function public.save_task_proposals(p_job_id uuid,p_worker uuid,p_input_fingerprint text,p_candidates jsonb)
returns setof public.task_proposals language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; candidate jsonb; ev jsonb; material text;
 prior public.task_proposals%rowtype; target public.tasks%rowtype; offering public.course_offerings%rowtype;
 reviewed public.course_offering_versions%rowtype; proposal public.task_proposals%rowtype; fields text[]; next_status text;
begin
 select * into job from public.planning_jobs where id=p_job_id and state='running' and lease_owner=p_worker and lease_until>now() for update;
 if not found or job.event='research' then raise insufficient_privilege using message='Active planning lease required';end if;
 if p_input_fingerprint is distinct from job.input_fingerprint or p_input_fingerprint is distinct from public.planning_context_fingerprint(job.user_id,job.application_id) then raise check_violation using message='stale_context';end if;
 if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>100 then raise check_violation using message='Bounded proposal batch required';end if;
 select * into app from public.applications where id=job.application_id and user_id=job.user_id;
 if job.application_id is not null and (not found or app.status<>'planning') then return;end if;
 update public.task_proposals set status='needs_recheck',updated_at=now()
   where user_id=job.user_id and application_id is not distinct from job.application_id and status='pending' and input_fingerprint<>p_input_fingerprint;
 for candidate in select value from jsonb_array_elements(p_candidates) loop
   if jsonb_typeof(candidate) is distinct from 'object' or not(candidate ?& array['semantic_action_key','stage','title','description','reason','due_date','verbatim_due','evidence','source_version_id','legacy_task_key'])
     or (select count(*) from jsonb_object_keys(candidate))<>11
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
     if candidate->>'due_date' is not null and ((candidate->>'due_date') !~ '^\d{4}-\d{2}-\d{2}$' or (candidate->>'due_date')::date<current_date or not exists(select 1 from jsonb_array_elements(reviewed.facts) f where f->>'status'='verified' and f->>'kind'='deadline' and f->>'applicability'=offering.applicant_group and f->>'verbatim'=candidate->>'verbatim_due')) then raise check_violation using message='Current literal reviewed deadline required';end if;
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
revoke all on function public.save_task_proposals(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_task_proposals(uuid,uuid,text,jsonb) to service_role;

create function public.approve_task_proposals(p_selection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected jsonb; proposal public.task_proposals%rowtype; task public.tasks%rowtype; result jsonb:='[]'; accepted_hash text;
 next_title text; next_description text; next_date date; edits jsonb; fields text[];
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 if jsonb_typeof(p_selection) is distinct from 'array' or jsonb_array_length(p_selection) not between 1 and 100
   or (select count(distinct e->>'id') from jsonb_array_elements(p_selection) e)<>jsonb_array_length(p_selection) then raise check_violation using message='Select exact shown IDs and revisions';end if;
 -- Lock in UUID order so overlapping selected batches cannot deadlock. One stale item rolls back all.
 perform 1 from public.task_proposals where user_id=auth.uid() and id in(select (e->>'id')::uuid from jsonb_array_elements(p_selection) e) order by id for update;
 if (select count(*) from public.task_proposals where user_id=auth.uid() and id in(select (e->>'id')::uuid from jsonb_array_elements(p_selection) e))<>jsonb_array_length(p_selection) then raise insufficient_privilege using message='Owned proposals required';end if;
 for selected in select value from jsonb_array_elements(p_selection) loop
   if jsonb_typeof(selected) is distinct from 'object' or not(selected ?& array['id','revision']) or (select count(*) from jsonb_object_keys(selected))<>(case when selected ? 'edit' then 3 else 2 end) then raise check_violation using message='Invalid proposal selection';end if;
   select * into proposal from public.task_proposals where id=(selected->>'id')::uuid and user_id=auth.uid();
   accepted_hash:=encode(sha256(convert_to(selected::text,'UTF8')),'hex');
   if proposal.status='approved' and proposal.approved_revision=(selected->>'revision')::bigint and proposal.approval_fingerprint=accepted_hash then
     select * into task from public.tasks where id=proposal.approved_task_id and user_id=auth.uid();
     result:=result||jsonb_build_array(jsonb_build_object('status',case when found then 'already_exists' else 'deleted' end,'proposal_id',proposal.id,'task_id',proposal.approved_task_id));continue;
   end if;
   if proposal.status<>'pending' or proposal.revision<>(selected->>'revision')::bigint then raise check_violation using message='Proposal revision needs refreshed review';end if;
   perform 1 from public.profiles where user_id=auth.uid() for share;
   if proposal.application_id is not null then perform 1 from public.applications where id=proposal.application_id and user_id=auth.uid() for share;end if;
   if proposal.input_fingerprint is distinct from public.planning_context_fingerprint(auth.uid(),proposal.application_id) then raise check_violation using message='stale_context';end if;
   if proposal.stage='verified' and not exists(select 1 from public.course_offering_versions v join public.applications a on a.offering_id=v.offering_id where a.id=proposal.application_id and a.user_id=auth.uid() and a.status='planning' and v.id=proposal.source_version_id and v.review_status='verified' and v.version=(select max(version) from public.course_offering_versions where offering_id=a.offering_id and review_status='verified')) then raise check_violation using message='Verified applicability needs refreshed review';end if;
   next_title:=proposal.title;next_description:=proposal.description;next_date:=proposal.due_date;fields:=proposal.change_fields;
   edits:=selected->'edit';
   if selected ? 'edit' then
     if jsonb_typeof(edits) is distinct from 'object' or not(edits ?& array['title','description','due_date']) or (select count(*) from jsonb_object_keys(edits))<>3
       or jsonb_typeof(edits->'title') is distinct from 'string' or jsonb_typeof(edits->'description') not in ('string','null') or jsonb_typeof(edits->'due_date') not in ('string','null')
       or length(btrim(edits->>'title')) not between 1 and 200 or length(edits->>'description')>2000 or (edits->>'due_date' is not null and edits->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$') then raise check_violation using message='Invalid personal task edit';end if;
     next_title:=edits->>'title';next_description:=edits->>'description';next_date:=(edits->>'due_date')::date;
     -- Full edit form is a snapshot, not permission to overwrite unrelated personal changes.
     if next_title is distinct from proposal.title then fields:=array_append(fields,'title');end if;
     if next_description is distinct from proposal.description then fields:=array_append(fields,'description');end if;
     if next_date is distinct from proposal.due_date then fields:=array_append(fields,'due_date');end if;
   end if;
   if proposal.approved_task_id is null then
     insert into public.tasks(user_id,application_id,title,description,due_date,task_key,source_url,verbatim_due,has_personal_edits)
     values(auth.uid(),proposal.application_id,next_title,next_description,next_date,null,proposal.evidence->0->>'source_url',case when edits is null then proposal.verbatim_due else null end,true) returning * into task;
   else
     select * into task from public.tasks where id=proposal.approved_task_id and user_id=auth.uid() and application_id is not distinct from proposal.application_id for update;
     if not found or task.planning_revision is distinct from proposal.base_task_revision then raise check_violation using message='Task changed since proposal; refresh review';end if;
     update public.tasks set title=case when 'title'=any(fields) then next_title else title end,
       description=case when 'description'=any(fields) then next_description else description end,
       due_date=case when 'due_date'=any(fields) then next_date else due_date end,
       verbatim_due=case when 'due_date'=any(fields) then case when edits is null then proposal.verbatim_due else null end else verbatim_due end,
       has_personal_edits=true where id=task.id returning * into task;
   end if;
   update public.task_proposals set status='approved',approved_task_id=task.id,approved_revision=proposal.revision,approval_fingerprint=accepted_hash,
     base_task_revision=task.planning_revision,before_task=null,updated_at=now() where id=proposal.id;
   result:=result||jsonb_build_array(jsonb_build_object('status',case when proposal.approved_task_id is null then 'created' else 'updated' end,'proposal_id',proposal.id,'task_id',task.id,'title',task.title,'due_date',task.due_date,'application_id',task.application_id));
 end loop;
 return result;
end $$;
revoke all on function public.approve_task_proposals(jsonb) from public,anon;
grant execute on function public.approve_task_proposals(jsonb) to authenticated;

create function public.dismiss_task_proposal(p_id uuid,p_revision bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 update public.task_proposals set status='dismissed',updated_at=now() where id=p_id and user_id=auth.uid() and revision=p_revision and status in ('pending','dismissed','needs_recheck');
 return found;
end $$;
revoke all on function public.dismiss_task_proposal(uuid,bigint) from public,anon;
grant execute on function public.dismiss_task_proposal(uuid,bigint) to authenticated;

-- Only the protected producer's committed reconciliation audit is a verified planning event.
-- The trigger writes an outbox in the producer transaction; workers cannot see rolled-back publication.
create function public.enqueue_published_offering_planning() returns trigger language plpgsql security definer set search_path='' as $$
declare version public.course_offering_versions%rowtype; app public.applications%rowtype;
begin
 if new.course_reconciliation->>'format' is distinct from 'up-course-01/reconciliation-v1' then return new;end if;
 select * into version from public.course_offering_versions where id=(new.course_reconciliation->'version'->>'id')::uuid and review_status='verified' and reviewed_by=new.actor_user_id;
 if not found then return new;end if;
 for app in select a.* from public.applications a join public.course_offerings o on o.id=a.offering_id
   where a.offering_id=version.offering_id and a.status='planning' and o.applicant_group=a.offering_applicant_context->>'applicant_group'
 loop
   insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
   values(app.user_id,app.id,app.course_id,'verified',public.planning_context_fingerprint(app.user_id,app.id),version.id)
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 end loop;
 return new;
end $$;
revoke all on function public.enqueue_published_offering_planning() from public,anon,authenticated;
create trigger enqueue_published_offering_planning after insert on public.admin_audit_events for each row execute function public.enqueue_published_offering_planning();

-- Final DB backstop for a future generator that misses the application-shell flag.
-- Manual/chat/approved tasks always have task_key=NULL, so explicit writes pass through.
create function public.guard_automatic_task_insert() returns trigger language plpgsql security definer set search_path='' as $$
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
revoke all on function public.guard_automatic_task_insert() from public,anon,authenticated;
create trigger guard_automatic_task_insert before insert on public.tasks for each row execute function public.guard_automatic_task_insert();

-- Supersede stale inputs with a current event; do not spend three retries on an obsolete fingerprint.
create function public.refresh_planning_job(p_id uuid,p_worker uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; version_id uuid; next_event text;
begin
 select * into job from public.planning_jobs where id=p_id and state='running' and lease_owner=p_worker and lease_until>now() for update;
 if not found then return false;end if;
 select * into app from public.applications where id=job.application_id and user_id=job.user_id;
 next_event:=job.event;
 if job.event='verified' then
   select v.id into version_id from public.course_offering_versions v where v.offering_id=app.offering_id and v.review_status='verified'
     and exists(select 1 from public.admin_audit_events audit where audit.course_reconciliation->'version'->>'id'=v.id::text)
     order by v.version desc limit 1;
   if version_id is null then next_event:='preliminary';end if;
 end if;
 update public.planning_jobs set state='succeeded',error_code='stale_context',lease_owner=null,lease_until=null,updated_at=now() where id=job.id;
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(job.user_id,job.application_id,app.course_id,next_event,public.planning_context_fingerprint(job.user_id,job.application_id),version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 return true;
end $$;
revoke all on function public.refresh_planning_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.refresh_planning_job(uuid,uuid) to service_role;

-- Admins schedule shared-template reconciliation without receiving any private rows.
create function public.enqueue_course_template_planning(p_course_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare app public.applications%rowtype;
begin
 if not coalesce(public.is_admin(),false) then raise insufficient_privilege using message='admins only';end if;
 if not (select enabled from public.planning_settings where id) then return;end if;
 for app in select * from public.applications where course_id=p_course_id and status='planning' loop
   insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint)
   values(app.user_id,app.id,app.course_id,'preliminary',public.planning_context_fingerprint(app.user_id,app.id))
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 end loop;
end $$;
revoke all on function public.enqueue_course_template_planning(uuid) from public,anon;
grant execute on function public.enqueue_course_template_planning(uuid) to authenticated;

create function public.enqueue_changed_course_template_planning()
returns trigger language plpgsql security definer set search_path='' as $$
declare app public.applications%rowtype; course uuid;
begin
 if not (select enabled from public.planning_settings where id) then return null;end if;
 course:=case when tg_op='DELETE' then old.course_id else new.course_id end;
 for app in select * from public.applications where course_id=course and status='planning' loop
   insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint)
   values(app.user_id,app.id,app.course_id,'preliminary',public.planning_context_fingerprint(app.user_id,app.id))
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 end loop;
 return null;
end $$;
revoke all on function public.enqueue_changed_course_template_planning() from public,anon,authenticated;
create trigger enqueue_changed_course_template_planning after insert or update or delete on public.course_task_definitions for each row execute function public.enqueue_changed_course_template_planning();


alter table public.admin_audit_events drop constraint admin_audit_events_table_name_check,
  add constraint admin_audit_events_table_name_check check(table_name in ('rules','courses','course_task_definitions','course_task_source_reviews','programmes','planning_settings'));
alter table public.admin_audit_events add column planner_model_selection jsonb check(planner_model_selection is null or jsonb_typeof(planner_model_selection)='object');
create function public.set_planner_model(p_model text,p_catalogue_snapshot jsonb)
returns public.planning_settings language plpgsql security definer set search_path='' as $$
declare previous public.planning_settings%rowtype; result public.planning_settings%rowtype; price jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise insufficient_privilege using message='admins only';end if;
 if p_model is null or length(p_model) not between 1 and 200 or p_model !~ ':free$'
   or jsonb_typeof(p_catalogue_snapshot) is distinct from 'object' or length(p_catalogue_snapshot::text)>60000
   or p_catalogue_snapshot->>'id' is distinct from p_model
   or jsonb_typeof(p_catalogue_snapshot->'pricing') is distinct from 'object'
   or not ((p_catalogue_snapshot->'pricing') ?& array['prompt','completion'])
   or jsonb_typeof(p_catalogue_snapshot->'supported_parameters') is distinct from 'array'
   or not((p_catalogue_snapshot->'supported_parameters') ?& array['tools','tool_choice'])
 then raise check_violation using message='Current free tool-capable catalogue model required';end if;
 for price in select value from jsonb_each(p_catalogue_snapshot->'pricing') loop
   if jsonb_typeof(price) not in ('number','string') or (price #>> '{}') !~ '^\+?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$' or (price #>> '{}')::numeric<>0 then raise check_violation using message='Every applicable inference price must be known zero';end if;
 end loop;
 select * into previous from public.planning_settings where id for update;
 update public.planning_settings set planner_model=p_model,updated_by=auth.uid(),updated_at=now() where id returning * into result;
 insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,old_status,new_status,planner_model_selection)
 values(auth.uid(),'planning_settings','00000000-0000-4000-8000-000000000060','update',previous.planner_model,result.planner_model,
   jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(result),'catalogue_snapshot',p_catalogue_snapshot));
 -- Catalogue metadata is an audit snapshot, not proof of a successful inference.
 -- The worker must fetch/revalidate live provider metadata before every call.
 return result;
end $$;
revoke all on function public.set_planner_model(text,jsonb) from public,anon,service_role;
grant execute on function public.set_planner_model(text,jsonb) to authenticated;

