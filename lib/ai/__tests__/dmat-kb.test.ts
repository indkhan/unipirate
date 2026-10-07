import { expect, it } from "vitest";
import { ruleToChunk } from "../kb";
import { ruleData } from "@/scripts/rules.bootstrap";
import { kbSnippets } from "@/scripts/kb.snippets";

it("labels the distinct June dispatch and registration facts with their units", () => {
  for (const id of ["registration-before", "dispatch-before"]) {
    const rule = ruleData.find(r => r.id === `dmat-reviewed-${id}`)!;
    const chunk = ruleToChunk({ ...rule, slug: rule.id, country_code: "in", last_verified_at: rule.last_verified_at ?? null });
    expect(chunk.content).toContain("YYYYMMDD; relevant procedure only");
    expect(chunk.content).toContain(`Official source says: "${rule.source_quote}"`);
    expect(chunk.last_verified_at).toBe("2026-10-07T00:00:00Z");
  }
});
it("does not render a legacy possession rule as a current exemption", () => {
  const rule = ruleData.find(r => r.id === "dmat-india-existing-aps-exempt")!;
  const chunk = ruleToChunk({ ...rule, slug: rule.id, country_code: "in", last_verified_at: rule.last_verified_at ?? null });
  expect(chunk.content).not.toContain("dMAT: not required");
  expect(chunk.content).toContain("procedure applicability unverified");
  expect(chunk.source_url).toBe(rule.source_url);
});
it("keeps the curated dMAT scope bounded and the later-submission notice explicit", () => {
  const snippet = kbSnippets.find(s => s.slug === "snippet-dmat-details")!;
  expect(snippet.content).toContain("completed procedure");
  expect(snippet.content).toContain("registration");
  expect(snippet.content).toContain("dispatch");
  expect(snippet.content).toContain("not automatically");
  expect(snippet.content).toContain("before the dMAT certificate");
  expect(snippet.last_verified_at).toBe("2026-10-07T00:00:00Z");
});
