// Citation markers the assistant emits inline: [[rule:slug]], [[web:url]],
// [[unknown]]. Pure string parsing — shared by the server (logging), the
// client bubble renderer, and the eval script.

export type Citation = { type: "rule" | "web"; ref: string };

const RULE_MARKER = /\[\[rule:([a-z0-9][a-z0-9-]*)\]\]/g;
const WEB_MARKER = /\[\[web:(https?:\/\/[^\]\s]+)\]\]/g;
const UNKNOWN_MARKER = /\[\[unknown\]\]/g;

export function parseMarkers(text: string): {
  citations: Citation[];
  unknown: boolean;
} {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  const add = (type: "rule" | "web", ref: string) => {
    const key = `${type}:${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    citations.push({ type, ref });
  };
  for (const match of text.matchAll(RULE_MARKER)) add("rule", match[1]);
  for (const match of text.matchAll(WEB_MARKER)) add("web", match[1]);
  return { citations, unknown: UNKNOWN_MARKER.test(text) };
}

export function stripMarkers(text: string): string {
  return text
    .replace(RULE_MARKER, "")
    .replace(WEB_MARKER, "")
    .replace(UNKNOWN_MARKER, "")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
