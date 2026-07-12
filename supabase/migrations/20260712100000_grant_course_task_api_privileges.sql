-- The baseline API grants predate these tables. Table privileges must exist
-- before their RLS policies can authorize authenticated admins.
grant select on table public.course_task_definitions to anon, authenticated;
grant insert, update, delete on table public.course_task_definitions to authenticated;

grant select, insert, update, delete on table public.course_task_source_reviews to authenticated;

grant all privileges on table
  public.course_task_definitions,
  public.course_task_source_reviews
to service_role;
