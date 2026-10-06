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
  jee_advanced: "valid JEE Advanced result",
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

export function ruleToChunk(rule: KbRule): KbChunk {
  const conditionLines = Object.entries(rule.conditions).map(([key, cond]) =>
    renderCondition(key, cond),
  );
  const content = [
    conditionLines.length > 0
      ? `Applies when: ${conditionLines.join("; ")}.`
      : "Applies to all profiles.",
    ...renderOutcomes(rule.outcomes),
    `${rule.outcomes.aps ? "Stored legacy quote (scoped applicability unverified)" : "Official source says"}: "${rule.source_quote}"`,
  ].join("\n");

  return {
    slug: rule.slug,
    title: rule.slug,
    content,
    source_url: rule.source_url,
    last_verified_at: rule.last_verified_at,
    country_code: rule.country_code,
  };
}
