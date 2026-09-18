-- Switch the assistant KB to OpenRouter's free NVIDIA embedding model.
-- The new model returns 2048-d vectors, so existing embeddings are discarded.
-- Rebuild kb_chunks after applying this migration: pnpm kb:embed

drop function if exists public.match_kb_chunks(extensions.vector, int);

alter table public.kb_chunks
  drop column embedding;

alter table public.kb_chunks
  add column embedding extensions.vector(2048);

create function public.match_kb_chunks(
  query_embedding extensions.vector(2048),
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

grant execute on function public.match_kb_chunks(extensions.vector, int)
  to anon, authenticated, service_role;
