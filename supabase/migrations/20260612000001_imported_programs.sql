-- DAAD course imports: user-pasted DAAD detail pages, parsed regex-first with
-- per-field LLM fallback. Rows start private (owner-only); admin promotes ONE
-- row per daad_id to public, materializing it into universities/courses.

create table public.imported_programs (
  id uuid primary key default gen_random_uuid(),
  daad_id text not null,                            -- numeric id from .../detail/<id>/
  raw_url text not null,
  raw_text text not null,                           -- golden source, never mutated
  raw_text_hash text not null,                      -- sha256 hex; freshness signal
  -- denormalized headline fields (effective values, synced on edit/promote)
  course_name text,
  uni_name text,
  city text,
  apply_method text check (apply_method in ('direct','uni-assist','other')),
  parsed_json jsonb not null default '{}'::jsonb,   -- {fields: {k: {value, source}}, warnings: []}
  llm_extra jsonb,                                  -- AI bonus notes; never merged into facts
  user_edits jsonb not null default '{}'::jsonb,    -- flat {field: value} overlay
  checklist_json jsonb,                             -- generated checklist preview
  parser_version int not null default 1,
  status text not null default 'private' check (status in ('private','pending','public')),
  created_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,  -- set on promote
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One public row per DAAD program; private duplicates allowed.
create unique index imported_programs_one_public_per_daad
  on public.imported_programs (daad_id) where status = 'public';
create index imported_programs_created_by_idx on public.imported_programs (created_by);
create index imported_programs_daad_id_idx on public.imported_programs (daad_id);

alter table public.imported_programs enable row level security;

-- Read: owner sees own; everyone sees public; admin sees all.
create policy "read own or public" on public.imported_programs
  for select using (created_by = auth.uid() or status = 'public' or public.is_admin());

-- Insert: only as yourself, only private.
create policy "insert own private" on public.imported_programs
  for insert with check (created_by = auth.uid() and status = 'private');

-- Update: owner may edit own private rows but cannot change status —
-- the with check (status='private') is what blocks self-promotion.
create policy "update own private" on public.imported_programs
  for update using (created_by = auth.uid() and status = 'private')
  with check (created_by = auth.uid() and status = 'private');

create policy "admin all" on public.imported_programs
  for all using (public.is_admin()) with check (public.is_admin());
