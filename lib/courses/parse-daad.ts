import { type CourseFacts, EMPTY_FACTS } from "./import";

// Deterministic extraction from the Ctrl+A text of a course page, tuned to the
// stable labels on DAAD "International Programmes" detail pages. Values are
// captured verbatim; anything not literally present stays missing.

type Field =
  | "location"
  | "degree"
  | "language"
  | "description"
  | "deadlines"
  | "tuition"
  | "requirements";

const CAPTURE: Record<string, Field> = {
  "Course location": "location",
  Degree: "degree",
  "Teaching language": "language",
  "Description/content": "description",
  "Application deadline": "deadlines",
  "Tuition fees per semester in EUR": "tuition",
  "Academic admission requirements": "requirements",
  "Language requirements": "requirements",
};

// Max verbatim lines kept per field.
const LIMIT: Record<Field, number> = {
  location: 1,
  degree: 1,
  language: 4,
  description: 30,
  deadlines: 10,
  tuition: 1,
  requirements: 15,
};

// Any known DAAD label/section heading ends the previous field's capture.
const BOUNDARIES = new Set([
  ...Object.keys(CAPTURE),
  "Overview",
  "Course location",
  "In cooperation with",
  "Languages",
  "Language level of course",
  "Language level of course ",
  "Full-time / part-time",
  "Programme duration",
  "Beginning",
  "Date(s)",
  "Information on dates, prices and mode of study",
  "Mode of study",
  "Phase(s) of attendance in Germany (applies to the entire course)",
  "Pace of course",
  "Target group",
  "Additional information on tuition fees",
  "Combined Master's degree / PhD programme",
  "Joint degree / double degree programme",
  "Description/content",
  "Course organisation",
  "Course objectives",
  "Types of assessment",
  "A Diploma supplement will be issued",
  "Recognised language exams offered (e.g. DSH, TestDaF, TOEFL)",
  "Other degrees / qualifications awarded",
  "ECTS points (max.)",
  "Average number of hours per week",
  "Average number of participants per group/course",
  "International elements",
  "Integrated internships",
  "Course-specific, integrated German language courses",
  "Course-specific, integrated English language courses",
  "Dates and costs",
  "This price includes",
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
  const lines = text
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .split(/\r?\n/)
    .map((l) => l.trim());
  const captured: Record<Field, string[]> = {
    location: [],
    degree: [],
    language: [],
    description: [],
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

  // Course heading sits just above the university line, which is either
  // "University Name • City" on one line or the city bulleted on its own line
  // ("University Name" \n "• City") depending on how the browser copies it.
  let name: string | null = null;
  let university: string | null = null;
  const previous = (from: number): string | null => {
    for (let j = from; j >= 0; j--) {
      if (lines[j] && !BOUNDARIES.has(lines[j])) return lines[j];
    }
    return null;
  };
  const inline = lines.findIndex((l) => /^.{3,} • .+$/.test(l));
  const bullet = lines.findIndex((l) => /^• .+$/.test(l));
  if (inline !== -1) {
    university = lines[inline].split(" • ")[0];
    name = previous(inline - 1);
  } else if (bullet !== -1) {
    university = previous(bullet - 1);
    const uniIndex = university ? lines.lastIndexOf(university, bullet - 1) : -1;
    name = uniIndex > 0 ? previous(uniIndex - 1) : null;
  }

  // DAAD renders some blocks twice (mobile + desktop) — drop repeated lines.
  const uniq = (values: string[]) => [...new Set(values)];
  return {
    ...EMPTY_FACTS,
    name,
    university,
    location: captured.location[0] ?? null,
    degree: captured.degree[0] ?? null,
    language: captured.language.length ? uniq(captured.language).join(", ") : null,
    description: captured.description.length
      ? uniq(captured.description).join("\n")
      : null,
    deadlines: uniq(captured.deadlines),
    requirements: uniq(captured.requirements),
    tuition: captured.tuition.length ? uniq(captured.tuition).join(" ") : null,
  };
}
