-- Let users remove courses they imported from their own dashboard.
-- Pending/rejected imports are deleted. Approved courses are only detached
-- from the user so public reviewed course pages do not disappear.

create function public.remove_my_course(course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses
  set created_by = null
  where id = course_id
    and created_by = auth.uid()
    and review_status = 'approved';

  if found then
    return;
  end if;

  delete from public.courses
  where id = course_id
    and created_by = auth.uid()
    and review_status <> 'approved';
end;
$$;

revoke all on function public.remove_my_course(uuid) from public;
grant execute on function public.remove_my_course(uuid) to authenticated;
