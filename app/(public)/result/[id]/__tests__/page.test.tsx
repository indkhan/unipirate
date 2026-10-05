import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("../result-client", () => ({ ResultAnalytics: () => null, ShareControls: () => null }));
vi.mock("@/lib/db/queries", () => ({
  getPublishedRules: async () => [],
  getResultViewer: async () => "public",
  getCheck: async () => ({
    id: "10000000-0000-4000-8000-000000000001", created_at: "2026-10-02T00:00:00Z",
    answers: { certificateCountry: "pk", targetDegree: "master", nationality: "pk", visaApplicationCountry: "pk", curriculumType: "national", targetField: "cs", intake: null },
    result: { path: "direct", aps: "not_required", testAS: "not_required", dMAT: "not_required", citations: [], unknowns: [], documents: [], stepsDetailed: [] },
  }),
}));

import ResultPage from "../page";

it("recomputes legacy stored verdicts from validated answers and published rules", async () => {
  const html = renderToStaticMarkup(await ResultPage({
    params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" }),
    searchParams: Promise.resolve({}),
  }));
  expect(html).toContain("Your admission route still needs confirmation.");
  expect(html).not.toContain("You can apply directly");
});
