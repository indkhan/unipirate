// Pure rule engine: evaluate(profile, rules[]) → Result. Zero I/O.
// Eligibility logic lives in the rule records (DB `rules` table shape), never
// here — this module only derives facts from the profile, matches conditions,
// and merges outcomes. Missing rules produce explicit `unknown` outcomes with
// confirm-with-the-official-source messages; the engine never guesses.
import { z } from "zod";

// ---------------------------------------------------------------- profile

export type Term = "winter" | "summer";

export type Profile = {
  targetDegree: "bachelor" | "master";
  intake?: { term: Term; year: number };
  nationality?: string; // 'in' | 'pk' | 'sa' | ...
  certificateCountry?: string; // where the qualification was earned (APS routing)
  curriculumType: "national" | "ib" | "gce" | "other";
  board?: string; // 'cbse' | 'fsc' | 'tawjihiyah' | ...
  schoolGradePercent?: number; // Class XII overall %
  jeeAdvanced?: boolean;
  yearsOfUniversityStudy?: number; // completed years in home country
  universityStudyField?: string;
  universityStudyInstitutionRecognized?: boolean;
  schoolCertificateRequirementsMet?: boolean;
  priorDegree?: { years: number; field: string };
  visaApplicationCountry?: string;
  apsApplicationSubmittedAt?: string; // ISO date; transition rules compare YYYYMMDD facts
  apsRegistrationCompletedAt?: string; // ISO date
  apsDocumentsShippedAt?: string; // ISO date
  hasExistingApsCertificate?: boolean;
  isExchangeOrPartnershipProgram?: boolean;
  ib?: {
    fullDiploma: boolean;
    totalPoints: number;
    examYear: number;
    schoolYears: number;
    mathLevel: "HL" | "SL" | null;
    mathCourse: "AA" | "AI" | "other" | null;
    subjects: {
      group: 1 | 2 | 3 | 4 | 5 | 6;
      level: "HL" | "SL";
      grade: number;
      category:
        | "language"
        | "math"
        | "biology"
        | "chemistry"
        | "physics"
        | "other";
      foreignLanguage?: boolean;
      recognizedForGermany: boolean;
    }[];
  };
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
    schoolYears: number;
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
  "aps_application_day",
  "aps_documents_shipped_day",
  "aps_registration_day",
  "board",
  "certificate_country",
  "class12_percent",
  "curriculum",
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
  "partnership_program",
  "prior_degree_field",
  "prior_degree_years",
  "school_certificate_requirements_met",
  "target_degree",
  "target_field",
  "university_study_field_matches_target",
  "university_study_institution_recognized",
  "visa_application_country",
  "years_of_university_study",
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

const RuleOutcomesSchema = z
  .object({
    path: PathValue.optional(),
    aps: FlagValue.optional(),
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
  | "path"
  | "aps"
  | "testAS"
  | "dMAT"
  | "documents"
  | "steps"
  | "unknowns";

export type Result = {
  path: z.infer<typeof PathValue>;
  aps: z.infer<typeof FlagValue>;
  testAS: z.infer<typeof FlagValue>;
  dMAT: z.infer<typeof FlagValue>;
  documents: string[];
  steps: string[]; // ordered
  citations: Citation[];
  unknowns: string[]; // honest gaps: "no rule covers X — confirm with [source]"
};

// ------------------------------------------------------------------- facts

type Fact = Primitive;

/**
 * Flattens the profile into the flat fact map rule conditions match against.
 * Arithmetic restatement of the profile only — every eligibility threshold
 * (70%, ≥3 A-Levels, ≥24 IB points, semester cutoffs…) lives in rule data.
 */
function deriveFacts(p: Profile): Record<string, Fact> {
  const dateIndex = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? Number(`${match[1]}${match[2]}${match[3]}`) : undefined;
  };
  const raw: Partial<Record<FactKey, Fact>> = {
    target_degree: p.targetDegree,
    intake_index: p.intake && intakeIndex(p.intake.term, p.intake.year),
    certificate_country: p.certificateCountry,
    curriculum: p.curriculumType,
    board: p.board,
    class12_percent: p.schoolGradePercent,
    jee_advanced: p.jeeAdvanced,
    years_of_university_study: p.yearsOfUniversityStudy,
    university_study_institution_recognized:
      p.universityStudyInstitutionRecognized,
    school_certificate_requirements_met:
      p.schoolCertificateRequirementsMet,
    university_study_field_matches_target:
      p.universityStudyField !== undefined && p.targetField !== undefined
        ? p.universityStudyField === p.targetField
        : undefined,
    prior_degree_years: p.priorDegree?.years,
    prior_degree_field: p.priorDegree?.field,
    visa_application_country: p.visaApplicationCountry,
    target_field: p.targetField,
    aps_application_day: dateIndex(p.apsApplicationSubmittedAt),
    aps_registration_day: dateIndex(p.apsRegistrationCompletedAt),
    aps_documents_shipped_day: dateIndex(p.apsDocumentsShippedAt),
    has_existing_aps: p.hasExistingApsCertificate,
    partnership_program: p.isExchangeOrPartnershipProgram,
  };
  if (p.ib) {
    const subjects = p.ib.subjects;
    raw.ib_full_diploma = p.ib.fullDiploma;
    raw.ib_total_points = p.ib.totalPoints;
    raw.ib_exam_year = p.ib.examYear;
    raw.ib_school_years = p.ib.schoolYears;
    raw.ib_math_level = p.ib.mathLevel ?? undefined;
    raw.ib_math_course = p.ib.mathCourse ?? undefined;
    raw.ib_subject_count = subjects.length;
    raw.ib_hl_count = subjects.filter((subject) => subject.level === "HL").length;
    raw.ib_min_subject_grade =
      subjects.length > 0
        ? Math.min(...subjects.map((subject) => subject.grade))
        : undefined;
    raw.ib_all_subjects_recognized = subjects.every(
      (subject) => subject.recognizedForGermany,
    );
    raw.ib_language_count = subjects.filter(
      (subject) => subject.group === 1 || subject.group === 2,
    ).length;
    raw.ib_has_foreign_language_hl = subjects.some(
      (subject) =>
        (subject.group === 1 || subject.group === 2) &&
        subject.level === "HL" &&
        subject.foreignLanguage === true,
    );
    raw.ib_has_social_science = subjects.some((subject) => subject.group === 3);
    raw.ib_has_natural_science = subjects.some((subject) =>
      ["biology", "chemistry", "physics"].includes(subject.category),
    );
    raw.ib_has_2025_eligible_hl = subjects.some(
      (subject) =>
        subject.level === "HL" &&
        ["language", "math", "biology", "chemistry", "physics"].includes(
          subject.category,
        ),
    );
  }
  if (p.gce) {
    const subjects = p.gce.subjects;
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
    raw.gce_awarding_body = p.gce.awardingBody;
    raw.gce_school_years = p.gce.schoolYears;
    raw.gce_al_count = alSubjects.length;
    raw.gce_distinct_al_count = independenceGroups.size;
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

const NO_RULE_MESSAGES = {
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
  const matched = live.filter((r) => ruleMatches(facts, r));

  const citations: Citation[] = [];
  const unknowns: string[] = [];
  const cite = (rule: ParsedRule, support: ResultSupport) => {
    const existing = citations.find((c) => c.ruleId === rule.id);
    if (existing) {
      if (!existing.supports.includes(support)) existing.supports.push(support);
      return;
    }
    citations.push({
      ruleId: rule.id,
      sourceUrl: rule.source_url,
      verifiedAt: rule.last_verified_at ?? null,
      claim: rule.outcomes.note ?? rule.source_quote,
      status: rule.status === "beta" ? "beta" : "verified",
      supports: [support],
    });
  };

  // The most-specific rule decides each key. Equal-specificity disagreement is
  // a data conflict and therefore resolves to unknown with both sources cited.
  function resolve<V>(key: "path" | "aps" | "testas" | "dmat"): V | undefined {
    const support: ResultSupport = {
      path: "path",
      aps: "aps",
      testas: "testAS",
      dmat: "dMAT",
    }[key] as ResultSupport;
    const contenders = matched.filter((r) => r.outcomes[key] !== undefined);
    if (contenders.length === 0) return undefined;
    const specificity = (r: ParsedRule) => Object.keys(r.conditions).length;
    const max = Math.max(...contenders.map(specificity));
    const top = contenders.filter((r) => specificity(r) === max);
    const values = new Set(top.map((r) => r.outcomes[key]));
    if (values.size > 1) {
      top.forEach((rule) => cite(rule, support));
      unknowns.push(
        `Conflicting rules for ${key} at equal specificity (${top.map((r) => r.id).join(", ")}) — confirm with the official sources cited.`,
      );
      return "unknown" as V;
    }
    top.forEach((rule) => cite(rule, support));
    const value = top[0].outcomes[key] as V;
    if (value === "unknown") {
      // a rule that explicitly answers "we don't know yet" carries its own
      // confirm-with message
      unknowns.push(top[0].outcomes.note ?? NO_RULE_MESSAGES[key]);
    }
    return value;
  }

  const path = resolve<Result["path"]>("path") ?? "unknown";
  if (!matched.some((r) => r.outcomes.path !== undefined))
    unknowns.push(NO_RULE_MESSAGES.path);
  const flag = (key: "aps" | "testas" | "dmat"): Result["aps"] => {
    const v = resolve<Result["aps"]>(key);
    if (v === undefined) unknowns.push(NO_RULE_MESSAGES[key]);
    return v ?? "unknown";
  };
  const aps = flag("aps");
  const testAS = flag("testas");
  const dMAT = flag("dmat");

  const documents: string[] = [];
  const steps: { order: number; text: string }[] = [];
  for (const rule of matched) {
    for (const doc of rule.outcomes.documents ?? []) {
      if (!documents.includes(doc)) documents.push(doc);
      cite(rule, "documents");
    }
    for (const step of rule.outcomes.steps ?? []) {
      if (!steps.some((s) => s.text === step.text)) steps.push(step);
      cite(rule, "steps");
    }
    // note-only rules are open caveats ("verify which anabin proposal
    // applies…") — surface them as honest unknowns
    const { path, aps, testas, dmat, documents: d, steps: s, note } = rule.outcomes;
    if (note && [path, aps, testas, dmat, d, s].every((v) => v === undefined)) {
      unknowns.push(note);
      cite(rule, "unknowns");
    }
  }

  return {
    path,
    aps,
    testAS,
    dMAT,
    documents,
    steps: steps.sort((a, b) => a.order - b.order).map((s) => s.text),
    citations,
    unknowns,
  };
}
