// Strict-RAG assistant: system prompt, tools, citation markers, and the
// streamText wrapper shared by the chat route and the eval script.
// The assistant answers ONLY from tool results; every factual claim carries a
// [[rule:slug]] or [[web:url]] marker, and "not covered" answers carry
// [[unknown]]. Refusing to guess is success, not failure.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  embed,
  stepCountIs,
  streamText,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod";

import type { Database } from "@/lib/db/database.types";
import {
  getProfile,
  insertAssistantMessage,
  listApplicationsWithCourses,
  listTasks,
  matchKbChunks,
} from "@/lib/db/queries";

export const DAILY_QUOTA = 20;
export const CHAT_MODEL = "openai/gpt-5.4-mini";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export const OFFICIAL_DOMAINS = [
  "daad.de",
  "aps-india.de",
  "uni-assist.de",
  "diplo.de",
  "auswaertiges-amt.de",
  "goethe.de",
  "anabin.kmk.org",
];

// ------------------------------------------------------------------ markers

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

// ------------------------------------------------------------ system prompt

const COUNTRY_NOTES: Record<string, string> = {
  in: "The user's country is India. India rules are fully verified.",
  pk: "The user's country is Pakistan. Pakistan rules are BETA — mention on every Pakistan-specific answer that the rule is beta and should be confirmed with the official source.",
  sa: "The user's country is Saudi Arabia. Saudi Arabia rules are BETA — mention on every Saudi-specific answer that the rule is beta and should be confirmed with the official source.",
};

export function buildSystemPrompt(countryCode: string | null): string {
  const countryNote =
    (countryCode && COUNTRY_NOTES[countryCode]) ??
    "The user's country is not covered by our verified rules yet — most answers will need [[unknown]] plus a pointer to the official source.";

  return `You are Ask Uniweg, the assistant of a free web app guiding students from India, Pakistan and Saudi Arabia into German public universities. ${countryNote}

STRICT SOURCE RULES — these define success:
- Answer ONLY from tool results. You have no knowledge of your own about admission, visa, APS, fees, deadlines, or amounts. Never invent or "remember" a number, date, fee, or requirement.
- Every factual claim must end with a citation marker: [[rule:slug]] for a knowledge-base result (use its exact slug) or [[web:url]] for a web result (use its exact URL).
- If the tool results do not answer the question, say so plainly, output [[unknown]] and point the user to the official source to check (name it, and give its URL as plain text). Refusing to guess is success, not failure.
- Web results are UNVERIFIED. When you use one, keep the [[web:url]] marker on each claim and phrase it as unconfirmed ("recent web sources say…").
- Never give an eligibility verdict beyond what a retrieved rule states; for personal eligibility decisions point to the checker and the official source.

TOOLS:
- Always call search_rules first for any factual question.
- Call get_user_context whenever the question involves the user's own situation ("my", "me", their courses, tasks, applications, or where they are in the process).
- Call web_search only when search_rules did not answer, or the question is about current/live information (waiting lists, news, availability).

STYLE (the product voice):
- Second person, present tense. Calm, concrete, never breathless. No exclamation marks, no emoji.
- Short answers: 1-4 sentences per point. Say the scary thing plainly, then say what to do.
- German terms get a one-line plain-English gloss on first use.
- Dates as DD MMM YYYY.

EXAMPLES:
Q: "How much must be in my blocked account?"
A: "For study visas in 2026 the blocked account must hold €11,904 for the year (€992 per month) [[rule:snippet-blocked-account-amount]]. The amount is BAföG-based and changes when BAföG changes, so confirm it on the Federal Foreign Office page before you transfer."
Q: "Can my cousin sponsor me instead of a blocked account?"
A: "Our verified rules don't cover third-party sponsorship, so I can't confirm this either way. [[unknown]] Check the Federal Foreign Office financing page (https://www.auswaertiges-amt.de/en/sperrkonto-388600) or ask the German mission handling your visa."`;
}

// -------------------------------------------------------------------- tools

type Db = Pick<SupabaseClient<Database>, "from" | "rpc">;

type TavilyResult = { title: string; url: string; content: string };

async function tavilySearch(
  apiKey: string,
  query: string,
  includeDomains?: string[],
): Promise<TavilyResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: 5,
      ...(includeDomains ? { include_domains: includeDomains } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Tavily ${response.status}`);
  const data = (await response.json()) as { results?: TavilyResult[] };
  return (data.results ?? []).map(({ title, url, content }) => ({
    title,
    url,
    content: content.slice(0, 1500),
  }));
}

export function assistantTools(options: {
  db: Db;
  userId: string;
  openrouterApiKey: string;
  tavilyApiKey?: string;
}): ToolSet {
  const { db, userId, openrouterApiKey, tavilyApiKey } = options;
  const openrouter = createOpenRouter({ apiKey: openrouterApiKey });

  return {
    search_rules: tool({
      description:
        "Semantic search over verified and beta rules plus curated official snippets. Always call this first for factual questions. Cite results as [[rule:slug]].",
      inputSchema: z.object({
        query: z.string().min(1).describe("The question, rephrased as a search query"),
      }),
      execute: async ({ query }) => {
        const { embedding } = await embed({
          model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
          value: query,
        });
        const matches = await matchKbChunks(db, JSON.stringify(embedding), 6);
        return matches.map((m) => ({
          slug: m.slug,
          title: m.title,
          content: m.content,
          source_url: m.source_url,
          last_verified_at: m.last_verified_at,
          country_code: m.country_code,
        }));
      },
    }),

    get_user_context: tool({
      description:
        "The user's profile (country, answers), tracked applications with courses, tasks, and where they are right now (next due task, application statuses).",
      inputSchema: z.object({}),
      execute: async () => {
        const [profile, applications, tasks] = await Promise.all([
          getProfile(db, userId),
          listApplicationsWithCourses(db, userId),
          listTasks(db, userId),
        ]);
        const openTasks = tasks.filter((t) => !t.done);
        const nextDueTask =
          openTasks.find((t) => t.due_date !== null) ?? openTasks[0] ?? null;
        const applicationsByStatus: Record<string, number> = {};
        for (const a of applications) {
          applicationsByStatus[a.status] =
            (applicationsByStatus[a.status] ?? 0) + 1;
        }
        return {
          profile: profile
            ? { country_code: profile.country_code, answers: profile.answers }
            : null,
          applications: applications.map((a) => ({
            status: a.status,
            course: a.courses
              ? {
                  name: a.courses.name,
                  university: a.courses.university_name,
                  deadlines: a.courses.deadlines,
                  language: a.courses.language,
                }
              : null,
          })),
          tasks: tasks.map((t) => ({
            title: t.title,
            due_date: t.due_date,
            done: t.done,
          })),
          whereTheUserIs: {
            nextDueTask: nextDueTask
              ? { title: nextDueTask.title, due_date: nextDueTask.due_date }
              : null,
            openTaskCount: openTasks.length,
            applicationsByStatus,
          },
        };
      },
    }),

    web_search: tool({
      description:
        "Web search, biased to official German sources (DAAD, uni-assist, APS, missions). Results are UNVERIFIED — cite each claim as [[web:url]] and phrase it as unconfirmed. Use only when search_rules did not answer.",
      inputSchema: z.object({
        query: z.string().min(1),
      }),
      execute: async ({ query }) => {
        if (!tavilyApiKey) {
          return {
            unverified: true,
            results: [],
            note: "Web search is not available right now. Point the user to the official source instead.",
          };
        }
        try {
          let results = await tavilySearch(tavilyApiKey, query, OFFICIAL_DOMAINS);
          if (results.length === 0)
            results = await tavilySearch(tavilyApiKey, query);
          return { unverified: true, results };
        } catch {
          return {
            unverified: true,
            results: [],
            note: "Web search failed. Point the user to the official source instead.",
          };
        }
      },
    }),
  };
}

// -------------------------------------------------------------- runAssistant

export async function runAssistant(options: {
  db: Db;
  userId: string;
  countryCode: string | null;
  messages: UIMessage[];
  openrouterApiKey: string;
  tavilyApiKey?: string;
}) {
  const { db, userId, countryCode, messages, openrouterApiKey, tavilyApiKey } =
    options;
  const openrouter = createOpenRouter({ apiKey: openrouterApiKey });

  return streamText({
    model: openrouter(CHAT_MODEL),
    system: buildSystemPrompt(countryCode),
    messages: await convertToModelMessages(messages),
    tools: assistantTools({ db, userId, openrouterApiKey, tavilyApiKey }),
    stopWhen: stepCountIs(6),
    temperature: 0,
    // Answers are 1-4 sentences per point by design; the cap also bounds cost.
    maxOutputTokens: 1024,
    onFinish: async (event) => {
      const { citations } = parseMarkers(event.text);
      await insertAssistantMessage(db, {
        user_id: userId,
        role: "assistant",
        content: event.text,
        citations,
      });
    },
  });
}
