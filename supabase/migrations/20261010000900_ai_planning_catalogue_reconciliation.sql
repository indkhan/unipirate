-- Final catalogue reconciliation runs only after all cursor batches are persisted.
-- Scope is the current owner's application and exact immutable reviewed offering.
create function public.retire_missing_planning_proposals(
 p_job_id uuid,p_worker uuid,p_input_fingerprint text,p_supported_action_keys text[]
) returns integer language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; prefix text; changed integer;
begin
 select * into job from public.planning_jobs where id=p_job_id and state='running' and lease_owner=p_worker and lease_until>now() for update;
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
