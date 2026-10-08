// Adversarial eval for the strict-RAG assistant: pnpm eval:assistant
// Pass criteria: (a) every answer carries at least one [[rule:]]/[[web:]]
// citation OR an honest [[unknown]]; (b) every mustBeUnknown trap yields
// [[unknown]]; (c) at least 3 unreplaced unknowns overall; (d) no guarded
// replacement fallback. Raw marker compliance is reported separately.
// Sentence-level uncited-claim detection would need a judge model; the
// marker-presence check plus the trap questions is the honest automatable
// version. Creates its own throwaway user (profile + tasks) and cleans up.

import { createClient } from "@supabase/supabase-js";
import { AnswersSchema } from "../app/(public)/check/steps";

import { runAssistant } from "../lib/ai/assistant";
import { parseMarkers } from "../lib/ai/markers";
import type { Database } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";
import { evalQuestions } from "./eval-questions";

const env = getServerEnv();
if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");

const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: created, error } = await db.auth.admin.createUser({
    email: `eval-assistant-${Date.now()}@example.com`,
    password: `eval-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (error) throw new Error(`create eval user: ${error.message}`);
  const userId = created.user.id;

  await db.from("profiles").upsert({
    user_id: userId,
    answers: AnswersSchema.parse({
      targetDegree: "bachelor",
      nationality: "in",
      certificateCountry: "in",
      visaApplicationCountry: "in",
      curriculumType: "national",
      board: "cbse",
      schoolGradePercent: 82,
      jeeAdvanced: false,
      hasExistingApsCertificate: false,
      targetField: "cs",
      intake: null,
    }),
  });
  await db.from("tasks").insert([
    { user_id: userId, title: "Upload APS payment receipt", due_date: "2026-07-20" },
    { user_id: userId, title: "Order certified Class 12 translations" },
  ]);

  let failures = 0;
  let unknowns = 0;
  let rawUncited = 0;
  let guardedFallbacks = 0;
  const rows: string[] = [];

  try {
    for (const question of evalQuestions) {
      let text: string;
      let rawCompliant = true;
      let replaced = false;
      let completedAnswers = 0;
      try {
        const result = await runAssistant({
          db,
          userId,
          countryCode: "in",
          messages: [
            {
              id: "q",
              role: "user",
              parts: [{ type: "text", text: question.text }],
            },
          ],
          openrouterApiKey: env.OPENROUTER_API_KEY!,
          tavilyApiKey: env.TAVILY_API_KEY,
          onGuardedStep: ({ rawText, text }) => {
            completedAnswers++;
            const markers = parseMarkers(rawText);
            if (!markers.unknown && !markers.citations.length) rawCompliant = false;
            if (rawText !== text) replaced = true;
          },
        });
        text = await result.text;
      } catch (error) {
        failures++;
        rows.push(`✗ ERROR   [${question.category}] ${question.text} — ${String(error).slice(0, 120)}`);
        continue;
      }

      const { citations, unknown } = parseMarkers(text);
      if (unknown && !replaced) unknowns++;
      if (!rawCompliant) rawUncited++;
      if (replaced) guardedFallbacks++;

      const problems: string[] = [];
      // Universal markers include personal answers. A successful fallback is
      // safe delivery, not evidence of healthy raw model compliance.
      if (!rawCompliant) problems.push("RAW_UNCITED");
      if (replaced) problems.push("GUARDED_FALLBACK");
      if (!completedAnswers) problems.push("NO_ANSWER");
      if (citations.length === 0 && !unknown)
        problems.push("UNCITED");
      if (question.mustBeUnknown && !unknown) problems.push("GUESSED");

      if (problems.length > 0) {
        failures++;
        rows.push(`✗ ${problems.join("+")} [${question.category}] ${question.text}`);
        rows.push(`    → ${text.replace(/\n/g, " ").slice(0, 240)}`);
      } else {
        const label = unknown
          ? "unknown"
          : citations.map((c) => c.ref).join(", ").slice(0, 80);
        rows.push(`✓ [${question.category}] ${question.text}`);
        rows.push(`    → ${label}`);
      }
    }
  } finally {
    await db.from("assistant_messages").delete().eq("user_id", userId);
    await db.auth.admin.deleteUser(userId);
  }

  console.log(rows.join("\n"));
  console.log(
    `\n${evalQuestions.length - failures}/${evalQuestions.length} passed · ${unknowns} honest unknowns (need ≥3)`,
  );
  console.log(`Raw uncited answers: ${rawUncited} · guarded fallbacks: ${guardedFallbacks}`);
  if (unknowns < 3) {
    console.error("FAIL: fewer than 3 honest unknowns.");
    process.exit(1);
  }
  if (failures > 0) process.exit(1);
  console.log("PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
