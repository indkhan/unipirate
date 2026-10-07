# UP-ELIG-03 local implementation and verification

Issue: UP-ELIG-03. Branch: fix/up-elig-03-india-study.
Worktree: C:/codebases/unipirate-up-elig-03.
Baseline: 6107e4a6020857648544ebb166ec8d3349e342ae.
Session: this recorded issue conversation, continued after host interruptions;
a resumable session UUID is not exposed. Requested model: gpt-6.1-sol; no
authentication, billing, provider or model settings were changed.
Verification date: 2026-10-07. Commit SHA is returned in the final report.

## Review 1 repair

Root review reproduced two bugs despite the earlier green suite. The explicit
school issuer value unknown skipped India diagnostic facts, allowing the saved
legacy school UUID 8d95fa83-385f-4863-88cc-7dfe0a3036c6 to win. The engine now
admits that uncertainty only within the existing versioned Indian national
assessment scope; it preserves the actual issuer as unknown and does not infer
it from nationality, attendance or certificate country. Known PK/SA issuers,
IB/GCE and masters remain isolated; independent JEE coverage remains unchanged.

APS timing previously preceded mode/recognition/relationship. Answering these
academic questions correctly invalidated timing but forward navigation had passed
it. Timing now follows the completed academic assessments and target relationship.
The invalidation contract is unchanged: edits discard old timing and recollect it,
rather than preserving a stale date to satisfy validation.

Three regressions failed before either production repair: explicit unknown issuer,
fresh dynamic forward progression and partial/resumed forward progression. Both
flow regressions failed final AnswersSchema validation. Green tests also exercise
CheckFlow sessionStorage recovery after a mode edit, its first missing assessment,
and subsequent completion with newly answered APS timing and no retained old date.

## Review 2 mapper repair

The earlier engine-only test retained a version flag in a directly constructed
profile and missed its loss at buildProfile. Review 2 and root independently
reproduced the defect through AnswersSchema.parse -> buildProfile -> evaluate.
The smallest mapper change separates the diagnostic version from hidden reports:
explicit unknown school issuer retains qualificationHistory.indiaStudyRouteVersion
only for versioned Indian certificate-country, national curriculum/context,
bachelor target and prior bachelor history. It never supplies a recognised issuer.
Mode, recognition and relationship reports still map only through the established
isIndiaStudyBranch helper; hidden/stale assessment facts do not cross this boundary.
No engine, candidate, KB, schema, dependency or lockfile changes were made in this
repair. The repaired APS timing order and academic invalidation remain intact.

Fresh dynamic forward unknown-issuer answers and CheckFlow storage recovery after
an issuer edit both failed against the prior mapper with legacy Studienkolleg,
then passed through complete validation, mapping and evaluation after the fix.
Controls cover confirmed issuer positive, PK/SA actual issuers, international
context, unversioned history and missing issuer incomplete. Full acceptance,
foreign/distance coverage unknowns and prior timing regressions pass again.
The initial red run also exposed a test-only wrong enum value (other rather than
international); it was corrected before production code changed. The definitive
red log has exactly the two intended behavioral failures.

Root supplied a direct exact offline frozen node_modules install for this rerun.
No installation, dependency or lockfile change was performed by this session;
no extra tooling-directory test exclusion is needed for the final full command.
Generated next-env.d.ts is a pre-existing root build change, preserved and excluded
from the authored staging list. DB/build/browser gates remain root-owned; prior
root passes are not claimed as validation of this repaired tree.

### Review 2 exact commands and results

Cached Node/pnpm prefix and minimal application-credential-free environment above
remain in use. Every log below also has a .log.exit file.

| Command after prefix | Exit / result | Log relative to worktree |
| --- | --- | --- |
| exec vitest run india-study history-restoration --pool=threads --maxWorkers=1 --no-cache | 1; two intended mapper failures before production fix | test-results/up-elig-03/review2-boundary-red.log |
| exec vitest run india-study history-restoration up-test-01 --pool=threads --maxWorkers=1 --no-cache | 0; 170 tests, 6 files | test-results/up-elig-03/review2-focused.log |
| exec vitest run --pool=threads --maxWorkers=1 --no-cache --exclude lib/db/__tests__/rls.integration.test.ts | 0; 659 tests, 54 files; actual RLS excluded | test-results/up-elig-03/review2-full.log |
| run lint | 0 | test-results/up-elig-03/review2-lint.log |
| run typecheck --incremental false | 0 | test-results/up-elig-03/review2-typecheck.log |

Source evidence remains verified 2026-10-07, intake Winter 2026/27 (4053); all
15 candidates remain DRAFT and parent TEST coverage remains OPEN.

## Bounded contract

Reuse qualificationHistory; indiaStudyRouteVersion 1; reported mode, official
recognition assessment and target relationship assessment with bounded applicable
references. Positive rule has exactly 13 AND conditions: bachelor target, national
curriculum, actual Indian qualification issuer/national context, CBSE/CISCE/state
board, intake >=4053, Class XII >=70%, prior bachelor/India/regular, successful
years >=1, reported recognition confirmed and previous/closely-related target.
Successful years never come from duration, degree completion or ECTS conversion.
Reported assessments are not independent app verification or guaranteed admission.
School-only and successful-year routes are distinct; independent JEE remains
separate. The six new semantic keys leave generic legacy conditions inactive.

## Official evidence rechecked 2026-10-07

| Source | Literal short excerpt | Applicability |
| --- | --- | --- |
| [APS News, 23 February](https://aps-india.de/news/) | “One Successful Academic Year (Bachelor Level)” | Successful regular recognised bachelor study; Class XII >=70%; previous/closely related subjects. Effective Winter 2026/27 (4053), criteria update 15 March 2026. |
| [APS News, 16 March](https://aps-india.de/news/) | “completed and documented” | Attained academic stage; later qualifications can require a new evaluation. Certificate possession does not establish its bachelor basis or admission. |
| [DAAD India bachelor guidance](https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/) | “in home country in the relevant subject field” | Corroborates successful prior-year subject restriction; supplies no replacement effective date or programme guarantee. School-only prose is not applied to additional qualifying study. |
| [uni-assist India](https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/) | “an official overview of subjects and grades” | Attained university study documents; degree certificate if available, required after graduation; APS stays separate. |
| [APS FAQ](https://aps-india.de/faqs/) | “does not guarantee admission” | Qualification/institution recognition and admission discretion; nationality does not supply recognition. Distance/online variants need programme/period-specific applicability. |

The complete approved contract and prior analysis were reread. Saved published-rule
inventory is metadata, not factual proof. The exact old UUID
0e872b82-e7fb-41bb-9a35-53ecbe200df4 and its July metadata remain in the legacy
fixture and fail rule validation. Direct DAAD IN-12/IN-1Y records remain unverified;
foreign and distance/online variants remain targeted unknown. No anabin access or
access workaround occurred. These coverage limits do not block the narrow route.

## Acceptance evidence

| Contract criterion | Executed coverage / outcome | Basis |
| --- | --- | --- |
| CBSE/CISCE/state, 70/70.01%, 1/1.01/2 successful years | Positive subject_restricted; reported-evidence citation/date checked | APS dated eligibility notice |
| Previous/closely-related target with references | Positive; no field-string inference | APS + reported-assessment contract |
| Completed/ongoing/discontinued successful year | Positive, without general-access inference | APS attainment + uni-assist documentation + contract |
| Four-year duration with 0/.5/.99 successful years, enrolment/failed year | Targeted unknown: successful-year condition unmet; no duration inference | APS + history contract |
| Completed degree, years absent/null | Academic unknown; explicit null valid only versioned India; mapped completedYears absent | Contract |
| Recognition rejected/unknown/blank or absent reference/name only | Exact failed recognition or applicable-assessment unknown | APS FAQ + contract |
| Target unrelated/unknown/missing reference/equal strings alone | Exact subject-scope failure or target-assessment unknown | APS + contract |
| Another programme/target, Class XII-only certificate | UI instructs explicit unknown; certificate cannot supply reports | APS attained-basis notice + contract |
| Distance/online/other/unknown mode, foreign/unknown country | Targeted coverage unknown, no blanket rejection; explicit country uncertainty completes India flow | APS variants + bounded contract |
| Diploma/master/other prior study | Targeted bachelor-basis unknown | Bounded contract |
| Explicit no study and >=70% | Studienkolleg; JEE alternative preserved | APS + independent legacy route |
| Missing prior answer | Engine unknown; new checker incomplete | Contract |
| Missing grade/intake/issuer/context, including explicit unknown issuer with saved legacy fallback | No positive route; targeted applicability unknown beats unscoped school fallback | Contract |
| Intake 4052/4053/4054 | No new positive at SS2026; WS2026/27 and SS2027 positive | APS effective-intake notice |
| 69.99%, APS submission 14/15/16 March | 14 March transition unknown; 15/16 threshold insufficient; no grandfathered positive | Existing ELIG06 contract |
| Below threshold uncertain timing, held/missing/unknown certificate | Targeted APS complete-submission unknown; no certificate exemption | Existing ELIG06 |
| Passport Pakistan / visa Saudi, same qualification | Same academic positive result | APS issuer scope + contract |
| PK/SA qualification, IB/GCE/master | No new India route citation; unrelated generic keys remain rejected | Contract |
| Institution/country/type/mode/history edits | Recognition/relation references and APS timing pruned | Pure withAnswer tests |
| Previous field / intended target edits | Relation/reference pruned; recognition preserved | Pure withAnswer tests |
| Nationality/visa edits | Academic reports and APS milestone retained | Pure withAnswer tests |
| Progressive issuer/history questions, relationship after target, timing after assessments | Fresh forward and resumed complete schema pass; actual issuer precedes successful-years uncertainty | Contract |
| Empty/malformed/unfinished drafts | Finite out-of-range numbers and empty references retained; actions disabled; restoration reaches missing step | UI/restoration/validation tests |
| Negative/NaN/infinity/>50 successful years | Complete boundary rejected; finite unfinished drafts survive | Zod/isAnswered tests |
| Draft-only candidates / empty rules | No claimed published positive/citations | Engine tests |
| Equal-specificity opposing reviewed outcomes | Unknown with both source citations | Engine conflict test |
| Academic positive + APS outstanding | Subject restriction + qualification/application APS required + missing certificate preparation | Scoped APS coexistence test |
| Result and KB labels | Applicant-reported/not independently verified/university discretion; source metadata retained | Result/KB tests |
| Harness | Only successful-year India FUTURE moved to accepted executable coverage; CURRENT unchanged; other FUTURE rows and parent TEST remain OPEN | Harness tests |

## Exact commands and recorded results

Toolchain: cached pnpm 11.10.0 invoked through Node because pnpm was absent from
PATH; existing dependencies were reused through a worktree-local node_modules
junction. No installation or dependency upgrade occurred. Prefix for the commands
below was:

`node C:/Users/mgsuk/AppData/Local/node/corepack/v1/pnpm/11.10.0/bin/pnpm.mjs --config.verifyDepsBeforeRun=false`

The dependency verification option prevents this pnpm version from starting an
automatic install against the existing dependency directory; no check is weakened.
Final verification processes used a minimal OS/toolchain environment with no
application keys, secrets or provider variables. Vitest does not load .env.local.

| Command after prefix | Exit / result | Log relative to worktree |
| --- | --- | --- |
| exec vitest run india-study --pool=threads --maxWorkers=1 --no-cache | 1; four expected missing-feature failures before implementation | test-results/up-elig-03/red.log |
| exec vitest run india-study --pool=threads --maxWorkers=1 --no-cache | 1; decisive applicability and diagnostic failures before matrix corrections | test-results/up-elig-03/matrix-red.log |
| exec vitest run india-study --pool=threads --maxWorkers=1 --no-cache | 1; missing issuer and school-only/JEE conflict regression | test-results/up-elig-03/matrix-red-2.log |
| exec vitest run india-study --pool=threads --maxWorkers=1 --no-cache | 1; explicit unknown country/displayed reported-verdict regressions | test-results/up-elig-03/labels-country-red.log |
| exec vitest run india-study history-restoration up-test-01 --pool=threads --maxWorkers=1 --no-cache | 0; 163 tests, 6 files | test-results/up-elig-03/focused-final.log |
| exec vitest run --pool=threads --maxWorkers=1 --no-cache --exclude lib/db/__tests__/rls.integration.test.ts | 0; 652 tests, 54 files | test-results/up-elig-03/full-final.log and .log.exit |
| run lint | 0 | test-results/up-elig-03/lint-final.log and .log.exit |
| run typecheck --incremental false | 0; tsc --noEmit --incremental false | test-results/up-elig-03/typecheck-final.log and .log.exit |

One combined final call exceeded the host tool timeout after saving the full test
summary and lint log. Final commands were executed separately and exits recorded;
no pass is inferred from the interruption. Initial nonincremental typecheck found
readonly rule-array/optional metadata types; those were corrected and the final
nonincremental command exits 0. Early runner attempts failed on PATH/cmd quoting
and pnpm auto-install preflight; these are not test passes. Shell execution after
the host interruption failed at setup; local Node subprocesses completed verification.

## Repair verification commands

Same cached Node/pnpm prefix and minimal credential-free environment as above.

| Command after prefix | Exit / result | Log relative to worktree |
| --- | --- | --- |
| exec vitest run india-study --pool=threads --maxWorkers=1 --no-cache | 1; three reviewer regressions failed before production fixes | test-results/up-elig-03/review1-behavior-red.log and .log.exit |
| exec vitest run india-study history-restoration up-test-01 --pool=threads --maxWorkers=1 --no-cache | 0; 167 tests, 6 files | test-results/up-elig-03/review1-focused-final.log and .log.exit |
| exec vitest run --pool=threads --maxWorkers=1 --no-cache --exclude lib/db/__tests__/rls.integration.test.ts --exclude .orchestrator/** | 0; 656 tests, 54 files | test-results/up-elig-03/review1-full-repo.log and .log.exit |
| run lint | 0 | test-results/up-elig-03/review1-lint.log and .log.exit |
| run typecheck --incremental false | 0 | test-results/up-elig-03/review1-typecheck.log and .log.exit |

A first full attempt exceeded the 55-second subprocess timeout (no final exit;
review1-full.log). A nonblocking retry also discovered dependency-package tests
under the ignored local .orchestrator/dependency-install directory. It is not a
repository verification pass. An attempt to stop that launched runner was denied
by the host (taskkill PID 42228 returned Access denied); no permission bypass was
attempted. The final repository run adds --exclude .orchestrator/** to exclude
local tooling/dependencies, without changing Vitest configuration or excluding
any product test. Actual RLS integration remains excluded and root-owned.

## Publication and remaining gates

15 source-backed candidates remain DRAFT. Admin source/rule review and publication
are a separate step; runtime never imports bootstrap candidates. No seed, migration,
KB embed, DB write, provider smoke, merge, push, deployment or shared orchestration
write occurred. Existing dMAT structured KB quarantine was retained.
Root owns DB/build/browser/integration gates per the latest continuation instruction;
those were not executed here and are not claimed passing. No implementation/source
blocker remains for the bounded confirmed regular Indian bachelor route.

## Scoped changed files

- `app/(public)/check/__tests__/history-restoration.test.tsx`
- `app/(public)/check/__tests__/india-study-ui.test.tsx`
- `app/(public)/check/__tests__/india-study.fixture.ts`
- `app/(public)/check/__tests__/india-study.test.ts`
- `app/(public)/check/check-flow.tsx`
- `app/(public)/check/check-questions.ts`
- `app/(public)/check/profile-review.tsx`
- `app/(public)/check/steps.ts`
- `app/(public)/result/[id]/__tests__/india-study.test.ts`
- `app/(public)/result/[id]/result-model.ts`
- `docs/application.md`
- `docs/up-elig-03-verification.md`
- `lib/ai/kb.ts`
- `lib/engine/__tests__/india-study-legacy.fixture.json`
- `lib/engine/__tests__/india-study.fixture.ts`
- `lib/engine/__tests__/india-study.test.ts`
- `lib/engine/__tests__/up-test-01.harness-spec.ts`
- `lib/engine/__tests__/up-test-01.harness.test.ts`
- `lib/engine/evaluate.ts`
- `scripts/india-study.rules.ts`
- `scripts/rules.bootstrap.ts`

## Commit blocker

Scoped staging was attempted with an explicit list of the 21 files above.
`git add -- <explicit scoped files>` exited 128:

`fatal: Unable to create 'C:/codebases/unipirate/.git/worktrees/unipirate-up-elig-03/index.lock': Permission denied`

The supported sandbox lists linked Git metadata roots as writable, but the host
still denies this operation. The repair retried the explicit 21-file scoped staging
list; it again exited 128 with the identical index.lock permission error. Review 2
also retried that same authored list and exited 128; next-env.d.ts was excluded. No ACL
change, escalation, alternate Git storage or permission bypass was attempted.
No commit was created; there is no implementation commit SHA to report. HEAD
remains 6107e4a6020857648544ebb166ec8d3349e342ae. No scoped files were staged.
Root must restore write access to the existing linked Git metadata or perform
the reviewed scoped commit. This is the only remaining execution blocker; DB,
build, browser and integration checks remain root-owned deferred gates.
Git operation logs: test-results/up-elig-03/git-add.log and
test-results/up-elig-03/review1-git-add.log and
test-results/up-elig-03/review2-git-add.log (exit 128). Review 2 diff check exited 0
(test-results/up-elig-03/review2-diff-check.log and .log.exit). Earlier diff check exited 0,
logged at test-results/up-elig-03/diff-check.log.
