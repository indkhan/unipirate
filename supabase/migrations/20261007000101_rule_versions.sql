-- UP-RULES-01 SCHEMA ONLY. Additive; do not apply until the app handoff is ready.
-- Stable rules.id remains the task/logical identity. No checks/tasks/apps are changed.
-- Date scope is explicit UTC ASSESSMENT calendar date, not an applicant event.
-- All bounds are [from, until); null human endpoints mean explicitly unbounded.
-- Intake index = year * 2 + (summer = 0, winter = 1), years 1..9999.
-- Legacy null endpoints mean UNKNOWN history, never retrospective universal scope.

create table public.rule_drafts (
  rule_id uuid primary key references public.rules(id) on delete restrict,
  raw_snapshot jsonb not null check (jsonb_typeof(raw_snapshot) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  edited_by uuid, -- historical UUID, not a cascading account FK; null initialization
  edited_at timestamptz not null default now(),
  effective_from date,
  effective_until date,
  intake_from integer,
  intake_until integer,
  check (effective_from is null or effective_from between date '0001-01-01' and date '9999-12-31'),
  check (effective_until is null or effective_until between date '0001-01-01' and date '9999-12-31'),
  check (effective_from is null or effective_until is null or effective_from < effective_until),
  check (intake_from is null or intake_from between 2 and 19999),
  -- 20000 permits the exclusive end after winter 9999.
  check (intake_until is null or intake_until between 2 and 20000),
  check (intake_from is null or intake_until is null or intake_from < intake_until)
);
create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  supersedes_version_id uuid,
  -- Entire stored workspace row, only status changed to the explicit approval.
  -- All conditions/outcomes/text/URL/quote/evidence metadata remain literal JSON.
  raw_snapshot jsonb not null check (jsonb_typeof(raw_snapshot) = 'object'),
  status public.rule_status not null check (status in ('beta','verified')),
  effective_from date,
  effective_until date,
  intake_from integer,
  intake_until integer,
  reviewed_by uuid, -- retained on account removal; never caller-controlled
  reviewed_at timestamptz,
  published_at timestamptz,
  captured_at timestamptz,
  provenance text not null check (provenance in ('human_publication','legacy_capture')),
  draft_revision bigint,
  unique (rule_id, version_number),
  unique (rule_id, id),
  -- NULL uniqueness permits one root per rule via version_number + insert guard.
  unique (supersedes_version_id),
  foreign key (rule_id, supersedes_version_id) references public.rule_versions(rule_id,id) on delete restrict,
  check ((raw_snapshot->>'id') is not distinct from rule_id::text and (raw_snapshot->>'status') is not distinct from status::text),
  check (effective_from is null or effective_from between date '0001-01-01' and date '9999-12-31'),
  check (effective_until is null or effective_until between date '0001-01-01' and date '9999-12-31'),
  check (effective_from is null or effective_until is null or effective_from < effective_until),
  check (intake_from is null or intake_from between 2 and 19999),
  check (intake_until is null or intake_until between 2 and 20000),
  check (intake_from is null or intake_until is null or intake_from < intake_until),
  check (case when provenance = 'legacy_capture' then
    reviewed_by is null and reviewed_at is null and published_at is null and captured_at is not null
    and draft_revision is null and effective_from is null and effective_until is null
    and intake_from is null and intake_until is null and version_number = 1 and supersedes_version_id is null
  else reviewed_by is not null and reviewed_at is not null and published_at is not null and published_at = reviewed_at
    and captured_at is null and draft_revision is not null and draft_revision > 0 end)
);

-- Capture only what actually exists, at the actual clock. This is NOT publication.
-- Even malformed historical evidence is kept exactly for honest later review.
insert into public.rule_versions(rule_id,version_number,raw_snapshot,status,captured_at,provenance)
select id,1,to_jsonb(r),status,clock_timestamp(),'legacy_capture'
from public.rules r where status in ('beta','verified');
insert into public.rule_drafts(rule_id,raw_snapshot)
select id,jsonb_set(to_jsonb(r),'{status}','"draft"') from public.rules r;

-- No course/programme columns, constraint rewrites, payload or grant changes.
alter table public.admin_audit_events add column rule_publication jsonb;

-- Basic SQL boundary only: the app MUST parse the RAW workspace with RuleSchema
-- before any mutation, and send that SAME JSON as its equality token. SQL does
-- not duplicate educational conditions/outcomes or derive facts from the token.
create function public.valid_rule_publication_snapshot(value jsonb, logical_id uuid, at_time timestamptz)
returns boolean language plpgsql stable set search_path = public, pg_temp as $$
declare c jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if not (value ?& array['id','conditions','outcomes','status','source_url','source_quote',
    'last_verified_at','notes','created_at','updated_at','slug','country_code'])
    or (select count(*) from jsonb_object_keys(value)) <> 12
    or value->>'id' is distinct from logical_id::text or value->>'status' is distinct from 'draft'
    or jsonb_typeof(value->'conditions') is distinct from 'object'
    or jsonb_typeof(value->'outcomes') is distinct from 'object'
    or value->'outcomes' = '{}'::jsonb
    or jsonb_typeof(value->'source_url') is distinct from 'string'
    or not public.valid_course_source_url(value->>'source_url')
    or jsonb_typeof(value->'source_quote') is distinct from 'string'
    or not public.valid_course_capture_text(value->>'source_quote')
    or jsonb_typeof(value->'last_verified_at') is distinct from 'string'
    or not public.valid_course_capture_timestamp(value->>'last_verified_at')
    or (value->>'last_verified_at')::timestamptz > at_time
    or jsonb_typeof(value->'created_at') is distinct from 'string'
    or not public.valid_course_capture_timestamp(value->>'created_at')
    or jsonb_typeof(value->'updated_at') is distinct from 'string'
    or not public.valid_course_capture_timestamp(value->>'updated_at')
    or (value->>'created_at')::timestamptz > (value->>'updated_at')::timestamptz
    or (value->>'updated_at')::timestamptz > at_time
    or (value->'notes' <> 'null'::jsonb and jsonb_typeof(value->'notes') <> 'string')
    or (value->'slug' <> 'null'::jsonb and (jsonb_typeof(value->'slug') <> 'string' or not public.valid_course_capture_text(value->>'slug')))
    or (value->'country_code' <> 'null'::jsonb and (jsonb_typeof(value->'country_code') <> 'string' or value->>'country_code' !~ '^[a-z]{2}$')) then return false; end if;
  for c in select v from jsonb_each(value->'conditions') as entry(k,v) loop
    if jsonb_typeof(c) in ('string','number','boolean') then continue; end if;
    if jsonb_typeof(c) is distinct from 'object' then return false; end if;
    if not (c ?& array['op','value']) or (select count(*) from jsonb_object_keys(c)) <> 2
      or coalesce(c->>'op','') not in ('eq','neq','gte','gt','lte','lt','in','nin') then return false; end if;
    if c->>'op' in ('gte','gt','lte','lt') and jsonb_typeof(c->'value') is distinct from 'number' then return false; end if;
    if c->>'op' in ('eq','neq') and jsonb_typeof(c->'value') not in ('string','number','boolean') then return false; end if;
    if c->>'op' in ('in','nin') then
      if jsonb_typeof(c->'value') is distinct from 'array' then return false; end if;
      if jsonb_array_length(c->'value') = 0 or exists (select 1 from jsonb_array_elements(c->'value') v where jsonb_typeof(v) not in ('string','number','boolean')) then return false; end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end; $$;

-- SECURITY INVOKER is essential: see current_user in the protected definer's
-- execution context, never a caller-settable GUC. API roles cannot SET ROLE postgres.
create function public.protect_rule_history() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin raise insufficient_privilege using message = 'published rule history is immutable'; end; $$;
create trigger protect_rule_history before update or delete on public.rule_versions
for each row execute function public.protect_rule_history();
create trigger protect_rule_history_truncate before truncate on public.rule_versions
for each statement execute function public.protect_rule_history();
create function public.protect_rule_version_insert() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare predecessor public.rule_versions%rowtype;
begin
  if current_user <> 'postgres' or auth.uid() is null or not coalesce(public.is_admin(),false)
    or new.provenance <> 'human_publication' or new.reviewed_by is distinct from auth.uid()
    or new.reviewed_at is distinct from now() or new.published_at is distinct from now() then
    raise insufficient_privilege using message = 'rule versions require the protected admin publication RPC';
  end if;
  -- Defense in depth alongside the lock in the only granted insertion path.
  perform 1 from public.rules where id=new.rule_id for update;
  select * into predecessor from public.rule_versions where rule_id=new.rule_id order by version_number desc limit 1;
  if new.version_number <> coalesce(predecessor.version_number,0)+1
    or new.supersedes_version_id is distinct from predecessor.id then
    raise check_violation using message = 'rule version must append its current predecessor';
  end if;
  return new;
end; $$;
create trigger protect_rule_version_insert before insert on public.rule_versions
for each row execute function public.protect_rule_version_insert();

create function public.stamp_rule_draft() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op='DELETE' then raise insufficient_privilege using message='rule workspace revision history cannot reset'; end if;
  if tg_op='UPDATE' then
    if auth.uid() is null or not coalesce(public.is_admin(),false) then
      raise insufficient_privilege using message='draft edits require an authenticated admin';
    end if;
    if new.rule_id is distinct from old.rule_id then raise insufficient_privilege using message='logical rule identity is immutable'; end if;
    new.revision := old.revision+1;
  else
    if current_user <> 'postgres' then raise insufficient_privilege using message='workspace initialization is database controlled'; end if;
    new.revision := 1;
  end if;
  if jsonb_typeof(new.raw_snapshot) is distinct from 'object'
    or new.raw_snapshot->>'id' is distinct from new.rule_id::text
    or new.raw_snapshot->>'status' is distinct from 'draft' then
    raise check_violation using message='workspace must contain the same logical ID and draft status';
  end if;
  new.edited_by := auth.uid();
  new.edited_at := now();
  return new;
end; $$;
create trigger stamp_rule_draft before insert or update or delete on public.rule_drafts
for each row execute function public.stamp_rule_draft();

create function public.initialize_rule_draft() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.rule_drafts(rule_id,raw_snapshot)
  values (new.id,jsonb_set(to_jsonb(new),'{status}','"draft"'));
  return new;
end; $$;
alter function public.initialize_rule_draft() owner to postgres;
revoke all on function public.initialize_rule_draft() from public,anon,authenticated,service_role;
create trigger initialize_rule_draft after insert on public.rules for each row execute function public.initialize_rule_draft();

create function public.protect_rule_compatibility() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op='INSERT' then
    if new.status <> 'draft' then raise insufficient_privilege using message='new logical rules must start as drafts'; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise insufficient_privilege using message='logical rule identities cannot be deleted'; end if;
  if current_user <> 'postgres' or auth.uid() is null or not coalesce(public.is_admin(),false) then
    raise insufficient_privilege using message='rule compatibility content is written only by publication';
  end if;
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise insufficient_privilege using message='logical rule identity is immutable';
  end if;
  return new;
end; $$;
create trigger protect_rule_compatibility before insert or update or delete on public.rules
for each row execute function public.protect_rule_compatibility();
-- The protected publication event replaces only the rules mirror's generic audit.
-- Existing audit rows and every course/programme trigger are preserved.
drop trigger audit_rules_update on public.rules;

create function public.protect_rule_publication_journal() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op='INSERT' then
    if new.rule_publication is not null and (current_user <> 'postgres'
      or auth.uid() is null or not coalesce(public.is_admin(),false)) then
      raise insufficient_privilege using message='rule publication journal requires the protected RPC';
    end if;
    return new;
  end if;
  if old.rule_publication is not null then
    -- Retain existing FK ON DELETE SET NULL behavior without allowing payload,
    -- event/time/row changes. Attribution remains in the immutable payload.
    if tg_op='UPDATE' then
      if current_user='postgres' and old.actor_user_id is not null and new.actor_user_id is null
        and (to_jsonb(new)-'actor_user_id')=(to_jsonb(old)-'actor_user_id')
        and not exists (select 1 from auth.users where id=old.actor_user_id) then return new; end if;
    end if;
    raise insufficient_privilege using message='rule publication journal is immutable';
  end if;
  if tg_op='UPDATE' then
    if new.rule_publication is not null then raise insufficient_privilege using message='existing audit history cannot become a publication'; end if;
    return new;
  end if;
  return old;
end; $$;
create trigger protect_rule_publication_journal before insert or update or delete on public.admin_audit_events
for each row execute function public.protect_rule_publication_journal();
-- A statement trigger needs owner visibility to detect protected rows even when
-- the caller's SELECT RLS hides them. It does not authorize any row mutation.
create function public.protect_rule_journal_truncate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.admin_audit_events where rule_publication is not null) then
    raise insufficient_privilege using message='rule publication journal is immutable';
  end if;
  return null;
end; $$;
alter function public.protect_rule_journal_truncate() owner to postgres;
revoke all on function public.protect_rule_journal_truncate() from public,anon,authenticated,service_role;
create trigger protect_rule_publication_journal_truncate before truncate on public.admin_audit_events
for each statement execute function public.protect_rule_journal_truncate();

create function public.publish_rule_version(
  p_rule_id uuid,
  p_expected_draft_revision bigint,
  p_expected_raw_snapshot jsonb,
  p_expected_predecessor_id uuid,
  p_approval_status public.rule_status
) returns public.rule_versions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  logical public.rules%rowtype;
  draft public.rule_drafts%rowtype;
  predecessor public.rule_versions%rowtype;
  published public.rule_versions%rowtype;
  publication_time timestamptz := now();
  snapshot jsonb;
begin
  if actor is null or not coalesce(public.is_admin(),false)
    or not exists (select 1 from auth.users where id=actor) then
    raise insufficient_privilege using message='rule publication requires an authenticated admin';
  end if;
  if p_rule_id is null or p_expected_draft_revision is null or p_expected_draft_revision < 1
    or jsonb_typeof(p_expected_raw_snapshot) is distinct from 'object'
    or p_approval_status is null or p_approval_status not in ('beta','verified') then
    raise check_violation using message='invalid rule publication approval';
  end if;
  -- Fixed lock order. Draft saves take its row lock; a publisher waits then
  -- rechecks the revision/token. Two publishers cannot create two successors.
  select * into logical from public.rules where id=p_rule_id for update;
  if not found then raise check_violation using message='unknown logical rule'; end if;
  select * into draft from public.rule_drafts where rule_id=p_rule_id for update;
  if not found or draft.revision is distinct from p_expected_draft_revision
    or draft.raw_snapshot is distinct from p_expected_raw_snapshot then
    raise check_violation using message='rule draft changed; reload and review again';
  end if;
  select * into predecessor from public.rule_versions where rule_id=p_rule_id order by version_number desc limit 1;
  if predecessor.id is distinct from p_expected_predecessor_id then
    raise check_violation using message='rule predecessor changed; reload and review again';
  end if;
  if not public.valid_rule_publication_snapshot(draft.raw_snapshot,p_rule_id,publication_time)
    or (draft.raw_snapshot->>'created_at')::timestamptz is distinct from logical.created_at then
    raise check_violation using message='invalid stored rule publication snapshot or evidence';
  end if;
  -- Never read facts/captures from the expectation token, never stamp source
  -- verification as publication. Explicit reverification appends another version.
  snapshot := jsonb_set(draft.raw_snapshot,'{status}',to_jsonb(p_approval_status::text));
  insert into public.rule_versions(rule_id,version_number,supersedes_version_id,raw_snapshot,status,
    effective_from,effective_until,intake_from,intake_until,reviewed_by,reviewed_at,published_at,provenance,draft_revision)
  values (p_rule_id,coalesce(predecessor.version_number,0)+1,predecessor.id,snapshot,p_approval_status,
    draft.effective_from,draft.effective_until,draft.intake_from,draft.intake_until,actor,publication_time,publication_time,'human_publication',draft.revision)
  returning * into published;
  insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,old_status,new_status,created_at,rule_publication)
  values (actor,'rules',p_rule_id,'update',logical.status::text,p_approval_status::text,publication_time,jsonb_build_object(
    'format','up-rules-01/publication-v1','rule_id',p_rule_id,'version_id',published.id,
    'version_number',published.version_number,'supersedes_version_id',predecessor.id,
    'draft_revision',draft.revision,'reviewed_by',actor,'reviewed_at',publication_time,'published_at',publication_time,
    'status',p_approval_status,'effective_from',draft.effective_from,'effective_until',draft.effective_until,
    'intake_from',draft.intake_from,'intake_until',draft.intake_until
  ));
  update public.rules set conditions=snapshot->'conditions',outcomes=snapshot->'outcomes',status=p_approval_status,
    source_url=snapshot->>'source_url',source_quote=snapshot->>'source_quote',
    last_verified_at=(snapshot->>'last_verified_at')::timestamptz,notes=snapshot->>'notes',
    slug=snapshot->>'slug',country_code=snapshot->>'country_code'
  where id=p_rule_id;
  -- Existing set_updated_at uses now(): same server clock as version+journal.
  -- Any failed insert/trigger/mirror write rolls back the entire statement.
  return published;
end; $$;
alter function public.publish_rule_version(uuid,bigint,jsonb,uuid,public.rule_status) owner to postgres;
revoke all on function public.publish_rule_version(uuid,bigint,jsonb,uuid,public.rule_status) from public,anon,service_role;
grant execute on function public.publish_rule_version(uuid,bigint,jsonb,uuid,public.rule_status) to authenticated;

alter table public.rule_drafts enable row level security;
alter table public.rule_versions enable row level security;
create policy "admin draft read" on public.rule_drafts for select to authenticated
using ((select auth.uid()) is not null and (select public.is_admin()));
create policy "admin draft edit" on public.rule_drafts for update to authenticated
using ((select auth.uid()) is not null and (select public.is_admin()))
with check ((select auth.uid()) is not null and (select public.is_admin()));
create policy "published version read" on public.rule_versions for select to anon,authenticated using (true);
-- No version INSERT/UPDATE/DELETE policy; no client workspace deletion/reset.
revoke all on public.rule_drafts,public.rule_versions from public,anon,authenticated,service_role;
grant select on public.rule_drafts to authenticated;
grant update(raw_snapshot,effective_from,effective_until,intake_from,intake_until) on public.rule_drafts to authenticated;
grant select on public.rule_versions to anon,authenticated,service_role;
revoke update,delete,truncate on public.rules from anon,authenticated,service_role;
grant insert on public.rules to authenticated; -- existing admin RLS plus draft-only trigger
-- Audit privileges/policies stay as before; invoker trigger closes service forgery.
revoke all on function public.protect_rule_history(),public.protect_rule_version_insert(),
  public.stamp_rule_draft(),public.protect_rule_compatibility(),public.protect_rule_publication_journal()
from public,anon,authenticated,service_role;
