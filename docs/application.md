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
  ├─ courses/     URL normalization + deterministic DAAD parser
  ├─ ai/          assistant, KB rendering, extraction fallback, markers
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
   the board; GCE collects per-subject rows through `SubjectRowsEditor`; IB uses its own
   evidence editor and the pure reviewed catalog in `lib/engine/ib.ts`. New IB
   answers distinguish Diploma award / official IBO results with paper pending
   from not awarded, Certificate only and unknown, collecting applicable
   subject and examination evidence only for the first two; the existing-APS
   answer stays independent of visa filing in new/edited APS-versioned flows;
   pre-scope Saudi checks remain readable without inventing an answer. Steps
   rendered as a number input are listed in `NUMBER_STEPS` with their bounds.
2. Submit (`submitCheck` server action) zod-validates the answers, evaluates
   with one server UTC instant against applicable immutable versions, and inserts a `checks` row through the dedicated
   server-only check writer → redirect to
   `/result/[id]`.
3. Ownership: anonymous submitters get a random token in an HttpOnly cookie;
   only its SHA-256 hash is stored (`lib/checks/ownership.ts`). Signed-in
   submitters skip tokens — their profile is upserted and dashboard tasks
   are materialized immediately.
4. `/result/[id]` is public to anyone holding the UUID. `get_shared_check`
   returns only that UUID's shareable columns; table collection reads and
   browser writes are forbidden. The page validates stored answers and
   displays the original protected server assessment with exact immutable inputs.
   A separate current reassessment uses the same validated saved answers and a new
   server instant. NULL/malformed provenance or missing exact references yields
   original provenance unavailable; legacy verdict JSON is never promoted. Original
   answers/result/history are never rewritten. Sharing still exposes answers to UUID holders; consent,
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

1. A user pastes a course URL (plus the page's Ctrl+A text — the server
   never fetches external pages) into the add-course sheet → `POST
   /api/courses/import`.
   DAAD's hidden tabs are not included by Ctrl+A: the sheet instructs users
   to append the overview, requirements and fees tabs. The deterministic
   parser supports both legacy and current labels, preserves complete
   source sections, and stops at contact/footer boundaries.
2. `normalizeUrl` canonicalizes DAAD language variants to one URL for
   dedupe. An existing course is linked to the user's dashboard instead of
   re-imported; a colliding pending import from another user surfaces as
   409 via the unique index.
3. Extraction: the deterministic DAAD label parser
   (`lib/courses/parse-daad.ts`) runs first; the AI fallback
   (`lib/ai/extract-course.ts`) fills only the fields the parser missed,
   with verbatim-quote prompting, zod validation and literal substring checks
   against the pasted source. Unsupported AI values are discarded. Facts are stored
   verbatim — deadlines and tuition are never reformatted.
4. New imports land as `pending` and are visible only to their importer
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
- The KB indexes date-applicable immutable inputs without guessing intake.
  Embeddings are hints keyed by logical rule and version UUID. Retrieval resolves
  stored logical identity in query helpers, selects current applicable versions
  using the saved profile intake, and renders exact raw sources. Remaining selected
  rules are included so scoped/new coverage remains discoverable before rebuild.
  Unversioned snippets are excluded from current rule evidence. Replacement vectors
  are written before stale hints are removed; failed writes retain the old corpus
  but cannot authorize its old prose. No provider operation runs during rendering.
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
| `checks` | immutable answers/result/protected assessment metadata; distinct current reassessment; ownership columns private | dedicated server writer; UUID-scoped public read through `get_shared_check`, no browser table reads/writes |
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
  visibility against the explicitly configured disposable/local Supabase
  service. It self-skips (with a console warning) when required env keys are
  absent. When configured, missing schema/auth/admin/API failures FAIL and must
  not be claimed green — use loopback/disposable isolation before execution and
  run the actual required RLS suite before merge.
- Before merging: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`.

## Where to make common changes

| You want to… | Touch |
| --- | --- |
| Add/edit an eligibility rule | `/admin` UI (data change, no deploy); new *candidates* go in `scripts/rules.bootstrap.ts` and are seeded as drafts |
| Support a new fact in rules | `FactKeySchema` + `deriveFacts` in `lib/engine/evaluate.ts`, label in `lib/ai/kb.ts`, tests in `lib/engine/__tests__/` |
| Add a checker question | `StepId`, `AnswersSchema`, `visibleSteps`, `buildProfile` in `app/(public)/check/steps.ts`; copy in `check-questions.ts`; label in `profile-review.tsx`; tests in `steps.test.ts` |
| Add a GCE/IB subject | `GCE_SUBJECTS` in checker steps / `IB_SUBJECTS` in `lib/engine/ib.ts` — editor and pure profile mapping share reviewed identities |
| Add a country or school board | `COUNTRIES` / `BOARDS` in `app/(public)/check/steps.ts` — the checker options, admin rule filter, and result labels all read these catalogs |
| Publish a seeded rule | `/admin?view=rules`. `pnpm db:seed` writes every bootstrap candidate as a **draft** and the engine skips drafts, so a newly seeded rule changes nothing until a human publishes it |
| Change dashboard task texts/buckets | `lib/tasks/generate.ts` (+ its tests) |
| Add a DB query | `lib/db/queries.ts` (user) or `admin-queries.ts` (admin) |
| Change the schema | new file in `supabase/migrations/` → `supabase db push` → `pnpm db:types` → RLS test |
| Change assistant behavior | prompt/tools in `lib/ai/assistant.ts`; rerun `pnpm eval:assistant` |
| Add course-page extraction support | labels in `lib/courses/parse-daad.ts`; the AI fallback needs no change |
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
version selection explicit. There is no automatic import/task/UI integration,
backfill, publication or change to legacy course/application/task identities.

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
reviewed version. This change implements no publication/AI/UI workflow. Linked
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
At the UP-ELIG-07 checkpoint, `search_rules` projected persisted dMAT matches through the pure
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
The UP-RULES-01 consumer integration below supersedes this checkpoint adapter
with immutable selection for all rules and excludes unversioned snippets. The
legacy projection has no current production caller.
No persisted chunks are rewritten/deleted, and no embedding/publication runs. dMAT
neither replaces APS nor guarantees recognition/admission; a low score alone is
not an APS refusal. The current APS clarification permits other complete documents
before the dMAT certificate. Source checks dated 2026-10-07 are verification dates,
not policy cutoffs. No database migration or generated type change is required.

### Indian Class XII plus successful bachelor study (UP-ELIG-03)

New/restored checker and profile edits carry `indiaStudyRouteVersion: 1`.
Existing qualification history records study mode and applicant-reported official
recognition and target-relationship assessments with nonblank references (up to
500 characters) identifying authority, document/communication and applicable
conclusion. Recognition must cover this institution, bachelor programme and attained
study; relationship must cover this previous field and intended target. Reports are
not app verification. Names, equal field strings, marketing, guessed accreditation
or a Class XII-only APS certificate cannot supply these assessments. Another
programme/target or uncertain basis requires the explicit unknown answer.

The actual national Indian school issuer/context is collected before successful-year
uncertainty; bachelor assessment questions are progressive and relationship follows
target selection. `yearsOfUniversityStudy: null` means successful academic years
cannot be established, only in this versioned India branch; it maps to absent
`completedYears`. Empty values remain incomplete. Finite unfinished/out-of-range
numeric drafts and unfinished reference text survive restoration; complete answers
retain numeric bounds and required applicable references. Duration, degree completion
and enrolment never supply attainment. Ongoing/discontinued successful study remains
usable. Institution, country, type, mode and history edits prune recognition and
relationship; previous field/target edits prune relationship. Academic-basis edits
clear APS timing; timing questions follow recognition and target relationship so
fresh forward answers cannot invalidate an already-passed timing step. Restored
partial edits stop at the first missing assessment and recollect timing afterwards.
Nationality/visa edits preserve academic evidence. Legacy result
reads do not demand new answers.

Only six `in_class12_*` semantic facts become accepted rule keys: prior-study kind,
country, successful bachelor years, mode, reported recognition and reported target
relationship. Missing references yield unknown. Generic study years/recognition/
relationship keys and historical published UUID
`0e872b82-e7fb-41bb-9a35-53ecbe200df4` remain inactive; exact saved metadata is
retained in acceptance fixtures as metadata, not factual proof. No ECTS conversion
or recognition lookup is introduced.

The positive draft in `scripts/india-study.rules.ts` requires national Indian
Class XII, CBSE/CISCE/state board, >=70%, intake index >=4053 (Winter 2026/27),
Indian regular bachelor study, >=1 explicitly successful academic year and reported
applicable official recognition/previous-or-closely-related target assessment with
references. Policy thresholds stay in data. The subject-restricted result labels
reported evidence and university admission discretion. Degree completion and JEE
failure are not prerequisites. Explicit school-only history retains Studienkolleg;
scoped review candidates prevent less-specific legacy school fallback from hiding
failed/missing direct-route prerequisites. Independent JEE stays separate. Foreign
and distance/online study are coverage unknowns, not blanket rejections. Missing
applicability yields targeted unknown; India assessment uncertainty sentinels do
not infer a qualification issuer/context. An explicit unknown actual issuer in
versioned Indian national history remains an issuer diagnostic, including when a
saved legacy school rule matches; known foreign issuers remain isolated. The
validated answers-to-profile boundary preserves the history version for explicit
unknown issuer only in versioned Indian national Class XII/bachelor history. That
diagnostic marker is mapped separately from mode and assessment reports, which
remain hidden/unmapped until the actual Indian issuer is established. Missing
issuer remains incomplete; unversioned and non-Indian contexts are unchanged.

ELIG06 remains separate: below 70%, pre-15-March submission yields transition
unknown; on/after yields the ordinary two-route threshold unmet; missing confirmation
asks for the relevant APS milestone. Certificate possession neither grandfathers
admission nor substitutes for bachelor assessment. Scoped APS requirements and
preparation remain independent of academic access.

Sources rechecked 2026-10-07: [APS News](https://aps-india.de/news/) (23 February
eligibility notice and 16 March attained-qualification clarification),
[DAAD India](https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/),
[uni-assist India](https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/)
and [APS FAQ](https://aps-india.de/faqs/). Verification is not the effective intake:
updated criteria apply from Winter 2026/27; criteria update is 15 March 2026.
Direct DAAD IN-12/IN-1Y records remain unverified; no anabin access workaround was
used. Only the successful-year India FUTURE case now executes accepted coverage
on disposable published copies. CURRENT baselines remain; parent TEST coverage
stays OPEN for other unimplemented families. Candidates remain drafts; no seed,
publication, embedding, migration, provider or live database operation occurs.

### Ordinary GCE witness contract (UP-ELIG-01)

New GCE checker/restored/profile edits carry `gceVersion: 1` and collect actual ascending school years, qualification system (UK/British international versus national), AL/IAL or another certificate type and final/provisional/school-only evidence. No AL-to-12/13-year inference remains. Whole years 0–50 are input sanity bounds, never admission thresholds; low reports reach the exact ordinary-duration diagnostic. Legacy results remain readable with missing evidence, without invented years/context. Nationality, attendance country and visa jurisdiction stay separate.

The pure reviewed catalogue `lib/engine/gce.ts` supplies List A/B/C identities, pairwise exclusions, source URLs and body-specific Marine Science recognition. English/alias ambiguity is conservative. The evaluator enumerates complete three-full-AL witnesses and runs the existing matcher against each; grade/list/independence and all target conditions must pass on the same witness. Extra low or unused vocational subjects cannot invalidate a valid ordinary trio. Non-GCE/process matching and outcome resolution are unchanged. Unknown diagnostics compare published conditions rather than encoding acceptance thresholds in code; their citation claims describe the failed criteria, not the unmatched positive outcome.

Positive GCE records need explicit system/type/evidence/intake scope. Unscoped historical positive records remain available as source-review unknowns rather than silently supplying applicability. Twelve source-reviewed candidates in `scripts/gce.rules.ts` remain drafts, with literal source quotes and null publication metadata. Disposable fixture copies activate the supported GCE acceptance corpus; parent TEST future coverage remains open. Catalogue facts alone cannot establish a path without a published rule.

Science, medicine/pharmacy and arts target groups follow DAAD's named categories. Cambridge's favourable new-formula coverage starts SS2022 and its ordinary transition is SS2024; other bodies are limited to explicit current checker intakes as coverage, not an invented source effective date. National-system, historical, List C programme mapping, Pre-U/AICE/provisional and unclassified-programme variants stay targeted unknowns. See [source verification](up-elig-01-source-verification.md) for applicability, contradictions and authority limits. No migration, publication, seed, KB rebuild, task/application or personal-progress write occurs.

### Immutable rule administration and selection (UP-RULES-01 phase one)

The admin rule workspace reads rule_drafts and immutable rule_versions,
not the rules compatibility mirror. Saving writes only the full raw draft
and applicability bounds, guarded by its displayed revision and raw JSON token.
Database triggers own revision, editor and edit time. Editing keeps draft status;
it does not approve the snapshot. The complete raw JSON editor retains fields
that a projected editor could otherwise omit. Malformed domain conditions may
be saved for repair but cannot be published.

Publication is a separate explicit beta/verified choice and confirmation of the
saved snapshot, literal evidence, source verification date, diff and bounds.
last_verified_at is supplied source verification metadata, never stamped by
save/publication. The protected publish_rule_version RPC receives logical ID,
exact raw snapshot, expected revision and predecessor, and approval status. The
app preflights the actual raw object with EngineRuleSchema before any RPC
mutation. It never replaces the token with a projected rule. Database-owned
reviewer/publication time, immutable successor, audit event and compatibility
mirror are atomic. Reverification appends a successor. Stale tokens prompt
reload and review. Course administration retains its existing helpers.

lib/rules/versioning.ts provides pure boundaries, literal diff, explicit
UTC assessment-instant conversion, selection and impact preview. Date and
intake intervals are half-open. Intake index is year × 2 + summer 0 / winter 1.
Assessment applicability is independent of APS/dMAT applicant event dates.
Selection resolves the newest applicable version per stable logical UUID before
condition matching. Replacement condition failure cannot revive a predecessor
within replacement scope; predecessors remain eligible outside it. Missing
distinguishing intake yields a diagnostic. Human null bounds mean reviewed
unbounded scope. Legacy null bounds remain unknown historical scope; legacy
capture time and stored source dates do not establish human publication.
Selected rules keep logical IDs for citations/task keys; selected version IDs
carry immutable provenance. Invalid applicable publications fail closed without
predecessor fallback. Diffs ignore object key order while retaining array order,
whitespace, literal text, evidence, conditions, outcomes, status and scope.

listRuleVersions in lib/db/queries.ts is an isolated caller-scoped history
reader. It intentionally performs no status/applicability selection. Existing
At this phase-one checkpoint, getPublishedRules behavior was unchanged until phase two moved all consumers
together. previewRuleImpact evaluates only caller-provided before/after
profiles and selected rules; it counts changed assessments and new resolved
outcome coverage, including an assessment with no old match. It performs no
student-data reads, writes, notifications or task reconciliation.

This bounded milestone does not yet make original checks authoritative. The
existing result/current-reassessment behavior described above remains until
phase two wires checker/profile/intake/date paths, server-owned immutable check
metadata/history lookups, original-vs-current display and assistant/KB projection.
Legacy check JSON must not be retrospectively attributed to captured versions.
No publication, embedding, schema application or automatic task/application/
personal-progress update occurs in this code change. Parent UP-RULES-01 remains
open; do not merge the schema write freeze without completed application wiring.

### IB evidence and ordinary recognition (UP-ELIG-02)

New and edited IB bachelor answers carry `ibVersion: 1`; historical answers remain readable without manufacturing subject context. Examination year/session is distinct from target intake. Actual ascending full-time schooling, Diploma evidence, exact subject identity, level, grade, language and continued-foreign context, two-year continuity and independence are explicit, including unknown answers. Changing a row identity/level clears affected context. Mathematics course and level come from the actual row; a conflicting historical summary prevents recognition. Caller group/category/recognition flags never establish eligibility.

`lib/engine/ib.ts` performs zero-I/O schema validation and evidence derivation. `lib/engine/ib-annexes.json` is the versioned complete reviewed source index, with literal source rows, programme scope and examination-effective May/November sessions. Exact identity is required; missing identity is different from verified absence. Source conflict 006880 remains unresolved. The index cannot grant access itself: all ordinary science, grade, language, schooling and continuity conditions still match published rule data.

`scripts/ib.rules.ts` contains only draft candidates with null publication metadata. Disposable reviewed fixture copies activate the official acceptance corpus; bootstrap never publishes them. The evaluator quarantines old unscoped IB path shortcuts, including automatic Studienkolleg outcomes. Missing ordinary prerequisites yield targeted unknowns; KMK section 2 alternatives require separate reviewed scope. Current-annex coverage applies to historical examinations as directed by the KMK index. The explicit draft intake coverage starts Winter 2025; earlier intakes and examination years before 2013 remain unknown pending review.

See [IB source verification](ib-source-verification.md) for authority, source versions, effective sessions and unresolved limits. The executable IB corpus is activated in UP-TEST-01; final parent official coverage remains OPEN. No DB, publication, server-shell or version-selection interface was changed.

### Rule assessment consumer integration (UP-RULES-01)

All current evaluation shells load immutable history through paginated
`listRuleVersions` and reuse `evaluateAssessment` unchanged. The server captures
one actual UTC instant and explicit `ENGINE_REVISION` before selection; publication
availability (including same-day microseconds) precedes scope, status and condition
matching. Assessment day, intake and applicant event dates remain distinct. Bump
the explicit revision when engine/profile mapping/selection behavior changes.

Submission validates answers/result/protected metadata and server-derived ownership
in one private service INSERT. Public inputs cannot supply authority. Signed-in
materialization reuses that assessment; later user-triggered saves/claims use a new
current assessment. Historical lookup fetches only selected and diagnostic UUIDs;
no latest replacement supplies missing history. Original result cards and literal
immutable raw evidence are separate from current result cards and meaningful
policy/source/new-coverage comparison. Invalid saved answers remain unavailable. Task/assistant profile mapping likewise
requires complete validated answers; malformed historical raw/partial rows remain
stored unchanged and cannot establish current rule authority.

Task generation retains logical UUID keys. Existing tasks, completion, student
text/dates, edit state and applications are untouched by evaluation, impact or
publication. Materialization inserts missing keys only, with duplicate-ignore
protection against concurrent insertion; it never reactivates an existing row.
The existing narrow APS read projection and course/application visibility behavior
remain unchanged. Dashboard rendering performs no materialization. Its Berlin
calendar day remains separate from the UTC assessmentEvaluatedAt instant. Personal assistant context is labelled history rather than
current requirement evidence.

The admin rule workspace previews both explicit beta/verified choices against the
complete caller-authorized profile population, paginated with exact counts. It
includes previously unmatched cases and reports invalid profiles, unavailable
proposals and unresolved scope, alongside policy/explanation/source-only/new-coverage
counts. This is a hypothetical publication now: a comparison-only draft operand
uses its draft identity with absent review/publication dates, never an immutable
version or authoritative assessment. The existing engine evaluates already selected
policy inputs; no second rule engine, profile RPC, new privilege or personal write
is introduced. Preview is not publication approval.

Trade-off: unversioned curated snippets cannot prove current applicability and are
withheld until they gain an explicit reviewed identity/version contract. The current
small corpus permits structured selected-rule fallback before embedding rebuild;
large corpora would need bounded structured retrieval preserving scope coverage.
Actual provider, disposable service/RLS/browser and combined integration gates remain
root-owned; deterministic unit grounding is not live-provider evidence.
