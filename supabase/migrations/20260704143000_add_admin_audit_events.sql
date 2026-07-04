-- Audit admin changes to rules and courses. The trigger is database-level so
-- future admin tools/scripts cannot bypass the audit trail by accident.

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  table_name text not null check (table_name in ('rules', 'courses')),
  row_id uuid not null,
  action text not null check (action in ('update')),
  old_status text,
  new_status text,
  old_row jsonb not null,
  new_row jsonb not null,
  created_at timestamptz not null default now()
);

create index admin_audit_events_row_idx
  on public.admin_audit_events (table_name, row_id, created_at desc);
create index admin_audit_events_actor_idx
  on public.admin_audit_events (actor_user_id, created_at desc);
create index admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

alter table public.admin_audit_events enable row level security;

create policy "admin read" on public.admin_audit_events
  for select using (public.is_admin());

create function public.audit_admin_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_key text;
begin
  if tg_table_name = 'rules' then
    status_key := 'status';
  elsif tg_table_name = 'courses' then
    status_key := 'review_status';
  else
    raise exception 'audit_admin_update is not configured for %.%', tg_table_schema, tg_table_name;
  end if;

  insert into public.admin_audit_events (
    actor_user_id,
    table_name,
    row_id,
    action,
    old_status,
    new_status,
    old_row,
    new_row
  )
  values (
    auth.uid(),
    tg_table_name,
    new.id,
    lower(tg_op),
    to_jsonb(old) ->> status_key,
    to_jsonb(new) ->> status_key,
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;

create trigger audit_rules_update
  after update on public.rules
  for each row execute function public.audit_admin_update();

create trigger audit_courses_update
  after update on public.courses
  for each row execute function public.audit_admin_update();

grant select on table public.admin_audit_events to authenticated;
grant all privileges on table public.admin_audit_events to service_role;
grant execute on function public.audit_admin_update() to service_role;
