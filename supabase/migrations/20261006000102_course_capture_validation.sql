-- UP-COURSE-02: match strict read contracts without rewriting old captures.
-- ECMAScript trim whitespace, explicitly listed rather than locale-dependent SQL space.
create function public.valid_course_capture_text(value text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select value is not null and btrim(value,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''
$$;

create function public.valid_course_capture_timestamp(value text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$'
    or left(value,4) = '0000' then return false; end if;
  -- make_date rejects impossible dates without timezone or precision normalization.
  perform make_date(left(value,4)::integer, substring(value,6,2)::integer, substring(value,9,2)::integer);
  return true;
exception when others then return false;
end;
$$;

create function public.valid_course_capture_applicability(value jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare item jsonb; member jsonb;
begin
  if not public.valid_offering_applicability(value) then return false; end if;
  for item in select v from jsonb_each(value) as entry(k,v) loop
    if jsonb_typeof(item) = 'string' and not public.valid_course_capture_text(item #>> '{}') then return false; end if;
    if jsonb_typeof(item) = 'array' then
      for member in select v from jsonb_array_elements(item) as entry(v) loop
        if not public.valid_course_capture_text(member #>> '{}') then return false; end if;
      end loop;
    end if;
  end loop;
  return true;
end;
$$;

create function public.valid_course_capture_facts(facts jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare f jsonb; e jsonb; field text;
begin
  if jsonb_typeof(facts) is distinct from 'array' then return false; end if;
  for f in select value from jsonb_array_elements(facts) loop
    foreach field in array array['key','applicability','verbatim','timezone'] loop
      if (field in ('key','applicability') or f->field <> 'null'::jsonb)
        and not public.valid_course_capture_text(f->>field) then return false; end if;
    end loop;
    for e in select value from jsonb_array_elements(f->'evidence') loop
      if not public.valid_course_capture_text(e->>'source_quote')
        or (e->'source_hash' <> 'null'::jsonb and not public.valid_course_capture_text(e->>'source_hash'))
        or not public.valid_course_capture_timestamp(e->>'retrieved_at')
        or (e->'last_verified_at' <> 'null'::jsonb and not public.valid_course_capture_timestamp(e->>'last_verified_at')) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

-- NOT VALID preserves pre-existing immutable history for explicit review.
-- New inserts and canonical corrections must satisfy the same nonblank contract.
alter table public.programmes add constraint programme_capture_text_contract
  check (public.valid_course_capture_text(name) and public.valid_course_capture_text(university_name)
    and (degree is null or public.valid_course_capture_text(degree))) not valid;
alter table public.course_offerings add constraint offering_capture_text_contract
  check (public.valid_course_capture_text(applicant_group) and public.valid_course_capture_applicability(applicability)) not valid;
alter table public.course_offering_versions add constraint offering_capture_facts_contract
  check (public.valid_course_capture_facts(facts)) not valid;

-- Typed timestamps are serialized by PostgREST; exclude infinity/BC/five-digit
-- years that the strict row metadata contract cannot deserialize.
alter table public.programmes add constraint programme_capture_created_at_contract
  check (created_at >= '0001-01-01T00:00:00Z'::timestamptz and created_at < '10000-01-01T00:00:00Z'::timestamptz) not valid;
alter table public.course_offerings add constraint offering_capture_created_at_contract
  check (created_at >= '0001-01-01T00:00:00Z'::timestamptz and created_at < '10000-01-01T00:00:00Z'::timestamptz) not valid;
alter table public.course_offering_versions add constraint version_capture_timestamp_contract
  check (created_at >= '0001-01-01T00:00:00Z'::timestamptz and created_at < '10000-01-01T00:00:00Z'::timestamptz
    and (reviewed_at is null or (reviewed_at >= '0001-01-01T00:00:00Z'::timestamptz and reviewed_at < '10000-01-01T00:00:00Z'::timestamptz))) not valid;
