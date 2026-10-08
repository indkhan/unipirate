-- COURSE01: exact metadata compare-and-set in a POST RPC body, not a URL filter.
-- No publication or privilege escalation; existing courses RLS/triggers still apply.
create function public.compare_and_set_course_research_metadata(
  p_course_id uuid,
  p_expected_metadata jsonb,
  p_expected_sql_null boolean,
  p_next_metadata jsonb,
  p_mode text
) returns public.courses
language plpgsql security invoker set search_path = '' as $$
declare
  current_course public.courses%rowtype;
  updated_course public.courses%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise insufficient_privilege using message = 'research metadata requires an authenticated admin';
  end if;
  if p_course_id is null or p_expected_sql_null is null
    or p_mode is null or p_mode not in ('recovery', 'marker')
    or jsonb_typeof(p_next_metadata) is distinct from 'object'
    or (p_expected_sql_null and p_expected_metadata is not null and p_expected_metadata <> 'null'::jsonb) then
    raise check_violation using message = 'invalid research metadata request';
  end if;

  select * into current_course from public.courses where id = p_course_id for update;
  -- A null JSON value is not SQL NULL. The explicit flag preserves the original
  -- .is(column, null) semantics, including rejection of a JSON-null legacy row.
  if not found or (case when p_expected_sql_null then current_course.field_extraction is not null
      else current_course.field_extraction is distinct from coalesce(p_expected_metadata, 'null'::jsonb) end) then
    raise check_violation using message = 'Course metadata changed; reload and review again';
  end if;
  if current_course.field_extraction is not null
    and jsonb_typeof(current_course.field_extraction) is distinct from 'object' then
    raise check_violation using message = 'Research metadata must be an object or SQL NULL';
  end if;
  if (p_next_metadata - 'research') is distinct from (coalesce(current_course.field_extraction, '{}'::jsonb) - 'research') then
    raise check_violation using message = 'Research metadata siblings must be preserved exactly';
  end if;
  if jsonb_typeof(p_next_metadata->'research') is distinct from 'object'
    or p_next_metadata->'research'->>'format' is distinct from 'up-course-01/v1'
    or coalesce(p_next_metadata->'research'->>'status', '') not in ('draft', 'incomplete') then
    raise check_violation using message = 'Research metadata requires a pending draft';
  end if;
  -- Domain/evidence validation remains in the shared strict research preflight.
  -- Lifecycle is checked again here under the lock, not just before the request.
  if p_mode = 'recovery' then
    if current_course.review_status <> 'pending'
      or not coalesce(current_course.field_extraction ? 'research', false) then
      raise check_violation using message = 'Only pending research can be repaired';
    end if;
  else
    if current_course.review_status <> 'approved' or current_course.conflicts_with is not null
      or coalesce(current_course.field_extraction ? 'research', false) then
      raise check_violation using message = 'Canonical research marker requires an approved unmarked course';
    end if;
  end if;

  update public.courses set field_extraction = p_next_metadata
    where id = p_course_id and field_extraction is not distinct from current_course.field_extraction
    returning * into updated_course;
  if not found then
    raise check_violation using message = 'Course metadata changed; reload and review again';
  end if;
  return updated_course;
end;
$$;
revoke all on function public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text) from public, anon, service_role;
grant execute on function public.compare_and_set_course_research_metadata(uuid,jsonb,boolean,jsonb,text) to authenticated;
