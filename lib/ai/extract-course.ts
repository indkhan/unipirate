import { parseDaadText } from "@/lib/courses/parse-daad";
import { buildResearchDraft, ResearchSeedSchema, type ResearchDraft, type ResearchSeed } from "@/lib/courses/research";
import type { CourseFacts, FieldExtraction } from "@/lib/courses/import";
import { researchCourse } from "./research-course";
export { COURSE_EXTRACTION_MODEL } from "./research-course";

export type ExtractedCourse = {
  facts: CourseFacts; fieldExtraction: FieldExtraction; extractionMethod: "library" | "ai";
  research: ResearchDraft;
};
export async function extractCourse(url: string, text: string,
  research: (seed: ResearchSeed) => Promise<ResearchDraft> = researchCourse,
  identity?: { name: string; university: string },
): Promise<ExtractedCourse> {
  // Parser provides manual fallback and identity seed, never decides whether
  // multi-source research runs or suppresses conflicting retrieved assertions.
  const facts = parseDaadText(text);
  const seed = ResearchSeedSchema.parse({ url, text, name: identity?.name ?? facts.name, university: identity?.university ?? facts.university });
  const fieldExtraction: FieldExtraction = {};
  if (facts.name || facts.university) fieldExtraction.core = "library";
  if (facts.description) fieldExtraction.description = "library";
  if (facts.deadlines.length) fieldExtraction.deadlines = "library";
  if (facts.requirements.length) fieldExtraction.requirements = "library";
  if (facts.tuition) fieldExtraction.tuition = "library";
  // Identity input is a draft catalogue label, not sourced evidence.
  facts.name = seed.name; facts.university = seed.university;
  let draft: ResearchDraft;
  try { draft = await research(seed); }
  catch { draft = buildResearchDraft(seed, [{ url, content: text.slice(0, 20_000), origin: "paste", retrieved_at: new Date().toISOString() }], undefined, ["Research failed; paste/manual review retained."]); }
  return { facts, fieldExtraction, extractionMethod: draft.observations.some(o => o.origin === "web") ? "ai" : "library", research: draft };
}
