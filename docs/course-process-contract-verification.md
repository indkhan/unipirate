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
suite skips without that exact API and explicit keys. Auth-admin privileges
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
