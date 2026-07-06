import { z } from "zod";

// Structured facts extracted from a pasted course page. Deadline/tuition text
// is kept verbatim from the source — never converted or invented (CLAUDE.md rule 2).
export const CourseFactsSchema = z.object({
  name: z.string().min(1).nullable(),
  university: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  degree: z.string().min(1).nullable(),
  language: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  deadlines: z.array(z.string().min(1)),
  requirements: z.array(z.string().min(1)),
  tuition: z.string().min(1).nullable(),
});

export type CourseFacts = z.infer<typeof CourseFactsSchema>;

export const EMPTY_FACTS: CourseFacts = {
  name: null,
  university: null,
  location: null,
  degree: null,
  language: null,
  description: null,
  deadlines: [],
  requirements: [],
  tuition: null,
};

// Field groups tracked in courses.field_extraction.
export const FIELD_GROUPS = [
  "core",
  "description",
  "deadlines",
  "requirements",
  "tuition",
] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];
export type FieldExtraction = Partial<Record<FieldGroup, "library" | "ai">>;

// Required set that decides whether the AI fallback runs.
export function missingRequired(facts: CourseFacts): boolean {
  return (
    !facts.name ||
    !facts.university ||
    !facts.degree ||
    !facts.language ||
    facts.deadlines.length === 0
  );
}

// First dated line from a course's verbatim deadlines jsonb — skips audience
// headers like "Non-EU students:".
export function firstDeadline(deadlines: unknown): string | null {
  if (!Array.isArray(deadlines)) return null;
  const line = deadlines.find((d) => typeof d === "string" && /\d/.test(d));
  return typeof line === "string" ? line.replace(/^[:\s]+/, "") : null;
}

// Dedupe key: lowercase host, no hash, no tracking params, no trailing slash.
export function normalizeUrl(url: string): string {
  const u = new URL(url);
  // DAAD detail pages share a numeric id across language variants — canonicalize
  // to the EN URL (what this function already produced for EN imports).
  const daad =
    /(^|\.)daad\.de$/i.test(u.hostname) && u.pathname.match(/\/detail\/(\d+)(\/|$)/);
  if (daad) {
    return `https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/${daad[1]}`;
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "ref"].includes(key.toLowerCase())) {
      u.searchParams.delete(key);
    }
  }
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}
