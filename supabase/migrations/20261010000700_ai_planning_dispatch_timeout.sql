-- Keep the dispatch connection alive for the bounded research worker runtime.
create or replace function private.dispatch_planning_jobs() returns bigint
language plpgsql security definer set search_path='' as $$
declare config private.planning_dispatch%rowtype;credential text;request_id bigint;
begin
 if not exists(select 1 from public.planning_jobs where
   (state='queued' and available_at<=now() or state='running' and lease_until<now())
   and (event='research' or (select enabled from public.planning_settings where id))) then return null;end if;
 select * into config from private.planning_dispatch where id;
 if not found then return null;end if;
 select decrypted_secret into credential from vault.decrypted_secrets where id=config.secret_id;
 if credential is null then return null;end if;
 select net.http_post(url:=config.worker_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;
create or replace function public.configure_planning_dispatch(p_worker_url text,p_secret text)
returns void language plpgsql security definer set search_path='' as $$
declare secret uuid;previous_secret uuid;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege using message='Deployment credentials required';end if;
 if p_worker_url is null or p_worker_url !~ '^https?://[^[:space:]]+/api/planning/worker$'
  or length(p_worker_url)>2048 or p_secret is null or length(p_secret) not between 32 and 512 then raise check_violation using message='Invalid dispatch configuration';end if;
 select secret_id into previous_secret from private.planning_dispatch where id for update;
 select vault.create_secret(p_secret) into secret;
 insert into private.planning_dispatch(id,worker_url,secret_id) values(true,p_worker_url,secret)
 on conflict(id) do update set worker_url=excluded.worker_url,secret_id=excluded.secret_id,configured_at=now();
 if previous_secret is not null then delete from vault.secrets where id=previous_secret;end if;
end $$;
