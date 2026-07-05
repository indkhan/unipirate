import { describe, expect, it } from "vitest";

import {
  CourseFactsSchema,
  EMPTY_FACTS,
  missingRequired,
  normalizeUrl,
} from "../import";

describe("normalizeUrl", () => {
  it("strips hash, tracking params, and trailing slash", () => {
    expect(
      normalizeUrl(
        "https://WWW2.DAAD.de/deutschland/detail/3736/?utm_source=x&fbclid=y#overview",
      ),
    ).toBe("https://www2.daad.de/deutschland/detail/3736");
  });

  it("keeps meaningful query params", () => {
    expect(normalizeUrl("https://uni.de/course?id=42&utm_medium=mail")).toBe(
      "https://uni.de/course?id=42",
    );
  });

  it("normalizes a bare host to a single slash path", () => {
    expect(normalizeUrl("https://uni.de/")).toBe("https://uni.de/");
  });

  it("throws on garbage", () => {
    expect(() => normalizeUrl("not a url")).toThrow();
  });
});

describe("CourseFactsSchema", () => {
  it("accepts the empty facts shape", () => {
    expect(CourseFactsSchema.parse(EMPTY_FACTS)).toEqual(EMPTY_FACTS);
  });

  it("rejects empty-string values", () => {
    expect(() => CourseFactsSchema.parse({ ...EMPTY_FACTS, name: "" })).toThrow();
    expect(() =>
      CourseFactsSchema.parse({ ...EMPTY_FACTS, deadlines: [""] }),
    ).toThrow();
  });
});

describe("missingRequired", () => {
  const full = {
    ...EMPTY_FACTS,
    name: "MSc CS",
    university: "Uni Freiburg",
    degree: "Master of Science",
    language: "English",
    deadlines: ["15 April to 31 May"],
  };

  it("is false when all required fields exist", () => {
    expect(missingRequired(full)).toBe(false);
  });

  it("is true when any required field is missing", () => {
    expect(missingRequired({ ...full, language: null })).toBe(true);
    expect(missingRequired({ ...full, deadlines: [] })).toBe(true);
  });
});
