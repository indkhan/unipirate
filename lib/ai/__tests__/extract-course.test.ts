import { describe, expect, it, vi } from "vitest";

import { EMPTY_FACTS } from "@/lib/courses/import";
import { extractCourse } from "../extract-course";

describe("course extraction", () => {
  it("discards AI facts that are not verbatim in the pasted source", async () => {
    const result = await extractCourse("https://example.edu/course", "Computer Science\nExample University\nEnglish\nApply by 15 July", async () => ({
      ...EMPTY_FACTS,
      name: "Computer Science", university: "Example University", language: "English",
      location: "Berlin", degree: "Bachelor of Science", tuition: "Free",
      description: "Invented description", deadlines: ["Apply by 15 July", "31 August"],
      requirements: ["IELTS 7.0"],
    }));
    expect(result.facts).toEqual({ ...EMPTY_FACTS, name: "Computer Science", university: "Example University", language: "English", deadlines: ["Apply by 15 July"] });
  });

  it("keeps parser facts when AI fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const source = "Computer Science\nExample University • Berlin\nDegree\nBachelor of Science";
    const result = await extractCourse("https://example.edu/course", source, async () => { throw new Error("Unavailable"); });
    expect(result.facts.name).toBe("Computer Science");
    expect(result.extractionMethod).toBe("library");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
