# UniPirate — GitHub Issues Backlog

Eligibility rule audit + AI course research redesign · 6 October 2026

**Purpose.** Each section below is intended to be opened as one independent GitHub issue / coding session. No code changes are included in this document.

**Repository snapshot.** indkhan/unipirate @ a2d4710bba5fa13a98edf030e4948872338b571d.

**Merge rule.** Do not merge an issue until its issue-specific acceptance tests pass plus pnpm test, pnpm lint, pnpm typecheck and pnpm build.

**Orchestrator rule.** Hard dependencies must be merged to main before a dependent session starts. Issues with no hard dependencies may start in parallel. “Parallel-safe” means logically independent; the conflict note still tells the orchestrator when a rebase/merge serialization is prudent.

## Issue index

| Issue | Priority | Title | Area |
| --- | --- | --- | --- |
| UP-ELIG-01 | P0 | Fix GCE/A-Level eligibility evaluation | Eligibility |
| UP-ELIG-02 | P0 | Complete IB recognition and school-exception rules | Eligibility |
| UP-ELIG-03 | P0 | Add India Class XII + one university year route | Eligibility |
| UP-ELIG-04 | P0 | Correct India JEE route | Eligibility |
| UP-ELIG-05 | P0 | Separate APS application/academic scope from visa scope | Eligibility |
| UP-ELIG-06 | P0 | Add APS transition-date facts | Eligibility |
| UP-ELIG-07 | P0 | Implement current dMAT scope and exemptions | Eligibility |
| UP-ELIG-08 | P0 | Implement Pakistan HSSC/FSc routes | Eligibility |
| UP-ELIG-09 | P0 | Replace Saudi certificate catch-all with certificate-specific routes | Eligibility |
| UP-ELIG-10 | P1 | Make unknown results diagnostic and actionable | Eligibility |
| UP-ELIG-11 | P1 | Expand profile model for qualification history | Eligibility |
| UP-PROC-01 | P0 | Remove unconditional uni-assist/VPD process rule | Process |
| UP-PROC-02 | P1 | Move visa/funding facts out of static stale process rules | Process |
| UP-COURSE-01 | P0 | Replace parser-first import with AI research draft + admin review | Course/AI |
| UP-COURSE-02 | P0 | Redesign course data for rich per-intake requirements | Course/AI |
| UP-COURSE-03 | P1 | Add field-level evidence review to admin | Course/AI |
| UP-RULES-01 | P1 | Version published eligibility rules | Rules |
| UP-TEST-01 | P0 | Create authoritative eligibility persona regression suite | Testing |

---

## UP-ELIG-01 — Fix GCE/A-Level eligibility evaluation

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01

**Blocks:** None.

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Mostly GCE engine/checker files; can run after test harness while profile-country work proceeds elsewhere.

### Problem

Current GCE logic can produce false failures/unknowns: it evaluates all entered A-levels together, infers school years, has incomplete target coverage, and has an overly broad Pakistan caveat.

### Finding

DAAD/anabin evaluate a qualifying set of three independent A-levels, normally grade C+, plus issuer/type, schooling duration, subject lists and target field. British/International A-levels studied in Saudi Arabia or Pakistan are not automatically local national certificates.

### Required outcome

Qualifying A-level users get the correct direct subject-restricted route regardless of citizenship/residence; failures state the exact unmet condition.

### Implementation scope

- [ ] Ask actual school years.
- [ ] Evaluate valid 3-AL combinations; ignore an extra low AL if a valid trio exists.
- [ ] Maintain DAAD List A/B/C classifications and independence rules.
- [ ] Add science, medicine/pharmacy and arts mappings.
- [ ] Remove blanket Pakistan GCE unknown; keep only genuine exceptions.

### Tests / merge gate

- [ ] Indian citizen + Saudi schooling + Cambridge/Pearson Math/Physics/Chemistry >=C + technical target => direct subject-restricted, not Studienkolleg.
- [ ] Same with fourth AL below C still passes if valid trio exists.
- [ ] Two qualifying ALs => formula not met, exact missing condition shown.
- [ ] Unrecognized issuer/subject => targeted confirmation.
- [ ] Unit/persona tests, lint, typecheck, build pass.

### Evidence

DAAD GCE; anabin GBR-BV09; DAAD GCE Lists A/B/C

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-02 — Complete IB recognition and school-exception rules

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01

**Blocks:** None.

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Mostly IB engine/checker files; can run alongside GCE after test harness, but both may touch shared checker schema—rebase carefully.

### Problem

Current IB rules omit grade compensation, current Math-SL school exceptions, older exam-year logic and alternative routes.

### Finding

KMK/DAAD recognition depends on exam year, six-subject structure, HL count, languages, sciences, mathematics, grades and current school annexes.

### Required outcome

IB results correctly distinguish general direct, subject-restricted, alternative/FSP and targeted missing-fact outcomes.

### Implementation scope

- [ ] Implement one-grade-3 compensation rule.
- [ ] Add current KMK Math-SL school/programme exceptions with effective sessions.
- [ ] Add 2021-2024 and <=2020 branches.
- [ ] Distinguish Diploma not awarded from official results available but paper pending.
- [ ] Do not automatically equate ordinary-rule failure with Studienkolleg.

### Tests / merge gate

- [ ] 2025+ compliant IB + Math HL => general direct.
- [ ] Math SL + valid exception => general direct.
- [ ] Compensated grade 3 passes where allowed.
- [ ] Legacy Math SL uses legacy rules.
- [ ] Effective-date regressions + full suite pass.

### Evidence

KMK IB agreement/2026 annexes; DAAD IB

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-03 — Add India Class XII + one university year route

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; do not start before UP-ELIG-11 lands.

### Problem

Published India one-year-university rules are skipped because the checker cannot collect required facts.

### Finding

Class XII >=70% plus one successfully completed academic bachelor year at a recognized institution can give direct access to previous/related subjects; school-only remains Studienkolleg.

### Required outcome

Eligible applicants receive direct subject-restricted access instead of generic unknown.

### Implementation scope

- [ ] Collect successful study duration, institution recognition, previous field, target-field relationship and status.
- [ ] Add matching derived facts.
- [ ] Keep school-only and one-year routes separate.
- [ ] Do not invent ECTS equivalence.

### Tests / merge gate

- [ ] Class XII >=70%, no prior year => Studienkolleg.
- [ ] Same + qualifying recognized related year => direct subject-restricted.
- [ ] Unrecognized/unrelated study => exact failed condition.
- [ ] Checker/profile/persona tests pass.

### Evidence

DAAD India IN-12/IN-1Y; anabin IND-BV01

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-04 — Correct India JEE route

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** None.

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; do not start before UP-ELIG-11 lands.

### Problem

Checker uses one generic 'valid JEE Advanced' boolean and can conflate JEE with the 70% school pathway.

### Finding

Official route requires successful JEE Main and Advanced and gives direct access to technology/natural-science fields; current anabin treats it separately from the school-route threshold.

### Required outcome

JEE applicants are evaluated from explicit Main + Advanced facts and target field.

### Implementation scope

- [ ] Collect Main and Advanced separately.
- [ ] Restrict route to eligible technology/natural-science targets.
- [ ] Do not impose the 70% school-route threshold without a source.

### Tests / merge gate

- [ ] Main + Advanced + technical target => direct subject-restricted.
- [ ] Advanced missing/failed => JEE route not satisfied.
- [ ] Unrelated target does not get general access.
- [ ] Boundary/persona tests pass.

### Evidence

DAAD India JEE; anabin IND-BV02

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-05 — Separate APS application/academic scope from visa scope

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01

**Blocks:** UP-PROC-02, UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches APS/result/task model; can run independently of profile-history work but should land before visa/funding refactor.

### Problem

Current model can globally mark APS not required because the visa is filed in Saudi Arabia, potentially erasing APS needed for recognition, uni-assist or university application.

### Finding

APS for Indian qualifications/application and a mission's visa-document checklist are different scopes.

### Required outcome

App can show APS required for application/recognition while separately showing that a mission does not list it as a visa document.

### Implementation scope

- [ ] Replace one APS flag with scoped requirements: qualification/application/visa.
- [ ] Remove global Saudi-visa APS exemption.
- [ ] Keep responsible mission separate.
- [ ] Prevent contradictory scoped tasks/documents.

### Tests / merge gate

- [ ] Indian qualification + Saudi visa filing does not erase application APS.
- [ ] Saudi visa scope can omit APS while uni-assist scope requires it.
- [ ] Non-Indian qualification not forced into APS India.
- [ ] Scoped conflict tests pass.

### Evidence

APS India FAQ; uni-assist India; KMK APS; German Missions Saudi Arabia

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-06 — Add APS transition-date facts

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; wait for UP-ELIG-11.

### Problem

A published India transition rule is skipped because checker lacks relevant APS timing facts.

### Finding

APS India published a March 2026 transition boundary; answer depends on procedure/status and timing, not only an existing-certificate boolean.

### Required outcome

Affected users get the correct pre/post-transition rule or one precise date/status question.

### Implementation scope

- [ ] Collect APS procedure/status and relevant registration/application/submission dates only when needed.
- [ ] Add missing date facts.
- [ ] Version effective boundary/source.

### Tests / merge gate

- [ ] Before boundary selects transition rule.
- [ ] After boundary selects current rule.
- [ ] Missing date asks only for needed timing fact.
- [ ] Boundary-date tests pass.

### Evidence

APS India News, Feb/Mar 2026

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-07 — Implement current dMAT scope and exemptions

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; wait for UP-ELIG-11.

### Problem

Several published dMAT rules are skipped because prior-degree field, partnership status and APS timing facts are unsupported.

### Finding

dMAT depends on master's context, previous-degree classification, affected-field list, APS status/timing and exemptions.

### Required outcome

Indian master's applicants receive required/not-required/targeted-review results from actual prior-degree/procedure facts.

### Implementation scope

- [ ] Collect prior-degree field, partnership status and relevant APS dates.
- [ ] Version affected-field list.
- [ ] Map previous degree, not intended master's title.
- [ ] Implement official exemptions/transitions.

### Tests / merge gate

- [ ] Bachelor => dMAT not required.
- [ ] Applicable existing-APS exemption works.
- [ ] Affected field + applicable procedure => required.
- [ ] Unaffected/exempt => not required.
- [ ] Ambiguous classification => targeted review.

### Evidence

APS India dMAT + affected-fields PDF

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-08 — Implement Pakistan HSSC/FSc routes

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; wait for UP-ELIG-11.

### Problem

Pakistan national-board applicants have limited usable routing despite clear official stream/prior-study rules.

### Finding

HSSC/FSc >=50% has stream-specific Studienkolleg access; one successful recognized university year can give direct access to previous/related subjects.

### Required outcome

Pakistani applicants get stream-specific known outcomes and exact unmet conditions.

### Implementation scope

- [ ] Collect HSSC stream, percentage and prior university-study facts.
- [ ] Implement science/commerce/humanities Studienkolleg routes.
- [ ] Implement one-year related-subject direct routes.
- [ ] Treat <50% as unmet for this route; evaluate other qualifications separately.
- [ ] Keep narrow two-year-degree source discrepancy as review-only.

### Tests / merge gate

- [ ] Each stream >=50%, no prior study => matching Studienkolleg.
- [ ] One recognized related year => direct subject-restricted.
- [ ] 49.99/50 boundary correct.
- [ ] All stream tests pass.

### Evidence

DAAD Pakistan admission database; anabin PAK-BV01/02/03

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-09 — Replace Saudi certificate catch-all with certificate-specific routes

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-TEST-01, UP-ELIG-11

**Blocks:** UP-ELIG-10

**Parallel-safe with:** UP-COURSE-02

**Orchestrator conflict note:** Touches shared profile/checker schema; wait for UP-ELIG-11.

### Problem

Saudi certificate labels are too coarse; published prior-study rules are skipped because facts are missing.

### Finding

anabin distinguishes national certificates, US-accredited private-school diplomas, industrial diplomas and completed degrees, with different prior-study requirements and Fachhochschule restrictions.

### Required outcome

Saudi qualifications produce the correct route and institution-type restriction.

### Implementation scope

- [ ] Model exact certificate type/stream.
- [ ] Collect prior-study years, institution recognition and field relationship when needed.
- [ ] Implement national school/one-year routes.
- [ ] Implement private-school one-year Studienkolleg and two-year direct routes.
- [ ] Implement industrial routes with Fachhochschule restriction.
- [ ] Represent completed recognized bachelor separately.

### Tests / merge gate

- [ ] National streams route correctly.
- [ ] Private-school one vs two years differ.
- [ ] Industrial result carries Fachhochschule restriction.
- [ ] Missing subtype asks only for subtype.
- [ ] Saudi family tests pass.

### Evidence

anabin SAU-BV01/02/03/04/05/BV6; uni-assist Saudi Arabia

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-10 — Make unknown results diagnostic and actionable

P1  •  Independently actionable GitHub issue

**Hard dependencies:** UP-ELIG-03, UP-ELIG-05, UP-ELIG-06, UP-ELIG-07, UP-ELIG-08, UP-ELIG-09

**Blocks:** None.

**Parallel-safe with:** UP-COURSE-01, UP-COURSE-03

**Orchestrator conflict note:** Cross-cutting engine/result UX; merge after the route issues it summarizes.

### Problem

Generic unknown messages combine failed conditions, missing facts, true conflicts and unsupported cases.

### Finding

Many current unknowns can be resolved by one missing answer or can already be stated as a known unmet condition.

### Required outcome

Results classify as known route, known unmet condition, targeted missing fact, source conflict or genuinely unsupported.

### Implementation scope

- [ ] Add structured reason/status codes.
- [ ] Surface decisive missing/unmet facts.
- [ ] Generate one targeted follow-up question where possible.
- [ ] Reserve official-source confirmation for genuine unsupported/conflicting cases.

### Tests / merge gate

- [ ] Missing prior-study fact asks for it.
- [ ] Failed threshold states it.
- [ ] Equal-specificity conflict remains unknown with sources.
- [ ] Engine regressions pass.

### Evidence

Cross-cutting rule-audit finding

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-ELIG-11 — Expand profile model for qualification history

P1  •  Independently actionable GitHub issue

**Hard dependencies:** None — may start immediately.

**Blocks:** UP-ELIG-03, UP-ELIG-04, UP-ELIG-06, UP-ELIG-07, UP-ELIG-08, UP-ELIG-09, UP-ELIG-10

**Parallel-safe with:** UP-TEST-01, UP-COURSE-02

**Orchestrator conflict note:** High conflict with eligibility issues that edit checker/profile schemas. Land this before dependent country-rule sessions.

### Problem

Checker cannot represent enough educational history to execute known India, Pakistan, Saudi and master's rules.

### Finding

Missing profile facts—not missing official guidance—cause several published rules to be skipped.

### Required outcome

Profile progressively captures route-relevant education facts while keeping nationality, qualification country and visa jurisdiction distinct.

### Implementation scope

- [ ] Add previous institution/country, qualification type, field, duration and completion status.
- [ ] Add prior university study for bachelor routes.
- [ ] Use progressive branching.
- [ ] Keep nationality, qualification country and visa jurisdiction separate.

### Tests / merge gate

- [ ] Bachelor asks prior-study only when useful.
- [ ] Master path no longer relies mainly on school facts.
- [ ] Changing qualification prunes stale answers.
- [ ] Backward-compatibility tests pass.

### Evidence

Required by audited routes

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-PROC-01 — Remove unconditional uni-assist/VPD process rule

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-COURSE-02

**Blocks:** None.

**Parallel-safe with:** UP-ELIG-01, UP-ELIG-02

**Orchestrator conflict note:** Depends on structured programme/intake application route from UP-COURSE-02.

### Problem

An empty-condition repository rule adds uni-assist/VPD steps to every applicant.

### Finding

uni-assist/VPD applies only when the programme uses it; a VPD is followed by a separate university application.

### Required outcome

Tasks come from the reviewed programme application route, never globally.

### Implementation scope

- [ ] Add route: direct / uni-assist / VPD-then-university / unresolved.
- [ ] Disable global empty-condition rule.
- [ ] Generate fees/tasks only when applicable.
- [ ] For VPD, create subsequent university-application step.

### Tests / merge gate

- [ ] Direct => no uni-assist task/fee.
- [ ] VPD => VPD + university application.
- [ ] Standard uni-assist => correct path.
- [ ] Unknown route => targeted confirmation, no invented payment.
- [ ] Task tests pass.

### Evidence

uni-assist VPD + fee guidance

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-PROC-02 — Move visa/funding facts out of static stale process rules

P1  •  Independently actionable GitHub issue

**Hard dependencies:** UP-ELIG-05

**Blocks:** None.

**Parallel-safe with:** UP-COURSE-01

**Orchestrator conflict note:** Depends on APS scoping from UP-ELIG-05; otherwise parallel with course AI work.

### Problem

Static rules contain time-sensitive visa fees/funding figures and mix visa jurisdiction into academic routing.

### Finding

Mission pages change local-currency fees and financial-proof details; these are visa-stage facts.

### Required outcome

Visa/funding guidance is separately sourced, dated, jurisdiction-specific and updateable.

### Implementation scope

- [ ] Separate academic and visa/funding requirements.
- [ ] Store amount/currency/source/verified-at/effective date/alternatives.
- [ ] Do not label planning advice as official requirement.
- [ ] Flag stale sources for admin review.

### Tests / merge gate

- [ ] Visa fee change does not alter academic route.
- [ ] Stale amount becomes review-needed.
- [ ] Jurisdiction task only appears for relevant user.
- [ ] Version tests pass.

### Evidence

German Missions India/Pakistan/Saudi; Make it in Germany

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-COURSE-01 — Replace parser-first import with AI research draft + admin review

P0  •  Independently actionable GitHub issue

**Hard dependencies:** UP-COURSE-02

**Blocks:** UP-COURSE-03

**Parallel-safe with:** UP-PROC-02, UP-ELIG-10

**Orchestrator conflict note:** Depends on rich course schema; can then run independently of eligibility work.

### Problem

Current importer parses pasted text first and lets AI fill only missing fields that literally occur in the paste. It cannot build a rich programme record.

### Finding

Because imported courses are admin-reviewed, AI can use the pasted page as a seed, research official university/DAAD/uni-assist pages and PDFs, and create a richer draft with evidence.

### Required outcome

Paste + URL starts research that produces a detailed source-linked draft; nothing becomes verified until admin publishes it.

### Implementation scope

- [ ] Send pasted page + URL + programme identity to research workflow.
- [ ] Use web research with official sources preferred/restricted.
- [ ] Research deadlines by applicant type/intake, route, prerequisites, language evidence/exemptions, tuition/semester fees, documents and application links.
- [ ] Store evidence/source per consequential field.
- [ ] Keep AI output pending until admin approval.
- [ ] Allow partial unresolved drafts rather than fabrication.

### Tests / merge gate

- [ ] Known programme yields multi-source draft.
- [ ] Every consequential field has evidence or unresolved status.
- [ ] Conflicts are surfaced to admin.
- [ ] AI/web failure preserves manual/paste workflow.
- [ ] No AI-only draft receives verified status.
- [ ] Importer/admin tests pass.

### Evidence

Current lib/ai/extract-course.ts + import route; agreed product direction

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-COURSE-02 — Redesign course data for rich per-intake requirements

P0  •  Independently actionable GitHub issue

**Hard dependencies:** None — may start immediately.

**Blocks:** UP-COURSE-01, UP-COURSE-03, UP-PROC-01

**Parallel-safe with:** UP-TEST-01, UP-ELIG-11

**Orchestrator conflict note:** High conflict with course/import/admin schema work. Land before UP-COURSE-01/03 and UP-PROC-01.

### Problem

Current course records are broad text fields and cannot cleanly represent per-intake deadlines, applicant groups and routes.

### Finding

Programme facts vary by intake, applicant group and application procedure; AI research needs structured storage plus raw evidence.

### Required outcome

One canonical programme has reviewed offerings/requirements for specific intakes and contexts.

### Implementation scope

- [ ] Separate canonical programme from intake/offering facts.
- [ ] Structure deadlines, route, language, prerequisites, fees, documents and applicability.
- [ ] Keep verbatim evidence/source metadata beside normalized values.
- [ ] Preserve historical reviewed versions.

### Tests / merge gate

- [ ] Winter/Summer facts coexist independently.
- [ ] Applicant-group deadlines do not collapse.
- [ ] Source wording remains available.
- [ ] Migration preserves existing courses/applications.
- [ ] DB/RLS/migration tests pass.

### Evidence

Required by AI research import

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-COURSE-03 — Add field-level evidence review to admin

P1  •  Independently actionable GitHub issue

**Hard dependencies:** UP-COURSE-02, UP-COURSE-01

**Blocks:** None.

**Parallel-safe with:** UP-ELIG-10

**Orchestrator conflict note:** Depends on both rich schema and AI research draft format.

### Problem

Richer AI research needs a faster admin verification surface than reviewing one coarse imported record.

### Finding

Admin review is the accepted safety boundary for AI-generated course research.

### Required outcome

Admin can approve/edit/reject important researched facts with evidence and publish only reviewed information.

### Implementation scope

- [ ] Show field value, source URL, evidence snippet, retrieval date and AI notes.
- [ ] Highlight conflicts/unresolved fields.
- [ ] Allow field/section accept-edit-reject.
- [ ] Record reviewer, reviewed-at and source version/hash.
- [ ] Verified badge only for reviewed facts.

### Tests / merge gate

- [ ] One field can be corrected without discarding rest.
- [ ] Conflicting deadline requires explicit resolution.
- [ ] Published fact stores reviewer/time/source.
- [ ] AI-only draft never renders verified.
- [ ] Admin/audit/RLS tests pass.

### Evidence

Existing admin review workspace + agreed AI workflow

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-RULES-01 — Version published eligibility rules

P1  •  Independently actionable GitHub issue

**Hard dependencies:** None — may start immediately.

**Blocks:** None.

**Parallel-safe with:** UP-TEST-01, UP-COURSE-02

**Orchestrator conflict note:** Touches rule schema/admin/engine; logically independent, but avoid merging concurrently with large rule-schema migrations without rebasing.

### Problem

Rules can change while results are re-evaluated, making historical explanations and change impact harder to understand.

### Finding

Consequential rules need effective scope/intake/date, reviewer metadata and supersession history.

### Required outcome

Every published result can be explained against a reviewed rule version and changes can identify affected users.

### Implementation scope

- [ ] Create immutable published versions with effective scope/intake/date.
- [ ] Record reviewer, reviewed-at, evidence and supersession.
- [ ] Retain historical evaluation metadata.
- [ ] Show meaningful diff before replacement publish.

### Tests / merge gate

- [ ] Old result can identify original rule version.
- [ ] Future-effective rule does not affect earlier intake.
- [ ] Superseded rule excluded from current evaluation but remains auditable.
- [ ] Migration/engine/admin tests pass.

### Evidence

Rule-maintenance conclusion

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## UP-TEST-01 — Create authoritative eligibility persona regression suite

P0  •  Independently actionable GitHub issue

**Hard dependencies:** None — may start immediately.

**Blocks:** UP-ELIG-01, UP-ELIG-02, UP-ELIG-03, UP-ELIG-04, UP-ELIG-05, UP-ELIG-06, UP-ELIG-07, UP-ELIG-08, UP-ELIG-09

**Parallel-safe with:** UP-COURSE-02, UP-RULES-01

**Orchestrator conflict note:** Low conflict; mostly test fixtures/CI.

### Problem

Rule-engine tests alone are not enough for the expanded country/qualification matrix.

### Finding

Each supported route needs a human-reviewed expected-result corpus covering positive, negative, boundary, missing-data and exception cases.

### Required outcome

No eligibility-rule issue merges unless its official personas pass.

### Implementation scope

- [ ] Create versioned personas for GCE, IB, India, Pakistan, Saudi, APS and dMAT.
- [ ] Store expected route/flags/reasons and source IDs.
- [ ] Include cross-country cases such as Indian citizen + Saudi A-levels.
- [ ] Run suite in CI with ordinary tests.

### Tests / merge gate

- [ ] Every supported route has positive/negative/boundary/missing-data fixture.
- [ ] Cross-country qualification case passes.
- [ ] Changing a rule that alters expected result fails CI until explicitly reviewed.
- [ ] pnpm test/lint/typecheck/build all pass.

### Evidence

All official-source findings in 6 Oct 2026 audit

### Definition of done

Implementation is complete, behavior is covered by the tests above, official-source evidence is preserved in the code/data model, and the full repository quality suite passes.

---

## Orchestrator execution waves

### Wave 0 — fire immediately in parallel

UP-TEST-01, UP-ELIG-11, UP-COURSE-02, UP-RULES-01. These have no hard dependencies. UP-RULES-01 is logically independent but should rebase carefully if rule-schema files changed.

### Wave 1A — after UP-TEST-01

UP-ELIG-01, UP-ELIG-02, UP-ELIG-05 can run in parallel.

### Wave 1B — after UP-TEST-01 + UP-ELIG-11

UP-ELIG-03, UP-ELIG-04, UP-ELIG-06, UP-ELIG-07, UP-ELIG-08, UP-ELIG-09 can be separate sessions in parallel. They share checker/profile files, so merge one at a time and rebase each remaining branch after every merge.

### Wave 1C — after UP-COURSE-02

UP-COURSE-01 and UP-PROC-01 can run in parallel.

### Wave 2

UP-PROC-02 starts after UP-ELIG-05. UP-COURSE-03 starts after UP-COURSE-01 + UP-COURSE-02.

### Wave 3 — final eligibility UX convergence

UP-ELIG-10 starts after UP-ELIG-03, 05, 06, 07, 08 and 09 are merged. Rebase it on the final engine/result model.

### Merge protocol

Before any session merges: fetch latest main, rebase/merge main, resolve shared-file conflicts, rerun that issue’s acceptance tests and the full repository gate. A green branch created before a dependency merged is not merge-ready.
