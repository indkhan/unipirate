# Issue 47 implementation evidence

Base: `972f799116c7c0ca861717caa1e404ba9b5639ee` (main, including PR 63).
Branch: `fix/issue-47-checker-entry`. Verification date: 2026-10-10.

The landing asked country before degree. The checker always started at index 0
and advanced by one, repeating prefilled entry questions. Nationality and visa
preceded qualification details. Numeric draft/history progress could point at a
different question after routing changed, and a country equality guard discarded
country edits on refresh.

The landing now supplies degree to a Zod-validated pure entry boundary. Forward
navigation skips answered degree/attendance-country questions; Back exposes both.
Bachelor starts with attendance country and qualification details; Master starts
with prior university history. Draft keys isolate degree entries, and saved question
identity survives reordering. Recovery and browser history stop at missing evidence.
Country edits take precedence over the original URL hint. Explicit degree edits
update the URL and save under the new degree key, so a later landing choice cannot
accidentally restore the opposite degree.

No database, query, auth, rule criteria/publication, task/jobs API or historical
storage behavior changed. Existing qualification normalization handles explicit
degree edits without mutating the input. Academic evaluation and protected original
assessment metadata are unchanged. Attendance never supplies an actual issuer.
Separate issuer/context prompts remain for issue 50; duration, application-context,
mission and intake/process removals remain for sequential issues 49–53.

## Automated verification

- Test-first mounted React regression: initial 7 failures reproduced the landing,
  country repetition and Master ordering defects before implementation.
- Additional mounted failures reproduced edited-country loss and history jumps;
  both passed after their fixes. React state/effects/events are real (`createRoot`,
  jsdom 26.1); only external router, analytics, action and theme I/O are mocked.
- Focused checker/landing: 27 files, 292 tests passed, zero skips.
- Full `pnpm test`: 131 files, 2,803 tests passed, zero skips. Environment keys
  were privately loaded from the existing disposable local configuration.
- Actual disposable `127.0.0.1:55321` service: all 29 RLS tests and all three
  protected course-process integration tests passed. Feature ports 56321/56322,
  linked reset, migrations, seed and production publication were not used.
- `pnpm lint`: exit 0, zero errors; three existing unused-argument warnings in
  `lib/ai/__tests__/research-course.test.ts`.
- `pnpm exec tsc --noEmit --incremental false`: exit 0.
- Default `pnpm build` (Next.js 16.2.10 Turbopack): exit 0; all routes compiled
  and static pages generated. The dev server was stopped before the build.

## Browser verification

T3 collaborative preview used the isolated Next dev server on port 3047, with the
real local Supabase service and no browser network/action mocks.

- Main landing Bachelor link: Step 2 attendance country, then curriculum, then GCE.
- GCE British international selection: Continue, full-page reload and Back retain
  the selection. Back exposes country and degree. Switching to Master removes
  school/curriculum/awarding-body answers and starts prior university history.
- Master university-history progression collected institution, actual institution
  country, system, field, nominal duration, successful study and completion before
  nationality. Reload retained that history and no school-country answer.
- Main landing Master link: Step 2 university history, without repeated degree.
  A supplied Saudi school hint did not become a university country.
- After Back changes Bachelor to Master, URL becomes `degree=master` and refresh
  follows university history. Returning to the landing and selecting Bachelor
  starts its country step, without restoring the opposite edited degree.
- `/check?country=sa`: degree first, then curriculum without repeating attendance
  country; IB reaches its document-evidence question.
- `/check?country=in&degree=bachelor`: curriculum first. Explicit Pakistan issuer
  and national context reach Pakistan certificate evidence while retaining the
  distinct Indian attendance hint.
- Landing and Master entry checked at 390, 768 and 1440 CSS pixels, in light and
  dark themes: no horizontal overflow, correct link targets and Step 2 Master
  ordering. Screenshots inspected; mobile Step 1 label remains on one line.

These checks establish local UI/navigation and disposable DB behavior. They do
not establish provider, deployed production or CI behavior. Independent review
and merge remain with the root owner.

Responsive measurements and full local screenshot paths are in [browser.json](browser.json).
Representative inspected images: [mobile landing, dark](mobile-landing-dark.png)
and [desktop Master entry, dark](desktop-master-dark.png).
Full local command logs remain in ignored `test-results/issue-47/`.

## PR 64 review repair (2026-10-10)

Review base: `a42e06a3d6f340a277cd325a4a0c3ee87c28bb97`.

The reviewer's exact sequence was reproduced with actual T3 browser history:
Bachelor entry, Saudi attendance, Continue, in-app Back twice, Master, Continue,
browser Back twice. The form showed university history while the URL reverted to
Bachelor; refresh then restored the Bachelor draft. The repair keeps the active
entry URL with its draft across traversal. It also handles Next's fresh equivalent
server props and replacement of custom history state. Current history progress
survives remounts before the outgoing draft effect saves, including Back to degree.

The second finding is corrected with a version-sensitive profile label. Current
qualification-history flows display **School attendance country**, separately
from **School qualification issuer country**. Unversioned profiles retain the
legacy **Certificate country** label. No stored answer or historical record is
rewritten, and attendance never infers an issuer.

- Failing mounted tests first reproduced the stale URL, equivalent-props reset,
  lost history metadata, stale draft progress and incorrect attendance label.
  Actual asynchronous `history.back()` / `history.forward()` events, remounts,
  independent degree drafts and retained university-history answers are covered.
- Final focused checker/landing: **27 files, 296 passed, zero skips**.
- Final full suite with the existing disposable environment preloaded:
  **131 files, 2,807 passed, zero skips**. JSON-report inspection proves all
  **29 RLS** and **3 course-process** integration cases passed on API 55321 / DB
  55322. An earlier invocation skipped the three course-process cases because
  their environment was not loaded at module import; the configured rerun
  supersedes that incomplete gate.
- Lint: exit 0, zero errors, the same three existing warnings. Nonincremental
  TypeScript: exit 0. Default `pnpm build` using Turbopack: exit 0.
- T3 browser reproduced and verified the exact repair at 390/768/1440 pixels;
  Back/Forward and refresh before traversal were also checked. Bachelor national,
  GCE and IB entry, country reuse and direct Master landing remained reachable.
  Authenticated disposable profile verification displayed Saudi attendance and
  Indian issuer distinctly; its saved answers remained unchanged.
- After T3 explicitly reported its automation host unavailable, an existing
  headless Chromium installation verified the local production build on 3047.
  Six combinations of 390/768/1440 pixels and actual app light/dark settings
  passed real Back/Forward/refresh and cross-country profile-label assertions,
  with no horizontal overflow. Browser preference emulation alone does not
  select this app's dark theme; these checks asserted the actual `.dark` class.
  Disposable browser accounts were removed. Measurements are in
  [repair-browser.json](repair-browser.json); inspected screenshots show
  [mobile profile](repair-profile-mobile-dark.png) and
  [desktop Master](repair-master-desktop-dark.png), both in dark mode.

Local gates establish repository/local disposable behavior, not deployed
production or provider behavior. Fresh independent review remains root-owned;
no merge, issue closure, linked reset, feature-service edit or publication occurs.
