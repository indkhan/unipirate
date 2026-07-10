-- Older course-task rows can have an update-pending state without the
-- corresponding admin version. Restore that version so students can compare
-- the change and safely adopt it.
update public.tasks t
set
  admin_snapshot = jsonb_build_object(
    'title', replace(d.title_template, '{{course}}', coalesce(c.university_name, c.name, 'this university')),
    'description', d.description,
    'source_url', d.source_url,
    'due_date', case when d.due_mode = 'source_deadline' then null else d.due_date end,
    'verbatim_due', case when d.due_mode = 'source_deadline' then d.source_snapshot -> 'deadlines' ->> 0 else null end,
    'sort_order', d.sort_order
  ),
  definition_revision = d.revision
from public.course_task_definitions d
cross join public.applications a
cross join public.courses c
where t.course_task_definition_id = d.id
  and a.id = t.application_id
  and c.id = a.course_id
  and t.admin_change_state = 'update_pending'
  and d.retired_at is null
  and (
    t.admin_snapshot is null
    or jsonb_typeof(t.admin_snapshot) <> 'object'
    or not (t.admin_snapshot ? 'title')
  );
