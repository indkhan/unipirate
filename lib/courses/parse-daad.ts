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
  "Application periods": "deadlines",
  "Tuition fees per semester": "tuition",
  "Tuition fees per semester in EUR": "tuition",
  "Academic admission requirements": "requirements",
  "Language requirements": "requirements",
  "German language skills": "requirements",
  "English language skills": "requirements",
  "Language requirements exemptions": "requirements",
};

// Single-value fields stop after their value; source sections must not be truncated.
const LIMIT: Record<Field, number> = {
  location: 1,
  degree: 1,
  language: 4,
  description: Infinity,
  deadlines: Infinity,
  tuition: 1,
  requirements: Infinity,
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
  "Submit application via",
  "More information on application periods",
  "Additional information on beginning, duration and mode of study",
  "Contact",
  "Imprint",
  "PDF Download",
  "Technical equipment and programmes",
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

  const { name, university } = parseDaadIdentity(text);

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

// Only literal adjacent heading pairs identify a programme; repeated responsive
// headings are harmless, but competing pairs must be recopied.
export function parseDaadIdentity(text: string): { name: string | null; university: string | null } {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const headings = new Map<string, { name: string; university: string }>();
  const heading = (line: string | undefined) => line && line.length <= 240
    && !BOUNDARIES.has(line) && !/^(DAAD|International Programmes(?: in Germany| \d{4}\/\d{4})?|My favourites|Search|Back|Home|Home Back|pagination|©)$/i.test(line)
    // Captured DAAD preamble controls remain navigation when the title/header is omitted.
    && !/^(Skip to main content|Services|More info|0 0|Cookie Consent|Settings|Reject|ACCEPT|Privacy Policy)$/i.test(line)
    && !line.includes("\u2022");
  for (let i = 0; i < lines.length; i++) {
    const inline = lines[i].match(/^(.+) \u2022 .+$/);
    const split = /^\u2022 .+$/.test(lines[i]);
    if (!inline && !split) continue;
    const university = inline ? inline[1] : lines[i - 1];
    const name = lines[i - (inline ? 1 : 2)];
    if (!heading(name) || !heading(university)) continue;
    // shortcut: unfamiliar institution headings require recopy; extend only with captured DAAD examples.
    if (!/university|universit(?:ät|aet)|hochschule|college|institut|akademie|academy|school|\b(?:TU|TH|FH|HAW|HTW|HWR|HHL|ESMT|BTU|KIT|RWTH|LMU)\b/i.test(university)) continue;
    headings.set(JSON.stringify([name, university]), { name, university });
  }
  return headings.size === 1 ? [...headings.values()][0] : { name: null, university: null };
}
