-- AI assistant knowledge base + chat log.
-- kb_chunks holds the embedded corpus: chunks derived from published rules
-- (rule_id set) and curated official snippets (rule_id null, source of truth
-- in scripts/kb.snippets.ts). Rebuilt wholesale by `pnpm kb:embed`.

create extension if not exists vector with schema extensions;

create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('rule', 'snippet')),
  rule_id uuid references public.rules (id) on delete cascade,
  slug text not null unique,
  title text not null,
  content text not null,
  source_url text not null,
  last_verified_at timestamptz,
  country_code text references public.countries (code),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.kb_chunks
  for each row execute function public.set_updated_at();

-- No ANN index: the corpus is <100 rows, an exact scan is both correct and
-- fast. Add hnsw only if kb_chunks grows past ~10k rows.

alter table public.kb_chunks enable row level security;

-- Same visibility as published rules: the corpus only ever contains
-- beta/verified content, so it is public-read.
create policy "kb_chunks public read" on public.kb_chunks
  for select using (true);
create policy "kb_chunks admin write" on public.kb_chunks
  for all using (public.is_admin()) with check (public.is_admin());

create function public.match_kb_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 6
)
returns table (
  slug text,
  title text,
  content text,
  source_url text,
  last_verified_at timestamptz,
  country_code text,
  source_type text,
  similarity double precision
)
language sql stable
as $$
  select
    slug, title, content, source_url, last_verified_at, country_code,
    source_type,
    1 - (embedding operator(extensions.<=>) query_embedding) as similarity
  from public.kb_chunks
  where embedding is not null
  order by embedding operator(extensions.<=>) query_embedding
  limit match_count
$$;

-- Full Q&A log; also powers the daily question quota
-- (count of role='user' rows since UTC midnight).
create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create index assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_messages enable row level security;

create policy "assistant_messages owner insert" on public.assistant_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "assistant_messages read own" on public.assistant_messages
  for select using (user_id = (select auth.uid()) or public.is_admin());

grant select on table public.kb_chunks to anon, authenticated;
grant select, insert on table public.assistant_messages to authenticated;
grant all privileges on table public.kb_chunks, public.assistant_messages to service_role;
grant execute on function public.match_kb_chunks(extensions.vector, int) to anon, authenticated, service_role;
