# UniPirate — Your guided path to studying in Germany

**One-liner:** A free web app that tells international students exactly how to get into a German public university — personalized steps, documents, and deadlines — without paying a commission-driven consultant or drowning in scattered forum advice.

---

## The problem

If you want to study in Germany today, you have two bad options:

1. **Pay a consultant.** Many earn commissions from private universities, so their "advice" pushes you toward expensive private programs — or they charge heavy fees for public-uni applications you could do yourself.
2. **Do it alone.** The rules depend on your country, your school board, your grades, and your target degree. Anabin, uni-assist, APS, Studienkolleg, blocked accounts, per-university deadlines — the information exists, but it's scattered across a dozen official sites, and one missed requirement can cost you a full year.

There's nothing in the middle: not a full-service consultant, not DIY chaos — a guide.

## Who it's for

Students from **India** (fully verified rules at launch), **Pakistan and Saudi Arabia** (beta), applying to **German public universities** for Bachelor's or Master's programs. Built for people who are willing to do the work themselves if someone just shows them *their* exact path.

## What the MVP does

**1. Eligibility checker (free, no login).**
Enter your country, qualification, board, grades, and target degree. Get your personalized path: direct admission or Studienkolleg, whether you need APS, your exact document list, and a realistic timeline. Every result is rule-based (no AI guessing) and cites its official source — anabin, DAAD, uni-assist — with a "last verified" date. Shareable link at the end.

**2. Free mini-tools.**
German grade converter (bavarian formula) and a step-by-step APS wizard for Indian applicants.

**3. Course tracker.**
Paste any DAAD or university course URL — we extract the key facts (deadlines, language, requirements, tuition) into your dashboard and always link back to the official page.

**4. Application dashboard.**
All your target universities in one place. Auto-generated checklists per university plus global tasks (APS, translations, blocked account), organized as **Now / Next / Later**, with a calendar view and email reminders before every deadline.

**5. Rule-change alerts.**
Requirements change every semester. When a rule that affects *your* profile changes, you get notified. No consultant offers this.

**6. AI assistant (with receipts).**
A chatbot that knows your profile, your courses, and your tasks — and answers **only from verified rules and official sources, with citations on every answer.** If it doesn't know, it says so and points you to the official source instead of guessing. Web results are clearly labeled as unverified.

## What it deliberately does NOT do

- It does **not** apply on your behalf — it shows you exactly where and how to apply yourself.
- No document uploads, no payments, no visa filing (yet).
- No university commissions, ever. Our advice has no reason to lie to you.

## Principles

1. **Deterministic first, AI second.** Rules are rules — AI is only used where fixed logic can't reach, and never for eligibility decisions.
2. **Every claim has a source.** Official link + last-verified date on everything.
3. **Free for students.** Future revenue comes from things every student needs anyway (blocked account and health insurance partnerships) and optional services (LOM/LOR review, visa prep) — never from steering you toward a university.

## Status & roadmap

- **Now:** MVP in development — India rule tree under verification, checker launching first.
- **Next:** dashboard + reminders + AI assistant, then community launch (Telegram/WhatsApp groups, Reddit).
- **Later:** visa guidance, LOM/LOR review, more countries.

## Who's building it

Built by a CS student at Saarland University who did this exact journey himself — Saudi Arabia to Germany — and built the tool he wishes had existed. Background: production AI/LLM engineering (RAG systems, agents), founding engineer experience.

**Want to help?** We're looking for students from India and Pakistan who recently went through the process to verify country rules — and early users who want their application semester to be less terrifying.

## New to the codebase?

Start with [docs/application.md](docs/application.md) — architecture, core
flows, data model, and a "where to make common changes" map. Conventions and
product rules live in [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md).

## Local setup

1. **Install deps** — `pnpm install` (Node 20+, pnpm 9+).
2. **Env vars** — `cp .env.example .env.local` and fill in the Supabase URL, publishable key, and secret key from the [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → API keys. PostHog and Resend keys are optional in dev.
3. **Supabase auth config** — in the dashboard enable **Email** sign-in and sign-ups (Authentication → Providers → Email), keep **Confirm email** on, point the **Magic Link** template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and point the **Confirm signup** template at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Add `http://localhost:3000/**` to the redirect URLs. Google can stay disabled until OAuth credentials are ready.
4. **Run** — `pnpm dev` and open http://localhost:3000. Log in with email/password or magic link; you land on `/dashboard`.
5. **Verify** — `pnpm test && pnpm lint && pnpm typecheck && pnpm build` should all pass. Test email sending with `pnpm email:test you@example.com` (needs `RESEND_API_KEY`).

## Commands

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm email:test <to>`

