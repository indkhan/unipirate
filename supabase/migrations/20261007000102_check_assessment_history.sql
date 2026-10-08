-- UP-RULES-01 foundation only. Root must review/apply before consumer wiring.
-- Existing NULL authority is deliberately never backfilled or upgraded.
begin;
alter table public.checks add column assessment_metadata jsonb;
alter table public.checks drop constraint checks_claim_state_consistent;
alter table public.checks add constraint checks_claim_state_consistent
 check (claimed_by is null or claimed_at is not null);

create function public.valid_check_assessment_metadata(value jsonb)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare at_time timestamptz; item jsonb; version public.rule_versions%rowtype;
 ids text[] := array[]::text[]; logical_ids uuid[] := array[]::uuid[]; issue_rules text[] := array[]::text[];
begin
 if jsonb_typeof(value) is distinct from 'object' then return false; end if;
 if not (value ?& array['formatVersion','evaluatedAt','engineRevision','selectedVersionIds','selectionIssues'])
  or (select count(*) from jsonb_object_keys(value)) <> 5
  or value->'formatVersion' is distinct from '1'::jsonb
  or jsonb_typeof(value->'evaluatedAt') is distinct from 'string'
  or value->>'evaluatedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$'
  or not public.valid_course_capture_timestamp(value->>'evaluatedAt')
  or jsonb_typeof(value->'engineRevision') is distinct from 'string'
  or length(value->>'engineRevision') not between 1 and 200
  or value->>'engineRevision' <> btrim(value->>'engineRevision',
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
  or value->>'engineRevision' !~ '[a-zA-Z0-9]'
  or lower(value->>'engineRevision') in ('current','latest','unknown')
  or jsonb_typeof(value->'selectedVersionIds') is distinct from 'array'
  or jsonb_typeof(value->'selectionIssues') is distinct from 'array' then return false; end if;
 at_time := (value->>'evaluatedAt')::timestamptz;
 for item in select v from jsonb_array_elements(value->'selectedVersionIds') v loop
  if jsonb_typeof(item) is distinct from 'string'
   or item #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or (item #>> '{}') = any(ids) then return false; end if;
  select * into version from public.rule_versions where id=(item #>> '{}')::uuid;
  if not found or version.rule_id = any(logical_ids)
   or (version.provenance='human_publication' and (version.published_at is null or version.published_at > at_time)) then return false; end if;
  ids := array_append(ids,item #>> '{}'); logical_ids := array_append(logical_ids,version.rule_id);
 end loop;
 for item in select v from jsonb_array_elements(value->'selectionIssues') v loop
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if not (item ?& array['ruleId','versionId','reason']) or (select count(*) from jsonb_object_keys(item))<>3
   or jsonb_typeof(item->'ruleId') is distinct from 'string'
   or jsonb_typeof(item->'versionId') is distinct from 'string'
   or jsonb_typeof(item->'reason') is distinct from 'string'
   or item->>'ruleId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or item->>'versionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or item->>'reason' not in ('missing_intake','legacy_scope_unknown','invalid_publication')
   or (item->>'versionId') = any(ids) or (item->>'ruleId') = any(issue_rules)
   or (item->>'ruleId')::uuid = any(logical_ids) then return false; end if;
  select * into version from public.rule_versions where id=(item->>'versionId')::uuid;
  if not found or version.rule_id::text <> item->>'ruleId'
   or (version.provenance='human_publication' and (version.published_at is null or version.published_at > at_time))
   or (item->>'reason'='legacy_scope_unknown' and version.provenance<>'legacy_capture') then return false; end if;
  ids := array_append(ids,item->>'versionId'); issue_rules := array_append(issue_rules,item->>'ruleId');
 end loop;
 return true;
exception when others then return false;
end; $$;
alter function public.valid_check_assessment_metadata(jsonb) owner to postgres;
revoke all on function public.valid_check_assessment_metadata(jsonb) from public, anon, authenticated;
grant execute on function public.valid_check_assessment_metadata(jsonb) to service_role;

-- Invoker intentionally sees the real calling role, not a user-settable GUC.
create function public.protect_check_history() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
 if tg_op='INSERT' then
  if current_user not in ('service_role','postgres') then
   raise insufficient_privilege using message='checks require the private validated server writer';
  end if;
  if new.assessment_metadata is not null and
   (not public.valid_check_assessment_metadata(new.assessment_metadata)
    or jsonb_typeof(new.result) is distinct from 'object'
    or jsonb_typeof(new.answers) is distinct from 'object') then
   raise check_violation using message='invalid authoritative assessment metadata';
  end if;
  return new;
 elsif tg_op='DELETE' then
  if old.assessment_metadata is not null then
   raise insufficient_privilege using message='authoritative check history cannot be deleted';
  end if;
  return old;
 end if;
 if (to_jsonb(new)-'claimed_by'-'claimed_at') is distinct from (to_jsonb(old)-'claimed_by'-'claimed_at') then
  raise insufficient_privilege using message='original check payload and provenance are immutable';
 end if;
 if new.claimed_by is not distinct from old.claimed_by and new.claimed_at is not distinct from old.claimed_at then return new; end if;
 -- Only the FK's nested update following actual deletion of the referenced user
 -- may retain a claim tombstone. No caller can clear it, even service_role.
 if current_user='postgres' and pg_trigger_depth()>1
  and old.claimed_by is not null and old.claimed_at is not null
  and new.claimed_by is null and new.claimed_at is not distinct from old.claimed_at
  and not exists(select 1 from auth.users where id=old.claimed_by) then return new; end if;
 -- The sole browser update path is claim_check: authenticated actor, first claim,
 -- original answers already copied atomically, database transaction timestamp.
 if current_user='postgres' and auth.uid() is not null
  and old.claimed_by is null and old.claimed_at is null and old.owner_token_hash is not null
  and new.claimed_by=auth.uid() and new.claimed_at is not distinct from now()
  and exists(select 1 from auth.users where id=auth.uid())
  and exists(select 1 from public.profiles where user_id=auth.uid() and answers=old.answers) then return new; end if;
 raise insufficient_privilege using message='check ownership requires the guarded claim transaction';
end; $$;
alter function public.protect_check_history() owner to postgres;
revoke all on function public.protect_check_history() from public, anon, authenticated, service_role;
create trigger protect_check_history before insert or update or delete on public.checks
 for each row execute function public.protect_check_history();
-- Trade-off: refuse table-wide TRUNCATE even on an apparently empty history.
-- An old transaction snapshot cannot prove that no authoritative row committed
-- since that snapshot. Destructive migrations must explicitly manage DDL.
create function public.protect_check_history_truncate() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
 raise insufficient_privilege using message='check history cannot be truncated';
end; $$;
alter function public.protect_check_history_truncate() owner to postgres;
revoke all on function public.protect_check_history_truncate() from public, anon, authenticated, service_role;
create trigger protect_check_history_truncate before truncate on public.checks
 for each statement execute function public.protect_check_history_truncate();

revoke all on table public.checks from public, anon, authenticated;
-- Table revocation does not remove independent column grants.
do $$ declare columns text; begin
 select string_agg(quote_ident(attname),', ' order by attnum) into columns
 from pg_attribute where attrelid='public.checks'::regclass and attnum>0 and not attisdropped;
 execute format('revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.checks from public, anon, authenticated',columns);
end; $$;
-- Transactional signature replacement; no collection or private ownership projection.
drop function public.get_shared_check(uuid);
create function public.get_shared_check(p_check_id uuid)
returns table(id uuid,answers jsonb,result jsonb,created_at timestamptz,assessment_metadata jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
 select c.id,c.answers,c.result,c.created_at,c.assessment_metadata from public.checks c where c.id=p_check_id;
$$;
alter function public.get_shared_check(uuid) owner to postgres;
revoke all on function public.get_shared_check(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_shared_check(uuid) to anon, authenticated;

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
  if actor is null or p_token_hash is null or not exists(select 1 from auth.users where id=actor) then
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

  if check_row.claimed_by is not null or check_row.claimed_at is not null then
    return false;
  end if;

  insert into public.profiles (user_id, answers)
  values (actor, check_row.answers)
  on conflict (user_id) do update
  set answers = excluded.answers;

  update public.checks
  set claimed_by = actor,
      claimed_at = now()
  where id = p_check_id;

  return true;
end;
$$;


alter function public.claim_check(uuid,text) owner to postgres;
revoke all on function public.claim_check(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_check(uuid,text) to authenticated;
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
    when claimed_by is null and claimed_at is null
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


alter function public.result_viewer(uuid,text) owner to postgres;
revoke all on function public.result_viewer(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.result_viewer(uuid,text) to anon,authenticated;
commit;
