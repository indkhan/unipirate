// Pure completed-answer boundary. Presence/authorization is not entailment.
import { z } from "zod";
import { responseRuleSources } from "./assistant-sources";
import { parseMarkers } from "./markers";
import { TaskReceiptSchema } from "@/lib/tasks/manual";

export const ASSISTANT_FALLBACK = "I cannot provide a source-backed answer to this question. [[unknown]] Check DAAD as a place to find official guidance: https://www.daad.de/";
export type AssistantEvidence = { toolName: string; output: unknown };
const WebEnvelope = z.object({
  unverified: z.literal(true), results: z.array(z.object({
    title: z.string(), url: z.string().url().refine(url => /^https?:\/\//.test(url)), content: z.string(),
  }).strict()), note: z.string().optional(),
}).strict();

/** Only successful executed server tool outputs from this request belong here.
 * History, personal context and provider source events never authorize citations. */
export function guardAssistantAnswer(text: string, evidence: readonly AssistantEvidence[]): string {
  const action=evidence.findLast(item=>item.toolName==="create_task");
  if(action){
    const receipt=TaskReceiptSchema.safeParse(action.output);
    if(!receipt.success)return ASSISTANT_FALLBACK;
    if(receipt.data.status==="failed")return receipt.data.error;
    const {task,status}=receipt.data;
    return `${status==="created"?"Created personal task":"Already saved personal task"}: ${task.title}.${task.due_date?` Personal reminder: ${task.due_date}.`:""}`;
  }
  const parsed = parseMarkers(text);
  const tokens = text.match(/\[\[[\s\S]*?\]\]/g) ?? [];
  const malformed = tokens.some(token => {
    const marker = parseMarkers(token);
    return token !== "[[unknown]]" && !marker.citations.some(c => token === `[[${c.type}:${c.ref}]]`);
  }) || text.replace(/\[\[[\s\S]*?\]\]/g, "").includes("[[");
  // Unknown-only model prose has no source authority, even after retrieval.
  if (!text.trim() || malformed || !parsed.citations.length) return ASSISTANT_FALLBACK;
  const rules = responseRuleSources(evidence.filter(e => e.toolName === "search_rules").map(e => ({
    type: "tool-search_rules", state: "output-available", output: e.output,
  })));
  const web = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const item of evidence.filter(e => e.toolName === "web_search")) {
    const result = WebEnvelope.safeParse(item.output);
    if (!result.success) { web.clear(); break; }
    for (const source of result.data.results) {
      const exact = JSON.stringify(source);
      if (web.has(source.url) && web.get(source.url) !== exact) ambiguous.add(source.url);
      web.set(source.url, exact);
    }
  }
  for (const url of ambiguous) web.delete(url);
  // Trade-off: authorized citation presence does not prove sentence entailment,
  // including unknown passages in otherwise cited answers.
  return parsed.citations.every(c => c.type === "rule" ? rules.has(c.ref) : web.has(c.ref))
    ? text : ASSISTANT_FALLBACK;
}
