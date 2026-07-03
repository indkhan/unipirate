# Project: Cyvalent — guided study-in-Germany applications

## What this is
A web app that tells students from India/Pakistan/Saudi Arabia their exact path
to a German public university. Product spec: docs/mvp.md. Verified rule content:
docs/research-findings.md. Full domain map: docs/research-checklist.md.

## Stack
Next.js 16 (App Router, TypeScript strict), Tailwind, shadcn/ui, Supabase
(Postgres + Auth + RLS + pgvector), Vercel (hosting + cron), Vercel AI SDK,
Resend (react-email), PostHog. Package manager: pnpm.

## Commands
pnpm dev · pnpm build · pnpm test (vitest) · pnpm lint · pnpm typecheck
Supabase: pnpm supabase migration new <name> · pnpm supabase db push

## Structure
app/            routes (route groups: (public), (app), (admin))
lib/engine/     rule engine — PURE functions, zero I/O, fully unit-tested
lib/db/         typed Supabase queries only; no inline SQL in components
lib/ai/         Vercel AI SDK calls, prompts, extraction schemas
components/     UI; ui/ = shadcn primitives, app/ = composed
supabase/migrations/
docs/           mvp.md, research-findings.md, design.md — READ THESE FIRST

## Domain rules that override everything
1. Eligibility logic lives in the `rules` DB table, NEVER in code. The engine
   only evaluates rule records against a profile.
2. NEVER invent, guess, or "fill in" visa/admission rules. If a rule is missing,
   the engine returns an explicit `unknown` outcome with a "confirm with
   [official source]" message. Missing data is a valid state, not a gap to fill.
3. AI never writes rules with status `verified`. AI may draft rules as `draft`;
   only a human flips status via the admin panel.
4. Every user-facing factual claim carries source_url + last_verified_at.
5. Curriculum type (IB / GCE A-Levels / national board) is asked BEFORE the
   national board and routes to its own rule tree (see docs/research-findings.md
   → "International curricula").
6. All tables have RLS. Users read/write only their rows; `courses` public-read
   only where review_status='approved'; `rules` public-read where status != 'draft'.
7. Money amounts, deadlines, and fees are data with a verified date — never
   hardcoded in components.
8. There is application.md which contains how the application works so if you add something remove something or edit somethind modify  application.md as well 

## Conventions
- Server Components by default; 'use client' only when interactive.
- Zod-validate every boundary (forms, AI outputs, env via lib/env.ts).
- Engine changes require tests in the same commit. Personas in
  lib/engine/__tests__/personas.ts mirror docs/research-checklist.md Part E.
- UI work: read docs/design.md first; use only its tokens; mobile (390px) first.
- Never commit secrets; env template in .env.example.
- Do not add dependencies without stating why in the plan.