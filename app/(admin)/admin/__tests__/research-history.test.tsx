import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Json, Tables } from "@/lib/db/database.types";
import { parseResearchAuditEvent } from "@/lib/courses/research";
import { auditFixture } from "@/lib/courses/__tests__/fixtures/research-audit";
import { AuditLog } from "../audit-log";
import { CourseQueue } from "../course-queue";
import { ResearchHistory, UntrustedLegacyReconciliation } from "../research-history";

describe("admin research history rendering (no DB/auth claims)", () => {
  it("renders complete protected capture/version/reviewer after source row and actor deletion", () => {
    const record = parseResearchAuditEvent(auditFixture);
    const html = renderToStaticMarkup(<AuditLog events={[{ ...auditFixture, old_status: null, new_status: null, programme_correction: null } as unknown as Tables<"admin_audit_events">]} researchEvents={[record]} />);
    expect(html).toContain("Protected research reconciliation history");
    expect(html).toContain(auditFixture.course_reconciliation.observations[0].content);
    expect(html).toContain(auditFixture.course_reconciliation.reviewed_by);
    expect(html).toContain(auditFixture.course_reconciliation.reviewed_at);
    expect(html).toContain("submitted course"); expect(html).toContain("immutable version");
    expect(html).not.toContain("system");
  });
  it("makes malformed protected history explicitly unavailable without partial reviewer claims", () => {
    const invalid = { ...auditFixture, course_reconciliation: { ...auditFixture.course_reconciliation, version: null } };
    const record = parseResearchAuditEvent(invalid);
    const html = renderToStaticMarkup(<ResearchHistory records={[record]} />);
    expect(html).toContain("history unavailable"); expect(html).not.toContain("reviewed by"); expect(html).not.toContain("Literal complete");
  });
  it("labels a plausible editable forgery separately and never calls it protected history", () => {
    const html = renderToStaticMarkup(<UntrustedLegacyReconciliation value={[auditFixture.course_reconciliation]} />);
    expect(html).toContain("Untrusted legacy reconciliation data"); expect(html).toContain("caller-editable metadata");
    expect(html).not.toContain("Protected research reconciliation history"); expect(html).not.toContain("reviewed by");
  });
  it("shows protected records and untrusted legacy data in the existing course review queue", () => {
    const course = { id: auditFixture.row_id, review_status: "pending", source_url: "https://www.daad.de/synthetic", name: "Synthetic Computing", field_extraction: { research_reconciliations: [auditFixture.course_reconciliation as Json] }, requirements: [], deadlines: [] } as unknown as Tables<"courses">;
    const html = renderToStaticMarkup(<CourseQueue courses={[course]} definitionsByCourse={new Map()} researchHistoryByCourse={new Map([[course.id, [parseResearchAuditEvent(auditFixture)]]])} />);
    expect(html).toContain("Protected research reconciliation history"); expect(html).toContain("Untrusted legacy reconciliation data");
  });
  it("preserves generic status-event rendering", () => {
    const event = { id: auditFixture.id, table_name: "rules", row_id: auditFixture.row_id, created_at: auditFixture.created_at, old_status: "draft", new_status: "verified", action: "update", actor_user_id: null, course_reconciliation: null, programme_correction: null } as Tables<"admin_audit_events">;
    const html = renderToStaticMarkup(<AuditLog events={[event]} />);
    expect(html).toContain("draft"); expect(html).toContain("verified"); expect(html).toContain("system"); expect(html).not.toContain("Protected research reconciliation history");
  });
});
