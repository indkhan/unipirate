-- UniPirate Ship 1 — initial schema + RLS
-- 9 tables: public content (anon-read, admin-write), per-user (owner-only), moderation.

-- ============================================================
-- PUBLIC CONTENT
-- ============================================================

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short text not null,
  city text not null,
  state text not null,
  apply_method text not null default 'other',     -- 'direct' | 'uni-assist' | 'other'
  portal_label text,                              -- original free-text e.g. 'TUMonline (direct)'
  general_deadlines text,
  semester_contribution text,
  daad_url text,
  blurb text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  degree text not null,
  semester text not null,
  language text not null,
  nc_free boolean not null default false,
  nc_value numeric,                               -- parsed number; null if non-numeric/unknown
  nc_value_label text,                            -- original e.g. '1.8 (WS 2024/25)'
  nc_year text,
  admission_requirements text,
  language_requirements text,
  course_structure text,
  how_to_apply text,
  application_deadline text,
  keywords text[] not null default '{}',
  apply_url text,
  summary text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index courses_university_id_idx on public.courses (university_id);

create table public.recognition_rules (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  qualification_type text not null,               -- 'Any' = country wildcard
  status text not null check (status in ('H+','H+/-','H-','H+ (subject-restricted)','UNCLEAR')),
  headline text not null,
  explanation text not null,
  next_steps text[] not null default '{}',
  action_links jsonb not null default '[]',       -- [{label, href, kind}]
  anabin_url text,
  needs_aps boolean not null default false,
  -- grade-threshold gating (verdict depends on grade for some countries)
  grade_threshold numeric,
  grade_threshold_kind text,                       -- 'raw_percent' | 'german_grade' | null
  status_if_below text check (status_if_below in ('H+','H+/-','H-','H+ (subject-restricted)','UNCLEAR')),
  headline_if_below text,
  explanation_if_below text,
  next_steps_if_below text[],
  unique (country, qualification_type)
);

create table public.grade_conversion (
  id uuid primary key default gen_random_uuid(),
  qualification_type text not null,
  grading_scale text,                              -- nullable: match by qual, or (qual, scale)
  n_max numeric not null,                          -- best attainable grade
  n_min numeric not null,                          -- minimum passing grade
  notes text,
  unique (qualification_type, grading_scale)
);

create table public.country_playbooks (
  id uuid primary key default gen_random_uuid(),
  country text not null unique,
  steps text[] not null default '{}'               -- ordered next-step checklist labels
);

-- ============================================================
-- PER-USER
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  country text,
  qualification text,
  grade text,
  grading_scale text,
  language_cert text,
  language_score text,
  pref_language text default 'Any',
  updated_at timestamptz not null default now()
);

create table public.tracked_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'planning',         -- planning | applied | admitted | rejected
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index tracked_applications_user_id_idx on public.tracked_applications (user_id);

create table public.application_steps (
  id uuid primary key default gen_random_uuid(),
  tracked_app_id uuid not null references public.tracked_applications(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index application_steps_tracked_app_id_idx on public.application_steps (tracked_app_id);

-- ============================================================
-- MODERATION
-- ============================================================

create table public.uni_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,  -- nullable: anon may submit
  uni_name text not null,
  daad_url text,
  pasted_text text,
  status text not null default 'pending',          -- pending | approved | rejected
  admin_note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPER: is the current user an admin?
-- SECURITY DEFINER avoids RLS recursion when policies check admin status.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.universities        enable row level security;
alter table public.courses             enable row level security;
alter table public.recognition_rules   enable row level security;
alter table public.grade_conversion    enable row level security;
alter table public.country_playbooks   enable row level security;
alter table public.profiles            enable row level security;
alter table public.tracked_applications enable row level security;
alter table public.application_steps   enable row level security;
alter table public.uni_requests        enable row level security;

-- Public content: anon + authed read; admin write.
create policy "public read" on public.universities for select using (true);
create policy "admin write" on public.universities for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.courses for select using (true);
create policy "admin write" on public.courses for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.recognition_rules for select using (true);
create policy "admin write" on public.recognition_rules for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.grade_conversion for select using (true);
create policy "admin write" on public.grade_conversion for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.country_playbooks for select using (true);
create policy "admin write" on public.country_playbooks for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: self only (admins also pass via is_admin for moderation reads).
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Tracked applications: owner only.
create policy "own apps" on public.tracked_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Application steps: owner via parent.
create policy "own steps" on public.application_steps
  for all using (
    exists (select 1 from public.tracked_applications t
            where t.id = tracked_app_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.tracked_applications t
            where t.id = tracked_app_id and t.user_id = auth.uid())
  );

-- Uni requests: anyone (incl. anon) may submit; only admins read/update/delete.
create policy "anyone submit" on public.uni_requests for insert with check (true);
create policy "admin read" on public.uni_requests for select using (public.is_admin());
create policy "admin update" on public.uni_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.uni_requests for delete using (public.is_admin());
