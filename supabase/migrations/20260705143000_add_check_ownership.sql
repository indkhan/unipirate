-- Anonymous checks remain publicly shareable, but only the browser that
-- created one receives the secret needed to claim it after authentication.
alter table public.checks
  add column answers jsonb,
  add column owner_token_hash text,
  add column claimed_by uuid references auth.users (id) on delete set null,
  add column claimed_at timestamptz;

alter table public.checks
  add constraint checks_claim_state_consistent check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  );

-- The original table-level SELECT grant would expose future private columns.
-- Public readers only need the shareable result payload.
revoke select on table public.checks from anon, authenticated;
grant select (id, profile, result, created_at) on table public.checks
  to anon, authenticated;

