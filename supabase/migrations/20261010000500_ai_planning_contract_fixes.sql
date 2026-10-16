-- Correct the actual ten-field candidate contract; serialize semantic reconciliation per owner/application.
create or replace function public.save_task_proposals(p_job_id uuid,p_worker uuid,p_input_fingerprint text,p_candidates jsonb)
returns setof public.task_proposals language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; candidate jsonb; ev jsonb; material text;
 prior public.task_proposals%rowtype; target public.tasks%rowtype; offering public.course_offerings%rowtype;
 reviewed public.course_offering_versions%rowtype; proposal public.task_proposals%rowtype; fields text[]; next_status text;
begin
 select * into job from public.planning_jobs where id=p_job_id and state='running' and lease_owner=p_worker and lease_until>now() for update;
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
