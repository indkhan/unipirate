Goal acknowledged — I'll walk the site end to end like a real user and log every problem I find. Starting the dev server.

Home page loads fine. Starting the flow as an Indian student.

Testing the marks input with invalid values first.

**Bug found:** entered 150% and Continue accepted it — the input has min/max attributes but no actual validation. Continuing.

The 150% is caught only at final submit with a generic "Some answers are missing or invalid" — the user gets no hint which step is wrong. Going back to fix it.

Reached the result page. Reading it fully.

Result page looks solid. Now testing the login flow.

Now testing the GCE A-Levels branch with edge cases.

**Bug confirmed:** malformed result ID crashes with a 500 instead of a 404. Testing a well-formed but nonexistent UUID too.

Now the master's degree path.

Master's path works but has UX gaps. Now testing mid-flow reload (accidental refresh).

Route logic works for Saudi. Checking mobile layout and dark mode.

Walkthrough complete. I went through every flow as a user: home page, all three entry countries, the bachelor national-board path (CBSE India, Tawjihiyah Saudi), the GCE A-Levels path, "Something else", the master's path, JEE yes/no branches, the result page in all three outcome shapes (direct, Studienkolleg, unknown), login, courses, invalid URLs, mobile, and dark mode. Here's everything I found, worst first.

## Bugs

1. **Marks input accepts impossible values, and the error comes too late and too vague.** On the Class 12 marks step I typed **150%** — Continue stayed enabled and the flow let me sail through four more steps. Only when I hit "See my result" did I get *"Some answers are missing or invalid. Please go back and check them"* with no hint which of the 11 answers is bad. A real user would not guess it's the marks. Cause: [check-flow.tsx:280](app/(public)/check/check-flow.tsx:280) only checks `!== undefined` via `isAnswered`; the Zod `min(0).max(100)` in [steps.ts:109](app/(public)/check/steps.ts:109) only runs server-side at submit. Fix: block Continue (or clamp/show inline error) on that step when the value is outside 0–100. Negative values have the same hole.

2. **Malformed result URL crashes with a 500.** `/result/not-a-real-id` renders "This page couldn't load — A server error occurred" because the raw string goes straight into a Postgres uuid query and the error is thrown at [queries.ts:14](lib/db/queries.ts:14). A well-formed-but-unknown UUID correctly 404s. Anyone mangling a shared WhatsApp link (very common — truncated copy/paste) sees a scary error page. Validate the id format in [page.tsx:65](app/(public)/result/[id]/page.tsx:65) and `notFound()` instead.

3. **A refresh mid-flow wipes all answers.** I answered 3 steps, reloaded, and was back at the start (only the `?country=` from the URL survives). Same for the browser Back button — it exits the whole flow rather than going back one step. For an 11-step form on mobile this is the top way to lose users. Persisting `answers` to `sessionStorage` would fix it cheaply.

4. **Login form bypasses its own validation and leaks raw Supabase errors.** "Create account" and "Send magic link" are `type="button"`, so the `required`/`minLength` on the inputs never fire for them — clicking "Send magic link" with an empty email shows the raw API error *"One of email or phone must be set"*. Errors also render in `text-muted-foreground` ([login-form.tsx](app/(public)/login/login-form.tsx)), so failures look like hints, and clicking "Sign in" empty gives no visible feedback at all in some cases.

## Things I'd change (UX / product)

5. **Nationality question has no escape hatch.** It offers only India / Pakistan / Saudi Arabia. A Nepali or Bangladeshi student with a CBSE certificate — a real and common case — literally cannot answer truthfully. The visa question already has "Another country"; nationality needs the same (even if it routes to an honest unknown).

6. **The master's path asks school questions and shows school answers.** A master's applicant is asked "Which curriculum did you study?" (school-level), never asked anything about their bachelor's degree/CGPA, and the result badge shows "NATIONAL" — their school curriculum in ugly raw-enum uppercase. If master's support is intentionally thin, say so early ("Master's support is limited — we'll confirm what we can") instead of asking irrelevant questions. The "OTHER" badge on the something-else path has the same raw-uppercase problem.

7. **Route diagram shows "✓ Eligibility" even when the result is "your admission route still needs confirmation."** The checkmark next to "Eligibility" followed by "Confirm eligibility ▸ YOU ARE HERE" reads as contradictory — it looks like eligibility passed when it's actually unresolved.

8. **Intake label inconsistency.** You pick "Winter 2026/27" but the result page says "Selected intake: Winter 2026." German winter semester naming matters to this audience; keep "2026/27" everywhere.

9. **Step counter jumps mid-flow** — "2 of 8" becomes "6 of 11" once branches unlock. Honest, but it feels like the form grew on you. Consider a progress bar without numbers, or count the maximum path.

10. **GCE subjects allow duplicate rows** (three × "Mathematics A-Level A" accepted). The engine dedupes by independence group ([evaluate.ts:357](lib/engine/evaluate.ts:357)) so it's not a correctness bug, but the UI should prevent or flag it — a user who adds Math twice thinking it counts twice gets silently different results than they expect.

11. **Empty-state polish on the result page:** "Your documents — 0 of 0 shown" reads like a bug next to "No verified document list is available"; drop the counter when the list is empty.

12. **No dark mode** — with `prefers-color-scheme: dark` everything stays light. Fine if intentional, just noting it.

What worked well: the disabled-Continue gating on choice steps, the honest unknown outcomes (Pakistan GCE, Saudi "something else"), the APS skip for Saudi-filed visas, beta banners for PK/SA, verified source chips with dates, the JEE-Advanced direct-route branch, and the mobile layout — all behaved correctly.
