# Issue 49 implementation evidence

Base: `b773630298ff9a358e843ab4be51e7bf4e10d874`. Implementation is confined to
`fix/issue-49-qualification-guidance` in the isolated issue-49 worktree.
The root checkout remains clean at that main commit. No migration, publication,
seed, embedding or OpenRouter/Tavily call was performed. Issue 60 storage/jobs
and its 56321/56322 instance were not changed.

## Certificate decisions and source review

Reviewed official sources on 2026-10-10:

- [DAAD GCE guidance](https://www.daad.de/en/studying-in-germany/requirements/gce/):
  subject combinations and grades are separate from ordinary ascending schooling.
  UK/British international qualifications and national-system A-levels must not be
  conflated. The recognition authority makes the binding decision.
- [DAAD IB guidance](https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/):
  Diploma evidence, exam era, subjects, levels, language and grades are independent
  criteria; ordinary schooling is an additional condition. Course certificates
  cannot silently become a Diploma.
- [Cambridge recognition guidance](https://www.cambridgeinternational.org/Images/648183-pre-u-recognition-in-germany.pdf):
  the current framework distinguishes full A-levels from AS and applies subject
  requirements. Its Pre-U equivalences do not establish actual attendance years;
  this change adds no new Pre-U rule or grading mapping.

Read-only inspection through the existing caller-scoped rule-version query helper
returned 124 deployed visible versions, including 34 GCE/IB versions. Fifteen
contained `gce_school_years` and thirteen contained `ib_school_years`. Existing
source-backed duration conditions remain intact. Source review does not publish
an attendance exemption or turn synthetic verified test copies into production rules.

Cambridge, Pearson, OxfordAQA and other GCE forms retain the selected system,
qualification type, awarding body, awarding evidence and subjects/grades. National
system GCE remains a distinct unsupported applicability case. New/edited GCE and
IB forms remove numeric school duration without a substitute question or inferred
12/13-year fact. IB uses its existing single award/document-evidence question,
retaining exam session, schooling pattern and individual academic evidence.

Pakistan, Saudi and Indian national branches already had no numeric actual-school
duration question. Their completion evidence is independent of a board name,
certificate title, documentary category or exam passage, so it is retained. No
replacement attendance interrogation is added, and there is no universal
twelve-years-to-Studienkolleg rule. Issuer/system questions remain for issue 50.

## Assessment and preservation

The independent `qualificationGuidanceVersion: 1` marks new/editable forms.
Unmarked historical answers and immutable assessments retain their original
validation, reported years and stored results. The marker explicitly withholds
attendance facts even if an old caller payload still contains years. Original
published conditions remain necessary for a full path match.

Scoped diagnostics record which literal selected-rule conditions were compared.
Thresholds remain rule data; GCE uses one complete witness rather than mixing
subjects across witnesses. Passing retained checks produces qualification guidance,
never a path citation or admission tasks. Failed grades and unsupported identities
remain visible. Result copy identifies assessed checks and gives a short recognition
limitation, with no missing-duration follow-up. Existing applications, task IDs,
completion and student edits use unchanged storage/materialization contracts.

## Verification

- Test-first regression: six pure tests failed before implementation. The five
  real mounted jsdom/createRoot tests also failed when baseline production files
  were temporarily restored, then passed with the implementation restored.
- Focused final regression: 8 files, 73 tests passed, zero skipped. Includes
  checker, real mounted flow/profile, Back/refresh restoration, engine witnesses,
  result rendering and strict immutable-assessment envelopes.
- Full environment-enabled Vitest run: 136 files, 2,828 tests passed, zero skipped.
  The command runs the repository's `vitest run` with `.env.local` preloaded so
  the import-time integration gates execute rather than skip.
- Actual disposable database/RLS regression on 55321/55322: 2 files, 32 tests
  passed, zero skipped (29 RLS and 3 course-process integration tests). No reset.
- `pnpm lint`: exit 0, three existing unused-argument warnings in the unrelated
  research-course test; no errors.
- `pnpm typecheck --incremental false`: exit 0.
- Default `pnpm build`: exit 0, production Turbopack build.
- `git diff --check`: clean. All 27 engine-revision input hashes match the
  [recorded manifest](engine-revision.json).

The latest full run corrected three stale engine-revision expectations from an
earlier run. Temporary browser setup scripts were moved out of TypeScript/lint
input before the final clean lint/typecheck/build; none are delivered as app code.

## Browser evidence and limits

T3 collaborative Chromium, own production server on port 3049, disposable DB.
Cambridge fresh form skips from awarding body directly to subjects; Pearson
Back/refresh retains all three subject rows; other GCE retains its own awarding
identity. A restored IB draft parked on the removed question recovers to an
existing question. IB retains six independent subject rows and one award question.
Pakistan retains separate title, completion and group/mark evidence.

Checker GCE/IB/national and authenticated GCE/IB profile views were measured at
390x844, 768x1024 and 1440x900 in light and dark themes: no horizontal overflow or
removed duration question. The profile was created through a caller-scoped query
helper for a disposable user. Actual anonymous submission and authenticated profile
save both produced persisted result pages. Detailed measurements: [browser.json](browser.json).

The local DB contains no published scoped GCE/IB rules. Its actual result therefore
remains honestly unknown and has no duration nag. Passing/failed scoped result copy
is verified in renderer tests using synthetic published copies of sourced candidates,
not claimed as production/provider success. Native mobile devices were not used;
these are CSS viewport checks. No live production evaluation or publication occurred.

Representative screenshots: [Cambridge mobile dark](cambridge-mobile-dark.png),
[IB tablet light](ib-tablet-light.png), [GCE profile desktop dark](profile-desktop-dark.png).
Independent review is left to the coordinating root; this implementation does not
merge the PR or close the issue.
