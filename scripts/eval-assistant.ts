// Adversarial eval for the strict-RAG assistant: pnpm eval:assistant
// Pass criteria: (a) every answer carries at least one [[rule:]]/[[web:]]
// citation OR an honest [[unknown]]; (b) every mustBeUnknown trap yields
// [[unknown]]; (c) at least 3 honest unknowns overall.
// Sentence-level uncited-claim detection would need a judge model; the
// marker-presence check plus the trap questions is the honest automatable
// version. Creates its own throwaway user (profile + tasks) and cleans up.

import { createClient } from "@supabase/supabase-js";

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
    answers: {
      targetDegree: "bachelor",
      certificateCountry: "in",
      board: "cbse",
      class12_percent: 82,
    },
  });
  await db.from("tasks").insert([
    { user_id: userId, title: "Upload APS payment receipt", due_date: "2026-07-20" },
    { user_id: userId, title: "Order certified Class 12 translations" },
  ]);

  let failures = 0;
  let unknowns = 0;
  const rows: string[] = [];

  try {
    for (const question of evalQuestions) {
      let text: string;
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
        });
        text = await result.text;
      } catch (error) {
        failures++;
        rows.push(`✗ ERROR   [${question.category}] ${question.text} — ${String(error).slice(0, 120)}`);
        continue;
      }

      const { citations, unknown } = parseMarkers(text);
      if (unknown) unknowns++;

      const problems: string[] = [];
      // Personal answers come from the user's own profile/tasks via
      // get_user_context — there is no external source to cite.
      if (citations.length === 0 && !unknown && question.category !== "personal")
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
