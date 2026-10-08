// Rule records mirroring docs/research_findings.md (researched 2 July 2026,
// re-verified against the live official sources 4 July 2026).
// Research confidence is retained in each candidate, but seed.ts always inserts
// candidates as drafts. Runtime eligibility comes only from DB rows reviewed in
// /admin; the application and evaluator never import this snapshot.
import { intakeIndex, type EngineRule } from "../lib/engine/evaluate";
import { dmatCandidates } from "./dmat.rules";
import { ibCandidates, ibDocumentCandidates } from "./ib.rules";
import { gceCandidates } from "./gce.rules";
import {processCandidates} from "./process.rules";
import { indiaStudyCandidates } from "./india-study.rules";

type RuleRecord = EngineRule & { country: string | null };

const SOURCE_CHECKED_AT = "2026-07-04T00:00:00Z";
// Process-step facts (APS fee/courier flow, uni-assist fees, blocked-account
// amount, India/Saudi visa appointment routing) re-verified 22 August 2026
// against aps-india.de, uni-assist.de, india.diplo.de and saudiarabien.diplo.de.
const PROCESS_SOURCE_CHECKED_AT = "2026-08-22T00:00:00Z";
// visa-country APS scoping verified 7 July 2026 against aps-india.de/faq and
// the German Embassy Riyadh student-visa checklist (VFS Global).
const VISA_SOURCE_CHECKED_AT = "2026-07-07T00:00:00Z";
const SS_2026 = intakeIndex("summer", 2026);
const WS_2026_27 = intakeIndex("winter", 2026);
// UP-ELIG-06: reviewed 2026-10-07. APS assessment timing is not an admission guarantee.
// Only a reported APS-confirmed complete submission for the relevant procedure
// supplies the new key; legacy aps_application_day conditions remain inactive.
const INDIAN_BOARDS = ["cbse", "cisce", "state_board"];
const APS_TRANSITION_CONDITIONS = {
  target_degree: "bachelor", curriculum: "national",
  aps_issuer_country: "in", aps_qualification_context: "national",
  board: { op: "in", value: INDIAN_BOARDS },
  // UP-ELIG-04: the two ordinary Class XII routes are assessed independently of JEE.
  class12_percent: { op: "lt", value: 70 },
  intake_index: { op: "gte", value: WS_2026_27 },
} as const;


export const ruleData: RuleRecord[] = [
  ...indiaStudyCandidates,
  ...processCandidates,
  {
    id: "aps-transition-before", country: "in", status: "draft",
    conditions: { ...APS_TRANSITION_CONDITIONS, aps_confirmed_submission_day: { op: "lt", value: 20260315 } },
    outcomes: { path: "unknown", note: "Your reported APS-confirmed complete submission predates 15 March 2026 for this procedure. APS assesses it under the earlier criteria; this does not establish admission for Winter Semester 2026/27 or later. Already-issued certificates retain validity. Confirm your complete qualification pathway with the university." },
    source_url: "https://aps-india.de/news/",
    source_quote: "Applications submitted before the implementation date (15 March 2026)",
    last_verified_at: "2026-10-07T00:00:00Z",
  },
  {
    id: "aps-transition-current", country: "in", status: "draft",
    conditions: { ...APS_TRANSITION_CONDITIONS, aps_confirmed_submission_day: { op: "gte", value: 20260315 } },
    outcomes: { path: "insufficient", note: "For admissions from Winter Semester 2026/27, the reported Class XII score does not meet the 70% criterion for the Studienkolleg or one-successful-bachelor-year pathways. This procedure has no pre-15 March 2026 APS submission basis. Certificate possession does not waive admission prerequisites; confirm any other qualification pathway with the university." },
    source_url: "https://aps-india.de/news/",
    source_quote: "a minimum overall score of 70%",
    last_verified_at: "2026-10-07T00:00:00Z",
  },
  {
    id: "aps-transition-unconfirmed", country: "in", status: "draft",
    conditions: { ...APS_TRANSITION_CONDITIONS, aps_submission_confirmation: "unknown" },
    outcomes: { path: "unknown", note: "Does APS confirm the complete application submission date for the procedure covering your relevant qualifications? Ask APS India if the procedure or date is uncertain. Registration, payment, dispatch and receipt alone do not establish the March transition milestone. Confirm admission separately with the university." },
    source_url: "https://aps-india.de/news/",
    source_quote: "Applications submitted before the implementation date (15 March 2026)",
    last_verified_at: "2026-10-07T00:00:00Z",
  },
  // UP-ELIG-05: evidence retrieved 2026-10-06, not an effective-intake date.
  // These candidates require human admin publication; no seed runs here.
  {
    id: "aps-scoped-qualification", country: "in",
    conditions: { aps_issuer_country: "in", aps_qualification_context: "national", target_degree: "bachelor" },
    outcomes: { aps_scopes: { qualification: { value: "required", documents: ["APS India certificate"] } } },
    status: "draft", source_url: "https://www.kmk.org/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/APS_2015_12_10.pdf",
    source_quote: "Studienbewerber zugelassen, die das Zertifikat bzw. die Bescheinigung der Akademischen Prüfstelle als Nachweis der Erfüllung der in den Bewertungsvorschlägen der Kultusministerkonferenz festgelegten Voraussetzungen für die Aufnahme eines Erststudiums vorlegen können.",
    last_verified_at: "2026-10-06T00:00:00Z",
  },
  {
    id: "aps-scoped-application", country: "in",
    conditions: { aps_issuer_country: "in", aps_qualification_context: "national", aps_application_context: "uni_assist" },
    outcomes: { aps_scopes: { application: { value: "required", documents: ["APS India certificate"] } } },
    status: "draft", source_url: "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/",
    source_quote: "your APS certificate (from the Academic Evaluation Centre, https://aps-india.de/)",
    last_verified_at: "2026-10-06T00:00:00Z",
  },
  {
    id: "aps-scoped-visa-sa", country: "sa",
    conditions: { visa_application_country: "sa", visa_mission_context: "saudi_study" },
    outcomes: { aps_scopes: { visa: { value: "not_listed" } }, note: "Reviewed the complete Prepare your application checklist and following insurance/translation notes on 2026-10-07: APS is not listed. This omission is our checklist observation, not an official exemption statement. The mission may request additional documents." },
    status: "draft", source_url: "https://saudiarabien.diplo.de/ksa-en/visa-service/study-preparatory-courses-2195208",
    source_quote: "high school graduation certificate and, if applicable, Bachelor/Master certificates with detailed transcript of grades [...] request additional documents",
    last_verified_at: "2026-10-07T00:00:00Z",
  },
  {
    id: "aps-scoped-acquisition", country: "in",
    conditions: { aps_issuer_country: "in", aps_qualification_context: "national", aps_application_context: "uni_assist" },
    outcomes: { aps_scopes: { application: { value: "required", steps: [{ order: 10, text: "Obtain your APS certificate for your uni-assist application; preserve the digitally sealed certificate as an unchanged, original file.", acquisition: true }] } } },
    status: "draft", source_url: "https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/in/",
    source_quote: "your APS certificate [...] Upload the digitally sealed APS certificate as an unchanged, original file to your MyAssist account.",
    last_verified_at: "2026-10-07T00:00:00Z",
  },
  // ---------------------------------------------------------------- India
  {
    id: "in-school-studienkolleg",
    country: "in",
    conditions: {
      curriculum: "national",
      board: { op: "in", value: INDIAN_BOARDS },
      target_degree: "bachelor",
      jee_advanced: false,
      intake_index: { op: "lte", value: SS_2026 },
    },
    outcomes: {
      path: "studienkolleg",
      note: "Class 12 from Indian boards gives no direct admission without a valid JEE Advanced result; route is Studienkolleg + Feststellungsprüfung.",
    },
    status: "verified",
    source_url:
      "https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/",
    source_quote:
      "Class 12 from Indian boards → no direct admission; the sole exception is a valid JEE Advanced result (→ direct, subject-specific). Otherwise: Studienkolleg + FSP.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "in-school-studienkolleg-ws2026",
    country: "in",
    conditions: {
      curriculum: "national",
      board: { op: "in", value: INDIAN_BOARDS },
      target_degree: "bachelor",
      jee_advanced: false,
      class12_percent: { op: "gte", value: 70 },
      intake_index: { op: "gte", value: WS_2026_27 },
    },
    outcomes: {
      path: "studienkolleg",
      note: "From Winter Semester 2026/27, Class XII with at least 70% may qualify for the subject-restricted Studienkolleg pathway.",
    },
    status: "verified",
    source_url: "https://aps-india.de/news/",
    source_quote:
      "From Winter Semester 2026/27, Class XII plus APS may qualify for subject-restricted admission via Studienkolleg when the certificate shows at least 70%.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // UP-ELIG-04: ordinary current-source coverage reviewed 2026-10-08.
  // These exact product choices are NOT a source commencement/effective date.
  {
    id: "in-jee-qualifying-pass-review", country: "in", status: "draft", published_at: null,
    conditions: { target_degree: "bachelor", curriculum: "national",
      aps_issuer_country: "in", aps_qualification_context: "national",
      jee_school_certificate: "completed_12_year_secondary",
      jee_main_status: "passed", jee_advanced_status: "passed", jee_evidence_context: "ordinary",
      jee_reported_target_family: { op: "in", value: ["reported_official_technology", "reported_official_natural_sciences"] },
      intake_index: { op: "in", value: [4053, 4054, 4055] } },
    outcomes: { path: "subject_restricted", note: "Based on your reported completed Indian national 12-year secondary certificate, ordinary successful Main and Advanced passages, and applicable reported official technology/natural-science classification with a reference for this intended target, the ordinary JEE route gives direct subject-restricted academic access in those subject families. UniPirate does not independently verify these applicant reports. Current-source product coverage reviewed 2026-10-08: Winter 2026/27, Summer 2027 and Winter 2027/28 only; source effective intake is not stated. The institution makes the final admission decision. APS/application and visa requirements remain separate." },
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=4&ad-layerId=63",
    source_quote: "direct subject-restricted admission",
    last_verified_at: "2026-10-08T00:00:00Z",
  },
  {
    id: "in-70pct-insufficient-ws2026",
    country: "in",
    conditions: {
      curriculum: "national",
      board: { op: "in", value: INDIAN_BOARDS },
      target_degree: "bachelor",
      // APS ties the 70% floor to the Studienkolleg and 1-yr-bachelor pathways;
      // the JEE Advanced exception is assessed separately
      jee_advanced: false,
      class12_percent: { op: "lt", value: 70 },
      intake_index: { op: "gte", value: WS_2026_27 },
      has_existing_aps: false,
    },
    outcomes: {
      path: "insufficient",
      note: "From Winter Semester 2026/27, a new applicant without an existing APS certificate needs at least 70% overall in Class XII for the Studienkolleg or one-year-bachelor pathways.",
    },
    status: "verified",
    source_url: "https://aps-india.de/news/",
    source_quote:
      "anabin criteria updated 15 March 2026; for admissions from Winter Semester 2026/27, minimum 70% overall in Class XII, all boards, applies to BOTH pathways",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // ------------------------------------------------------------ APS routing
  {
    id: "aps-india-national",
    country: "in",
    conditions: {
      certificate_country: "in",
      curriculum: "national",
      visa_application_country: "in",
    },
    outcomes: {
      aps: "required",
      documents: ["APS India certificate"],
      note: "APS India verifies qualifications issued by Indian educational institutions; its certificate is required when the student visa is filed with the German Missions in India.",
    },
    status: "verified",
    source_url: "https://aps-india.de/",
    source_quote:
      "APS India verifies academic documents and qualifications issued by Indian educational institutions; the APS certificate is generally required for the German student-visa procedure.",
    last_verified_at: VISA_SOURCE_CHECKED_AT,
  },
  {
    id: "aps-not-required-visa-from-sa",
    country: "sa",
    conditions: { visa_application_country: "sa" },
    outcomes: {
      aps: "not_required",
      note: "The German Embassy Riyadh student-visa checklist does not ask for an APS certificate — for Saudi citizens or for non-Saudi nationals residing in Saudi Arabia (Iqama holders). APS applies per visa jurisdiction, not nationality.",
    },
    status: "verified",
    source_url:
      "https://www.vfsglobal.com/Germany/SaudiArabia/pdf/Checklist_Student_Visa.pdf",
    source_quote:
      "CHECKLIST FOR STUDENT VISA — Additional documents required for non-Saudi nationals residing in Saudi Arabia: For non-Saudi citizens: Original Iqama with 2 photocopies; valid Saudi Arabian Exit Visa. (No APS certificate appears anywhere on the Embassy Riyadh checklist.)",
    last_verified_at: VISA_SOURCE_CHECKED_AT,
  },
  // ------------------------------------------------------------------ dMAT
  ...dmatCandidates,
  {
    id: "dmat-india-existing-aps-exempt",
    country: "in",
    conditions: {
      certificate_country: "in",
      target_degree: "master",
      has_existing_aps: true,
    },
    outcomes: {
      dmat: "not_required",
      note: "An already-issued APS certificate is exempt from dMAT for that completed APS procedure.",
    },
    status: "verified",
    source_url: "https://aps-india.de/dmat/",
    source_quote:
      "Applicants who have already completed the APS procedure and received their APS certificate are not required to take dMAT for that completed procedure.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "dmat-india-before-ss2027",
    country: "in",
    conditions: {
      certificate_country: "in",
      target_degree: "master",
      intake_index: { op: "lte", value: WS_2026_27 },
    },
    outcomes: {
      dmat: "not_required",
      note: "Intakes up to and including Winter Semester 2026/27 do not require dMAT (first dMAT cycle results land 12 Oct 2026 — not feasible for WS 2026/27, which doesn't require it).",
    },
    status: "verified",
    source_url: "https://aps-india.de/dmat/",
    source_quote:
      "first cycle: registration 29 Jun–15 Sep 2026, exam 26 Sep 2026, results 12 Oct 2026 → not feasible for WS 2026/27 (which doesn't require it)",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "dmat-bachelor-not-required",
    country: null,
    conditions: { target_degree: "bachelor" },
    outcomes: {
      dmat: "not_required",
      note: "dMAT is a Master's admissions test; it does not apply to Bachelor's applicants.",
    },
    status: "verified",
    source_url: "https://aps-india.de/dmat/",
    source_quote:
      "Students applying for Bachelor's programs in Germany are not required to take dMAT.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // --------------------------------------------------------- process steps
  {
    id: "aps-india-process",
    country: "in",
    conditions: { certificate_country: "in", visa_application_country: "in" },
    outcomes: {
      steps: [
        {
          order: 10,
          text: "Register online at aps-india.de under the APS procedure matching your background (e.g. Class XII, JEE, undergraduates with 2 semesters, graduates/postgraduates) and prepare the documents from that procedure's checklist.",
        },
        {
          order: 11,
          text: "Pay the APS verification fee of ₹18,000 (non-refundable) via the CCAvenue portal during registration or by bank transfer to the APS account — processing starts only once payment and a complete document set have arrived.",
        },
        {
          order: 12,
          text: "Courier your printed and signed application form plus checklist documents to APS India in New Delhi; personal drop-offs are not accepted. Keep your courier tracking details.",
        },
        {
          order: 13,
          text: "Track your application in your APS account. Successful candidates receive the digitally signed APS certificate as a PDF by email — submit it unchanged to universities, uni-assist, VFS and the visa section.",
        },
      ],
      note: "APS India publishes no fixed processing time — verification length depends on application volume and how quickly schools, boards and universities answer verification queries.",
    },
    status: "verified",
    source_url:
      "https://aps-india.de/wp-content/uploads/2023/05/Leaflet_XII-Grade-1.pdf",
    source_quote:
      "Transfer the APS verification fee of 18,000/- INR … (NON-REFUNDABLE); Submit the required documents, including the printed and signed application form via courier to APS India; Successful candidates will receive a digital APS certificate via email.",
    last_verified_at: PROCESS_SOURCE_CHECKED_AT,
  },
  {
    id: "uni-assist-vpd-process",
    country: null,
    conditions: {},
    outcomes: {
      steps: [
        {
          order: 20,
          text: "Create your My assist account at my.uni-assist.de and select each target university's course — or request a VPD if the university applies directly but wants the pre-check documentation.",
        },
        {
          order: 21,
          text: "Pay the uni-assist handling fees: €75 for the first chosen course of study per semester and €30 for each additional course in the same semester. The fees are identical for standard applications and the VPD procedure, are due regardless of the result, and some universities cover them for their applicants.",
        },
      ],
      note: "Fees are charged per chosen study course per semester; reapplying in a new semester restarts at €75 for the first course.",
    },
    status: "verified",
    source_url:
      "https://www.uni-assist.de/en/how-to-apply/pay-all-fees/handling-fees/",
    source_quote:
      "In one semester these handling fees apply: Cost for the first chosen course of study: EUR 75.00. For each additional chosen course of study: EUR 30.00 … The costs are the same for all forms of application, whether standard or VPD procedure.",
    last_verified_at: PROCESS_SOURCE_CHECKED_AT,
  },
  {
    id: "blocked-account-open",
    country: null,
    conditions: { visa_application_country: "in" },
    outcomes: {
      steps: [
        {
          order: 41,
          text: "After you hold the admission letter — and at least 8 weeks before your visa appointment — open a blocked account with a provider of your choice and deposit €11,904 for the first year of studies; the blocking confirmation must state that no more than €992 per month can be withdrawn.",
        },
      ],
      note: "The amount follows German student support rates and is published by the competent mission — confirm the current figure on the German Missions in India studies checklist before funding the account.",
    },
    status: "verified",
    source_url: "https://india.diplo.de/in-en/service/2756350-2756350",
    source_quote:
      "Blocked bank account (\u201cSperrkonto\u201d) in Germany with sufficient funds to cover the first year of studies, currently amounting to 11,904.—EUR and with a blocking confirmation stating that no more than 992.—EUR per month can be withdrawn.",
    last_verified_at: PROCESS_SOURCE_CHECKED_AT,
  },
  {
    id: "visa-appointment-in",
    country: "in",
    conditions: { visa_application_country: "in" },
    outcomes: {
      steps: [
        {
          order: 44,
          text: "Apply through the Consular Services Portal (digital.diplo.de/visa) — for national visas that can be filed online there, including \u201cStudy purposes and seeking a university place\u201d, this is obligatory. Only after the CSP pre-check do you receive the link to book your on-site appointment.",
        },
        {
          order: 45,
          text: "For national visa categories not covered by the CSP, book your appointment through VFS Global at the location responsible for your place of residence. The visa fee is ₹8,100 / €75 (over 18) or ₹4,100 / €37.50 (under 18), payable in rupees at the appointment; the external service provider charges an additional service fee.",
        },
      ],
      note: "Booking an on-site appointment without having completed the CSP upload and pre-check means the application will not be accepted at the appointment.",
    },
    status: "verified",
    source_url: "https://india.diplo.de/in-en/service/2755482-2755482",
    source_quote:
      "If a visa application is possible online through the Consular Service Portal (CSP), it is obligatory to do it through the CSP. Only then will you receive a link to book an on-site-appointment at the end of the process. … The visa fee is 8100 inr / 75,—EUR for applicants over 18 years of age and 4100 inr / 37,50 EUR for applicants under the age of 18 years.",
    last_verified_at: PROCESS_SOURCE_CHECKED_AT,
  },
  {
    id: "visa-appointment-sa",
    country: "sa",
    conditions: { visa_application_country: "sa" },
    outcomes: {
      steps: [
        {
          order: 44,
          text: "Apply online through the Consular Services Portal (digital.diplo.de) — the German Missions in Saudi Arabia accept the visa for vocational training or university studies there. After you submit your documents they confirm completeness, which makes the in-person appointment quick: present originals, give biometrics, and pay the fee.",
        },
      ],
      note: "Pakistan keeps its separate verified Consular Services Portal rule; applicants in Saudi Arabia file with Embassy Riyadh or Consulate General Jeddah per their jurisdiction.",
    },
    status: "verified",
    source_url: "https://saudiarabien.diplo.de/ksa-en/visa-service",
    source_quote:
      "You can apply online for the following types of visas: … Visa for vocational training or university studies … Once you submit your documents, we will inform you whether these are complete. This will make your in-person appointment at the German mission quick and efficient.",
    last_verified_at: PROCESS_SOURCE_CHECKED_AT,
  },
  // -------------------------------------------------------------- Pakistan
  {
    id: "pk-visa-consular-portal",
    country: "pk",
    conditions: { visa_application_country: "pk" },
    outcomes: {
      steps: [
        {
          order: 40,
          text: "Apply for the visa fully digitally via the Consular Services Portal — the interactive questionnaire generates your required-document list. Islamabad serves ICT, Gilgit-Baltistan, KPK, AJK, Punjab; Karachi serves Sindh + Balochistan. Expect long waits (demand exceeds capacity); degree certificates/transcripts are mandatory uploads from the outset.",
        },
      ],
    },
    status: "verified",
    source_url: "https://pakistan.diplo.de/pk-en/service/2-study-visa-seite-1676104",
    source_quote:
      "fully digital via the Consular Services Portal; interactive questionnaire generates the required-document list",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // ------------------------------------------------------------ Saudi Arabia
  {
    id: "sa-tawjihiyah-studienkolleg",
    country: "sa",
    conditions: {
      certificate_country: "sa",
      curriculum: "national",
      board: "tawjihiyah",
      target_degree: "bachelor",
    },
    outcomes: {
      path: "studienkolleg",
      note: "Regular Saudi high-school diploma (Tawjihiyah) requires Studienkolleg before university. Consider the Studienkolleg Middle East (Goethe-Institut Riyadh): one-year hybrid T-Kurs-focused program in Saudi Arabia, entry at German B1, FSP exams in Cairo.",
    },
    status: "verified",
    source_url:
      "https://saudiarabien.diplo.de/ksa-en/topics/weitere-themen/-/1686436",
    source_quote:
      "Regular Saudi high-school diploma (Tawjihiyah) → Studienkolleg required before university",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // UP-ELIG-01: source-backed ordinary candidates remain drafts.
  ...gceCandidates,
  // UP-ELIG-02 quarantines the old synthetic positive/FSP shortcuts.
  // Reviewed replacements remain drafts, never production publication.
  ...ibCandidates,
  ...ibDocumentCandidates,
];
