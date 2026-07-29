// Rule records mirroring docs/research_findings.md (researched 2 July 2026,
// re-verified against the live official sources 4 July 2026).
// Research confidence is retained in each candidate, but seed.ts always inserts
// candidates as drafts. Runtime eligibility comes only from DB rows reviewed in
// /admin; the application and evaluator never import this snapshot.
import { intakeIndex, type EngineRule } from "../lib/engine/evaluate";

type RuleRecord = EngineRule & { country: string | null };

const SOURCE_CHECKED_AT = "2026-07-04T00:00:00Z";
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
          text: "Register for APS India and pay the current APS fee — ₹18,000 in the 2026 research notes; skip this chain if you already hold an APS certificate.",
        },
        {
          order: 11,
          text: "Courier your APS India documents and expect roughly 3–4 weeks of processing; confirm the current document list before sending.",
        },
        {
          order: 12,
          text: "Receive your APS digital certificate before starting German university and visa submissions.",
        },
      ],
      note: "Draft process sequence for APS India. Keep as draft until the fee, courier steps, and processing time are confirmed by a human reviewer.",
    },
    status: "draft",
    source_url: "https://aps-india.de/",
    source_quote:
      "APS India basics: mandatory since Nov 2022 for degree study; fee ₹18,000; ~3–4 weeks processing; digital certificate.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "uni-assist-vpd-process",
    country: null,
    conditions: {},
    outcomes: {
      steps: [
        {
          order: 20,
          text: "Create your uni-assist account and start the VPD or application check for each target university that uses uni-assist.",
        },
        {
          order: 21,
          text: "Pay the uni-assist handling fee — research note says about €75 for the first application plus €30 for each extra course; confirm current fees before paying.",
        },
      ],
      note: "Draft process sequence for uni-assist and VPD handling.",
    },
    status: "draft",
    source_url: "https://www.uni-assist.de/en/",
    source_quote:
      "uni-assist VPD process & fees need official confirmation; secondary sources say ~€75 first + €30 each.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "blocked-account-open",
    country: null,
    conditions: {},
    outcomes: {
      steps: [
        {
          order: 41,
          text: "Open your blocked account after the admission letter and at least 8 weeks before the visa appointment — 2026 research amount €11,904/year (€992/month); re-verify when BAföG rates change.",
        },
      ],
      note: "Draft process step for blocked-account timing and 2026 amount.",
    },
    status: "draft",
    source_url: "https://www.auswaertiges-amt.de/en/sperrkonto-388600",
    source_quote:
      "Blocked account amount varies by stay purpose and is based on German student support rates; research notes record €11,904/year = €992/month for study visas in 2026.",
    last_verified_at: SOURCE_CHECKED_AT,
  },
  {
    id: "visa-appointment-booking",
    country: null,
    conditions: {
      certificate_country: { op: "in", value: ["in", "sa"] },
    },
    outcomes: {
      steps: [
        {
          order: 44,
          text: "Book the German student-visa appointment with the competent mission after admission and proof of funds are ready; confirm the document list on the official diplo.de study-visa page.",
        },
      ],
      note: "Draft process step for India and Saudi Arabia visa appointment routing. Pakistan keeps its separate verified Consular Services Portal rule.",
    },
    status: "draft",
    source_url: "https://digital.diplo.de/navigator/en/visa/study",
    source_quote:
      "The German study-visa pages route applicants to the competent mission and required-document workflow.",
    last_verified_at: SOURCE_CHECKED_AT,
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
