# Claude Code Playbook — Session-by-Session Build

One honest note first: there is no single "perfect prompt" — there is a perfect *setup* (CLAUDE.md + docs in the repo) plus disciplined per-session prompts with acceptance criteria, and you reviewing plans before code. That's what this is.

**Working rules (apply to every session):**
- One session = one feature. `/clear` between sessions. Commit at every green state.
- Start every session in **plan mode**; read the plan; only then let it build. Use `ultrathink` for Sessions 1, 2, and 9 (schema, engine, RAG).
- Claude Code drives; use Codex as a second-opinion reviewer on the engine and RLS policies ("review this diff for logic and security issues"), not as a parallel author.
- Before Session 0: copy `mvp.md`, `research-findings.md`, `research-checklist.md` into `/docs` in the repo. They are the product spec and seed data — the prompts below reference them.

---

## When does Claude Design come in? (your question, answered precisely)

**Run Claude Design in parallel during weeks 1–2, inject at Session 4.**

- Backend work (Sessions 0–3) is design-independent — never let it wait on design.
- While Sessions 0–3 run, do the Claude Design work from the prompt pack: Prompt 0 (design system) first, then landing, checker flow, result page. Lock the system.
- Before Session 4, export the **Claude Code handoff** for the finished pages into the repo (e.g. `/design/`), and distill the locked tokens into `docs/design.md` (colors + usage rules, type scale, spacing, radius, the Route + Verified-stamp component specs).
- Every UI session from 4 onward starts with: *"Read docs/design.md and /design/<page> before writing any UI."*
- Dashboard/chatbot designs (Design prompts 4–5) can be produced later, in parallel with Sessions 5–6, as long as they exist before Sessions 7 and 9.

---

## The CLAUDE.md file (create this before anything else — paste verbatim, adjust names)

```markdown
# Project: [name] — guided study-in-Germany applications

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

## Conventions
- Server Components by default; 'use client' only when interactive.
- Zod-validate every boundary (forms, AI outputs, env via lib/env.ts).
- Engine changes require tests in the same commit. Personas in
  lib/engine/__tests__/personas.ts mirror docs/research-checklist.md Part E.
- UI work: read docs/design.md first; use only its tokens; mobile (390px) first.
- Never commit secrets; env template in .env.example.
- Do not add dependencies without stating why in the plan.
```

---

## Session prompts (copy-paste, in order)

### Session 0 — Scaffold
> Read docs/mvp.md and CLAUDE.md. Plan first. Scaffold the project: Next.js 16 + TypeScript strict + Tailwind + shadcn init; Supabase client setup (browser + server) with auth (email + Google); lib/env.ts zod-validating all env vars; PostHog provider with pageview capture; Resend wired with one test email script; vitest configured with a passing smoke test; folder structure per CLAUDE.md; .env.example. Done means: pnpm build, test, lint, typecheck all pass, and the README explains local setup in 5 steps. Do NOT build any features or UI beyond a bare authenticated "hello" page.

Deploy to Vercel yourself after this session. **Meanwhile: start Claude Design Prompt 0.**

### Session 1 — Data model (`ultrathink`)
> Read docs/mvp.md, docs/research-findings.md, and CLAUDE.md domain rules. Ultrathink, then plan before writing anything. Design Supabase migrations for: countries, qualifications, rules (jsonb conditions/outcomes, source_url, source_quote, status draft|beta|verified, last_verified_at), universities, courses (extraction fields, review_status, extraction_method, normalized_url unique), profiles, applications, tasks (generated_from_rule_id), rule_reports, answer_reports. RLS per CLAUDE.md rule 6, including an admin role via JWT claim. Generate TypeScript types from the schema. Write lib/db typed query helpers for each table. Show me the schema as a markdown ER summary in the plan BEFORE creating migrations. Done means: migrations apply cleanly to a fresh local db; a seed script inserts 2 sample rules quoting real entries from docs/research-findings.md (status beta); RLS tested with anon vs owner vs admin in a vitest integration test.

### Session 2 — Rule engine (`ultrathink`)
> Read docs/research-findings.md fully and CLAUDE.md domain rules 1, 2, 5. Ultrathink. Build lib/engine: pure `evaluate(profile, rules[]) → Result` with path (direct | subject_restricted | studienkolleg | insufficient | unknown), aps requirement, testAS/dMAT flags, document list, ordered steps, citations[] (rule id + source_url + verified date per claim), and honest `unknown` outcomes when no rule matches. Condition matching must support: country, curriculum_type (national | IB | GCE | other), board, grade thresholds (e.g. India ≥70% Class XII with the 15-Mar-2026 / WS-2026-27 cutoff logic), years of university study, target degree, prior-degree field (for dMAT), intake semester. TDD: write the 13 personas from docs/research-checklist.md Part E as failing tests first, then implement until green. Do NOT touch UI or DB writes; the engine takes rules as input.

Then: draft the full India + Saudi rule trees as `draft` seed records with Claude Code's help, **verify each against its source yourself**, flip to beta/verified in Session 3's admin panel.

### Session 3 — Admin panel
> Read CLAUDE.md. Plan first. Build /admin (admin-role gated): rules table (filter by country/status; edit conditions/outcomes/source; verified-age color coding >6 months amber; one-click re-verify updating last_verified_at), and a course review queue (extracted fields vs source link, approve/reject, highlight AI-extracted fields). Dense desktop layout, plain shadcn, no custom design. Log every status change to an audit table. Done means: I can take a draft rule to verified in 3 clicks and every change is audited.

### ⬅ DESIGN INJECTION — before Session 4
Export Claude Design handoff for landing/checker/result into `/design`, write `docs/design.md` (tokens + Route + Verified-stamp specs).

### Session 4 — Checker flow (first designed UI)
> Read docs/design.md and /design/checker first; match them faithfully. Plan first. Build the public multi-step checker at /(public)/check: one question per screen on mobile 390px, curriculum-type question BEFORE board (CLAUDE.md rule 5), option cards, back navigation with persisted answers, zod-validated. On submit: run lib/engine, store an anonymous check record, redirect to a shareable result page (Session 5 will style it — stub it plain for now). Instrument PostHog: check_started, step_completed(n), check_completed. Done means: persona #1 and #11 from the engine tests can be walked through the real UI with correct outcomes.

### Session 5 — Result page + share loop
> Read docs/design.md and /design/result. Plan first. Build the result page: verdict blocks with Verified stamps (source + last_verified_at, tappable), personalized Route component, document checklist preview (5 items, rest gated behind signup), timeline strip, beta-country banner, WhatsApp/Telegram share row, single signup CTA that claims the anonymous check into the user's profile. Public/owner variants. Must screenshot cleanly at 390px: verdict + route in one viewport. PostHog: result_viewed, result_shared, signup_from_result.

**Ship it. This is launch v0.1 — post in communities while building continues.**

### Session 6 — Course extraction pipeline
> Read CLAUDE.md and docs/mvp.md. Plan first. Build: (1) POST /api/courses/import — input url + optional pasted text; fetch server-side; extract with @mozilla/readability + cheerio; zod schema {name, university, degree, language, deadlines[], requirements[], tuition}; if required fields missing after library pass, fall back to Vercel AI SDK generateObject against the same schema; record extraction_method per field group. (2) Dedupe by normalized_url. (3) Course appears instantly in the importing user's dashboard as private; also enters admin review queue; on approve → public course page rendering ONLY structured facts + a prominent link to the source (no prose from the source). Done means: 3 real DAAD/uni URLs I give you import in <10s with correct deadlines, and a garbage URL fails gracefully with a useful message.

### Session 7 — Dashboard (needs Design prompt 4 exported)
> Read docs/design.md and /design/dashboard. Plan first. Build /(app)/dashboard: Route header with days-to-nearest-deadline; task auto-generation service that merges profile rules (global tasks like APS/blocked account, each with generated_from_rule_id) + per-application course requirements/deadlines into Now (max 3) / Next / Later with dependency ordering (APS before uni-assist submission); universities rail with status pipeline; calendar view of the same data; add-course-by-URL sheet using Session 6's API; empty/overdue/all-done states per design. Regenerate tasks idempotently when a course or rule changes — never duplicate tasks. Done means: adding 3 courses yields one coherent merged plan and re-running generation changes nothing.

### Session 8 — Reminders + rule-change alerts
> Plan first. (1) Vercel cron daily: tasks due in 7/3/1 days → Resend react-email, respecting an email_prefs flag; idempotent (a reminders_sent table). (2) Rule-change alerts: on any rule update, diff conditions, find affected profiles via the engine, queue "a requirement for your profile changed" emails with old→new summary and source link. Write this as a service triggered from the admin panel save path, with a dry-run preview for me before sending. Done means: editing the India 70% rule in admin shows me exactly which test users would be emailed and why.

### Session 9 — Chatbot (`ultrathink`)
> Read CLAUDE.md rules 2–4 and docs/design.md + /design/chat. Ultrathink, plan first. Build strict-RAG chat: embed verified+beta rules and curated official snippets into pgvector; tools: search_rules, get_user_context (profile, applications, tasks), web_search restricted-bias to official domains (daad.de, aps-india.de, uni-assist.de, *.diplo.de, auswaertiges-amt.de, goethe.de) with results labeled unverified. System prompt: country-templated; answer ONLY from tool results; every factual claim cites rule id or URL; if sources don't answer, say so and point to the official source — refusing to guess is success, not failure. Stream with Vercel AI SDK. Per-user daily quota (20) on a cheap model. Report-this-answer button writing to answer_reports; log all Q&A. Done means: my 20-question adversarial set (I'll paste it) produces zero uncited factual claims and at least 3 honest "I don't know"s.

### Session 10 — Hardening + launch
> Plan first. Sweep: PostHog funnel events audit (check→result→signup→course→task-done), error boundaries + Sentry-style logging on API routes, rate limiting on /api/courses/import and chat, Impressum + Datenschutzerklärung pages (I'll supply text), feedback widget, loading/empty states audit at 390px, lighthouse pass on public pages, README + docs/runbook.md (cron, envs, admin tasks). No new features.

---

## Prompt patterns that make these work

- **Acceptance criteria in every prompt** ("Done means:") — Claude Code optimizes for what you can check.
- **Point at files, not vibes** ("read docs/design.md") — context beats adjectives.
- **Name the anti-goals** ("Do NOT touch UI") — prevents scope creep mid-session.
- **Make it show the plan for schema/engine before code** — cheapest review point you'll ever get.
- **Personas as tests** — your research is executable; regressions in visa logic become failing tests, not user complaints.
- After each session, ask: *"Update CLAUDE.md with anything you learned that future sessions need."* That's the compounding trick.






#design

# Claude Design Prompt Pack — Study-in-Germany App

How to use: run **Prompt 0 once** to establish the design system (Claude Design applies it to every project after). Then run one prompt per page, in order. Iterate with chat for broad changes, inline comments for targeted ones. Export finished pages via the Claude Code handoff into your Next.js repo.

---

## Prompt 0 — Design system (run first, iterate until it feels right)

```
You are designing the visual identity for a web app that guides students from India, Pakistan, and Saudi Arabia through applying to German public universities — eligibility, documents, deadlines, and a tracked application dashboard.

AUDIENCE: 17–24 year olds, anxious about a confusing bureaucratic process, mostly on mid-range Android phones, often on slow connections. Mobile-first is non-negotiable.

EMOTIONAL JOB: turn anxiety into confidence. The product's whole promise is "every claim verified, with sources and dates." The design must feel official-but-warm, precise, calm — like a well-run German institution that actually likes you.

ANTI-REFERENCES (do NOT look like these): study-abroad consultancy sites (stock photos of smiling students on lawns, gradient CTAs, "Get FREE counselling" popups); generic AI-startup landing pages (dark background + one neon accent, or cream background + serif + terracotta); template SaaS.

DIRECTION TO EXPLORE — "Wayfinding": borrow from German public wayfinding and official documents. Think transit-map clarity, DIN-style signage typography, form-and-stamp paper culture — modernized and friendly, never cold.

Build a design system with:
- PALETTE: paper-neutral background (cool, not cream), ink-navy text, one confident "route blue" primary, a "verified green" used ONLY for verified/source-checked states, a signal amber used ONLY for deadlines/warnings. Name each color and define usage rules.
- TYPE: a DIN-flavored grotesque for display (e.g. Archivo or Barlow — your pick, justify it), a highly readable body face (e.g. Public Sans), and a monospace for dates, deadlines, rule IDs, and citations — mono is our "document data" voice. Define a full scale with weights.
- SIGNATURE ELEMENT: the "Route" — a transit-line motif showing a student's journey as stations (Eligibility → APS → Applications → Visa → Germany), with a "you are here" marker. Design it as a reusable component: full horizontal on desktop, vertical line on mobile. This is the one memorable thing; keep everything else quiet.
- SECONDARY MOTIF: a "Verified" stamp/chip containing a source link + last-verified date in mono. It should read as a quality seal, used consistently wherever we cite a rule.
- COMPONENTS: buttons, form inputs, cards, task checklist item, deadline chip, progress states, empty states — spec'd for the system above.
- Spacing scale, border radius stance, elevation/shadow stance, and a short motion policy (few, purposeful; respect reduced-motion; nothing decorative).

Show me the system as a style-guide page. Then show the same hero section in this direction and one alternative direction of your choosing, so I can compare before locking it in.
```

After it responds: pick a direction, ask for 2–3 refinements, then say "lock this as the design system for all projects."

---

## Prompt 1 — Landing page (home = the checker)

```
GOAL: a first-time visitor (worried student, on a phone, arrived from a Telegram group) understands in 5 seconds what this is, trusts it, and starts the eligibility check. One primary action only.

LAYOUT (mobile-first):
1. Hero: headline + the first question of the checker EMBEDDED directly in the hero (country select + "Start my check" — the checker IS the hero, not a screenshot of it). Above it a small Route component preview showing the journey stations.
2. "How it works" — 3 steps max, each tied to a Route station.
3. Trust section: the Verified stamp explained — "Every answer cites an official source (anabin, DAAD, uni-assist) with a last-verified date." Show a real example stamp.
4. "Why we're different" — one honest comparison row: Commission consultants / Doing it alone / Us. No competitor names.
5. Free tools strip: grade converter + APS wizard as two quiet cards.
6. Footer: Impressum, Datenschutz, contact, "built by a student who did this journey — Saudi Arabia → Saarbrücken."

CONTENT: write real copy, plain and specific, sentence case, zero marketing filler. Headline should state the outcome, not the category — something like "Your exact path to a German public university. Every step verified." (improve on this). No fake stats, no fake testimonials.

AUDIENCE NOTE: many users read English as a second language — short sentences, common words, no idioms.
```

---

## Prompt 2 — Eligibility checker flow

```
GOAL: a 5–7 step form that feels like a guided conversation, not a government form. Each answer visibly builds progress toward "your result." Completion rate is the metric that matters.

LAYOUT: one question per screen on mobile. Persistent slim Route progress at top (stations fill as you go). Big tappable option cards instead of dropdowns wherever options ≤ 6 (country, degree level, board type). Number inputs for grades with inline format hint. Back is always available; answers persist.

STATES TO DESIGN: default, selected, error ("we need this to calculate your path" — direct, not apologetic), and a "not sure?" helper link on tricky questions (board type, degree duration) opening a short plain-language explainer sheet.

CONTENT: real questions for an Indian applicant: country → current education level → board (CBSE/CISCE/State) → stream & grades → target (Bachelor/Master) → intended field. Write helper text for the board question explaining why it matters in one sentence.

Design the final "calculating" moment as a brief, honest transition (checking rules against anabin/DAAD — no fake AI theater), then hand off to the result page.
```

---

## Prompt 3 — Result page (shareable — this page IS the product's reputation)

```
GOAL: the student sees their personal path clearly enough to screenshot and share in a group chat, and is motivated to sign up to track it. Two jobs: clarity + conversion to dashboard.

LAYOUT:
1. Verdict block: "Your path" — direct admission or Studienkolleg, APS required or not — stated in one calm sentence each, with a Verified stamp (source + last-verified date in mono) on every claim.
2. The full Route component, personalized: their stations, with time estimates per leg.
3. Document checklist preview (first 5 items, rest behind signup).
4. Timeline strip: key dates/deadlines in mono.
5. Beta banner variant (for Pakistan/Saudi profiles): visible amber note "beta — verify with official sources", designed to inform, not alarm.
6. Share row: copy link + "share to WhatsApp/Telegram" prominent (this is our growth loop).
7. Conversion block: "Save this path and track every deadline" → sign up. This is the ONLY hard CTA on the page.

DESIGN CONSTRAINT: this page must screenshot beautifully on a 390px-wide phone — the verdict block + route should fit one screen. Also design the public/logged-out variant vs. the owner variant.
```

---

## Prompt 4 — Dashboard (Now / Next / Later)

```
GOAL: a returning applicant opens this daily during application season and knows in 3 seconds what to do today. Calm operations room, not a data dashboard.

LAYOUT (mobile-first, one column):
1. Header: their Route with "you are here" + days to nearest deadline.
2. NOW: max 3 tasks, large checklist items (each shows which uni or global process it belongs to, due date in mono, and a Verified stamp if generated from a rule).
3. NEXT: collapsed list. LATER: collapsed further.
4. Universities rail: horizontal cards per application (uni name, program, status pipeline chip, next deadline). Tap → per-uni checklist.
5. Calendar toggle: same data as month view, deadlines as amber chips.
6. Global processes (APS, blocked account, translations) visually distinct from per-uni tasks.

STATES: empty state ("Add your first course — paste any DAAD or university link") designed as an invitation with a paste field, not a sad illustration. Overdue state: amber, direct, tells them what to do, never shames. All-done state: quiet celebration, on-brand.

Also design the "add course by URL" sheet: paste field → extraction result preview (facts + source link) → confirm.
```

---

## Prompt 5 — AI assistant panel

```
GOAL: a chat sidebar (bottom sheet on mobile) that answers questions ONLY with receipts. The design must make cited answers feel normal and uncited speculation impossible.

LAYOUT: standard chat, but every factual answer renders with inline Verified stamps (tappable → source). Web-sourced info gets a visually distinct "unverified — double-check" chip in amber. An "I don't know" answer pattern is a DESIGNED state: it says what it can't confirm and links the official source to check — make this look responsible, not broken.

EXTRAS: suggested questions on empty state drawn from the user's own context ("What's my next APS step?", "Which documents am I missing for TU Berlin?"). A small "report this answer" affordance on every message. Quota indicator (e.g. 14/20 today) designed to be honest and unobtrusive.
```

---

## Prompt 6 — Admin panel (keep it plain)

```
GOAL: internal tool for one admin (me): rules table + course review queue. Function over identity — use the design system's utility layer only, dense desktop layout, no hero, no marketing.

Rules table: conditions summary, outcome summary, source URL, last-verified date (mono, color-coded by age: >6 months = amber), status (verified/beta), one-click re-verify. Course review queue: extracted fields side-by-side with source link, approve/reject, diff-style highlight on AI-extracted (vs library-extracted) fields.
```

---

## Iterating well in Claude Design

- First generation = starting point. Use **chat** for broad moves ("make the whole thing calmer, more whitespace"), **inline comments** on the canvas for targeted fixes ("this stamp is too loud"), and the **adjustment knobs** for spacing/color tweaks.
- Ask it to critique itself: "Review this against the design system and against our anti-references — what still looks templated?"
- Keep alternatives: "Save this version, then try a completely different approach to the hero."
- Always check the 390px mobile view before accepting anything — your users live there.
- When a page is right: export via the **Claude Code handoff** into your repo, then tell Claude Code to implement it with shadcn/Tailwind, mapping system tokens into `tailwind.config` / CSS variables. Keep a `design.md` in the repo mirroring the locked system so Code and Design never drift.

## One warning

Claude Design outputs front-end only — no Supabase wiring, no auth, no server logic. Treat its output as the visual spec + markup; the build plan's phases still own the real implementation.