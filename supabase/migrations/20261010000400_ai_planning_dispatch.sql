-- Event outbox dispatch survives browser closure. Deployment must explicitly
-- configure a reachable worker URL and matching secret; no live endpoint here.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.planning_dispatch (
 id boolean primary key default true check(id),
 worker_url text not null check(worker_url ~ '^https?://[^[:space:]]+/api/planning/worker$'),
 secret_id uuid not null,
 configured_at timestamptz not null default now()
);
revoke all on private.planning_dispatch from public, anon, authenticated;

create function public.configure_planning_dispatch(p_worker_url text,p_secret text)
returns void language plpgsql security definer set search_path='' as $$
declare secret uuid;previous_secret uuid;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege using message='Deployment credentials required';end if;
 if p_worker_url is null or p_worker_url !~ '^https?://[^[:space:]]+/api/planning/worker$'
  or length(p_worker_url)>2048 or length(p_secret) not between 32 and 512 then raise check_violation using message='Invalid dispatch configuration';end if;
 select secret_id into previous_secret from private.planning_dispatch where id for update;
 select vault.create_secret(p_secret) into secret;
 insert into private.planning_dispatch(id,worker_url,secret_id) values(true,p_worker_url,secret)
 on conflict(id) do update set worker_url=excluded.worker_url,secret_id=excluded.secret_id,configured_at=now();
 if previous_secret is not null then delete from vault.secrets where id=previous_secret;end if;
end $$;
revoke all on function public.configure_planning_dispatch(text,text) from public,anon,authenticated;
grant execute on function public.configure_planning_dispatch(text,text) to service_role;

create function private.dispatch_planning_jobs() returns bigint
language plpgsql security definer set search_path='' as $$
declare config private.planning_dispatch%rowtype;credential text;request_id bigint;
begin
 -- Only drain stored events. This minute timer never creates a daily planning event.
 if not exists(select 1 from public.planning_jobs where
   (state='queued' and available_at<=now() or state='running' and lease_until<now())
   and (event='research' or (select enabled from public.planning_settings where id))) then return null;end if;
 select * into config from private.planning_dispatch where id;
 if not found then return null;end if;
 select decrypted_secret into credential from vault.decrypted_secrets where id=config.secret_id;
 if credential is null then return null;end if;
 select net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=1000) into request_id;
 return request_id;
end $$;
revoke all on function private.dispatch_planning_jobs() from public,anon,authenticated;
select cron.schedule('unipirate-planning-dispatch','* * * * *','select private.dispatch_planning_jobs()');

-- Narrow lease-scoped research persistence. It never publishes facts or rules,
-- exposes private tasks, or overwrites an admin's concurrently edited draft.
create function public.save_planning_research(p_job_id uuid,p_worker uuid,p_expected_metadata jsonb,p_expected_sql_null boolean,p_draft jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.planning_jobs%rowtype;course public.courses%rowtype;application public.applications%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege using message='Worker credentials required';end if;
 select * into job from public.planning_jobs where id=p_job_id and event='research' and state='running' and lease_owner=p_worker and lease_until>now() for update;
 if not found then raise insufficient_privilege using message='Active research lease required';end if;
 select * into application from public.applications where id=job.application_id and user_id=job.user_id and course_id=job.course_id for share;
 if not found then raise check_violation using message='stale_context';end if;
 select * into course from public.courses where id=job.course_id for update;
 if not found or course.review_status<>'pending' or
  (case when p_expected_sql_null then course.field_extraction is not null else course.field_extraction is distinct from p_expected_metadata end) then raise check_violation using message='stale_context';end if;
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
