-- Rules get a stable human identity (slug, for idempotent seeding from
-- scripts/rules.bootstrap.ts) and admin-panel country metadata (country_code —
-- display/filter only, never part of condition matching; null = an
-- international or shared rule).
alter table public.rules
  add column slug text unique,
  add column country_code text references public.countries (code);

create index rules_country_status_idx
  on public.rules (country_code, status);
