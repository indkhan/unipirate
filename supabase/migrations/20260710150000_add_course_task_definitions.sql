-- Unified, admin-managed course tasks. Source-derived submission/requirement
-- tasks are stored as definitions before being copied to each application.
create type public.course_task_kind as enum ('submission', 'requirement', 'custom');
create type public.course_task_due_mode as enum ('source_deadline', 'fixed_date', 'none');
create type public.course_task_change_state as enum ('current', 'update_pending', 'removal_pending');
create type public.course_task_source_change as enum ('changed', 'new', 'removed');
create type public.course_task_source_review_status as enum ('pending', 'adopted', 'kept');

create table public.course_task_definitions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  kind public.course_task_kind not null,
  source_key text,
  title_template text not null,
  description text,
  source_url text,
  due_mode public.course_task_due_mode not null default 'none',
  due_date date,
  sort_order integer not null default 30,
  source_snapshot jsonb,
  revision integer not null default 1,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, source_key),
  check ((due_mode = 'fixed_date') = (due_date is not null))
);

create index course_task_definitions_course_idx
  on public.course_task_definitions (course_id, sort_order)
  where retired_at is null;

create table public.course_task_source_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  course_task_definition_id uuid references public.course_task_definitions (id) on delete set null,
  candidate_key text not null,
  change_type public.course_task_source_change not null,
  old_snapshot jsonb,
  new_snapshot jsonb,
  status public.course_task_source_review_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (course_id, candidate_key, status)
);

alter table public.tasks
  add column course_task_definition_id uuid references public.course_task_definitions (id) on delete set null,
  add column admin_snapshot jsonb,
  add column definition_revision integer,
  add column has_personal_edits boolean not null default false,
  add column admin_change_state public.course_task_change_state not null default 'current';

create index tasks_course_task_definition_idx
  on public.tasks (course_task_definition_id);

create trigger set_updated_at before update on public.course_task_definitions
  for each row execute function public.set_updated_at();

alter table public.course_task_definitions enable row level security;
alter table public.course_task_source_reviews enable row level security;

create policy "public read approved course task definitions" on public.course_task_definitions
  for select using (
    retired_at is null and exists (
      select 1 from public.courses
      where courses.id = course_task_definitions.course_id
        and courses.review_status = 'approved'
    )
  );
create policy "admin manage course task definitions" on public.course_task_definitions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage course task source reviews" on public.course_task_source_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- Keep task-definition and source-review mutations in the existing admin audit
-- stream. This remains database-level so future admin surfaces cannot bypass it.
alter table public.admin_audit_events
  drop constraint admin_audit_events_table_name_check,
  drop constraint admin_audit_events_action_check,
  add constraint admin_audit_events_table_name_check check (
    table_name in ('rules', 'courses', 'course_task_definitions', 'course_task_source_reviews')
  ),
  add constraint admin_audit_events_action_check check (action in ('insert', 'update'));

create function public.audit_course_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_events (
    actor_user_id, table_name, row_id, action, old_status, new_status, old_row, new_row
  ) values (
    auth.uid(), tg_table_name, new.id, lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) ->> 'status' else null end,
    coalesce(to_jsonb(new) ->> 'status', to_jsonb(new) ->> 'retired_at', 'active'),
    case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger audit_course_task_definition_change
  after insert or update on public.course_task_definitions
  for each row execute function public.audit_course_task_change();
create trigger audit_course_task_source_review_change
  after insert or update on public.course_task_source_reviews
  for each row execute function public.audit_course_task_change();

-- Centralize cross-user synchronization. It deliberately preserves a
-- student's completion and preferred bucket and never overwrites a personal
-- edit; those rows become a review decision instead.
create function public.sync_course_task_definitions(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application record;
  v_definition record;
  v_task record;
  v_task_found boolean;
  v_title text;
  v_verbatim_due text;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  for v_application in
    select a.id, a.user_id
    from public.applications a
    join public.courses c on c.id = a.course_id
    where a.course_id = p_course_id
      and a.status = 'planning'
      and c.review_status = 'approved'
  loop
    for v_definition in
      select * from public.course_task_definitions
      where course_id = p_course_id
      order by sort_order, created_at
    loop
      select * into v_task
      from public.tasks
      where user_id = v_application.user_id
        and course_task_definition_id = v_definition.id
      limit 1;
      v_task_found := found;

      v_title := replace(v_definition.title_template, '{{course}}', coalesce((select university_name from public.courses where id = p_course_id), (select name from public.courses where id = p_course_id), 'this university'));
      v_verbatim_due := case when v_definition.due_mode = 'source_deadline'
        then coalesce(v_definition.source_snapshot -> 'deadlines' ->> 0, null)
        else null end;

      if v_definition.retired_at is not null then
        if v_task_found and v_task.has_personal_edits then
          update public.tasks set admin_change_state = 'removal_pending'
          where id = v_task.id;
        elsif v_task_found then
          update public.tasks set generated_active = false
          where id = v_task.id;
        end if;
      elsif not v_task_found then
        insert into public.tasks (
          user_id, application_id, task_key, course_task_definition_id,
          title, description, source_url, due_date, verbatim_due, sort_order,
          admin_snapshot, definition_revision, generated_active
        ) values (
          v_application.user_id, v_application.id,
          'app:' || v_application.id || ':course-task:' || v_definition.id,
          v_definition.id, v_title, v_definition.description, v_definition.source_url,
          v_definition.due_date, v_verbatim_due, v_definition.sort_order,
          jsonb_build_object('title', v_title, 'description', v_definition.description, 'source_url', v_definition.source_url, 'due_date', v_definition.due_date, 'verbatim_due', v_verbatim_due, 'sort_order', v_definition.sort_order),
          v_definition.revision, true
        );
      elsif v_task.has_personal_edits then
        update public.tasks set
          admin_snapshot = jsonb_build_object('title', v_title, 'description', v_definition.description, 'source_url', v_definition.source_url, 'due_date', v_definition.due_date, 'verbatim_due', v_verbatim_due, 'sort_order', v_definition.sort_order),
          definition_revision = v_definition.revision,
          admin_change_state = 'update_pending',
          generated_active = true
        where id = v_task.id;
      else
        update public.tasks set
          title = v_title, description = v_definition.description,
          source_url = v_definition.source_url, due_date = v_definition.due_date,
          verbatim_due = v_verbatim_due, sort_order = v_definition.sort_order,
          admin_snapshot = jsonb_build_object('title', v_title, 'description', v_definition.description, 'source_url', v_definition.source_url, 'due_date', v_definition.due_date, 'verbatim_due', v_verbatim_due, 'sort_order', v_definition.sort_order),
          definition_revision = v_definition.revision,
          admin_change_state = 'current', generated_active = true
        where id = v_task.id;
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.sync_course_task_definitions(uuid) from public;
grant execute on function public.sync_course_task_definitions(uuid) to authenticated;

-- Existing approved courses receive their current official tasks as explicit
-- definitions. Existing task rows are preserved until their next normal
-- materialization, which safely replaces their legacy key with the definition
-- key while retaining done and bucket state.
insert into public.course_task_definitions (
  course_id, kind, source_key, title_template, source_url, due_mode,
  source_snapshot, sort_order
)
select
  c.id,
  'submission',
  'submission',
  'Submit application — {{course}}',
  c.source_url,
  'source_deadline',
  jsonb_build_object('deadlines', c.deadlines),
  30
from public.courses c
where c.review_status = 'approved'
  and jsonb_typeof(c.deadlines) = 'array'
  and exists (
    select 1 from jsonb_array_elements_text(c.deadlines) line where line ~ '\\d'
  )
on conflict (course_id, source_key) do nothing;

update public.tasks t
set
  course_task_definition_id = d.id,
  task_key = 'app:' || a.id || ':course-task:' || d.id,
  definition_revision = d.revision,
  admin_snapshot = jsonb_build_object(
    'title', t.title, 'description', t.description, 'source_url', t.source_url,
    'due_date', t.due_date, 'verbatim_due', t.verbatim_due, 'sort_order', t.sort_order
  )
from public.applications a
join public.courses c on c.id = a.course_id
join public.course_task_definitions d on d.course_id = c.id
where t.application_id = a.id
  and d.kind = 'requirement'
  and t.title = 'Prepare: ' || (d.source_snapshot ->> 'requirement') || ' — ' || coalesce(c.university_name, c.name, 'this university');

update public.tasks t
set
  course_task_definition_id = d.id,
  task_key = 'app:' || a.id || ':course-task:' || d.id,
  definition_revision = d.revision,
  admin_snapshot = jsonb_build_object(
    'title', t.title, 'description', t.description, 'source_url', t.source_url,
    'due_date', t.due_date, 'verbatim_due', t.verbatim_due, 'sort_order', t.sort_order
  )
from public.applications a
join public.courses c on c.id = a.course_id
join public.course_task_definitions d on d.course_id = c.id and d.source_key = 'submission'
where t.application_id = a.id
  and t.task_key = 'app:' || a.id || ':submit';

update public.tasks t
set
  course_task_definition_id = d.id,
  task_key = 'app:' || a.id || ':course-task:' || d.id,
  definition_revision = d.revision,
  admin_snapshot = jsonb_build_object(
    'title', t.title, 'description', t.description, 'source_url', t.source_url,
    'due_date', t.due_date, 'verbatim_due', t.verbatim_due, 'sort_order', t.sort_order
  )
from public.applications a
join public.courses c on c.id = a.course_id
join public.course_task_definitions d on d.course_id = c.id
where t.application_id = a.id
  and d.kind = 'requirement'
  and t.title = 'Prepare: ' || (d.source_snapshot ->> 'requirement') || ' — ' || coalesce(c.university_name, c.name, 'this university');

insert into public.course_task_definitions (
  course_id, kind, source_key, title_template, source_url, due_mode,
  source_snapshot, sort_order
)
select
  c.id,
  'requirement',
  'requirement:' || requirement,
  'Prepare: ' || requirement || ' — {{course}}',
  c.source_url,
  'source_deadline',
  jsonb_build_object('requirement', requirement, 'deadlines', c.deadlines),
  40 + ordinality::integer
from public.courses c
cross join lateral jsonb_array_elements_text(c.requirements) with ordinality as requirements(requirement, ordinality)
where c.review_status = 'approved'
  and jsonb_typeof(c.requirements) = 'array'
  and requirement <> ''
on conflict (course_id, source_key) do nothing;

update public.tasks t
set
  course_task_definition_id = d.id,
  task_key = 'app:' || a.id || ':course-task:' || d.id,
  definition_revision = d.revision,
  admin_snapshot = jsonb_build_object(
    'title', t.title, 'description', t.description, 'source_url', t.source_url,
    'due_date', t.due_date, 'verbatim_due', t.verbatim_due, 'sort_order', t.sort_order
  )
from public.applications a
join public.courses c on c.id = a.course_id
join public.course_task_definitions d on d.course_id = c.id
where t.application_id = a.id
  and d.kind = 'requirement'
  and t.title = 'Prepare: ' || (d.source_snapshot ->> 'requirement') || ' — ' || coalesce(c.university_name, c.name, 'this university');
