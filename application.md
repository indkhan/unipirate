# How the application works

Current state: auth + full data model (schema, RLS, seed) + admin rule/course review workspace + the pure rule engine (`lib/engine`) + the public multi-step eligibility checker (`/check`) with anonymous shareable results (`/result/[id]`, plain stub styling for now).

## Routes

- `/` — public landing page (`app/(public)/page.tsx`), links to login.
- `/check` — public, no login (`app/(public)/check/`). Multi-step checker: one question per screen, option cards, back navigation with persisted answers, mobile-first (390px) Wayfinding styling (tokens in `app/globals.css`, fonts loaded in `app/layout.tsx`). Curriculum type is asked before the board (CLAUDE.md rule 5) and routes to national-board vs GCE question branches; IB/other skip curriculum detail and yield honest unknowns. Pure flow logic (zod `AnswersSchema`, `visibleSteps`, `withAnswer`, `buildProfile`, GCE subject catalog) lives in `app/(public)/check/steps.ts` and is unit-tested against engine personas #1/#11 in `app/(public)/check/__tests__/steps.test.ts`. Submit (`actions.ts` server action) validates answers, builds the engine `Profile`, evaluates against published DB rules, stores the normalized answers and result in an anonymous `checks` row, and gives only the originating browser a 256-bit HttpOnly owner token whose SHA-256 hash is stored with the check. The client then redirects to the result. PostHog events: `check_started`, `step_completed` (`{step, question}`), `check_completed` (`{check_id}`).
- `/result/[id]` — public shareable result (`app/(public)/result/[id]/page.tsx`). The stored result includes path, APS/TestAS/dMAT, steps, documents, unknowns, and citations. Each citation records its rule status and the result keys it supports, allowing the UI to attach the correct official source and last-verified date to each verdict without presenting beta rules as verified.
- `/login` — public (`app/(public)/login/page.tsx`). Primary ways in: email/password sign-in, email/password account creation, and email magic link (Supabase OTP). Google OAuth code remains present for later, but it is optional and can stay disabled in Supabase.
- `/hello` — authenticated-only (`app/(app)/hello/page.tsx`). Shows the user's email and a sign-out button (server action). Unauthenticated visits are redirected to `/login` by `proxy.ts` and again by the page itself.
- `/admin` — authenticated admin-only (`app/(admin)/admin/page.tsx`). `proxy.ts` redirects logged-out users to `/login` and non-admin users to `/hello`; the page and server actions repeat the same admin check. Admins can filter rules by `country_code` and `status`, edit country/rule JSON/source/status fields, one-click re-verify a schema-valid rule (`status='verified'`, `last_verified_at=now()`), approve/reject pending courses, and inspect recent audit events.
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

## Rule engine (`lib/engine`)

`lib/engine/evaluate.ts` — pure functions, zero I/O. `evaluate(profile, rules[]) → Result` where `rules` are rows in the `rules` table's jsonb shape (callers load them via `lib/db`; the engine never touches the DB). Eligibility logic lives entirely in the rule records; the engine only:

- **Derives facts** from the `Profile` while keeping nationality, certificate country, and visa-application country as distinct intake data. Only facts used by supported rules are derived; eligibility thresholds and effective dates remain in DB rule conditions.
- **Matches conditions**: a rule's `conditions` is a flat AND map of `fact: value` (equality) or `fact: {op, value}` with `eq/neq/gte/gt/lte/lt/in/nin`. A condition on a missing fact never matches. Draft or malformed rows are skipped; admin publishing rejects malformed conditions/outcomes and stamps the verification date.
- **Merges outcomes** into `Result`: `path` (direct | subject_restricted | studienkolleg | insufficient | unknown), `aps`/`testAS`/`dMAT` flags, de-duped `documents`, order-sorted `steps`, and `citations[]` (rule id + source_url + last_verified_at + status + supported result keys + claim per contributing rule). Per key, the most-specific matching rule (highest condition count) wins; an equal-specificity conflict returns `unknown` with all tied rules cited. No matching rule for a key → explicit `unknown` plus a "confirm with [official source]" entry in `unknowns` — missing data is a valid state, never guessed.

Tests: `lib/engine/__tests__/` — `personas.ts` (the 13 Part-E personas from `docs/research_checklist.md`), `rules.fixture.ts` (the same bootstrap candidates used by the seed), and `evaluate.test.ts` (persona, transition, international-curriculum, and engine-behavior regressions).

## Data model

Schema lives in `supabase/migrations/20260704094923_init_core_schema.sql`, with API-role grants in `supabase/migrations/20260704122600_grant_api_role_privileges.sql` (Supabase is cloud-hosted; apply with `pnpm supabase db push` against the linked project — never `db reset --linked`). Types: `lib/db/database.types.ts` (regenerate with `pnpm db:types`). All reads/writes go through the typed helpers in `lib/db/queries.ts` — no inline SQL/queries in components.

Tables:

- `countries` (code pk: in/pk/sa/de), `qualifications` (level enum school/bachelor/master, board_or_type; `country_code null` = international curricula like IB/GCE A-Levels, which route to their own rule tree), `universities` — public-read reference data, admin-write.
- `rules` — the eligibility engine's runtime source of truth: stable `slug`, display/filter `country_code`, `conditions`/`outcomes` jsonb, status, source metadata, and verified date. Public-read except drafts; only admins write. Bootstrap candidates are always inserted as drafts and never overwrite existing rows; only a human publishes them through `/admin`.
- `courses` — extraction target for pasted course URLs: extraction fields (name, degree, language, tuition/deadlines/requirements jsonb), `normalized_url` unique (dedupe key), `review_status` pending/approved/rejected, `extraction_method` library/ai/manual, `created_by`. Public-read where approved; owners read their own pending rows; insert forced to `pending`.
- `admin_audit_events` — append-only audit trail for `rules` and `courses` updates. Triggered at the database level by `audit_admin_update()` after every update, storing actor user id, table name, row id, action, old/new status, old/new row snapshots, and timestamp. Admin read-only via RLS; inserts are performed by the security-definer trigger function.
- `profiles` — one per user (pk user_id), `country_code` + `answers` jsonb (checker Q&A). Owner CRUD, admin read.
- `applications` (user × course, unique pair, status text) and `tasks` (`application_id null` = global task like APS; `generated_from_rule_id` links back to the rule that spawned it). Owner CRUD, admin read.
- `rule_reports` / `answer_reports` — "this info is wrong" feedback; `user_id null` = anonymous report from the loginless checker. Anyone may insert, reporters read their own, admin reads/resolves.
- `checks` — anonymous eligibility check records (`answers` + normalized `profile` + `result` jsonb). Anyone may insert and anyone holding the UUID may read only the shareable fields. Private ownership metadata stores an owner-token hash plus optional `claimed_by`/`claimed_at`; the raw token exists only in the originating browser's HttpOnly cookie. Pre-ownership-migration checks stay shareable but cannot be securely claimed.

RLS is enabled on every table. The grant migration gives Supabase API roles the baseline table privileges needed for policies to run; RLS remains the user-facing authorization boundary, while `service_role` has full table privileges for seed/admin scripts. Admin = JWT claim `app_metadata.role = 'admin'`, checked by the `is_admin()` SQL helper; set it via the Supabase admin API. `updated_at` maintained by a shared `set_updated_at()` trigger. `rules` and `courses` updates also write `admin_audit_events` rows through audit triggers so status changes are recorded independently of the UI path.

Seed: `pnpm db:seed` (idempotent; needs `.env.local`) inserts reference data and 29 schema-validated draft rule candidates from `scripts/rules.bootstrap.ts`. Existing slugged rules are never overwritten.

RLS test: `lib/db/__tests__/rls.integration.test.ts` runs anon/owner/admin assertions against the real project when `.env.local` (or env) provides the Supabase keys; otherwise it self-skips so `pnpm test` stays green.
