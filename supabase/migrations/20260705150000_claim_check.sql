create or replace function public.claim_check(
  p_check_id uuid,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  check_row public.checks%rowtype;
  actor uuid := (select auth.uid());
begin
  if actor is null or p_token_hash is null then
    return false;
  end if;

  select * into check_row
  from public.checks
  where id = p_check_id
  for update;

  if check_row.id is null
    or check_row.owner_token_hash is null
    or check_row.owner_token_hash <> p_token_hash
    or (check_row.claimed_by is not null and check_row.claimed_by <> actor)
  then
    return false;
  end if;

  if check_row.claimed_by = actor then
    return true;
  end if;

  insert into public.profiles (user_id, country_code, answers)
  values (
    actor,
    coalesce(
      check_row.profile ->> 'certificateCountry',
      check_row.profile ->> 'nationality'
    ),
    coalesce(check_row.answers, check_row.profile)
  )
  on conflict (user_id) do update
  set country_code = excluded.country_code,
      answers = excluded.answers;

  update public.checks
  set claimed_by = actor,
      claimed_at = now()
  where id = p_check_id;

  return true;
end;
$$;

revoke all on function public.claim_check(uuid, text) from public;
grant execute on function public.claim_check(uuid, text) to authenticated;

create or replace function public.result_viewer(
  p_check_id uuid,
  p_token_hash text default null
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when claimed_by = (select auth.uid()) then 'claimed_owner'
    when claimed_by is null
      and owner_token_hash is not null
      and owner_token_hash = p_token_hash then 'anonymous_owner'
    else 'public'
  end
  from public.checks
  where id = p_check_id;
$$;

revoke all on function public.result_viewer(uuid, text) from public;
grant execute on function public.result_viewer(uuid, text)
  to anon, authenticated;

