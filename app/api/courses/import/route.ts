import { NextResponse } from "next/server";
import { z } from "zod";

import { extractCourse } from "@/lib/ai/extract-course";
import { normalizeUrl } from "@/lib/courses/import";
import { getCourseByNormalizedUrl, insertCourse } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

const ImportRequestSchema = z.object({
  url: z.string().url("Enter the full course URL (starting with https://)."),
  text: z
    .string()
    .min(200, "Paste the full page text (Ctrl+A on the course page, then copy).")
    .max(200_000, "That text is too long — paste just the course page."),
});

export async function POST(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to import courses." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = ImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const normalizedUrl = normalizeUrl(parsed.data.url);

  // Dedupe: RLS shows approved courses and the user's own pending ones.
  const existing = await getCourseByNormalizedUrl(db, normalizedUrl);
  if (existing) {
    return NextResponse.json({ course: existing, deduped: true });
  }

  const { facts, fieldExtraction, extractionMethod } = await extractCourse(
    parsed.data.url,
    parsed.data.text,
  );
  if (!facts.name && facts.deadlines.length === 0) {
    return NextResponse.json(
      {
        error:
          "This doesn't look like a course page — check the URL and make sure you copied the whole page text.",
      },
      { status: 422 },
    );
  }

  try {
    const course = await insertCourse(db, {
      created_by: user.id,
      source_url: parsed.data.url,
      normalized_url: normalizedUrl,
      review_status: "pending",
      name: facts.name,
      university_name: facts.university,
      degree: facts.degree,
      language: facts.language,
      deadlines: facts.deadlines,
      requirements: facts.requirements,
      tuition: facts.tuition,
      extraction_method: extractionMethod,
      field_extraction: fieldExtraction,
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    // Someone else's pending course is invisible to RLS, so the dedupe check
    // can miss it — the unique index on normalized_url is the backstop.
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "This course was already submitted and is under review." },
        { status: 409 },
      );
    }
    throw error;
  }
}
