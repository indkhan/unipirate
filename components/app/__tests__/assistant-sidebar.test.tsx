import { renderToStaticMarkup } from "react-dom/server";
import type { UIMessage } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { selectedKnowledge } from "@/lib/ai/versioned-kb";
import { context, raw, version } from "@/lib/rules/__tests__/assessment-fixtures";

const chat = vi.hoisted(() => ({ messages: [] as UIMessage[], openNext: false }));
vi.mock("@ai-sdk/react", () => ({ useChat: () => ({ messages: chat.messages, status: "ready", sendMessage: vi.fn() }) }));
vi.mock("@/app/(app)/dashboard/actions", () => ({ reportAssistantAnswer: vi.fn() }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (chat.openNext) { chat.openNext = false; return actual.useState(true); }
    return actual.useState(initial);
  } };
});
import { AssistantSidebar } from "../assistant-sidebar";

function response(id: string, output: unknown, slug = "synthetic"): UIMessage {
  return { id, role: "assistant", parts: [
    { type: "tool-search_rules", toolCallId: id, state: "output-available", input: { query: "synthetic" }, output },
    { type: "text", text: "Source-backed answer [[rule:" + slug + "]]" },
  ] };
}
function render(messages: UIMessage[]) {
  chat.messages = messages; chat.openNext = true;
  return renderToStaticMarkup(<AssistantSidebar initialUsed={0} />);
}
const evidence = () => selectedKnowledge([version(1)], { evaluatedAt: context.evaluatedAt });
beforeEach(() => { chat.messages = []; });
it("renders the selected tool envelope's exact source link and literal verification date", () => {
  const html = render([response("first", evidence())]);
  expect(html).toContain('href="' + raw.source_url + '"');
  expect(html).toContain(raw.last_verified_at);
  expect(html).toContain('Verified');
});
it.each([null, [], { chunks: [{ slug: "synthetic", source_url: "javascript:alert(1)" }], diagnostics: [] }, { chunks: [], diagnostics: [] }])("malformed or unresolved evidence %j is unavailable without a verified stamp", output => {
  const html = render([response("missing", output)]);
  expect(html).toContain("Rule source unavailable");
  expect(html).not.toContain('>Verified<');
});
it("does not reuse evidence from an earlier response for an unresolved later citation", () => {
  const html = render([response("first", evidence()), response("second", { chunks: [], diagnostics: [] })]);
  expect(html.match(/>Verified</g)).toHaveLength(1);
  expect(html).toContain("Rule source unavailable");
});
it("retains each response's own immutable version evidence", () => {
  const secondRaw = { ...raw, source_url: "https://example.invalid/new", last_verified_at: "2026-02-01T00:00:00Z" };
  const second = selectedKnowledge([version(2, { raw_snapshot: secondRaw })], { evaluatedAt: context.evaluatedAt });
  const html = render([response("first", evidence()), response("second", second)]);
  expect(html).toContain('href="' + raw.source_url + '"');
  expect(html).toContain(raw.last_verified_at);
  expect(html).toContain('href="' + secondRaw.source_url + '"');
  expect(html).toContain(secondRaw.last_verified_at);
});
it("ambiguous selected versions for one slug are unavailable", () => {
  const chunk = evidence().chunks[0];
  const html = render([response("ambiguous", { chunks: [chunk, { ...chunk, versionId: "00000000-0000-4000-8000-000000000099" }], diagnostics: [] })]);
  expect(html).toContain("Rule source unavailable");
  expect(html).not.toContain('>Verified<');
});

it.each(["missing", "beta", "invalid-date", "invalid-url", "invalid-id", "invalid-diagnostic"])("does not verify %s evidence", kind => {
 const output = evidence();
 if (kind === "missing") output.chunks[0].last_verified_at = null;
 if (kind === "beta") output.chunks[0].status = "beta";
 if (kind === "invalid-date") output.chunks[0].last_verified_at = "2026-02-30T00:00:00Z";
 if (kind === "invalid-url") output.chunks[0].source_url = "javascript:alert(1)";
 if (kind === "invalid-id") output.chunks[0].versionId = "latest";
 const malformed = kind === "invalid-diagnostic" ? { ...output, diagnostics: [{ reason: "invented" }] } : output;
 const html = render([response("boundary", malformed)]);
 expect(html).not.toContain('>Verified<');
 expect(html).toContain(kind === "missing" || kind === "beta" ? "Rule verification unavailable" : "Rule source unavailable");
});
it("an unknown marker stays unknown even when a response retrieves valid evidence", () => {
 const message = response("unknown", evidence());
 message.parts[1] = { type: "text", text: "Cannot confirm. [[unknown]]" };
 const html = render([message]);
 expect(html).toContain("Not in our verified rules");
 expect(html).not.toContain('>Verified<');
});
it("an unknown slug never receives another selected rule's evidence", () => {
 const html = render([response("unknown-slug", evidence(), "other-slug")]);
 expect(html).toContain("Rule source unavailable");
 expect(html).not.toContain('>Verified<');
});
it("conflicting tool calls in the same response cannot authorize one slug", () => {
 const message = response("multiple", evidence());
 const conflicting = evidence(); conflicting.chunks[0].source_url = "https://example.invalid/other";
 message.parts.push(response("conflicting-call", conflicting).parts[0]);
 const html = render([message]);
 expect(html).toContain("Rule source unavailable");
 expect(html).not.toContain('>Verified<');
});
