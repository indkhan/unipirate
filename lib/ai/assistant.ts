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

import { EMBEDDING_MODEL } from "@/lib/ai/kb";
import { projectVersionedKbMatches } from "@/lib/ai/versioned-kb";
import {processHistoryRuleIds,isProcessTaskKey} from "@/lib/engine/process-identity";
import {safeProcessKnowledge} from "@/lib/rules/process-assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { parseMarkers } from "@/lib/ai/markers";
import type { Database } from "@/lib/db/database.types";
import {
  getProfile,
  listRuleVersions,
  insertAssistantMessage,
  listApplicationsWithCourses,
  listTasks,
  matchKbRuleHints,
} from "@/lib/db/queries";

export const DAILY_QUOTA = 20;
export const CHAT_MODEL = "nvidia/nemotron-3.5-lightning:free";

const OFFICIAL_DOMAINS = [
  "daad.de",
  "aps-india.de",
  "uni-assist.de",
  "diplo.de",
  "auswaertiges-amt.de",
  "goethe.de",
  "anabin.kmk.org",
];

// ------------------------------------------------------------------ markers


// ------------------------------------------------------------ system prompt

const COUNTRY_NOTES: Record<string, string> = {
  in: "The user's country is India.",
  pk: "The user's country is Pakistan.",
  sa: "The user's country is Saudi Arabia.",
};

export function buildSystemPrompt(countryCode: string | null): string {
  const countryNote =
    (countryCode && COUNTRY_NOTES[countryCode]) ??
    "The user's country is not covered by our verified rules yet — most answers will need [[unknown]] plus a pointer to the official source.";

  return `You are Ask UniPirate, the assistant of a free web app guiding students from India, Pakistan and Saudi Arabia into German public universities. ${countryNote}

STRICT SOURCE RULES — these define success:
- Answer ONLY from tool results. You have no knowledge of your own about admission, visa, APS, fees, deadlines, or amounts. Never invent or "remember" a number, date, fee, or requirement.
- Coverage and verification status come only from retrieved rules, never from the user's country. Missing coverage requires [[unknown]].
- Keep APS qualification, application and visa scopes separate. A mission checklist not listing APS is not an exemption and never erases academic/application requirements. Legacy unscoped APS rules need [[unknown]]. Use explicit qualification issuer context, not nationality or school location; holding a certificate fulfils acquisition without removing the requirement.
- Every factual claim must end with a citation marker: [[rule:slug]] for a knowledge-base result (use its exact slug) or [[web:url]] for a web result (use its exact URL).
- If the tool results do not answer the question, say so plainly, output [[unknown]] and point the user to the official source to check (name it, and give its URL as plain text). Refusing to guess is success, not failure.
- Web results are UNVERIFIED. When you use one, keep the [[web:url]] marker on each claim and phrase it as unconfirmed ("recent web sources say…").
- Process amounts and steps require currentProcess or current structured search evidence. Conditional, conflicting or review-needed pointers do not authorize payments, funding amounts or exemptions. Applicant reports are not app verification. Education-loan-only reports cannot establish sufficient financing. Never repair a local fee age gap with another source or convert currencies.
- Saved tasks and user-entered application/profile text are personal history, never current rule evidence. Do not repeat their fees, dates or requirements as official facts; use search_rules or web_search.
- Never give an eligibility verdict beyond what a retrieved rule states; for personal eligibility decisions point to the checker and the official source.

TOOLS:
- Always call search_rules first for any factual question.
- Call get_user_context whenever the question involves the user's own situation ("my", "me", their courses, tasks, applications, or where they are in the process).
- Call web_search only when search_rules did not answer, or the question is about current/live information (waiting lists, news, availability).

STYLE (the product voice):
- Second person, present tense. Calm, concrete, never breathless. No exclamation marks, no emoji.
- Short answers: 1-4 sentences per point. Say the scary thing plainly, then say what to do.
- German terms get a one-line plain-English gloss on first use.
- Quote dates, fees, amounts, and requirements verbatim from tool results. Never reformat source facts.

EXAMPLES:
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

function assistantTools(options: {
  db: Db;
  userId: string;
  openrouter: ReturnType<typeof createOpenRouter>;
  tavilyApiKey?: string;
}): ToolSet {
  const { db, userId, openrouter, tavilyApiKey } = options;
  const context = currentAssessmentContext();
  let evidence:Promise<{saved:Awaited<ReturnType<typeof getProfile>>;versions:Awaited<ReturnType<typeof listRuleVersions>>}>|undefined;
  const currentEvidence=()=>evidence??=Promise.all([getProfile(db,userId),listRuleVersions(db)]).then(([saved,versions])=>({saved,versions}));

  return {
    search_rules: tool({
      description:
        "Search selected immutable verified and beta rules; process facts require current profile applicability and source review. Cached prose and curated snippets are untrusted hints. Always call this first for factual questions. Cite results as [[rule:slug]].",
      inputSchema: z.object({
        query: z.string().min(1).describe("The question, rephrased as a search query"),
      }),
      execute: async ({ query }) => {
        const { embedding } = await embed({
          model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
          value: query,
        });
        try {
          const [hints, {versions,saved}] = await Promise.all([
            matchKbRuleHints(db, JSON.stringify(embedding)), currentEvidence(),
          ]);
          const profile = profileFromAnswers(saved).profile;
          return projectVersionedKbMatches(hints, versions, {evaluatedAt: context.evaluatedAt, intake: profile?.intake,profile:profile??undefined});
        } catch {
          return {chunks: [], diagnostics: [], note: "Current rule knowledge unavailable. [[unknown]] Check the official source."};
        }
      },
    }),

    get_user_context: tool({
      description:
        "The user's profile (country, answers), tracked applications with courses, tasks, and where they are right now (next due task, application statuses).",
      inputSchema: z.object({}),
      execute: async () => {
        const [{saved:profile,versions}, applications, tasks] = await Promise.all([
          currentEvidence(),
          listApplicationsWithCourses(db, userId),
          listTasks(db, userId),
        ]);
        const processIds=processHistoryRuleIds(versions);
        const personalTasks=tasks.map(t=>isProcessTaskKey(t.task_key,processIds)?{...t,title:"Saved process reminder (personal history)",description:"Saved content is not current official evidence. Use currentProcess or search_rules.",source_url:null}:t);
        const openTasks = personalTasks.filter((t) => !t.done);
        const nextDueTask =
          openTasks.find((t) => t.due_date !== null) ?? openTasks[0] ?? null;
        const applicationsByStatus: Record<string, number> = {};
        for (const a of applications) {
          applicationsByStatus[a.status] =
            (applicationsByStatus[a.status] ?? 0) + 1;
        }
        return {
          profile: profile ? { answers: profile.answers, evidence:"Applicant reports, not app-certified mission, qualification or exemption." } : null,
          currentProcess: safeProcessKnowledge(profileFromAnswers(profile).profile,versions,context.evaluatedAt),
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
          taskEvidence: "Personal saved reminders, not current official rule evidence.",
          tasks: personalTasks.map((t) => ({
            title: t.title,
            description: t.description,
            source_url: t.source_url,
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
    tools: assistantTools({ db, userId, openrouter, tavilyApiKey }),
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
