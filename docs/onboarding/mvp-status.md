# MVP status

This is a repository snapshot, not a product-priority contract. It is based on
the code and migrations present on 2026-08-14. Confirm priority with a
maintainer before starting a large item, and update this page when an MVP
capability materially changes.

## Implemented in the codebase

| Capability | Where to start |
| --- | --- |
| Anonymous rule-based eligibility checker and shareable result | `app/(public)/check/`, `app/(public)/result/[id]/`, `lib/engine/` |
| Result claim, authentication, profile persistence | `lib/checks/`, `lib/auth/`, `app/auth/` |
| Course import, deterministic DAAD parsing, AI gap-filling, admin review | `app/api/courses/import/`, `lib/courses/`, `lib/ai/extract-course.ts`, `app/(admin)/admin/` |
| Course tracker and application statuses | `app/(app)/courses/`, `lib/db/queries.ts` |
| Generated/manual tasks, Now/Next/Later buckets, calendar | `lib/tasks/`, `app/(app)/dashboard/` |
| Citation-only assistant with user context, rule search, and web fallback | `app/api/assistant/chat/`, `lib/ai/`, `scripts/eval-assistant.ts` |
| Rule/course-task administration and audit log | `app/(admin)/admin/`, `lib/db/admin-queries.ts` |
| RLS-protected Supabase schema and integration coverage | `supabase/migrations/`, `lib/db/__tests__/rls.integration.test.ts` |

## Stated MVP work not found in the current code

These capabilities are promised in the root README's "What the MVP does"
section but have no corresponding implementation in this checkout:

- German grade converter and Indian APS wizard.
- Email reminders before deadlines.
- Notifications when a rule affecting a user's profile changes.

Treat each as a product slice requiring acceptance criteria, source and safety
review, and a deliberately small first release. Do not scaffold all three at
once.

## Content and launch work still called out

- India rules are described as under verification; Pakistan and Saudi Arabia
  remain beta. Publishing a rule is a human source-review decision, not a code
  task.
- Open checker, login, result, and flow UX issues are recorded in
  [bugs.md](../bugs.md). Check that list against current behavior before taking
  an item because the audit also retains fixed findings for history.
- Database/RLS tests, assistant evaluation, and any source-dependent flow need
  the relevant external credentials; a green local suite may include skips.

## Good first contributions

Prefer a small issue from [bugs.md](../bugs.md), a missing test around an
existing pure module, or a documentation correction discovered while setting
up. Avoid making an unsourced eligibility change, a broad schema refactor, or
one of the unbuilt MVP capabilities as a first contribution.

