# Reviewed course publication and planner contract

Verified locally on 2026-10-09 against baseline `98c207c` in the isolated
`fix/reviewed-course-process-contract` worktree. No linked database, provider,
schema migration, deployment or live publication was used.

Before implementation, the new integration suite created three distinct
synthetic courses through the ordinary caller-scoped insert helper, published
direct, uni-assist and VPD routes through `publishAdminCourseResearch`, and read
their protected immutable versions and audit records. All three planner route
assertions failed: expected the reviewed route, received `unresolved`.
Publication, protected history, literal `source_scope` and null stored-date
assertions had already passed. Command exit: 1; three failed tests.

The consumer now recognizes the producer's provenance and stage identities,
retains existing process identities, and keeps derived sorting dates separate
from immutable source facts. Ambiguous identities and unsupported scope remain
official confirmations. Only an unambiguous supported full source date with an
explicit year sorts; no offering year is substituted.

Final command:

```powershell
pnpm exec vitest run lib/db/__tests__/course-process.integration.test.ts lib/tasks/__tests__/offering-process.test.ts lib/tasks/__tests__/materialize.test.ts lib/tasks/__tests__/view.test.ts lib/courses/__tests__/research.test.ts lib/db/__tests__/course-research.test.ts
```

Exit 0: six files, 171 tests passed. The three actual database cases used
`COURSE_PROCESS_LOCAL_API=http://127.0.0.1:55321` and local-only public/service
keys supplied by the coordinating agent's disposable database. The integration
suite skips without an allowlisted API and keys. It accepts exactly
`http://127.0.0.1:54321` (CI) or `http://127.0.0.1:55321` (isolated local),
using existing CI `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`, with explicit
`COURSE_PROCESS_LOCAL_*` overrides when supplied. Auth-admin privileges
only provision/delete unique fixture actors; application helpers use password
authenticated caller clients. Each actor signs out locally and is deleted.
Synthetic immutable catalogue/audit fixtures remain in the disposable database.

Actual local checks include publication-to-materialization for all three
routes; correct stage portal/date selection; unchanged null immutable dates;
wrong group helper and database denial; owner denial of forged reviewed
versions; a new protected unresolved route superseding its predecessor; no
rewrite of manual, personal, or completed tasks; and unchanged planning status.
Pure tests additionally cover unsupported applicability, wrong offerings/groups,
unreviewed and conflicting versions, ambiguous producer/legacy stage keys,
invalid dates, missing years, ranges, and retained task identities.

`pnpm typecheck`: exit 0. Focused ESLint of all three changed TypeScript files:
exit 0, no warnings. `pnpm lint`: exit 0 with three existing unused-argument
warnings in `lib/ai/__tests__/research-course.test.ts`. `git diff --check`:
exit 0. Offline frozen dependency installation: exit 0, lockfile unchanged.

Root owns combined main integration, full-suite/build/browser/CI review and any
separately authorized operational publication. Synthetic fixture results make
no academic or university procedure claims.

The actual CI report-proof script was separately regression-tested before its
correction: it incorrectly accepted a missing, empty, pending or failed course
suite (four expected failures; exit 1). It now requires both
`rls.integration.test.ts` and `course-process.integration.test.ts` with nonempty
assertions and every case passed; any skip fails the gate. The final harness
checks passed 69 tests (seven actual workflow-script report cases, thirteen
environment allowlist cases and forty-nine offering process units). Typecheck
and focused ESLint both exited 0. This establishes the harness contract, not a
remote GitHub Actions run.

After database serialization was released, the three actual protected
publication cases also ran with only the standard CI environment namespace
(all `COURSE_PROCESS_LOCAL_*` overrides removed), using the allocated local
55321 API. Combined with the harness and offering units: four files, 72 tests,
zero skipped, exit 0. The 54321 CI allowlist branch is verified by pure
configuration cases; no second local database was started.
