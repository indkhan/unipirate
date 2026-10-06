-- UP-COURSE-02: JSON reviewer spelling must survive strict Zod reads.
-- Replace only the existing validator body/signature. Existing captures remain
-- untouched; the existing NOT VALID CHECK enforces this on new snapshots.
create or replace function public.valid_course_capture_facts(facts jsonb) returns boolean
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
        or (e->'last_verified_at' <> 'null'::jsonb and not public.valid_course_capture_timestamp(e->>'last_verified_at'))
        -- PostgreSQL uuid casts also accept compact/braced forms; Zod does not.
        -- Case is accepted and preserved, not normalized.
        or (e->'verified_by' <> 'null'::jsonb and (
          jsonb_typeof(e->'verified_by') is distinct from 'string'
          or length(e->>'verified_by') <> 36
          or e->>'verified_by' !~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$'
        )) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
