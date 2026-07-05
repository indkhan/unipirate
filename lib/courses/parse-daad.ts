import { type CourseFacts, EMPTY_FACTS } from "./import";

// Deterministic extraction from the Ctrl+A text of a course page, tuned to the
// stable labels on DAAD "International Programmes" detail pages. Values are
// captured verbatim; anything not literally present stays missing.

type Field = "degree" | "language" | "deadlines" | "tuition" | "requirements";

const CAPTURE: Record<string, Field> = {
  Degree: "degree",
  "Teaching language": "language",
  "Application deadline": "deadlines",
  "Tuition fees per semester in EUR": "tuition",
  "Academic admission requirements": "requirements",
  "Language requirements": "requirements",
};

// Max verbatim lines kept per field.
const LIMIT: Record<Field, number> = {
  degree: 1,
  language: 4,
  deadlines: 10,
  tuition: 2,
  requirements: 15,
};

// Any known DAAD label/section heading ends the previous field's capture.
const BOUNDARIES = new Set([
  ...Object.keys(CAPTURE),
  "Overview",
  "Course location",
  "Languages",
  "Full-time / part-time",
  "Programme duration",
  "Beginning",
  "Additional information on tuition fees",
  "Combined Master's degree / PhD programme",
  "Joint degree / double degree programme",
  "Description/content",
  "Course organisation",
  "Types of assessment",
  "A Diploma supplement will be issued",
  "International elements",
  "Integrated internships",
  "Course-specific, integrated German language courses",
  "Course-specific, integrated English language courses",
  "Semester contribution",
  "Costs of living",
  "Funding opportunities within the university",
  "Application deadline",
  "Submit application to",
  "Possibility of finding part-time employment",
  "Accommodation",
  "Career advisory service",
  "Support for international students and doctoral candidates",
  "About the university",
]);

export function parseDaadText(text: string): CourseFacts {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const captured: Record<Field, string[]> = {
    degree: [],
    language: [],
    deadlines: [],
    tuition: [],
    requirements: [],
  };

  let active: Field | null = null;
  for (const line of lines) {
    if (BOUNDARIES.has(line)) {
      active = CAPTURE[line] ?? null;
      continue;
    }
    if (!line || !active) continue;
    if (captured[active].length < LIMIT[active]) {
      captured[active].push(line);
    }
  }

  // Course heading sits just above the "University Name • City" line.
  let name: string | null = null;
  let university: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const match = /^(.{3,}?) • (.+)$/.exec(lines[i]);
    if (!match) continue;
    university = match[1];
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j] && !BOUNDARIES.has(lines[j])) {
        name = lines[j];
        break;
      }
    }
    break;
  }

  return {
    ...EMPTY_FACTS,
    name,
    university,
    degree: captured.degree[0] ?? null,
    language: captured.language.length ? captured.language.join(", ") : null,
    deadlines: captured.deadlines,
    requirements: captured.requirements,
    tuition: captured.tuition.length ? captured.tuition.join(" ") : null,
  };
}
