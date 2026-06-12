-- Per-user checklist overrides: a small { itemKey: 'in_process' } map letting a
-- user mark an otherwise not-done step (grade, language, A-Levels…) as "in
-- process". Done/not-done are derived from the profile data; this only stores the
-- manual in-process flag (the "mix" model).
alter table public.profiles
  add column if not exists checklist_overrides jsonb not null default '{}';
