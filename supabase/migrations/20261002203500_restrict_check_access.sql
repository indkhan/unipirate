-- Checks remain shareable by an unguessable UUID, but cannot be enumerated
-- or written directly by browser clients. The server validates answers and
-- computes the result before inserting with its private service key.
revoke all on table public.checks from anon, authenticated;
revoke select (id, answers, result, created_at) on public.checks from anon, authenticated;
drop policy "anyone inserts checks" on public.checks;
drop policy "anyone reads checks" on public.checks;

create function public.get_shared_check(p_check_id uuid)
returns table (id uuid, answers jsonb, result jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.answers, c.result, c.created_at
  from public.checks c where c.id = p_check_id;
$$;

revoke all on function public.get_shared_check(uuid) from public;
grant execute on function public.get_shared_check(uuid) to anon, authenticated;
