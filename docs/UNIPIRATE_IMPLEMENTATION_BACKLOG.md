# UniPirate — implementation backlog and release gates

Review date: 18 September 2026  
Reviewed repository: indkhan/unipirate  
Reviewed main commit: 29b477266990bda479a95357ea2acdc5578a03d5

## Scope and evidence

This is an implementation specification based on source-code, migration, documentation, and official-source review. It is not a report of a running production security test. The application build, browser journeys, live Supabase policies, published database rules, delivery services, and production data were not executed or inspected. Verify deployment state before treating a source-level finding as a demonstrated production incident.

Rules in `scripts/rules.bootstrap.ts` are candidates. `scripts/seed.ts` inserts them as drafts and ignores existing slugs. A candidate's label or a Git commit therefore does not establish what the running checker currently publishes.

## Product decision

Keep Next.js, Supabase, the deterministic evaluator, the existing task/admin interfaces, and the pure-domain/I/O separation. Do not rewrite the application or make an AI assistant the critical path.

The first release should help a student maintain a small set of real applications: understand the supported route, shortlist programmes, prepare requirements, submit through the correct portals, track responses, and follow a bounded official-source handoff into visa/enrolment preparation.

Provide planning for Bachelor's and Master's applicants, but certify automated eligibility only for individually reviewed routes. Unsupported cases remain useful planning workspaces with precise unresolved questions, not fabricated verdicts.

A suggested pilot scope is 30–50 carefully reviewed programmes selected from the actual shortlists of 10–15 students. These are operating targets, not market statistics or mandatory scale requirements.

## Global implementation rules

- Add migrations; do not edit already-applied migrations or reset a linked production database.
- Keep ordinary reads/writes scoped to the authenticated user. Use narrowly scoped privileged operations only where anonymous creation/sharing or background processing genuinely requires them.
- Preserve official evidence separately from the interpretation and from a student's personal notes.
- Separate qualification assessment, programme requirements, application procedure, and visa jurisdiction.
- Do not interpret a missing requirement on one checklist as a universal exemption.
- Do not equate a source URL, an import timestamp, or valid JSON with verified truth.
- An official deadline, a planning target, and an estimated processing interval are different concepts.
- Preserve completed work and user edits during reconciliation; mark obsolete generated instructions explicitly.
- No automatic submission to universities, paid services, or government systems in this release.

## Recommended order

1. UP-01 establishes a reproducible baseline; UP-02 closes the anonymous-check boundary immediately. Disable the assistant route unless UP-12 is complete.
2. UP-03 to UP-07 establish correct requirements, profiles, application cycles, deadlines, and task state.
3. UP-08 and UP-09 complete the useful student workflow on curated data.
4. UP-10 and UP-11 add reliable reminders and a maintainable content-release process.
5. UP-13 and UP-14 finish the bounded arrival handoff and validate the release with students.

Do not expose a broad public launch while known privacy/integrity defects remain. Content changes need their own release checklist, not just passing code tests.

---

## UP-01 — Reconstruct the baseline and enforce executable checks

**Priority:** P0 release prerequisite.  
**Depends on:** None.  
**Primary areas:** `README.md`, `docs/application.md`, `docs/bugs.md`, `AGENTS.md`, package scripts, `supabase/migrations/`, tests, new CI workflow.

### Implement

Record the exact deployed commit, applied migrations, configured services, published rule counts by status/scope, reviewed course coverage, and active KB embedding version. Do not store secrets or student data in this inventory.

Create `docs/STATUS.md` containing what is implemented, what is deployed and verified, what remains unknown, release gates, and the next three tickets. Replace the stale bug transcript with a maintained issue index. Consolidate the competing root `application.md` and `docs/application.md` descriptions into one authoritative architecture document; the root copy still describes an older render-time task sync. Remove obsolete commands and paths.

Add CI for a frozen dependency install, lint, typecheck, Vitest, production build, and local disposable Supabase migration/security tests. Add browser tests for the critical student journey. Integration jobs must fail clearly when their required local test services are unavailable rather than silently passing through skipped suites.

Use disposable databases only. Validate test profile fixtures against the same input schema as production. Maintain a separate human-reviewed expected-results corpus; passing tests against bootstrap candidates alone does not verify the educational interpretation.

### Acceptance

- A fresh checkout has documented, reproducible setup and verification commands.
- A disposable database can apply all migrations in order.
- Anonymous, owner, other-user, and admin authorization cases execute in CI.
- Existing checker persistence/back-navigation functionality is retained rather than rebuilt from the stale bug list.
- Live deployment facts are recorded as verified or explicitly unknown.

---

## UP-02 — Make check results private and trustworthy by construction

**Priority:** P0.  
**Depends on:** None; coordinate tests with UP-01.  
**Primary areas:** check-related SQL migrations; `lib/checks/`; `lib/db/queries.ts`; `app/(public)/check/actions.ts`; `app/(public)/result/[id]/`.

### Evidence

The checked-in migrations leave a SELECT policy with `USING (true)` and permit anonymous reads of result identifiers, results, and questionnaire answers. A UUID lookup in the UI does not prevent collection reads through the database API. Anonymous INSERT is also broadly permitted, while the result page renders the stored result rather than recomputing it. This creates a source-level result-forgery path as well as a privacy concern. See S1–S4.

### Implement

Revoke public collection reads and direct client writes to the internal checks table. Anonymous submission must pass through a bounded server operation that validates answers and computes the result from a published rule version. Clients must not submit authoritative result objects, ownership fields, or verification metadata.

Keep private check viewing/claiming separate from deliberate sharing. Add an opt-in share record with an independent high-entropy token, stored token hash, expiry, revocation, and a minimal sanitized result snapshot. A narrow share lookup accepts that token and returns only the intended projection. It must not grant list access to checks or shares. Preserve the existing independent claim-token concept.

Remove or expire legacy public sharing after an explicit migration decision. Redact share tokens, answers, and secret ownership fields from analytics/logs. Add abuse limits to anonymous creation.

### Acceptance

- Anonymous users cannot enumerate internal checks or retrieve raw answers.
- A signed-in user cannot read another student's private check.
- Anonymous direct insertion of a precomputed result fails.
- A valid share token exposes only the consented projection; an expired/revoked token does not.
- Possessing a viewing token cannot claim ownership.
- Creating and claiming an anonymous result still works through the intended flow.

---

## UP-03 — Scope requirements and resolve exceptions coherently

**Priority:** P0 correctness.  
**Depends on:** UP-01.  
**Primary areas:** `lib/engine/evaluate.ts`, rule schema/admin editor, `scripts/rules.bootstrap.ts`, task-generation adapters.

### Evidence

The candidate `aps-not-required-visa-from-sa` produces a global APS exemption based on a visa checklist. The current uni-assist India instructions independently request APS for relevant Indian qualifications. The candidate `uni-assist-vpd-process` has empty conditions and consequently applies to every profile. Scalar rule outcomes use specificity, but documents and steps are merged from all matching rules. See S5–S7 and E2.

### Implement

Introduce explicit requirement scope: education assessment, programme admission, application processing, or visa. Attach the institution/programme/application/mission context when relevant. A visa-scoped statement must not override a uni-assist-scoped requirement.

Represent application route on the programme offering/application context: direct, uni-assist standard, VPD then university application, or unresolved/other. Generate uni-assist actions only for applicable routes. Do not generate a payment step when applicability is unknown. Respect already-completed procedures and funding alternatives.

For each requirement identity, resolve applicability first and then generate documents/tasks from the resolved result. Do not independently merge actions from overridden requirements. Retain the engine's honest unknowns and conflict reporting. Explicit exception/supersession metadata is preferable to trusting condition count alone for every future conflict.

Store official requirements separately from editorial planning advice. The bootstrap's eight-week blocked-account advice, for example, should not be labelled source-verified merely because the attached quote verifies an amount.

### Acceptance

- An India-qualified student living in Saudi Arabia does not get a blanket APS exemption for every purpose.
- A direct-application programme creates no uni-assist payment task.
- A VPD programme includes the subsequent university application, not just the VPD request.
- A resolved exemption cannot coexist with a generated instruction to perform that same scoped requirement.
- Existing completed certificates do not trigger duplicate initial-procedure tasks.
- A missing fact creates a targeted confirmation task instead of assumed applicability.

---

## UP-04 — Collect the qualifications needed for supported routes

**Priority:** P1; required before expanding eligibility claims.  
**Depends on:** UP-03.  
**Primary areas:** checker `steps.ts` and question definitions, profile editor, `lib/engine/evaluate.ts`, coverage tests.

### Implement

Preserve separate nationality, qualification country/system, and visa jurisdiction. Add current residence and qualification-awarding institution context where it changes the route. Avoid collapsing an Indian-board qualification earned abroad into a single nationality or residence label.

Use a Bachelor's/Master's discriminated profile. The Master's branch should capture the previous degree's institution, country, subject, qualification type, duration/credits as issued, completion status, grades and grading scale. Do not invent an ECTS equivalence.

Add prior university study to Bachelor's pathways when the reviewed rules require it. Collect language readiness and the student's current journey stage progressively, not as a huge mandatory initial form.

For supported APS/dMAT interpretation, collect the previous-degree classification and relevant procedure dates/statuses; an existing-certificate boolean alone does not represent transitional exemptions. Keep unknown/mixed fields for official confirmation. See E3 for the current example that motivates the data model; reverify at implementation.

Publish route-level coverage, not an assertion that an entire country is fully verified. Unsupported applicants may use planning features without receiving an invented admission verdict.

### Acceptance

- Master's applicants are not routed through school-only questions as the principal assessment.
- Prior-degree field is not replaced by intended Master's field.
- Missing exemption dates lead to an unresolved result rather than a guess.
- An unsupported nationality/qualification can be represented truthfully.
- Each published route has positive, negative, boundary, missing-data, and exception fixtures.

---

## UP-05 — Make an application belong to a programme and an intake

**Priority:** P1 foundation.  
**Depends on:** UP-01.  
**Primary areas:** applications schema, `lib/db/queries.ts`, course/admin models, dashboard.

### Evidence

Applications are currently deduplicated on `(user_id, course_id)`, and task generation uses the profile's single intake. This cannot represent repeat applications to the same programme in distinct cycles without ambiguity. See S8 and S9.

### Implement

Add explicit term/year to the application, with the profile preference used only as the creation default. Prefer a programme-offering record when routing/deadlines vary per intake and applicant group; do not create unnecessary institution microservices.

Migrate existing applications using known profile intake only when unambiguous. Otherwise require confirmation instead of fabricating a cycle. Change uniqueness to reflect the application cycle.

Track submission, decision, offer acceptance, and enrolment as separate states/events. Keep history when an applicant moves to a later intake. A global preference edit must not silently move submitted applications.

### Acceptance

- The same student can track the same programme in two different intakes.
- Deadline selection receives the application's intake, not an unrelated profile preference.
- Moving one application does not change another.
- Existing submitted application history is preserved.

---

## UP-06 — Replace inferred deadline selection with reviewed structured deadlines

**Priority:** P1 correctness; before reminders.  
**Depends on:** UP-05.  
**Primary areas:** `lib/tasks/generate.ts`, course extraction/admin review, dashboard calendar.

### Evidence

`parseDeadlineDate` takes the first explicit date; `deadlineForIntake` does not validate an explicit date's year against the requested intake; and selection can fall back to another term's dated line. These are source-code findings, not executed test results. See S10.

### Implement

Store deadline kind, programme/intake, applicant group, official raw wording, source version, verified closing date, optional time/timezone only when supported, and review status. Distinguish application opening, closing, VPD preparation targets, document supplements, and enrolment.

Treat extraction as a candidate generator. Ambiguous ranges, years, applicant categories, or portal stages require review. When a selected intake has no applicable deadline, return unresolved; do not silently select another intake.

Display the official wording alongside a reviewed normalized date. Store planning targets separately and label them as recommendations. Do not assume 23:59 or a timezone that the source does not establish.

### Required regression cases

- `Winter semester: 1 May 2027 – 15 July 2027` must not turn May 1 into the closing deadline.
- A `15 July 2026` deadline must not become a verified Winter 2027 deadline.
- Summer-only information cannot populate a Winter deadline.
- EU and non-EU lines cannot be merged into one universal date.
- An application-opening date is not a closing date.
- An undated recurring deadline is not silently promoted into a verified current-year deadline.
- Correct handling of date-only events, explicit times, leap days, and timezone transitions.

---

## UP-07 — Reconcile generated work and model real dependencies

**Priority:** P1 correctness.  
**Depends on:** UP-03, UP-05, UP-06.  
**Primary areas:** `lib/tasks/materialize.ts`, `lib/tasks/generate.ts`, `lib/tasks/view.ts`, task schema.

### Evidence

Materialization inserts missing keys but does not revise existing tasks after a profile/intake change. Admin course-task synchronization already contains useful preservation and review logic. Now/Next/Later is based on numeric order bands rather than actual dependencies. See S9 and S10.

### Implement

Reuse the existing admin synchronization pattern for a desired-state reconciliation operation. Track stable requirement identity, source/rule version, generated snapshot, personal overrides, and lifecycle state. Update untouched generated details; preserve edits and expose a change decision; supersede no-longer-applicable work without deleting completion history.

Add a small dependency model for the workflows actually supported. Support ready, blocked, waiting, completed, and no-longer-applicable states. Validate cycles. Keep ordering and preferred buckets as presentation choices, not dependency truth.

Run reconciliation on profile, application intake/status, rule publication, and course-definition changes. Use durable retryable jobs where fan-out crosses many users. Do not rely on another admin save eventually retrying a partial failure.

### Acceptance

- Changing intake replaces the old generated deadline while preserving a student note and completed work.
- Changing a route retires irrelevant payment/requirement tasks.
- Replaying the same event creates no duplicate tasks.
- Interrupted fan-out resumes safely and converges.
- A blocked task explains its dependency; a waiting task is not presented as immediately actionable.
- Rejected/withdrawn applications do not continue producing active submission work.

---

## UP-08 — Make course tracking useful before community approval

**Priority:** P1 activation.  
**Depends on:** UP-05, UP-06.  
**Primary areas:** course finder/add sheet, import API, `lib/ai/extract-course.ts`, admin review, course schema.

### Evidence

The current importer requires pasted page text for new URLs, stores pending courses, and does not generate approved-course tasks for those pending imports. A hidden pending duplicate from another user can yield a blocking 409. AI extraction requests verbatim text but does not validate evidence spans. Course task verification timestamps use `course.created_at`. See S10–S12.

### Implement

Launch with a curated programme set and a private manual-tracking path. A student can immediately store a programme, official link, personal notes, and clearly labelled unverified personal reminders. Community publication is a separate review decision.

Separate canonical programmes from submissions and user applications so duplicate pending submissions cannot prevent tracking. Keep verified public facts distinct from user assertions.

For extracted facts, store evidence text/spans, source URL, capture time, review time/reviewer, and a source hash/version where available. Validate quoted values against captured text; this guards extraction fidelity, not the authenticity of a user-supplied page. A reviewer must verify official provenance before public publication. Imported-at is never verified-at.

Keep manual fallback. Do not add unrestricted server-side URL fetching as a convenience patch. Any later fetcher needs network restrictions, redirect/IP checks, size/time limits, official-host policies, and respect for access conditions. The current no-fetch implementation is not an SSRF finding.

### Acceptance

- A new user receives a useful private workspace without waiting for an admin.
- A duplicate pending submission does not block tracking.
- Unreviewed facts never receive a verified badge.
- Every published deadline/requirement links to the exact reviewed evidence and cycle.
- Import/provider failure preserves the manual workflow.

---

## UP-09 — Deliver guided actions and a document-readiness workspace

**Priority:** P1 core product.  
**Depends on:** UP-04, UP-07, UP-08.

### Implement

Make each next-action card answer: why it applies, exactly what to do, where to do it, prerequisites, required inputs, expected evidence of completion, and the official source. Prefer one precise action to an unexplained paragraph or a vague checklist title.

Add a metadata-only document inventory with states such as missing, requested, received, translation needed, ready, and submitted. A single underlying document can satisfy requirements across applications, while programme-specific versions remain distinct. Do not assume a generic translation/certification rule applies everywhere.

For unresolved requirements, provide a prefilled, editable question to the university/official office; record the response and which requirement it resolves. Do not send it automatically or label a personal email reply as universal policy.

Programme comparison should include ownership, tuition, semester contribution, language evidence, prerequisites, route, applicable deadlines, and unresolved questions. Readiness is a checklist state, not an admission probability.

### Acceptance

- A student can explain the next action and complete it without asking the founder to interpret the UI.
- Completing a shared document updates relevant applications without overwriting programme-specific exceptions.
- Unknown requirements have a concrete confirmation action.
- Progress does not imply guaranteed eligibility, admission, or a visa.

---

## UP-10 — Add reliable reminders and calendar export

**Priority:** P1 retention; only after deadline correctness.  
**Depends on:** UP-06, UP-07.

### Implement

Start with opt-in email reminders, in-app attention items, and ICS export. Store delivery preferences and user timezone. Distinguish official deadlines from user-entered dates and planning targets in both UI and messages.

Use a durable outbox and an authenticated scheduled worker. Create deterministic delivery identities from user/application/deadline version/channel/reminder offset. Persist reservation, send status, retry state, and provider identifiers; handle bounced/failed delivery and worker overlap. A deadline revision must cancel or supersede obsolete reminders.

ICS events need stable UIDs and appropriate revision handling. Date-only deadlines must remain date-only rather than acquiring invented midnight timestamps. Calendar subscription feeds, if introduced, need revocable private tokens.

### Acceptance

- Retrying or running two workers does not duplicate the same reminder.
- Revising a deadline supersedes the previous notification schedule.
- Preferences/unsubscribe are respected.
- A failed delivery is observable to operators.
- Unverified user dates are clearly labelled; unresolved official deadlines are not presented as confirmed.

---

## UP-11 — Version and publish content as an operational release

**Priority:** P1 trust and maintenance.  
**Depends on:** UP-03; integrates with UP-07 and UP-10.  
**Primary areas:** rule/admin schema/actions, `scripts/seed.ts`, `scripts/embed-kb.ts`, KB retrieval.

### Evidence

Seed changes do not update existing slugs. KB rebuilding is manual and deletes existing chunks before inserting replacements in a separate operation. A code merge is not a published rule/KB update. See S13 and S14.

### Implement

Add immutable published rule/source versions with effective intake/date boundaries, reviewer, reviewed-at, review-due, explicit scope, evidence, and a superseded relationship. Preserve historical evaluation versions so an old result can be explained.

Publishing should validate the candidate, run reviewed personas, present a meaningful diff, publish the version, and enqueue affected-user reconciliation and notifications. Report source changes as review work; do not auto-publish changed web text as official interpretation.

For the small initial dataset, manually triggered review may be sufficient. Use monitoring to detect broken links/content changes, not to certify correctness. Make unresolved/stale/conflicting content visible to the operator and student where consequential.

If AI is enabled, build KB chunks against a versioned namespace, validate the complete new version, then atomically switch the active version. Never erase the serving KB before a replacement is ready. Retrieval must exclude superseded/inapplicable material.

### Acceptance

- A published fact has an attributable, dated review and applicable scope.
- Rule changes do not silently modify historical results.
- Changing a bootstrap candidate produces a review diff, not an unapproved overwrite.
- Failed KB publication leaves the previous healthy version available.
- Affected students can see what changed and what action, if any, follows.

---

## UP-12 — Contain the assistant and test evidence, not decoration

**Priority:** P0 while the assistant is exposed; otherwise defer behind a disabled server-side feature flag.  
**Depends on:** UP-02, UP-11 for full public release.  
**Primary areas:** `app/api/assistant/chat/route.ts`, `lib/ai/assistant.ts`, markers/renderer, evaluation scripts.

### Evidence

The API accepts client-supplied system/assistant roles and arbitrary message parts. Quota checking and question insertion are separate operations. Output markers are parsed but not checked against retrieved evidence; the evaluation accepts a single marker or unknown token rather than testing support for each factual claim. See S15–S17.

### Implement

Accept a bounded user message and an authorized conversation identifier. Reconstruct history server-side; do not trust browser-supplied system/tool messages. Apply request-byte, text, history/token, concurrency, timeout, and atomic usage-budget limits. Reject malformed or unauthorized history.

Attach an evidence set to each answer. Restrict citation IDs to sources actually retrieved, carry verification status and scope from the server, and reject nonexistent references. Remove hardcoded financial/admission facts from the system prompt and country-wide verification assertions.

Keep all eligibility and consequential task/deadline generation deterministic. The assistant explains existing verified context; it does not create requirements from free-form conversation. For critical answers, do not render unchecked streamed prose as already verified. Evidence-ID validation prevents fake references but does not prove entailment; test and review factual support separately.

Expand evaluation to invented citations, cited-but-unsupported numbers, superseded rules, wrong-country/intake context, missing exemptions, injected page text/history, outages, and cross-user isolation. Use session-scoped test clients when testing authorization, not only a service-role evaluation client.

### Acceptance

- Client system/tool-role injection is rejected.
- Concurrent requests cannot exceed the reserved budget.
- A fabricated source ID cannot produce a verified badge.
- An unsupported statement with one genuine citation does not count as a successful grounded answer.
- The application remains useful during model or embedding-provider outages.

---

## UP-13 — Add a bounded funding, visa, and enrolment handoff

**Priority:** P1 for the complete V1 promise; deeper automation is later.  
**Depends on:** UP-03, UP-09, UP-11.

### Implement

Create source-linked handoff checklists for the pilot's supported jurisdictions, selected from actual residence and competent mission rather than nationality alone. Distinguish online pre-check, appointment, decision, travel preparation, university offer acceptance, and enrolment. The correct next stage depends on the route and current student status.

Provide a budget worksheet separating tuition/semester contributions, application and examination fees, translations/travel, recurring living costs, and cash needed upfront. A blocked-account transfer should not be double-counted as both new spending and the living costs later funded from that account. Keep estimates, official fees, and funding evidence requirements visibly distinct.

Public ownership and tuition-free status must be independent fields; TUM's official non-EU tuition page is one example of why. Show funding alternatives only where confirmed by the responsible authority. Do not force every applicant into an affiliate product.

Keep this release to guidance, tracking, official links, and reminders. No visa filing, appointment bots, passport vault, or guaranteed processing-time claims.

### Acceptance

- An admitted student sees a relevant handoff rather than the application dashboard simply ending.
- A scholarship or other confirmed funding route is not overwritten by an unconditional blocked-account instruction.
- Visa instructions have jurisdiction and source metadata.
- Costs are transparent and not duplicated.

---

## UP-14 — Pilot with real applications and maintain a durable roadmap

**Priority:** Release gate.  
**Depends on:** Core workflow and trust tickets above.

### Implement

Recruit from the students already asking for help. Include different qualification/residence combinations and both direct and VPD/uni-assist applications. Ask students to bring real intended programmes; build the curated set around those programmes instead of a speculative national catalogue.

Observe whether they can finish their profile, track relevant programmes, identify the next action, prepare a required item, and explain an unresolved requirement without founder intervention. Compare these tasks against their existing workflow and DAAD Study Guide; do not assume a competitive gap based only on marketing descriptions.

Measure completed meaningful actions, applications advanced, user-reported confusion, deadline correctness, outstanding high-risk content reviews, and return visits during active applications. Do not optimize for chat-message count or raw sign-ups.

Publish privacy/data handling and correction channels; establish export/deletion handling and an operator for urgent errors. Keep university-ranking decisions separate from any commercial partnerships and disclose partnerships clearly.

Update `docs/STATUS.md`, the backlog, and decision records after each release. Every completed ticket should record what changed, evidence of verification, unresolved risks, and the next dependency.

### Suggested launch gate

- No known P0 privacy, authorization, or consequential correctness defects.
- Every programme presented as reviewed has verified route/deadline/requirement evidence for the supported applicant context and cycle.
- Security, migration, deterministic-domain, and critical browser suites run rather than silently skip.
- At least 8 of an initial 10 pilot students can complete the agreed activation journey without the founder narrating the UI. This is a proposed internal target, not an industry benchmark.
- Reminder failures and stale content are operationally visible.

## Explicitly defer

A large social community, agent marketplace, automated application submission, full document storage, nationwide scraping, scholarship matching at scale, admission-probability scoring, autonomous eligibility agents, and broad monetization experiments. A grade converter can be a small later acquisition tool; it is not the next core milestone.

## Sources

Source files are pinned to the reviewed commit. Official guidance was checked on the review date and must be checked again when implementing educational, visa, or financial interpretation.

- S1: [supabase/migrations/20260705100836_add_checks.sql](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/supabase/migrations/20260705100836_add_checks.sql)
- S2: [supabase/migrations/20260705143000_add_check_ownership.sql](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/supabase/migrations/20260705143000_add_check_ownership.sql)
- S3: [supabase/migrations/20260714090000_simplify_schema.sql](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/supabase/migrations/20260714090000_simplify_schema.sql)
- S4: [app/(public)/result/[id]/page.tsx](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/app/%28public%29/result/%5Bid%5D/page.tsx)
- S5: [lib/engine/evaluate.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/engine/evaluate.ts)
- S6: [scripts/rules.bootstrap.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/scripts/rules.bootstrap.ts)
- S7: [app/(public)/check/steps.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/app/%28public%29/check/steps.ts)
- S8: [lib/db/queries.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/db/queries.ts)
- S9: [lib/tasks/materialize.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/tasks/materialize.ts)
- S10: [lib/tasks/generate.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/tasks/generate.ts)
- S11: [app/api/courses/import/route.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/app/api/courses/import/route.ts)
- S12: [lib/ai/extract-course.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/ai/extract-course.ts)
- S13: [scripts/seed.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/scripts/seed.ts)
- S14: [scripts/embed-kb.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/scripts/embed-kb.ts)
- S15: [app/api/assistant/chat/route.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/app/api/assistant/chat/route.ts)
- S16: [lib/ai/assistant.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/lib/ai/assistant.ts)
- S17: [scripts/eval-assistant.ts](https://github.com/indkhan/unipirate/blob/29b477266990bda479a95357ea2acdc5578a03d5/scripts/eval-assistant.ts)
- E1: [DAAD Study Guide](https://www.study-guide.com/en/)
- E2: [uni-assist India document requirements](https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/)
- E3: [APS India dMAT scope and transitional exemptions](https://aps-india.de/dmat/)
- E4: [uni-assist VPD procedure](https://www.uni-assist.de/en/how-to-apply/plan-your-application/vpd/)
- E5: [TUM tuition for students from non-EU countries](https://www.tum.de/en/studies/fees/tuition)
- E6: [German Missions in Pakistan — student visa](https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104)
- E7: [German Missions in Saudi Arabia — visa service](https://saudiarabien.diplo.de/ksa-en/visa-service)
