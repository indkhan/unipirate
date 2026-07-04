# How the application works

Current state: auth + full data model (schema, RLS, seed) + admin rule/course review workspace. No student-facing product features yet.

## Routes

- `/` — public landing page (`app/(public)/page.tsx`), links to login.
- `/login` — public (`app/(public)/login/page.tsx`). Primary ways in: email/password sign-in, email/password account creation, and email magic link (Supabase OTP). Google OAuth code remains present for later, but it is optional and can stay disabled in Supabase.
- `/hello` — authenticated-only (`app/(app)/hello/page.tsx`). Shows the user's email and a sign-out button (server action). Unauthenticated visits are redirected to `/login` by `proxy.ts` and again by the page itself.
- `/admin` — authenticated admin-only (`app/(admin)/admin/page.tsx`). `proxy.ts` redirects logged-out users to `/login` and non-admin users to `/hello`; the page and server actions repeat the same admin check. Admins can filter rules by `conditions.country` and `status`, edit rule JSON/source/status fields, one-click re-verify a rule (`status='verified'`, `last_verified_at=now()`), approve/reject pending courses, and inspect recent audit events.
- `/auth/confirm` — GET route that verifies magic-link `token_hash` and redirects to `/hello`.
- `/auth/callback` — GET route that exchanges the OAuth `code` for a session and redirects to `/hello`.

## Auth flow

`proxy.ts` (Next 16 middleware) runs on every non-asset request: it refreshes the Supabase session cookies via `@supabase/ssr`, redirects logged-out users away from `/hello` and `/admin`, and blocks `/admin` unless `user.app_metadata.role === 'admin'`. Server code gets a Supabase client from `lib/db/server.ts`; client components use `lib/db/client.ts`. Password login uses Supabase email/password auth; account creation sends the user through Supabase email confirmation before they can rely on the account.

## Infrastructure

- `lib/env.ts` — zod-validates all env vars at import time; server-only vars are only validated server-side. All env access goes through it.
- `components/app/posthog-provider.tsx` — initializes PostHog (if `NEXT_PUBLIC_POSTHOG_KEY` is set) with automatic pageview/pageleave capture; wraps the app in `app/layout.tsx`.
- `scripts/send-test-email.ts` — sends a test email through Resend (`pnpm email:test <to>`).
- Vitest (`vitest.config.ts`) with `@` alias; smoke test in `lib/engine/__tests__/`.
- Empty-but-reserved dirs per CLAUDE.md: `app/(admin)`, `lib/ai`.

## Data model

Schema lives in `supabase/migrations/20260704094923_init_core_schema.sql`, with API-role grants in `supabase/migrations/20260704122600_grant_api_role_privileges.sql` (Supabase is cloud-hosted; apply with `pnpm supabase db push` against the linked project — never `db reset --linked`). Types: `lib/db/database.types.ts` (regenerate with `pnpm db:types`). All reads/writes go through the typed helpers in `lib/db/queries.ts` — no inline SQL/queries in components.

Tables:

- `countries` (code pk: in/pk/sa/de), `qualifications` (level enum school/bachelor/master, board_or_type; `country_code null` = international curricula like IB/GCE A-Levels, which route to their own rule tree), `universities` — public-read reference data, admin-write.
- `rules` — the eligibility engine's data: `conditions`/`outcomes` jsonb, `status` enum draft/beta/verified, `source_url` + `source_quote` + `last_verified_at` (every claim cites its source). Public-read except drafts; only admin writes. AI drafts land as `draft` via service role; only a human flips status.
- `courses` — extraction target for pasted course URLs: extraction fields (name, degree, language, tuition/deadlines/requirements jsonb), `normalized_url` unique (dedupe key), `review_status` pending/approved/rejected, `extraction_method` library/ai/manual, `created_by`. Public-read where approved; owners read their own pending rows; insert forced to `pending`.
- `admin_audit_events` — append-only audit trail for `rules` and `courses` updates. Triggered at the database level by `audit_admin_update()` after every update, storing actor user id, table name, row id, action, old/new status, old/new row snapshots, and timestamp. Admin read-only via RLS; inserts are performed by the security-definer trigger function.
- `profiles` — one per user (pk user_id), `country_code` + `answers` jsonb (checker Q&A). Owner CRUD, admin read.
- `applications` (user × course, unique pair, status text) and `tasks` (`application_id null` = global task like APS; `generated_from_rule_id` links back to the rule that spawned it). Owner CRUD, admin read.
- `rule_reports` / `answer_reports` — "this info is wrong" feedback; `user_id null` = anonymous report from the loginless checker. Anyone may insert, reporters read their own, admin reads/resolves.

RLS is enabled on every table. The grant migration gives Supabase API roles the baseline table privileges needed for policies to run; RLS remains the user-facing authorization boundary, while `service_role` has full table privileges for seed/admin scripts. Admin = JWT claim `app_metadata.role = 'admin'`, checked by the `is_admin()` SQL helper; set it via the Supabase admin API. `updated_at` maintained by a shared `set_updated_at()` trigger. `rules` and `courses` updates also write `admin_audit_events` rows through audit triggers so status changes are recorded independently of the UI path.

Seed: `pnpm db:seed` (idempotent; needs `.env.local`) inserts countries, qualifications, and 2 beta rules quoting `docs/research_findings.md`.

RLS test: `lib/db/__tests__/rls.integration.test.ts` runs anon/owner/admin assertions against the real project when `.env.local` (or env) provides the Supabase keys; otherwise it self-skips so `pnpm test` stays green.
