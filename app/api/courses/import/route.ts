import { NextResponse } from "next/server";
import { z } from "zod";

import { extractCourse } from "@/lib/ai/extract-course";
import { boundedJson } from "@/lib/ai/research-course";
import { ResearchDraftSchema, ResearchUrlSchema } from "@/lib/courses/research";
import type { ExtractedCourse } from "@/lib/ai/extract-course";
import { normalizeUrl } from "@/lib/courses/import";
import {
  getCourseById,
  getCourseByNormalizedUrl,
  hasApplicationForCourse,
  insertCourse,
} from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { trackCourse } from "@/lib/tasks/materialize";

const ImportRequestSchema = z.object({
  url: ResearchUrlSchema,
  identity: z.object({ name: z.string().trim().min(1).max(240), university: z.string().trim().min(1).max(240) }).strict().optional(),
  // Absent text = lookup only: "does this URL already have a course?"
  text: z
    .string()
    .min(200, "Paste the full page text (Ctrl+A on the course page, then copy).")
    .max(200_000, "That text is too long — paste just the course page.")
    .optional(),
  // Set = "the page changed" update submission against that existing course.
  conflictsWith: z.string().uuid().optional(),
}).strict();

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
    body = await boundedJson(request, 850_000);
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
  const { url, text, conflictsWith, identity } = parsed.data;

  const normalizedUrl = normalizeUrl(url);

  if (conflictsWith) {
    // Update submission: the disputed course must be visible to this user.
    const oldCourse = await getCourseById(db, conflictsWith);
    if (!oldCourse) {
      return NextResponse.json(
        { error: "The course this update refers to no longer exists." },
        { status: 404 },
      );
    }
  } else {
    // Dedupe: RLS shows approved courses and the user's own pending ones.
    const existing = await getCourseByNormalizedUrl(db, normalizedUrl);
    if (!text) {
      // Lookup mode for the add-course sheet.
      const onDashboard = existing
        ? await hasApplicationForCourse(db, user.id, existing.id)
        : false;
      return NextResponse.json({
        course: existing,
        deduped: existing !== null,
        onDashboard,
      });
    }
    if (existing) {
      await trackCourse(db, user.id, existing.id);
      return NextResponse.json({ course: existing, deduped: true });
    }
  }

  if (!text) {
    return NextResponse.json(
      { error: "Paste the full page text to submit an update." },
      { status: 400 },
    );
  }

  let extracted: ExtractedCourse;
  try { extracted = await extractCourse(url, text, undefined, identity); }
  catch {
    return NextResponse.json({ error: "Enter the programme and university names, and retain the pasted source for manual review." }, { status: 422 });
  }
  const { facts, fieldExtraction, extractionMethod } = extracted;
  const research = ResearchDraftSchema.parse(extracted.research);
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
      imported_by: user.id,
      source_url: url,
      normalized_url: normalizedUrl,
      review_status: "pending",
      conflicts_with: conflictsWith ?? null,
      name: facts.name,
      university_name: facts.university,
      location: facts.location,
      degree: facts.degree,
      language: facts.language,
      description: facts.description,
      deadlines: facts.deadlines,
      requirements: facts.requirements,
      tuition: facts.tuition,
      extraction_method: extractionMethod,
      field_extraction: { ...fieldExtraction, research },
    });
    await trackCourse(db, user.id, course.id);
    return NextResponse.json({ course, researchStatus: research.status }, { status: 201 });
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
