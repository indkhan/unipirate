# UniPirate

A free web app for international students planning applications to German public universities. Eligibility is evaluated by rules, with source citations and explicit unknowns when coverage is missing.

## Implemented

- Anonymous, branching eligibility checker for national, GCE and IB qualifications; shareable results and secure ownership claims.
- Email/password and magic-link authentication, saved profiles and profile re-evaluation.
- Course finder, pasted-page import, deterministic DAAD parsing and an optional AI extraction fallback.
- Application tracker, manual tasks, admin-defined course tasks, Now/Next/Later buckets and calendar.
- Admin review queues, rule editing, course-task management and audit history.
- Assistant sidebar, retrieval tools, citation markers and daily quotas. Working OpenRouter credentials and embeddings are required.

Rule coverage is incomplete. Country choices include India, Pakistan and Saudi Arabia; this does not imply every qualification or outcome is verified. Email reminders, rule-change notifications, a standalone grade converter and an APS wizard are not implemented.

See [current verification and blockers](docs/STATUS.md), [architecture](docs/application.md) and [implementation backlog](docs/UNIPIRATE_IMPLEMENTATION_BACKLOG.md).

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and configure Supabase. OpenRouter is required for AI features; Tavily enables web search and PostHog is optional.
3. Enable Supabase Email authentication. Configure confirmation templates to use `/auth/confirm?token_hash={{ .TokenHash }}&type=signup` or `type=email`, and allow the local app URL in redirect settings. Google OAuth needs provider configuration.
4. Run `pnpm dev` and open the URL printed by Next.js (normally http://localhost:3000).
5. Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build`.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm test` / `pnpm lint` / `pnpm typecheck`
- `pnpm db:seed` — reference data and draft rule candidates
- `pnpm db:types` — regenerate linked database types
- `pnpm kb:embed` — rebuild assistant embeddings
- `pnpm eval:assistant` — adversarial assistant evaluation

Apply new migrations using `pnpm supabase db push` against the linked project; never reset the linked database. Supabase sends authentication emails; there is no application email-reminder command.
