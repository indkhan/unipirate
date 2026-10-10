// Pure rule engine: evaluate(profile, rules[]) → Result. Zero I/O.
// Eligibility logic lives in the rule records (DB `rules` table shape), never
// here — this module only derives facts from the profile, matches conditions,
// and merges outcomes. Missing rules produce explicit `unknown` outcomes with
// confirm-with-the-official-source messages; the engine never guesses.
import { z } from "zod";
import {isLegacyProcessIdentity} from "./process-identity";
import { ProcessOutcomeSchema, type ProcessProfile } from "./process";
import { type SaudiReport, deriveSaudiFacts, isSaudiAdmissionRule, isScopedSaudiRule, isSaudiSchoolProfile, SAUDI_SOURCE, SAUDI_FACT_LABELS } from "./saudi";
import { derivePakistanFacts, PK_FACT_KEYS, type PakistanProfile, type PakistanStudy } from "./pakistan";
import { JeeProfileSchema, type JeeProfile, JEE_SOURCE, JEE_FIELD_SOURCE, JEE_ADMISSION_SOURCE } from "./jee";
import { type IbProfile, deriveIbFacts, IB_FACT_LABELS, IB_SOURCE } from "./ib";
import { gceEntry, gceIndependent, triples } from "./gce";
import { calendarDay } from "./calendar-day";
import { DmatProfileSchema, type DmatProfile } from "./dmat";

// ---------------------------------------------------------------- profile

export type Term = "winter" | "summer";

export type Profile = {
  qualificationGuidanceVersion?: 1;
  pakistan?: PakistanProfile;
  targetDegree: "bachelor" | "master";
  intake?: { term: Term; year: number };
  nationality?: string; // 'in' | 'pk' | 'sa' | ...
  certificateCountry?: string; // legacy qualification/attendance country; not an APS issuer
  curriculumType: "national" | "ib" | "gce" | "other";
  board?: string; // 'cbse' | 'fsc' | 'tawjihiyah' | ...
  schoolGradePercent?: number; // Class XII overall %
  jeeAdvanced?: boolean; // Legacy history only; never proof of qualifying passage.
  jee?: JeeProfile;
  visaApplicationCountry?: string;
  processContext?: ProcessProfile["processContext"];
  // Explicit issuer context; legacy school attendance is never an APS issuer.
  schoolQualification?: { country?: string; context?: "national" | "international" | "unknown" };
  visaMissionContext?: "saudi_study" | "other" | "unknown";
  apsApplicationContext?: "uni_assist" | "unknown";
  hasExistingApsCertificate?: boolean;
  dmat?: DmatProfile;
  saudiCertificate?: SaudiReport;
  // Reported APS confirmation for this Class XII(/one-bachelor-year) procedure;
  // another/uncertain academic basis cannot confirm it. Never a courier alias.
  apsProcedure?: {
    status: "not_started" | "pending" | "completed" | "new_evaluation" | "unknown";
    submissionConfirmation?: "confirmed" | "unknown";
    submissionDate?: string;
  };
  // Present only for the new master's flow; separate from school curriculum.
  tertiaryQualification?: {
    issuer?: string;
    country?: string;
    countryName?: string;
    context?: "national" | "other" | "unknown";
  };
  qualificationHistory?: {
    hasPriorUniversityStudy: boolean;
    qualificationType?: "bachelor" | "master" | "diploma" | "other";
    institution?: string;
    country?: string;
    countryName?: string;
    field?: string;
    degreeYears?: number;
    completedYears?: number;
    completion?: "completed" | "in_progress" | "discontinued";
    saudiBachelorEvidence?: { version: 2; context?: "national" | "other" | "unknown"; assessment?: "reported_official_norms_full_time" | "reported_official_unmet" | "unknown"; reference?: string };
    pakistanStudy?: PakistanStudy;
    indiaStudyRouteVersion?: 1;
    priorStudyMode?: "regular" | "distance_online" | "other" | "unknown";
    priorStudyRecognition?: "reported_official_confirmed" | "reported_official_rejected" | "unknown";
    priorStudyRecognitionReference?: string;
    priorStudyTargetRelation?: "reported_official_previous" | "reported_official_closely_related" | "reported_official_unrelated" | "unknown";
    priorStudyTargetRelationReference?: string;
  };
  ib?: IbProfile;
  gce?: {
    awardingBody:
      | "aqa"
      | "caie"
      | "ccea"
      | "lrn"
      | "ocr"
      | "oxford_aqa"
      | "pearson"
      | "wjec"
      | "other";
    schoolYears?: number;
    qualificationContext?: 'uk' | 'british_international' | 'national' | 'unknown';
    qualificationType?: 'al' | 'ial' | 'pre_u' | 'aice' | 'other' | 'unknown';
    evidence?: 'final' | 'provisional' | 'school' | 'unknown';
    subjects: {
      independenceGroup: string;
      level: "AL" | "AS";
      grade: "A*" | "A" | "B" | "C" | "D" | "E" | "U";
      list: "A" | "B" | "C" | "unrecognized";
      category:
        | "language"
        | "history"
        | "geography"
        | "social_studies"
        | "economics"
        | "math"
        | "biology"
        | "chemistry"
        | "physics"
        | "computer_science"
        | "other";
    }[];
  };
  targetField?: string; // 'cs' | 'mechanical_engineering' | ...
};

/** WS 2026/27 → intakeIndex('winter', 2026). Lets "from semester X" be a gte condition in rule data. */
export const intakeIndex = (term: Term, year: number): number =>
  year * 2 + (term === "winter" ? 1 : 0);

// ------------------------------------------------------------------ rules

const Primitive = z.union([z.string(), z.number(), z.boolean()]);
type Primitive = z.infer<typeof Primitive>;

const ConditionSchema = z.union([
  Primitive,
  z
    .object({
      op: z.enum(["eq", "neq"]),
      value: Primitive,
    })
    .strict(),
  z
    .object({
      op: z.enum(["gte", "gt", "lte", "lt"]),
      value: z.number(),
    })
    .strict(),
  z
    .object({
      op: z.enum(["in", "nin"]),
      value: z.array(Primitive).min(1),
    })
    .strict(),
]);
type Condition = z.infer<typeof ConditionSchema>;

const FactKeySchema = z.enum([
  "sa_secondary_completion", "sa_national_category", "sa_national_stream", "sa_reported_target_family", "sa_private_assessment_coverage",
  "sa_degree_evidence", "sa_degree_issuer", "sa_degree_context", "sa_degree_kind", "sa_degree_completion", "sa_degree_nominal_years", "sa_degree_mode", "sa_degree_norms", "sa_degree_recognition", "sa_degree_institution", "sa_degree_field",
  "sa_certificate_evidence", "sa_certificate_subtype", "sa_reported_subject_assessment", "sa_prior_study_kind",
  "sa_successful_bachelor_years", "sa_reported_recognition", "sa_reported_target_relation",
  "sa_reported_enrollment", "sa_reported_enrollment_relation",
  ...PK_FACT_KEYS,
  "in_class12_prior_study_kind", "in_class12_prior_study_country", "in_class12_successful_bachelor_years",
  "in_class12_study_mode", "in_class12_reported_recognition", "in_class12_reported_target_relation",
  "dmat_qualification_scope", "dmat_procedure", "dmat_field_basis",
  "dmat_field_entry", "dmat_field_classification", "dmat_field_version",
  "dmat_registration_status", "dmat_registration_day", "dmat_dispatch_status",
  "dmat_complete_dispatch_day", "dmat_partnership_status", "dmat_completed_semesters",
  "dmat_prior_qualification_type", "dmat_prior_degree_years", "dmat_prior_study_completion",
  // New names deliberately leave legacy aps_application_day rows inactive.
  "aps_confirmed_submission_day",
  "aps_submission_confirmation",
  "aps_issuer_country",
  "aps_qualification_context",
  "visa_mission_context",
  "aps_application_context",
  "board",
  "certificate_country",
  "class12_percent",
  "curriculum",
  "gce_qualification_context", "gce_qualification_type", "gce_evidence", "gce_science_or_math_count",
  "gce_al_count",
  "gce_awarding_body",
  "gce_distinct_al_count",
  "gce_general_al_count",
  "gce_has_humanities_al",
  "gce_has_math_al",
  "gce_has_science_or_math_al",
  "gce_has_social_economics_al",
  "gce_has_technical_support_al",
  "gce_list_a_count",
  "gce_min_al_grade",
  "gce_school_years",
  "has_existing_aps",
  "ib_evidence", "ib_document_status", "ib_exam_session", "ib_schooling", "ib_independent_subjects", "ib_continuity",
  "ib_has_continued_foreign", "ib_has_pre2025_eligible_hl", "ib_grade3_count", "ib_compensation_max_grade", "ib_annex_status", "ib_math_conflict",
  "ib_all_subjects_recognized",
  "ib_exam_year",
  "ib_full_diploma",
  "ib_has_2025_eligible_hl",
  "ib_has_foreign_language_hl",
  "ib_has_natural_science",
  "ib_has_social_science",
  "ib_hl_count",
  "ib_language_count",
  "ib_math_course",
  "ib_math_level",
  "ib_min_subject_grade",
  "ib_school_years",
  "ib_subject_count",
  "ib_total_points",
  "intake_index",
  "jee_advanced",
  "jee_main_status", "jee_advanced_status", "jee_evidence_context",
  "jee_school_certificate", "jee_reported_target_family",
  "target_degree",
  "target_field",
  "visa_application_country",
]);
type FactKey = z.infer<typeof FactKeySchema>;

const PathValue = z.enum([
  "direct",
  "subject_restricted",
  "studienkolleg",
  "insufficient",
  "unknown",
]);
const FlagValue = z.enum(["required", "not_required", "unknown"]);
export const APS_SCOPES = ["qualification", "application", "visa"] as const;
export type ApsScope = (typeof APS_SCOPES)[number];
const ApsScopeOutcome = z.object({
  value: FlagValue,
  documents: z.array(z.string().min(1)).min(1).optional(),
  steps: z.array(z.object({
    order: z.number().int().nonnegative(), text: z.string().min(1),
    acquisition: z.boolean().optional(),
  }).strict()).min(1).optional(),
}).strict();
const ApsScopesSchema = z.object({
  qualification: ApsScopeOutcome.optional(),
  application: ApsScopeOutcome.optional(),
  visa: ApsScopeOutcome.extend({ value: z.enum(["required", "not_required", "unknown", "not_listed"]) }).optional(),
}).strict().refine(value => Object.keys(value).length > 0);

const RuleOutcomesSchema = z
  .object({
    process: ProcessOutcomeSchema.optional(),
    path: PathValue.optional(),
    institution_restriction: z.literal("fachhochschule").optional(),
    aps: FlagValue.optional(),
    aps_scopes: ApsScopesSchema.optional(),
    testas: FlagValue.optional(),
    dmat: FlagValue.optional(),
    documents: z.array(z.string().min(1)).min(1).optional(),
    steps: z
      .array(
        z
          .object({
            order: z.number().int().nonnegative(),
            text: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .optional(),
    note: z.string().min(1).optional(),
  })
  .strict()
  .refine((outcomes) => Object.keys(outcomes).length > 0, {
    message: "A rule must define at least one outcome.",
  });

export const EngineRuleSchema = z
  .object({
    id: z.string(),
    conditions: z.record(FactKeySchema, ConditionSchema),
    outcomes: RuleOutcomesSchema,
    status: z.enum(["draft", "beta", "verified"]),
    source_url: z.string().url(),
    source_quote: z.string().min(1),
    last_verified_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
  })
  .passthrough()
  .superRefine((rule, context) => {
    if (rule.outcomes.institution_restriction && rule.outcomes.path !== "studienkolleg" && !(rule.outcomes.path === "subject_restricted" && isScopedSaudiRule(rule) && rule.conditions.sa_certificate_subtype !== "national" && rule.conditions.sa_certificate_subtype !== "private_school" && rule.conditions.sa_degree_evidence === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["outcomes", "institution_restriction"], message: "FH restriction is supported only on preparation or scoped industrial subject-restricted access." });
    if (rule.status !== "draft" && !rule.last_verified_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["last_verified_at"],
        message: "Published rules require a verification date.",
      });
    }
  });

export type EngineRule = z.input<typeof EngineRuleSchema>;
type ParsedRule = z.output<typeof EngineRuleSchema>;

// ------------------------------------------------------------------ result

export type Citation = {
  ruleId: string;
  sourceUrl: string;
  verifiedAt: string | null;
  claim: string;
  status: "beta" | "verified";
  supports: ResultSupport[];
};

export type ResultSupport =
  | `aps:${ApsScope}`
  | "path"
  | "aps"
  | "testAS"
  | "dMAT"
  | "documents"
  | "steps"
  | "unknowns";

export const ResultDiagnosticSchema = z.object({
  support: z.enum(['path', 'aps', 'aps:qualification', 'aps:application', 'aps:visa', 'testAS', 'dMAT']),
  status: z.enum(['known_route', 'known_unmet_condition', 'targeted_missing_fact', 'source_conflict', 'unsupported', 'qualification_guidance']),
  reason: z.enum(['route_established', 'condition_unmet', 'fact_missing', 'equal_specificity_conflict', 'applicability_unsupported', 'no_supported_rule', 'recognition_not_assessed']),
  ruleIds: z.array(z.string()).refine(ids => new Set(ids).size === ids.length),
  facts: z.array(z.object({key: FactKeySchema, actual: Primitive.optional(), reported: Primitive.optional(), expected: ConditionSchema}).strict()),
  assessedChecks: z.array(z.object({key: FactKeySchema, actual: Primitive.optional(), expected: ConditionSchema, met: z.boolean()}).strict()).optional(),
  relatedUnknowns: z.array(z.string()).optional(),
  followUp: z.object({key: FactKeySchema, question: z.string().min(1)}).strict().optional(),
}).strict();
export type ResultDiagnostic = z.infer<typeof ResultDiagnosticSchema>;

const DIAGNOSTIC_QUESTIONS: Partial<Record<FactKey, string>> = {
  in_class12_prior_study_kind: 'Have you previously studied at a university?',
  pk_prior_study_kind: 'Have you previously studied at a university?',
  sa_prior_study_kind: 'Have you previously studied at a university?',
  in_class12_successful_bachelor_years: 'How many Bachelor academic years have you successfully completed, according to your attained study records?',
  pk_successful_academic_years: 'How many academic years have you successfully completed, supported by annual subject/mark records and the applicable reference?',
  sa_successful_bachelor_years: 'How many Bachelor academic years have you successfully completed?',
  class12_percent: 'What is your reported Class XII overall percentage?',
  pk_grade_percent: 'What is your reported HSSC/Intermediate overall percentage?',
  intake_index: 'Which intake are you applying for?',
  in_class12_reported_recognition: 'What does the applicable official assessment say about this institution, Bachelor programme and attained study, and what is its reference?',
  in_class12_reported_target_relation: 'What does the applicable official assessment say about your previous field and this intended target, and what is its reference?',
  pk_reported_recognition: 'What does the applicable official recognition assessment say about your institution and academic Bachelor study, and what is its reference?',
  pk_reported_target_relation: 'What does the applicable official assessment say about the relationship between your previous field and this intended target, and what is its reference?',
  pk_current_assessment: 'What does the current applicable institutional assessment say about this qualification, study, target and intake, and what is its reference?',
  sa_reported_recognition: 'What does the applicable official recognition assessment say about your institution and Bachelor study, and what is its reference?',
  sa_reported_target_relation: 'What does the applicable official assessment say about your previous field and this intended target, and what is its reference?',
  sa_certificate_subtype: 'Which exact Saudi school certificate subtype do your documents show?',
  sa_private_assessment_coverage: 'What does your applicable ZAB diploma/subject assessment report about accreditation, subject breadth and all passing minima, and what is its reference?',
  jee_main_status: 'Do your official results report qualifying passage in JEE Main?',
  jee_advanced_status: 'Do your official results report qualifying passage in JEE Advanced?',
  ib_exam_year: 'In which year did you take your IB examinations?',
  ib_exam_session: 'Did you take your IB examinations in May or November?',
  gce_school_years: 'How many ascending school years did you complete?',
  gce_awarding_body: 'Which awarding body issued your A-Level qualifications?',
  gce_qualification_context: 'Under which qualification system were your A-Levels awarded?',
  gce_qualification_type: 'Which exact A-Level qualification type do your documents show?',
  gce_evidence: 'Do you have final awarding-body certificates, provisional results or school-issued documents?',
  aps_issuer_country: 'Which country issued the qualification being assessed?',
  aps_qualification_context: 'Is this qualification from the issuing country’s national system or an international system?',
  pk_certificate: 'Which exact school certificate category do your documents show?',
  pk_documentary_group: 'Which documentary Science, Commerce or Humanities group do your school records show?',
  pk_school_completion: 'Do your records show completed twelve-grade secondary schooling?',
  pk_target_family: 'What does the applicable official classification say about this exact intended target family, and what is its reference?',
  pk_annual_records: 'Do you have annual subject and mark records for your prior study?',
  pk_study_mode: 'Was your prior academic Bachelor study full time?',
  in_class12_prior_study_country: 'In which country did you undertake your prior university study?',
  in_class12_study_mode: 'Was your prior Bachelor programme regular, distance/online or another mode?',
  sa_degree_nominal_years: 'What is the full nominal duration of your completed Bachelor qualification?',
  sa_degree_norms: 'What does the applicable exact Bachelor assessment say about prescribed study norms and generally full-time study, and what is its reference?',
  sa_degree_recognition: 'What does the applicable official assessment say about recognition of this exact completed Bachelor, and what is its reference?',
  sa_reported_subject_assessment: 'What does your applicable ZAB subject assessment conclude, and what is its reference?',
  jee_school_certificate: 'Which exact completed secondary school certificate category do your documents show?',
  jee_reported_target_family: 'What does the applicable official classification say about this exact intended programme’s target family, and what is its reference?',
};
export function diagnosticFactLabel(key: string): string {
  return SAUDI_FACT_LABELS[key] ?? IB_FACT_LABELS[key] ?? ({
    class12_percent: 'reported Class XII overall percentage', pk_grade_percent: 'reported HSSC/Intermediate overall percentage',
    in_class12_prior_study_kind: 'prior university study', pk_prior_study_kind: 'prior university study',
    in_class12_successful_bachelor_years: 'successfully completed Bachelor academic years',
    pk_successful_academic_years: 'successful academic years supported by annual records/reference',
    intake_index: 'intake product coverage (not source commencement)',
    gce_min_al_grade: 'minimum grade rank on the same full A-Level trio (C = 3)',
    gce_distinct_al_count: 'independent full A-Level subjects on the same trio',
  } as Record<string, string>)[key] ?? key.replaceAll('_', ' ');
}

export type Result = {
  /** Additive explanation only; absent in protected historical payloads. */
  diagnostics?: ResultDiagnostic[];
  candidateCitations?: Citation[];
  path: z.infer<typeof PathValue>;
  institutionRestriction?: "fachhochschule";
  aps: z.infer<typeof FlagValue>;
  /** Optional only for legacy serialized results; evaluate always supplies it. */
  apsScopes?: { qualification: z.infer<typeof FlagValue>; application: z.infer<typeof FlagValue>; visa: z.infer<typeof FlagValue> | "not_listed" };
  apsCertificate?: "held" | "missing" | "unknown";
  apsRuleIds?: string[];
  testAS: z.infer<typeof FlagValue>;
  dMAT: z.infer<typeof FlagValue>;
  documents: string[];
  stepsDetailed: { order: number; text: string; ruleId: string; apsScope?: ApsScope; acquisition?: boolean }[]; // ordered
  citations: Citation[];
  unknowns: string[]; // honest gaps: "no rule covers X — confirm with [source]"
};

// ------------------------------------------------------------------- facts

type Fact = Primitive;
type HistoryFactKey =
  | "has_prior_university_study"
  | "prior_qualification_type"
  | "prior_study_institution"
  | "prior_study_country"
  | "prior_degree_field"
  | "prior_degree_years"
  | "years_of_university_study"
  | "prior_study_completion";

/**
 * Flattens the profile into the flat fact map rule conditions match against.
 * Arithmetic restatement of the profile only — every eligibility threshold
 * (70%, ≥3 A-Levels, ≥24 IB points, semester cutoffs…) lives in rule data.
 */
export function deriveFacts(p: Profile): Record<string, Fact> {
  const apsQualification = p.targetDegree === "master"
    ? p.tertiaryQualification?.issuer?.trim() ? p.tertiaryQualification : undefined
    : p.schoolQualification;
  const raw: Partial<Record<FactKey | HistoryFactKey, Fact>> = {
    aps_issuer_country: apsQualification?.country,
    aps_qualification_context: apsQualification?.context,
    visa_mission_context: p.visaMissionContext,
    aps_application_context: p.apsApplicationContext,
    target_degree: p.targetDegree,
    intake_index: p.intake && intakeIndex(p.intake.term, p.intake.year),
    certificate_country: p.tertiaryQualification ? p.tertiaryQualification.country : p.certificateCountry,
    // Existing rules use "curriculum" for qualification context. Explicit
    // national higher-education context restates that fact, not school study.
    // APS India: https://aps-india.de/faqs/ (issuer-based scope, checked 2026-10-06).
    curriculum: p.tertiaryQualification
      ? p.tertiaryQualification.context === "unknown" ? undefined : p.tertiaryQualification.context
      : p.curriculumType,
    board: p.board,
    class12_percent: p.schoolGradePercent,
    jee_advanced: p.jeeAdvanced,
    visa_application_country: p.visaApplicationCountry,
    target_field: p.targetField,
    has_existing_aps: p.hasExistingApsCertificate,
  };
  if (p.targetDegree === "bachelor" && p.curriculumType === "national" &&
      (p.schoolQualification?.country === "in" || ((!p.schoolQualification?.country || p.schoolQualification.country === "unknown") && p.certificateCountry === "in" && p.qualificationHistory?.indiaStudyRouteVersion === 1))) {
    const h = p.qualificationHistory;
    // Explicit unknowns only in this route assessment; no issuer/context inference.
    raw.aps_issuer_country ??= "unknown";
    raw.aps_qualification_context ??= "unknown";
    raw.class12_percent ??= "unknown";
    raw.intake_index ??= "unknown";
    raw.in_class12_prior_study_kind = h?.hasPriorUniversityStudy === false ? "none" : h?.hasPriorUniversityStudy === true
      ? h.qualificationType === "bachelor" ? "bachelor" : h.qualificationType ? "other" : "unknown" : "unknown";
    raw.in_class12_prior_study_country = h?.hasPriorUniversityStudy && /^[a-z]{2}$/.test(h.country ?? "") ? h.country : "unknown";
    raw.in_class12_successful_bachelor_years = h?.qualificationType === "bachelor" && typeof h.completedYears === "number" &&
      Number.isFinite(h.completedYears) && h.completedYears >= 0 && h.completedYears <= 50 ? h.completedYears : "unknown";
    raw.in_class12_study_mode = h?.priorStudyMode ?? "unknown";
    const reference = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 500;
    // These are applicant-reported applicable official assessments, not app verification.
    // An APS-held flag, institution name or equal field strings supplies no assessment.
    const basis = h?.indiaStudyRouteVersion === 1 && h.hasPriorUniversityStudy && h.qualificationType === "bachelor" &&
      !!h.institution?.trim() && !!h.field?.trim();
    raw.in_class12_reported_recognition = basis && reference(h.priorStudyRecognitionReference)
      ? h.priorStudyRecognition === "reported_official_confirmed" ? "confirmed" : h.priorStudyRecognition === "reported_official_rejected" ? "rejected" : "unknown" : "unknown";
    raw.in_class12_reported_target_relation = basis && !!p.targetField?.trim() && reference(h.priorStudyTargetRelationReference)
      ? h.priorStudyTargetRelation === "reported_official_previous" ? "previous" : h.priorStudyTargetRelation === "reported_official_closely_related" ? "closely_related" : h.priorStudyTargetRelation === "reported_official_unrelated" ? "unrelated" : "unknown" : "unknown";
  }
  if (p.targetDegree === "bachelor" && p.curriculumType === "national" &&
      p.schoolQualification?.country === "in" && p.schoolQualification.context === "national") {
    const procedure = p.apsProcedure;
    const date = procedure?.submissionConfirmation === "confirmed" &&
      ["pending", "completed", "new_evaluation"].includes(procedure.status)
      ? calendarDay(procedure.submissionDate) : undefined;
    raw.aps_submission_confirmation = date === undefined ? "unknown" : "confirmed";
    raw.aps_confirmed_submission_day = date;
  }
  // New evidence, even malformed, must not revive a contradictory legacy fallback.
  if (p.jee !== undefined) raw.jee_advanced = undefined;
  const jee = JeeProfileSchema.safeParse(p.jee);
  if (p.targetDegree === "bachelor" && p.curriculumType === "national" &&
      p.schoolQualification?.country === "in" && p.schoolQualification.context === "national" && jee.success) {
    raw.jee_main_status = jee.data.main;
    raw.jee_advanced_status = jee.data.advanced;
    raw.jee_evidence_context = jee.data.context;
    raw.jee_school_certificate = jee.data.schoolCertificate;
    raw.jee_reported_target_family = p.targetField?.trim() && jee.data.targetFamilyReference?.trim()
      ? jee.data.targetFamily : undefined;
  }
  if (p.qualificationHistory) {
    const history = p.qualificationHistory;
    raw.has_prior_university_study = history.hasPriorUniversityStudy;
    if (history.hasPriorUniversityStudy) {
      raw.prior_qualification_type = history.qualificationType;
      raw.prior_study_institution = history.institution;
      raw.prior_study_country = history.country;
      raw.prior_degree_field = history.field;
      raw.prior_degree_years = history.degreeYears;
      raw.years_of_university_study = history.completedYears;
      raw.prior_study_completion = history.completion;
    }
  }
  // New semantic keys do not activate legacy raw-field/date/boolean rules.
  // Validate direct callers too: a malformed report must never yield an exemption.
  const dmat = DmatProfileSchema.safeParse(p.dmat);
  if (p.targetDegree === "master" && apsQualification?.country === "in" &&
      apsQualification.context === "national" && dmat.success) {
    const report = dmat.data;
    raw.dmat_qualification_scope = report.qualificationScope;
    if (report.qualificationScope === "single") {
      raw.dmat_procedure = report.procedure;
      raw.dmat_registration_status = report.registration?.status;
      raw.dmat_registration_day = report.registration?.status === "completed" ? calendarDay(report.registration.date) : undefined;
      raw.dmat_dispatch_status = report.dispatch?.status;
      raw.dmat_complete_dispatch_day = report.dispatch?.status === "complete" ? calendarDay(report.dispatch.date) : undefined;
      raw.dmat_partnership_status = report.partnership?.status;
      if (report.degreeTitle && p.qualificationHistory?.field?.trim()) {
        raw.dmat_field_basis = report.field?.basis;
        if (report.field?.basis === "list_v1") {
          raw.dmat_field_entry = report.field.entry;
          raw.dmat_field_version = report.field.version;
        }
        if (report.field?.basis === "aps_confirmation") raw.dmat_field_classification = report.field.classification;
      }
      const history = p.qualificationHistory;
      if (history?.hasPriorUniversityStudy) {
        raw.dmat_prior_qualification_type = history.qualificationType;
        raw.dmat_prior_degree_years = history.degreeYears;
        raw.dmat_prior_study_completion = history.completion;
        raw.dmat_completed_semesters = report.completedSemesters;
      }
    }
  }
  // Trade-off: history facts are captured but deliberately NOT admitted to
  // FactKeySchema yet. Supporting old published conditions would activate
  // unreviewed routes. Recognition, field equivalence and certificate criteria
  // remain missing until the dependent source-review issues define them.
  Object.assign(raw, deriveSaudiFacts(p));
  if (p.ib) Object.assign(raw, deriveIbFacts(p.ib));
  if (p.gce) {
    const subjects = p.gce.subjects.map(s => {
      const entry = gceEntry(s.independenceGroup.trim().toLowerCase(), p.gce!.awardingBody);
      return {...s, list: entry?.list ?? 'unrecognized', category: entry?.category ?? 'other'};
    });
    const alSubjects = subjects.filter((subject) => subject.level === "AL");
    const gradeRank = {
      U: 0,
      E: 1,
      D: 2,
      C: 3,
      B: 4,
      A: 5,
      "A*": 6,
    } as const;
    const independenceGroups = new Set(
      alSubjects.map((subject) =>
        subject.independenceGroup.trim().toLowerCase(),
      ),
    );
    const hasAlCategory = (...categories: (typeof alSubjects)[number]["category"][]) =>
      alSubjects.some((subject) => categories.includes(subject.category));
    raw.gce_qualification_context = p.gce.qualificationContext;
    raw.gce_qualification_type = p.gce.qualificationType;
    raw.gce_evidence = p.gce.evidence;
    raw.gce_awarding_body = p.gce.awardingBody;
    raw.gce_school_years = p.gce.schoolYears;
    raw.gce_al_count = alSubjects.length;
    const entries = alSubjects.map(s => gceEntry(s.independenceGroup.trim().toLowerCase(), p.gce!.awardingBody));
    raw.gce_distinct_al_count = entries.every((a,i) => a && entries.slice(i+1).every(b => b && gceIndependent(a,b))) ? independenceGroups.size : 0;
    raw.gce_min_al_grade =
      alSubjects.length > 0
        ? Math.min(...alSubjects.map((subject) => gradeRank[subject.grade]))
        : undefined;
    raw.gce_list_a_count = alSubjects.filter(
      (subject) => subject.list === "A",
    ).length;
    raw.gce_general_al_count = alSubjects.filter(
      (subject) => subject.list === "A" || subject.list === "B",
    ).length;
    raw.gce_has_math_al = hasAlCategory("math");
    raw.gce_has_technical_support_al = hasAlCategory(
      "biology",
      "chemistry",
      "physics",
      "computer_science",
    );
    raw.gce_has_humanities_al = hasAlCategory(
      "language",
      "history",
      "geography",
      "social_studies",
      "economics",
    );
    raw.gce_has_social_economics_al = hasAlCategory(
      "history",
      "geography",
      "social_studies",
      "economics",
    );
    raw.gce_science_or_math_count = alSubjects.filter(s => ['math','biology','chemistry','physics','computer_science'].includes(s.category)).length;
    raw.gce_has_science_or_math_al = hasAlCategory(
      "math",
      "biology",
      "chemistry",
      "physics",
      "computer_science",
    );
  }
  Object.assign(raw, derivePakistanFacts(p));
  if (p.qualificationGuidanceVersion === 1) {
    // Missing attendance remains missing even if a caller retains old reports.
    delete raw.gce_school_years;
    delete raw.ib_school_years;
  }
  const facts: Record<string, Fact> = {};
  for (const [k, v] of Object.entries(raw)) if (v !== undefined) facts[k] = v;
  return facts;
}

// --------------------------------------------------------------- matching

function conditionPasses(fact: Fact | undefined, cond: Condition): boolean {
  const { op, value } =
    typeof cond === "object" && cond !== null
      ? cond
      : { op: "eq" as const, value: cond };
  // missing data never satisfies a condition (not even neq)
  if (fact === undefined) return false;
  switch (op) {
    case "eq":
      return fact === value;
    case "neq":
      return fact !== value;
    case "in":
      return Array.isArray(value) && value.includes(fact);
    case "nin":
      return Array.isArray(value) && !value.includes(fact);
    case "gte":
    case "gt":
    case "lte":
    case "lt": {
      if (typeof fact !== "number" || typeof value !== "number") return false;
      if (op === "gte") return fact >= value;
      if (op === "gt") return fact > value;
      if (op === "lte") return fact <= value;
      return fact < value;
    }
  }
}

export function ruleMatches(facts: Record<string, Fact>, rule: ParsedRule): boolean {
  return Object.entries(rule.conditions).every(([key, cond]) =>
    conditionPasses(facts[key], cond),
  );
}

// Shared structured quarantine for evaluation and assistant evidence. No I/O.
type JeeRule = { conditions: Record<string, Condition>; outcomes: { path?: string } };
export const isJeeRule = (r: JeeRule) =>
  conditionPasses(true, r.conditions.jee_advanced ?? false) ||
  ["jee_main_status", "jee_advanced_status", "jee_evidence_context", "jee_school_certificate", "jee_reported_target_family"].some(key => Object.hasOwn(r.conditions, key));
const jeePath = (r: JeeRule) => r.outcomes.path !== undefined && isJeeRule(r);
// Only exact positive inclusion is admissible; exclusions/unbounded futures cannot define applicability.
const includedJeeValues = (condition: Condition | undefined, allowed: readonly Primitive[]): boolean => {
  const values = typeof condition === "object" && condition !== null
    ? condition.op === "in" ? condition.value : condition.op === "eq" ? [condition.value] : []
    : condition === undefined ? [] : [condition];
  return Array.isArray(values) && values.length > 0 && values.every(value => allowed.includes(value));
};
export const isScopedJeePathRule = (r: JeeRule) => r.outcomes.path === "subject_restricted" &&
  r.conditions.jee_main_status === "passed" && r.conditions.jee_advanced_status === "passed" &&
  r.conditions.jee_evidence_context === "ordinary" &&
  r.conditions.target_degree === "bachelor" && r.conditions.curriculum === "national" &&
  r.conditions.aps_issuer_country === "in" && r.conditions.aps_qualification_context === "national" &&
  r.conditions.jee_school_certificate === "completed_12_year_secondary" &&
  includedJeeValues(r.conditions.jee_reported_target_family, ["reported_official_technology", "reported_official_natural_sciences"]) &&
  includedJeeValues(r.conditions.intake_index, [4053, 4054, 4055]);
export const isQuarantinedJeeRule = (r: JeeRule) => jeePath(r) && r.outcomes.path !== "unknown" && !isScopedJeePathRule(r);

// Pakistan admission rules share the same structured scope guard with KB rendering.
type PakistanRule = JeeRule & {source_url?: string};
export const isPakistanRule = (r: PakistanRule) => !['gce','ib'].includes(String(r.conditions.curriculum)) && (Object.keys(r.conditions).some(k=>k.startsWith('pk_')) ||
  ['certificate_country','aps_issuer_country'].some(k=>r.conditions[k]!==undefined && conditionPasses('pk',r.conditions[k])) ||
  /daad\.pk|ad-layerId=(193|195|197|199|204|206)(?:&|$)/.test(r.source_url??'') ||
  /anabin\.kmk\.org\/db\/schulabschluesse-mit-hochschulzugang/.test(r.source_url??'') && !isScopedSaudiRule(r));
export const isScopedPakistanPathRule = (r: PakistanRule) => {
 const c=r.conditions;
 const scope=c.target_degree==='bachelor' && c.curriculum==='national' && c.aps_issuer_country==='pk' && c.aps_qualification_context==='national';
 const school=scope && includedJeeValues(c.pk_certificate,['hssc','intermediate']) && includedJeeValues(c.pk_documentary_group,['science','commerce','humanities']) && c.pk_school_completion==='completed_12_grades' && typeof c.pk_grade_percent==='object' && c.pk_grade_percent.op==='gte';
 if(r.outcomes.path==='studienkolleg')return school && c.pk_prior_study_kind==='none' && includedJeeValues(c.pk_target_family,['medicine','natural_sciences','technology','social_sciences','economics','humanities']);
 return r.outcomes.path==='subject_restricted' && school && c.pk_prior_study_kind==='bachelor' && c.pk_prior_study_country==='pk' && c.pk_prior_study_completion==='in_progress' && typeof c.pk_successful_academic_years==='object' && c.pk_successful_academic_years.op==='gte' && c.pk_study_mode==='full_time' && c.pk_study_regulations==='confirmed' && c.pk_annual_records==='confirmed' && c.pk_reported_recognition==='reported_official_confirmed' && includedJeeValues(c.pk_reported_target_relation,['reported_official_previous','reported_official_closely_related']) && c.pk_current_assessment==='reported_current_support' && includedJeeValues(c.intake_index,[4053,4054,4055]);
};
export const isQuarantinedPakistanRule = (r: PakistanRule) => isPakistanRule(r) && r.outcomes.path!==undefined &&
 !(r.outcomes.path==='unknown' && (r.conditions.aps_issuer_country==='pk' && r.conditions.aps_qualification_context==='national' && Object.keys(r.conditions).some(k=>k.startsWith('pk_')) || r.conditions.target_degree==='master' && r.conditions.certificate_country==='pk')) && !isScopedPakistanPathRule(r);

// --------------------------------------------------------------- evaluate

export const NO_RULE_MESSAGES = {
  path: "No rule covers your admission path — confirm with the DAAD admission database and the uni-assist country page for your certificate.",
  aps: "No rule determines whether APS applies to your profile — confirm with the competent German mission or the official APS portal.",
  testas: "No rule determines whether TestAS applies to your profile — confirm with DAAD or the official APS portal for your country.",
  dmat: "No rule determines whether dMAT applies to your profile — confirm with APS India's official affected-fields list (aps-india.de/dmat).",
} as const;

export function evaluate(profile: Profile, rules: unknown[]): Result {
  const live = rules.flatMap((r) => {
    const parsed = EngineRuleSchema.safeParse(r);
    // invalid rows and drafts are skipped: drafts are never user-facing, and a
    // malformed record must not take the checker down
    return parsed.success && parsed.data.status !== "draft" && !parsed.data.outcomes.process && !isLegacyProcessIdentity(parsed.data) ? [parsed.data] : [];
  });
  const facts = deriveFacts(profile);
  // A positive GCE path matches one complete three-AL witness. Other routes,
  // whole-profile diagnostics and process outcomes retain ordinary matching.
  const witnesses = profile.gce ? triples(profile.gce.subjects.filter(s=>s.level==='AL')).map(subjects=>deriveFacts({...profile,gce:{...profile.gce!,subjects}})) : [];
  const positiveGce = (r: ParsedRule) => r.conditions.curriculum === 'gce' && r.outcomes.path !== undefined && r.outcomes.path !== 'unknown';
  const scopedGce = (r: ParsedRule) => ['gce_qualification_context','gce_qualification_type','gce_evidence','intake_index'].every(key=>Object.hasOwn(r.conditions,key));
  // Quarantine old IB shortcuts even when loaded from an existing published DB row.
  // Only reviewed evidence-scoped path conditions can establish ordinary recognition.
  const ibPath = (r: ParsedRule) => r.conditions.curriculum === 'ib' && r.outcomes.path !== undefined;
  const scopedIb = (r: ParsedRule) => r.conditions.ib_evidence === 'v1' && r.conditions.ib_document_status !== undefined && r.conditions.ib_exam_year !== undefined;
  const matched = live.filter(r => isSaudiAdmissionRule(r) && !isScopedSaudiRule(r) ? false : ibPath(r) && !scopedIb(r) ? false : positiveGce(r) ? scopedGce(r) && witnesses.some(w=>ruleMatches(w,r)) : ruleMatches(facts,r));

  const diagnostics: ResultDiagnostic[] = [];
  const candidateCitations: Citation[] = [];
  const citations: Citation[] = [];
  const unknowns: string[] = [];
  const cite = (rule: ParsedRule, support: ResultSupport, diagnosticClaim?: string) => {
    const existing = citations.find((c) => c.ruleId === rule.id);
    if (existing) {
      if (!existing.supports.includes(support)) existing.supports.push(support);
      return;
    }
    citations.push({
      ruleId: rule.id,
      sourceUrl: rule.source_url,
      verifiedAt: rule.last_verified_at ?? null,
      claim: diagnosticClaim ?? (isQuarantinedPakistanRule(rule) ? "Stored Pakistan route requires exact qualification, study, target and current scope review." : isQuarantinedJeeRule(rule) ? "Stored JEE route requires qualifying-pass and applicability review." : rule.outcomes.note ?? rule.source_quote),
      status: rule.status === "beta" ? "beta" : "verified",
      supports: [support],
    });
  };

  // The most-specific rule decides each key. Equal-specificity disagreement is
  // a data conflict and therefore resolves to unknown with both sources cited.
  function resolve<V>(key: "path" | "aps" | "testas" | "dmat" | `aps:${ApsScope}`): V | undefined {
    const scope = key.startsWith("aps:") ? key.slice(4) as ApsScope : undefined;
    const outcome = (r: ParsedRule) => {
      if (key === "path" && (isQuarantinedJeeRule(r) || isQuarantinedPakistanRule(r))) return undefined;
      // Possession is not applicability to the relevant completed procedure.
      // Keep other outcomes on the same historical row available.
      if (key === "dmat" && r.outcomes.dmat === "not_required" &&
          r.conditions.has_existing_aps !== undefined && r.conditions.dmat_procedure === undefined) return undefined;
      return scope ? r.outcomes.aps_scopes?.[scope]?.value : r.outcomes[key as "path" | "aps" | "testas" | "dmat"];
    };
    const support = (scope ? key : {
      path: "path",
      aps: "aps",
      testas: "testAS",
      dmat: "dMAT",
    }[key as "path" | "aps" | "testas" | "dmat"]) as ResultDiagnostic["support"];
    let contenders = matched.filter((r) => outcome(r) !== undefined);
    // Independent general undergraduate HZB subsumes the narrower Saudi school
    // entitlements. Those grants coexist; other source conflicts still resolve below.
    if (key === "path" && contenders.some(r => r.conditions.sa_degree_evidence === "v2" && isScopedSaudiRule(r) && r.outcomes.path === "direct")) {
      contenders = contenders.filter(r => !isScopedSaudiRule(r) || r.conditions.sa_degree_evidence !== undefined);
    }
    if (contenders.length === 0) return undefined;
    const specificity = (r: ParsedRule) => Object.keys(r.conditions).length;
    const max = Math.max(...contenders.map(specificity));
    const top = contenders.filter((r) => specificity(r) === max);
    // The narrow FH restriction belongs to its path, never a separately merged flag.
    const values = new Set(top.map(r => key === "path" ? JSON.stringify([outcome(r), r.outcomes.institution_restriction ?? null]) : outcome(r)));
    if (values.size > 1) {
      diagnostics.push({support, status: "source_conflict", reason: "equal_specificity_conflict", ruleIds: top.map(r => r.id), facts: []});
      top.forEach((rule) => cite(rule, support));
      unknowns.push(
        `Conflicting rules for ${key} at equal specificity (${top.map((r) => r.id).join(", ")}) — confirm with the official sources cited.`,
      );
      return "unknown" as V;
    }
    top.forEach((rule) => cite(rule, support));
    const value = outcome(top[0]) as V;
    const decisiveFacts = key === 'path' && positiveGce(top[0]) ? witnesses.find(w => ruleMatches(w, top[0])) ?? facts : facts;
    if (value !== "unknown") diagnostics.push({support, status: key === "path" && value === "insufficient" ? "known_unmet_condition" : "known_route", reason: key === "path" && value === "insufficient" ? "condition_unmet" : "route_established", ruleIds: top.map(r => r.id), facts: Object.entries(top[0].conditions).map(([key, expected]) => ({key: key as FactKey, ...(decisiveFacts[key] === undefined ? {} : {actual: decisiveFacts[key]}), expected}))});
    if (value === "unknown") {
      // a rule that explicitly answers "we don't know yet" carries its own
      // confirm-with message
      unknowns.push(top[0].outcomes.note ?? (scope ? `Confirm APS for ${scope} with the official source.` : NO_RULE_MESSAGES[key as keyof typeof NO_RULE_MESSAGES]));
    }
    return value;
  }

  const path = resolve<Result["path"]>("path") ?? "unknown";
  if (path === 'unknown' && profile.targetDegree === 'bachelor' && profile.curriculumType === 'national' && (profile.certificateCountry === 'pk' || profile.schoolQualification?.country === 'pk' || profile.pakistan?.version === 1)) {
    // Explain failed reviewed conditions; thresholds and family mappings stay in data.
    const study = facts.pk_prior_study_kind === 'bachelor';
    const candidates = live.filter(r => isScopedPakistanPathRule(r) && (study ? r.outcomes.path === 'subject_restricted' : r.outcomes.path === 'studienkolleg'));
    const applicableGroup = candidates.filter(r=>r.conditions.pk_documentary_group===facts.pk_documentary_group);
    const comparisons = (applicableGroup.length ? applicableGroup : candidates).map(rule => ({rule,failed:Object.entries(rule.conditions).filter(([key,cond])=>!conditionPasses(facts[key],cond))})).sort((a,b)=>a.failed.length-b.failed.length);
    const nearest = comparisons[0];
    if(nearest) {
      const labels:Record<string,string>={aps_issuer_country:'actual qualification issuer',aps_qualification_context:'national qualification context',pk_certificate:'exact HSSC/Intermediate certificate category (FSc/FA/ICom/ICS aliases are not classified)',pk_documentary_group:'documentary Science/Commerce/Humanities group (mixed/unclassified needs assessment)',pk_school_completion:'completed twelve grades',pk_grade_percent:'overall percentage',pk_prior_study_kind:'explicit prior-study answer',pk_successful_academic_years:'successful academic years established by annual records and a separate reference',pk_prior_study_country:'Pakistan study country',pk_prior_study_completion:'ongoing Bachelor product subset',pk_study_mode:'full-time academic study',pk_study_regulations:'study under regulations',pk_annual_records:'annual subjects/marks records',pk_reported_recognition:'applicant-reported recognition and applicable reference',pk_reported_target_relation:'applicant-reported previous/neighbouring target relationship and applicable reference',pk_current_assessment:'current applicable institutional assessment/reference (contrary assessment requires individual confirmation conflict)',intake_index:'reviewed current intake coverage (not source commencement)',pk_target_family:'reported intended target family and applicable reference (outside the preparatory subject scope needs assessment)'};
      const detail=nearest.failed.map(([key,cond])=>{
        if(facts[key]===undefined || facts[key]==='unknown')return (labels[key]??key)+' missing or uncertain';
        if(key==='pk_grade_percent' && typeof cond==='object' && cond.op==='gte')return String(cond.value)+'% condition unmet for this formula; other qualifications require separate assessment';
        return (labels[key]??key)+' does not meet this bounded formula';
      }).join('; ');
      const diagnostic='Pakistan '+(study?'current one-year':'preparatory')+' route unresolved: '+detail+'. Confirm with '+nearest.rule.source_url;
      unknowns.push(diagnostic);cite(nearest.rule,'unknowns',diagnostic);
    }
  }
  if (profile.targetDegree === "bachelor" && profile.curriculumType === "national" &&
      (profile.schoolQualification?.country === "in" || (!profile.schoolQualification && profile.certificateCountry === "in")) && (profile.jee !== undefined || profile.jeeAdvanced === true)) {
    const report = JeeProfileSchema.safeParse(profile.jee);
    const jee = report.success ? report.data : {};
    const legacyRules = live.filter(r => isQuarantinedJeeRule(r) && ruleMatches(facts, r));
    for (const rule of legacyRules) {
      const message = "Stored JEE route is quarantined pending Main and Advanced qualifying passage, qualification, target field and intake review. Confirm with " + rule.source_url;
      unknowns.push(message); cite(rule, "unknowns", message);
    }
    const ordinaryMatched = matched.some(r => jeePath(r) && isScopedJeePathRule(r) && ruleMatches(facts, r));
    if (!ordinaryMatched) {
      if (jee.context && jee.context !== "ordinary") {
        unknowns.push("JEE " + jee.context + " needs individual assessment by uni-assist/the university. Main exemptions/foreign entry, preparatory ranks and cross-year or unclear results have no verified German exception here. Confirm with " + JEE_SOURCE + " and https://jeeadv.ac.in/foreign.html");
      } else {
        for (const [exam, status] of [["Main", jee.main], ["Advanced", jee.advanced]]) {
          if (status === "not_passed" || status === "no_result") unknowns.push("JEE " + exam + " qualifying passage is not satisfied by the reported " + status + "; this excludes only the ordinary JEE route and does not establish Studienkolleg. Confirm with " + JEE_SOURCE);
          else if (status !== "passed") unknowns.push("Establish JEE " + exam + " qualifying passage from official results; a percentile, score, rank/result possession or legacy boolean alone cannot confirm it. Confirm with " + JEE_SOURCE);
        }
        if (jee.main === "passed" && jee.advanced === "passed" && !jee.context) unknowns.push("Confirm whether JEE evidence is ordinary qualifying passage or needs individual assessment (Main exemption, preparatory rank, cross-year or unclear results): " + JEE_SOURCE);
        if (jee.main === "passed" && jee.advanced === "passed") {
          if (profile.schoolQualification?.country !== "in" || profile.schoolQualification.context !== "national") unknowns.push("Establish the actual Indian national school qualification issuer/context; nationality and school location supply no evidence. " + JEE_SOURCE);
          if (jee.schoolCertificate !== "completed_12_year_secondary") unknowns.push("Confirm the reported completed Indian national 12-year secondary school-leaving certificate category; tertiary study and board labels alone cannot establish it. " + JEE_ADMISSION_SOURCE);
          if (!profile.targetField?.trim() || !["reported_official_technology", "reported_official_natural_sciences"].includes(jee.targetFamily ?? "") || !jee.targetFamilyReference?.trim()) unknowns.push("Confirm an applicable reported official technology/natural-science target field classification and reference for this intended programme; programme names are not automatically classified. " + JEE_FIELD_SOURCE);
          const scoped = live.filter(isScopedJeePathRule);
          if (!scoped.some(rule => rule.conditions.intake_index !== undefined && conditionPasses(facts.intake_index, rule.conditions.intake_index))) unknowns.push("JEE intake product coverage is missing, noncovered or awaiting reviewed rule publication. Source effective intake is not stated; verification date is not commencement. " + JEE_ADMISSION_SOURCE);
          if (!scoped.length) unknowns.push("No published reviewed ordinary JEE rule establishes qualification/certificate, target-family and intake coverage here. Confirm with " + JEE_ADMISSION_SOURCE);
        }
      }
    }
  }
  if (path === 'unknown' && profile.qualificationGuidanceVersion !== 1 && profile.targetDegree === 'bachelor' && profile.curriculumType === 'gce') {
    // Diagnostics reuse published criteria; no catalogue or threshold can publish
    // a path on its own. Pick the smallest failed-condition set for this target.
    const candidates = live.filter(r => positiveGce(r) && scopedGce(r) && r.conditions.target_field !== undefined && conditionPasses(facts.target_field,r.conditions.target_field));
    const labels: Record<string,string> = {
      gce_qualification_context:'qualification context/system (national-system certificates need their country proposal)',
      gce_qualification_type:'qualification type (Pre-U/AICE require separate verification)',
      gce_evidence:'awarding-body certificate evidence (school certificates alone are insufficient; provisional results need dated review)',
      gce_awarding_body:'recognised awarding body', gce_school_years:'actual ascending school years (ordinary duration; exceptions need recognition review)',
      intake_index:'intake applicability (historical/body-specific scope requires verification)',
      gce_distinct_al_count:'independent full A-Level subjects',gce_list_a_count:'List A subjects',
      gce_general_al_count:'recognised general subjects from List A/B (List C vocational programme restrictions need confirmation; unlisted subjects need ZAB)',
      gce_min_al_grade:'minimum grade rank on the same trio (C = 3)',
      gce_has_math_al:'target mathematics A-Level',gce_has_technical_support_al:'target supporting science/computing A-Level',
      gce_has_humanities_al:'target humanities A-Level',gce_has_social_economics_al:'target social/economics A-Level',
      gce_has_science_or_math_al:'target science/math A-Level',gce_science_or_math_count:'target science/math A-Level count',
    };
    const comparisons = candidates.flatMap(rule => (witnesses.length ? witnesses : [facts]).map(witness => ({rule,failed:Object.entries(rule.conditions).filter(([key,cond])=>!conditionPasses(witness[key],cond))})));
    const score = (failed: [string, Condition][]) => failed.reduce((sum,[key])=>sum+(key.startsWith('gce_has_')||key==='gce_science_or_math_count'?1:10),0);
    comparisons.sort((a,b)=>score(a.failed)-score(b.failed));
    const nearest=comparisons[0];
    for (const legacy of live.filter(r=>positiveGce(r) && !scopedGce(r))) {
      unknowns.push('Stored GCE rule applicability is unverified for qualification system/type, certificate evidence and intake. Confirm the applicable assessment with '+legacy.source_url);
      cite(legacy,'unknowns','Stored GCE applicability requires source review.');
    }
    if(nearest) {
      const details=nearest.failed.map(([key,cond]) => {
        const comparison=typeof cond==='object'?cond:{op:'eq',value:cond};
        const operator={eq:'',neq:'not ',gte:'at least ',gt:'more than ',lte:'at most ',lt:'less than ',in:'one of ',nin:'none of '}[comparison.op];
        const requirement=operator+(Array.isArray(comparison.value)?comparison.value.join(', '):String(comparison.value));
        return (labels[key]??key)+': requires '+requirement;
      });
      if(!witnesses.length) details.unshift('The formula requires three full independent A-Levels; AS cannot replace the missing third AL.');
      const diagnostic='GCE formula/applicability not established: '+details.join('; ')+'. Confirm with '+nearest.rule.source_url;
      unknowns.push(diagnostic);
      cite(nearest.rule,'unknowns',diagnostic);
    }
  }
  if (path === 'unknown' && profile.qualificationGuidanceVersion !== 1 && profile.targetDegree === 'bachelor' && profile.curriculumType === 'ib') {
    const candidates = live.filter(r => ibPath(r) && scopedIb(r) && r.outcomes.path !== 'unknown');
    const comparisons = candidates.map(rule => ({rule, failed:Object.entries(rule.conditions).filter(([key,cond])=>!conditionPasses(facts[key],cond))})).sort((a,b)=>a.failed.length-b.failed.length);
    const nearest=comparisons[0];
    if(nearest){
      const diagnostic='IB ordinary recognition not established: '+nearest.failed.map(([key])=>IB_FACT_LABELS[key]??key).join('; ')+'. Confirm with '+nearest.rule.source_url;
      unknowns.push(diagnostic);cite(nearest.rule,'unknowns',diagnostic);
    }
    const annexStatus = facts.ib_annex_status;
    if (facts.ib_math_level === 'SL' && annexStatus !== 'applicable') unknowns.push('IB mathematics scope requires annex review: '+String(annexStatus ?? 'missing_identity')+'; confirm exact school identity, programme and effective examination session with '+IB_SOURCE);
    if(!nearest)unknowns.push('IB subject identity, two-year continuity, language context and applicable examination evidence require a reviewed rule: '+IB_SOURCE);
    unknowns.push('Ordinary recognition gaps do not establish Studienkolleg admission. KMK section 2 describes an additional examination/Feststellungsprüfung or qualifying successful prior study; confirm your applicable alternative and subject scope with the recognition authority: '+IB_SOURCE);
  }
  if (path === "unknown" && (isSaudiSchoolProfile(profile) || profile.targetDegree === "bachelor" && profile.qualificationHistory?.country === "sa")) {
    const candidates = live.filter(r => isScopedSaudiRule(r) && r.outcomes.path !== undefined && r.outcomes.path !== "unknown" && (r.conditions.sa_degree_evidence !== undefined || conditionPasses(facts.sa_certificate_subtype, r.conditions.sa_certificate_subtype!)));
    const comparisons = candidates.map(rule => ({ rule, failed: Object.entries(rule.conditions).filter(([key, cond]) => !conditionPasses(facts[key], cond)) }));
    if (comparisons.some(c => c.failed.length)) {
      for (const nearest of comparisons.filter(c => c.failed.length)) {
      const diagnostic = "Saudi route not established: " + nearest.failed.map(([key]) => {
        const label = key === "intake_index" ? "intake applicability (current product coverage 4053/4054/4055; industrial source regime starts Winter 2026/27)" : SAUDI_FACT_LABELS[key] ?? key;
        return label + (facts[key] === "unmet" || facts[key] === "rejected" || facts[key] === "unrelated" ? " condition unmet by the reported assessment" : " not established");
      }).join("; ") + ". Confirm with " + nearest.rule.source_url;
      unknowns.push(diagnostic); cite(nearest.rule, "unknowns", diagnostic);
      }
    } else if (!profile.saudiCertificate?.subtype || profile.saudiCertificate.subtype === "unknown") {
      unknowns.push("Select the explicit Saudi certificate subtype; no subtype is inferred from a legacy board. Confirm with " + SAUDI_SOURCE);
    } else {
      unknowns.push("Saudi certificate/issuer applicability is unresolved. Confirm the applicable documentary category, reports and covered intake; confirm the exact qualification with " + SAUDI_SOURCE);
    }
    for (const legacy of live.filter(r => isSaudiAdmissionRule(r) && !isScopedSaudiRule(r))) {
      cite(legacy, "unknowns", "Stored Saudi admission applicability is unverified; no admission path is established.");
    }
  }
  if (path === "unknown" && profile.targetDegree === "master" && (profile.qualificationHistory?.country === "sa" || profile.certificateCountry === "sa")) {
    unknowns.push("Saudi completed-degree equivalence for Master's admission remains source-held; duration or a completed Bachelor alone cannot establish eligibility. Ask the admitting university for its exact qualification criteria: " + SAUDI_SOURCE);
  }
  if (!matched.some((r) => r.outcomes.path !== undefined))
    unknowns.push(NO_RULE_MESSAGES.path);
  const flag = (key: "aps" | "testas" | "dmat"): Result["aps"] => {
    const v = resolve<Result["aps"]>(key);
    if (v === undefined) unknowns.push(NO_RULE_MESSAGES[key]);
    return v ?? "unknown";
  };
  const apsScopes = Object.fromEntries(APS_SCOPES.map(scope => {
    const value = resolve<NonNullable<Result["apsScopes"]>[typeof scope]>(`aps:${scope}`);
    if (value === undefined) unknowns.push(`No published scoped rule determines APS for ${scope} — confirm ${scope === "visa" ? "the responsible mission and its checklist" : "the relevant issuer and application requirements with APS India or uni-assist"}.`);
    return [scope, value ?? "unknown"];
  })) as NonNullable<Result["apsScopes"]>;
  // Compatibility is conservative: a checklist omission never means a global
  // exemption. Unscoped legacy rows cannot determine any scoped requirement.
  const aps: Result["aps"] = APS_SCOPES.some(scope => apsScopes[scope] === "required") ? "required" : "unknown";
  for (const rule of matched.filter(r => r.outcomes.aps !== undefined)) {
    cite(rule, "unknowns");
    unknowns.push("A legacy APS rule has no qualification/application/visa scope — confirm with its official source; it does not establish an exemption.");
  }
  const testAS = flag("testas");
  const dMAT = flag("dmat");

  const documents: string[] = [];
  const steps: Result["stepsDetailed"] = [];
  for (const rule of matched) {
    // Saudi path-specific tasks/documents follow the winning clause, not a superseded or conflicting preparation route.
    if (isScopedSaudiRule(rule) && rule.outcomes.path !== undefined && (path === "unknown" || !citations.some(c => c.ruleId === rule.id && c.supports.includes("path")))) continue;
    const blockedPakistanTasks = isPakistanRule(rule) && rule.outcomes.path !== undefined && (rule.outcomes.path !== path || !citations.some(c => c.ruleId === rule.id && c.supports.includes("path")));
    for (const doc of (isQuarantinedJeeRule(rule) || isQuarantinedPakistanRule(rule) || blockedPakistanTasks) ? [] : rule.outcomes.documents ?? []) {
      // Trade-off: old free-text APS entries lack machine-readable scope.
      // Suppress them pending admin review; never infer scope from their prose.
      if (/\bAPS\b/i.test(doc)) continue;
      if (!documents.includes(doc)) documents.push(doc);
      cite(rule, "documents");
    }
    for (const step of (isQuarantinedJeeRule(rule) || isQuarantinedPakistanRule(rule) || blockedPakistanTasks) ? [] : rule.outcomes.steps ?? []) {
      if (/\bAPS\b/i.test(step.text)) continue;
      if (!steps.some((s) => s.text === step.text)) {
        steps.push({ ...step, ruleId: rule.id });
      }
      cite(rule, "steps");
    }
    // note-only rules are open caveats ("verify which anabin proposal
    // applies…") — surface them as honest unknowns
    for (const scope of APS_SCOPES) {
      const scoped = rule.outcomes.aps_scopes?.[scope];
      const winning = citations.some(c => c.ruleId === rule.id && c.supports.includes(`aps:${scope}`));
      if (!scoped || !winning || apsScopes[scope] !== "required") continue;
      for (const doc of scoped.documents ?? []) {
        if (!documents.includes(doc)) documents.push(doc);
        cite(rule, "documents");
      }
      for (const step of scoped.steps ?? []) {
        if (step.acquisition && profile.hasExistingApsCertificate !== false) continue;
        if (!steps.some(s => s.ruleId === rule.id && s.order === step.order)) steps.push({ ...step, ruleId: rule.id, apsScope: scope });
        cite(rule, "steps");
      }
    }
    const { path: rulePath, aps, aps_scopes, testas, dmat, documents: d, steps: s, note } = rule.outcomes;
    if (note && [rulePath, aps, aps_scopes, testas, dmat, d, s].every((v) => v === undefined)) {
      unknowns.push(note);
      cite(rule, "unknowns");
    }
  }

  // Candidate explanations reuse the matcher and reviewed scope guards. They
  // never change the resolved path, flags, documents or tasks.
  const missing = (value: Fact | undefined) => value === undefined || value === 'unknown' || ['missing_identity', 'missing_session', 'missing_programme'].includes(String(value));
  const candidates = live.filter(rule => {
    if (!rule.outcomes.path || ['unknown', 'insufficient'].includes(rule.outcomes.path)) return false;
    if (isQuarantinedJeeRule(rule) || isQuarantinedPakistanRule(rule) || isSaudiAdmissionRule(rule) && !isScopedSaudiRule(rule)) return false;
    if (rule.conditions.target_degree !== undefined && !conditionPasses(facts.target_degree, rule.conditions.target_degree)) return false;
    if (rule.conditions.curriculum !== undefined && !conditionPasses(facts.curriculum, rule.conditions.curriculum)) return false;
    // Issuer and documentary group keep another country's/stream's candidates
    // out of this profile's explanation. Missing is never inferred as no study.
    for (const key of ['aps_issuer_country', 'pk_documentary_group', 'sa_certificate_subtype', 'sa_national_stream', 'target_field'] as const) {
      if (rule.conditions[key] !== undefined && !missing(facts[key]) && !conditionPasses(facts[key], rule.conditions[key])) return false;
    }
    for (const key of ['in_class12_prior_study_kind', 'pk_prior_study_kind'] as const) {
      if (rule.conditions[key] !== undefined && !missing(facts[key]) && !conditionPasses(facts[key], rule.conditions[key])) return false;
    }
    if (isScopedSaudiRule(rule) && rule.conditions.sa_degree_evidence !== undefined && profile.qualificationHistory?.country !== 'sa') return false;
    if (positiveGce(rule)) return scopedGce(rule);
    if (ibPath(rule)) return scopedIb(rule);
    return isScopedPakistanPathRule(rule) || isScopedSaudiRule(rule) || isScopedJeePathRule(rule) || Object.keys(rule.conditions).some(key => key.startsWith('in_class12_'));
  });
  for (const rule of candidates) {
    const comparisons = (positiveGce(rule) && witnesses.length ? witnesses : [facts]).map(witness => ({witness, failed: Object.entries(rule.conditions).filter(([key, condition]) => !conditionPasses(witness[key], condition))})).sort((a, b) => a.failed.length - b.failed.length);
    const {witness, failed} = comparisons[0];
    if (!failed.length) continue;
    const qualificationScope = profile.qualificationGuidanceVersion === 1 &&
      (positiveGce(rule) || ibPath(rule)) && failed.some(([key]) => ['gce_school_years', 'ib_school_years'].includes(key));
    const assessedChecks = qualificationScope ? Object.entries(rule.conditions)
      .filter(([key]) => !['gce_school_years', 'ib_school_years'].includes(key))
      .map(([key, expected]) => ({ key: key as FactKey, ...(witness[key] === undefined ? {} : { actual: witness[key] }), expected, met: conditionPasses(witness[key], expected) })) : undefined;
    const decisive = failed.filter(([key]) => !qualificationScope || !['gce_school_years', 'ib_school_years'].includes(key))
      .map(([key, expected]) => ({key: key as FactKey, ...(witness[key] === undefined ? {} : {actual: witness[key]}), expected}));
    // The positive derivation deliberately withholds negative completed-degree
    // reports. Retain those literal applicant reports for explanation only.
    for (const fact of decisive) {
      const history = profile.qualificationHistory;
      if (fact.key === 'sa_degree_recognition' && history?.priorStudyRecognition === 'reported_official_rejected' && history.priorStudyRecognitionReference?.trim()) Object.assign(fact, {reported: history.priorStudyRecognition});
      if (fact.key === 'sa_degree_norms' && history?.saudiBachelorEvidence?.assessment === 'reported_official_unmet' && history.saudiBachelorEvidence.reference?.trim()) Object.assign(fact, {reported: history.saudiBachelorEvidence.assessment});
    }
    const reportedNegative = decisive.some(f => 'reported' in f);
    const conflict = decisive.some(f => f.actual === 'source_conflict' || f.key === 'pk_current_assessment' && f.actual === 'reported_contrary');
    const unsupported = decisive.some(f => !missing(f.actual) && (['intake_index', 'aps_qualification_context', 'in_class12_prior_study_country', 'in_class12_study_mode', 'pk_prior_study_country', 'pk_prior_study_completion', 'pk_study_mode', 'gce_qualification_context', 'gce_qualification_type', 'gce_evidence', 'gce_awarding_body', 'ib_evidence', 'sa_degree_context', 'sa_degree_mode'].includes(f.key) || ['other', 'outside', 'reported_official_outside', 'completed_qualification', 'discontinued', 'main_exemption', 'preparatory_rank', 'cross_year', 'unclear', 'legacy', 'invalid', 'unlisted', 'not_yet_effective', 'programme_not_covered', 'identity_conflict'].includes(String(f.actual))));
    const gap = decisive.some(f => missing(f.actual) && !('reported' in f));
    const status = qualificationScope && !decisive.length ? 'qualification_guidance' : conflict ? 'source_conflict' : unsupported ? 'unsupported' : reportedNegative ? 'known_unmet_condition' : gap ? 'targeted_missing_fact' : 'known_unmet_condition';
    diagnostics.push({support: 'path', status, reason: status === 'qualification_guidance' ? 'recognition_not_assessed' : conflict || unsupported ? 'applicability_unsupported' : reportedNegative ? 'condition_unmet' : gap ? 'fact_missing' : 'condition_unmet', ruleIds: [rule.id], facts: decisive, ...(assessedChecks ? {assessedChecks} : {}), relatedUnknowns: unknowns.filter(message => citations.some(c => c.ruleId === rule.id && c.claim === message) || matched.some(r => r.outcomes.path === 'unknown' && r.source_url === rule.source_url && r.outcomes.note === message && decisive.some(f => f.key.startsWith('in_class12_') && r.conditions[f.key] !== undefined)))});
    // An unmatched positive note cannot become the claimed route in a citation.
    if (!citations.some(c => c.ruleId === rule.id)) candidateCitations.push({ruleId: rule.id, sourceUrl: rule.source_url, verifiedAt: rule.last_verified_at ?? null, status: rule.status as 'beta' | 'verified', supports: ['unknowns'], claim: qualificationScope ? 'Qualification checks only; full recognition is not assessed. School attendance is not established by this qualification.' : 'Candidate route only: ' + decisive.map(f => diagnosticFactLabel(f.key) + (missing(f.actual) ? ' missing or uncertain' : ' does not satisfy this candidate condition')).join('; ') + '. Other supported routes remain independent.'});
  }
  if (!diagnostics.some(d => d.support === 'path')) diagnostics.push({support: 'path', status: 'unsupported', reason: 'no_supported_rule', ruleIds: [], facts: []});
  if (path === 'unknown' && !diagnostics.some(d => d.support === 'path' && d.status === 'source_conflict')) {
    const gaps = diagnostics.filter(d => d.support === 'path' && d.status === 'targeted_missing_fact');
    const prior = profile.qualificationHistory?.hasPriorUniversityStudy === undefined
      ? gaps.find(d => d.facts.some(f => ['in_class12_prior_study_kind', 'pk_prior_study_kind', 'sa_prior_study_kind'].includes(f.key))) : undefined;
    const chosen = prior ?? gaps.find(d => d.facts.some(f => missing(f.actual) && DIAGNOSTIC_QUESTIONS[f.key]));
    const fact = chosen?.facts.find(f => missing(f.actual) && DIAGNOSTIC_QUESTIONS[f.key] && (!prior || ['in_class12_prior_study_kind', 'pk_prior_study_kind', 'sa_prior_study_kind'].includes(f.key)));
    if (chosen && fact) {
      chosen.followUp = {key: fact.key, question: DIAGNOSTIC_QUESTIONS[fact.key]!};
      chosen.relatedUnknowns = unknowns.filter(message => matched.some(r => r.outcomes.path === 'unknown' && r.outcomes.note === message && r.conditions[fact.key] !== undefined) || citations.some(c => chosen.ruleIds.includes(c.ruleId) && c.claim === message));
    }
  }

  const stepsDetailed = steps.sort((a, b) => a.order - b.order);

  return {
    path,
    ...(path !== "unknown" && matched.some(r => r.outcomes.institution_restriction === "fachhochschule" && citations.some(c => c.ruleId === r.id && c.supports.includes("path"))) ? { institutionRestriction: "fachhochschule" as const } : {}),
    aps,
    apsScopes,
    apsCertificate: profile.hasExistingApsCertificate === true ? "held" : profile.hasExistingApsCertificate === false ? "missing" : "unknown",
    apsRuleIds: live.filter(r => r.outcomes.aps !== undefined || r.outcomes.aps_scopes !== undefined || r.outcomes.steps?.some(s => /\bAPS\b/i.test(s.text))).map(r => r.id),
    testAS,
    dMAT,
    documents,
    stepsDetailed,
    citations,
    candidateCitations,
    unknowns,
    diagnostics,
  };
}
