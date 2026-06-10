# UniPirate

Helps international students check whether their qualification is recognised in
Germany (anabin-based) and what to do next, then browse curated bachelor's
programs with a deterministic NC-match — Next.js 15 + Supabase.

## Setup

1. Install deps: `npm install`
2. Create a Supabase project. Copy `.env.example` → `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by the seed)
3. Apply the schema:
   - With Docker + CLI: `supabase db reset` (local) or `supabase link` + `supabase db push` (cloud)
   - Or paste `supabase/migrations/20260610000001_init.sql` into the SQL editor
4. Seed curated data: `npm run seed`
5. Enable **Email** + **Google** auth providers in the dashboard.
6. Make yourself admin after first sign-in:
   `update profiles set is_admin = true where id = '<your-auth-uid>';`

The app runs without Supabase too — content falls back to the static dataset
(`lib/data.js` + `lib/seed-data.js`), so anonymous browsing always works.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production
- `npm test` — deterministic unit tests (grade conversion, NC verdicts,
  recognition matching, seed transforms) via `node --test`
- `npm run seed` — upsert curated universities/courses/recognition data
- `npm run lint`

## Key modules

- `lib/nc.js` — deterministic engine: Modified Bavarian Formula, NC verdict
  tiers, recognition matching + grade-threshold gating (no AI in the critical path)
- `lib/seed-data.js` — curated recognition rules, grade conversion, and country
  playbooks for the 7 target countries (India, Pakistan, China, Malaysia, Saudi
  Arabia, UAE, Kuwait). anabin is the source of truth — verify before launch.
- `lib/repo/*` — data access (Supabase with static fallback)
- `supabase/migrations/` — schema + RLS
