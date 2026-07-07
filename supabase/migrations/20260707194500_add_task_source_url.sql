alter table public.tasks
  add column if not exists source_url text;
