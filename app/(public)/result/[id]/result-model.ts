import {
  NO_RULE_MESSAGES,
  APS_SCOPES,
  type ResultDiagnostic,
  type Citation,
  type Profile,
  type Result,
  type ResultSupport,
} from "@/lib/engine/evaluate";

import { SCIENCE_STREAMS } from "@/lib/engine/saudi";
import { BOARDS, COUNTRIES } from "@/app/(public)/check/steps";

export type ViewerVariant = "anonymous_owner" | "claimed_owner" | "public";

export type Verdict = {
  key: ResultSupport;
  label: string;
  citations: Citation[];
  unknown: boolean;
};

export type RouteStation = {
  label: string;
  state: "done" | "current" | "todo";
};

const PATH_LABELS: Record<Result["path"], string> = {
  direct: "You can apply directly to Bachelor programmes.",
  subject_restricted: "You have a subject-restricted direct admission route.",
  studienkolleg: "Your route includes Studienkolleg before university.",
  insufficient: "This profile does not currently meet the admission route.",
  unknown: "Your admission route still needs confirmation.",
};

const BOARD_LABELS: Record<string, string> = Object.fromEntries(
  BOARDS.map((board) => [board.id, board.label]),
);

const CURRICULUM_LABELS: Record<Profile["curriculumType"], string> = {
  national: "National board",
  ib: "IB Diploma",
  gce: "GCE A-Levels",
  other: "Other curriculum",
};

function flagLabel(
  name: string,
  value: Result["aps"],
): { label: string; unknown: boolean } {
  if (value === "required") return { label: `${name} is required`, unknown: false };
  if (value === "not_required")
    return { label: `${name} is not required`, unknown: false };
  return { label: `Confirm whether ${name} applies`, unknown: true };
}

export function citationsFor(
  result: Result,
  support: ResultSupport,
): Citation[] {
  return result.citations.filter(
    (citation) =>
      Array.isArray(citation.supports) && citation.supports.includes(support),
  );
}

/**
 * Display relevance only — the engine still evaluates every flag. dMAT is an
 * APS-India Master's admission test; TestAS is an undergraduate aptitude test.
 * A flag that came back "required" is always shown, whatever the profile.
 */
function flagRelevant(
  key: "aps" | "testAS" | "dMAT",
  result: Result,
  profile: Profile,
): boolean {
  if (result[key] === "required") return true;
  if (key === "testAS") return profile.targetDegree === "bachelor";
  if (key === "dMAT") {
    return (
      profile.targetDegree === "master" && profile.certificateCountry === "in"
    );
  }
  return true;
}

/** Overall academic explanation; candidate failures never override a winner. */
export function diagnosticRequirement(expected: NonNullable<Result['diagnostics']>[number]['facts'][number]['expected']): string {
  if (typeof expected !== 'object') return String(expected);
  const operator = {eq: '', neq: 'not ', gte: 'at least ', gt: 'more than ', lte: 'at most ', lt: 'less than ', in: 'one of ', nin: 'none of '}[expected.op];
  return operator + (Array.isArray(expected.value) ? expected.value.join(', ') : String(expected.value));
}

export function primaryDiagnostic(result: Result): ResultDiagnostic | undefined {
  const academic = result.diagnostics?.filter(d => d.support === 'path') ?? [];
  const qualification = academic.filter(d => d.assessedChecks).sort((a, b) => a.facts.length - b.facts.length)[0];
  return academic.find(d => d.reason === 'equal_specificity_conflict') ?? academic.find(d => d.status === 'known_route') ?? academic.find(d => d.status === 'source_conflict') ?? qualification ?? academic.find(d => d.followUp) ?? academic.find(d => d.status === 'targeted_missing_fact') ?? academic.find(d => d.status === 'known_unmet_condition') ?? academic[0];
}
const DIAGNOSTIC_LABELS: Record<ResultDiagnostic['status'], string> = {
  qualification_guidance: 'Your qualification checks meet the cited criteria. Full recognition still needs confirmation.',
  known_route: 'A supported route is available.',
  known_unmet_condition: 'A condition is unmet for the cited route; other qualifications may need a separate assessment.',
  targeted_missing_fact: 'Your admission assessment is missing a specific answer.',
  source_conflict: 'Conflicting evidence leaves this admission assessment unresolved. Ask the recognition authority to resolve the cited conflict for your qualification.',
  unsupported: 'Your admission route still needs confirmation.',
};

export function buildVerdicts(result: Result, profile: Profile): Verdict[] {
  const flags = [
    ["testAS", "TestAS", result.testAS],
    ["dMAT", "dMAT", result.dMAT],
  ] as const;

  return [
    {
      key: "path",
      label: profile.saudiCertificate?.version !== undefined && ["studienkolleg", "subject_restricted"].includes(result.path)
        ? "Your reported qualifications indicate " + (result.path === "studienkolleg" ? profile.saudiCertificate.subtype === "national" && SCIENCE_STREAMS.includes(profile.saudiCertificate.nationalStream ?? "") ? "Studienkolleg in all preparatory Schwerpunktkurse" : "Studienkolleg" : "Bachelor access") + (result.institutionRestriction === "fachhochschule" ? " only at a Fachhochschule (university of applied sciences)" + (result.path === "studienkolleg" ? " in the enrollment subject area. " : " in the previous or neighbouring subject area. ") : " in the applicable reported subject area. ") + "UniPirate has not independently verified your reports; the university decides admission."
       : result.path === "subject_restricted" && profile.schoolQualification?.country === "pk" && profile.qualificationHistory?.pakistanStudy?.evidenceVersion === 2
        ? "Your reported qualifications indicate a current subject-restricted direct route. Applicant reports are not independently verified by UniPirate; the institution decides. The linked regional brochure states two years; confirm the applicable assessment."
        : result.path === "subject_restricted" && profile.qualificationHistory?.indiaStudyRouteVersion === 1 &&
        profile.targetDegree === "bachelor" && profile.curriculumType === "national" && profile.schoolQualification?.country === "in"
        ? "Your reported qualifications indicate a subject-restricted direct route. UniPirate has not independently verified your reports; the university decides programme admission."
        : result.path === "direct" && profile.qualificationHistory?.saudiBachelorEvidence?.version === 2 ? "Your reported completed Bachelor indicates general undergraduate access to all subjects and higher education institutions. UniPirate has not independently verified your reports; the university decides programme admission. This does not establish Master's equivalence." : result.path === 'unknown' && primaryDiagnostic(result)?.assessedChecks && primaryDiagnostic(result)!.status !== 'qualification_guidance' && primaryDiagnostic(result)!.status !== 'source_conflict' ? 'Some qualification checks need review. Full recognition remains unconfirmed.' : result.path === 'unknown' && primaryDiagnostic(result) ? DIAGNOSTIC_LABELS[primaryDiagnostic(result)!.status] : PATH_LABELS[result.path],
      citations: citationsFor(result, "path"),
      unknown: result.path === "unknown",
    },
    ...(result.apsScopes ? APS_SCOPES.map(scope => {
      const value = result.apsScopes![scope];
      const name = `APS for ${scope === "qualification" ? "qualification recognition" : scope}`;
      const verdict = value === "not_listed"
        ? { label: "APS is not listed on the applicable visa checklist; this is not an exemption", unknown: false }
        : flagLabel(name, value);
      return { key: `aps:${scope}` as ResultSupport, ...verdict, label: verdict.label + (value === "required" && result.apsCertificate === "held" ? "; certificate already held" : ""), citations: citationsFor(result, `aps:${scope}`) };
    }) : [{ key: "aps" as const, label: "Confirm APS qualification, application and visa requirements separately", unknown: true, citations: citationsFor(result, "aps") }]),
    ...flags
      .filter(([key]) => flagRelevant(key, result, profile))
      .map(([key, name, value]) => {
        const verdict = flagLabel(name, value);
        return {
          key,
          label: verdict.label,
          citations: citationsFor(result, key),
          unknown: verdict.unknown,
        };
      }),
  ];
}

/** Drops "confirm whether X applies" gaps for flags the profile never needs. */
export function visibleUnknowns(result: Result, profile: Profile, historical = false): string[] {
  const diagnostic = primaryDiagnostic(result);
  return result.unknowns.filter((unknown) => {
    if (unknown === NO_RULE_MESSAGES.path && diagnostic?.assessedChecks) return false;
    if (unknown === NO_RULE_MESSAGES.path && !historical && (diagnostic?.assessedChecks || diagnostic?.followUp || diagnostic?.status === 'known_unmet_condition')) return false;
    if (unknown === NO_RULE_MESSAGES.testas)
      return flagRelevant("testAS", result, profile);
    if (unknown === NO_RULE_MESSAGES.dmat)
      return flagRelevant("dMAT", result, profile);
    return true;
  }).map(message => !historical && (diagnostic?.followUp || diagnostic?.status === 'known_unmet_condition') && diagnostic.relatedUnknowns?.includes(message)
    ? message.replace(/\.? Confirm with (?:the university|https?:\/\/\S+)\.?$/, '') : message);
}

export function buildRoute(result: Result): RouteStation[] {
  if (result.path === "unknown") {
    return [
      { label: "Confirm eligibility", state: "current" },
      { label: "Applications", state: "todo" },
      { label: "Visa", state: "todo" },
      { label: "Germany", state: "todo" },
    ];
  }
  if (result.path === "insufficient") {
    return [
      { label: "Review alternatives", state: "current" },
      { label: "Applications", state: "todo" },
      { label: "Visa", state: "todo" },
      { label: "Germany", state: "todo" },
    ];
  }

  const pending: string[] = [];
  if (result.path === "studienkolleg") pending.push(result.institutionRestriction === "fachhochschule" ? "Studienkolleg (FH)" : "Studienkolleg");
  if (result.aps === "required" && result.apsCertificate !== "held") pending.push("APS");
  if (result.testAS === "required") pending.push("TestAS");
  if (result.dMAT === "required") pending.push("dMAT");
  pending.push(result.path === "subject_restricted" && result.institutionRestriction === "fachhochschule" ? "Applications (FH only)" : "Applications", "Visa", "Germany");

  return [
    { label: "Eligibility", state: "done" },
    ...pending.map((label, index) => ({
      label,
      state: index === 0 ? ("current" as const) : ("todo" as const),
    })),
  ];
}

export function documentPreview(documents: string[]) {
  return {
    visible: documents.slice(0, 5),
    hiddenCount: Math.max(0, documents.length - 5),
  };
}

export function isBetaCountry(profile: Profile): boolean {
  return ["pk", "sa"].includes(
    profile.certificateCountry ?? profile.nationality ?? "",
  );
}

export function countryLabel(profile: Profile): string {
  const code = profile.certificateCountry ?? profile.nationality;
  return COUNTRIES.find((c) => c.code === code)?.name ?? "your country";
}

export function profileSummary(profile: Profile): string {
  const parts = [
    profile.targetDegree === "master" ? "Master's applicant" : undefined,
    profile.board ? (BOARD_LABELS[profile.board] ?? profile.board) : undefined,
    profile.schoolGradePercent !== undefined
      ? `${profile.schoolGradePercent}%`
      : undefined,
    profile.targetDegree !== "master" && !profile.board
      ? CURRICULUM_LABELS[profile.curriculumType]
      : undefined,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function intakeLabel(profile: Profile): string | null {
  if (!profile.intake) return null;
  if (profile.intake.term === "winter") {
    const nextYear = String((profile.intake.year + 1) % 100).padStart(2, "0");
    return `Winter ${profile.intake.year}/${nextYear}`;
  }
  return `Summer ${profile.intake.year}`;
}

