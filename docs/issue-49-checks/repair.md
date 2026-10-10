# PR 65 source-conflict repair

Repair base: `a141b97f8d20ca145ab5bce0f66166a9b1f37182`. The implementation
stays in the exclusive issue-49 worktree and branch. Root main remains clean at
`b773630298ff9a358e843ab4be51e7bf4e10d874`.

The independent P2 finding reproduced through the existing IB `duplicate006880`
profile, `evaluateAssessment`, selected immutable versions, protected assessment
parsing and `VerdictCard`. With the new guidance marker, the primary diagnostic
was `known_unmet_condition` despite a retained annex `source_conflict` diagnostic.
The legacy marker already selected the conflict, but lacked the explicit
recognition-authority next action. Both new assertions failed before the repair.

For an unresolved route, source conflicts now precede ranked qualification
diagnostics and follow-ups. The verdict's qualification-summary fallback also
preserves the conflict label. Its literal failed condition, exact selected source
and recognition-authority next action remain visible. Selection uses diagnostic
status, not arbitrary rule names. Supported winners keep their existing priority.
No engine conditions, academic thresholds, duration facts or stored history change.
The current revision and its 27 literal inputs are updated in
[engine-revision.json](engine-revision.json); all hashes and the combined identity match.

The two regression cases cover legacy/new guidance markers, renamed candidate
slugs, actual immutable selection, strict original parsing and rendered citation.
They assert unknown full recognition, no path citation or tasks, no follow-up,
absence of versioned duration, and unchanged answers, versions and stored payload.
The original engine conflict diagnostic remains present rather than being rewritten.

## Official evidence rechecked on 2026-10-10

[DAAD IB guidance](https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/)
distinguishes examination/session, subjects, levels, grades and schooling conditions;
its orientation does not bind recognition authorities. The directly linked
[KMK agreement and annexes](https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/aktuell/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2023-06-15_Liste1__2026-03-26_Liste2-2024-11-19.pdf)
were opened and page 9 text inspected. Annex 1 lists Sinarmas World Academy, school
code 006880, effective May 2024 under both INDIEN and INDONESIEN. The existing
reviewed conflict therefore remains unresolved; choosing a country is no resolution.
No attendance exemption, source correction or new academic rule is asserted.

## Verification

- Test-first command: `pnpm exec vitest run 'app/(public)/result/[id]/__tests__/qualification-guidance.test.tsx'`:
  two expected failures before repair; four tests pass after repair, zero skips.
- Connected command: `pnpm exec vitest run 'app/(public)/result/[id]/__tests__' lib/engine/__tests__/qualification-guidance.test.ts lib/engine/__tests__/ib.test.ts lib/engine/__tests__/diagnostics.test.ts lib/engine/__tests__/up-test-01.assessment.test.ts lib/rules/__tests__ 'app/(public)/check/__tests__/qualification-guidance.test.ts' 'app/(public)/check/__tests__/qualification-guidance-ui.test.tsx'`:
  22 files, 831 passed, zero skips. The targeted four tests were rerun after the
  fixture's unknown raw snapshot was parsed through its existing Zod boundary.
- Environment-enabled `pnpm test`: 136 files, 2,830 passed, zero skips.
  Final run 2026-10-10 02:21:32 Europe/Berlin: captured `CHILD_EXIT=0`, outer exit 0.
  `.env.local` was loaded before test collection. URL was explicitly required to
  equal `http://127.0.0.1:55321`; `COURSE_PROCESS_LOCAL_API`,
  `COURSE_PROCESS_LOCAL_PUBLIC_KEY` and `COURSE_PROCESS_LOCAL_SERVICE_KEY` were
  set from the corresponding disposable Supabase environment values in memory.
  No credentials were printed. Windows wrapper captures the child exit code and
  explicitly exits with `$LASTEXITCODE`, avoiding PowerShell's stderr classification.
- Separately, `pnpm exec vitest run lib/db/__tests__/rls.integration.test.ts lib/db/__tests__/course-process.integration.test.ts`
  with that same environment: 32 actual DB/RLS cases passed, zero skips.
- `pnpm lint`: passes with the three existing unrelated research-course warnings.
- `pnpm typecheck --incremental false`: passes. Its first run caught the test
  fixture's unknown snapshot spread; the Zod parsing correction resolves it.
- Default `pnpm build`: passes, including production TypeScript and prerendering.
  The temporary browser route is absent from the final build.
- `git diff --check`: clean. No migration, linked reset, seed, embedding,
  OpenRouter/Tavily inference, issue-60 edit or rule publication was performed
  outside the mandated synthetic disposable RLS fixtures.

## Browser evidence and limits

T3 status/open were used first. The temporary local development route on 3049
rendered actual result components from `evaluateAssessment` using in-memory sourced
candidate copies. It showed the source conflict, exact condition, source link and
recognition-authority action at 390x844, 768x1024 and 1440x900 in light/dark,
without horizontal overflow, false qualification success or duration follow-up.
The route was removed before lint/typecheck/build and is not committed.
See [measurements](repair-browser.json) and
[conflict screenshot](repair-conflict-desktop-dark.png).

A scoped IB draft was also submitted through the real checker server action on
the default production build, using only disposable 55321/55322. Result UUID:
`ab9f611a-c9a3-434c-9622-79d579a35889`. Original and current assessments are
available, unknown, and free of duration prompts at all six viewport/theme
combinations. The disposable DB has no published scoped IB rule, so this actual
journey does not establish the conflict rendering of a published production rule.
The in-memory harness and strict renderer regressions establish that behavior.

The real page's original revision paragraph overflows at mobile width 390:
688px with the current token, 671px with the prior a141 token substituted in the
DOM. This existing provenance layout is unchanged and recorded for #54; tablet
and desktop do not overflow. These are Chromium CSS viewport checks, not native
mobile or provider/production verification. The earlier full certificate/profile
matrix remains in [original acceptance](acceptance.md); it is not claimed as a
fresh manual rerun of every original branch during this focused repair.

Final tested commit and new CI status are recorded in PR 65's repair evidence
comment after push. No merge or issue closure; independent round-two review
belongs to the coordinating root.
