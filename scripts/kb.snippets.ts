// Curated official snippets for the assistant knowledge base — the source of
// truth for kb_chunks rows with source_type='snippet'. Hand-lifted from
// docs/research_findings.md (researched 2 July 2026, re-verified 4 July 2026).
// To add or fix a snippet: edit this file and rerun `pnpm kb:embed`.
// Findings marked "needs final official confirmation" in the research doc keep
// that caveat in their content so the assistant repeats it.

import type { KbChunk } from "../lib/ai/kb";

const CHECKED_AT = "2026-07-04T00:00:00Z";

export const kbSnippets: KbChunk[] = [
  // ------------------------------------------------------------- general
  {
    slug: "snippet-recognition-chain",
    title: "How certificate recognition works (anabin, DAAD, uni-assist)",
    content:
      "DAAD's admission-requirements database is based on anabin (ZAB/KMK) and prepared with uni-assist — so the DAAD database and uni-assist country pages are legitimate, English-language proxies for anabin when checking whether a certificate qualifies for German university admission.",
    source_url:
      "https://www.daad.de/en/studying-in-germany/requirements/admission-database/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-uni-assist-country-pages",
    title: "uni-assist country pages and self-check tool",
    content:
      "uni-assist publishes country-by-country pages with per-certificate rulings on German university admission (one page per country, in English), plus a self-check tool for Hochschulzugang at uni-assist.de/tools/check-hochschulzugang.",
    source_url: "https://www.uni-assist.de/en/tools/info-country-by-country/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-studienkolleg-mechanics",
    title: "How Studienkolleg works",
    content:
      "If a school certificate is not recognized for direct admission, the route is either Studienkolleg in Germany or two or three semesters of comparable study in the home country. Studienkolleg is taught in German and requires German B1–B2 plus an entrance exam; after 2 semesters students take the Feststellungsprüfung (FSP). The FSP gives a subject-restricted higher-education entrance qualification. There is a state-quota advantage for applying to universities in the same Bundesland as the Studienkolleg. IB holders and German-Abitur-abroad holders are exempt.",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/overview/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-blocked-account-mechanism",
    title: "Blocked account (Sperrkonto) — official mechanism",
    content:
      "The blocked account mechanism is confirmed by the Federal Foreign Office: the required amount varies by stay purpose and is based on German student support (BAföG) rates. Check the competent German mission or the Consular Services Portal for the amount that applies to your visa type.",
    source_url: "https://www.auswaertiges-amt.de/en/sperrkonto-388600",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-blocked-account-amount",
    title: "Blocked account amount for study visas (2026)",
    content:
      "For study visas in 2026 the blocked account amount is €11,904 per year (€992 per month), BAföG-based and unchanged since Winter Semester 2024. Needs final official confirmation — verify on the Federal Foreign Office page or with the competent mission before relying on it. Other visa purposes use different rates (e.g. roughly €1,091/month for study-applicant/Chancenkarte). The amount changes when BAföG rates change.",
    source_url: "https://www.auswaertiges-amt.de/en/sperrkonto-388600",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-curriculum-before-board",
    title: "International curricula are assessed under their own rules",
    content:
      "IB, GCE A-Levels, American high school with AP and similar international curricula are assessed under their own KMK evaluation proposals, not the country's national rules. A student with A-Levels from Riyadh, Karachi, or Mumbai is assessed under the GCE rules, not the Tawjihiyah/FSc/CBSE rules. What counts is the curriculum type, then the board.",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-gce-country-caveat",
    title: "GCE A-Levels: country caveat",
    content:
      "For countries where GCE-type exams are part of the national system, the country's own evaluation proposal may apply instead of the UK GCE proposal (e.g. Singapore has its own 3-H2-plus-1-H1 formula). For Pakistan, whether CAIE O/A-Levels are assessed under the UK proposal or a Pakistan-specific anabin entry needs final official confirmation.",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-ib-diploma-formula",
    title: "IB Diploma: German admission formula",
    content:
      "IB Diploma admission to German universities (KMK agreement): math decides the scope from 2021 exams — math (Analysis & Approaches or Applications & Interpretation) at HL gives direct general admission to all subjects; math at SL gives subject-specific access excluding math, natural-science and technical fields. Grade requirements: all six subjects at grade 4 or higher (a single grade 3 can be compensated by a 5 in a same-or-higher-level subject), at least 24 total points with at least 12 at HL. More than one non-passing grade means no direct access even if the IB awards the diploma. If conditions are not met, the standard Studienkolleg/FSP route applies.",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  {
    slug: "snippet-expat-curriculum-routing",
    title: "APS follows the country of education, not the passport",
    content:
      "APS follows where the qualification was obtained, not the passport. An Indian-curriculum student in Riyadh with Indian-board certificates likely needs APS India, while a Saudi-curriculum classmate does not. Needs final official confirmation with APS India for CBSE-abroad certificates specifically. Three separate facts matter: nationality, certificate country, and curriculum/board.",
    source_url: "https://aps-india.de/",
    last_verified_at: CHECKED_AT,
    country_code: null,
  },
  // --------------------------------------------------------------- India
  {
    slug: "snippet-dmat-details",
    title: "dMAT test details (India, Master's)",
    content:
      "dMAT is required for Indian Master's applicants whose prior degree is in Engineering (including CS/IT engineering), Commerce/Accounting/Finance/Economics, or Business/Management, for Summer Semester 2027 intake onward, as part of APS documentation. Run by g.a.s.t. (the TestDaF body); about 3.5 hours, in English, core plus General Academic Module; fee €150. First cycle: registration 29 Jun–15 Sep 2026, exam 26 Sep 2026, results 12 Oct 2026 — not feasible for Winter Semester 2026/27, which does not require it. Exempt: already-issued APS certificates, exchange/double-degree/partnership programs, PhD, and enrolled bachelor students below semester 5 (3-year) or 7 (4-year). For interdisciplinary degrees, APS India's official affected-fields list and the certificate wording decide, not the marketing name of the program.",
    source_url: "https://aps-india.de/dmat/",
    last_verified_at: CHECKED_AT,
    country_code: "in",
  },
  {
    slug: "snippet-aps-india-basics",
    title: "APS India basics (fee, processing, format)",
    content:
      "APS is mandatory for Indian applicants for degree study in Germany since November 2022. Fee ₹18,000, non-refundable. Processing usually 3–4 weeks (6–12 weeks at peak). Digital certificate (DigiZert) since April 2023. Applications are couriered only. Enrolled-bachelor applicants may face an interview. Exemptions include DAAD scholarship holders. These details come from consistent secondary sources and the official portal — confirm each on aps-india.de before relying on them.",
    source_url: "https://aps-india.de/",
    last_verified_at: CHECKED_AT,
    country_code: "in",
  },
  {
    slug: "snippet-india-3yr-4yr-bachelor",
    title: "3-year vs 4-year bachelor for Master's admission",
    content:
      "A 3-year Indian bachelor generally gives subject-restricted or per-university acceptance for German Master's programs; a 4-year bachelor is generally unrestricted. This is largely decided per university — treat it as guidance plus a per-course check, not a global verified rule. Needs final official confirmation.",
    source_url: "https://www.daad.in/en/study-research-in-germany/studying-in-germany/master-studies/",
    last_verified_at: CHECKED_AT,
    country_code: "in",
  },
  // ------------------------------------------------------------ Pakistan
  {
    slug: "snippet-pakistan-aps-status",
    title: "APS status for Pakistan",
    content:
      "Strong evidence indicates APS is NOT required for Pakistan, contrary to many consultancy sites: the official German Missions in Pakistan student-visa page (updated 27 Nov 2025) details the full Consular Services Portal process and mandatory documents with zero mention of APS; the embassy itself offers certified copies of educational documents for university applications; official APS history names China (2001), Vietnam (2007), India (2022) — no Pakistan. Needs final official confirmation via the embassy portal questionnaire (digital.diplo.de/studium) or the embassy directly. Until then: no APS required per the embassy's published process — confirm in the official portal.",
    source_url: "https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104",
    last_verified_at: CHECKED_AT,
    country_code: "pk",
  },
  {
    slug: "snippet-pakistan-visa-process",
    title: "Pakistan: student visa process",
    content:
      "The German student visa process for Pakistan is fully digital via the Consular Services Portal; an interactive questionnaire generates the required-document list. Islamabad serves ICT, Gilgit-Baltistan, KPK, AJK and Punjab; Karachi serves Sindh and Balochistan. The embassy explicitly notes demand exceeds capacity (long waits) and that degree certificates and transcripts are mandatory uploads from the outset.",
    source_url: "https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104",
    last_verified_at: CHECKED_AT,
    country_code: "pk",
  },
  {
    slug: "snippet-pakistan-school-certificates",
    title: "Pakistan: FSc/HSSC recognition",
    content:
      "FSc/HSSC is not Abitur-equivalent, so the route is Studienkolleg (T/M/W-Kurs depending on subject) or one year at a Pakistani university first. Studienkolleg application needs roughly German B1; secondary sources claim the embassy requires at least B1 German for the Studienkolleg-route visa. Needs final official confirmation — verify on uni-assist's Pakistan country page and anabin.",
    source_url: "https://www.uni-assist.de/en/tools/info-country-by-country/",
    last_verified_at: CHECKED_AT,
    country_code: "pk",
  },
  // -------------------------------------------------------- Saudi Arabia
  {
    slug: "snippet-saudi-tawjihiyah",
    title: "Saudi Tawjihiyah → Studienkolleg",
    content:
      "A regular Saudi high-school diploma (Tawjihiyah) requires Studienkolleg before university study in Germany (German Embassy Riyadh, official). Different regulations apply to SAT/IG-type certificates, and sometimes even a year of study in Saudi Arabia is required.",
    source_url: "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
    last_verified_at: CHECKED_AT,
    country_code: "sa",
  },
  {
    slug: "snippet-saudi-private-school-ladder",
    title: "Saudi private-school certificate: university-study ladder",
    content:
      "Where the ZAB assessment of a Saudi private-school certificate meets the requirements: 1 completed year at an accredited Saudi university gives access to Studienkolleg in the same subject area; 2 completed years give direct subject-restricted Bachelor admission (uni-assist official country page). Do not generalize this wording to every Saudi national certificate. New rules apply from Winter Semester 2026/27 for the Secondary Industrial Education Certificate.",
    source_url:
      "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/sa/",
    last_verified_at: CHECKED_AT,
    country_code: "sa",
  },
  {
    slug: "snippet-studienkolleg-middle-east",
    title: "Studienkolleg Middle East (Goethe-Institut Riyadh)",
    content:
      "Studienkolleg Middle East is a one-year hybrid preparatory program in Saudi Arabia (T-Kurs focus, partner TU Berlin, FSP exams in Cairo), entry at German B1, open to school graduates from the region including Yemenis. A completed Saudi bachelor means no Studienkolleg is needed (C1 German for German-taught programs). GCE/IGCSE holders cannot attend; IB is case-by-case.",
    source_url: "https://www.goethe.de/ins/sa/en/spr/klg.html",
    last_verified_at: CHECKED_AT,
    country_code: "sa",
  },
];
