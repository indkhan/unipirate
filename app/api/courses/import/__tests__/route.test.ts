import { describe, expect, it } from "vitest";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { POST } from "@/app/api/courses/import/route";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function makeSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

describe("POST /api/courses/import", () => {
  it("returns 401 when user is not signed in", async () => {
    const db = makeSupabaseClient();
    const { data: { user } } = await db.auth.signInAnonymously();
    // anonymous user should get 401
    const req = new Request(
      "http://localhost/api/courses/import",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/course",
          text: "Some course page text",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore - testing without proper auth context
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when url is invalid", async () => {
    const db = makeSupabaseClient();
    const req = new Request(
      "http://localhost/api/courses/import",
      {
        method: "POST",
        body: JSON.stringify({
          url: "not-a-valid-url",
          text: "Some course page text",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is too short", async () => {
    const db = makeSupabaseClient();
    const req = new Request(
      "http://localhost/api/courses/import",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/course",
          text: "short",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("lookup mode returns course when existing and on dashboard", async () => {
    const db = makeSupabaseClient();
    // Insert a course first
    await db.from("courses").insert({
      name: "Test Course",
      university_name: "Test University",
      normalized_url: "https://example.com/course",
      review_status: "approved",
      imported_by: "some-user-id",
    });

    const req = new Request(
      "http://localhost/api/courses/import",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/course",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    // @ts-ignore
    const res = await POST(req);
    const body = await res.json();
    expect(body.deduped).toBe(true);
  });
});