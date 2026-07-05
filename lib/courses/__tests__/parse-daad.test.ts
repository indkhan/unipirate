import { describe, expect, it } from "vitest";

import { extractCourse } from "@/lib/ai/extract-course";
import { EMPTY_FACTS, missingRequired } from "../import";
import { parseDaadText } from "../parse-daad";
import { DAAD_PAGE_TEXT, GARBAGE_TEXT, NON_DAAD_PAGE_TEXT } from "./fixtures";

describe("parseDaadText", () => {
  const facts = parseDaadText(DAAD_PAGE_TEXT);

  it("finds name and university from the heading pair", () => {
    expect(facts.name).toBe("Computer Science – Master of Science");
    expect(facts.university).toBe("Leibniz University Hannover");
  });

  it("captures overview fields verbatim", () => {
    expect(facts.degree).toBe("Master of Science");
    expect(facts.language).toBe("German, English");
    expect(facts.tuition).toBe("None");
  });

  it("keeps deadlines verbatim, one statement per line", () => {
    expect(facts.deadlines).toContain(
      "15 April to 31 May of the year for the winter semester",
    );
    expect(facts.deadlines).toContain("Non-EU students:");
    expect(facts.deadlines).toHaveLength(6);
  });

  it("collects academic and language requirements", () => {
    expect(facts.requirements).toEqual([
      "Bachelor's degree in computer science or a closely related field",
      "Proof of at least 24 credit points in theoretical computer science",
      "IELTS 6.5 or TOEFL iBT 90 for the English track",
      "DSH-2 or TestDaF 4 for the German track",
    ]);
    expect(missingRequired(facts)).toBe(false);
  });

  it("handles the city bulleted on its own line", () => {
    const variant = DAAD_PAGE_TEXT.replace(
      "Leibniz University Hannover • Hannover",
      "Leibniz University Hannover\n• Hannover",
    );
    const parsed = parseDaadText(variant);
    expect(parsed.name).toBe("Computer Science – Master of Science");
    expect(parsed.university).toBe("Leibniz University Hannover");
  });

  it("finds nothing on non-DAAD or garbage text", () => {
    expect(missingRequired(parseDaadText(NON_DAAD_PAGE_TEXT))).toBe(true);
    expect(parseDaadText(GARBAGE_TEXT)).toEqual(EMPTY_FACTS);
  });
});

describe("extractCourse", () => {
  it("skips AI when the parser fills required fields", async () => {
    const ai = () => Promise.reject(new Error("AI must not be called"));
    const result = await extractCourse("https://x.de/c", DAAD_PAGE_TEXT, ai);
    expect(result.extractionMethod).toBe("library");
    expect(result.fieldExtraction).toEqual({
      core: "library",
      deadlines: "library",
      requirements: "library",
      tuition: "library",
    });
  });

  it("uses AI only for missing fields and records it per group", async () => {
    const ai = async () => ({
      ...EMPTY_FACTS,
      name: "M.Sc. Data Wizardry",
      university: "TU Example University",
      degree: "Master of Science",
      language: "English",
      deadlines: ["Apply by the end of May each year via our portal."],
      tuition: "Fees: none for EU students.",
    });
    const result = await extractCourse("https://x.de/c", NON_DAAD_PAGE_TEXT, ai);
    expect(result.extractionMethod).toBe("ai");
    expect(result.facts.name).toBe("M.Sc. Data Wizardry");
    expect(result.facts.deadlines).toEqual([
      "Apply by the end of May each year via our portal.",
    ]);
    expect(result.fieldExtraction).toEqual({
      core: "ai",
      deadlines: "ai",
      tuition: "ai",
    });
  });

  it("degrades to honest gaps when AI finds nothing", async () => {
    const ai = async () => EMPTY_FACTS;
    const result = await extractCourse("https://x.de/c", GARBAGE_TEXT, ai);
    expect(result.facts).toEqual(EMPTY_FACTS);
    expect(result.extractionMethod).toBe("library");
    expect(result.fieldExtraction).toEqual({});
  });
});
