// Adversarial eval for the strict-RAG assistant: pnpm eval:assistant
// Pass criteria: (a) every answer carries at least one [[rule:]]/[[web:]]
// citation OR an honest [[unknown]]; (b) every mustBeUnknown trap yields
// [[unknown]]; (c) at least 3 unreplaced unknowns overall; (d) no guarded
// replacement fallback. Raw marker compliance is reported separately.
// Sentence-level uncited-claim detection would need a judge model; the
// marker-presence check plus the trap questions is the honest automatable
// version. Creates its own throwaway user (profile + tasks) and cleans up.

import {lstatSync,realpathSync,writeFileSync} from "node:fs";
import {basename,dirname,resolve} from "node:path";
import {buildEvalEvidence,normalizeEvalError,isOutsideCheckout,type EvalCaseEvidence} from "./eval-assistant-diagnostics";
import { createClient } from "@supabase/supabase-js";
import { AnswersSchema } from "../app/(public)/check/steps";

import { runAssistant } from "../lib/ai/assistant";
import { parseMarkers } from "../lib/ai/markers";
import type { Database } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";
import { evalQuestions } from "./eval-questions";

// Optional private artifact: use an absolute path outside the checkout (for example the OS temp directory).
const requestedEvidencePath=process.env.EVAL_ASSISTANT_EVIDENCE_PATH;
let evidencePath:string|undefined;
if(requestedEvidencePath){
  const checkout=realpathSync(process.cwd());
  if(!isOutsideCheckout(process.cwd(),requestedEvidencePath))throw new Error("Eval evidence requires an absolute path outside the checkout");
  // Resolve the nearest existing ancestor, including directory junctions/file symlinks.
  // Broken symlinks and inaccessible ancestors fail closed rather than guessing their target.
  let ancestor=resolve(requestedEvidencePath);const missing:string[]=[];
  for(;;){
    try{lstatSync(ancestor);break;}catch(error){
      if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;
      const parent=dirname(ancestor);if(parent===ancestor)throw error;
      missing.unshift(basename(ancestor));ancestor=parent;
    }
  }
  evidencePath=resolve(realpathSync(ancestor),...missing);
  if(!isOutsideCheckout(checkout,evidencePath))throw new Error("Eval evidence resolves inside the checkout");
}
const env = getServerEnv();
if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");

const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  const cases:EvalCaseEvidence[]=[];let runComplete=false;
  const startedAt=new Date().toISOString();
  const checkpoint=()=>{if(evidencePath){const evidence=buildEvalEvidence(cases,evalQuestions.length);writeFileSync(evidencePath,JSON.stringify({...evidence,status:runComplete?evidence.status:"incomplete",startedAt,updatedAt:new Date().toISOString()},null,2),{encoding:"utf8",mode:0o600});}};
  checkpoint();
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
      const evidence:EvalCaseEvidence={question:question.text,category:question.category,completed:false,problems:[],unknown:false,rawCompliant:true,replaced:false,completedAnswers:0,startedSteps:0,answer:null,guardedSteps:[],errors:[]};
      cases.push(evidence);checkpoint();
      const progress=()=>{checkpoint();console.error(`[eval] attempted ${cases.length}/${evalQuestions.length} | ${evidence.problems.length?"failed":"completed"} | observed started steps ${evidence.startedSteps} (not an exact request count) | errors ${evidence.errors.map(error=>`${error.errorClass}:${error.statusCode??"unknown"}`).join(",")||"none"}`);};
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
            evidence.completedAnswers=completedAnswers;
            evidence.guardedSteps.push({rawText,text});
            const markers = parseMarkers(rawText);
            if (!markers.unknown && !markers.citations.length) rawCompliant = false;
            if (rawText !== text) replaced = true;
            evidence.rawCompliant=rawCompliant;evidence.replaced=replaced;checkpoint();
          },
        });
        // Installed SDK fullStream tees the existing stream; consuming it does not create requests.
        // Ignore tool/context/raw parts entirely. Observe only started steps and normalized errors.
        const observing=(async()=>{try{for await(const part of result.fullStream){
          if(part.type==="start-step"){evidence.startedSteps++;checkpoint();}
          if(part.type==="error"){evidence.errors.push(normalizeEvalError(part.error));checkpoint();}
        }}catch(error){evidence.errors.push(normalizeEvalError(error));}})();
        const outcomes=await Promise.allSettled([result.text,observing]);
        if(outcomes[0].status==="rejected")throw outcomes[0].reason;
        text=outcomes[0].value;
      } catch (error) {
        failures++;
        const normalized=normalizeEvalError(error);evidence.errors.push(normalized);
        evidence.completed=true;evidence.problems=["ERROR"];evidence.rawCompliant=rawCompliant;evidence.replaced=replaced;
        rows.push(`✗ ERROR   [${question.category}] ${question.text} — ${normalized.errorClass} (status ${normalized.statusCode??"unknown"})`);
        progress();
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

      evidence.completed=true;evidence.problems=problems;evidence.unknown=unknown;evidence.rawCompliant=rawCompliant;evidence.replaced=replaced;evidence.answer=text;
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
      progress();
    }
  } finally {
    await db.from("assistant_messages").delete().eq("user_id", userId);
    await db.auth.admin.deleteUser(userId);
  }

  runComplete=true;checkpoint();
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
  const normalized=normalizeEvalError(error);
  console.error(`Eval failed: ${normalized.errorClass} (status ${normalized.statusCode??"unknown"})`);
  process.exit(1);
});
