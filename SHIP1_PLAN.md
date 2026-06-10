# Ship 1 — Build Plan (Bachelor-only, deterministic)

Locked scope. Bachelor only. No LLM in critical path. Ships before chatbot/cover-letter/master's (those = Ship 2/3).

## Wedge
Not course discovery (DAAD does that). The value = **"can I, specifically, get in + what do I do next."**
Two-stage verdict: **country recognition gate first → then grade↔NC tier**. Plus a **tracker dashboard** = the sticky/return surface.

## Current state (prototype, already in repo)
- Next.js 15, React 19, Tailwind 4
- Pages: `/` landing, `/onboarding`, `/result`, `/finder`
- Static data: `lib/data.js` (RECOGNITION_RULES, COUNTRIES, QUALIFICATIONS, GRADING_SCALES, LANGUAGE_CERTS, UNIVERSITIES, COURSES)
- Profile in localStorage (`lib/profile.js`)
- All client-side, hardcoded, no persistence/auth

## Target (Ship 1)
Same UI shell, but: Supabase DB + Auth, deterministic NC engine, tracker dashboard, admin moderation, ~15 hand-seeded unis.

---

## Phase 0 — Foundations
1. Create Supabase project. Add `@supabase/supabase-js` + `@supabase/ssr`. Env keys in `.env.local`.
2. Supabase Auth: Google + email/password. Wire login/signup/callback routes. Managed — do NOT hand-roll.
3. Decide rendering: keep client pages, add Supabase server client for data fetch + RLS.
4. GDPR basics: privacy note, profile data is personal (country/grades) — store under user's row, deletable.

## Phase 1 — Data layer (static → Postgres)
Schema (tables):
- `universities` (name, city, apply_method [direct/uni-assist/other], deadlines, semester_fee, daad_url)
- `courses` (uni_id FK, name, degree, semester, language, nc_free bool, nc_value, nc_year, admission_reqs, language_reqs, structure, how_to_apply, deadline)
- `recognition_rules` (country, qualification_type, status [H+/H/H-], headline, explanation, next_steps[], action_links[], anabin_url)
- `grade_conversion` (qualification_type, n_max, n_min)  ← for Bavarian formula
- `country_playbooks` (country, ordered steps[])
- `profiles` (user_id, country, qualification_type, grade, grade_scale, lang_cert, lang_score, target_subject)
- `tracked_applications` (user_id, course_id, status, created_at)
- `application_steps` (tracked_app_id, label, done bool, due_date)  ← per-uni checklist progress
- `uni_requests` (user_id, uni_name, daad_url, pasted_text, status [pending/approved/rejected])  ← moderation queue

Steps:
1. Write SQL migrations for above.
2. Port existing `lib/data.js` content into seed rows (don't lose the curated recognition rules already written).
3. Replace `lib/data.js` reads with Supabase queries (server side where possible).
4. Add RLS: users read public uni/course/recognition data; users read/write only their own profile + tracked apps; admin role for moderation.

## Phase 2 — Profile + Recognition gate
1. Onboarding form → save profile to DB (reuse existing form UI).
2. Recognition lookup: (country + qualification_type) → recognition_rules row. Already mostly built in prototype — move to DB query.
3. Result page: show status (H+/H/H-) + plain-English explanation + **disclaimer** ("guidance not official decision") + **link to anabin entry**.
4. Some countries' verdict depends on grade threshold (e.g. Pakistan grade → Studienkolleg). Encode that in the rule logic.

## Phase 3 — NC matching engine (deterministic)
1. Implement **Modified Bavarian Formula** conversion: `germanGrade = 1 + 3*(Nmax - Nuser)/(Nmax - Nmin)`. Pull (Nmax,Nmin) from `grade_conversion` by qualification_type.
2. Per course, 3-state:
   - `nc_free` → "Open admission — recognition is all you need." (show prominently)
   - `nc_value` present → tier: well-above = "Strong chance", near = "Borderline (NC shifts yearly, last year X)", below = "Unlikely last year, but NC moves + other quotas"
   - NC unknown → "NC unconfirmed — check uni page"
3. Always show: user's converted grade, source NC + year, disclaimer NC = closing rank not fixed bar.
4. If qualification_type not in `grade_conversion` → skip NC, show "matching not available for your system yet."
5. Phrasing = **templates**, not AI.

## Phase 4 — Search / Browse (wire to DB)
1. Reuse `/finder` UI: search keyword → unis offering matching courses (left) → select uni → matching courses (right) → course detail.
2. Course detail shows all course fields + the NC verdict from Phase 3 (personalized to logged-in user's profile).
3. Filter by language / degree from profile.

## Phase 5 — Dashboard + tracker (the home screen)
1. "Track this application" button on course → creates `tracked_applications` row.
2. Dashboard = home after login: recognition verdict + list of tracked applications.
3. Each tracked app = per-uni checklist (`application_steps`) derived from country_playbook + that uni's apply_method. Checkboxes persist.
4. Show per-uni deadline + countdown.

## Phase 6 — Paste-request + admin moderation
1. Search hits a missing uni → "Request this university" form: uni name + DAAD URL + pasted page text → `uni_requests` (pending).
2. Admin page (admin-role login): list pending requests. Admin opens URL, fills deep fields (NC, fees, reqs) by hand, approves → course/uni goes live. Reject option.
3. No LLM. Human completes extraction at approval = guaranteed data quality.

## Phase 7 — Polish + launch
1. Hand-seed **~15 unis fully** (TUM, RWTH, TU Berlin, KIT, etc. — APS-country targets). Worthless empty.
2. Disclaimers everywhere verdicts appear. anabin links. Source + "verify on official page" on extracted fields.
3. Mobile responsive pass.
4. Accuracy review of all seeded data before launch.

---

## Out of Ship 1 (later)
- Ship 2: chatbot (RAG over curated data, "I don't know" fallback), cover-letter gen, ask-about-uni
- Ship 3: master's (different recognition logic entirely — Hochschulabschluss, not Hochschulreife)
- Later: scholarships, housing/visa, monetization

## Build order = the phase order. Dependencies:
Phase 0 → 1 gate everything. 2 & 3 can parallel after 1. 4 needs 1. 5 needs 2+4. 6 needs 1. 7 last.
