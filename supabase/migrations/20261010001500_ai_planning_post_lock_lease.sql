-- Research leases must still be valid after acquiring a previously blocked job row.
create or replace function public.save_planning_research(p_job_id uuid,p_worker uuid,p_expected_metadata jsonb,p_expected_sql_null boolean,p_draft jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype;course public.courses%rowtype;application public.applications%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege using message='Worker credentials required';end if;
 select * into job from public.planning_jobs where id=p_job_id and event='research' and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp();
 if not found then raise insufficient_privilege using message='Active research lease required';end if;
 select * into application from public.applications where id=job.application_id and user_id=job.user_id and course_id=job.course_id for share;
 if not found then raise check_violation using message='stale_context';end if;
 select * into course from public.courses where id=job.course_id for update;
 if not found or course.review_status<>'pending' or
  (case when p_expected_sql_null then course.field_extraction is not null else course.field_extraction is distinct from p_expected_metadata end) then raise check_violation using message='stale_context';end if;
 -- Context locks precede the job lock, matching authenticated retry.
 -- Revalidate after waiting: an expired/reassigned lease cannot persist a draft.
 select * into job from public.planning_jobs where id=p_job_id and event='research' and state='running' and lease_owner=p_worker and lease_until>pg_catalog.clock_timestamp() for update;
 -- A row-lock holder may release without updating it, so WHERE qualification
 -- before the wait is insufficient: check the acquired lease against the live clock.
 if not found or job.lease_until<=pg_catalog.clock_timestamp() then raise insufficient_privilege using message='Active research lease required';end if;
 if p_expected_sql_null is null or jsonb_typeof(p_draft) is distinct from 'object'
  or p_draft->>'format' is distinct from 'up-course-01/v1' or p_draft->>'status' not in ('draft','incomplete')
  or p_draft->'identity'->>'name' is distinct from course.name or p_draft->'identity'->>'university' is distinct from course.university_name
  or p_draft->'identity'->>'source_url' is distinct from course.source_url then raise check_violation using message='Invalid research draft';end if;
 if course.field_extraction->'research' ? 'paste' and p_draft->>'paste' is distinct from course.field_extraction->'research'->>'paste' then raise check_violation using message='Original paste must be retained';end if;
 update public.courses set field_extraction=coalesce(course.field_extraction,'{}'::jsonb)||jsonb_build_object('research',p_draft) where id=course.id;
 if (select enabled from public.planning_settings where id) then
  insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint)
   values(job.user_id,job.application_id,job.course_id,'preliminary',public.planning_context_fingerprint(job.user_id,job.application_id))
   on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
 end if;
 return true;
end $$;
revoke all on function public.save_planning_research(uuid,uuid,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_planning_research(uuid,uuid,jsonb,boolean,jsonb) to service_role;
