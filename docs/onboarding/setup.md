# Local setup

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- Access to the project's Supabase instance for database-backed flows

## Install and run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

On PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if
needed. Open <http://localhost:3000>.

The minimum useful environment variables are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

PostHog is optional locally. OpenRouter is needed for the course-import AI
fallback and assistant; Tavily is needed for assistant web search. See
[`.env.example`](../../.env.example) for the canonical variable list. Never
commit `.env.local` or credentials.

## Supabase auth for local development

In the Supabase dashboard:

1. Enable Email sign-in and sign-ups.
2. Keep email confirmation enabled.
3. Point the Magic Link template to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
4. Point the signup confirmation template to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
5. Add `http://localhost:3000/**` to the allowed redirect URLs.

Google OAuth is not required for local development.

## Verify the checkout

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The RLS integration suite self-skips when the required Supabase credentials or
schema are unavailable. A skip is not proof that RLS works; run it against the
linked project before merging an authorization or schema change.

## Seed and database commands

```bash
pnpm db:seed
pnpm kb:embed
pnpm eval:assistant
```

- `db:seed` is idempotent and writes new rule candidates as drafts.
- `kb:embed` rebuilds the assistant knowledge base after published rule
  changes.
- `eval:assistant` runs the adversarial citation/unknown-answer evaluation.

For schema work, add a migration under `supabase/migrations/`, run
`pnpm supabase db push` against the linked project, then `pnpm db:types`.
Never edit an applied migration or reset the linked database.

