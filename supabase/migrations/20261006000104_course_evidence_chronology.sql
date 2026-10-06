-- UP-COURSE-02: match Date.parse millisecond chronology without changing JSON.
create or replace function public.valid_offering_facts(facts jsonb, reviewed boolean)
returns boolean language plpgsql immutable set search_path = public, pg_temp
as $$
declare f jsonb; e jsonb; supported boolean; parsed_date date; keys text[] := '{}';
begin
  if jsonb_typeof(facts) is distinct from 'array' then return false; end if;
  for f in select value from jsonb_array_elements(facts) loop
    if jsonb_typeof(f) is distinct from 'object'
      or not (f ?& array['key','kind','status','verbatim','applicability','evidence','route','deadline_kind','date','time','timezone'])
      or (select count(*) from jsonb_object_keys(f)) <> 11
      or jsonb_typeof(f->'key') is distinct from 'string' or btrim(f->>'key') = ''
      or f->>'key' = any(keys)
      or jsonb_typeof(f->'applicability') is distinct from 'string' or btrim(f->>'applicability') = ''
      or coalesce(f->>'kind','') not in ('route','deadline','language','prerequisite','fee','document','description')
      or coalesce(f->>'status','') not in ('pending','verified','rejected','unresolved')
      or jsonb_typeof(f->'evidence') is distinct from 'array'
      or (reviewed and f->>'status' not in ('verified','unresolved')) then return false; end if;
    keys := array_append(keys, f->>'key');
    if f->'verbatim' <> 'null'::jsonb and (jsonb_typeof(f->'verbatim') <> 'string' or btrim(f->>'verbatim') = '') then return false; end if;
    if f->>'kind' = 'route' then
      if coalesce(f->>'route','') not in ('direct','uni_assist','vpd_then_university','unresolved') then return false; end if;
      if f->>'status' = 'verified' and f->>'route' = 'unresolved' then return false; end if;
      if f->>'status' = 'unresolved' and f->>'route' <> 'unresolved' then return false; end if;
    elsif f->'route' <> 'null'::jsonb then return false; end if;
    if f->>'kind' = 'deadline' then
      if coalesce(f->>'deadline_kind','') not in ('application_opening','application_closing','document_supplement','enrolment','vpd_preparation_target') then return false; end if;
    elsif f->'deadline_kind' <> 'null'::jsonb or f->'date' <> 'null'::jsonb or f->'time' <> 'null'::jsonb or f->'timezone' <> 'null'::jsonb then return false; end if;
    if f->'date' <> 'null'::jsonb then
      if f->>'status' <> 'verified' or jsonb_typeof(f->'date') <> 'string' or f->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      parsed_date := (f->>'date')::date;
      if to_char(parsed_date, 'YYYY-MM-DD') <> f->>'date' then return false; end if;
    end if;
    if f->'time' <> 'null'::jsonb and (f->>'status' <> 'verified' or f->'date' = 'null'::jsonb or jsonb_typeof(f->'time') <> 'string' or f->>'time' !~ '^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$') then return false; end if;
    if f->'timezone' <> 'null'::jsonb and (f->>'status' <> 'verified' or f->'time' = 'null'::jsonb or jsonb_typeof(f->'timezone') <> 'string' or btrim(f->>'timezone') = '') then return false; end if;
    supported := false;
    for e in select value from jsonb_array_elements(f->'evidence') loop
      if jsonb_typeof(e) is distinct from 'object'
        or not (e ?& array['source_url','source_quote','retrieved_at','last_verified_at','verified_by','source_hash'])
        or (select count(*) from jsonb_object_keys(e)) <> 6
        or jsonb_typeof(e->'source_url') is distinct from 'string' or e->>'source_url' !~ '^https?://[^[:space:]/]+'
        or jsonb_typeof(e->'source_quote') is distinct from 'string' or btrim(e->>'source_quote') = ''
        or jsonb_typeof(e->'retrieved_at') is distinct from 'string'
        or e->>'retrieved_at' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
        or ((e->'last_verified_at' = 'null'::jsonb) <> (e->'verified_by' = 'null'::jsonb)) then return false; end if;
      perform (e->>'retrieved_at')::timestamptz;
      if e->'source_hash' <> 'null'::jsonb and (jsonb_typeof(e->'source_hash') <> 'string' or btrim(e->>'source_hash') = '') then return false; end if;
      if e->'last_verified_at' <> 'null'::jsonb then
        if jsonb_typeof(e->'last_verified_at') <> 'string' or e->>'last_verified_at' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
          or jsonb_typeof(e->'verified_by') <> 'string' then return false; end if;
        perform (e->>'verified_by')::uuid;
        -- Truncate raw fractional digits BEFORE casting: timestamptz otherwise
        -- rounds .0009999 up and can carry .9999999 into the next second/day.
        -- Only comparison operands change; stored captures remain exact.
        if regexp_replace(e->>'last_verified_at', '(\.[0-9]{3})[0-9]+', '\1')::timestamptz
          < regexp_replace(e->>'retrieved_at', '(\.[0-9]{3})[0-9]+', '\1')::timestamptz then return false; end if;
        supported := supported or (f->>'verbatim' is not null and strpos(e->>'source_quote', f->>'verbatim') > 0);
      end if;
    end loop;
    if f->>'status' = 'verified' and not supported then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
