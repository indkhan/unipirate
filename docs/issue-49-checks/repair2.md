# PR 65 round-two route-applicability repair

Repair base: `32cd792bb482a740a7c946fda99b79658ae2d7e3`. Work is confined to
`C:/codebases/unipirate-issue-49`, branch `fix/issue-49-qualification-guidance`.
Root main remains clean at `b773630298ff9a358e843ab4be51e7bf4e10d874`.
The final tested commit and new CI status are recorded in the PR response after push.

## Findings and response

Round two's P2 reproduced with `ordinaryIb` HL subjects, the independent
qualification-guidance marker and the `duplicate006880` school identity, through
`evaluateAssessment`, immutable version selection, `parseStoredAssessment` and
actual `VerdictCard` rendering. The test expected qualification guidance but got
`source_conflict`: unconditional display priority selected an SL-only candidate.
The unchanged SL cases passed before this repair.

Display selection now compares the conflict candidate's literal failed comparisons
with passed comparisons for the same actual fact in the closest qualification
candidate. A known contradiction identifies an inapplicable alternative; missing
or unresolved applicability cannot supply that contradiction. This uses existing
rule comparisons, with no school-code, title, route-key, threshold or duration
mapping. Engine diagnostics, candidate citations and protected original payloads
are retained in full. Equal-specificity resolver conflicts and supported winners
keep their existing priority.

The original round-one SL finding remains fixed: the applicable conflict is visible,
cited and accompanied by the recognition-authority next action. Round-two HL guidance
is no longer overridden by the SL candidate, including when an HL grade is unknown.
All versioned cases retain unknown full recognition, no path citations or admission
tasks, and no duration follow-up. Stored answers, versions and assessment payloads
are asserted unchanged.

Nine focused rendering tests include the paired HL/SL cases, legacy SL, incomplete
HL grade, SL unmet grade, a synthetic same-HL-route source conflict that must stay
visible, and a synthetic examination-boundary mismatch. Synthetic immutable copies
and boundary modifications are test controls, not published policy. Both passed HL
checks and incomplete HL checks failed before their respective fixes. Strict rule
parsing uses the existing `EngineRuleSchema` at the test-fixture boundary.

## Source review on 2026-10-10

[DAAD IB guidance](https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/)
was opened directly with official browsing. Its mathematics section distinguishes
ordinary AA/AI HL general access from SL subject scope and the listed-school annex
exception; it also retains ordinary recognition prerequisites and the nonbinding
orientation limitation. This supports route separation, not an attendance exemption.
No source condition, annex record, source quote or verification date was changed.
No fabricated years, tertiary A-level label or full verified match was introduced.

## Final verification

- Focused renderer command: `pnpm exec vitest run 'app/(public)/result/[id]/__tests__/qualification-guidance.test.tsx'`: **9 passed**, zero skips.
- Connected command: `pnpm exec vitest run 'app/(public)/result/[id]/__tests__' lib/engine/__tests__/qualification-guidance.test.ts lib/engine/__tests__/ib.test.ts lib/engine/__tests__/gce.test.ts lib/engine/__tests__/diagnostics.test.ts lib/engine/__tests__/up-test-01.assessment.test.ts lib/rules/__tests__ 'app/(public)/check/__tests__/qualification-guidance.test.ts' 'app/(public)/check/__tests__/qualification-guidance-ui.test.tsx' 'app/(public)/check/__tests__/steps.test.ts'`: **895 passed**, 24 files, zero skips.
- Environment-enabled `pnpm test`: **2,835 passed**, 136 files, zero skips. Final run started 2026-10-10 02:37:17 Europe/Berlin, duration 172.70 seconds, captured `CHILD_EXIT=0` and outer exit 0.
- Separate actual disposable DB/RLS run: **32 passed**, two files, zero skips. Started 2026-10-10 02:40:53 Europe/Berlin; duration 11.43 seconds, `CHILD_EXIT=0` and outer exit 0.
- `pnpm lint`: exit 0, three existing unrelated unused-argument warnings in the research-course test.
- `pnpm typecheck --incremental false`: exit 0, including after restoring generated `next-env.d.ts`. An initial test-fixture typing error was corrected with strict engine-rule parsing.
- Default `pnpm build`: exit 0, production TypeScript/prerender complete. Its initial run caught stale generated dev types referencing the removed temporary route. Only that generated dev-types directory was removed, then the default build passed. No preview route remains in the route table or commit.
- `git diff --check`: clean. All 27 literal revision hashes, combined SHA256 digest and `ENGINE_REVISION` agree with [engine-revision.json](engine-revision.json). Existing protected revision tokens are not rewritten.

The test launcher loads `.env.local` before collection and explicitly rejects any
API other than `http://127.0.0.1:55321`; service/public credentials must be present.
It assigns `COURSE_PROCESS_LOCAL_API`, `COURSE_PROCESS_LOCAL_PUBLIC_KEY` and
`COURSE_PROCESS_LOCAL_SERVICE_KEY` from those corresponding disposable values in
memory, then calls `pnpm.cmd` with inherited environment and captures its real
child exit code. No credentials are printed. Exact final invocation:
`node --env-file=.env.local <temporary issue49-r2-run.cjs> test`.
The separate gate uses the same launcher with
`exec vitest run lib/db/__tests__/rls.integration.test.ts lib/db/__tests__/course-process.integration.test.ts`.
No database contract or migration changed. Only the mandated disposable RLS fixtures
perform synthetic publication; no linked database, 563xx service, live publication,
seed, embedding, OpenRouter/Tavily inference, issue closure or merge was performed.
No implementation delegation or issue-50-through-60 work occurred.

## Browser checks and limits

T3 `preview_status` and `preview_open` were used first, on the issue worktree's own
3049 server. A temporary local-only route rendered the actual assessment -> strict
immutable parsing -> VerdictCard chain for both ordinary HL and conflicted SL using
in-memory sourced candidates. At 390x844, 768x1024 and 1440x900, in actual light/dark
app themes, HL guidance displayed without the irrelevant SL conflict; SL displayed
its conflict, source link and recognition-authority action. No duration nag or
horizontal overflow occurred in those cards. The route was removed before the
successful final build. [Measurements](repair2-browser.json) and
[desktop dark screenshot](repair2-hl-sl-desktop-dark.png) retain the evidence.

The actual checker restored a legacy draft parked at `gceSchoolYears` to subject
editing, removed only the editable duration answer, and retained awarding-body
navigation through Back and refresh. The original fixture remains unchanged.
Mounted profile/branch tests execute in the connected and full suites; the entire
original manual certificate/profile matrix was not independently repeated for
this display-only repair.

The final production build read the existing real disposable IB check
`ab9f611a-c9a3-434c-9622-79d579a35889` at all six viewport/theme combinations.
Original protected assessment and current reassessment remain available, unknown,
and without duration prompts. The disposable service has no scoped published IB
rule, so this is not evidence of deployed HL/SL rule publication. The current read
also sees unrelated synthetic/legacy RLS artifacts and honest scope unknowns.
The original provenance text still overflows at mobile width (704px at 390px),
with no overflow at tablet/desktop; that existing result layout is unchanged and
remains recorded for #54. These are Chromium CSS viewport checks, not native-device
or live provider/production acceptance. No blocker to the focused repair was found.
