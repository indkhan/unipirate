# Catalogue and admin verification - 5 October 2026

## Outcome

Tested the local app at http://localhost:3001 with temporary student, second-student
and admin accounts against the linked Supabase database. The exercised DAAD
import, review, tracking and task workflows work after five fixes. This does not
establish that every university page format or AI import works.

## Exercised workflows

- Opened the real [RWTH Data Science DAAD page](https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/7636/), selected its text with Ctrl+A, and imported it through the URL/paste sheet.
- Copied overview, requirements and costs separately and combined them. Hidden tabs are not copied with the overview alone; the sheet now explains this.
- Verified pending imports are private to their submitter and admins; approval makes them available in the finder.
- Edited source facts and a generated task title in the admin UI. Approval generated 12 requirement tasks; the title edit reached the student dashboard.
- Looked up existing courses using equivalent DAAD URLs, added them to the dashboard, and reopened the sheet successfully.
- Submitted a changed-page version and adopted it through the admin conflict UI. Original course, application and task-definition IDs survived.
- Completed a task; submitting the application hid outstanding tasks and retained completion. Returning to planning restored outstanding tasks.
- Real HTTP requests verified authentication, invalid URL/text rejection, regular-user admin restriction, pending-update privacy and duplicate lookup.
- Live database tests cover approval/rejection privacy and both conflict decisions, including completed/personal tasks, duplicate tracking links and authorization.

## Defects fixed

1. Current DAAD labels were missed, sections truncated, and footer/contact text could bleed into requirements. Added labels/boundaries and retained complete source sections.
2. Adding an existing course left the busy flag set, disabling subsequent URL checks. Reset it on completion.
3. Admin diffs treated PostgreSQL JSONB key reordering as a source change. Compare values instead.
4. A pending update caused duplicate URL lookup to return a server error. Lookup now selects the canonical course.
5. Adopting a conflict deleted the original course and could cascade-delete applications and progress. Resolution now updates the original, preserves identity and merges tracking links/reminders. Admin task synchronization follows adoption.

Applied `20261005171200_preserve_course_conflict_progress.sql` to the linked
database and regenerated database types. Matching application changes remain
local; deployed admin actions need this code for the new task synchronization.

## Limits

- AI fallback returned HTTP 429, `free-models-per-day`, remaining quota zero. Successful arbitrary university or uni-assist extraction was not verified.
- Source-line task generation can produce awkward titles from headings or explanatory text. Admins can curate these; extraction does not decide eligibility.
- The tested RWTH page gives an application-period statement rather than an exact date; no calendar date was invented.
- Additional DAAD formats still need real-page coverage. Email/OAuth delivery and deployment were outside this targeted check.

## Verification and cleanup

This targeted check preceded the broader fixes-only audit. See
[current feature verification](STATUS.md) for the final test counts and commits.

`pnpm test`: 208 tests across 29 files, including 26 live database tests, no skips.
`pnpm lint`, `pnpm typecheck` and `pnpm build`: pass.

Removed three temporary QA accounts, imported versions, tasks, applications and
audit records. Verified the original catalogue's three course IDs, URLs and review
statuses remain unchanged. No deployment was made. The subsequent audit committed
these fixes individually.
