import { describe, expect, it } from "vitest";

import { buildSystemPrompt, CHAT_MODEL } from "../assistant";
import { COURSE_EXTRACTION_MODEL } from "../extract-course";
import { parseMarkers, stripMarkers } from "../markers";

describe("buildSystemPrompt", () => {
  it("requires India coverage to come from retrieved rules", () => {
    const prompt = buildSystemPrompt("in");
    expect(prompt).not.toContain("India rules are fully verified");
    expect(prompt).toContain("Coverage and verification status come only from retrieved rules");
    expect(prompt).not.toContain("BETA");
  });

  it("does not assume verification status from a country", () => {
    expect(buildSystemPrompt("pk")).toContain("country is Pakistan");
    expect(buildSystemPrompt("sa")).toContain("country is Saudi Arabia");
    expect(buildSystemPrompt("pk")).not.toContain("rules are BETA");
    expect(buildSystemPrompt("sa")).not.toContain("rules are BETA");
  });

  it("treats unknown or missing countries as uncovered", () => {
    for (const code of [null, "de", "us"]) {
      expect(buildSystemPrompt(code)).toContain("not covered by our verified rules");
    }
  });

  it("always carries the strict-source contract", () => {
    const prompt = buildSystemPrompt("in");
    expect(prompt).toContain("[[rule:slug]]");
    expect(prompt).toContain("[[web:url]]");
    expect(prompt).toContain("[[unknown]]");
    expect(prompt).toContain("Refusing to guess is success");
  });

  it("contains no hard-coded financial claims or date reformatting instructions", () => {
    const prompt = buildSystemPrompt("in");
    expect(prompt).not.toContain("11,904");
    expect(prompt).not.toContain("Dates as DD MMM YYYY");
    expect(prompt).toContain("Quote dates, fees, amounts, and requirements verbatim");
  });
});

describe("model configuration", () => {
  it("uses the Nemotron model for chat and course extraction", () => {
    expect(CHAT_MODEL).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(COURSE_EXTRACTION_MODEL).toBe("nvidia/nemotron-3-super-120b-a12b:free");
  });
});

describe("parseMarkers", () => {
  it("extracts rule and web citations, deduped, in order", () => {
    const { citations, unknown } = parseMarkers(
      "APS is required [[rule:in-aps-required]]. Also [[rule:in-aps-required]] " +
        "and forums say waits are long [[web:https://example.com/a?b=1]].",
    );
    expect(citations).toEqual([
      { type: "rule", ref: "in-aps-required" },
      { type: "web", ref: "https://example.com/a?b=1" },
    ]);
    expect(unknown).toBe(false);
  });

  it("detects the unknown marker", () => {
    expect(parseMarkers("We can't confirm this. [[unknown]]").unknown).toBe(true);
  });

  it("detects unknown consistently across repeated calls (no regex state)", () => {
    const text = "[[unknown]] not covered.";
    for (let i = 0; i < 4; i++) {
      expect(parseMarkers(text).unknown).toBe(true);
    }
  });

  it("finds nothing in marker-free text", () => {
    expect(parseMarkers("Hello there.")).toEqual({
      citations: [],
      unknown: false,
    });
  });

  it("ignores malformed markers", () => {
    const { citations } = parseMarkers(
      "[[rule:]] [[rule:UPPER]] [[web:not-a-url]] [[rule:ok-slug]]",
    );
    expect(citations).toEqual([{ type: "rule", ref: "ok-slug" }]);
  });
});

describe("stripMarkers", () => {
  it("removes markers and tidies whitespace", () => {
    expect(
      stripMarkers(
        "APS is required [[rule:in-aps-required]]. We can't confirm the rest. [[unknown]]",
      ),
    ).toBe("APS is required. We can't confirm the rest.");
  });

  it("keeps multi-line structure", () => {
    expect(stripMarkers("Line one [[rule:a-b]].\nLine two.")).toBe(
      "Line one.\nLine two.",
    );
  });
});
