# UniPirate

Guided study-in-Germany applications. Product spec: [docs/mvp.md](docs/mvp.md). How the app works: [application.md](application.md).

## Local setup

1. **Install deps** — `pnpm install` (Node 20+, pnpm 9+).
2. **Env vars** — `cp .env.example .env.local` and fill in the Supabase URL, publishable key, and secret key from the [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → API keys. PostHog and Resend keys are optional in dev.
3. **Supabase auth config** — in the dashboard enable **Email** sign-in and sign-ups (Authentication → Providers → Email), keep **Confirm email** on, point the **Magic Link** template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and point the **Confirm signup** template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Add `http://localhost:3000/**` to the redirect URLs. Google can stay disabled until OAuth credentials are ready.
4. **Run** — `pnpm dev` and open http://localhost:3000. Log in with email/password or magic link; you land on `/hello`.
5. **Verify** — `pnpm test && pnpm lint && pnpm typecheck && pnpm build` should all pass. Test email sending with `pnpm email:test you@example.com` (needs `RESEND_API_KEY`).

## Commands

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm email:test <to>`

## Structure

See [CLAUDE.md](CLAUDE.md).
