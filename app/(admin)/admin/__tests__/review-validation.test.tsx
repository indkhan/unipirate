import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tables } from "@/lib/db/database.types";
import { buildResearchDraft } from "@/lib/courses/research";

import { CourseQueue } from "../course-queue";
import {
  ResearchFactReview,
  validateReconciliationReason,
} from "../research-review-field";

describe("review validation (local, server unchanged)", () => {
  it("rejects empty, whitespace, and short rationales at the trimmed 20-char boundary", () => {
    expect(validateReconciliationReason("")).toContain("at least 20");
    expect(validateReconciliationReason("   ")).toContain("at least 20");
    expect(validateReconciliationReason("a".repeat(19))).toContain("more characters");
  });

  it("accepts the trimmed 20 and 2000 bounds and rejects 2001", () => {
    expect(validateReconciliationReason("a".repeat(20))).toBeNull();
    expect(validateReconciliationReason(`  ${"a".repeat(20)}  `)).toBeNull();
    expect(validateReconciliationReason("a".repeat(2000))).toBeNull();
    expect(validateReconciliationReason("a".repeat(2001))).toContain("2000");
  });

  it("requires nothing locally for an unselected fact", () => {
    const html = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" />,
    );
    expect(html).toContain('name="accepted"');
    expect(html).toContain('value="0:english"');
    expect(html).not.toContain("required");
    expect(html).not.toContain('role="alert"');
  });

  it("requires reconciliation and a bounded rationale once the fact is selected", () => {
    const html = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted />,
    );
    expect(html).toContain('name="reconciled"');
    expect(html).toContain('value="0:english"');
    expect(html).toContain('name="reconciliation_reason:0:english"');
    expect(html).toContain("required");
    expect(html).toContain('minLength="20"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain('role="alert"');
  });

  it("deselecting removes the local requirement (unchecked renders no required)", () => {
    const selected = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted />,
    );
    const deselected = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" />,
    );
    expect(selected).toContain("required");
    expect(selected).toContain('role="alert"');
    expect(deselected).not.toContain("required");
    expect(deselected).not.toContain('role="alert"');
  });

  it("validates two selected fields independently with distinct server names", () => {
    const html = renderToStaticMarkup(
      <>
        <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted />
        <ResearchFactReview offeringIndex={0} factKey="fees" verbatim="Fees" status="pending" defaultAccepted />
      </>,
    );
    expect(html).toContain("reconciliation_reason:0:english");
    expect(html).toContain("reconciliation_reason:0:fees");
    expect(validateReconciliationReason("a".repeat(20))).toBeNull();
    expect(validateReconciliationReason("short")).not.toBeNull();
  });

  it("keeps existing server field names, values, and attestation in the review form", () => {
    const course = {
      id: "11111111-1111-4111-8111-111111111111",
      review_status: "pending",
      source_url: "https://www.daad.de/example",
      name: "Synthetic",
      field_extraction: {
        research: {
          format: "up-course-01/v1",
          status: "incomplete",
          identity: {
            name: "Synthetic",
            university: "Synthetic",
            source_url: "https://www.daad.de/example",
          },
          observations: [],
          offerings: [],
          conflicts: [],
          issues: [],
        },
      },
    } as unknown as Tables<"courses">;
    const html = renderToStaticMarkup(
      <CourseQueue courses={[course]} definitionsByCourse={new Map()} />,
    );
    expect(html).toContain('name="id"');
    expect(html).toContain('name="attest"');
    expect(html).toContain("Publish reviewed research");
    // No pending fact selected in this queue render, so no per-fact
    // rationale is locally required; only the existing attestation stays required.
    expect(html).not.toContain("reconciliation_reason:");
  });
});

describe("review validation deselect submission semantics", () => {
  // NOTE — coverage limit, stated accurately: renderToStaticMarkup renders
  // initial states only and does not exercise the checkbox/textarea event
  // lifecycle (no jsdom in this repo). These tests verify submitted-control
  // semantics: a disabled control is excluded from form submission and from
  // constraint validation per HTML, so the selected/unselected renders below
  // describe exactly what the browser will (not) send. Root verifies the live
  // select-type-deselect-submit roundtrip in an actual browser.
  const validReason =
    "Compared full captured official sources and confirmed applicability.";

  it("omits the reconciled decision and rationale from submission once deselected", () => {
    const html = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" />,
    );
    // Same server names are rendered so reselecting submits identical keys…
    expect(html).toContain('name="reconciled"');
    expect(html).toContain('value="0:english"');
    expect(html).toContain('name="reconciliation_reason:0:english"');
    // …but disabled, hence excluded from submission and validation.
    expect(html).toContain("disabled");
    expect(html).not.toContain("required");
    expect(html).not.toContain("minLength");
  });

  it("preserves entered rationale text while deselected instead of erasing it", () => {
    const html = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultReason={validReason} />,
    );
    expect(html).toContain(validReason);
    expect(html).toContain("disabled");
    expect(html).not.toContain("required");
    expect(html).not.toContain('role="alert"');
  });

  it("revalidates the preserved reason on reselect: valid stays silent, short alerts", () => {
    const valid = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted defaultReason={validReason} />,
    );
    expect(valid).toContain(validReason);
    expect(valid).not.toContain("disabled");
    expect(valid).not.toContain('role="alert"');
    const short = renderToStaticMarkup(
      <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted defaultReason="short" />,
    );
    expect(short).toContain("short");
    expect(short).toContain('role="alert"');
  });

  it("a short unselected rationale cannot block, independently across fields", () => {
    const html = renderToStaticMarkup(
      <>
        <ResearchFactReview offeringIndex={0} factKey="english" verbatim="English" status="pending" defaultAccepted defaultReason={validReason} />
        <ResearchFactReview offeringIndex={0} factKey="fees" verbatim="Fees" status="pending" defaultReason="short" />
      </>,
    );
    // Selected valid field submits; unselected short field is disabled (not
    // submitted, not validated) while keeping its text for a later reselect.
    expect(html).toContain("reconciliation_reason:0:english");
    expect(html).toContain("reconciliation_reason:0:fees");
    expect(html).toContain("required");
    expect(html).toContain("disabled");
    expect(html).toContain("short");
    expect(html).not.toContain('role="alert"');
  });
});

describe("course unscoped publish browser guard (COURSE01)", () => {
  const url = "https://www.daad.de/synthetic";
  const seed = {
    url,
    name: "Synthetic Computing",
    university: "Synthetic University",
    text: "Synthetic manual paste ".repeat(12),
  };
  const observation = {
    url,
    origin: "web" as const,
    retrieved_at: "2026-10-07T12:00:00Z",
    content:
      "Synthetic Computing Synthetic University Winter 2027 Non-EU applicants IELTS 6.5.",
  };
  const supportedDraft = buildResearchDraft(
    seed,
    [observation],
    {
      offerings: [
        {
          intake_term: "winter",
          intake_year: 2027,
          applicant_group: "Non-EU applicants",
          scope: {
            source_url: url,
            source_quote: "Winter 2027 Non-EU applicants",
          },
          facts: [
            {
              key: "english",
              kind: "language",
              verbatim: "IELTS 6.5.",
              applicability: "Non-EU applicants",
              route: null,
              deadline_kind: null,
              evidence: [{ source_url: url, source_quote: "IELTS 6.5." }],
            },
          ],
        },
      ],
    },
    [],
  );
  const unscopedDraft = buildResearchDraft(
    seed,
    [observation],
    {
      offerings: [
        {
          intake_term: null,
          intake_year: null,
          applicant_group: null,
          scope: null,
          facts: [
            {
              key: "english",
              kind: "language",
              verbatim: "IELTS 6.5.",
              applicability: "Non-EU applicants",
              route: null,
              deadline_kind: null,
              evidence: [{ source_url: url, source_quote: "IELTS 6.5." }],
            },
          ],
        },
      ],
    },
    [],
  );

  function courseFor(id: string, draft: unknown) {
    return {
      id,
      review_status: "pending",
      source_url: url,
      name: "Synthetic Computing",
      field_extraction: { research: draft },
    } as unknown as Tables<"courses">;
  }

  it("disables unscoped draft publication while keeping manual recovery and captured sources", () => {
    expect(unscopedDraft.offerings).toHaveLength(0);
    const html = renderToStaticMarkup(
      <CourseQueue
        courses={[courseFor("11111111-1111-4111-8111-111111111111", unscopedDraft)]}
        definitionsByCourse={new Map()}
      />,
    );
    expect(html).toContain("Publication requires supported effective intake");
    expect(html).toContain("Sourced captures with unknown effective intake");
    expect(html).toContain("Captured sources and manual fallback");
    expect(html).toContain("Manual research recovery");
    expect(html).toContain("Save pending research recovery");
    // Publish is browser-blocked when no supported offering exists; the
    // manual recovery path stays enabled. Match the real disabled
    // attribute (disabled="") rather than the Tailwind disabled: classes.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Publish reviewed research/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save pending research recovery/);
    expect(html).toMatch(/<input(?=[^>]*name="attest")(?=[^>]*disabled="")[^>]*>/);
  });

  it("keeps supported draft publication enabled with attestation", () => {
    expect(supportedDraft.offerings).toHaveLength(1);
    const html = renderToStaticMarkup(
      <CourseQueue
        courses={[courseFor("22222222-2222-4222-8222-222222222222", supportedDraft)]}
        definitionsByCourse={new Map()}
      />,
    );
    expect(html).toContain("Publish reviewed research");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Publish reviewed research/);
    expect(html).toContain('name="attest"');
    expect(html).toMatch(/<input(?=[^>]*name="attest")(?=[^>]*required="")[^>]*>/);
    expect(html).not.toMatch(/<input(?=[^>]*name="attest")(?=[^>]*disabled="")[^>]*>/);
  });
});
