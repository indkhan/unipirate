-- Adopting a version changes facts, not a student's course identity or progress.
create or replace function public.resolve_course_conflict(p_new_course_id uuid, p_keep_new boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_update public.courses%rowtype;
  v_original_id uuid;
  v_application public.applications%rowtype;
  v_existing_application_id uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select * into v_update from public.courses where id = p_new_course_id for update;
  v_original_id := v_update.conflicts_with;
  if v_original_id is null then
    raise exception 'course % is not an unresolved conflict', p_new_course_id;
  end if;
  perform 1 from public.courses where id = v_original_id for update;

  if p_keep_new then
    update public.courses set
      name = v_update.name, university_name = v_update.university_name,
      location = v_update.location, degree = v_update.degree,
      language = v_update.language, description = v_update.description,
      tuition = v_update.tuition, deadlines = v_update.deadlines,
      requirements = v_update.requirements, source_url = v_update.source_url,
      normalized_url = v_update.normalized_url,
      extraction_method = v_update.extraction_method,
      field_extraction = v_update.field_extraction, review_status = 'approved'
    where id = v_original_id;

    -- Preserve existing definition IDs while adopting explicitly reviewed edits.
    update public.course_task_definitions existing set
      title_template = proposed.title_template, description = proposed.description,
      source_url = proposed.source_url, due_mode = proposed.due_mode,
      due_date = proposed.due_date, source_snapshot = proposed.source_snapshot,
      sort_order = proposed.sort_order, retired_at = proposed.retired_at
    from public.course_task_definitions proposed
    where proposed.course_id = p_new_course_id
      and existing.course_id = v_original_id
      and existing.source_key = proposed.source_key;
    update public.course_task_definitions proposed set course_id = v_original_id
    where proposed.course_id = p_new_course_id and not exists (
      select 1 from public.course_task_definitions existing
      where existing.course_id = v_original_id and existing.source_key = proposed.source_key
    );
  end if;

  -- Merge duplicate tracking links without deleting the submitter's reminders.
  for v_application in select * from public.applications where course_id = p_new_course_id for update loop
    select id into v_existing_application_id from public.applications
      where course_id = v_original_id and user_id = v_application.user_id for update;
    if v_existing_application_id is null then
      update public.applications set course_id = v_original_id where id = v_application.id;
    else
      update public.tasks set application_id = v_existing_application_id
        where application_id = v_application.id;
      delete from public.applications where id = v_application.id;
    end if;
  end loop;
  delete from public.courses where id = p_new_course_id;
end;
$$;
