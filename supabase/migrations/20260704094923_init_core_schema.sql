-- Core schema: reference data, rules-as-data, courses, user data, reports.
-- RLS matrix: see application.md. Admin = JWT app_metadata.role = 'admin'.

-- ---------------------------------------------------------------- enums

create type public.rule_status as enum ('draft', 'beta', 'verified');
create type public.course_review_status as enum ('pending', 'approved', 'rejected');
create type public.extraction_method as enum ('library', 'ai', 'manual');
create type public.qualification_level as enum ('school', 'bachelor', 'master');

-- -------------------------------------------------------------- helpers

create function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- tables

create table public.countries (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  -- null country_code = international curriculum (IB, GCE A-Levels):
  -- these route to their own rule tree, before the national board question.
  country_code text references public.countries (code),
  level public.qualification_level not null,
  board_or_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (country_code, level, board_or_type)
);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  conditions jsonb not null,
  outcomes jsonb not null,
  status public.rule_status not null default 'draft',
  source_url text not null,
  source_quote text not null,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  uni_assist boolean not null default false,
  website text,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities (id),
  created_by uuid references auth.users (id) on delete set null,
  name text,
  degree text,
  language text,
  tuition jsonb,
  deadlines jsonb,
  requirements jsonb,
  source_url text not null,
  normalized_url text not null unique,
  review_status public.course_review_status not null default 'pending',
  extraction_method public.extraction_method,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  country_code text references public.countries (code),
  answers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'planning'
    check (status in ('planning', 'applied', 'admitted', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- null application_id = global task (APS, blocked account, translations)
  application_id uuid references public.applications (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  generated_from_rule_id uuid references public.rules (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rule_reports (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules (id) on delete cascade,
  -- null user_id = anonymous report from the loginless checker
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.answer_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  context jsonb,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------- indexes

create index qualifications_country_code_idx on public.qualifications (country_code);
create index courses_university_id_idx on public.courses (university_id);
create index courses_created_by_idx on public.courses (created_by);
create index applications_user_id_idx on public.applications (user_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_application_id_idx on public.tasks (application_id);
create index rule_reports_rule_id_idx on public.rule_reports (rule_id);
create index rule_reports_user_id_idx on public.rule_reports (user_id);
create index answer_reports_user_id_idx on public.answer_reports (user_id);

-- ---------------------------------------------------- updated_at triggers

create trigger set_updated_at before update on public.rules
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.answer_reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ RLS

alter table public.countries enable row level security;
alter table public.qualifications enable row level security;
alter table public.rules enable row level security;
alter table public.universities enable row level security;
alter table public.courses enable row level security;
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.tasks enable row level security;
alter table public.rule_reports enable row level security;
alter table public.answer_reports enable row level security;

-- reference data: public read, admin write
create policy "public read" on public.countries
  for select using (true);
create policy "admin write" on public.countries
  for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.qualifications
  for select using (true);
create policy "admin write" on public.qualifications
  for all using (public.is_admin()) with check (public.is_admin());

create policy "public read" on public.universities
  for select using (true);
create policy "admin write" on public.universities
  for all using (public.is_admin()) with check (public.is_admin());

-- rules: public read except drafts; only admin writes (AI drafts land via
-- service role as 'draft'; only a human flips status in the admin panel)
create policy "public read non-draft" on public.rules
  for select using (status <> 'draft' or public.is_admin());
create policy "admin write" on public.rules
  for all using (public.is_admin()) with check (public.is_admin());

-- courses: approved are public; owners see their own pending rows.
-- ponytail: a second user pasting an already-pending URL can't read that
-- pending row (unique normalized_url) — handle in app layer when it hurts.
create policy "read approved or own" on public.courses
  for select using (
    review_status = 'approved'
    or created_by = (select auth.uid())
    or public.is_admin()
  );
create policy "insert own pending" on public.courses
  for insert to authenticated
  with check (created_by = (select auth.uid()) and review_status = 'pending');
create policy "admin write" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: owner CRUD, admin read
create policy "owner all" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "admin read" on public.profiles
  for select using (public.is_admin());

-- applications: owner CRUD, admin read
create policy "owner all" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "admin read" on public.applications
  for select using (public.is_admin());

-- tasks: owner CRUD, admin read
create policy "owner all" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "admin read" on public.tasks
  for select using (public.is_admin());

-- reports: anyone may file (anon rows carry null user_id — the checker is
-- loginless); reporters see their own; admin reads + resolves all
create policy "insert own or anon" on public.rule_reports
  for insert with check (user_id is not distinct from (select auth.uid()));
create policy "read own" on public.rule_reports
  for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin update" on public.rule_reports
  for update using (public.is_admin()) with check (public.is_admin());

create policy "insert own or anon" on public.answer_reports
  for insert with check (user_id is not distinct from (select auth.uid()));
create policy "read own" on public.answer_reports
  for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin update" on public.answer_reports
  for update using (public.is_admin()) with check (public.is_admin());
