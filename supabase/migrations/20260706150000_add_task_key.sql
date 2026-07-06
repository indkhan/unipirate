alter table public.tasks
  add column task_key text,
  add constraint tasks_user_id_task_key_key unique (user_id, task_key);
