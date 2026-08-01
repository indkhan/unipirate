// Rebuilds the assistant knowledge base: published rules (beta + verified) are
// rendered to text chunks, curated snippets come from scripts/kb.snippets.ts,
// everything is embedded via OpenRouter and kb_chunks is replaced wholesale.
// Rerun after rule changes or snippet edits: pnpm kb:embed

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";

import { EMBEDDING_MODEL, ruleToChunk, type KbChunk, type KbRule } from "../lib/ai/kb";
import type { Database } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";
import { kbSnippets } from "./kb.snippets";

const env = getServerEnv();
if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");

const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

async function main() {
  const { data: rules, error } = await db
    .from("rules")
    .select(
      "id, slug, conditions, outcomes, status, source_url, source_quote, last_verified_at, country_code",
    )
    .in("status", ["beta", "verified"]);
  if (error) throw new Error(`load rules: ${error.message}`);

  const ruleChunks = rules
    .filter((r) => r.slug !== null)
    .map((r) => ({
      chunk: ruleToChunk(r as unknown as KbRule & { slug: string }),
      ruleId: r.id,
    }));
  const chunks: { chunk: KbChunk; ruleId: string | null }[] = [
    ...ruleChunks,
    ...kbSnippets.map((chunk) => ({ chunk, ruleId: null })),
  ];
  console.log(
    `Embedding ${ruleChunks.length} rule chunks + ${kbSnippets.length} snippets…`,
  );

  const { embeddings } = await embedMany({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    values: chunks.map(({ chunk }) => `${chunk.title}\n${chunk.content}`),
  });

  const { error: deleteError } = await db
    .from("kb_chunks")
    .delete()
    .neq("slug", "");
  if (deleteError) throw new Error(`clear kb_chunks: ${deleteError.message}`);

  const rows = chunks.map(({ chunk, ruleId }, i) => ({
    source_type: ruleId ? ("rule" as const) : ("snippet" as const),
    rule_id: ruleId,
    slug: chunk.slug,
    title: chunk.title,
    content: chunk.content,
    source_url: chunk.source_url,
    last_verified_at: chunk.last_verified_at,
    country_code: chunk.country_code,
    embedding: JSON.stringify(embeddings[i]),
  }));
  const { error: insertError } = await db.from("kb_chunks").insert(rows);
  if (insertError) throw new Error(`insert kb_chunks: ${insertError.message}`);

  console.log(`✓ kb_chunks rebuilt: ${rows.length} rows`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
