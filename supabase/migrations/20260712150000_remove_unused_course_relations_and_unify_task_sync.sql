-- Courses store their university name verbatim; the unused universities table
-- and its FK have never been populated. Import provenance is distinct from a
-- student's application link, which lives in applications.
alter table public.courses rename column created_by to imported_by;
alter table public.courses drop column university_id;
drop table public.universities;

-- Rule feedback was superseded by answer_reports and has no caller.
drop table public.rule_reports;

-- SQL could not apply the same intake-aware deadline selection as the pure
-- TypeScript task generator. Admin sync now uses that generator and needs
-- narrowly scoped admin writes to task copies.
drop function public.sync_course_task_definitions(uuid);
create policy "admin write" on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.remove_my_course(course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses
  set imported_by = null
  where id = course_id
    and imported_by = auth.uid()
    and review_status = 'approved';

  if found then
    return;
  end if;

  delete from public.courses
  where id = course_id
    and imported_by = auth.uid()
    and review_status <> 'approved';
end;
$$;
