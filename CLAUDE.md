# UniPirate — working notes

A free web app that tells international students exactly how to get into a
German public university. Full architecture and flow documentation:
[docs/application.md](docs/application.md).

## Commands

- `pnpm dev` / `pnpm build` — run / production-build the Next.js app
- `pnpm test` — Vitest (integration suites self-skip without env keys)
- `pnpm lint` / `pnpm typecheck` — must stay clean
- `pnpm db:seed` — idempotent reference data + draft rule candidates
- `pnpm db:types` — regenerate `lib/db/database.types.ts` after migrations
- `pnpm kb:embed` — rebuild the assistant knowledge base after rule changes
- `pnpm eval:assistant` — 20-question adversarial assistant eval

## Product rules (non-negotiable)

1. **Never invent a fact.** Deadlines, fees, requirements, and course facts
   are stored and shown verbatim from their source. Parsed dates are used
   only for sorting/bucketing, never displayed as the source of truth.
2. **Honest unknowns.** When no verified rule covers a case, say so and point
   to the official source. An "unknown" outcome is a valid, designed result —
   not an error to paper over.
3. **Deterministic first, AI second.** Eligibility comes from the rule engine
   only. AI fills extraction gaps (verbatim quotes, zod-validated) and powers
   the strict-RAG assistant — it never decides eligibility.
4. **Every claim cites its source.** Rules carry `source_url`,
   `source_quote`, and `last_verified_at`; assistant answers carry
   `[[rule:slug]]` / `[[web:url]]` / `[[unknown]]` markers.

## Code conventions

- Pure logic (engine, task generation, checker steps, markers) lives in
  modules with **zero I/O** and unit tests; I/O stays in actions, routes, and
  the `materialize`/`view` shells.
- All database access goes through `lib/db/queries.ts` (user) or
  `lib/db/admin-queries.ts` (admin) — never inline in components. RLS is the
  authorization boundary; helpers take a caller-scoped client.
- Auth guards: `requireUser()` / `requireAdmin()` from `lib/auth/session.ts`
  for pages and server actions; API routes return 401/403 JSON themselves.
- Validate every boundary input with zod (server actions, API bodies, env
  vars, rule records).
- Known accepted trade-offs are marked with a `Trade-off:` comment at the
  decision site.
- Schema changes: add a new file under `supabase/migrations/` (never edit an
  applied one), `pnpm supabase db push` against the linked project (never
  `db reset --linked`), then `pnpm db:types`.
