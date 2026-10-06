-- Additive repair after 00100 was applied. Never rewrites historical snapshots.
create function public.valid_course_source_url(value text)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare parts text[];
begin
  if value is null or value ~ '[^!-~]' or strpos(value, chr(92)) > 0 then return false; end if;
  parts := regexp_match(value, '^https?://((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})(?::([0-9]{1,5}))?([/?#].*)?$');
  return parts is not null and length(parts[1]) <= 253
    and (parts[2] is null or parts[2]::integer between 1 and 65535);
end;
$$;
create function public.valid_offering_source_urls(facts jsonb)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select not exists (
    select 1 from jsonb_array_elements(facts) f,
      jsonb_array_elements(f->'evidence') e
    where not public.valid_course_source_url(e->>'source_url')
  )
$$;
-- NOT VALID preserves any pre-existing malformed captures for explicit review;
-- all new inserts/updates must obey the contract. No fabricated historical fix.
alter table public.programmes add constraint programme_source_url_contract
  check (public.valid_course_source_url(source_url)) not valid;
alter table public.course_offering_versions add constraint offering_source_urls_contract
  check (public.valid_offering_source_urls(facts)) not valid;

create function public.bind_offering_capture_reviewer()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare fact jsonb; capture jsonb; actor uuid := (select auth.uid());
begin
  -- Shape errors belong to CHECK constraints, including service-role gate tests.
  if not public.valid_offering_facts(new.facts, new.review_status = 'verified') then return new; end if;
  for fact in select value from jsonb_array_elements(new.facts) loop
    for capture in select value from jsonb_array_elements(fact->'evidence') loop
      if capture->>'last_verified_at' is null then continue; end if;
      if actor is null or not (select public.is_admin()) then
        raise insufficient_privilege using message = 'verified evidence requires an authenticated admin reviewer';
      end if;
      if (capture->>'verified_by')::uuid = actor then continue; end if;
      -- Carry-forward is exact, in the same immutable offering and field scope.
      -- Its original reviewer must have attested it in a previous reviewed row.
      if not exists (
        select 1 from public.course_offering_versions v,
          jsonb_array_elements(v.facts) previous_fact,
          jsonb_array_elements(previous_fact->'evidence') previous_capture
        where v.offering_id = new.offering_id and v.version < new.version
          and v.review_status = 'verified' and previous_fact->>'status' = 'verified'
          and v.reviewed_by = (capture->>'verified_by')::uuid
          and previous_fact - 'evidence' = fact - 'evidence'
          and previous_capture = capture
      ) then
        raise insufficient_privilege using message = 'fresh or changed evidence must name the current reviewer';
      end if;
    end loop;
  end loop;
  return new;
end;
$$;
create trigger bind_capture_reviewer before insert on public.course_offering_versions
  for each row execute function public.bind_offering_capture_reviewer();

-- Research drafts start with no legacy link. A link can attach once after the
-- legacy course is approved and is not a conflict submission; never replace it.
create or replace function public.preserve_programme_identity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at
    or (old.legacy_course_id is not null and new.legacy_course_id is distinct from old.legacy_course_id) then
    raise exception 'programme identity is immutable';
  end if;
  return new;
end;
$$;
create function public.require_canonical_legacy_course()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.legacy_course_id is not null then
    perform 1 from public.courses where id = new.legacy_course_id
      and review_status = 'approved' and conflicts_with is null for share;
    if not found then raise check_violation using message = 'legacy link requires an approved non-conflict course'; end if;
  end if;
  return new;
end;
$$;
create trigger require_canonical_course before insert or update of legacy_course_id on public.programmes
  for each row execute function public.require_canonical_legacy_course();
grant update (legacy_course_id) on public.programmes to authenticated;

-- A linked canonical course must stay compatible with the FK lifecycle.
create function public.preserve_canonical_course_lifecycle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.review_status <> 'approved' or new.conflicts_with is not null)
    and exists (select 1 from public.programmes where legacy_course_id = new.id) then
    raise check_violation using message = 'linked canonical course must remain approved and non-conflict';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_canonical_course_lifecycle() from public;
create trigger preserve_canonical_lifecycle before update of review_status, conflicts_with on public.courses
  for each row execute function public.preserve_canonical_course_lifecycle();

-- The initial attachment is meaningful too; audit the new identity link.
drop trigger audit_correction on public.programmes;
create trigger audit_correction after update on public.programmes for each row
  when (old.name is distinct from new.name or old.university_name is distinct from new.university_name
    or old.degree is distinct from new.degree or old.source_url is distinct from new.source_url
    or old.legacy_course_id is distinct from new.legacy_course_id)
  execute function public.audit_programme_correction();
create or replace function public.audit_programme_correction()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.admin_audit_events(actor_user_id, table_name, row_id, action, programme_correction)
  values (auth.uid(), 'programmes', new.id, 'update', jsonb_build_object(
    'old', to_jsonb(old) - array['id','created_at'],
    'new', to_jsonb(new) - array['id','created_at']
  ));
  return new;
end;
$$;
