# MVP Plan — German University Course Finder

---

## What This MVP Does

A user enters their academic background. The app checks if their qualification is recognised in Germany via anabin logic, tells them what they need to do next (APS, Studienkolleg, etc.), and then lets them browse bachelor's courses across all subjects at ~10 curated German universities — with full course details shown on selection.

---

## The Two Core Flows

### Flow 1 — User Verification (anabin)
User fills in their profile → app runs anabin check → shows result + next steps

### Flow 2 — Course Discovery
User searches by keyword (e.g. "Computer Science", "Business", "Mechanical Engineering") → sees matching unis on the left → selects a uni → sees matching courses at that uni → selects a course → sees full course details

---

## Section 1: User Profile Collection

Collected once, at the start (or during onboarding). Stored and reused for the course eligibility check.

| Field | Options / Format |
|---|---|
| Country of education | Dropdown (country list) |
| Qualification type | High school diploma, A-levels, IB, Indian 10+2, etc. |
| Grade / Percentage | Numeric input + grading scale selector |
| Language certificates | IELTS, TOEFL, TestDaF, DSH, none — with score |
| Target degree level | Bachelor's (only for MVP) |

---

## Section 2: Anabin Verification

After profile is submitted, the app looks up the user's country + qualification against anabin data and returns three things:

### 2a. Recognition Status
- **H+** — Directly recognised, equivalent to German Hochschulreife
- **H** — Recognised with conditions
- **H-** — Not directly recognised, further steps required
- **Not listed / unclear** — Manual check recommended

### 2b. What Category They Fall Into
Display the anabin category clearly with a plain-English explanation of what it means for their application.

### 2c. Next Steps Required
Based on country + category, show the specific actions the user must take before applying. Examples:

| Country | Typical Requirement |
|---|---|
| India | APS India certificate mandatory before applying |
| China | APS China certificate mandatory |
| Pakistan, Bangladesh | Studienkolleg may be required depending on grade |
| EU countries (most) | Direct application usually possible |
| US, UK, IB graduates | Generally direct recognition |

The next steps block should be actionable — link out to APS websites, Studienkolleg info, etc.

---

## Section 3: Course Data Model

For each university, we store the following for each course:

### University-Level Fields
- University name + city
- Application portal type: **Direct** / **uni-assist** / **other**
- General application deadline(s) (winter semester / summer semester)
- Semester contribution (fees) — the standard semester fee charged

### Course-Level Fields (per course at that uni)

| Field | Details |
|---|---|
| Course name | e.g. "Mechanical Engineering (B.Sc.)" |
| Degree | Bachelor of Science / Bachelor of Arts |
| Semester | Winter only / Summer only / Both |
| Language of instruction | German / English / Mixed |
| NC-free or not | Yes (open admission) / No (NC applies) |
| NC value (if applicable) | Last semester's NC score |
| Admission requirements | Language certs required, grade requirements, specific A-level/Indian subjects needed |
| Language requirements | e.g. TestDaF 4x4, DSH-2, IELTS 6.5 |
| Course structure | Brief overview — modules, duration, focus areas |
| How to apply | Direct link to uni portal or uni-assist, step-by-step notes |
| Application deadline | Course-specific if different from uni-level |

---

## Section 4: UI / Display Logic

### Search & Browse Screen (main screen after verification)

```
[ Search: "Computer Science"]   [ Degree: Bachelor ] [ Semester: Winter ]

LEFT PANEL                        RIGHT PANEL
─────────────────────             ─────────────────────────────────────
TU Munich              →          (select a uni to see matching courses)
LMU Munich
KIT Karlsruhe
TU Berlin
...
(~10 unis, filtered by
 whether they offer
 matching courses)
```

### Course List (after selecting a uni on the left)

The right panel shows all matching courses at that uni as cards:
- Course name
- Language of instruction
- NC-free badge (if applicable)
- Deadline (quick view)
- "View Details" button

### Course Detail View (after selecting a course)

Full detail panel / modal showing all 9 course-level fields listed above. This is the main information delivery surface.

---

## Section 5: The ~10 Universities (Slots)

Exact list TBD, but the data structure supports exactly this shape. Suggested candidates (broad public universities with wide program catalogs):

1. TU Munich (TUM)
2. LMU Munich
3. KIT Karlsruhe
4. TU Berlin
5. RWTH Aachen
6. University of Freiburg
7. University of Stuttgart
8. Saarland University
9. University of Tübingen
10. TU Darmstadt

*Replace any of these with the confirmed list.*

---

## Section 6: What Is Explicitly Out of Scope for MVP

- No user accounts / login (profile stored in session only)
- No summer semester courses unless data is available
- No master's programs
- No scholarship information
- No housing / visa information
- No automated anabin scraping — anabin data is manually curated per country for MVP
- No more than ~10 universities
- No personalised eligibility matching (e.g. "your grades qualify you for X") — that's post-MVP

---

## Section 7: Data Management (MVP Approach)

Given ~10 unis and a limited course list, the simplest approach for MVP is a **static JSON / structured data file** per university. No database needed initially.

Each uni gets a file like `tum.json` containing:
- uni-level fields
- array of courses, each with all course-level fields

This makes it easy to update manually and query on the frontend without a backend.

---

## MVP Milestone Checklist

- [ ] Finalise the 10 university list
- [ ] Build user profile form (Section 1)
- [ ] Build anabin lookup logic + curate data for top 10 origin countries (India, China, Pakistan, EU, US, UK, IB)
- [ ] Build anabin result + next steps display (Section 2)
- [ ] Populate course data JSON for all 10 unis (Section 3)
- [ ] Build search + left panel uni list (Section 4)
- [ ] Build course cards panel (Section 4)
- [ ] Build course detail view (Section 4)
- [ ] Connect profile data to course display (language filter, degree level)
- [ ] Basic mobile responsiveness
- [ ] Review all data for accuracy before launch

---

*Last updated: April 2026*