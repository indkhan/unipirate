-- Course finder conflicts: "the page changed" re-submissions land as conflict
-- rows (linked to the course they dispute) for admin side-by-side review.
-- (The user<->course dashboard link is the applications table, already seeded
-- by syncDashboard / ensureApplication — no backfill or remove_my_course change
-- needed here.)

-- Conflict link: a pending update submission points at the course it disputes.
alter table public.courses
  add column conflicts_with uuid references public.courses (id) on delete set null;

-- URL uniqueness only among non-conflict rows so an update can coexist with
-- the course it disputes.
alter table public.courses drop constraint courses_normalized_url_key;
create unique index courses_normalized_url_key
  on public.courses (normalized_url) where conflicts_with is null;

-- Atomic admin conflict resolution: keep the update (approve it, repoint
-- trackers of the old course, drop the old row) or keep the existing course
-- (repoint the submitter, drop the update).
create function public.resolve_course_conflict(p_new_course_id uuid, p_keep_new boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_course_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  select conflicts_with into v_old_course_id
  from public.courses where id = p_new_course_id for update;
  if v_old_course_id is null then
    raise exception 'course % is not an unresolved conflict', p_new_course_id;
  end if;

  if p_keep_new then
    update public.applications a set course_id = p_new_course_id
    where a.course_id = v_old_course_id
      and not exists (
        select 1 from public.applications b
        where b.user_id = a.user_id and b.course_id = p_new_course_id
      );
    -- ponytail: sibling conflict submissions die with the resolution — rare,
    -- their submitters just re-import against the survivor
    delete from public.courses
    where conflicts_with = v_old_course_id and id <> p_new_course_id;
    -- FK set-nulls the survivor's conflicts_with, letting it re-enter the
    -- partial unique index the deleted old row just left.
    delete from public.courses where id = v_old_course_id;
    update public.courses set review_status = 'approved' where id = p_new_course_id;
  else
    update public.applications a set course_id = v_old_course_id
    where a.course_id = p_new_course_id
      and not exists (
        select 1 from public.applications b
        where b.user_id = a.user_id and b.course_id = v_old_course_id
      );
    delete from public.courses where id = p_new_course_id;
  end if;
end;
$$;

revoke all on function public.resolve_course_conflict(uuid, boolean) from public;
grant execute on function public.resolve_course_conflict(uuid, boolean) to authenticated;
