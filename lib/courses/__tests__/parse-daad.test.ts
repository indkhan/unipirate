import { describe, expect, it } from "vitest";

import { extractCourse } from "@/lib/ai/extract-course";
import { EMPTY_FACTS } from "../import";
import { parseDaadText } from "../parse-daad";
import { DAAD_PAGE_TEXT, GARBAGE_TEXT, NON_DAAD_PAGE_TEXT } from "./fixtures";

describe("parseDaadText", () => {
  it("reads current DAAD period, tuition and language labels without footer leakage", () => {
    const parsed = parseDaadText(`Data Science
RWTH Aachen University • Aachen
Application periods
Application periods differ for EU and non-EU students.
More information on application periods
Please find more details on this website.
Tuition fees per semester
None
Semester contribution
Approx. 360 EUR
Academic admission requirements
A Bachelor's degree in computer science, mathematics, physics or a closely related area
German language skills
No minimum language level required
English language skills
B2 required, please provide an official language certificate, e.g.:
IELTS Academic: 5.5
Language requirements exemptions
Please find details on the course website.
Submit application via
Please check this website.
Description/content
Data Science deals with the extraction of knowledge and usable information from data.
Contact
RWTH Aachen University
Imprint`);
    expect(parsed.deadlines).toEqual(["Application periods differ for EU and non-EU students."]);
    expect(parsed.tuition).toBe("None");
    expect(parsed.requirements).toEqual([
      "A Bachelor's degree in computer science, mathematics, physics or a closely related area",
      "No minimum language level required",
      "B2 required, please provide an official language certificate, e.g.:",
      "IELTS Academic: 5.5",
      "Please find details on the course website.",
    ]);
    expect(parsed.description).toBe("Data Science deals with the extraction of knowledge and usable information from data.");
  });

  it("preserves long requirement and deadline sections instead of silently truncating them", () => {
    const requirements = Array.from({ length: 20 }, (_, i) => `Requirement ${i + 1}`);
    const deadlines = Array.from({ length: 12 }, (_, i) => `Deadline statement ${i + 1}`);
    const parsed = parseDaadText(`Academic admission requirements\n${requirements.join("\n")}\nApplication deadline\n${deadlines.join("\n")}\nContact\nContact details`);
    expect(parsed.requirements).toEqual(requirements);
    expect(parsed.deadlines).toEqual(deadlines);
  });

  const facts = parseDaadText(DAAD_PAGE_TEXT);

  it("finds name and university from the heading pair", () => {
    expect(facts.name).toBe("Computer Science – Master of Science");
    expect(facts.university).toBe("Leibniz University Hannover");
  });

  it("captures overview fields verbatim", () => {
    expect(facts.location).toBe("Hannover");
    expect(facts.degree).toBe("Master of Science");
    expect(facts.language).toBe("German, English");
    expect(facts.tuition).toBe("None");
  });

  it("captures the DAAD description/content section verbatim", () => {
    expect(facts.description).toBe(
      "The Master's programme in Computer Science is a research-oriented degree.",
    );
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
    expect(parseDaadText(NON_DAAD_PAGE_TEXT)).toEqual(EMPTY_FACTS);
    expect(parseDaadText(GARBAGE_TEXT)).toEqual(EMPTY_FACTS);
  });
});

describe("extractCourse manual recovery", () => {
  it("retains parsed facts when research is unavailable even for a complete paste", async () => {
    const ai = () => Promise.reject(new Error("Synthetic research unavailable"));
    const result = await extractCourse("https://x.de/c", DAAD_PAGE_TEXT, ai);
    expect(result.extractionMethod).toBe("library");
    expect(result.fieldExtraction).toEqual({
      core: "library",
      description: "library",
      deadlines: "library",
      requirements: "library",
      tuition: "library",
    });
  });

  it("retains manual identity and pasted source when university-page research fails", async () => {
    const research = async () => { throw new Error("Synthetic provider failure"); };
    const result = await extractCourse("https://x.de/c", NON_DAAD_PAGE_TEXT, research, { name: "M.Sc. Data Wizardry", university: "TU Example University" });
    expect(result.extractionMethod).toBe("library");
    expect(result.facts.name).toBe("M.Sc. Data Wizardry");
    expect(result.research.status).toBe("incomplete");
    expect(result.research.observations[0].content).toBe(NON_DAAD_PAGE_TEXT);
  });

  it("rejects missing identity rather than inventing catalogue labels", async () => {
    await expect(extractCourse("https://x.de/c", GARBAGE_TEXT, async () => { throw new Error("must not call"); })).rejects.toThrow();
  });
});
