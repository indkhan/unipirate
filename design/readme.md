# Uniweg Design System — "Wayfinding"

Design system for a web app guiding students from India, Pakistan, and Saudi Arabia through applying to German public universities: eligibility, documents, deadlines, and a tracked application dashboard. ("Uniweg" is a working name — swap freely.)

**Audience:** 17–24, anxious about a confusing bureaucratic process, mostly mid-range Android phones on slow connections. Mobile-first is non-negotiable.

**Emotional job:** turn anxiety into confidence. Promise: *every claim verified, with sources and dates.* Feel: official-but-warm, precise, calm — a well-run German institution that actually likes you.

**Direction:** German public wayfinding + official-document culture. Transit-map clarity, DIN-style signage type, form-and-stamp paper culture — modernized and friendly, never cold.

**Anti-references:** study-abroad consultancy sites (stock lawn photos, gradient CTAs, "FREE counselling" popups); generic AI-startup pages (dark bg + neon accent, cream + serif + terracotta); template SaaS.

Sources: none provided (from-scratch system, brief only). No logo exists — render "Uniweg" in Archivo 700; never invent a mark.

---

## PALETTE

| Token | Value | Name | Usage rule |
|---|---|---|---|
| `--paper` | #F2F4F7 | Paper | App background. Cool, never cream, never pure white. |
| `--surface` | #FFFFFF | Surface | Cards, sheets, inputs sit white on Paper. |
| `--ink` | #16243D | Ink | All text. Navy-black; never #000. |
| `--route-blue` | #1F4FBF | Route Blue | THE brand color: primary actions, links, the Route line, "you are here", focus, selection. If it isn't interactive or part of the journey, it isn't blue. |
| `--verified` | #0E7A4B | Verified Green | RESERVED: Verified stamp and source-checked states only. Never buttons, never generic success. |
| `--signal` / `--signal-accent` | #9A6200 / #E5A32E | Signal Amber | RESERVED: time pressure only — deadlines, expiring docs, stale verification. Never decorative. |
| `--danger` | #B3261E | Danger | Form errors + destructive actions only. Errors are red, not amber. |

Hairlines (`--line`) do the separating; shadows almost never (see spacing.css).

## TYPE — three voices

- **Archivo** (display) — the SIGN. Headlines, station names, card titles, buttons. Picked over Barlow: sturdier DIN-flavored grotesque — flat terminals, tall x-height, engineered feel at signage sizes — and less startup-worn.
- **Public Sans** (body) — the CLERK. Designed for the U.S. federal government: official but plain, excellent at 14–16px on cheap screens.
- **IBM Plex Mono** (mono) — the DOCUMENT. Dates, deadlines, rule IDs, citations, file numbers. Mono is the "document data" voice; if a stamp would touch it, it's mono.

Full scale in `tokens/typography.css` (`--text-display-xl` … `--text-mono-label`). Mobile-first clamps on display sizes. Body never below 14px; fine print 12.5px minimum.

## CONTENT FUNDAMENTALS

- Second person, present tense: "You need an APS certificate." Calm, concrete, never breathless. No exclamation marks. No emoji, ever.
- Sentence case everywhere, including buttons ("Check my eligibility"). Uppercase is reserved for mono labels (VERIFIED, DEADLINE, STEP 02).
- Every rule statement carries a source + last-verified date: `uni-assist FAQ §2.1 · verified 12 Jun 2026`. Dates always `DD MMM YYYY`, always mono.
- Say the scary thing plainly, then say what to do: "Miss this date and you wait a full semester. Set a reminder now."
- German terms appear once with a plain-English gloss: "APS (a document check for applicants from India, Pakistan …)".

## VISUAL FOUNDATIONS

- **Backgrounds:** flat Paper; no gradients, no textures, no imagery washes. White Surface cards on Paper.
- **Borders/cards:** 1px `--line` hairline, `--radius-card` 10px, no shadow. One shadow token (`--shadow-overlay`) for dialogs/menus only.
- **Radius stance:** documents have corners — 6px controls, 10px cards. Pills only for station dots.
- **Hover:** darken (`--route-blue-hover`) or tint (`--route-blue-tint`); never opacity fades. Press: background darkens one step, no shrink.
- **Focus:** 3px `--focus-ring` outside ring — visible, unashamed.
- **Motion:** few + purposeful. 140ms state changes, 240ms reveals, `--ease`. One signature move: the Route line drawing toward "you are here" on dashboard load. Everything gated behind `prefers-reduced-motion`.
- **Imagery:** none by default. No stock photos. Where an illustration is unavoidable, use striped placeholder + ask for real material.
- **Layout:** single column ≤768px, 16px gutters, 48px tap targets. Density is calm: one decision per screen region.

## SIGNATURE ELEMENT — the Route

`RouteLine` component: the student's journey as a transit line — Eligibility → APS → Applications → Visa → Germany — with a "you are here" marker. Horizontal on desktop, vertical on mobile. Done stations = filled blue + check; current = ringed marker; upcoming = hollow. This is the one memorable thing; everything else stays quiet.

## SECONDARY MOTIF — the Verified stamp

`VerifiedStamp` chip: green check seal + source link + last-verified date in mono. Appears wherever a rule is cited. Green lives here and almost nowhere else.

## ICONOGRAPHY

No icon font. The system's glyphs are typographic and geometric: station dots (circles), checkmarks (✓ drawn as a 2-line polyline or unicode), chevrons (›), and mono labels doing what icons would. If a real icon set becomes necessary, use Lucide at 1.5px stroke, 18–20px — and flag it. No emoji.

## INDEX

- `styles.css` → imports `tokens/{fonts,colors,typography,spacing}.css`
- `components/actions/` — Button
- `components/forms/` — Input
- `components/surfaces/` — Card
- `components/route/` — RouteLine
- `components/verification/` — VerifiedStamp
- `components/tasks/` — ChecklistItem, DeadlineChip
- `components/feedback/` — ProgressMeter, EmptyState
- `guidelines/` — foundation specimen cards
- `Style Guide.dc.html` — full style-guide page
- `Hero Directions.dc.html` — hero in Wayfinding vs. alternative "Formular" direction (official-form paper culture)

### Intentional additions
- `ProgressMeter` — "n of m documents" bar; the brief's "progress states" beyond the Route itself.
