-- A receipt is independent of the task row: deleting a reminder must not make
-- a retried chat request recreate it. Only the authenticated RPC writes receipts.
create table public.personal_task_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  instruction text not null,
  request_task jsonb not null,
  task_receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.personal_task_operations enable row level security;
revoke all on public.personal_task_operations from anon, authenticated;
grant select on public.personal_task_operations to authenticated;
create policy "owner reads operation receipts" on public.personal_task_operations
  for select to authenticated using (user_id = (select auth.uid()));

-- Enforce application ownership for every writer, including direct REST writes
-- and admin course-task reconciliation, without depending on application RLS.
alter table public.applications add constraint applications_id_user_unique unique (id, user_id);
alter table public.tasks add constraint tasks_application_owner_fk
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade not valid;
-- Historical predecessor-valid rows may have unsafe cross-owner associations.
-- NOT VALID preserves their task values/history; all new/changed associations
-- must satisfy ownership. Surface queries also require the caller's owned app.
drop policy if exists "admin read" on public.tasks;
drop policy if exists "admin sync course task copies" on public.tasks;

create function public.create_personal_task(p_operation_id uuid, p_instruction text, p_task jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.personal_task_operations%rowtype;
  v_application uuid;
  v_due date;
  v_created public.tasks%rowtype;
  v_receipt jsonb;
begin
  if v_owner is null or not exists (select 1 from auth.users where id = v_owner) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_instruction is null or length(btrim(p_instruction)) = 0
     or length(p_instruction) > 20000 then
    raise exception 'Invalid personal task instruction' using errcode = '22023';
  end if;
  if p_task is null or jsonb_typeof(p_task) <> 'object' then
    raise exception 'Invalid personal task object' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_task) as fields(key)
             where key not in ('title', 'description', 'dueDate', 'sourceUrl', 'applicationId'))
     or jsonb_typeof(p_task->'title') is distinct from 'string'
     or length(btrim(p_task->>'title')) = 0 or length(p_task->>'title') > 240 then
    raise exception 'Invalid personal task title or fields' using errcode = '22023';
  end if;
  if (p_task ? 'description' and jsonb_typeof(p_task->'description') not in ('string', 'null'))
     or length(p_task->>'description') > 2000
     or (p_task ? 'sourceUrl' and jsonb_typeof(p_task->'sourceUrl') not in ('string', 'null'))
     or length(p_task->>'sourceUrl') > 2048
     or (p_task->>'sourceUrl' is not null and p_task->>'sourceUrl' !~ '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$')
     or (p_task ? 'dueDate' and jsonb_typeof(p_task->'dueDate') not in ('string', 'null'))
     or (p_task ? 'applicationId' and jsonb_typeof(p_task->'applicationId') not in ('string', 'null')) then
    raise exception 'Invalid personal task details' using errcode = '22023';
  end if;
  if p_task->>'dueDate' is not null then
    if p_task->>'dueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Invalid calendar date' using errcode = '22023';
    end if;
    v_due := (p_task->>'dueDate')::date;
    if to_char(v_due, 'YYYY-MM-DD') <> p_task->>'dueDate' then
      raise exception 'Invalid calendar date' using errcode = '22023';
    end if;
  end if;
  v_application := (p_task->>'applicationId')::uuid;

  -- Serialize this owner's operation before checking its durable receipt. A
  -- hash collision only serializes unrelated requests; it cannot merge them.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_operation_id::text, 0));
  select * into v_prior from public.personal_task_operations
    where user_id = v_owner and operation_id = p_operation_id;
  if found then
    if v_prior.instruction <> p_instruction or v_prior.request_task <> p_task then
      raise exception 'Operation ID already belongs to a different request' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'already_exists', 'task', v_prior.task_receipt);
  end if;
  if v_application is not null and not exists (
    select 1 from public.applications where id = v_application and user_id = v_owner
  ) then
    raise exception 'Application is not owned by the caller' using errcode = '42501';
  end if;
  insert into public.tasks (user_id, application_id, title, description, due_date, source_url, task_key)
    values (v_owner, v_application, p_task->>'title', p_task->>'description', v_due, p_task->>'sourceUrl', null)
    returning * into v_created;
  v_receipt := jsonb_build_object('id', v_created.id, 'title', v_created.title,
    'description', v_created.description, 'due_date', v_created.due_date,
    'source_url', v_created.source_url, 'application_id', v_created.application_id);
  insert into public.personal_task_operations (user_id, operation_id, instruction, request_task, task_receipt)
    values (v_owner, p_operation_id, p_instruction, p_task, v_receipt);
  return jsonb_build_object('status', 'created', 'task', v_receipt);
end;
$$;
revoke all on function public.create_personal_task(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_personal_task(uuid, text, jsonb) to authenticated;
