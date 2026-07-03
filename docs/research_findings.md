# Research Findings — Official Sources (researched 2 July 2026)

Status legend: ✅ confirmed on an official source (opened directly or quoted from it) · 🟡 strong evidence, needs final official confirmation · 🔴 conflicting sources · ⬜ not yet researched

Every ✅/🟡 item below maps to a `rules` record: put the source URL + quote + `verified_at: 2026-07-02` in the table. Re-verify anything money- or deadline-related every semester.

---

## Germany-shared

✅ **Recognition chain:** DAAD's admission-requirements database is based on anabin (ZAB/KMK) and prepared with uni-assist — so DAAD DB + uni-assist country pages are legitimate, English-language proxies for anabin.
→ https://www.daad.de/en/studying-in-germany/requirements/admission-database/

✅ **uni-assist country-by-country pages** give per-certificate rulings (goldmine for your engine — one page per country, in English).
→ https://www.uni-assist.de/en/tools/info-country-by-country/ (e.g. /details-country/country/sa/ for Saudi Arabia)
✅ uni-assist also has a self-check tool: https://www.uni-assist.de/tools/check-hochschulzugang/

✅ **Studienkolleg mechanics (DAAD official):** unrecognized certificate → either Studienkolleg in Germany or "two or three semesters of comparable study in your home country." Studienkolleg taught in German, requires B1–B2 + entrance exam; after 2 semesters → Feststellungsprüfung (FSP); FSP gives *subject-restricted* HZB; state-quota advantage for applying in the same Bundesland; IB/German-Abitur-abroad exempt.
→ https://www.daad.de/en/studying-in-germany/requirements/overview/

✅ **Blocked account:** mechanism confirmed by the Federal Foreign Office (amount varies by stay purpose, based on German student support rates; check the competent mission / Consular Services Portal).
→ https://www.auswaertiges-amt.de/en/sperrkonto-388600
🟡 Amount for study visas in 2026: **€11,904/year = €992/month** (BAföG-based, unchanged since WS 2024; multiple current sources agree; one 2026 article claiming €11,208 is wrong). Other visa purposes use different rates (e.g. ~€1,091/mo for study-applicant/Chancenkarte). Encode as: amount rule + "changes when BAföG changes" re-verify trigger.

⬜ Grade conversion Nmax/Nmin per board · language-certificate matrices per program type · hochschulstart/DoSV scope · uni-assist VPD process & fees (secondary sources say ~€75 first + €30 each; verify on uni-assist.de) · work-day limits on student visas.

---

## International curricula (cross-country — overrides the country tree)

**Engine impact (critical):** the checker must ask *curriculum type* BEFORE the national-board question, for every country. IB, GCE A-Levels, American HS+AP etc. are assessed under their own KMK evaluation proposals, not the country's national rules. A student with A-Levels from Riyadh, Karachi, or Mumbai gets the GCE tree, not the Tawjihiyah/FSc/CBSE tree. (This is exactly how the founder's own Saudi→direct-entry path worked.)

### GCE A-Levels ✅ (DAAD official)
- Recognized as a **direct but strictly subject-restricted** HZB when conditions from the UK evaluation proposal in anabin are met.
- **Subject formula (KMK, via DAAD):** four independent, general-education (non-vocational) subjects; **at least 3 at full A-Level** (AS sufficient for the 4th); **two AS can substitute one AL**. The four must include **a language at minimum AS** (Literature may count; German counts even if it's the mother tongue; a separate English exam like IELTS can NOT substitute) **and Mathematics or a natural science** (Bio/Chem/Physics).
- **Field match required:** the intended degree needs a suitable A-Level (e.g. Engineering/CS → Math + a science at AL; Medicine → four of Math/Bio/Chem/Physics at AL; Humanities → e.g. History/Geography AL).
- **Traps to encode:** A-Level Economics + Business Studies overlap → count as ONE subject; "Applied A-Levels" never qualify; **GCSE/IGCSE/O-Levels count only as middle-school certificates — never for university entrance**; Cambridge Pre-U Principle Subject ≥M3 ≈ A-Level ≥C; certificates must come from recognized awarding bodies (CAIE, Pearson/Edexcel, AQA, OCR, Oxford AQA, WJEC, CCEA, LRN) — school-issued certificates are insufficient.
→ https://www.daad.de/en/studying-in-germany/requirements/gce/ · https://www.daad-thailand.org/en/study-research-in-germany/admission-requirements/alevel/
- 🟡 12 consecutive years of schooling required (consistent secondary sources; confirm in the anabin UK proposal).
- 🟡 **Country caveat (from the DAAD GCE page):** for countries where GCE-type exams are part of the national system, the *country's* evaluation proposal may apply instead (e.g. Singapore has its own 3-H2+1-H1 formula). For Pakistan, verify whether CAIE O/A-Levels are assessed under the UK proposal or a Pakistan-specific entry in anabin — this decides a huge cohort.
- Note for Saudi corridor: Goethe's Studienkolleg Middle East explicitly does NOT admit GCE/IGCSE holders — because their route is the GCE direct-entry assessment, not Studienkolleg.

### IB Diploma ✅ (DAAD official + KMK agreement)
- Full IB **Diploma** required — IB Courses/Certificate without the diploma gives no access at all (not even Studienkolleg, per DAAD's US guide).
- **Structure:** 6 independent subjects, **≥3 at HL**; **two languages from groups 1–2 at level A or B**, of which at least one foreign language continued as Language A or Language B HL; *ab initio* doesn't satisfy groups 1–2; permitted 6th-subject list applies.
- **Math decides the scope (from 2021 exams):** Math "Analysis & Approaches" or "Applications & Interpretation" at **HL → direct GENERAL admission (all subjects)**; math at **SL → subject-specific** access excluding math/natural-science/technical fields.
- **KMK 2023 liberalization (effective May 2025 exams):** the old rule that one HL must be math/chem/bio/physics was replaced — now one of the three HL subjects must be **a language, mathematics, or a natural science**.
- **Grades:** all six subjects ≥4; a single grade 3 compensable by a 5 in a same-or-higher-level subject; **≥24 total points with ≥12 at HL**; more than one non-passing grade → no direct access even if the IB awards the diploma.
- Conditions not met → standard Studienkolleg/FSP route.
→ https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/ · KMK agreement: https://www.kmk.org/fileadmin/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2023-06-15_Liste1-2023-10-01_Liste2-2023-03-01_EN_.pdf

### Open interplay questions 🟡
- **APS × international boards:** APS is tied to where the qualification was obtained — so A-Levels/IB earned *inside India* very likely still require APS India (and the 70% rule's applicability to non-percentage certificates like A-Levels/IB needs checking on aps-india.de), while the same certificate earned in Saudi Arabia does not. Verify with APS India.
- ⬜ American HS + AP, French Bac, and other international curricula — same treatment, research when users demand it.

---

## India

✅ **Bachelor access (DAAD India, official):** Class 12 from Indian boards → **no direct admission**; the sole exception is a **valid JEE Advanced result** (→ direct, subject-specific). Otherwise: Studienkolleg + FSP.
→ https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/

✅ **NEW — the 70% rule (APS India official news):** anabin criteria updated **15 March 2026**; for admissions from **Winter Semester 2026/27**, minimum **70% overall in Class XII, all boards**, applies to BOTH pathways: (a) Studienkolleg route, and (b) direct subject-restricted admission after ≥1 completed academic year of a recognized Bachelor's — both conditions required; one year of bachelor no longer compensates a lower Class XII score. Applications submitted to APS before 15 March 2026 assessed under old criteria. APS provides an official Eligibility Quiz.
→ https://aps-india.de/news/
**Engine impact:** grade thresholds are now decision nodes for India; the checker must ask Class XII overall % and branch on ≥70 / <70, with the intake-semester cutoff logic.

✅ **NEW — dMAT (official, aps-india.de/dmat + d-mat.de):** required for Indian **Master's** applicants whose prior degree is in Engineering (incl. CS/IT engineering), Commerce/Accounting/Finance/Economics, or Business/Management, for **Summer Semester 2027 intake onward**, as part of APS documentation. Run by g.a.s.t. (TestDaF body); ~3.5h, English, core + General Academic Module; **€150**; first cycle: registration 29 Jun–15 Sep 2026, exam 26 Sep 2026, results 12 Oct 2026 → not feasible for WS 2026/27 (which doesn't require it). Exempt: already-issued APS certificates, exchange/double-degree/partnership programs, PhD, and enrolled bachelor students below 5 sem (3-yr) / 7 sem (4-yr). Interdisciplinary degrees decided by APS India's official affected-fields list — the certificate wording, not the marketing name.
→ https://aps-india.de/dmat/ · https://www.d-mat.de/en/dmat-in-india/
**Engine impact:** ask Master's applicants for prior-degree field + target intake; branch dMAT yes/no; deadline objects for the test cycle.

🟡 **APS India basics** (official portal exists; details from consistent secondary sources — confirm each on aps-india.de before `verified`): mandatory since Nov 2022 for degree study; fee ₹18,000 non-refundable; ~3–4 weeks processing (peaks 6–12); digital certificate (DigiZert) since Apr 2023; couriered applications only; possible interview for enrolled-bachelor applicants; exemptions incl. DAAD scholarship holders.

🟡 **TestAS** required for Indian undergrad applicants without JEE Main+Advanced (mentioned by DAAD-adjacent and APS-linked sources; verify scope on aps-india.de news). JEE Main alone ≠ direct entry but exempts TestAS.

🟡 **3-yr vs 4-yr bachelor for Master's:** 3-yr → subject-restricted / per-uni acceptance; 4-yr → generally unrestricted. Largely per-university; treat as guidance + per-course check, not a global verified rule.

⬜ MEA apostille flow · consulate-wise visa realities · an alleged "N-procedure" (Feb 2025) letting some unis bypass APS — single-source claim, verify or discard.

---

## Pakistan

🟡 **APS: strong evidence NOT required for Pakistan — the consultancy sites are almost certainly wrong.** Evidence: (a) the official German Missions in Pakistan student-visa page (updated 27 Nov 2025) details the full Consular-Services-Portal process and mandatory documents with **zero mention of APS**; (b) the embassy itself offers certified copies of educational documents for university applications — including one free set — a service that parallels what APS does elsewhere; (c) official APS history names China (2001), Vietnam (2007), India (2022) — no Pakistan; (d) sites claiming "aps-southasia.de" contradict this and give hallmark signs of AI-generated content. Final confirmation: run the embassy portal questionnaire (digital.diplo.de/studium) for a Pakistani profile and/or email the embassy. Until then, ship as beta: "No APS required per the embassy's published process — confirm in the official portal."
→ https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104 · https://pakistan.diplo.de/pk-en/service/legal-uess-1680522

✅ **Visa process (official):** fully digital via the Consular Services Portal; interactive questionnaire generates the required-document list; Islamabad serves ICT, Gilgit-Baltistan, KPK, AJK, Punjab; Karachi serves Sindh + Balochistan; embassy explicitly notes demand exceeds capacity (long waits) and that degree certificates/transcripts are mandatory uploads from the outset.
→ same URLs as above

🟡 **School certificates:** FSc/HSSC not Abitur-equivalent → Studienkolleg (T/M/W-Kurs per subject) or 1 year at a Pakistani university first; Studienkolleg application needs German ~B1; secondary sources claim the embassy requires ≥B1 German for the Studienkolleg-route visa. Verify all on uni-assist's Pakistan country page + anabin.
⬜ HEC attestation flow (note: HEC launched paperless e-attestation — check), IBCC for school docs, MOFA stamping · 2-yr BA/BSc vs 4-yr BS treatment for Master's · Pakistan's Hague-apostille status and German acceptance.

---

## Saudi Arabia

✅ **Regular Saudi high-school diploma (Tawjihiyah) → Studienkolleg required** before university; different regulations for SAT/IG-type certificates, and "sometimes even a year of study in KSA will be required." (German Embassy Riyadh, official)
→ https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436

✅ **University-study ladder (uni-assist official country page):** 1 completed year at an accredited Saudi university → qualifies for Studienkolleg (same subject area); **2 completed years → direct subject-restricted Bachelor admission**. Note: **new rules from Winter Semester 2026/27** for the Secondary Industrial Education Certificate — a third 2026 rule change, this time in your own corridor.
→ https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/

✅ **Studienkolleg Middle East (Goethe-Institut Riyadh, official):** a one-year hybrid preparatory program *in Saudi Arabia* (T-Kurs focus, partner TU Berlin, FSP exams in Cairo), entry at German B1, open to school graduates from the region (incl. Yemenis); completed Saudi bachelor → no Studienkolleg needed (C1 for German-taught). GCE/IGCSE holders cannot attend; IB case-by-case. Killer recommendation content for your Saudi/Gulf users.
→ https://www.goethe.de/ins/sa/en/spr/klg.html · /faq.html

🟡 **Expat-curriculum routing:** APS follows where the qualification was obtained, not the passport (consistent with APS being country-of-education institutions) — so an Indian-curriculum student in Riyadh with Indian-board certificates likely needs APS India, while their Saudi-curriculum classmate doesn't. Confirm with APS India for CBSE-abroad certificates specifically. Intake form must capture: nationality, certificate country, curriculum/board — three separate fields.
⬜ MOFA attestation details · Saudi GPA-scale conversion · citizen-vs-iqama-resident visa routing at Riyadh/Jeddah.

---

## The meta-finding

Three separate rule changes land in 2026 alone: India's 70% minimum (15 Mar), dMAT (from SS 2027 intakes, first cycle running now), and new Saudi certificate rules (WS 2026/27) — plus a Pakistan misinformation cluster confidently spreading a possibly non-existent requirement. The market's information layer is broken in exactly the way your product assumes.

## What's still open

The ⬜ items, per-university data (3-yr-bachelor acceptance, MOI, GRE), anabin institution lookups (interactive German portal — do these manually per persona), and final confirmations on every 🟡. For the long tail, run Claude's **Research** feature on Parts B–D of the checklist (it can sustain the 20+ searches this needs), then hand results to corridor verifiers before flipping anything to `verified`.