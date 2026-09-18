import { describe, expect, it } from "vitest";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function makeSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function makeEnv({ OPENROUTER_API_KEY = "sk-test", TAVILY_API_KEY = "tv-test" }: { OPENROUTER_API_KEY?: string; TAVILY_API_KEY?: string } = {}) {
  // @ts-ignore - testing env override
  process.env.OPENROUTER_API_KEY = OPENROUTER_API_KEY;
  // @ts-ignore - testing env override
  process.env.TAVILY_API_KEY = TAVILY_API_KEY;
  return { OPENROUTER_API_KEY, TAVILY_API_KEY };
}

import { POST } from "@/app/api/assistant/chat/route";

describe("POST /api/assistant/chat", () => {
  it("returns 401 when user is not signed in", async () => {
    const db = makeSupabaseClient();
    const req = new Request(
      "http://localhost/api/assistant/chat",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when OPENROUTER_API_KEY is missing", async () => {
    makeEnv({ OPENROUTER_API_KEY: undefined, TAVILY_API_KEY: undefined });
    const db = makeSupabaseClient();
    // @ts-ignore - testing without real user
    const { data: { user } } = await db.auth.signInAnonymously();
    const req = new Request(
      "http://localhost/api/assistant/chat",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(503);
    // Restore
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.TAVILY_API_KEY = "tv-test";
  });

  it("returns 400 when messages array is empty", async () => {
    makeEnv();
    const db = makeSupabaseClient();
    // @ts-ignore
    const { data: { user } } = await db.auth.signInAnonymously();
    const req = new Request(
      "http://localhost/api/assistant/chat",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [] as any,
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(400);
    // Restore
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.TAVILY_API_KEY = "tv-test";
  });

  it("returns 429 when daily quota is exceeded", async () => {
    makeEnv();
    const db = makeSupabaseClient();
    // @ts-ignore
    const { data: { user } } = await db.auth.signInAnonymously();
    // Insert enough messages to exceed daily quota (20)
    await db.from("assistant_messages").insert({
      user_id: user.id,
      role: "user",
      content: "test question",
    });
    // Insert 20 more to hit the limit
    for (let i = 0; i < 19; i++) {
      await db.from("assistant_messages").insert({
        user_id: user.id,
        role: "user",
        content: `question ${i}`,
      });
    }
    const req = new Request(
      "http://localhost/api/assistant/chat",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(429);
    // Cleanup
    await db.from("assistant_messages").delete().eq("user_id", user.id);
    // Restore
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.TAVILY_API_KEY = "tv-test";
  });
});