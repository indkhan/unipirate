import { describe, expect, it } from "vitest";
import { parseResearchAuditEvent } from "../research";
import { auditFixture } from "./fixtures/research-audit";
const canonical = auditFixture.row_id;
describe("protected research audit boundary", () => {
  it("uses canonical envelope and immutable actor/time after account/submission deletion", () => {
    const parsed = parseResearchAuditEvent(auditFixture);
    expect(parsed).toMatchObject({ status: "available", canonicalId: canonical, payload: auditFixture.course_reconciliation });
    expect(parsed).not.toHaveProperty("payload.canonical_id");
  });
  it.each(["extra", "missing", "actor", "time", "decisions", "observations", "version", "envelope"])("fails closed for malformed %s without partial trusted data", change => {
    const row = structuredClone(auditFixture) as unknown as { id: string; table_name: string; actor_user_id: string | null; created_at: string; course_reconciliation: Record<string, unknown> & { decisions: unknown[]; observations: { content: string | null }[]; version: { id: string } } };
    if (change === "extra") row.course_reconciliation.canonical_id = canonical;
    if (change === "missing") delete row.course_reconciliation.submitted_course_id;
    if (change === "actor") row.actor_user_id = canonical;
    if (change === "time") row.created_at = "2026-10-08T13:00:00Z";
    if (change === "decisions") row.course_reconciliation.decisions = [];
    if (change === "observations") row.course_reconciliation.observations[0].content = null;
    if (change === "version") row.course_reconciliation.version.id = "forged";
    if (change === "envelope") row.table_name = "rules";
    const result = parseResearchAuditEvent(row);
    expect(result.status).toBe("unavailable"); expect(result).not.toHaveProperty("payload");
  });
  it("never treats plausible caller metadata as a protected envelope", () => {
    const result = parseResearchAuditEvent(auditFixture.course_reconciliation);
    expect(result.status).toBe("unavailable"); expect(result).not.toHaveProperty("payload");
  });
});
