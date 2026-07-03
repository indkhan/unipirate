# Research Checklist — Rule Engine Content

Every item below becomes one or more records in the `rules` table: **claim + condition + official source URL + quote + date verified**. If you can't find an official source, the rule ships as `beta` with a "confirm with [authority]" fallback — never as `verified`.

## Research protocol (read first)

**Source hierarchy:** 1) Official German: anabin (anabin.kmk.org), DAAD country pages (daad.de + local DAAD offices), uni-assist.de, hochschulstart.de, Auswärtiges Amt + the specific German embassy/mission site, university admission pages. 2) Semi-official: APS portals, Studienkolleg sites, Goethe-Institut. 3) Everything else (consultancy blogs, YouTube, Reddit) = leads only, never sources.

**Why this matters — a live example:** during research for this checklist, multiple consultancy sites stated APS is mandatory for Pakistani students, while other guides state Pakistan is exempt and APS covers only India/China/Vietnam. Directly contradictory claims about a make-or-break requirement. Resolve it only from the German Embassy Islamabad / Auswärtiges Amt — and treat every consultancy claim with equal suspicion.

**Record per rule:** condition (country, qualification, target) → outcome → source URL → exact supporting quote → date you opened it. Rules touching money, deadlines, or mandatory documents get re-verified every semester; the admin panel should flag anything >6 months old.

**Corridor verifiers:** you own Saudi. Recruit one recent Indian and one recent Pakistani applicant (offer free lifetime access + credit) to review their country's tree before it flips to `verified`.

---

## Part A — Germany-side (shared across all corridors)

**anabin mechanics**
- [ ] How institution ratings work: H+, H+/-, H- — what each means for admission
- [ ] How school-certificate entries work per country (direct access / Studienkolleg / no access) and how to read "Abschlusstyp" entries
- [ ] What to do when an institution/certificate isn't listed (ZAB Statement of Comparability — process, cost, time)

**Admission pathways (HZB)**
- [ ] Direct access vs Feststellungsprüfung: exactly what triggers Studienkolleg
- [ ] Studienkolleg course types (T, M, W, G, S) and which maps to which degree subject
- [ ] Public vs private Studienkollegs; Aufnahmeprüfung (entrance test) content; German level required to even apply; can the test be taken remotely
- [ ] Alternative: subject-restricted admission after N years of home-country university study — the N per country
- [ ] **NEW 2026:** minimum-score / test changes announced this year affecting existing pathways — what changed, effective dates, who's grandfathered

**uni-assist**
- [ ] Which universities require it vs direct application; VPD (Vorprüfungsdokumentation) — what it is, when needed, cost, processing time per season
- [ ] Document formats: certified copies, translation requirements (who may translate)

**Grades & conversion**
- [ ] Modified Bavarian formula + the official Nmax/Nmin values per country/board (needed for your converter tool)

**Language**
- [ ] German-taught: accepted certs (TestDaF, DSH, Goethe C2/C1, telc C1 Hochschule, DSD II) and typical required levels; Studienkolleg entry level (usually B1/B2 — verify per Kolleg)
- [ ] English-taught: IELTS/TOEFL bands typical ranges; MOI (medium of instruction) letters — which unis accept them (varies hugely — this is a rules-table candidate per uni, not a global rule)

**Money & insurance**
- [ ] Blocked account: current required amount and monthly payout — sources conflict even for 2026 (€11,904 vs other figures reported); verify on Auswärtiges Amt, note it changes each year → perfect rule-change-alert demo
- [ ] Accepted proof-of-funds alternatives (sponsor Verpflichtungserklärung, scholarship letter)
- [ ] Health insurance: travel vs public student insurance, when each applies, age limits
- [ ] Semester contribution ranges; Baden-Württemberg non-EU tuition fee status (currently ~€1,500/sem — verify, it's been politically contested)

**Deadlines & applications**
- [ ] Standard winter/summer deadlines; which programs run on hochschulstart/DoSV (NC subjects like medicine); uni-specific deviations (rules per course, captured via your extraction pipeline)

**Master's-specific (all corridors)**
- [ ] ECTS equivalence expectations; how unis evaluate non-Bologna degrees
- [ ] GRE/GATE requirements at some TU9 programs (per-course data)
- [ ] **NEW:** dMAT (Digital Master Test) announced June 2026 for selected Indian Master's applicants (engineering/commerce/business) from Summer Semester 2027 — scope, score requirements, exemptions, official source. Confirm it's India-only.

**Visa (general)**
- [ ] National D visa for study: standard document set; Student Applicant Visa (Studienbewerbervisum) — when it's the right path; processing time ranges; work rights (140 full / 280 half days — verify current figures)

---

## Part B — India

- [ ] **Access rules for Bachelor's** (verify against DAAD India + anabin, not blogs): what 10+2 alone gives; the JEE Advanced route to direct access; 1 year vs 2 years of Indian bachelor study — exact current thresholds and any 2026 changes
- [ ] Board differences: CBSE vs CISCE vs state boards in anabin — are any treated differently; minimum grade thresholds
- [ ] **APS India:** portal, fee (~₹18,000 — verify current), documents, processing time, validity, exemptions (DAAD scholarship holders? PhD? exchange?), plus the new dMAT interaction
- [ ] **3-year bachelor problem for Master's:** which unis accept B.Sc/B.Com/BA (3yr) directly, which demand 4 years or a PG year — mostly per-uni data; find any official general guidance
- [ ] Grade systems: percentage vs 10-point CGPA; official conversion parameters
- [ ] Documents: MEA apostille process (India is in the Hague convention), translation norms
- [ ] Visa: German Missions in India process, VFS role, current appointment/processing realities per consulate, blocked-account timing in the sequence
- [ ] Common failure points to encode as warnings: name mismatches across documents, gap-year justification, backlog certificates

## Part C — Pakistan

- [ ] **⚠️ FIRST: resolve the APS question** — required for Pakistanis or not? Only from German Embassy Islamabad / Auswärtiges Amt / official APS portal. If yes: portal, fees, interview, timelines, exemptions. If no: what document verification replaces it (embassy legalization — process and its own long timeline). Every other Pakistan rule sequences around this answer.
- [ ] School certificates: FSc/HSSC and O/A-Levels in anabin — Studienkolleg triggers; the 1-year-university alternative; IBCC attestation for school documents
- [ ] Degrees: HEC attestation process; 2-year BA/BSc (old scheme) vs 4-year BS — treatment for Master's admission; 2+2 (BA+MA) combinations; anabin status spread of Pakistani universities (H+/H-)
- [ ] Language: claim found that the embassy requires ≥B1 German for the (German-taught/Studienkolleg) visa route — verify scope: does it apply to English-taught Master's applicants too?
- [ ] Apostille: Pakistan's Hague convention status and effective date — does apostille now replace legalization, and do German authorities accept it yet?
- [ ] Visa: Islamabad/Karachi appointment system, realistic wait times (reports of many months), document verification step, bank/remittance mechanics for the blocked account (SWIFT from HBL/UBL/Meezan etc.)

## Part D — Saudi Arabia

- [ ] Tawjihiyya (general secondary) in anabin: direct access or Studienkolleg; do Qudurat/Tahsili scores or the track (science/arts) matter in the German assessment
- [ ] **The expat case (your own!):** students in KSA on Indian (CBSE/NIOS) or Pakistani (FBISE) curricula — which rule tree applies? Evidence suggests APS follows *where you studied*, not passport — verify officially, and define how your intake form must ask this (curriculum + country of certificate + nationality as separate questions)
- [ ] Saudi bachelor degrees for Master's: anabin ratings of Saudi universities, GPA scale conversion (4.0/5.0 scales)
- [ ] Document chain: MOFA attestation, Saudi Cultural Attaché role, translation (Arabic → German/English) requirements
- [ ] Visa: Riyadh/Jeddah missions — process differences for Saudi citizens vs iqama-holding residents (can residents even apply there, or must they apply in their citizenship country? — critical routing rule)
- [ ] No-APS assumption for Saudi certificates — confirm officially

---

## Part E — Test personas (engine must handle all before launch)

1. CBSE 12th, 82%, wants CS Bachelor's, no JEE — expected: Studienkolleg/alternate route
2. CBSE 12th + JEE Advanced qualified — expected: direct access
3. Indian 3-yr B.Sc (7.8 CGPA) → Master's — expected: per-uni caveat + APS + (dMAT if in scope)
4. Indian 4-yr B.Tech → Master's, English-taught — expected: APS + IELTS/MOI question
5. Pakistani FSc pre-engineering → Bachelor's — expected: Studienkolleg T-Kurs or 1 yr uni + (APS per resolved answer)
6. Pakistani 2-yr B.Com → Master's — expected: likely insufficient alone; show options honestly
7. Pakistani 4-yr BS(CS), HEC-attested → Master's
8. Saudi Tawjihiyya (science), 92% — expected: Studienkolleg
9. Indian passport, CBSE school in Riyadh → Bachelor's — the routing edge case
10. Saudi bachelor (KFUPM) → Master's
11. A-Levels (CAIE) in Saudi Arabia: 3 AL (Math, Physics, CS) + 1 AS (English) → CS Bachelor's — expected: direct subject-restricted entry, no Studienkolleg, no APS (the founder's own path)
12. A-Levels in Pakistan: 2 AL + 2 AS, no math/science AL → expected: fails the GCE formula → Studienkolleg route (and verify which anabin proposal applies to Pakistan-obtained GCE)
13. IB Diploma in India, Math AA at SL, 28 points → Mechanical Engineering Bachelor's — expected: SL math blocks STEM direct entry; check APS applicability for IB-in-India

## Suggested order

1. anabin mechanics + Germany shared (unblocks everything)
2. India Bachelor rules + APS (+ dMAT) → India Master's
3. Saudi (small tree, you're the verifier, includes the expat routing question)
4. Pakistan (blocked on the APS answer — start that inquiry on day one, it may take longest)