import { describe, expect, it, vi } from "vitest";
import { extractCourse } from "../extract-course";
import { DAAD_PAGE_TEXT } from "@/lib/courses/__tests__/fixtures";
import { buildResearchDraft, type ResearchSeed } from "@/lib/courses/research";

describe("course extraction", () => {
  it("starts research even when the pasted page parses completely", async () => {
    const research = vi.fn(async (seed: ResearchSeed) => buildResearchDraft(seed, [], undefined, ["Synthetic unavailable web"]));
    const result = await extractCourse("https://www2.daad.de/course", DAAD_PAGE_TEXT, research);
    expect(research).toHaveBeenCalledOnce();
    expect(research.mock.calls[0][0]).toMatchObject({ url: "https://www2.daad.de/course", text: DAAD_PAGE_TEXT, university: "Leibniz University Hannover" });
    expect(result.facts.deadlines.length).toBeGreaterThan(0);
    expect(result.research.status).toBe("incomplete");
    expect(result.extractionMethod).toBe("library");
  });
  it("uses explicit programme identity for a manual paste, without claiming verification", async () => {
    const research = vi.fn(async (seed: ResearchSeed) => buildResearchDraft(seed, [], undefined, []));
    const result = await extractCourse("https://uni-example.de/course", "Manual source content ".repeat(15), research, { name: "Synthetic Course", university: "Synthetic University" });
    expect(result.facts.name).toBe("Synthetic Course");
    expect(result.research.offerings).toEqual([]);
  });
});
