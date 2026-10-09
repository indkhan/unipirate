import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { buildResearchDraft, patchResearchDraft, prepareResearchReview } from "@/lib/courses/research";
import { ReviewedOfferings } from "../reviewed-offerings";
const id = "11111111-1111-4111-8111-111111111111";
it("shows reviewed wording and scope with evidence, while unresolved facts have no verified badge", () => {
  const html = renderToStaticMarkup(<ReviewedOfferings offerings={[{
    intake_term: "winter", intake_year: 2027, applicant_group: "Synthetic Non-EU", facts: [
      { key: "closing", kind: "deadline", status: "verified", verbatim: "Apply by 31 May.", applicability: "Synthetic Non-EU", route: null, deadline_kind: "application_closing", date: null, time: null, timezone: null, evidence: [{ source_url: "https://www.daad.de/synthetic", source_quote: "Apply by 31 May.", retrieved_at: "2026-10-07T12:00:00Z", last_verified_at: "2026-10-07T13:00:00Z", verified_by: id, source_hash: null }] },
      { key: "route", kind: "route", status: "unresolved", verbatim: null, applicability: "Synthetic Non-EU", route: "unresolved", deadline_kind: null, date: null, time: null, timezone: null, evidence: [] },
    ],
  }]} />);
  expect(html).toContain("winter 2027"); expect(html).toContain("Synthetic Non-EU");
  expect(html).toContain("Apply by 31 May."); expect(html).toContain("https://www.daad.de/synthetic");
  expect(html.match(/Reviewed fact/g)).toHaveLength(1); expect(html).toContain("Unresolved");
});

it("publishes selected English only while rejected fee originals never render as assertions or badges", () => {
  const url = "https://www.daad.de/synthetic";
  const raw = buildResearchDraft({ url, name: "Synthetic", university: "Synthetic University", text: "Synthetic paste ".repeat(20) }, [{ url, origin: "web", retrieved_at: "2026-10-07T12:00:00Z", content: "Synthetic Synthetic University Winter 2027 Non-EU applicants English C1. Tuition EUR 999." }], { offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: "Non-EU applicants", scope: { source_url: url, source_quote: "Winter 2027 Non-EU applicants" }, facts: [
    { key: "english", kind: "language", verbatim: "English C1.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: url, source_quote: "English C1." }] },
    { key: "tuition", kind: "fee", verbatim: "Tuition EUR 999.", applicability: "Non-EU applicants", route: null, deadline_kind: null, evidence: [{ source_url: url, source_quote: "Tuition EUR 999." }] },
  ] }] }, []);
  const rejected = patchResearchDraft(raw, { kind: "reject", entries: [{ offering: 0, key: "tuition" }], reason: "Rejected this alleged fee interpretation after source review." });
  const facts = prepareResearchReview(rejected, 0, ["english"], id, "2026-10-07T13:00:00Z");
  const html = renderToStaticMarkup(<ReviewedOfferings offerings={[{ ...raw.offerings[0], facts }]} />);
  expect(html).toContain("English C1."); expect(html).not.toContain("EUR 999"); expect(html.match(/Reviewed fact/g)).toHaveLength(1);
  expect(facts.find(f => f.key === "tuition")).toMatchObject({ status: "unresolved", verbatim: null });
});
