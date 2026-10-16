-- Retry and presentation resolve current source context, while durable history remains intact.
create function public.current_planning_source_version(p_user uuid,p_application uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select v.id from public.course_offering_versions v
   join public.applications a on a.id=p_application and a.user_id=p_user and a.status='planning'
   join public.course_offerings o on o.id=v.offering_id
   join public.programmes programme on programme.id=o.programme_id
   where v.offering_id=a.offering_id and v.review_status='verified'
    and v.version=(select max(latest.version) from public.course_offering_versions latest where latest.offering_id=a.offering_id and latest.review_status='verified')
    and programme.legacy_course_id=a.course_id
    and o.applicant_group=a.offering_applicant_context->>'applicant_group'
    and a.offering_applicant_context->>'confirmed'='true'
    and exists(select 1 from public.admin_audit_events audit
     where audit.course_reconciliation->>'format'='up-course-01/reconciliation-v1'
      and audit.course_reconciliation->'version'->>'id'=v.id::text)
   order by v.version desc limit 1;
$$;
revoke all on function public.current_planning_source_version(uuid,uuid) from public,anon,authenticated;

-- Persist meaningful owner-context events in the same transaction as their source change.
create or replace function public.enqueue_relevant_planning_scope(p_user uuid,p_application uuid)
returns void language plpgsql security definer set search_path='' as $$
declare app public.applications%rowtype; version_id uuid;
begin
 if not coalesce((select enabled from public.planning_settings where id),false) then return;end if;
 if p_application is not null then
  select * into app from public.applications where id=p_application and user_id=p_user and status='planning';
  if not found then return;end if;
  version_id:=public.current_planning_source_version(p_user,p_application);
 end if;
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(p_user,p_application,app.course_id,case when version_id is null then 'preliminary' else 'verified' end,
  public.planning_context_fingerprint(p_user,p_application),version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
end $$;
revoke all on function public.enqueue_relevant_planning_scope(uuid,uuid) from public,anon,authenticated;


create function public.retry_planning_job(p_job_id uuid)
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
  select * into course from public.courses where id=app.course_id for share;
  if not found then return jsonb_build_object('status','obsolete','job_id',null);end if;
  if app.offering_id is not null then perform 1 from public.course_offerings where id=app.offering_id for share;end if;
 end if;
 select * into historical from public.planning_jobs where id=p_job_id and user_id=auth.uid() for update;
 if historical.state<>'failed' then raise check_violation using message='Only a failed saved job can be retried';end if;
 if historical.event='research' then
  if app.id is null or course.review_status<>'pending' then return jsonb_build_object('status','obsolete','job_id',null);end if;
  next_event:='research';
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
  available_at=case when planning_jobs.state='failed' then now() else planning_jobs.available_at end
 returning * into current_job;
 return jsonb_build_object('status',case when current_job.state='queued' then 'queued' else 'existing' end,'job_id',current_job.id);
end $$;
revoke all on function public.retry_planning_job(uuid) from public,anon;
grant execute on function public.retry_planning_job(uuid) to authenticated;

create function public.actionable_planning_jobs()
returns setof public.planning_jobs language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 return query select j.* from public.planning_jobs j
 left join public.applications a on a.id=j.application_id and a.user_id=auth.uid()
 left join public.courses c on c.id=a.course_id
 where j.user_id=auth.uid() and (j.application_id is null or a.status='planning')
 and j.input_fingerprint=public.planning_context_fingerprint(auth.uid(),j.application_id)
 and ((j.event='research' and c.review_status='pending')
  or (j.event<>'research' and j.source_version_id is not distinct from public.current_planning_source_version(auth.uid(),j.application_id)
   and j.event=case when public.current_planning_source_version(auth.uid(),j.application_id) is null then 'preliminary' else 'verified' end))
 order by j.created_at desc,j.id;
end $$;
revoke all on function public.actionable_planning_jobs() from public,anon;
grant execute on function public.actionable_planning_jobs() to authenticated;
