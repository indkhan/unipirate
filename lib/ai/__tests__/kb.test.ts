import { describe, expect, it } from "vitest";

import { ruleData } from "../../../scripts/rules.bootstrap";
import { ruleToChunk, type KbRule } from "../kb";

const bySlug = (slug: string): KbRule => {
  const rule = ruleData.find((r) => r.id === slug);
  if (!rule) throw new Error(`fixture rule ${slug} not found`);
  return {
    slug: rule.id,
    conditions: rule.conditions as KbRule["conditions"],
    outcomes: rule.outcomes as KbRule["outcomes"],
    source_url: rule.source_url,
    source_quote: rule.source_quote,
    last_verified_at: rule.last_verified_at ?? null,
    country_code: rule.country,
  };
};

describe("ruleToChunk", () => {
  it("renders conditions, outcomes, and the verbatim source quote", () => {
    const chunk = ruleToChunk(bySlug("in-school-studienkolleg"));
    expect(chunk.slug).toBe("in-school-studienkolleg");
    expect(chunk.content).toContain("Applies when:");
    expect(chunk.content).toContain("school board is one of cbse, cisce, state_board");
    expect(chunk.content).toContain("target degree is bachelor");
    expect(chunk.content).toContain(
      "Admission path: Studienkolleg (foundation year) required before admission.",
    );
    expect(chunk.content).toContain('Official source says: "Class 12 from Indian boards');
    expect(chunk.source_url).toContain("daad.in");
    expect(chunk.country_code).toBe("in");
  });

  it("renders intake_index conditions as human semesters", () => {
    const chunk = ruleToChunk(bySlug("in-school-studienkolleg-ws2026"));
    // WS_2026_27 = 2026*2+1 → "winter 2026/27"
    expect(chunk.content).toContain("intake semester is from winter 2026/27");
    expect(chunk.content).toContain("Class 12 percentage is at least 70");
    expect(chunk.content).not.toContain("4053");
  });

  it("renders YYYYMMDD date facts as readable dates", () => {
    const dated = ruleData.find((r) =>
      Object.keys(r.conditions).some((k) => k.endsWith("_day")),
    );
    if (!dated) return; // no dated rules in fixture — nothing to assert
    const chunk = ruleToChunk(bySlug(dated.id));
    expect(chunk.content).toMatch(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
    expect(chunk.content).not.toMatch(/20\d{6}/);
  });

  it("every published fixture rule produces a non-empty cited chunk", () => {
    for (const rule of ruleData) {
      const chunk = ruleToChunk(bySlug(rule.id));
      expect(chunk.content.length).toBeGreaterThan(40);
      expect(chunk.content).toContain("Official source says:");
      expect(chunk.source_url).toMatch(/^https:\/\//);
    }
  });
});
