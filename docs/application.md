# How the application works

UniPirate is a free web app that tells international students exactly how to
get into a German public university: a rule-based eligibility checker, a
course tracker, a task dashboard, and a citations-only AI assistant. This is
the canonical architecture guide. Read this document to learn where and how
to make changes.

Product framing and setup instructions live in the [README](../README.md).
Non-negotiable product rules and code conventions live in
[AGENTS.md](../AGENTS.md). Current verification and blockers live in
[STATUS.md](STATUS.md); planned release work lives in
[UNIPIRATE_IMPLEMENTATION_BACKLOG.md](UNIPIRATE_IMPLEMENTATION_BACKLOG.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, server components + server actions) |
| Language | TypeScript, strict; zod at every boundary |
| Database & auth | Supabase (Postgres + RLS, GoTrue auth, pgvector) |
| Styling | CSS Modules per surface + Tailwind (admin only) |
| AI | OpenRouter (chat + embeddings), Tavily (web search), Vercel AI SDK |
| Analytics | PostHog (auth emails are sent by Supabase itself) |
| Tests | Vitest (`__tests__` folders next to the code) |

## Architecture in one picture

```
Browser
  │
  ▼
proxy.ts (middleware: refresh session, gate /dashboard /profile /courses /admin)
  │
  ▼
app/ routes ──────────── server components render, server actions mutate
  │
  ▼
lib/ modules
  ├─ engine/      pure rule evaluation        (zero I/O, unit-tested)
  ├─ tasks/       generate (pure) → materialize (write) → view (read)
  ├─ courses/     URL normalization, DAAD manual fallback, research/evidence contracts
  ├─ ai/          assistant, KB rendering, bounded course research, markers
  ├─ checks/      anonymous-result ownership tokens
  ├─ auth/        requireUser/requireAdmin guards, safe redirects
  └─ db/          typed Supabase clients + ALL queries
  │
  ▼
Supabase (Postgres + RLS = the authorization boundary)
```

Two principles explain most of the layout:

1. **Pure core, I/O shell.** Anything with domain logic (rule evaluation,
   checker step routing, task generation, deadline parsing, citation markers)
   is a pure module with unit tests. Actions and routes are thin shells that
   load data, call the pure core, and write results.
2. **RLS is the authorization boundary.** Every query helper takes the
   caller's session-scoped Supabase client, except the dedicated server-only
   `createCheckWriter()` used after checker validation and evaluation. Browser
   roles cannot insert or enumerate checks. Postgres row-level security —
   not TypeScript — decides what each user can see and write; the app-level
   guards only decide where to redirect.

## Repository tour

```
app/
  (public)/          no login required
    page.tsx           landing page
    check/             eligibility checker (one question per screen)
    result/[id]/       shareable result page + claim flow
    courses/[id]/      public course page
    login/             email/password, magic link, Google OAuth, reset
  (app)/             signed-in surfaces
    dashboard/         tasks (Now/Next/Later + calendar), applications rail
    courses/           course finder + add-by-URL sheet
    profile/           edit saved checker answers
  (admin)/admin/     task-oriented operations workspace: overview, review queues, rules, course tasks, audit
  api/
    courses/import/    POST — course lookup / import / update submission
    assistant/chat/    POST — streaming strict-RAG chat
  auth/confirm|callback  magic-link / OAuth redirect handlers
components/
  app/               shared product components (topbar, assistant sidebar…)
  ui/                shadcn primitives (admin only)
lib/                 see architecture picture above
scripts/             seed, KB embed, assistant eval
supabase/migrations/ schema — append-only, applied with `supabase db push`
docs/                architecture, verification status and release backlog
```

Naming conventions: route-specific logic lives next to its route (e.g.
`app/(public)/check/steps.ts`); anything shared by two routes moves to
`lib/`. Server actions are always in an `actions.ts` beside the page that
uses them.

## Domain concepts

- **Rule** — a row in `rules`: a flat AND-map of `conditions` over derived
  facts, plus `outcomes` (admission path, APS/TestAS/dMAT flags, documents,
  steps, note), a `status` (`draft` → `beta` → `verified`), and mandatory
  source metadata (`source_url`, `source_quote`, `last_verified_at`).
  Eligibility logic lives entirely in rule data, never in code.
- **Fact** — a primitive derived from the user's profile
  (`class12_percent`, `gce_al_count`, `intake_index`…). The engine derives
  facts; thresholds stay in rule conditions so admins can change them
  without a deploy.
- **Check** — one anonymous eligibility run: answers, normalized profile,
  and result stored under a shareable UUID at `/result/[id]`.
- **Application** — the user↔course link that puts a course on the
  dashboard (`applications` row with a status: planning/applied/admitted/
  rejected).
- **Task** — a dashboard to-do. Rule tasks and course-task assignments have
  a non-null `task_key`; manual tasks have `task_key = null`. Every course
  task (submission deadline, requirement, or custom reminder) starts as an
  admin-managed `course_task_definitions` row and is copied to each planning
  application. Student detail edits are protected from later admin changes.
- **KB chunk** — an embedded text rendering of a rule (or curated snippet)
  the assistant retrieves and cites.

## The rule engine (`lib/engine/evaluate.ts`)

`evaluate(profile, rules[]) → Result`. Pure, zero I/O; callers load rules
from the DB.

1. **Derive facts** from the profile (arithmetic restatement only — counts,
   minimum grades, boolean presence; no thresholds).
2. **Match rules**: every condition must pass; a condition on a missing fact
   never passes (missing data never satisfies anything, not even `neq`).
   Draft and malformed rows are skipped so bad data cannot take the checker
   down.
3. **Merge outcomes**: per key (path, scoped APS, testas, dmat) the most-specific
   matching rule wins (highest condition count). An equal-specificity
   disagreement is a data conflict → the key resolves to `unknown` and both
   rules are cited. No matching rule → explicit `unknown` plus a
   "confirm with the official source" entry in `unknowns`.

The result carries `citations[]` (which rule supported which part of the
verdict) and `unknowns[]` (honest gaps). Tests in
`lib/engine/__tests__/` run 13 real-student personas against the same rule
fixture the seed uses.

## Core flows

### Admin operations workspace

`/admin` is a bookmarkable, task-oriented workspace. `view=overview|reviews|rules|tasks|audit`
selects a focused surface; review queues and selected records are represented in the URL.
The overview exposes real attention counts, while each view loads task definitions only for
the selected course rather than expanding every course at once. Rules use guided condition
rows backed by the same JSON draft, with advanced JSON retained as an escape hatch. Publishing,
rejection, conflict resolution, source adoption, and task retirement require explicit
confirmation, and successful actions return to the relevant workspace with feedback. RLS,
server-side zod validation, audit triggers, and deterministic eligibility behavior are unchanged.

### 1. Eligibility check → shareable result → claim

1. `/check` renders one question per screen. All flow logic —
   `visibleSteps` (branching), `withAnswer` (prunes answers whose step
   disappeared), `isAnswered` (gates Continue), `buildProfile` — is pure in
   `app/(public)/check/steps.ts`. Branches: curriculum type is asked before
   the board; GCE and IB collect per-subject rows (one shared
   `SubjectRowsEditor`, one static catalog each carrying the DAAD
   classification); an IB Certificate short of the full diploma skips the
   detail questions, since no rule can give it a path; the existing-APS
   answer stays independent of visa filing in new/edited APS-versioned flows;
   pre-scope Saudi checks remain readable without inventing an answer. Steps
   rendered as a number input are listed in `NUMBER_STEPS` with their bounds.
2. Submit (`submitCheck` server action) zod-validates the answers, evaluates
   against published rules, and inserts a `checks` row through the dedicated
   server-only check writer → redirect to
   `/result/[id]`.
3. Ownership: anonymous submitters get a random token in an HttpOnly cookie;
   only its SHA-256 hash is stored (`lib/checks/ownership.ts`). Signed-in
   submitters skip tokens — their profile is upserted and dashboard tasks
   are materialized immediately.
4. `/result/[id]` is public to anyone holding the UUID. `get_shared_check`
   returns only that UUID's shareable columns; table collection reads and
   browser writes are forbidden. The page validates stored answers and
   re-evaluates them against current published rules, rather than trusting
   stored verdicts (including legacy client-written results). Thus the displayed
   assessment can change after rule updates; its timestamp is the original
   check creation time. Sharing still exposes answers to UUID holders; consent,
   expiry and revocation remain backlog work. The `result_viewer`
   DB function tells the page whether the request is the anonymous owner,
   the claimed owner, or the public; the page adapts its banners and CTA.
5. Claiming: the result CTA sends the visitor through
   `/login?next=/result/[id]?claim=1`; back on the page, the `claim_check`
   DB function verifies the token hash and atomically copies the answers
   into the user's profile, then tasks are materialized.

#### Qualification-history contract

New and edited checker answers carry `qualificationHistoryVersion: 1`.
Unversioned stored answers retain their original required country/curriculum
validation and `buildProfile` mapping. New visible history answers are required
for a new evaluation; historical checks remain readable. History uses the existing
answers JSON; no database migration is needed.

The degree-level question comes first, including country landing links. Bachelor
applicants then select school certificate country/curriculum. National-curriculum
bachelor routes ask whether previous university study exists; GCE/IB do not add
that branch. Master's applicants do not answer school country or curriculum.
Both history branches record one relevant prior qualification, including ongoing
or discontinued study: qualification type, awarding institution, awarding
institution country, reported field, full duration, successfully completed study
and completion status. Country choices reuse `COUNTRIES`; Another country
collects a country name without guessing a supported code. Existing stored
country codes outside the catalog remain selectable. Fractions/zero are accepted;
0–50 years is an input sanity bound, never an admission threshold.

Master's applicants also explicitly choose the awarding country's higher education
system, an international/other system, or Not sure. `Profile.tertiaryQualification`
stores issuer, country, optional countryName and context separately from school
curriculum. `certificateCountry` is the assessed qualification country: for a
versioned master's profile it is derived only from that tertiary issuer, never
from a stale school or landing-page country. No prior study leaves this fact
missing. Nationality and visa jurisdiction remain independent.

The narrow engine correction restates the explicitly chosen tertiary context into
the already-supported `curriculum` fact, and tertiary country into
`certificate_country`. It does not guess school curriculum, determine
recognition or change rule acceptance. Unknown/missing context yields a missing
fact. APS now uses separate scoped issuer facts rather than that legacy scalar. [APS India's FAQ](https://aps-india.de/faqs/)
(checked 2026-10-06) corroborates that scope; no rule source, verification date,
threshold, applicability or intake was rewritten. Admission/equivalence remains
subject to the existing verified rules and honest unknowns.

`Profile.qualificationHistory` separately records reported duration/completion
and derives `prior_degree_years`, `prior_degree_field`,
`years_of_university_study`, `has_prior_university_study`,
`prior_qualification_type`, `prior_study_institution`,
`prior_study_country`, and `prior_study_completion`. These keys deliberately
remain outside `FactKeySchema` until dependent issues review and explicitly
enable their rule conditions. Related-field, institution-recognition and
school-certificate-sufficiency booleans are not inferred or collected as blanket
true answers. [uni-assist master's guidance](https://www.uni-assist.de/en/how-to-apply/get-information/master/)
was also checked on 2026-10-06; no course-specific criteria become code thresholds.

Changing study level/curriculum clears dependent history; changing previous
qualification type clears detail answers. Country/issuer changes invalidate
tertiary context and existing APS answers; changing issuer also clears its country. Hidden school-country/curriculum
answers are pruned when editing a master's profile, so contradictory country
aliases cannot survive an edit. Legacy read data remains intact. Saved master's
drafts restore under their original country landing key despite not storing a
school-country alias; stored numeric progress stops at newly missing questions.
No application, task completion, student edit or database row is deleted. APS
dates/partnerships, JEE/certificate specifics, field equivalence and recognition
evidence remain reserved for dependent issues.

Versioned answers share pure `normalizeAnswers` pruning across edits, draft
restoration, account initialization, complete-answer validation and profile mapping.
Pruning repeats until no hidden answer remains (a removed country can hide APS).
Unversioned saved records retain their original fields until an explicit edit
upgrades the flow. Draft recovery validates the partial answer object and stored
step index with zod before assignment; malformed storage is discarded and the
checker restores its validated initial answers. Unfinished text and empty subject selections remain
valid partial drafts, but complete submissions still require subjects.

#### APS confirmed-submission contract (UP-ELIG-06)

New/restored checker and profile edits carry `apsTransitionVersion: 1`; stored
unversioned results remain readable without new timing answers. Only national
Bachelor applicants with an explicitly Indian national school issuer see the
progressive `apsProcedureStatus` → `apsSubmissionConfirmation` →
`apsSubmissionDate` questions. Status records no relevant submission, pending,
completed, a new evaluation for updated qualifications, or uncertainty. The date
is asked only when the applicant reports an APS record/communication confirming
the **complete submission for this procedure's Class XII or Class XII plus one
successful Bachelor year assessment**. Another or uncertain academic basis
requires the uncertainty answer. This confirmation is reported, not verified by
the app. A
new evaluation requires its own confirmation/date. No certificate validity,
authenticity, recognition or admission guarantee is inferred from that report.

`Profile.apsProcedure` stores `{status, submissionConfirmation?, submissionDate?}`.
`lib/engine/calendar-day.ts` exports zero-I/O `calendarDay(unknown)` → validated
Gregorian `YYYYMMDD | undefined` and `CalendarDateSchema` for exact `YYYY-MM-DD`.
It uses arithmetic, not timestamps, local dates, Date parsing or rollover. The
reported ISO input stays labelled as reported; source wording is preserved.
Qualification/procedure/confirmation edits clear dependent timing. Visa edits
retain qualification evidence; mission context remains independently pruned.

Only `aps_confirmed_submission_day` and `aps_submission_confirmation` are new
rule keys. The latter is `confirmed` only for a valid relevant date, otherwise
`unknown`. Legacy `aps_application_day` stays unsupported: the authorized public
record uses YYYYMMDD `< 20260315`, but enabling it would silently activate an old
published interpretation. Registration, payment, shipment and receipt are never
aliases. UP-ELIG-07 may reuse the calendar helper for **separate** completed
registration and complete-document dispatch facts; no dMAT behavior is added.

Evidence checked 2026-10-07: [APS News](https://aps-india.de/news/) (23 February
and 16 March notices), [APS FAQ](https://aps-india.de/faqs/), and
[DAAD India](https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/).
APS protects assessments submitted before 15 March 2026, applies updated
admission criteria from Winter Semester 2026/27, and preserves issued certificates.
Its wording does not equate submission with registration or courier dispatch.
DAAD's general route guidance does not replace this dated transition notice.
The root backlog's registration/application/submission wording is narrowed to
APS-confirmed complete submission; the earlier analysis's proposed additional
milestones are deliberately not collected.

Three `aps-transition-*` candidates remain **drafts**, carrying literal quotes,
review date, explicit issuer/curriculum/board/route/intake applicability and
cutoffs in rule data. Disposable published copies test before/on/after and
uncertain timing. Pre-cutoff yields `unknown`, not a 65% exemption. On/after
tests the current Class XII criterion for the two stated routes; missing timing
asks whether APS confirms the relevant complete submission. No admission route
is invented for missing intake/prerequisites or another qualification. Existing
APS scope resolution, fulfilment, stable task keys and persistence are unchanged.
There is no migration, DB publication, seed or KB rebuild in this change.

### 2. Course import & review

1. A user pastes a course URL, programme/university identity and the page's
   Ctrl+A text into the add-course sheet → `POST /api/courses/import`.
   DAAD's hidden tabs are not included by Ctrl+A: the sheet instructs users
   to append the overview, requirements and fees tabs. The deterministic
   parser supports both legacy and current labels, preserves complete
   source sections, and stops at contact/footer boundaries.
2. `normalizeUrl` canonicalizes DAAD language variants to one URL for
   dedupe. An existing course is linked to the user's dashboard instead of
   re-imported; a colliding pending import from another user surfaces as
   409 via the unique index.
3. Research runs even for a completely parsed paste. The DAAD parser provides
   manual fallback, never a completeness decision. `lib/ai/research-course.ts`
   uses the existing Tavily HTTP API and configured OpenRouter extraction model
   in a fixed workflow (three searches, at most three extraction batches, one
   structured generation, no retries, 90-second total abort). Search begins on
   DAAD/uni-assist; a retrieved DAAD page matching both identity labels may
   endorse university/application website links on German domains. Pasted links,
   arbitrary search hits and model URLs cannot expand that allowlist. Restricted
   extraction follows official programme/regulations/PDF links, keeping at most
   12 observations of 20,000 characters each; provider JSON is byte-bounded.
   Full pasted text (up to 200,000 characters) is retained for manual recovery.
4. Pure `lib/courses/research.ts` validates every model URL and literal quote
   against retrieved observations, programme identity, source scope and applicant
   wording. An effective intake needs explicit source term/year; source retrieval
   is never an intake boundary. Unknown scope retains non-publishable sourced
   captures. Complete scopes contain pending assertions or explicit topic gaps
   (deadline, route, prerequisites, language/exemptions, tuition/semester fee,
   documents/application link). Competing assertions remain unresolved with all
   alternatives. Shape/literal checks establish fidelity, not semantic correctness.
   Model reviewer/status/date metadata is rejected. Web/AI failure retains manual
   values and a visible incomplete status; no error bodies or credentials are logged.
5. The draft lives under `courses.field_extraction.research` with format
   `up-course-01/v1`, alongside legacy provenance. Import uses only the caller's
   course insert permission; catalogue writes remain admin-only. Saving legacy
   manual edits preserves research. Both old approve and keep-update paths reject
   research drafts (including malformed captures); approved research courses cannot
   acquire new assertions through the legacy edit helper.
6. Minimal review in the admin queue shows wording, applicability, retrieval time,
   official URL, conflicts and gaps. The reviewer explicitly checks current primary
   sources and selects accepted supported facts. Unselected/conflicting facts remain
   unresolved, and normalized dates stay null. `publishAdminCourseResearch` validates
   all selections before writes, reuses canonical programme/offering identities and
   appends pending and reviewed snapshots with the authenticated reviewer's metadata.
   A new legacy course publishes only its identity; broad unreviewed requirements,
   fees and deadlines are cleared rather than entering legacy task planning. Existing
   tasks and definitions are untouched. Research updates publish scoped versions
   against the original course, then the existing reject-update RPC merges the
   submitter's tracking link without replacing original facts or student progress.
   Public course pages read the latest reviewed snapshot per offering and cite its
   evidence; unresolved assertions never receive a reviewed label.
   Trade-off: publication spans multiple caller-scoped requests. Partial failure
   can expose only the course identity before a reviewed version finishes; retry
   reuses linked scopes and preserves append-only history. No service escalation,
   migration, backfill or automatic task integration is introduced. COURSE03 will
   extend this same draft format/review boundary with field editing and conflict
   resolution; it should not invent a second review contract.
   A small JSON recovery editor allows admins to repair pending captures and
   source-supported scope after web/AI failure. New human-entered observations
   are labelled `manual`, and newly supplied `web` captures are relabelled server-side.
   Source/identity/intake/literal checks apply to manual recovery too. Saving neither
   supplies reviewer metadata nor publishes; the explicit acceptance step remains
   mandatory. Conflict acceptance requires an explicit pending repair/resolution.
7. New imports land as `pending` and are visible only to their importer
   until an admin approves them in `/admin`. "The page changed" submissions
   carry `conflicts_with` and get a side-by-side resolution UI backed by
   the atomic `resolve_course_conflict` DB function.
   Resolution preserves the original course identity and application progress.
   Adopting an update replaces its facts, merges duplicate tracking links while
   retaining personal reminders, and publishes reviewed task definitions.
   Existing source-task snapshots remain available for explicit source adoption;
   completed tasks and student edits survive reconciliation.

### 3. Tasks: generate → materialize → view

The task pipeline is split into three modules under `lib/tasks/` with a
strict direction of data flow:

- **`generate.ts` + `course-tasks.ts` (pure)** — turns an engine result into
  global tasks and turns approved course-task definitions into per-university
  assignments (`app:<id>:course-task:<definition-id>`). The candidate helper
  derives the initial submission/requirement definitions from verbatim course
  facts; admins may edit, add, order, or retire every task. It also owns
  deadline parsing (`selectSubmissionDeadline` picks the line matching the
  user's intake without inventing dates) and Now/Next/Later bucketing.
- **`materialize.ts` (write)** — runs at event time (profile saved, result
  claimed, course added, status changed), never during render. Each key is
  inserted once: `newGeneratedTaskRows` filters out keys the user already has,
  because `upsertGeneratedTasks` conflicts on `(user_id, task_key)` and an
  unfiltered row would overwrite a student's edited title and date.
  Admin edits fan out separately through `syncAdminCourseTaskDefinitions`,
  using the same intake-aware generator. Untouched copies update immediately;
  student-edited copies keep their values and become an explicit “use admin /
  keep mine” decision. Never touches `done` or `preferred_bucket`. That sync
  is deliberately non-transactional — every write is idempotent and keyed, so
  a partial failure converges on the next admin save; the deadline parsing
  must not be duplicated into SQL.
- **`view.ts` (read)** — builds the dashboard view model: buckets (user's
  dragged `preferred_bucket` wins over computed buckets), the applications
  rail, calendar events, and the next deadline. Pending course tasks are shown
  only for planning applications. Applied, admitted and rejected applications
  hide those pending tasks without deleting them; completed and manual tasks
  remain visible, and returning to planning restores pending tasks. Generation
  also runs only for planning applications. Strictly read-only.

Deadlines are always *displayed* verbatim (`verbatim_due`); parsed ISO dates
are used only for sorting, bucketing, and calendar dots.

### 4. The assistant (strict RAG)

`POST /api/assistant/chat` → auth → zod → daily quota (20/user/day, UTC
reset) → log the question (aborted streams still count) → `runAssistant`
(`lib/ai/assistant.ts`).

Only user/assistant roles and validated text parts are accepted from the
browser. Client-supplied system prompts are rejected and tool-result parts are
discarded; tool evidence is obtained on the server. The prompt requires source
dates, fees and requirements verbatim and derives coverage from retrieved
evidence rather than blanket country claims. Prompt compliance still needs a
successful live assistant evaluation; it is not guaranteed by unit tests.

- Three tools: `search_rules` (embed the query, pgvector `match_kb_chunks`),
  `get_user_context` (profile + applications + tasks via the user's own
  RLS-scoped client), `web_search` (Tavily, official German domains first,
  everything flagged unverified; degrades honestly without an API key).
- The system prompt enforces the contract: answer **only** from tool
  results; every claim ends with `[[rule:slug]]` or `[[web:url]]`; no
  coverage → `[[unknown]]` plus the official source. Refusing to guess is
  success.
- Markers (`lib/ai/markers.ts`, pure) are stripped for display and rendered
  as verified stamps / unverified chips / "not in our rules" blocks by
  `components/app/assistant-sidebar.tsx`; on finish they are parsed and
  logged to `assistant_messages`.
- The KB is rebuilt wholesale by `pnpm kb:embed`: published rules are
  rendered to readable chunks (`lib/ai/kb.ts`) and merged with curated
  snippets from `scripts/kb.snippets.ts`. Replacement vectors are upserted before
  stale rows are removed, so a failed write retains the previous corpus.
  Rerun it after rule changes.
- `pnpm eval:assistant` runs a 20-question adversarial eval (invented-fact
  traps, out-of-scope traps, personal context) and fails on any uncited
  claim.

### 5. Auth & authorization

- `proxy.ts` (middleware) runs **only** on `/dashboard`, `/profile`,
  `/courses` and `/admin` (`config.matcher`) — everything else, including
  `/api/*` and the anonymous checker, skips it entirely. On those routes it
  refreshes the Supabase session, redirects signed-out users to `/login`, and
  requires the admin role for `/admin`. It uses `getClaims()`, which verifies
  the JWT locally against the project's asymmetric signing keys rather than
  calling the auth server.
- Pages and server actions re-check with `requireUser()` /
  `requireAdmin()` from `lib/auth/session.ts` (defense in depth — the
  middleware is a convenience redirect, not the security boundary). These
  deliberately keep `getUser()`: a locally-verified token stays valid until
  `exp`, so a banned or deleted user would otherwise keep access for the rest
  of the token lifetime.
- `isAdminRole` (`lib/auth/roles.ts`) is the single `app_metadata.role`
  predicate — the same claim `public.is_admin()` reads.
- API routes answer 401/403 JSON themselves.
- All login flows (`/login`) run client-side against Supabase auth:
  password, signup with email confirmation, magic link, Google OAuth, and
  password recovery. Redirect targets are laundered through
  `safeNextPath()` so `next=` can never become an open redirect.
- The real boundary is RLS: every table has policies; admin writes hinge on
  the `is_admin()` SQL helper reading the JWT claim. Policy convention: wrap
  helper calls in a subquery — `(select public.is_admin())`, `(select
  auth.uid())` — so the planner caches them as an InitPlan instead of
  re-evaluating per row.

## Data model

Schema lives in `supabase/migrations/` (append-only). Regenerate types with
`pnpm db:types` after pushing a migration. Summary:

| Table | What it is | Access |
| --- | --- | --- |
| `rules` | the eligibility engine's source of truth | public read except drafts; admin write |
| `courses` | extracted course facts, verbatim; `normalized_url` dedupe key; `conflicts_with` marks update submissions; `review_status` pending/approved/rejected; `imported_by` records who submitted a pending import | approved public; importers see own pending |
| `profiles` | one per user: the checker `answers` jsonb (everything else — country, board, engine profile — is derived from it) | owner CRUD, admin read |
| `applications` | user × course with status — THE dashboard link | owner CRUD |
| `tasks` | rule-generated, admin-defined course-task assignments, and manual tasks; unique `(user_id, task_key)` makes reconciliation work | owner CRUD; admins reach only rows with a `course_task_definition_id`, never a student's manual or rule tasks |
| `course_task_definitions` | ordered admin definitions for every course submission/requirement/custom task; pending-course definitions publish on approval. Official-source changes are shown as a live diff in the admin tasks view (no stored review queue) and student tasks only change when an admin acts | approved public read, admin write |
| `checks` | answers + historical stored result; current result re-evaluated on read; ownership columns private | dedicated server writer; UUID-scoped public read through `get_shared_check`, no browser table reads/writes |
| `kb_chunks` | assistant corpus with pgvector embeddings; `match_kb_chunks()` does exact cosine scan (fine below ~10k rows) | public read, admin write |
| `assistant_messages` | full Q&A log; today's `role='user'` count is the quota | owner insert/read, admin read |
| `answer_reports` | assistant-answer feedback | authenticated insert, owner/admin read |
| `admin_audit_events` | append-only audit of rule/course updates, written by a DB trigger regardless of UI path | admin read |

DB functions worth knowing: `get_shared_check` (UUID-scoped public projection),
`claim_check` (atomic anonymous-result claim),
`result_viewer` (who is looking at a result), `remove_my_course` (detach
approved / delete own pending), `resolve_course_conflict` (atomic
keep-old/keep-new), `match_kb_chunks` (semantic search), `is_admin`.

## Testing

- `pnpm test` runs everything. Pure modules have exhaustive unit tests;
  `lib/engine/__tests__/personas.ts` holds the 13 verified student personas
  shared between engine and checker tests.
- `lib/db/__tests__/rls.integration.test.ts` asserts anon/owner/admin
  visibility against the real linked Supabase project. It self-skips (with a
  console warning) when env keys are missing, the schema is behind, or the
  secret key cannot use the auth admin API — so `pnpm test` is green in any
  environment.
- Before merging: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`.

## Where to make common changes

| You want to… | Touch |
| --- | --- |
| Add/edit an eligibility rule | `/admin` UI (data change, no deploy); new *candidates* go in `scripts/rules.bootstrap.ts` and are seeded as drafts |
| Support a new fact in rules | `FactKeySchema` + `deriveFacts` in `lib/engine/evaluate.ts`, label in `lib/ai/kb.ts`, tests in `lib/engine/__tests__/` |
| Add a checker question | `StepId`, `AnswersSchema`, `visibleSteps`, `buildProfile` in `app/(public)/check/steps.ts`; copy in `check-questions.ts`; label in `profile-review.tsx`; tests in `steps.test.ts` |
| Add a GCE/IB subject | `GCE_SUBJECTS` / `IB_SUBJECTS` in `app/(public)/check/steps.ts` — both editors and `buildProfile` read the catalog |
| Add a country or school board | `COUNTRIES` / `BOARDS` in `app/(public)/check/steps.ts` — the checker options, admin rule filter, and result labels all read these catalogs |
| Publish a seeded rule | `/admin?view=rules`. `pnpm db:seed` writes every bootstrap candidate as a **draft** and the engine skips drafts, so a newly seeded rule changes nothing until a human publishes it |
| Change dashboard task texts/buckets | `lib/tasks/generate.ts` (+ its tests) |
| Add a DB query | `lib/db/queries.ts` (user) or `admin-queries.ts` (admin) |
| Change the schema | new file in `supabase/migrations/` → `supabase db push` → `pnpm db:types` → RLS test |
| Change assistant behavior | prompt/tools in `lib/ai/assistant.ts`; rerun `pnpm eval:assistant` |
| Add course-page research support | `lib/ai/research-course.ts` for I/O, `lib/courses/research.ts` for evidence/scope decisions; DAAD parser is manual fallback |
| Add an env var | `lib/env.ts` schemas + `runtimeEnv` + `.env.example` |

### Additive programme catalogue (UP-COURSE-02)

`lib/courses/offerings.ts` contains pure zod contracts. `programmes` holds a
canonical identity, optionally linked to an existing `courses.id`.
`course_offerings` scopes facts by explicit term/year, applicant group and
applicability. `course_offering_versions` holds immutable snapshots with stable
field keys for routes, deadlines, languages, prerequisites, fees and documents.
Each field carries its own review state, verbatim wording, applicability and
multiple evidence captures (exact URL/quote, retrieval, optional source hash,
verification timestamp/reviewer). Intake scope is immutable; no profile preference
or legacy import timestamp supplies a missing intake or verification date.

The route contract is `direct | uni_assist | vpd_then_university | unresolved`.
Normalized deadline dates/times are allowed only on verified fields; timezone
remains null if the source does not specify it. Preparation targets are separately
labelled and are not application closing dates. Evidence substring checks establish
capture fidelity, not official authenticity; provenance and interpretation require
human review. Identity labels on programmes are catalogue labels, not eligibility
claims. Reviewed facts belong to the version snapshot.

Catalogue writes require an admin-scoped client. Public RLS exposes only verified
versions and scopes with verified versions. A public version can contain verified
or explicitly unresolved fields, never pending/rejected research. Pending research
is admin-only; fact corrections and review decisions append a new version rather than
mutating history. Query helpers return all reviewed history newest first, leaving
version selection explicit. UP-COURSE-01 integrates research import, explicit
review/publication and public reading; automatic task integration and backfill
remain absent, and existing course/application/task identities stay intact.

Programme labels (name, institution, degree, source URL) can be corrected by an
admin on the same canonical ID. The database freezes the ID, established legacy
course link and creation time, and records meaningful corrections with the actor and before/after
values in the existing admin audit stream. No-op updates create no audit noise.
Corrections neither change offering scope nor elevate evidence/review status.
Offering scopes and version snapshots remain immutable. Catalogue query helpers
use the same generated `Database` client contract as other queries. The types in
`lib/db/database.types.ts` were generated against the disposable local schema
after both catalogue migrations were applied; no hand-authored extension remains.
`supabase/tests/course_offerings.sql` is a transactional disposable-only gate.

Additive migration `20261006000101_course_offering_integrity.sql` binds every new
verified evidence capture to the authenticated admin reviewer. Carry-forward keeps
the original reviewer only when an earlier immutable reviewed version of the same
offering contains exactly that capture and unchanged field interpretation/scope,
and that earlier version was attested by the capture's reviewer. Changed captures
or interpretations require the current reviewer to attest a new capture. Neither
pending AI captures nor a source URL establishes verification. Normalized dates
still require semantic human review; shape/literal checks cannot prove their meaning.

Research programmes may start with a null legacy link. After a legacy course is
approved and is not a conflict submission, `attachAdminProgrammeLegacyCourse`
attaches it once on the same programme ID; replacement/detachment is forbidden.
Publication integration can approve the legacy course, attach once, then append a
reviewed version. UP-COURSE-01 uses that lifecycle through caller-scoped helpers. Linked
courses must remain approved/non-conflict, while unmapped pending/conflict rows
remain removable through existing operations. Existing applications and task values
are never rewritten by either catalogue migration.

SQL and TypeScript share a deliberately narrow source URL grammar: lowercase
HTTP(S) scheme, ASCII DNS labels (host length at most 253), optional decimal port
1–65535, printable ASCII path/query/fragment, no credentials, IP literals or
backslashes. Accepted URLs are stored and returned verbatim, including case,
explicit ports, query and fragment. Other URL forms require an explicit contract
extension, not silent normalization. New SQL URL CHECKs are NOT VALID so any
pre-existing malformed historical captures survive for explicit review; new writes
must satisfy the contract and reads validate it. No old evidence is fabricated or
silently changed.

Additive migration `20261006000102_course_capture_validation.sql` aligns SQL
nonblank text with JavaScript trim whitespace and capture timestamps with the
strict read contract: real calendar dates, hours 00–23, minutes/seconds 00–59,
years 0001–9999 and numeric offsets up to 15:59. Optional seconds and fractional
precision remain verbatim. New checks are NOT VALID to preserve existing captures
for explicit review; they reject new unreadable records without rewriting history.

Additive migration `20261006000103_course_capture_reviewer_uuid.sql` replaces
the existing capture validator body to require hyphenated reviewer UUID strings,
accepting either hex case verbatim. PostgreSQL's compact/braced UUID spellings
are rejected in captured JSON. Timestamp offsets require an explicit colon in
both SQL and TypeScript; compact offsets cannot bypass the 15:59 limit.
Reviewer binding, exact historical carry-forward and existing captures are unchanged.

Additive migration `20261006000104_course_evidence_chronology.sql` aligns evidence
chronology with JavaScript's millisecond comparison. SQL truncates fractional
digits beyond three in comparison operands before timestamp casting, preventing
PostgreSQL rounding from changing equality or carrying into the next second/day.
Captured strings retain all source precision verbatim; timezone offsets still
compare instants, and verification before retrieval remains forbidden.

Additive migration `20261006000105_course_applicability_keys.sql` and the Zod
record key boundary reject `__proto__`, which record parsing would silently drop.
Other map keys, including `constructor` and `toString`, remain ordinary properties;
empty maps, booleans, arrays and verbatim strings retain the existing contract.
No existing applicability map is rewritten or given an inferred vocabulary.

### COURSE01 / PROC01 interface

The shared payload remains `OfferingFactSchema`; no catalogue schema change.
Missing or unsupported nonnull model scope uses the same unscoped recovery path:
only literal fact wording from retrieved official identity pages or their actually
captured link chain survives. Model intake/applicant assertions are discarded, with
explicit unresolved applicability, pending status and no planning/reviewer metadata.
Unlinked sources and invented wording do not survive recovery; an empty recovery
reports that no capture matched evidence. Recovery validation enforces this provenance
and unknown label. Publication requires a captured valid offering scope and cannot
publish an unscoped-only draft even with an empty acceptance selection. The existing
strict offering/review/conflict guards remain the boundary when a human repairs scope.
Manual recovery and publication validate the same captured applicability boundary:
`source_scope` must equal the actual offering scope quote, every field's applicant
label must equal the offering label, and its evidence must carry that captured
identity/intake/group context or be explicitly linked from the captured scope page.
Legacy keep-update resolution checks both incoming and canonical research markers;
it cannot replace a research canonical record through the old task-sync workflow.
Known source-named language instruments (IELTS, TOEFL, TestDaF, DSH, Cambridge,
CEFR) identify independent semantic requirements regardless of model field labels.
Combined assertions participate in each named instrument identity: an IELTS/TOEFL
assertion overlaps a separate IELTS assertion. Different verbatim assertions with
overlapping instruments require unresolved conflict review; no score parsing or
equivalence is invented. Disjoint instruments and identical wording remain valid.
Unknown instrument wording is conservatively grouped for review. Initial generation,
manual recovery and publication enforce the same overlap decisions.
Competing wording for the same instrument is unresolved; distinct instruments remain
separate alternatives. Recovery cannot insert opposing pending semantic assertions.
Route, stage/deadline, explicit language exemptions, tuition and semester-fee wording
also receive semantic conflict identities; unrelated document/prerequisite labels
remain separate captures rather than conflating all requirements into one field.

Bounded retrieval deduplicates fragment/trailing-slash source variants while keeping
the actually returned source URL and literal captured text. Retrieved DAAD identity
mismatches are excluded from applicable evidence. Admission/application/regulation/PDF
links rank before generic home/living/career navigation; current fees follow those
consequential sources. DAAD's topical literal angle-bracket links can establish a
university domain through the same retrieved programme identity boundary. The model
receives retrieved web observations and identity, without duplicating the full paste;
paste remains available in manual recovery. The existing 20,000-character source
capture cap now reports any omitted text explicitly as unresolved rather than hiding
the truncation. Shared 90-second budget, provider/model and SDK remain unchanged.
Sanitized failure categories report timeout or invalid/unavailable response, never
provider bodies or keys. Real provider acceptance still requires root's clean smoke.
The configured `nvidia/nemotron-3.5-lightning:free` import uses the existing SDK's
`generateText` with one forced native `submit_research` tool, strict
`ResearchOutputSchema` input and no execute handler or agent loop. Its supported
OpenRouter setting disables reasoning through `extraBody.reasoning.enabled: false`;
no response-format request is sent. Exactly one valid tool submission is required
before the existing literal observation/provenance checks build a pending draft.
The 6,000-token output cap favors a rich partial draft over exhaustive prose within
the unchanged shared 90-second limit. Missing, wrong, malformed or truncated tool
output retains explicit incomplete/manual recovery. Root's same-model diagnostic
established native-tool capability, not full-workflow operational acceptance.
Reviewed routes use kind `route` and its typed route value. Portal facts use kind
`description`, literal HTTPS portal URL as `verbatim`, and exact keys
`application_link:university`, `application_link:vpd`, `application_link:uniassist`.
Source URLs identify evidence pages and must never be substituted for portal URLs.
Deadline keys are `deadline:<stage>:<deadline_kind>` with those same three stages
and the existing typed deadline semantics. A VPD preparation target is not an
official application closing date. Different stages do not create false conflicts.
Generic or unsupported stage captures cannot be accepted through publication;
they remain unresolved unless manual correction supplies captured literal stage
evidence. Current conservative wording checks admit explicit university application,
VPD/Vorprüfungsdokumentation, or uni-assist application wording; unfamiliar wording
requires manual source capture and remains unknown if still unsupported.

Consumers must select a specific offering (programme, effective term/year and
literal applicant group), then consume only verified fields from a reviewed
version. `applicability.source_scope` retains the actual scope quote; applicant
groups are literal labels, not an implemented resolver vocabulary. Neither fuzzy
descriptions nor global profile intake establish application context. Dates remain
unnormalized in COURSE01. PROC01 planning must preserve unknown dates and stages.

Current `applications` persist only `course_id`, not an offering selection. Durable
per-application offering context therefore needs a separately reserved, reviewed
persistence change in PROC01 (for example an optional offering reference, with
version selection policy decided there). This is a proposal only: no migration,
application/task changes or PROC01 implementation belongs to COURSE01.

### Scoped APS contract (UP-ELIG-05)

APS qualification recognition, application documentation and visa checklist status
resolve independently through validated `outcomes.aps_scopes`. Each scope has
required/not_required/unknown; only visa also permits not_listed. Equal-specificity
disagreement resolves to unknown with both citations before documents and steps
are projected. A single certificate document is deduplicated across scopes.
The legacy APS scalar is only a conservative required/unknown summary; old
unscoped rows cannot establish requirements or any global exemption. Old
free-text APS documents/steps are suppressed until admin scope review.

New checker flows use `apsScopeVersion: 1` and explicitly ask bachelor issuing
qualification country/context, confirmed uni-assist application context and, for
Saudi filing, whether the responsible mission's study checklist applies. Neither
citizenship, school attendance country, board nor visa country infers an issuer.
Master's facts use only the merged `tertiaryQualification` issuer/country/context.
Missing, international or unknown context stays unknown under these candidates.
No Riyadh/Jeddah or residence-to-mission inference is introduced.

Certificate-held state remains separate from requirement existence. Changing
visa preserves the answer. Acquisition steps require an explicit missing
certificate; held/unknown answers do not create acquisition work. Generated task
keys retain `rule:<ruleId>:step:<order>`. Read projection hides obsolete pending
generated APS tasks while preserving completed history and manual/course tasks.
The real rule UUID is extracted from the stable task key, independent of editable
titles; no removed source-rule column is assumed. No saved task,
personal edit, application or completion row is rewritten or deleted.

Four source-backed candidates remain drafts in bootstrap data. Human admin
review/publication is required; no seed, KB rebuild or live publication runs in
this change. Source verification dates 2026-10-06/07 are not intake boundaries.
KMK's 2006 resolution as amended 2015 supports first-study recognition only;
uni-assist India supports both application requirement and certificate preparation
candidates. The Saudi candidate preserves an academic checklist excerpt and an
explicit full-list omission observation separately from the additional-request
warning; no source statement of exemption is invented. APS FAQ exceptions
require applicable facts and source confirmation, not inferred exemptions.
The Saudi checklist omission means not_listed and permits additional requests.
JSON additions need no migration or generated database type change.

### dMAT previous-qualification contract (UP-ELIG-07)

New checker flows use `dmatVersion: 1` and progressively collect a reported
previous-degree title/branch and classification basis only for master's profiles
with an explicitly named Indian national tertiary issuer. Neither nationality,
visa destination nor the target master's field classifies a previous degree.
The version 1.0 affected-fields PDF (29 June 2026) is non-exhaustive. Reported
clear list-group classification records its entry, version and exact source URL;
an APS classification records its decision and confirmation reference. Raw titles,
missing classification, mixed titles and multiple qualifications remain unknown
and point to targeted APS review. These reports do not independently verify facts.

Relevant completed APS procedure and certificate possession are separate facts.
An old certificate alone cannot establish an exemption for a new or unknown
procedure. Completed online registration and complete-document dispatch are
separate June events, using `CalendarDateSchema` and `calendarDay`; neither is
aliased to the March APS-confirmed complete-submission event, payment or receipt.
Rule data uses strict `< 20260629` boundaries. Incomplete/unknown shipment cannot
exempt; later receipt does not erase a complete pre-boundary dispatch. Explicit
not-completed/not-sent reports need no invented date. Partnership confirmation
records issuer role/name, programme kind, group number and reference; pending or
unknown reports cannot establish it. Enrolled bachelor exceptions use reported
actual completed semesters, never completed years multiplied by two.
The partial draft schema retains finite semester numbers, including unfinished
fractions or out-of-range entries, so reload does not discard valid history.
Completed answers, profile validation and fact derivation still require integer
semesters from 0 through 100; invalid drafts keep the result action disabled.
An unknown initial/new procedure still collects independent confirmed partnership,
APS-confirmed unaffected classification and applicable actual-semester evidence.
Procedure edits reset registration/dispatch reports while preserving those
qualification/programme facts; a relevant completed procedure retains its shortcut.
The multiple/unknown-qualification review candidate applies from SS2027 onward,
so qualification uncertainty cannot defeat the earlier-intake exemption.

Changing issuer/history, degree, procedure or classification prunes dependent
answers; passport/visa changes preserve these reports. Legacy answers/results
remain readable. The legacy certificate-only harness input is unchanged but now
expects unknown; a separate relevant-completed-procedure case tests the exemption.
The previously future affected-field case executes against disposable copies of
reviewed candidates. Parent TEST coverage remains OPEN. Existing generated task
IDs and manual/completed progress receive no storage or task-generation changes.

Thirty-four source-backed bootstrap candidates remain DRAFT, including the
pre-Summer-2027 boundary and explicit positive/exception conditions. Intake,
semester and date policy stays in reviewed data. No seed, publication or embedding
runs here; production classification depends on separate admin review/publication.
Newly rendered KB chunks suppress the obsolete certificate-possession exemption
and label its quote as historical evidence rather than current applicability.
Runtime `search_rules` now projects persisted dMAT matches through the pure
`projectDmatKbMatches(matches, publishedRules)` interface in `lib/ai/kb-retrieval.ts`.
Matches are raw RPC rows; rule rows are caller-visible current published metadata
from the existing `getPublishedRules` helper, or null if unavailable. Zod validates
both boundaries. Scoped dMAT matches use structured outcomes, exact source identity
and stable slugs, never arbitrary-text matching. Valid beta/verified rule metadata
is rendered with `ruleToChunk`; certificate-only applicability is quarantined
across dMAT outcomes, including unknown, and its historical quote/note is withheld
from model evidence. Other outcomes
and source URLs/current supplied verification dates are retained. Missing, invalid,
unpublished or ambiguous metadata yields unknown with no invented verification date.
The stable `snippet-dmat-details` is always quarantined as unknown because this
interface has no trusted structured snippet metadata, even after a rebuild.
Rule matches cannot prove unrelatedness without valid matching current metadata;
unmatched or invalid rules fail closed even under renamed slugs/other source URLs.
Valid current unrelated rules and unrelated curated snippets are unchanged.
RULES01 can reuse this projection boundary;
broader freshness and snippet-authority policy are explicitly outside its scope.
No persisted chunks are rewritten/deleted, and no embedding/publication runs. dMAT
neither replaces APS nor guarantees recognition/admission; a low score alone is
not an APS refusal. The current APS clarification permits other complete documents
before the dMAT certificate. Source checks dated 2026-10-07 are verification dates,
not policy cutoffs. No database migration or generated type change is required.

### Bounded import model context

Captured observations remain unchanged for literal evidence validation and manual
review. The model receives at most four official identity-linked sources and
16,000 characters of literal excerpts (4,000 per source, 2,000 per excerpt).
Identity and admission/intake/language/fee/document paragraphs rank before navigation
and unrelated prose; unrelated search-only sources do not consume model context.
Excerpts are actual substrings, not rewritten summaries or inferred applicability.
Omitted sources/text are disclosed; unknown effective scope remains unknown. Quotes
must come from one excerpt and are still checked against original observations.
This intentionally favors a useful partial multi-source draft over exhaustive
research within the unchanged 90-second bound. Provider latency remains a root-owned
real-workflow acceptance gate. Offering-free publication messaging now correctly
requires captured intake/applicant scope before publication.

### Omission reconciliation and combined fee conflicts

Omitted substantive captured text cannot silently turn a surviving AI assertion into
a verified fact. The review guard recomputes omissions from original captures (also
for manual recovery); draft status, issue strings and client flags cannot bypass it.
Each selected field requires a separate authenticated admin reconciliation checkbox
and rationale after comparing the full captured sources and actual applicability.
Unselected fields remain unresolved. Separator whitespace alone is not a substantive
omission. Known model conflicts still require correction and cannot be overridden by
this decision. No contradiction is inferred automatically from raw source wording.

The caller-scoped publication helper validates all decisions before mutation and
binds new reviewer/time values from the authenticated action. However, the current
research_reconciliations array resides in caller-editable course metadata: sibling
entries cannot be authenticated by UUID/schema validation or by appending an admin
record. This array is untrusted provenance, and trusted-history acceptance remains
blocked pending the root-reviewed additive audit proposal in the issue handoff.
The existing admin_audit_events journal is protected by RLS but has no suitable
reconciliation payload column; programme_correction cannot be repurposed. No
migration is written/applied in this repair. Original entries/full captures must
remain available as explicitly untrusted data; future trusted decisions belong in
the protected journal with DB-authenticated actor/time and offering/version links.
The canonical research marker still guards legacy courses against generic replacement.
Manual JSON recovery retains original non-paste captures so omission provenance cannot
be erased. The existing capture-count limit may reject a repair that exceeds capacity;
it never silently discards historical text. No generated types or applied migrations
are changed by the conflict repair.

Combined fee wording participates in both tuition and semester-fee identities.
Overlapping differing assertions stay unresolved during build, stored-draft validation
and review, while disjoint fees and identical quoted duplicates remain valid. Stored
pending fields are also checked against every retained conflict alternative semantic
identity in their offering, regardless of keys. An alias of even one literal
alternative cannot become verified while that known conflict remains unresolved;
omission reconciliation is not conflict resolution. Conflict records must retain
their unresolved field and captured, applicant-scoped alternatives. Separate captured
applicant offerings and unrelated semantic fields remain independent.
No amounts, equivalences, dates or applicability are parsed/invented to settle a conflict.
Native provider settings, timeout, retries and model context budget are unchanged.
