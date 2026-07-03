# Build Plan — AI Study-in-Germany Guide

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres + Auth + pgvector) · Vercel + Vercel AI SDK · Resend · PostHog
**Tools:** Claude Code + Codex for code, Claude for design
**Budget:** ~10 hrs/week → each phase ≈ 1 week unless noted

---

## Phase 0 — Foundation (weekend 1)

1. Create the repo. First file is `CLAUDE.md` (project context for Claude Code): stack, conventions, folder structure, "never invent visa/admission rules — rules live in the DB," "all AI answers must cite sources."
2. `npx create-next-app@latest` (TS, Tailwind, App Router) → `npx shadcn@latest init`.
3. Supabase project: enable Auth (email + Google) and the `vector` extension now, even though RAG comes later.
4. Connect repo → Vercel. Deploy the empty app on day one; every merge to `main` ships. Add PostHog (provider + pageview capture) and verify events arrive.
5. Resend: add your domain, verify DNS, send yourself one test email.
6. Env vars in Vercel + `.env.local`, checked by a `env.ts` zod schema.

**Definition of done:** blank authenticated app live on a real URL, analytics recording, one email sent.

---

## Phase 1 — Data model (the real product)

Rules are **data, not code**. Sketch (adapt as you go):

- `countries` (in, pk, sa)
- `qualifications` — country_id, level (school/bachelor), board_or_type (CBSE, state board, HEC 2-yr, Tahsili…)
- `rules` — jsonb `conditions` (country, qualification, target_degree, grade ranges…), jsonb `outcomes` (studienkolleg: yes/no/maybe, aps_required, document list, steps), `source_url`, `source_quote`, `last_verified_at`, `status` (verified/beta), `notes`
- `universities` — name, city, uni_assist (bool), website
- `courses` — university_id, name, degree, language, tuition, deadlines jsonb, requirements jsonb, `source_url`, `review_status` (pending/approved), `extraction_method` (library/ai)
- `profiles` — user_id, country, qualification answers jsonb
- `applications` — user_id, course_id, status
- `tasks` — application_id (nullable for global tasks like APS), title, due_date, done, `generated_from_rule_id`
- `rule_reports` / `answer_reports` — user feedback on wrong info
- `documents_checklist` — generated per profile, item + source rule

Add RLS policies from the start (user sees only own rows; `courses` public-read where approved). Use Supabase migrations, not dashboard clicking — Claude Code handles migration files well.

**Workflow tip:** have Claude Code draft the schema + migrations in plan mode first; review before applying.

---## Phase 2 — Rule engine + admin panel

1. Pure TypeScript function: `evaluate(profile) → { path, studienkolleg, aps, documents[], steps[], citations[] }`. No AI anywhere in this path. Unit-test it with real personas (CBSE 85%, Pakistani 2-yr BA, Saudi Tahsili…).
2. Admin panel (`/admin`, role-gated): CRUD rules, see source + last-verified date, one-click "mark re-verified."
3. **Content sprint (the 60% that isn't code):** AI drafts the India rule tree from anabin/DAAD/uni-assist/APS-India official pages; you open every source and verify every branch before setting `status = verified`. Saudi you verify yourself. Pakistan stays `beta` until a Pakistani student checks it.

**DoD:** engine passes persona tests; every verified rule has a source URL you personally opened.

---

## Phase 3 — Public checker + first launch

1. Multi-step checker form (shadcn) → engine → result page: your path, Studienkolleg?, APS?, document checklist, timeline. Every line shows its source. Beta-country results carry a visible "beta — verify with official sources" banner.
2. Shareable result link (public, no login) + "save this & track your applications" → signup. This is your conversion moment — instrument it in PostHog (funnel: started → completed → shared → signed up).
3. Bonus lead magnets (tiny, deterministic): **grade converter** (bavarian formula) and an **APS-India wizard**.
4. **Launch v0.1:** your story + link in 2–3 Telegram/WhatsApp groups and r/Indians_StudyAbroad. Answer questions manually all week; log every question you couldn't answer — that's your rules backlog.

**DoD:** strangers completing checks. Target trajectory toward 300 completions by September.

---

## Phase 4 — Course extraction pipeline

1. User pastes course URL (+ page text if paywalled/JS-heavy).
2. Server route: fetch → extract with a library first (`@mozilla/readability` + `cheerio`); if key fields missing → Vercel AI SDK `generateObject` with a zod schema (name, degree, language, deadlines, requirements, tuition). Store `extraction_method`.
3. Course lands in the user's dashboard immediately (private). It also enters the **admin review queue**: you see extracted fields vs. source, approve → public course page showing **facts + prominent link to DAAD/uni page**. No prose republishing.
4. Dedup by normalized URL so ten users pasting the same course = one record.

**DoD:** paste a real DAAD link → clean structured course in <10s.

---

## Phase 5 — Dashboard

1. `applications`: add course → status pipeline (researching → preparing → applied → result).
2. Task auto-generation: profile rules + course requirements + deadlines → per-uni checklist and global tasks (APS, blocked account, translations), each linked to its source rule.
3. **Now / Next / Later** view (sort by deadline proximity + dependency: APS before uni-assist, etc.) and a calendar view (deadlines + task due dates).
4. Keep it one screen on mobile — your users live on phones.

**DoD:** add 3 courses → coherent merged plan with correct ordering.

---

## Phase 6 — Reminders + rule-change alerts

1. Vercel Cron (daily) → tasks due in 7/3/1 days → Resend email (react-email templates). Respect an unsubscribe flag.
2. **Killer feature:** on any rule edit, diff conditions → find affected profiles → queue "a requirement for your profile changed" email. This is your retention moat; ship it before the chatbot.

---

## Phase 7 — Chatbot (strict RAG)

1. Embed: verified rules, user's own courses/tasks/profile, and your curated official-source snippets → pgvector.
2. Vercel AI SDK `streamText` + tool calls: `search_rules`, `get_user_context`, `web_search` (bias official domains; label web results "unverified — double-check").
3. System prompt is **country-templated** and hard-line: answer only from retrieved sources, cite inline, otherwise say "I don't know — check [official source]." Refuse to guess on visa/legal specifics.
4. "Report this answer" button on every response. Log all Q&A (PostHog + DB) — unanswered questions feed the rules backlog.
5. Free quota per user (e.g. 20 msgs/day) on a cheap model; you pay, no BYO keys.

**DoD:** 20 adversarial questions → zero uncited factual claims.

---

## Phase 8 — Hardening + real launch

- PostHog funnels + weekly retention; session replays on checker drop-offs.
- Feedback widget everywhere; fix top 5 issues.
- Legal pass: Impressum + Datenschutzerklärung (GDPR — you're in Germany, this is mandatory, ~a day with generators + Gründerbüro review), disclaimer wording on every advice surface.
- Launch story post (your Saudi→Saarbrücken journey) + Insta/LinkedIn. LinkedIn version doubles as job-search content.

**September gate:** 300 completed checks, ≥30% dashboard signup → continue to affiliates (blocked account / insurance) and paid LOM/LOR. Under → talk to 10 users before writing more code.

---

## Working rules with Claude Code / Codex

- One feature per session; start in plan mode (`think` first, `ultrathink` for schema/engine design), review the plan, then let it build.
- Keep `CLAUDE.md` updated after every phase — it's your compounding leverage.
- Never let AI write rule *content* directly to `verified`; AI drafts → you verify → flip status.
- Commit small; Vercel preview deploys are your QA.
- Design: generate 2–3 layout directions with Claude first, pick one, keep a `design.md` with tokens/spacing so Claude Code stays consistent.

## Deliberately NOT in v1

Document uploads (GDPR-heavy) · payments · auto-applying to portals · mobile app · public course SEO pages beyond approved facts · LOM/LOR/visa services (phase 2 monetization).