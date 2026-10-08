// Index currently applicable immutable rules without inferring an intake.
// Stored vectors are search hints; retrieval reselects and renders exact inputs.
// Unversioned snippets cannot establish current rule authority.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";

import { EMBEDDING_MODEL } from "../lib/ai/kb";
import type { Database } from "../lib/db/database.types";
import { getServerEnv } from "../lib/env";
import { versionedEmbeddingChunks } from "../lib/ai/versioned-kb";
import { listRuleVersions } from "../lib/db/queries";
import { replaceAdminKbChunks } from "../lib/db/admin-queries";

const env = getServerEnv();
if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");

const db = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

async function main() {
  const evaluatedAt = new Date().toISOString();
  const chunks = versionedEmbeddingChunks(await listRuleVersions(db), evaluatedAt);
  console.log(`Embedding ${chunks.length} applicable immutable rule chunks; unversioned snippets excluded.`);

  const { embeddings } = chunks.length ? await embedMany({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    values: chunks.map(chunk => `${chunk.title}\n${chunk.content}`),
  }) : {embeddings: []};

  await replaceAdminKbChunks(db, chunks.map((chunk, i) => ({
    source_type: "rule", rule_id: chunk.ruleId,
    slug: `rule-${chunk.ruleId}-version-${chunk.versionId}`, title: chunk.title, content: chunk.content,
    source_url: chunk.source_url, last_verified_at: chunk.last_verified_at, country_code: chunk.country_code,
    embedding: JSON.stringify(embeddings[i]),
  })));
  console.log(`✓ kb_chunks rebuilt: ${chunks.length} rows`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
