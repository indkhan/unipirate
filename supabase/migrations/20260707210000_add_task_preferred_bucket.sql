alter table public.tasks
  add column preferred_bucket text
  check (preferred_bucket in ('now', 'next', 'later'));
