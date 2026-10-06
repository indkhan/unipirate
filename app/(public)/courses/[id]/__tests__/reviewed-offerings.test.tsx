import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
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
