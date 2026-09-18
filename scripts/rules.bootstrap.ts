// Rule records mirroring docs/research_findings.md (researched 2 July 2026,
// re-verified against the live official sources 4 July 2026).
// Research confidence is retained in each candidate, but seed.ts always inserts
// candidates as drafts. Runtime eligibility comes only from DB rows reviewed in
// /admin; the application and evaluator never import this snapshot.
import { intakeIndex, type EngineRule } from "../lib/engine/evaluate";

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

const INDIAN_BOARDS = ["cbse", "cisce", "state_board"];
const STEM_FIELDS = [
  "cs",
  "it",
  "engineering",
  "mechanical_engineering",
  "electrical_engineering",
  "civil_engineering",
  "math",
  "physics",
  "chemistry",
  "biology",
];
const TECHNICAL_FIELDS = [
  "cs",
  "it",
  "engineering",
  "mechanical_engineering",
  "electrical_engineering",
  "civil_engineering",
  "math",
];
const SOCIAL_ECONOMICS_FIELDS = [
  "economics",
  "business",
  "management",
  "commerce",
  "accounting",
  "finance",
  "social_science",
];
const HUMANITIES_FIELDS = [
  "humanities",
  "law",
  "history",
  "geography",
  "language",
];
const RECOGNIZED_GCE_BODIES = [
  "aqa",
  "caie",
  "ccea",
  "lrn",
  "ocr",
  "oxford_aqa",
  "pearson",
  "wjec",
];

export const ruleData: RuleRecord[] = [
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
  {
    id: "in-jee-advanced-direct",
    country: "in",
    conditions: {
      curriculum: "national",
      board: { op: "in", value: INDIAN_BOARDS },
      target_degree: "bachelor",
      jee_advanced: true,
    },
    outcomes: {
      path: "subject_restricted",
      note: "A valid JEE Advanced result gives direct, subject-specific admission.",
    },
    status: "verified",
    source_url:
      "https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/",
    source_quote:
      "the sole exception is a valid JEE Advanced result (→ direct, subject-specific)",
    last_verified_at: SOURCE_CHECKED_AT,
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
  // ------------------------------------------------------------ GCE A-Levels
  {
    id: "gce-technical-subject-restricted",
    country: null,
    conditions: {
      curriculum: "gce",
      target_degree: "bachelor",
      certificate_country: { op: "neq", value: "pk" },
      target_field: { op: "in", value: TECHNICAL_FIELDS },
      gce_awarding_body: { op: "in", value: RECOGNIZED_GCE_BODIES },
      gce_school_years: { op: "gte", value: 12 },
      gce_distinct_al_count: { op: "gte", value: 3 },
      gce_list_a_count: { op: "gte", value: 2 },
      gce_general_al_count: { op: "gte", value: 3 },
      gce_min_al_grade: { op: "gte", value: 3 },
      gce_has_math_al: true,
      gce_has_technical_support_al: true,
    },
    outcomes: {
      path: "subject_restricted",
      note: "A recognized GCE with three independent general-education A-Levels at grade C or better gives direct subject-restricted access to mathematics and technical fields when Mathematics plus Biology, Chemistry, Physics, or Computer Science is present.",
    },
    status: "verified",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    source_quote:
      "Three independent general-education A-Levels at grade C or better are required; mathematics and technical studies require Mathematics plus Biology, Chemistry, Physics, or Computer Science.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "gce-social-economics-subject-restricted",
    country: null,
    conditions: {
      curriculum: "gce",
      target_degree: "bachelor",
      certificate_country: { op: "neq", value: "pk" },
      target_field: { op: "in", value: SOCIAL_ECONOMICS_FIELDS },
      gce_awarding_body: { op: "in", value: RECOGNIZED_GCE_BODIES },
      gce_school_years: { op: "gte", value: 12 },
      gce_distinct_al_count: { op: "gte", value: 3 },
      gce_list_a_count: { op: "gte", value: 2 },
      gce_general_al_count: { op: "gte", value: 3 },
      gce_min_al_grade: { op: "gte", value: 3 },
      gce_has_social_economics_al: true,
      gce_has_science_or_math_al: true,
    },
    outcomes: {
      path: "subject_restricted",
      note: "Social-science and economics studies require an appropriate humanities/economics A-Level plus Mathematics, Biology, Chemistry, Physics, or Computer Science.",
    },
    status: "verified",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    source_quote:
      "Social science and economics studies require one A-Level from history, geography, politics or economics and one from mathematics, biology, chemistry, physics or computer science.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "gce-humanities-subject-restricted",
    country: null,
    conditions: {
      curriculum: "gce",
      target_degree: "bachelor",
      certificate_country: { op: "neq", value: "pk" },
      target_field: { op: "in", value: HUMANITIES_FIELDS },
      gce_awarding_body: { op: "in", value: RECOGNIZED_GCE_BODIES },
      gce_school_years: { op: "gte", value: 12 },
      gce_distinct_al_count: { op: "gte", value: 3 },
      gce_list_a_count: { op: "gte", value: 2 },
      gce_general_al_count: { op: "gte", value: 3 },
      gce_min_al_grade: { op: "gte", value: 3 },
      gce_has_humanities_al: true,
    },
    outcomes: {
      path: "subject_restricted",
      note: "Humanities and law studies require an appropriate language, history, geography, politics, or economics A-Level.",
    },
    status: "verified",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    source_quote:
      "Humanities and law studies require one A-Level from language, history, geography, social studies/politics, or economics.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "gce-fewer-than-three-unknown",
    country: null,
    conditions: {
      curriculum: "gce",
      target_degree: "bachelor",
      certificate_country: { op: "neq", value: "pk" },
      gce_al_count: { op: "lt", value: 3 },
    },
    outcomes: {
      path: "unknown",
      note: "Fewer than three A-Levels cannot satisfy the current GCE direct-admission formula. Check the DAAD admission database for any alternative route.",
    },
    status: "verified",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    source_quote:
      "For recognition, three general, independent A-Level subjects with a minimum grade of C are required; AS Levels are no longer considered.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "gce-pk-anabin-caveat",
    country: "pk",
    conditions: { curriculum: "gce", certificate_country: "pk" },
    outcomes: {
      path: "unknown",
      note: "For Pakistan-obtained GCE certificates, the applicable country-specific anabin evaluation proposal must be checked before returning an admission path.",
    },
    status: "beta",
    source_url: "https://www.daad.de/en/studying-in-germany/requirements/gce/",
    source_quote:
      "for countries where GCE-type exams are part of the national system, the country's evaluation proposal may apply instead",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  // -------------------------------------------------------------- IB Diploma
  {
    id: "ib-math-hl-direct-2025",
    country: null,
    conditions: {
      curriculum: "ib",
      target_degree: "bachelor",
      ib_full_diploma: true,
      ib_exam_year: { op: "gte", value: 2025 },
      ib_school_years: { op: "gte", value: 12 },
      ib_total_points: { op: "gte", value: 24 },
      ib_subject_count: 6,
      ib_hl_count: { op: "gte", value: 3 },
      ib_min_subject_grade: { op: "gte", value: 4 },
      ib_all_subjects_recognized: true,
      ib_language_count: { op: "gte", value: 2 },
      ib_has_foreign_language_hl: true,
      ib_has_social_science: true,
      ib_has_natural_science: true,
      ib_has_2025_eligible_hl: true,
      ib_math_level: "HL",
      ib_math_course: { op: "in", value: ["AA", "AI"] },
    },
    outcomes: {
      path: "direct",
      note: "A fully compliant IB Diploma from the 2025 exam year onward with Mathematics AA or AI at HL gives general direct admission.",
    },
    status: "verified",
    source_url:
      "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    source_quote:
      "A compliant IB Diploma with Mathematics Analysis and Approaches or Applications and Interpretation at HL offers direct admission for all subjects.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "ib-math-sl-stem-studienkolleg",
    country: null,
    conditions: {
      curriculum: "ib",
      target_degree: "bachelor",
      ib_full_diploma: true,
      ib_exam_year: { op: "gte", value: 2025 },
      ib_school_years: { op: "gte", value: 12 },
      ib_total_points: { op: "gte", value: 24 },
      ib_subject_count: 6,
      ib_hl_count: { op: "gte", value: 3 },
      ib_min_subject_grade: { op: "gte", value: 4 },
      ib_all_subjects_recognized: true,
      ib_language_count: { op: "gte", value: 2 },
      ib_has_foreign_language_hl: true,
      ib_has_social_science: true,
      ib_has_natural_science: true,
      ib_has_2025_eligible_hl: true,
      ib_math_level: "SL",
      ib_math_course: { op: "in", value: ["AA", "AI"] },
      target_field: { op: "in", value: STEM_FIELDS },
    },
    outcomes: {
      path: "studienkolleg",
      note: "Mathematics at SL gives only subject-specific access EXCLUDING math/natural-science/technical fields — for a STEM target the direct route is closed; the standard route is Studienkolleg + Feststellungsprüfung.",
    },
    status: "verified",
    source_url:
      "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    source_quote:
      "math at SL → subject-specific access excluding math/natural-science/technical fields … Conditions not met → standard Studienkolleg/FSP route.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "ib-no-diploma-unknown",
    country: null,
    conditions: { curriculum: "ib", ib_full_diploma: false },
    outcomes: {
      path: "unknown",
      note: "An IB Certificate is not accepted as an IB Diploma. Check the DAAD admission database for whether another qualification or a preparatory route applies to your complete profile.",
    },
    status: "verified",
    source_url:
      "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    source_quote: "German universities do not accept a so-called IB Certificate.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "ib-math-sl-non-stem-subject-restricted",
    country: null,
    conditions: {
      curriculum: "ib",
      target_degree: "bachelor",
      ib_full_diploma: true,
      ib_exam_year: { op: "gte", value: 2025 },
      ib_school_years: { op: "gte", value: 12 },
      ib_total_points: { op: "gte", value: 24 },
      ib_subject_count: 6,
      ib_hl_count: { op: "gte", value: 3 },
      ib_min_subject_grade: { op: "gte", value: 4 },
      ib_all_subjects_recognized: true,
      ib_language_count: { op: "gte", value: 2 },
      ib_has_foreign_language_hl: true,
      ib_has_social_science: true,
      ib_has_natural_science: true,
      ib_has_2025_eligible_hl: true,
      ib_math_level: "SL",
      ib_math_course: { op: "in", value: ["AA", "AI"] },
      target_field: { op: "nin", value: STEM_FIELDS },
    },
    outcomes: {
      path: "subject_restricted",
      note: "A fully compliant IB Diploma with Mathematics AA or AI at SL gives subject-restricted access outside mathematics, natural sciences, and technical fields.",
    },
    status: "verified",
    source_url:
      "https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/",
    source_quote:
      "Mathematics AA or AI at SL gives subject-specific access for subjects outside mathematics, natural sciences and technical fields.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
];
