-- Current preliminary events include shared-template work; stale events resolve current authority.
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
  available_at=case when planning_jobs.state='failed' then now() else planning_jobs.available_at end
 returning * into current_job;
 return jsonb_build_object('status',case when current_job.state='queued' then 'queued' else 'existing' end,'job_id',current_job.id);
end $$;
revoke all on function public.retry_planning_job(uuid) from public,anon;
grant execute on function public.retry_planning_job(uuid) to authenticated;


create or replace function public.actionable_planning_jobs()
returns setof public.planning_jobs language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 return query select j.* from public.planning_jobs j
 left join public.applications a on a.id=j.application_id and a.user_id=auth.uid()
 left join public.courses c on c.id=a.course_id
 where j.user_id=auth.uid() and (j.application_id is null or a.status='planning')
 and j.input_fingerprint=public.planning_context_fingerprint(auth.uid(),j.application_id)
 and ((j.event='research' and c.review_status='pending')
  or (j.event='preliminary' and j.source_version_id is null)
  or (j.event='verified' and j.source_version_id=public.current_planning_source_version(auth.uid(),j.application_id)))
 order by j.created_at desc,j.id;
end $$;
revoke all on function public.actionable_planning_jobs() from public,anon;
grant execute on function public.actionable_planning_jobs() to authenticated;

create or replace function public.refresh_planning_job(p_id uuid,p_worker uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype; app public.applications%rowtype; version_id uuid; next_event text; fingerprint text; pending_research boolean;
begin
 select * into job from public.planning_jobs where id=p_id and state='running' and lease_owner=p_worker and lease_until>now() for update;
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
