import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";

import {
  type CourseFacts,
  CourseFactsSchema,
  type FieldExtraction,
  missingRequired,
} from "@/lib/courses/import";
import { parseDaadText } from "@/lib/courses/parse-daad";
import { getServerEnv } from "@/lib/env";

// AI never invents facts: the prompt demands verbatim quotes and the output is
// zod-validated; a failed call degrades to honest gaps (CLAUDE.md rule 2).
export async function aiExtract(text: string, url: string): Promise<CourseFacts> {
  const apiKey = getServerEnv().OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  const openrouter = createOpenRouter({ apiKey });
  const { object } = await generateObject({
    model: openrouter("qwen/qwen3.6-flash"),
    schema: CourseFactsSchema,
    temperature: 0,
    system:
      "You extract structured facts about a university course from pasted page text. " +
      "Quote every value verbatim from the text. If a fact is not literally present, " +
      "use null (or an empty array). Never guess, infer, or reformat dates. " +
      "deadlines: each application-deadline statement as one verbatim string. " +
      "requirements: academic and language admission requirements, one per string. " +
      "tuition: the verbatim tuition-fee statement.",
    prompt: `Source URL: ${url}\n\nPage text:\n${text.slice(0, 60_000)}`,
  });
  return object;
}

export type ExtractedCourse = {
  facts: CourseFacts;
  fieldExtraction: FieldExtraction;
  extractionMethod: "library" | "ai";
};

const CORE = ["name", "university", "degree", "language"] as const;

export async function extractCourse(
  url: string,
  text: string,
  ai: typeof aiExtract = aiExtract,
): Promise<ExtractedCourse> {
  const facts = parseDaadText(text);
  const fieldExtraction: FieldExtraction = {};
  if (CORE.some((k) => facts[k])) fieldExtraction.core = "library";
  if (facts.deadlines.length) fieldExtraction.deadlines = "library";
  if (facts.requirements.length) fieldExtraction.requirements = "library";
  if (facts.tuition) fieldExtraction.tuition = "library";

  if (!missingRequired(facts)) {
    return { facts, fieldExtraction, extractionMethod: "library" };
  }

  // Parser wins: AI only fills fields the parser left empty.
  const aiFacts = await ai(text, url);
  let aiUsed = false;
  for (const key of CORE) {
    if (!facts[key] && aiFacts[key]) {
      facts[key] = aiFacts[key];
      fieldExtraction.core = "ai";
      aiUsed = true;
    }
  }
  for (const key of ["deadlines", "requirements"] as const) {
    if (!facts[key].length && aiFacts[key].length) {
      facts[key] = aiFacts[key];
      fieldExtraction[key] = "ai";
      aiUsed = true;
    }
  }
  if (!facts.tuition && aiFacts.tuition) {
    facts.tuition = aiFacts.tuition;
    fieldExtraction.tuition = "ai";
    aiUsed = true;
  }

  return { facts, fieldExtraction, extractionMethod: aiUsed ? "ai" : "library" };
}
