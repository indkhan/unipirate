-- Profile fields for A-Levels (per-subject letter grades) and IB Higher-Level
-- subject flags (drive general vs subject-restricted recognition).
alter table public.profiles
  add column if not exists a_level_grades text,
  add column if not exists ib_hl_math boolean not null default false,
  add column if not exists ib_hl_science boolean not null default false;
