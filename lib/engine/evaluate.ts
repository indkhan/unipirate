// Pure rule engine: evaluate(profile, rules[]) → Result. Zero I/O.
// Eligibility logic lives in the rule records (DB `rules` table shape), never
// here — this module only derives facts from the profile, matches conditions,
// and merges outcomes. Missing rules produce explicit `unknown` outcomes with
// confirm-with-the-official-source messages; the engine never guesses.
import { z } from "zod";
import { type SaudiReport, deriveSaudiFacts, isSaudiAdmissionRule, isScopedSaudiRule, isSaudiSchoolProfile, SAUDI_SOURCE, SAUDI_FACT_LABELS } from "./saudi";
import { type IbProfile, deriveIbFacts, IB_FACT_LABELS, IB_SOURCE } from "./ib";
import { gceEntry, gceIndependent, triples } from "./gce";
import { calendarDay } from "./calendar-day";
import { DmatProfileSchema, type DmatProfile } from "./dmat";

// ---------------------------------------------------------------- profile

export type Term = "winter" | "summer";

export type Profile = {
  targetDegree: "bachelor" | "master";
  intake?: { term: Term; year: number };
  nationality?: string; // 'in' | 'pk' | 'sa' | ...
  certificateCountry?: string; // legacy qualification/attendance country; not an APS issuer
  curriculumType: "national" | "ib" | "gce" | "other";
  board?: string; // 'cbse' | 'fsc' | 'tawjihiyah' | ...
  schoolGradePercent?: number; // Class XII overall %
  jeeAdvanced?: boolean;
  visaApplicationCountry?: string;
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
  "sa_certificate_evidence", "sa_certificate_subtype", "sa_reported_subject_assessment", "sa_prior_study_kind",
  "sa_successful_bachelor_years", "sa_reported_recognition", "sa_reported_target_relation",
  "sa_reported_enrollment", "sa_reported_enrollment_relation",
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
    if (rule.outcomes.institution_restriction && rule.outcomes.path !== "studienkolleg") context.addIssue({ code: z.ZodIssueCode.custom, path: ["outcomes", "institution_restriction"], message: "FH restriction is supported only on the preparatory path." });
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

export type Result = {
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

function ruleMatches(facts: Record<string, Fact>, rule: ParsedRule): boolean {
  return Object.entries(rule.conditions).every(([key, cond]) =>
    conditionPasses(facts[key], cond),
  );
}

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
    return parsed.success && parsed.data.status !== "draft" ? [parsed.data] : [];
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
      claim: diagnosticClaim ?? rule.outcomes.note ?? rule.source_quote,
      status: rule.status === "beta" ? "beta" : "verified",
      supports: [support],
    });
  };

  // The most-specific rule decides each key. Equal-specificity disagreement is
  // a data conflict and therefore resolves to unknown with both sources cited.
  function resolve<V>(key: "path" | "aps" | "testas" | "dmat" | `aps:${ApsScope}`): V | undefined {
    const scope = key.startsWith("aps:") ? key.slice(4) as ApsScope : undefined;
    const outcome = (r: ParsedRule) => {
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
    }[key as "path" | "aps" | "testas" | "dmat"]) as ResultSupport;
    const contenders = matched.filter((r) => outcome(r) !== undefined);
    if (contenders.length === 0) return undefined;
    const specificity = (r: ParsedRule) => Object.keys(r.conditions).length;
    const max = Math.max(...contenders.map(specificity));
    const top = contenders.filter((r) => specificity(r) === max);
    // The narrow FH restriction belongs to its path, never a separately merged flag.
    const values = new Set(top.map(r => key === "path" ? JSON.stringify([outcome(r), r.outcomes.institution_restriction ?? null]) : outcome(r)));
    if (values.size > 1) {
      top.forEach((rule) => cite(rule, support));
      unknowns.push(
        `Conflicting rules for ${key} at equal specificity (${top.map((r) => r.id).join(", ")}) — confirm with the official sources cited.`,
      );
      return "unknown" as V;
    }
    top.forEach((rule) => cite(rule, support));
    const value = outcome(top[0]) as V;
    if (value === "unknown") {
      // a rule that explicitly answers "we don't know yet" carries its own
      // confirm-with message
      unknowns.push(top[0].outcomes.note ?? (scope ? `Confirm APS for ${scope} with the official source.` : NO_RULE_MESSAGES[key as keyof typeof NO_RULE_MESSAGES]));
    }
    return value;
  }

  const path = resolve<Result["path"]>("path") ?? "unknown";
  if (path === 'unknown' && profile.targetDegree === 'bachelor' && profile.curriculumType === 'gce') {
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
  if (path === 'unknown' && profile.targetDegree === 'bachelor' && profile.curriculumType === 'ib') {
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
  if (path === "unknown" && isSaudiSchoolProfile(profile)) {
    const candidates = live.filter(r => isScopedSaudiRule(r) && r.outcomes.path !== undefined && r.outcomes.path !== "unknown" && conditionPasses(facts.sa_certificate_subtype, r.conditions.sa_certificate_subtype!));
    const comparisons = candidates.map(rule => ({ rule, failed: Object.entries(rule.conditions).filter(([key, cond]) => !conditionPasses(facts[key], cond)) }));
    if (comparisons.some(c => c.failed.length)) {
      for (const nearest of comparisons.filter(c => c.failed.length)) {
      const diagnostic = "Saudi route not established: " + nearest.failed.map(([key]) => {
        const label = key === "intake_index" ? "intake applicability (industrial regime starts Winter 2026/27)" : SAUDI_FACT_LABELS[key] ?? key;
        return label + (facts[key] === "unmet" || facts[key] === "rejected" || facts[key] === "unrelated" ? " condition unmet by the reported assessment" : " not established");
      }).join("; ") + ". Confirm with " + nearest.rule.source_url;
      unknowns.push(diagnostic); cite(nearest.rule, "unknowns", diagnostic);
      }
    } else if (!profile.saudiCertificate?.subtype || profile.saudiCertificate.subtype === "unknown") {
      unknowns.push("Select the explicit Saudi certificate subtype; no subtype is inferred from a legacy board. Confirm with " + SAUDI_SOURCE);
    } else {
      unknowns.push("Saudi certificate/issuer applicability is unresolved. National stream and completed-degree routes lack verified criteria; confirm the exact qualification with " + SAUDI_SOURCE);
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
    for (const doc of rule.outcomes.documents ?? []) {
      // Trade-off: old free-text APS entries lack machine-readable scope.
      // Suppress them pending admin review; never infer scope from their prose.
      if (/\bAPS\b/i.test(doc)) continue;
      if (!documents.includes(doc)) documents.push(doc);
      cite(rule, "documents");
    }
    for (const step of rule.outcomes.steps ?? []) {
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
    unknowns,
  };
}
