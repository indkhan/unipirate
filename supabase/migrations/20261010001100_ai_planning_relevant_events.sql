-- Persist meaningful owner-context events in the same transaction as their source change.
create function public.enqueue_relevant_planning_scope(p_user uuid,p_application uuid)
returns void language plpgsql security definer set search_path='' as $$
declare app public.applications%rowtype; version_id uuid;
begin
 if not coalesce((select enabled from public.planning_settings where id),false) then return;end if;
 if p_application is not null then
  select * into app from public.applications where id=p_application and user_id=p_user and status='planning';
  if not found then return;end if;
  select v.id into version_id from public.course_offering_versions v
   join public.course_offerings o on o.id=v.offering_id
   join public.programmes programme on programme.id=o.programme_id
   where v.offering_id=app.offering_id and v.review_status='verified'
    and v.version=(select max(latest.version) from public.course_offering_versions latest where latest.offering_id=app.offering_id and latest.review_status='verified')
    and programme.legacy_course_id=app.course_id
    and o.applicant_group=app.offering_applicant_context->>'applicant_group'
    and app.offering_applicant_context->>'confirmed'='true'
    and exists(select 1 from public.admin_audit_events audit
     where audit.course_reconciliation->>'format'='up-course-01/reconciliation-v1'
      and audit.course_reconciliation->'version'->>'id'=v.id::text)
   order by v.version desc limit 1;
 end if;
 insert into public.planning_jobs(user_id,application_id,course_id,event,input_fingerprint,source_version_id)
 values(p_user,p_application,app.course_id,case when version_id is null then 'preliminary' else 'verified' end,
  public.planning_context_fingerprint(p_user,p_application),version_id)
 on conflict(user_id,application_id,event,input_fingerprint,source_version_id) do nothing;
end $$;
revoke all on function public.enqueue_relevant_planning_scope(uuid,uuid) from public,anon,authenticated;

create function public.enqueue_changed_owner_planning_context()
returns trigger language plpgsql security definer set search_path='' as $$
declare app_id uuid;
begin
 if not coalesce((select enabled from public.planning_settings where id),false) then return new;end if;
 if tg_table_name='tasks' then
  if old.done is distinct from new.done then perform public.enqueue_relevant_planning_scope(new.user_id,new.application_id);end if;
 elsif tg_table_name='profiles' then
  if tg_op='INSERT' and new.answers='{}'::jsonb then return new;end if;
  if tg_op='UPDATE' and old.answers is not distinct from new.answers then return new;end if;
  perform public.enqueue_relevant_planning_scope(new.user_id,null);
  for app_id in select id from public.applications where user_id=new.user_id and status='planning' order by id
  loop perform public.enqueue_relevant_planning_scope(new.user_id,app_id);end loop;
 elsif tg_table_name='applications' then
  if tg_op='UPDATE' and row(old.course_id,old.status,old.offering_id,old.offering_applicant_context)
   is not distinct from row(new.course_id,new.status,new.offering_id,new.offering_applicant_context) then return new;end if;
  perform public.enqueue_relevant_planning_scope(new.user_id,new.id);
 end if;
 return new;
end $$;
revoke all on function public.enqueue_changed_owner_planning_context() from public,anon,authenticated;
create trigger planning_task_progress_outbox after update of done on public.tasks
 for each row execute function public.enqueue_changed_owner_planning_context();
create trigger planning_profile_context_outbox after insert or update of answers on public.profiles
 for each row execute function public.enqueue_changed_owner_planning_context();
create trigger planning_application_context_outbox after insert or update of course_id,status,offering_id,offering_applicant_context on public.applications
 for each row execute function public.enqueue_changed_owner_planning_context();
