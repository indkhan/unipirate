-- One bounded model batch per lease. Store progress so a slow free provider
-- cannot force every request/retry to start a large catalogue from batch one.
alter table public.planning_jobs add column cursor bigint not null default 0 check(cursor >= 0);

create function public.advance_planning_job(p_id uuid,p_worker uuid,p_current_cursor bigint,p_next_cursor bigint,p_complete boolean)
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
   available_at=now(),lease_owner=null,lease_until=null,error_code=null,updated_at=now()
 where id=p_id and event<>'research' and state='running' and lease_owner=p_worker and lease_until>now() and cursor=p_current_cursor;
 return found;
end $$;
revoke all on function public.advance_planning_job(uuid,uuid,bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.advance_planning_job(uuid,uuid,bigint,bigint,boolean) to service_role;
