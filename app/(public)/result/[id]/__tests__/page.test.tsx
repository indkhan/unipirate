import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const stored = vi.hoisted(() => ({ answers: null as Record<string, unknown> | null, metadata: null as unknown, result: null as unknown, exact: [] as unknown[], versions: [] as unknown[] }));
afterEach(() => { stored.answers = null; stored.metadata = null; stored.result = null; stored.exact = []; stored.versions = []; });

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("../result-client", () => ({ ResultAnalytics: () => null, ShareControls: () => null }));
vi.mock("@/lib/db/queries", () => ({
  listRuleVersions: async () => stored.versions,
  getRuleVersionsByIds: vi.fn(async () => stored.exact),
  getResultViewer: async () => "public",
  getCheck: async () => ({
    id: "10000000-0000-4000-8000-000000000001", created_at: "2026-10-02T00:00:00Z",
    answers: stored.answers ?? { certificateCountry: "pk", targetDegree: "master", nationality: "pk", visaApplicationCountry: "pk", curriculumType: "national", targetField: "cs", intake: null },
    assessment_metadata: stored.metadata,
    result: stored.result ?? { path: "direct", aps: "not_required", testAS: "not_required", dMAT: "not_required", citations: [], unknowns: [], documents: [], stepsDetailed: [] },
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
  expect(html).toContain("Original assessment provenance unavailable");
  expect(html).toContain("Current reassessment");
});

it.each([undefined, 1] as const)("renders historical Saudi bachelor result with history version %s", async version => {
  stored.answers = {targetDegree: "bachelor", nationality: "in", certificateCountry: "in", visaApplicationCountry: "sa", curriculumType: "national", board: "cbse", schoolGradePercent: 82, jeeAdvanced: false, targetField: "cs", intake: null,
    ...(version === 1 ? {qualificationHistoryVersion: 1, hasPriorUniversityStudy: false} : {})};
  const snapshot = structuredClone(stored.answers);
  const html = renderToStaticMarkup(await ResultPage({params: Promise.resolve({id: "10000000-0000-4000-8000-000000000001"}), searchParams: Promise.resolve({})}));
  expect(html).toContain("Your admission route still needs confirmation.");
  expect(html).toContain("Confirm whether APS for application applies");
  expect(stored.answers).toEqual(snapshot);
});

import {answers as historyAnswers, context, version, raw} from "@/lib/rules/__tests__/assessment-fixtures";
import {buildProfile} from "@/app/(public)/check/steps";
import {evaluateAssessment} from "@/lib/rules/assessment";
import {getRuleVersionsByIds} from "@/lib/db/queries";
const renderPage = async () => renderToStaticMarkup(await ResultPage({params: Promise.resolve({id: "10000000-0000-4000-8000-000000000001"}), searchParams: Promise.resolve({})}));
it("keeps original saved verdict/exact V1 evidence separate from current V2 and reads only referenced IDs", async () => {
 stored.answers = historyAnswers;
 const original = evaluateAssessment(buildProfile(historyAnswers as never), [version(1)], context);
 stored.metadata = original.metadata; stored.result = {...original.result, path: "insufficient"};
 stored.exact = [version(1)]; stored.versions = [version(1), version(2, {raw_snapshot: {...raw, source_quote: " NEW V2 QUOTE "}})];
 const snapshot = JSON.stringify(stored); const html = await renderPage();
 expect(html).toContain("Original assessment"); expect(html).toContain("Current reassessment");
 expect(html).toContain(context.evaluatedAt); expect(html).toContain(version(1).id);
 expect(html).toContain("Policy or assessment changed"); expect(html).toContain("Source or explanation changed");
 expect(getRuleVersionsByIds).toHaveBeenLastCalledWith(expect.anything(), [version(1).id]);
 expect(JSON.stringify(stored)).toBe(snapshot);
});
it.each([null, {}, {formatVersion: 2}])("never upgrades missing or invalid protected authority %j", async metadata => {
 stored.metadata = metadata; stored.answers = {...historyAnswers};
 expect(await renderPage()).toContain("Original assessment provenance unavailable");
});
it("missing exact historical input never substitutes current latest", async () => {
 stored.answers = historyAnswers; const original = evaluateAssessment(buildProfile(historyAnswers as never), [version(1)], context);
 stored.metadata = original.metadata; stored.result = original.result; stored.exact = []; stored.versions = [version(2)];
 expect(await renderPage()).toContain("Original assessment provenance unavailable");
});
it("malformed saved answers display honest unavailable rather than a recalculated history", async () => {
 stored.answers = {}; expect(await renderPage()).toContain("The saved answers are invalid");
});

it("historical scope diagnostics fetch their exact referenced version too", async () => {
 stored.answers = {...historyAnswers, intake: null};
 const diagnostic = version(1, {intake_from: 4053});
 const original = evaluateAssessment(buildProfile(stored.answers as never), [diagnostic], context);
 stored.metadata = original.metadata; stored.result = original.result; stored.exact = [diagnostic];
 const html = await renderPage();
 expect(getRuleVersionsByIds).toHaveBeenLastCalledWith(expect.anything(), [diagnostic.id]);
 expect(html).toContain("missing_intake"); expect(html).toContain(diagnostic.id);
});
