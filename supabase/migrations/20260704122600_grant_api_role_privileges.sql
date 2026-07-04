-- Supabase API roles still need table privileges before RLS policies can run.
-- RLS remains the authorization boundary for anon/authenticated users.

grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

grant select on table
  public.countries,
  public.qualifications,
  public.universities,
  public.rules,
  public.courses,
  public.profiles,
  public.applications,
  public.tasks,
  public.rule_reports,
  public.answer_reports
to anon, authenticated;

grant insert on table
  public.courses,
  public.profiles,
  public.applications,
  public.tasks,
  public.rule_reports,
  public.answer_reports
to authenticated;

grant insert on table
  public.rule_reports,
  public.answer_reports
to anon;

grant update, delete on table
  public.profiles,
  public.applications,
  public.tasks
to authenticated;

grant update on table
  public.courses,
  public.rules,
  public.rule_reports,
  public.answer_reports
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all routines in schema public to service_role;
