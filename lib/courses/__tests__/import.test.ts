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
        "https://UNI.example.DE/courses/detail-page/?utm_source=x&fbclid=y#overview",
      ),
    ).toBe("https://uni.example.de/courses/detail-page");
  });

  const canonical =
    "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/6296";

  it("canonicalizes DAAD detail URLs by their numeric id", () => {
    expect(normalizeUrl(`${canonical}/`)).toBe(canonical);
    // German language variant of the same course
    expect(
      normalizeUrl(
        "https://www2.daad.de/deutschland/studienangebote/international-programmes/de/detail/6296/",
      ),
    ).toBe(canonical);
    // uppercase host, other subdomain, query/hash noise
    expect(
      normalizeUrl("https://WWW.DAAD.de/en/detail/6296?utm_source=x#tab"),
    ).toBe(canonical);
  });

  it("leaves non-detail DAAD URLs to generic normalization", () => {
    expect(normalizeUrl("https://www2.daad.de/deutschland/studienangebote/")).toBe(
      "https://www2.daad.de/deutschland/studienangebote",
    );
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
