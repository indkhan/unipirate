-- UP-COURSE-01: trusted reconciliation is a protected journal event, never user JSON.
-- Additive only; existing audit rows, programme_correction, RLS and table grants stay intact.
alter table public.admin_audit_events add column course_reconciliation jsonb;

-- No caller facts/reviewer/time/observations: derive the snapshot from stored pending
-- research and explicit field selection. Academic semantic validation stays in the
-- pure research preflight; this boundary validates authorization, data and provenance.
create function public.publish_course_research_version(
  p_submitted_course_id uuid,
  p_offering_id uuid,
  p_offering_index integer,
  p_version integer,
  p_accepted_keys text[],
  p_decisions jsonb
) returns public.course_offering_versions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  submitted public.courses%rowtype;
  canonical public.courses%rowtype;
  offering public.course_offerings%rowtype;
  programme public.programmes%rowtype;
  published public.course_offering_versions%rowtype;
  draft jsonb; scope jsonb; observation jsonb; f jsonb; e jsonb; decision jsonb;
  facts jsonb := '[]'; captures jsonb; decisions jsonb := '[]';
  decision_keys text[] := '{}'; selected_count integer := 0;
  reviewed_at timestamptz; verified_text text; reason text;
begin
  if actor is null or not coalesce(public.is_admin(), false) then
    raise insufficient_privilege using message = 'research publication requires an authenticated admin';
  end if;
  if p_submitted_course_id is null or p_offering_id is null or p_offering_index is null
    or p_offering_index not between 0 and 7 or p_version is null or p_version < 1
    or p_accepted_keys is null or cardinality(p_accepted_keys) > 50
    or array_ndims(p_accepted_keys) > 1 or array_position(p_accepted_keys, null) is not null
    or (select count(distinct k) from unnest(p_accepted_keys) k) <> cardinality(p_accepted_keys)
    or exists (select 1 from unnest(p_accepted_keys) k where not public.valid_course_capture_text(k) or length(k) > 240)
    or jsonb_typeof(p_decisions) is distinct from 'array' then
    raise check_violation using message = 'invalid research publication selection';
  end if;
  if jsonb_array_length(p_decisions) > 50 then
    raise check_violation using message = 'too many reconciliation decisions';
  end if;

  select * into submitted from public.courses where id = p_submitted_course_id for update;
  if not found or submitted.review_status = 'rejected'
    or (submitted.conflicts_with is not null and submitted.review_status <> 'pending') then
    raise check_violation using message = 'publication requires an active research submission';
  end if;
  select * into canonical from public.courses where id = coalesce(submitted.conflicts_with, submitted.id) for share;
  if not found or canonical.review_status <> 'approved' or canonical.conflicts_with is not null then
    raise check_violation using message = 'research requires an approved canonical course';
  end if;
  select * into offering from public.course_offerings where id = p_offering_id for update;
  if not found then raise check_violation using message = 'unknown research offering'; end if;
  select * into programme from public.programmes where id = offering.programme_id for share;
  if not found or programme.legacy_course_id is distinct from canonical.id then
    raise check_violation using message = 'research offering belongs to a different canonical course';
  end if;

  draft := submitted.field_extraction->'research';
  if jsonb_typeof(draft) is distinct from 'object' or draft->>'format' is distinct from 'up-course-01/v1'
    or coalesce(draft->>'status','') not in ('draft','incomplete')
    or jsonb_typeof(draft->'identity') is distinct from 'object'
    or draft->'identity'->>'name' is distinct from canonical.name
    or draft->'identity'->>'university' is distinct from canonical.university_name
    or draft->'identity'->>'name' is distinct from programme.name
    or draft->'identity'->>'university' is distinct from programme.university_name
    or jsonb_typeof(draft->'observations') is distinct from 'array'
    or jsonb_typeof(draft->'offerings') is distinct from 'array'
    or jsonb_typeof(draft->'conflicts') is distinct from 'array' then
    raise check_violation using message = 'invalid stored pending research identity';
  end if;
  if (select count(*) from jsonb_object_keys(draft->'identity')) <> 3
    or not (draft->'identity' ?& array['name','university','source_url'])
    or jsonb_typeof(draft->'identity'->'name') is distinct from 'string'
    or jsonb_typeof(draft->'identity'->'university') is distinct from 'string'
    or jsonb_typeof(draft->'identity'->'source_url') is distinct from 'string'
    or not public.valid_course_source_url(draft->'identity'->>'source_url')
    or draft->'identity'->>'source_url' !~ '^https://[^/:?#]+([/?#]|$)' then
    raise check_violation using message = 'invalid stored research identity source';
  end if;
  if jsonb_array_length(draft->'observations') > 12 or jsonb_array_length(draft->'offerings') > 8 then
    raise check_violation using message = 'stored research exceeds capture bounds';
  end if;
  for observation in select value from jsonb_array_elements(draft->'observations') loop
    if jsonb_typeof(observation) is distinct from 'object' then
      raise check_violation using message = 'invalid stored research capture';
    end if;
    if (select count(*) from jsonb_object_keys(observation)) <> 4
      or not (observation ?& array['url','content','retrieved_at','origin'])
      or jsonb_typeof(observation->'url') is distinct from 'string'
      or not public.valid_course_source_url(observation->>'url')
      or observation->>'url' !~ '^https://[^/:?#]+([/?#]|$)'
      or jsonb_typeof(observation->'content') is distinct from 'string'
      or length(observation->>'content') not between 1 and 20000
      or not public.valid_course_capture_timestamp(observation->>'retrieved_at')
      or coalesce(observation->>'origin','') not in ('web','manual','paste') then
      raise check_violation using message = 'invalid stored research capture';
    end if;
  end loop;
  scope := draft->'offerings'->p_offering_index;
  if jsonb_typeof(scope) is distinct from 'object'
    or scope->>'intake_term' is distinct from offering.intake_term
    or scope->'intake_year' is distinct from to_jsonb(offering.intake_year)
    or scope->>'applicant_group' is distinct from offering.applicant_group
    or scope->'applicability' is distinct from offering.applicability
    or jsonb_typeof(scope->'scope') is distinct from 'object'
    or scope->'applicability'->>'source_scope' is distinct from scope->'scope'->>'source_quote'
    or jsonb_typeof(scope->'facts') is distinct from 'array' then
    raise check_violation using message = 'stored research scope does not match the offering';
  end if;
  if (select count(*) from jsonb_object_keys(scope)) <> 6
    or not (scope ?& array['intake_term','intake_year','applicant_group','applicability','scope','facts'])
    or jsonb_typeof(scope->'scope'->'source_url') is distinct from 'string'
    or jsonb_typeof(scope->'scope'->'source_quote') is distinct from 'string'
    or (select count(*) from jsonb_object_keys(scope->'scope')) <> 2
    or not (scope->'scope' ?& array['source_url','source_quote'])
    or not public.valid_course_capture_text(scope->'scope'->>'source_quote')
    or length(scope->'scope'->>'source_quote') > 4000
    or not exists (
      select 1 from jsonb_array_elements(draft->'observations') o
      where o->>'origin' <> 'paste' and o->>'url' = scope->'scope'->>'source_url'
        and strpos(o->>'content', scope->'scope'->>'source_quote') > 0
        and strpos(o->>'content', draft->'identity'->>'name') > 0
        and strpos(o->>'content', draft->'identity'->>'university') > 0
    ) then
    raise check_violation using message = 'offering scope lacks its stored literal capture';
  end if;
  if jsonb_array_length(scope->'facts') > 50
    or not public.valid_offering_facts(scope->'facts', false)
    or not public.valid_course_capture_facts(scope->'facts')
    or not public.valid_offering_source_urls(scope->'facts') then
    raise check_violation using message = 'invalid stored research facts';
  end if;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(decision) is distinct from 'object' then
      raise check_violation using message = 'invalid reconciliation decision';
    end if;
    if (select count(*) from jsonb_object_keys(decision)) <> 2
      or not (decision ?& array['key','reason'])
      or jsonb_typeof(decision->'key') is distinct from 'string'
      or jsonb_typeof(decision->'reason') is distinct from 'string'
      or not (decision->>'key' = any(p_accepted_keys))
      or decision->>'key' = any(decision_keys) then
      raise check_violation using message = 'invalid reconciliation decision';
    end if;
    -- Same trim whitespace as the existing capture-text contract/Zod, only for
    -- admin rationale. Literal source wording/timestamps are never normalized.
    reason := btrim(decision->>'reason', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if length(reason) not between 20 and 2000 then raise check_violation using message = 'invalid reconciliation rationale'; end if;
    decision_keys := array_append(decision_keys, decision->>'key');
    decisions := decisions || jsonb_build_array(jsonb_build_object('key',decision->>'key','reason',reason));
  end loop;
  -- This endpoint attests each accepted field, never a generic approval flag.
  if cardinality(decision_keys) <> cardinality(p_accepted_keys) then
    raise check_violation using message = 'each accepted field requires its reconciliation decision';
  end if;
  if p_version <> (select coalesce(max(v.version),0) + 1 from public.course_offering_versions v where v.offering_id = offering.id) then
    raise check_violation using message = 'research version must append the next snapshot';
  end if;

  reviewed_at := date_trunc('milliseconds', clock_timestamp());
  verified_text := to_char(reviewed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for f in select value from jsonb_array_elements(scope->'facts') loop
    if coalesce(f->>'status','') not in ('pending','unresolved')
      or f->>'applicability' is distinct from offering.applicant_group
      or length(f->>'key') > 240 or f->'date' is distinct from 'null'::jsonb
      or f->'time' is distinct from 'null'::jsonb or f->'timezone' is distinct from 'null'::jsonb then
      raise check_violation using message = 'stored research cannot contain review or planning state';
    end if;
    captures := '[]';
    for e in select value from jsonb_array_elements(f->'evidence') loop
      if e->'verified_by' is distinct from 'null'::jsonb or e->'last_verified_at' is distinct from 'null'::jsonb
        or not exists (
          select 1 from jsonb_array_elements(draft->'observations') o where o->>'origin' <> 'paste'
            and o->>'url' = e->>'source_url' and o->>'retrieved_at' = e->>'retrieved_at'
            and strpos(o->>'content',e->>'source_quote') > 0
        ) then
        raise check_violation using message = 'field evidence does not match its unreviewed stored capture';
      end if;
      if f->>'key' = any(p_accepted_keys) then
        e := jsonb_set(jsonb_set(e,'{verified_by}',to_jsonb(actor::text)),'{last_verified_at}',to_jsonb(verified_text));
      end if;
      captures := captures || jsonb_build_array(e);
    end loop;
    if f->>'key' = any(p_accepted_keys) then
      if f->>'status' <> 'pending' or f->>'verbatim' is null or jsonb_array_length(captures) = 0
        or not exists (select 1 from jsonb_array_elements(captures) literal_capture where strpos(literal_capture->>'source_quote',f->>'verbatim') > 0)
        or exists (
          select 1 from jsonb_array_elements(draft->'conflicts') c where c->'offering' = to_jsonb(p_offering_index)
            and (c->>'key' = f->>'key' or exists (
              select 1 from jsonb_array_elements(c->'alternatives') a, jsonb_array_elements(a->'evidence') r,
                jsonb_array_elements(f->'evidence') field_capture
              where r->>'source_url' = field_capture->>'source_url' and r->>'source_quote' = field_capture->>'source_quote'
            ))
        ) then
        raise check_violation using message = 'accepted field needs pending literal support and no retained capture conflict';
      end if;
      f := jsonb_set(jsonb_set(f,'{status}','"verified"'),'{evidence}',captures);
      selected_count := selected_count + 1;
    else
      f := jsonb_set(jsonb_set(f,'{status}','"unresolved"'),'{verbatim}','null');
      if f->>'kind' = 'route' then f := jsonb_set(f,'{route}','"unresolved"'); end if;
    end if;
    facts := facts || jsonb_build_array(f);
  end loop;
  if selected_count <> cardinality(p_accepted_keys) then
    raise check_violation using message = 'unknown accepted research key';
  end if;
  -- Existing fact/text/URL/UUID/chronology/reviewer/version constraints and triggers
  -- run on this INSERT. Future retrieval dates fail; no source timestamp is adjusted.
  insert into public.course_offering_versions(offering_id,version,review_status,reviewed_at,reviewed_by,facts)
  values (offering.id,p_version,'verified',reviewed_at,actor,facts) returning * into published;
  insert into public.admin_audit_events(actor_user_id,table_name,row_id,action,created_at,course_reconciliation)
  values (actor,'courses',canonical.id,'update',reviewed_at,jsonb_build_object(
    'format','up-course-01/reconciliation-v1','submitted_course_id',submitted.id,
    'reviewed_by',actor,'reviewed_at',verified_text,
    'identity',draft->'identity','scope',scope - 'facts','offering_index',p_offering_index,
    'accepted_keys',to_jsonb(p_accepted_keys),'decisions',decisions,'observations',draft->'observations',
    'version',jsonb_build_object('id',published.id,'offering_id',offering.id,'version',published.version)
  ));
  -- Any exception, including a denied/failed audit insert, rolls back BOTH writes.
  -- Legacy research_reconciliations arrays are never read, copied or authenticated.
  return published;
end;
$$;
revoke all on function public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb) from public, anon, service_role;
grant execute on function public.publish_course_research_version(uuid,uuid,integer,integer,text[],jsonb) to authenticated;
