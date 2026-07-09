import {
  NO_RULE_MESSAGES,
  type Citation,
  type Profile,
  type Result,
  type ResultSupport,
} from "@/lib/engine/evaluate";

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

const BOARD_LABELS: Record<string, string> = {
  cbse: "CBSE",
  cisce: "CISCE",
  state_board: "State board",
  fsc: "FSc/HSSC",
  tawjihiyah: "Tawjihiyah",
  private_school: "Private-school certificate",
};

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

export function buildVerdicts(result: Result, profile: Profile): Verdict[] {
  const flags = [
    ["aps", "APS", result.aps],
    ["testAS", "TestAS", result.testAS],
    ["dMAT", "dMAT", result.dMAT],
  ] as const;

  return [
    {
      key: "path",
      label: PATH_LABELS[result.path],
      citations: citationsFor(result, "path"),
      unknown: result.path === "unknown",
    },
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
export function visibleUnknowns(result: Result, profile: Profile): string[] {
  return result.unknowns.filter((unknown) => {
    if (unknown === NO_RULE_MESSAGES.testas)
      return flagRelevant("testAS", result, profile);
    if (unknown === NO_RULE_MESSAGES.dmat)
      return flagRelevant("dMAT", result, profile);
    return true;
  });
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
  if (result.path === "studienkolleg") pending.push("Studienkolleg");
  if (result.aps === "required") pending.push("APS");
  if (result.testAS === "required") pending.push("TestAS");
  if (result.dMAT === "required") pending.push("dMAT");
  pending.push("Applications", "Visa", "Germany");

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
  return { in: "India", pk: "Pakistan", sa: "Saudi Arabia" }[code ?? ""] ?? "your country";
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
  return `${profile.intake.term === "winter" ? "Winter" : "Summer"} ${profile.intake.year}`;
}

