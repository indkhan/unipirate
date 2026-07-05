import type {
  Citation,
  Profile,
  Result,
  ResultSupport,
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

export function buildVerdicts(result: Result): Verdict[] {
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
    ...flags.map(([key, name, value]) => {
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

export function buildRoute(result: Result): RouteStation[] {
  const pending: string[] = [];
  if (result.path === "unknown") pending.push("Confirm eligibility");
  if (result.path === "insufficient") pending.push("Review alternatives");
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
    profile.board?.toUpperCase(),
    profile.schoolGradePercent !== undefined
      ? `${profile.schoolGradePercent}%`
      : undefined,
    !profile.board ? profile.curriculumType.toUpperCase() : undefined,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function intakeLabel(profile: Profile): string | null {
  if (!profile.intake) return null;
  return `${profile.intake.term === "winter" ? "Winter" : "Summer"} ${profile.intake.year}`;
}

