import { describe, expect, it } from "vitest";
import { guardAssistantAnswer, ASSISTANT_FALLBACK, type AssistantEvidence } from "../response-guard";
import { projectVersionedKbMatches } from "../versioned-kb";
import { context, version } from "@/lib/rules/__tests__/assessment-fixtures";

const envelope = projectVersionedKbMatches([], [version(1)], { evaluatedAt: context.evaluatedAt });
const rule: AssistantEvidence = { toolName: "search_rules", output: envelope };
const web: AssistantEvidence = { toolName: "web_search", output: { unverified: true, results: [
  { title: "Synthetic source", url: "https://www.daad.de/exact?x=1", content: "Synthetic quote" },
] } };

describe("completed answer marker authorization", () => {
  it.each([
    ["I cannot confirm. [[unknown]]", []],
    ["Synthetic claim. [[rule:synthetic]]", [rule]],
    ["Unconfirmed synthetic claim. [[web:https://www.daad.de/exact?x=1]]", [web]],
    ["Mixed. [[rule:synthetic]] [[unknown]] [[web:https://www.daad.de/exact?x=1]]", [rule, web]],
  ] as const)("preserves valid text byte-for-byte: %s", (text, evidence) => {
    expect(guardAssistantAnswer(text, evidence)).toBe(text);
  });
  it.each([
    "", "   ", "Raw fact: 8400 INR", "[[rule:]]", "[[web:bad]]", "[[unknown",
    "[[UNKNOWN]]", "[[unknown]] [[rule:UPPER]]", "[[unknown]] [[rule:forged]]",
    "[[web:https://www.daad.de/other]]", "[[rule:synthetic]]",
  ])("replaces absent/malformed/unauthorized markers without repeating raw text: %s", text => {
    expect(guardAssistantAnswer(text, [])).toBe(ASSISTANT_FALLBACK);
  });
  it("does not authorize from personal history or a provider source", () => {
    for (const toolName of ["get_user_context", "source", "old_assistant"]) {
      expect(guardAssistantAnswer("[[rule:synthetic]]", [{ toolName, output: envelope }])).toBe(ASSISTANT_FALLBACK);
      expect(guardAssistantAnswer("[[web:https://www.daad.de/exact?x=1]]", [{ toolName, output: web.output }])).toBe(ASSISTANT_FALLBACK);
    }
  });
  it("malformed rule envelopes invalidate rule authorization across earlier results", () => {
    expect(guardAssistantAnswer("[[rule:synthetic]]", [rule, { toolName: "search_rules", output: { chunks: envelope.chunks } }])).toBe(ASSISTANT_FALLBACK);
  });
  it("conflicting versions or source records cannot authorize the same slug", () => {
    for (const change of [{ versionId: version(2).id }, { content: "Conflicting text" }]) {
      const conflict = { toolName: "search_rules", output: { ...envelope, chunks: [{ ...envelope.chunks[0], ...change }] } };
      expect(guardAssistantAnswer("[[rule:synthetic]]", [rule, conflict])).toBe(ASSISTANT_FALLBACK);
    }
    expect(guardAssistantAnswer("[[rule:synthetic]]", [rule, rule])).toBe("[[rule:synthetic]]");
  });
  it("malformed or conflicting web results authorize nothing for their URL", () => {
    const text = "[[web:https://www.daad.de/exact?x=1]]";
    expect(guardAssistantAnswer(text, [web, { toolName: "web_search", output: { unverified: false, results: [] } }])).toBe(ASSISTANT_FALLBACK);
    const conflict = { toolName: "web_search", output: { unverified: true, results: [{ title: "Other", url: "https://www.daad.de/exact?x=1", content: "Other" }] } };
    expect(guardAssistantAnswer(text, [web, conflict])).toBe(ASSISTANT_FALLBACK);
    expect(guardAssistantAnswer(text, [web, web])).toBe(text);
  });
  it("unknown does not override an unauthorized citation or malformed marker", () => {
    expect(guardAssistantAnswer("[[unknown]] [[web:https://www.daad.de/]]", [rule, web])).toBe(ASSISTANT_FALLBACK);
    expect(guardAssistantAnswer("[[unknown]] [[rule:]]", [rule])).toBe(ASSISTANT_FALLBACK);
  });
});
