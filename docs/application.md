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

The main landing card is degree selection, labelled Step 1. Its
`/check?degree=bachelor|master` links carry the answer through the pure,
Zod-validated `check/entry.ts` boundary. Bachelor starts at school attendance
country, then curriculum and qualification details. Master starts at prior
university history and never uses a landing country as a university issuer.
Existing `/check?country=...` entries still ask degree first and reuse the country
only for the Bachelor attendance step. Attendance, qualification issuer and
nationality remain separate; no issuer mapping or academic exemption is added.

Answered entry questions are skipped going forward, but remain available through
Back. Academic questions precede nationality and visa context. Session drafts
store the current question identity as well as the legacy numeric index; recovery
stops at newly missing evidence. Degree links use separate draft keys, so selecting
Master cannot restore a Bachelor draft. Country edits survive under their original
entry key. Explicit degree edits update the URL and save under the new degree's
draft key, so refresh follows the edit while a later landing choice resumes that
degree's own flow. Browser Back/Forward retain the edited entry URL and active draft
while revisiting questions, so stale history URLs cannot undo a degree edit on
refresh. Restoration runs once per entry input, and a valid current history
position takes precedence over draft progress during a history remount. The
checker reattaches its question metadata after Next's history commits. Profile
editing labels the versioned school field as school attendance
country, separately from its issuer; unversioned profiles retain the legacy
certificate-country label. Old country/numeric drafts remain
recoverable. Existing normalization prunes hidden answers only for new/edit flows;
historical checks, profile rows, applications, task IDs, completion and student
edits receive no migration or rewrite. The qualification-guidance change below
implements #49; issues #50–#53 retain their separate flow and intake work.

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

#### Qualification-based school guidance (#49)

New checker forms, restored drafts and profile edits carry the independent
`qualificationGuidanceVersion: 1` marker. They remove `gceSchoolYears` and
`ibSchoolYears` without a replacement duration question or an inferred attendance
fact. GCE retains the explicitly selected qualification system/type, awarding
body, examination evidence and individual AL/AS subjects/grades. IB retains one
award/document question (no duplicate full-Diploma question), examination session,
subjects/levels/grades, language/continuity evidence and mathematics scope.
Its schooling-pattern question records ascending/full-time schooling, not years.
National board, certificate category, completion and examination evidence remain
distinct: a board name, a transcript category or a school location does not prove
a completed certificate. Their existing completion questions are not duplicates
of the qualification/grade questions. No new national duration question is added.

Legacy answers without this marker retain their original validation and profile
mapping, including reported years. Opening an editable form or restoring a draft
upgrades only that in-memory form; historical checks and profile rows are never
backfilled. Explicit saves use existing actions/query helpers. Applications, task
IDs, completion and student edits receive no storage or materialization change.

The engine withholds attendance facts for the new marker, even if a caller retains
old reports. Full rule matching still requires every original published condition.
For scoped GCE/IB candidates needing removed duration evidence, diagnostics carry
optional strict `assessedChecks`: literal conditions, actual derived facts and
comparison results for the collected evidence. All acceptance thresholds remain
in selected rule data. GCE comparisons use one complete full-AL witness. Only when
every retained condition passes does `qualification_guidance` describe those
checks as met; it never grants a path, admission documents or tasks. National-system
GCE, provisional evidence, other awarding bodies and unsupported cases remain
separate applicability limitations. Draft fixtures cannot authorize guidance.

Result copy identifies qualification/subject/grade checks and states once that
school attendance was not assessed and full recognition needs confirmation. No
duration follow-up or repeated duration checklist is generated for this flow.
Historical diagnostics remain readable, and protected original results are not
recomputed. The explicit revision and its literal inputs are recorded in
[revision evidence](issue-49-checks/engine-revision.json). There is no migration,
source-condition rewrite, live publication, seed, embedding or provider call.
See [source review and acceptance](issue-49-checks/acceptance.md).

#### Qualification-history contract

New and edited checker answers carry `qualificationHistoryVersion: 1`.
Unversioned stored answers retain their original required country/curriculum
validation and `buildProfile` mapping. New visible history answers are required
for a new evaluation; historical checks remain readable. History uses the existing
answers JSON; no database migration is needed.

The degree-level question comes first, including country landing links. Bachelor
applicants then select school attendance country/curriculum, with actual issuer
context collected separately. National-curriculum
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
   The model-facing fact schema uses seven strict kind branches: only route facts
   carry non-null route metadata, and only deadline facts carry non-null deadline
   kind metadata. These constraints are present in the SDK tool JSON Schema;
   invalid combinations retain incomplete manual recovery rather than being repaired.
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
   calls one atomic reviewed-version/protected-journal RPC per offering, with DB-derived
   reviewer/time and the original raw research equality token.
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
   backfill or automatic task integration is introduced. COURSE03 extends the
   same draft format/review boundary with the guided decisions described below.
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

### Guided course field review (UP-COURSE-03)

The existing research review queue now groups fields by offering and fact kind.
Field controls edit, reject or restore one identity; section accept selects only
eligible visible fields in that section, section edit opens those same individual
editors, and section reject explicitly enumerates checked visible identities.
Acceptance still uses the existing independent full-source reconciliation and
rationale for every field. Publication is a separate authenticated attestation.
The browser raw token and parsed draft are shared once through a small React
context rather than duplicated in every form. Guided client forms attach the raw
token to each pending action. All publication controls reference a sibling form; correction/rejection forms
are never nested inside it. AI/research notes and all draft fields are labelled
unverified. Unknown and rejected fields cannot receive an acceptance checkbox.

The optional private draft member is exactly
`review: {rejected: {offering,key,reason}[], changes:
{offering,key,kind: "edit"|"resolve_conflict",reason,before,conflict?}[]}`.
Both arrays are bounded to 400; offering indices are 0–7, keys are nonblank and
at most 240 characters, and trimmed reasons are 20–2000 characters. Rejected
identities are unique and must exist. Changes retain chronological original
unverified fact snapshots; only conflict resolutions contain the exact original
conflict and alternatives. Guided corrections preserve key/kind/deadline semantics,
applicant scope, every unrelated raw fact/scope/capture/paste and metadata sibling.
Known conflicts require explicit source-backed correction and rationale; one
resolution removes only that conflict. Existing university/VPD/uni-assist stages
stay distinct, and no intake, route, date, time or timezone is inferred.

Rejection retains the original privately and blocks selection for publication.
Restore removes the current private rejection without verification; the field's
pending or unresolved state still applies. Unselected/rejected fields use the
existing public unresolved/null projection, which renders neither original wording
nor its evidence as a reviewed assertion. The public schema/status/format and
catalogue/version identities are unchanged. Manual JSON recovery remains available
for new literal captures and scope recovery; its values are not authenticated
historical authorship. Recovery cannot erase existing pending decision history or
overwrite rejected originals; restore and conflict resolution use guided controls.

`patchAdminCourseResearchDraft` compares the browser's expected RAW research token
with actual stored research before deriving a patch. It then sends the original
full metadata plus the pending result through the existing caller-scoped
`compare_and_set_course_research_metadata` POST body RPC, protecting the race after
read without URL-sized JSON filters. Actions require `requireAdmin` and Zod;
RLS remains the authorization boundary. Pure patch helpers perform zero I/O.

The query shell computes new `sha256:<64 lowercase hex>` identities only for
changed/new field evidence, from exact UTF-8 stored observation content without
trimming or normalization. Evidence must match URL, literal retrieval timestamp
and contiguous quote, with one distinct matching content; identical duplicate
captures are permitted. Forged or ambiguous canonical hashes fail saving and
publication. Before any approval/catalogue/publication mutation, the query shell
preflights every accepted evidence capture across every offering, including
unchanged AI evidence with null or legacy hashes. The publication RPC independently
derives the canonical hash under its existing raw-draft lock for every accepted
evidence item in the **new immutable verified snapshot only**, with database-derived
reviewer/time. Offering version identifiers are not captured-text hashes. Pending
raw research, untouched fields and every historical version retain their original
null/arbitrary identities; there is no historical backfill. A hash identifies captured text, not original
remote HTML/PDF bytes, authenticity, completeness or academic correctness.

Additive migration `20261007000105_course_field_review.sql` replaces the existing
publication function body with the same signature/grants/auth/locks/raw equality
and version/audit atomicity. It validates optional review from locked actual stored
research, rejects selected rejected fields, validates supplied canonical hashes
and derives accepted snapshot hashes with
qualified PostgreSQL builtin SHA256/UTF8 conversion under an empty function
search path (no pgcrypto dependency).
Only the selected offering's validated optional review is copied into protected
`course_reconciliation`. Existing decisions and exact accepted-key invariants
remain. Database reviewer/time attest the whole publication snapshot, never claimed
original pending edit authorship. Legacy drafts and protected payloads without
review remain valid and immutable. No table/column/RPC argument/type change is
introduced. The extended disposable SQL fixture covers hashes, local decisions,
role denial and atomic rollback; actual migration/RLS/browser gates remain root-owned.

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
- The system prompt requires the contract: answer **only** from tool
  results; every claim ends with `[[rule:slug]]` or `[[web:url]]`; no
  coverage → `[[unknown]]` plus the official source. Refusing to guess is
  success.
- The pure completed-answer guard (`lib/ai/response-guard.ts`) requires markers
  and authorizes every rule/web citation against exact successful server tool
  outputs in this request only. Shared source-envelope validation rejects malformed
  records and conflicting versions/URLs. The single pure contract lives in
  `lib/ai/assistant-sources.ts`; the client module re-exports it. Optional strict
  `processUnknowns` accompanies profile/freshness-filtered process chunks. Search
  records those exact projected outputs in the request-local allowlist; context
  and personal reminders cannot authorize rule citations. History, personal context and provider
  source events authorize nothing; unknown cannot override an unauthorized citation.
  Answers without any rule/web citation, including unknown-only model prose,
  always use the deterministic fallback even when tools returned evidence.
  Rejected prose is replaced entirely with a constant `[[unknown]]` refusal and
  DAAD's general URL as a place to check, never as proof of the requested answer.
  Trade-off: this checks presence and citation authorization, not sentence
  entailment, factual accuracy or source accuracy. An authorized citation in a
  mixed answer does not prove its other claims or unknown passages are supported.
- Trade-off: the SDK 7 transform buffers answer text until each finish-step,
  before the SDK accumulates text for continuation and persistence. Tool progress
  remains immediate; incomplete/error/aborted steps discard pending text. The
  existing per-step token cap remains. The UI can show multiple guarded steps;
  stored assistant history retains only the final step, as before.
- Trade-off: universal markers also apply to personal answers, which may now
  become a controlled unknown when the model omits markers. No personal-history
  citation type is invented.
- The route now passes `request.signal` to the shared runner for cancellation.
  Aborted requests retain the logged user question/quota consumption and do not
  store a partial assistant answer. Reasoning transport is disabled with
  `sendReasoning: false`; this adds no reasoning UI.
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
  traps, out-of-scope traps, personal context). It reports raw marker compliance
  separately from guarded delivery, fails on replacement fallbacks (including
  personal answers), and counts only unreplaced unknowns. A fallback-only model
  cannot pass as healthy. Marker checks do not detect every uncited clause.
  Deterministic provider-boundary tests exercise the actual SDK and route; real
  original-model, RLS, default-build, CI and browser gates remain root-owned.

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
  service. It self-skips when required env keys are
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
review/publication and public reading. The PROC01 consumer below integrates reviewed
offering selection and tasks; there is no automatic import, backfill or publication,
and existing course/application/task identities stay intact.

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
the truncation. Shared 90-second budget, provider and SDK remain unchanged.
Sanitized failure categories report timeout or invalid/unavailable response, never
provider bodies or keys. Real provider acceptance still requires root's clean smoke.
The configured `nvidia/nemotron-3-super-120b-a12b:free` import uses the existing SDK's
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

Applications persist `course_id` plus an optional reviewed `offering_id` and
`offering_applicant_context` (`{applicant_group, confirmed: true}`, or both
null). The selection requires explicit intake/group confirmation and derives the
immutable reviewed version/snapshot at use time; see “Explicit offering
application procedure (UP-PROC-01)” below. There is no automatic import,
backfill, or publication, and the legacy `course_id` and student state are
preserved.

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

### Bounded import model context

Captured observations remain unchanged for literal evidence validation and manual
review. The model receives at most four official identity-linked sources and
16,000 characters of literal excerpts (4,000 per source, 2,000 per excerpt).
Identity and admission/intake/language/fee/document paragraphs rank before navigation
and unrelated prose; unrelated search-only sources do not consume model context.
Excerpts are actual substrings, not rewritten summaries or inferred applicability.
Identical paragraphs consume the model budget once; original captures remain intact.
A paragraph is emitted only when it fits in full within the remaining source budget;
long paragraphs that fit retain separate contiguous slices. This prevents clipping
a later condition or exception even when it lacks recognized warning wording.
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

The caller-scoped publication helper retains the original RAW stored research JSON
and preflights every offering/selection before any mutation. Every accepted local
field requires a rationale, including when the model context omitted nothing.
Identity approval, programme attachment and exact scope lookup remain separate
requests. Each offering calls the authenticated admin-only
publish_course_research_version RPC once with the next actual version number,
local accepted keys/decisions and that same raw JSON equality token. The token is
never reconstructed from parsed/trimmed Zod output or refreshed after preflight.
Immediately after locking the submitted row, SQL rejects changed research with
"research changed; reload and review again". Facts/full observations originate only
from the locked row; reviewer and one consistent timestamp originate from DB
identity/clock. One verified version and its protected audit event are atomic.
There are no direct pending/verified inserts or editable metadata audit appends in
this workflow. Errors propagate without automatic retry, success redirect or
conflict cleanup. Keep-original resolution runs only after every RPC succeeds.
Trade-off: setup and multiple offerings are not one transaction; an earlier
successful version survives a later failure, and retry may append another version.
No application/task/definition/progress sync is introduced.

The reserved additive migration adds admin_audit_events.course_reconciliation
without replacing existing status/programme-correction history or relaxing RLS.
The payload records complete original observations, submitted ID, identity/scope,
field decisions, immutable reviewer/time and actual offering/version UUID links.
Caller-scoped admin queries bound history reads to a canonical envelope row ID.
Strict pure Zod validation checks the entire protected payload/envelope; malformed
records render explicitly unavailable, without partial trusted claims. The existing
review queues receive validated history through page props. The existing audit view
shows recent protected events and offers an approved-course history selector, so
journal captures remain reachable after the incoming submission is deleted.
The immutable payload retains reviewer/time after an account deletion nulls the
outer actor FK; it is never mislabeled as a system review.

Legacy research_reconciliations arrays remain caller-editable and visibly labelled
"Untrusted legacy reconciliation data — caller-editable metadata". No UUID, timestamp
or schema validation retrofits authenticity. They never enter the protected journal.
The canonical research marker still guards legacy generic replacements even before
a partial publication succeeds. If absent, only original raw research is merged as
an untrusted guard marker using an exact conditional metadata update; existing
canonical research and sibling metadata are preserved, and concurrent sibling edits
force reload. Incoming legacy journal siblings are never copied into the canonical.
Manual recovery preserves every original web/manual/paste observation exactly plus
original draft.paste, while newly entered web content is labelled manual. Retained
captures are merged before final evidence/scope validation; capacity overflow rejects
instead of silently truncating evidence. Source quotes and retrieval timestamps remain
unchanged. The root-generated schema types are consumed unchanged. Root owns SQL/RLS,
DB/browser/build and real-provider acceptance; unit HTTP fixtures prove control flow,
not database atomicity or operational provider success.

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

### Course research metadata compare-and-set transport

Pending manual recovery and the canonical untrusted research marker use
`compare_and_set_course_research_metadata` through the caller-scoped admin client.
The additive migration `20261007000104_course_research_metadata_cas.sql` puts
complete expected/new metadata in a POST RPC body; source captures and paste no
longer become a PostgREST URL equality filter. Zod validates the boundary before
mutation, and the original raw stored metadata remains the exact equality token.

The function is security invoker with an empty fixed search path, authenticated-only
execution, an explicit authenticated admin check, and existing courses RLS. It locks
the row, compares all JSONB metadata, enforces exact sibling preservation and the
pending-recovery/approved-unmarked-canonical lifecycle, then returns the actual
updated course. Changed metadata or lifecycle rejects without mutation. SQL NULL
has an explicit expectation flag; JSON null is distinct and is rejected as malformed
metadata rather than normalized to an empty object. A null value returned by the
normal course read retains the old SQL-NULL-only expectation, so a JSON-null legacy
row cannot be silently overwritten. Neither path publishes or authenticates research.

The shared strict source/scope/conflict/capture checks, original paste retention,
manual-origin labels and explicit reviewed-version publication remain unchanged.
`supabase/tests/course_research_metadata_cas.sql` supplies transactional disposable
SQL cases. Real schema application, generated types, RLS and actual large-draft
browser acceptance remain root-owned; HTTP fetch fixtures establish request
construction and error propagation only.

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

The original `gceVersion: 1` contract collected actual ascending school years alongside qualification system (UK/British international versus national), AL/IAL or another certificate type and final/provisional/school-only evidence. #49 removes years only in new/restored/edit forms carrying `qualificationGuidanceVersion: 1`; the original duration-dependent recognition rules remain intact. No AL-to-12/13-year inference is permitted. Legacy results retain their original reports and diagnostics without invented years/context. Nationality, attendance country and visa jurisdiction stay separate.

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


### Pakistan bounded current assessment (UP-ELIG-08)

Actual national school issuer/context is collected once before country-specific
questions. Pakistan new/edit/restored drafts carry pakistanVersion 1; current
study evidence separately carries pkStudyEvidenceVersion 2. Legacy reports remain
readable without inventing a current applicable assessment. Actual India questions
and prior history remain reachable regardless of the landing country. GCE/IB are
independent. Passport/visa edits preserve academic reports.

Pure lib/engine/pakistan.ts validates applicant reports and derives fifteen scoped
pk_* facts. Generic legacy recognition/history facts stay inactive. Exact completed
twelve-grade HSSC/Intermediate category is separate from documentary Science,
Commerce or Humanities group; FSc/FA/ICom/ICS titles never infer groups. Missing
grade differs from 49.99; the literal >=50 condition applies only to this formula.
Existing qualificationHistory preserves institution, programme, country, completion
and actual successful years. Names, HEC attestation, elapsed attendance, two semesters
or field strings establish neither success, recognition nor target relationship.

Three source-backed preparatory candidates restrict no-study applicants to their
stated Medicine/Natural Sciences/Technology, Social Sciences/Economics or Humanities
family. Six executable acceptance examples cover these families. Three current
one-year candidates require the actual Pakistani national qualification, >=50%,
recognized full-time academic Bachelor study in Pakistan under regulations, annual
subject/mark records, at least one successful year and separate applicable success,
recognition and previous/neighbouring-target report references. A current applicable
assessment report/reference is required; a contrary assessment remains an individual
confirmation conflict. Direct subject scope follows prior university study, not the
school group. Ongoing Bachelor is conservative product coverage, not a new official
qualification requirement. Covered product intakes are exactly 4053/4054/4055;
missing, historical and other intakes remain targeted unknown. First intake selection
preserves fresh evidence; subsequent relevant intake/target/school/history edits
invalidate dependent references. Restored old drafts stop at missing current evidence.

Original anabin PAK-BV01/02/03 German wording was supplied in root's firsthand source
review and independently adjudicated. DAAD195/199 corroborate one successful year;
Humanities206 retrieval failure is not contrary evidence. The linked 2022 regional
PDF still says two years. Three evidence-only candidates disclose that discrepancy
in result citations and immutable current KB, without executing it as a competing
current path. No formal withdrawal, legal precedence or historical commencement is
asserted. Source verification date is not effective intake. Applicant reports are
labelled separately from verified source rules; university/uni-assist makes the
individual final decision. Completed two-year-degree discrepancy remains review-only;
completed four-year Bachelor, Master's, aliases and irregular cases remain unknown.

All fourteen candidates remain draft/unpublished with null publication/effective
intake. Runtime tests consume actual candidate clones with disposable published
metadata; Muse's JSON remains its original future-data delivery record and alone
proves no route. Renamed, exclusion-only, source-only and unscoped legacy Pakistan
paths are quarantined consistently in engine, legacy retrieval and immutable current
KB. Selected immutable human versions and captured context remain the sole current
authority; cached prose, IDs and URLs are hints. Only resolved winning Pakistan
paths project admission tasks. No DB, seed, embedding, migration or provider operation
occurs. See [source verification](up-elig-08-source-verification.md).

### India JEE ordinary qualifying passage (UP-ELIG-04)

New/edited/restored answers use jeeVersion 2; version 1 and historical Advanced booleans remain readable without invented evidence. Separate reported Main/Advanced qualifying passages are never inferred from scores, percentiles, participation, result possession or the legacy boolean. Actual Indian national school issuer/context is established once before collecting a reported completed twelve-grade national secondary certificate. Foreign, missing or unknown issuer/context cannot expose or map hidden India JEE reports. Tertiary history is independent and cannot prove school completion.

After target selection, both ordinary passages and the completed category permit a reported applicable university/uni-assist classification of this exact intended target as technology/natural sciences, with a trimmed nonblank reference up to 500 characters. Marketing, guessed STEM membership, a broad family sentence or a statement about another target cannot establish that report. The app verifies the rule source, not applicant documents or programme classification. Existing options and text editors render these questions progressively; unfinished draft text survives but complete submissions require applicable evidence. Target and changed intake clear bound family/reference, family edits clear reference, and qualification/category/exam/context changes prune dependent reports. First intake selection retains evidence just collected. Passport/visa edits preserve academic reports. Legacy drafts stop at newly missing evidence, retaining independent university history.

The source-backed candidate requires both passed statuses, ordinary context, bachelor/national curriculum, actual Indian national issuer, completed secondary category, positive reported family with reference, and intake inclusion 4053/4054/4055. The shared pure engine/KB predicate rejects unscoped or exclusion-only metadata and other positive outcomes. No board whitelist, static programme mapping or 70% prerequisite is added. Missing/failed JEE excludes only JEE; independent India03 and scoped process routes remain available. Equal-specificity path conflicts remain unknown with both citations.

Fresh verification 2026-10-08 follows [DAAD India selection](https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=2&ad-layerId=4) through [completed school category](https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=3&ad-layerId=21) to [both-parts result](https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=4&ad-layerId=63), corroborated by [uni-assist India](https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/). The recognition outcome is direct subject-restricted academic access, with institution final decision. Exact current product intake coverage is reviewed 2026-10-08, not a claimed source effective date; source commencement is unstated. Historical, missing and other intakes and Main exemption/preparatory/cross-year/unclear evidence remain targeted unknowns. No Anabin IND-BV02 text was independently verified. See [source contract](up-elig-04-source-verification.md).

The candidate remains DRAFT with null publication date. Official harness positives use disposable published copies of that actual source-backed candidate; artificial matcher fixtures remain specification data. The former ordinary-source hold is superseded only within this reviewed contract. Production publication, real programme verification, exceptional/historical recognition and root full acceptance remain separate holds; no DB, seed or embedding operation occurs.

#### Assistant JEE authority and immutable versions

Engine and KB rendering share the canonical structured quarantine: unsupported historical JEE paths withhold path/note/quote/tasks and render cited unknowns with historical metadata distinguished from verification. Independent process outcomes survive. The approved legacy projectDmatKbMatches adapter remains unchanged and its exact cache-binding regressions remain executable, but it has no production caller. Rule34's current search_rules reads only caller-visible immutable versions through listRuleVersions and matchKbRuleHints; cached prose and unversioned snippets are search hints, never authority. Current-source selection retains reviewer/provenance/publication/applicability/version identity, then renders the selected structured snapshot. Missing/invalid/unreviewed/future sources cannot revive old cache content. Actual-tool JEE legacy, renamed lost-family, current independent and source-backed scoped replacement controls exercise this immutable format without rolling back to mutable published rows.

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


### Separate process guidance (UP-PROC-02)

Visa fees, financing and appointments use optional strict `outcomes.process` JSON on existing immutable rule snapshots. There is no new table or migration. New publication preflight rejects rows mixing process and academic outcomes; old snapshots remain available for exact historical result/source reads. Current academic evaluation quarantines process rows and known legacy static financial/appointment identities, including renamed logical IDs discovered in immutable history. Independently scoped APS fee/courier rows remain academic/application evidence.

`assessProcess` reuses `selectRuleVersions`, validation, `deriveFacts` and the exported ordinary `ruleMatches`; missing facts fail even `neq`. Only selected human immutable versions receive the adapter's `matched:true` attestation. Cached content, applicant flags, citations and saved prose cannot supply authority. `Assessment.process` is a current optional sibling; academic `Result` and strict stored result metadata do not acquire process decisions. Historical reads never replay today's process policy as originally saved. Academic and process policy/source comparison flags and draft impact counts are separate.

One injected instant governs source review and process applicability. Publication availability/supersession still compares microseconds without rounding, with existing half-open version boundaries and invalid replacement no-fallback behavior. Process explicit effective endpoints are inclusive and independently scoped. Verification must be valid, present and no later than assessment; review_due must be valid, not earlier than verification and not overdue. Equality is current; +1ms is overdue. UTC-offset source timestamps retain exact order. Validation requires a finite original offset instant as well as the existing real-calendar check; malformed numeric offsets enter review attention or unknown guidance before exact ordering. Missing/invalid review policy and unresolved observations trigger independent admin attention even when a generic 183-day check would consider the row recent.

Optional version-1 process reports live inside answers/profile JSON. Checker and profile review ask the needed guide kind, purpose, named mission, reported mission applicability, age bracket, funding method and fee/funding exception uncertainty. They are applicant reports, never app-certified responsibility, qualification or waiver. Unknown/other remain valid. Editing process scope prunes dependent process reports without upgrading academic versions or erasing academic/history/APS/visa evidence. Appointment context has no financial prerequisite. Reviewed programme route/payer authority remains the separate UP-PROC-01/Course dependency; there is no applicant-controlled production uni-assist payment authorization.

Result and dashboard display current process evidence separately from academic decisions and personal reminders. Only current guidance displays literal amounts, currency, period, source annotation, quote, alternatives, additional documents and steps. Noncurrent observations retain official pointers and review reasons without actionable amounts or raw quote/advice rendering. No amounts are parsed, converted, summed or inferred from article dates. `processRuleIds` is inventory including wrong-jurisdiction/stale/conflicting records, never task authorization.

`generateProcessTasks` consumes only current steps and uses logical `rule:<id>:step:<order>` keys. Event-time materialization reuses existing missing-key insertion guards. Reads do not write, regenerate, rewrite or reactivate rows. Retained inactive keys suppress new process duplicates on IN→SA→IN. Edited/done/manual/course history and applications are preserved. Saved process reminders receive a personal-history source label instead of a verified payable badge. Existing course-assignment Remove regeneration is outside this deletion contract; no universal deletion suppression is claimed.

Assistant search reconstructs process chunks from selected immutable sources through the same profile/context/freshness/conflict projection before rendering. search_rules and get_user_context share one captured instant and cached profile/version read within a tool session. Raw hints, fallback chunks and unversioned curated snippets cannot leak noncurrent process quotes or numbers. Saved reminders are explicitly untrusted personal history; recognized keyed process reminders withhold stored title/quote prose from model tools while preserving database and dashboard history. Provider/model configuration is unchanged; deterministic mock tool tests are not real provider integration evidence.

Source-reviewed additions in `scripts/process.rules.ts` remain draft bootstrap candidates. No seed, embedding, publication or live data operation is implied. See [source verification](up-proc-02-source-verification.md) and [acceptance matrix](up-proc-02-acceptance.md). Root owns independent review, exact combined gates, disposable RLS, browser/clean CI and separately authorized operational provider evaluation before any merge.
### Saudi certificate evidence (UP-ELIG-09)

New/edited/restored Saudi forms use certificate version2. Exact documentary category/stream and completed secondary evidence remain separate from curriculum, actual issuer/context, school location, nationality and visa residence. Version1/legacy answers and protected original results remain readable without retrospective certification. Missing school subtype asks that question before collecting school-dependent history; saved independent history is retained. Explicit other/unknown school subtype can collect a separate completed Saudi Bachelor. Actual Indian issuers on Saudi landings retain core history and JEE v2 questions once; GCE/IB and other issuer branches remain distinct.

National Literary preparation covers humanities/law/social sciences/economics, Commercial economics and Science all Schwerpunktkurse. Restricted preparation uses a reported applicable official classification of the exact target with a trimmed nonblank reference up to500 characters; no static programme-name mapping. Science needs no narrow family report. One recognized successful academic study year grants prior/neighbouring direct subject scope at all higher education institutions. Completed twelve-grade category and Bachelor-history evidence are conservative product coverage boundaries, not additional national source requirements. No national grade, location or full-time threshold is invented.

Private version2 records an applicable official/ZAB diploma and subject assessment explicitly covering regional-US accreditation, subject breadth and every individual passing minimum. Generic version1 subject reports cannot certify those new prerequisites. One successful recognized Bachelor year supports prior-field preparation; two support prior/neighbouring direct access, both all institutions. No numeric minima or school/body whitelist is inferred.

Industrial literal certificate/diploma plus recognized Bachelor enrollment and referenced enrollment-field relationship supports FH preparation; successful recognized Bachelor year plus prior/neighbouring relationship supports FH-only direct subject access. Current Anabin SAU-BV6 explicitly refines uni-assist's institution-type omission; the former unrestricted successful-year interpretation is superseded. Both results carry the optional literal fachhochschule atomically with the winning path. Strict authoritative assessment unknown-key validation remains; engine/cache validation permits direct FH only for scoped industrial subject-restricted rules. Direct FH result/route/tasks mention FH without Studienkolleg; superseded preparation tasks are withheld.

Completed-Bachelor evidence is separately stored in existing qualificationHistory, never as a school subtype. Version2 assessment records actual Saudi national tertiary context and applicable exact qualification/recognition evidence covering prescribed study norms and generally full-time study. Completed recognized minimum-four-year Bachelor yields general UNDERGRAD academic access/all subjects/institutions, independently of school route. Nominal duration, successful years, completion and enrollment remain distinct. This general entitlement subsumes narrower Saudi school grants; unrelated/equal-specificity source conflicts still resolve to cited unknown. Master's equivalence/programme requirements remain unknown.

Current draft coverage is exactly intake4053/4054/4055, not an Anabin effective date or verification-date commencement. Industrial additionally respects uni-assist WS2026/27 onward. Eleven candidates remain draft/null publication; actual candidate copies drive official harness positives only in memory. New facts are Saudi-scoped; generic unsupported legacy history keys remain disabled. Engine and immutable/legacy KB share positive structured-scope guards, including missing/renamed/lost-family/cache controls. JEE440 and immutable Rule34 source/version/provenance/private-writer contracts remain authoritative.

Issuer/context/category/stream/history/target/intake edits prune dependent reports, while first intake selection retains just-collected references and passport/visa edits preserve academic reports. Independent completed history and old answers/results/tasks/applications/personal progress are not rewritten. New evaluations capture a combined explicit ENGINE_REVISION using the existing SHA256 identity of sorted literal path/hash entries for the combined union of checker steps, result model, engine, JEE/Saudi/Pakistan derivation, assessment/versioning, immutable/legacy KB and task profile mapping. Protected historical tokens remain exact.

See [current source verification](up-elig-09-source-verification.md) for original literal anchors, root terminal-capture vs worker retrieval limits, applicability and remaining precise unknowns/publication holds. All qualification/recognition/family reports remain applicant reports, not app verification; admitting institutions decide. Worker unit tests do not establish real RLS/browser/provider/CI/build/integration gates; root owns those gates.
### Cross-issuer national checker routing (UP-ELIG-08 repair)

Versioned national flows collect the actual school issuer/context pair once before
school evidence. The explicit national issuer supplies the assessed qualification
country and board catalogue; a landing-country hint never hides available Indian
board, percentage or prior-study assessment questions. Actual Pakistan issuers
activate Pakistan evidence on fresh, edited and restored flows regardless of the
landing country. Issuer/context edits recollect school evidence and clear dependent
recognition/relationship reports while retaining the core prior-study history.
Uncovered/uncertain contexts prune hidden evidence and retain only a Pakistan
source-review marker; that marker derives no Pakistan facts or positive outcome.
Legacy reads remain unchanged. Passport/visa edits preserve academic reports.
The explicit current revision adds pakistan-current-v2; protected old assessment
revisions, immutable source versions and captured UTC instants are never rewritten.

### Structured result diagnostics (UP-ELIG-10)

New evaluations add optional strict diagnostics to Result: known_route,
known_unmet_condition, targeted_missing_fact, source_conflict or unsupported.
Each entry names its support, stable reason, candidate logical rule IDs and
literal condition comparisons against the actual derived facts. Saudi completed-
degree negative reports are retained separately as reported evidence; they do
not change positive fact derivation or recognition. Failed candidates never
change the resolved path, scoped APS, TestAS/dMAT, FH restriction or tasks.
The existing matcher and reviewed admission scope guards remain the evaluator;
GCE winning and failed comparisons use a single complete full-A-Level witness.
Equal-specificity conflicts are captured at resolve(), with every contender.

At most one answerable follow-up is selected for an unresolved academic case.
Missing prior study asks whether study exists; successful academic years stay
separate from nominal duration. Missing intake withheld by immutable selection
can ask intake without claiming that a withheld version supplies a route.
Process-only selection gaps never create an academic follow-up. Current assessment
and hypothetical draft impact reuse the same intake explanation helper, preserving
academic explanations when only process evidence changes.
Unsupported applicability and source conflicts retain official confirmation;
independent source caveats and process uncertainty remain visible.

Unmatched evidence uses optional candidateCitations with candidate-only claims,
separate from winning verdict citations. Both resolve through the exact selected
immutable UUIDs and source metadata at historical reads; missing versions are
never replaced by latest. Every optional object remains strict, including nested
facts/questions. Absence remains valid for historical Result payloads. Stored
answers, results, metadata, revision tokens and original unknown strings are
never rewritten or re-evaluated for original display. Current display removes
only the captured matching generic confirmation suffix when it asks the specific
question or states the known unmet candidate condition, preserving the rest of the caveat. Candidate diagnostics, citations and
unknown prose are explanations rather than academic policy identity; literal
rule condition/outcome changes and existing coverage checks remain consequential.

Current semantic identity uses SHA256(JSON.stringify(sorted path/SHA256 entries))
for the combined checker, result, engine, immutable selection/assessment, KB and
task-profile union, including the result components/page now displaying diagnostics.
The exact literal entries and formula are recorded in
[UP-ELIG-10 revision evidence](up-elig-10-checks/engine-revision.json) records the
historical diagnostic checkpoint. The combined process/diagnostics/assistant guard
union additionally includes the shared source boundary, response guard, actual chat
route and process/task adapters; frozen integration receipts record its current
literal inputs under the same formula. Historical revision tokens stay exact.
No criteria, source quotes, verification dates, publication, migrations,
dependencies, providers or database/query/auth boundaries change. Draft candidate
fixtures remain test-only; final UP-TEST-01 parent coverage and root integration
browser/RLS/CI/review gates remain separate.

### Explicit offering application procedure (UP-PROC-01)

Programme process is separate from academic evaluation and PROC02 visa/funding
policy. `lib/tasks/offering-process.ts` is a zero-I/O resolver over the existing
COURSE02 immutable catalogue. A nullable `applications.offering_id` and strict
`offering_applicant_context` JSON record the explicitly selected intake/group on
that existing application UUID. Context is exactly `{applicant_group,confirmed:true}`,
or both selection columns are null. The report is applicant-supplied, not a
verification of group eligibility. No nationality, profile intake, course prose,
APS report or creation timestamp infers the context. All query/action boundaries
validate selection with zod. Owner-scoped queries retain RLS as authorization.
Reserved additive migration `20261007000103_application_offering_selection.sql`
adds nullable fields, an offering FK, strict context CHECK and an invoker trigger
binding offering/group to the application's mapped approved course. Existing
owner CRUD/admin-read policies remain; even admins cannot select pending-only
research or write another owner's context. Type additions are provisional until
root generates against the disposable migrated schema; the SQL acceptance script
is `supabase/tests/application_offering_selection.sql`, not mock RLS proof.

Supported offering applicability is an empty map or the research producer's
literal `source_scope` provenance string only. That quote adds no eligibility
condition; any other map key or non-string scope remains unresolved. Fact applicability
must equal the confirmed offering applicant group byte-for-byte. Additional map
keys, missing group confirmation, other fact prose and unavailable programme
mappings yield targeted official confirmation. The highest numbered reviewed
version for that exact offering is selected before route matching. Exactly one
applicable verified route is required; newer reviewed missing/unresolved/conflicting
routes never revive predecessors. Pending/rejected research has no public authority.

Optional stage keys consume both protected research publication identities and
existing COURSE02 process identities, without rewriting immutable facts:

| Process key | Research key | Required kind and interpretation |
| --- | --- | --- |
| `process.university.portal` | `application_link:university` | description; exact HTTP(S) URL in verified verbatim and literal quote |
| `process.uni_assist.portal` | `application_link:uniassist` (submission), `application_link:vpd` (VPD request) | description; same portal contract |
| `process.university.closing` | `deadline:university:application_closing` | deadline / application_closing |
| `process.uni_assist.closing` | `deadline:uniassist:application_closing` | deadline / application_closing |
| `process.vpd.preparation` | `deadline:vpd:vpd_preparation_target` | deadline / vpd_preparation_target; never a closing deadline |

Coexisting identities, unresolved fields and mismatched field scope request
confirmation rather than choosing one assertion. Protected research dates stay
null in immutable facts. The pure planner separately derives `stage.dueDate` from
one supported literal full date with its own explicit year; ranges, additional
numbers/years, invalid dates and absent years remain undated. It never borrows
the offering year, URL, quote context, retrieval or publication date. Existing
reviewed structured process dates remain compatible. Derived dates drive only
sorting, buckets and calendar; the displayed deadline remains the exact source
wording, and source time/timezone fields are never inferred.

Source URLs are provenance/official confirmation pointers, never inferred portals.
Missing portal/closing/preparation dates remain explicit confirmations, including
reviewed undated wording. Dates sort/bucket/calendar only; source wording, time and
nullable timezone display verbatim. Direct produces only university submission;
standard uni-assist only its submission; VPD produces a request plus a separate
university submission. Unresolved produces the specific rail confirmation with
no submission/account/payment mandate. Generic account preparation is not inferred.
Applicable verified fees are literal guidance; no structured payer/waiver/amount
allocation exists, so uni-assist/VPD generates fee confirmation, never Pay, totals,
per-course allocation or applicant-controlled payment authority. Applicable direct
fee evidence can display as confirmation guidance without a uni-assist fee task.

Dashboard rail selection and current evidence details render the actual offering,
version facts, group/intake, quotes, URL, retrieval and source verification dates.
Saved tasks snapshot full offering/version/fact/evidence in existing admin_snapshot;
their source date comes from actual literal reviewed evidence, never course.created_at.
Keys are `app:<applicationUUID>:offering:<offeringUUID>:process:<stage>` with only
university_submission, uni_assist_submission, vpd_request or fee_confirmation.
Version/title/fee/URL do not enter identity. Existing missing-key-only reconciliation
includes inactive keys and never rewrites, deletes or reactivates edits/completion.
Saving selection materializes at event time; rendering remains read-only. Returning
to planning uses existing keys. Completing VPD changes task completion only, leaving
application status and subsequent university submission independent.

Pending process tasks show only for the current selected planning context and
current supported route stages. Completed history survives context/status/route
changes. Saved offering tasks are labelled personal history; current authoritative
facts are displayed separately in the rail. Untouched task dates are read-projected
from the same current plan; explicit personal date edits remain personal reminders.
Rail next deadline uses those visible pending stage tasks, advancing after VPD
completion and avoiding deleted/inactive keys. Calendar and next-deadline use the
same projected tasks. No legacy course deadline is substituted into the rail.
For mapped catalogue applications, generic submission definitions are not newly
materialized and pending copies (including retired identities) are hidden. Existing
rows/keys/completed history and manual/requirement tasks remain. Unmapped legacy
course definitions retain existing generation; their rail separately requests
reviewed context. Obsolete global uni-assist pending rows are hidden by exact known
slug/bootstrap provenance mapped to immutable logical UUID, never editable title.
PROC02 visa/funding reminders and existing APS projection remain unchanged.

The historical bootstrap uni-assist candidate is now DRAFT; the current engine's
legacy identity quarantine remains intact. This is repository retirement intent,
not live rule publication. Official [VPD guidance](https://www.uni-assist.de/en/how-to-apply/plan-your-application/vpd/)
and [handling-fee guidance](https://www.uni-assist.de/en/how-to-apply/pay-all-fees/handling-fees/)
were rechecked 2026-10-08: university-specific VPD plus separate university filing,
and university-paid fee exceptions support the bounded contract. That check date
is not an effective intake or a verification stamp on any offering. No academic
rule/catalogue publication, linked database operation, seed or embedding occurs.
Root owns actual disposable SQL/RLS/typegen, default build/CI/browser review and
integration before merge.
