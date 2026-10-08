import { isQuarantinedJeeRule, isScopedJeePathRule } from "../engine/evaluate";
import { JEE_SOURCE, JEE_FIELD_SOURCE, JEE_LEGACY_SLUG } from "../engine/jee";

// Pure rendering of rule records into embeddable text chunks. Zero I/O.
// The assistant's search_rules tool retrieves these chunks; the verbatim
// source_quote is the semantic payload, the rendered conditions/outcomes make
// the retrieved text precise enough to answer from without guessing.

/**
 * Shared by the write path (scripts/embed-kb.ts) and the read path
 * (lib/ai/assistant.ts). These two MUST agree: embeddings from different
 * models are not comparable, and a mismatch returns plausible-looking but
 * wrong neighbours with no error.
 */
import { isSaudiAdmissionRule, isScopedSaudiRule, SAUDI_FACT_LABELS } from "@/lib/engine/saudi";

export const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";
export const EMBEDDING_DIMENSIONS = 2048;

type Primitive = string | number | boolean;
type Condition =
  | Primitive
  | { op: "eq" | "neq"; value: Primitive }
  | { op: "gte" | "gt" | "lte" | "lt"; value: number }
  | { op: "in" | "nin"; value: Primitive[] };

export type KbRule = {
  slug: string;
  conditions: Record<string, Condition>;
  outcomes: {
    path?: string;
    institution_restriction?: "fachhochschule";
    aps?: string;
    aps_scopes?: Partial<Record<"qualification" | "application" | "visa", {
      value: string; documents?: string[]; steps?: { order: number; text: string; acquisition?: boolean }[];
    }>>;
    testas?: string;
    dmat?: string;
    documents?: string[];
    steps?: { order: number; text: string }[];
    note?: string;
  };
  source_url: string;
  source_quote: string;
  last_verified_at: string | null;
  country_code: string | null;
};

export type KbChunk = {
  slug: string;
  title: string;
  content: string;
  source_url: string;
  last_verified_at: string | null;
  country_code: string | null;
};

// Readable labels for the fact keys used in rule conditions
// (see FactKeySchema in lib/engine/evaluate.ts). Unlisted keys fall back to
// the key with underscores replaced by spaces.
const FACT_LABELS: Record<string, string> = {
  ...SAUDI_FACT_LABELS,
  in_class12_prior_study_kind: "reported prior-study kind for Indian Class XII",
  in_class12_prior_study_country: "reported bachelor institution country for Indian Class XII",
  in_class12_successful_bachelor_years: "reported successfully completed bachelor academic years (not programme duration)",
  in_class12_study_mode: "reported previous bachelor study mode",
  in_class12_reported_recognition: "applicant-reported official recognition assessment with applicable reference (not app verification)",
  in_class12_reported_target_relation: "applicant-reported official previous-field/target relationship with applicable reference (not guaranteed admission)",
  dmat_qualification_scope: "reported relevant previous-qualification scope",
  dmat_procedure: "reported relevant APS procedure for dMAT",
  dmat_field_basis: "reported previous-degree classification basis",
  dmat_field_entry: "reported official affected-field group",
  dmat_field_classification: "reported APS-confirmed previous-degree classification",
  dmat_field_version: "APS affected-fields list version",
  dmat_registration_status: "completed APS online-registration event status",
  dmat_registration_day: "completed APS online registration date (YYYYMMDD; relevant procedure only)",
  dmat_dispatch_status: "reported complete-document dispatch status",
  dmat_complete_dispatch_day: "complete APS document dispatch date (YYYYMMDD; relevant procedure only)",
  dmat_partnership_status: "reported official programme confirmation status",
  dmat_completed_semesters: "actually completed bachelor semesters (not converted from years)",
  dmat_prior_qualification_type: "reported previous qualification type for dMAT",
  dmat_prior_degree_years: "reported previous qualification duration in years for dMAT",
  dmat_prior_study_completion: "reported previous-study completion status for dMAT",
  aps_confirmed_submission_day: "reported APS-confirmed complete submission date (YYYYMMDD; relevant procedure only)",
  aps_submission_confirmation: "complete submission date confirmation for the relevant APS procedure",
  aps_issuer_country: "country of the relevant qualification issuer",
  aps_qualification_context: "explicit qualification context",
  aps_application_context: "confirmed application authority",
  visa_mission_context: "confirmed responsible-mission checklist context",
  has_prior_university_study: "has previous higher education study",
  prior_qualification_type: "previous qualification type",
  prior_study_institution: "previous institution",
  prior_study_country: "country of previous institution",
  prior_degree_field: "previous field of study (as reported)",
  prior_degree_years: "previous qualification duration in years",
  years_of_university_study: "successfully completed university study in years",
  prior_study_completion: "previous study completion status",
  target_degree: "target degree",
  curriculum: "curriculum type",
  board: "school board",
  class12_percent: "Class 12 percentage",
  jee_advanced: "historical JEE Advanced boolean (not confirmed qualifying passage)",
  jee_main_status: "reported JEE Main qualifying passage status",
  jee_advanced_status: "reported JEE Advanced qualifying passage status",
  jee_school_certificate: "applicant-reported completed Indian national school certificate category (not app verification)",
  jee_reported_target_family: "applicant-reported applicable official classification of this intended target, with reference (not app verification)",
  jee_evidence_context: "reported JEE exception or evidence uncertainty",
  certificate_country: "country of the assessed qualification",
  visa_application_country: "country of visa application",
  target_field: "target field of study",
  has_existing_aps: "already holds an APS certificate",
  intake_index: "intake semester",
};

/** Inverse of intakeIndex in lib/engine/evaluate.ts: 4053 → "winter 2026/27". */
function renderIntake(index: number): string {
  const year = Math.floor(index / 2);
  return index % 2 === 1
    ? `winter ${year}/${String(year + 1).slice(2)}`
    : `summer ${year}`;
}

function renderValue(key: string, value: Primitive): string {
  if (key === "intake_index" && typeof value === "number")
    return renderIntake(value);
  return String(value);
}

function renderCondition(key: string, cond: Condition): string {
  const label = FACT_LABELS[key] ?? key.replace(/_/g, " ");
  const { op, value } =
    typeof cond === "object" && cond !== null && "op" in cond
      ? cond
      : { op: "eq" as const, value: cond as Primitive };

  const isTime = key === "intake_index";
  switch (op) {
    case "eq":
      return `${label} is ${renderValue(key, value as Primitive)}`;
    case "neq":
      return `${label} is not ${renderValue(key, value as Primitive)}`;
    case "in":
      return `${label} is one of ${(value as Primitive[]).map((v) => renderValue(key, v)).join(", ")}`;
    case "nin":
      return `${label} is none of ${(value as Primitive[]).map((v) => renderValue(key, v)).join(", ")}`;
    case "gte":
      return `${label} is ${isTime ? "from" : "at least"} ${renderValue(key, value as number)}`;
    case "gt":
      return `${label} is ${isTime ? "after" : "more than"} ${renderValue(key, value as number)}`;
    case "lte":
      return `${label} is ${isTime ? "up to" : "at most"} ${renderValue(key, value as number)}`;
    case "lt":
      return `${label} is ${isTime ? "before" : "less than"} ${renderValue(key, value as number)}`;
  }
}

const PATH_LABELS: Record<string, string> = {
  direct: "direct admission",
  subject_restricted: "direct admission restricted to related subjects",
  studienkolleg: "Studienkolleg (foundation year) required before admission",
  insufficient: "not sufficient for admission",
  unknown: "not yet determined",
};

function renderOutcomes(outcomes: KbRule["outcomes"]): string[] {
  const lines: string[] = [];
  if (outcomes.path)
    lines.push(`Admission path: ${PATH_LABELS[outcomes.path] ?? outcomes.path}.`);
  if (outcomes.institution_restriction === "fachhochschule") lines.push("Institution restriction: Fachhochschule (university of applied sciences), preparatory route only.");
  const flag = (name: string, value?: string) => {
    if (value) lines.push(`${name}: ${value.replace(/_/g, " ")}.`);
  };
  if (outcomes.aps) lines.push("Legacy APS scope is unresolved; this scalar does not establish a global exemption.");
  for (const [scope, outcome] of Object.entries(outcomes.aps_scopes ?? {})) {
    flag(`APS for ${scope}`, outcome.value);
    if (outcome.value === "not_listed") lines.push("Checklist omission is not an exemption; additional documents may be requested.");
    if (outcome.value === "required") {
      if (outcome.documents) lines.push(`APS ${scope} documents: ${outcome.documents.join("; ")}.`);
      if (outcome.steps) lines.push(`APS ${scope} steps: ${outcome.steps.map(s => s.text).join("; ")}.`);
    }
  }
  flag("TestAS", outcomes.testas);
  flag("dMAT", outcomes.dmat);
  if (outcomes.documents?.length)
    lines.push(`Documents: ${outcomes.documents.filter(d => !/\bAPS\b/i.test(d)).join("; ")}.`);
  if (outcomes.steps?.length)
    lines.push(
      `Steps: ${outcomes.steps.filter(s => !/\bAPS\b/i.test(s.text))
        .sort((a, b) => a.order - b.order)
        .map((s) => s.text)
        .join(" → ")}`,
    );
  if (outcomes.note && !outcomes.aps) lines.push(`Note: ${outcomes.note}`);
  return lines;
}

export function ruleToChunk(rule: KbRule, options: { includeLegacyDmatQuote?: boolean } = {}): KbChunk {
  if (isSaudiAdmissionRule(rule) && !isScopedSaudiRule(rule)) return {
    slug: rule.slug, title: "Saudi admission applicability unverified",
    content: "Saudi admission applicability: unknown. [[unknown]] Stored certificate/stream/degree criteria require official source review; no admission path is established.",
    source_url: rule.source_url, last_verified_at: null, country_code: rule.country_code,
  };
  // Changing a historical row's outcomes cannot verify its old admission quote.
  const legacyJee = isQuarantinedJeeRule(rule) ||
    (rule.slug === JEE_LEGACY_SLUG && !isScopedJeePathRule(rule));
  const legacyDmat = rule.outcomes.dmat !== undefined && rule.conditions.has_existing_aps !== undefined &&
    rule.conditions.dmat_procedure === undefined;
  const conditionLines = Object.entries(rule.conditions).map(([key, cond]) =>
    renderCondition(key, cond),
  );
  const outcomes = legacyJee ? { ...rule.outcomes, path: undefined, note: undefined,
    documents: undefined, steps: undefined } : rule.outcomes;
  const content = [
    ...(legacyJee ? [
      "JEE admission applicability: unknown. [[unknown]] Historical conditions do not establish qualifying passage or current admission access.",
      "Stored historical quote and admission note are unverified and withheld from evidence. Confirm Main and Advanced qualifying passage, certificate, target-field and intake applicability with " + JEE_SOURCE + " and " + JEE_FIELD_SOURCE + ".",
      "Historical metadata date (not verification of the admission claim): " + (rule.last_verified_at ?? "unknown") + ".",
    ] : []),
    conditionLines.length > 0
      ? `${legacyJee ? "Historical conditions (applicability unverified)" : "Applies when"}: ${conditionLines.join("; ")}.`
      : "Applies to all profiles.",
    ...renderOutcomes(legacyDmat ? { ...outcomes,
      dmat: options.includeLegacyDmatQuote === false ? "unknown" : undefined, note: undefined } : outcomes),
    ...(legacyDmat ? ["Legacy dMAT procedure applicability unverified: certificate possession alone does not establish an exemption for a new or unknown procedure."] : []),
    ...((legacyJee || (legacyDmat && options.includeLegacyDmatQuote === false)) ? [] : [
      `${rule.outcomes.aps ? "Stored legacy quote (scoped applicability unverified)" : legacyDmat ? "Stored legacy quote (procedure applicability unverified)" : "Official source says"}: "${rule.source_quote}"`]),
  ].join("\n");

  return {
    slug: rule.slug,
    title: legacyJee ? "JEE applicability unresolved" : rule.slug,
    content,
    source_url: rule.source_url,
    last_verified_at: legacyJee ? null : rule.last_verified_at,
    country_code: rule.country_code,
  };
}
