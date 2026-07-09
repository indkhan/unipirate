alter table public.tasks
  add column if not exists verbatim_due text,
  add column if not exists sort_order integer not null default 25,
  add column if not exists source_verified_at timestamptz,
  add column if not exists generated_active boolean not null default true;

insert into public.applications (user_id, course_id)
select created_by, id
from public.courses
where created_by is not null
  and review_status <> 'rejected'
on conflict (user_id, course_id) do nothing;
