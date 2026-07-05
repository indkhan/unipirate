-- Anonymous eligibility check records. No user_id: checks run without login
-- and the uuid in the share link is the only handle to the row.
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  profile jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.checks enable row level security;

create policy "anyone inserts checks" on public.checks
  for insert to anon, authenticated with check (true);

-- Shareable result: anyone holding the uuid may read it.
create policy "anyone reads checks" on public.checks
  for select to anon, authenticated using (true);

grant select, insert on table public.checks to anon, authenticated;
