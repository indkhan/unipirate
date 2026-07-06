import { NextResponse } from "next/server";
import {
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { DAILY_QUOTA, runAssistant } from "@/lib/ai/assistant";
import {
  countTodayAssistantQuestions,
  getProfile,
  insertAssistantMessage,
} from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { getServerEnv } from "@/lib/env";

// UIMessage passes through convertToModelMessages; validate just the envelope.
const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.record(z.unknown())),
      }),
    )
    .min(1)
    .max(50),
});

function lastUserText(messages: ChatMessages): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (
    last?.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n") ?? ""
  );
}

type ChatMessages = z.infer<typeof ChatRequestSchema>["messages"];

export async function POST(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to use the assistant." },
      { status: 401 },
    );
  }

  const env = getServerEnv();
  if (!env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { messages } = parsed.data;

  const used = await countTodayAssistantQuestions(db, user.id);
  if (used >= DAILY_QUOTA) {
    return NextResponse.json(
      { error: "You've used all questions for today — come back tomorrow.", used },
      { status: 429 },
    );
  }

  const question = lastUserText(messages);
  if (!question.trim()) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }

  // Log the question before streaming so aborted streams still count
  // against the quota.
  await insertAssistantMessage(db, {
    user_id: user.id,
    role: "user",
    content: question,
  });

  const profile = await getProfile(db, user.id);

  const result = await runAssistant({
    db,
    userId: user.id,
    countryCode: profile?.country_code ?? null,
    messages: messages as unknown as UIMessage[],
    openrouterApiKey: env.OPENROUTER_API_KEY,
    tavilyApiKey: env.TAVILY_API_KEY,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
