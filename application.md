# How the application works

Current state: bare scaffold. No features yet — only auth and infrastructure.

## Routes

- `/` — public landing page (`app/(public)/page.tsx`), links to login.
- `/login` — public (`app/(public)/login/page.tsx`). Primary ways in: email/password sign-in, email/password account creation, and email magic link (Supabase OTP). Google OAuth code remains present for later, but it is optional and can stay disabled in Supabase.
- `/hello` — authenticated-only (`app/(app)/hello/page.tsx`). Shows the user's email and a sign-out button (server action). Unauthenticated visits are redirected to `/login` by `proxy.ts` and again by the page itself.
- `/auth/confirm` — GET route that verifies magic-link `token_hash` and redirects to `/hello`.
- `/auth/callback` — GET route that exchanges the OAuth `code` for a session and redirects to `/hello`.

## Auth flow

`proxy.ts` (Next 16 middleware) runs on every non-asset request: it refreshes the Supabase session cookies via `@supabase/ssr` and redirects logged-out users away from `/hello`. Server code gets a Supabase client from `lib/db/server.ts`; client components use `lib/db/client.ts`. Password login uses Supabase email/password auth; account creation sends the user through Supabase email confirmation before they can rely on the account.

## Infrastructure

- `lib/env.ts` — zod-validates all env vars at import time; server-only vars are only validated server-side. All env access goes through it.
- `components/app/posthog-provider.tsx` — initializes PostHog (if `NEXT_PUBLIC_POSTHOG_KEY` is set) with automatic pageview/pageleave capture; wraps the app in `app/layout.tsx`.
- `scripts/send-test-email.ts` — sends a test email through Resend (`pnpm email:test <to>`).
- Vitest (`vitest.config.ts`) with `@` alias; smoke test in `lib/engine/__tests__/`.
- Empty-but-reserved dirs per CLAUDE.md: `app/(admin)`, `lib/ai`, `supabase/migrations`.
