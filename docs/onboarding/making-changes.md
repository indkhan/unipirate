# Making a safe change

## Before coding

1. Read the issue, the affected user flow in
   [application.md](../application.md), and the nearest existing tests.
2. Find the canonical owner of the behavior. Shared domain logic belongs in a
   pure `lib/` module; route-specific logic stays beside its route.
3. Confirm whether the change affects a sourced fact, authorization, schema,
   or architecture. Those areas need the extra checks below.

## While coding

- Keep one change self-contained and include its tests.
- Validate every server action, API body, environment variable, and rule
  record with zod.
- Keep I/O in actions, routes, query helpers, `materialize`, or `view` shells.
- Put all user database access in `lib/db/queries.ts` and admin access in
  `lib/db/admin-queries.ts`.
- Use `requireUser()` or `requireAdmin()` for protected pages/actions; API
  routes return their own 401/403 JSON.
- Preserve source text verbatim. Parsed dates may sort or bucket records but
  must never replace the displayed deadline.
- Never make AI decide eligibility. The deterministic rule engine is the only
  eligibility authority.
- Add a `Trade-off:` comment where the code intentionally accepts a known
  compromise.

## Change-specific checks

| Change | Required follow-through |
| --- | --- |
| Domain logic | Add/update a colocated unit test; keep the module free of I/O |
| Eligibility rule | Include source URL, exact quote, verification date; publish through admin review |
| Checker question/fact | Update step schema, branching/profile conversion, labels, and tests |
| Database query | Use a caller-scoped Supabase client and verify the relevant RLS behavior |
| Schema | Add a new migration, push it, regenerate types, run the RLS integration test |
| Assistant/rules | Rebuild the KB and run the assistant evaluation |
| Architecture or setup | Update the canonical documentation in the same change |

The detailed file map is in
[Where to make common changes](../application.md#where-to-make-common-changes).

## Before review

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Then review the diff as a user and as the next developer:

- Is every factual claim sourced or explicitly unknown?
- Can RLS, not a UI check, enforce the authorization rule?
- Would the changed test fail if the behavior broke?
- Did the change add unused flexibility or duplicate an existing helper?
- Are related docs now stale?

Keep refactors separate from feature changes unless the cleanup is tiny and
necessary. Small, focused changes are easier to review and revert.

