import { NextResponse, after } from "next/server";
import { z } from "zod";

import { extractCourse } from "@/lib/ai/extract-course";
import { boundedJson } from "@/lib/ai/research-course";
import { ResearchSeedSchema, ResearchUrlSchema } from "@/lib/courses/research";
import { normalizeUrl, courseResearchStatus } from "@/lib/courses/import";
import { parseDaadText } from "@/lib/courses/parse-daad";
import {
  getCourseById,
  getCourseByNormalizedUrl,
  hasApplicationForCourse,
  insertCourse,
  updateCourseResearch,
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

type SavedCourse = Awaited<ReturnType<typeof insertCourse>>;

/** A pending course without a completed research draft still needs background research. */
function needsResearch(course: Pick<SavedCourse, "review_status" | "field_extraction">): boolean {
  return course.review_status === "pending" && courseResearchStatus(course) !== "draft";
}

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

  // Identity comes from the typed names or the deterministic paste parse;
  // null when neither supplies a usable programme/university label.
  const resolveIdentity = (courseText: string) => {
    const literal = parseDaadText(courseText);
    const seed = ResearchSeedSchema.safeParse({
      url, text: courseText,
      name: identity?.name ?? literal.name, university: identity?.university ?? literal.university,
    });
    return seed.success ? { name: seed.data.name, university: seed.data.university } : null;
  };

  // Research runs after the save response so navigation never blocks on it.
  // A failed refresh keeps the saved row; the dashboard shows it as saved
  // with incomplete research and the sheet re-submission retries it.
  const refreshResearch = async (course: SavedCourse, courseUrl: string, courseText: string, courseIdentity: { name: string; university: string }) => {
    try {
      const extracted = await extractCourse(courseUrl, courseText, undefined, courseIdentity);
      await updateCourseResearch(db, course.id, user.id, {
        location: extracted.facts.location,
        degree: extracted.facts.degree,
        language: extracted.facts.language,
        description: extracted.facts.description,
        deadlines: extracted.facts.deadlines,
        requirements: extracted.facts.requirements,
        tuition: extracted.facts.tuition,
        extraction_method: extracted.extractionMethod,
        field_extraction: { ...extracted.fieldExtraction, research: extracted.research },
      });
    } catch {
      // Kept placeholder row: save succeeded, research did not.
    }
  };

  const trackAndRespond = async (course: SavedCourse, status: 200 | 201, deduped: boolean) => {
    const applicationId = await trackCourse(db, user.id, course.id);
    return NextResponse.json({ course, applicationId, deduped, researchPending: needsResearch(course) }, { status });
  };

  if (conflictsWith) {
    // Update submission: the disputed course must be visible to this user.
    const oldCourse = await getCourseById(db, conflictsWith);
    if (!oldCourse) {
      return NextResponse.json(
        { error: "The course this update refers to no longer exists." },
        { status: 404 },
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "Paste the full page text to submit an update." },
        { status: 400 },
      );
    }
    const literal = parseDaadText(text);
    const courseIdentity = resolveIdentity(text);
    if (!courseIdentity) {
      return NextResponse.json({ error: "Enter the programme and university names, and retain the pasted source for manual review." }, { status: 422 });
    }
    try {
      const course = await insertCourse(db, {
        imported_by: user.id,
        source_url: url,
        normalized_url: normalizedUrl,
        review_status: "pending",
        conflicts_with: conflictsWith,
        name: courseIdentity.name,
        university_name: courseIdentity.university,
        location: literal.location,
        degree: literal.degree,
        language: literal.language,
        description: literal.description,
        deadlines: literal.deadlines,
        requirements: literal.requirements,
        tuition: literal.tuition,
        extraction_method: "library",
        field_extraction: { core: "library" },
      });
      after(() => refreshResearch(course, url, text, courseIdentity));
      return await trackAndRespond(course, 201, false);
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key")) {
        return NextResponse.json(
          { error: "This course was already submitted and is under review." },
          { status: 409 },
        );
      }
      throw error;
    }
  }

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
    if (needsResearch(existing)) {
      const literal = parseDaadText(text);
      const courseIdentity = { name: existing.name ?? literal.name ?? "", university: existing.university_name ?? literal.university ?? "" };
      after(() => refreshResearch(existing, url, text, courseIdentity));
    }
    return await trackAndRespond(existing, 200, true);
  }

  const literal = parseDaadText(text);
  const courseIdentity = resolveIdentity(text);
  if (!courseIdentity) {
    return NextResponse.json({ error: "Enter the programme and university names, and retain the pasted source for manual review." }, { status: 422 });
  }

  try {
    const course = await insertCourse(db, {
      imported_by: user.id,
      source_url: url,
      normalized_url: normalizedUrl,
      review_status: "pending",
      conflicts_with: null,
      name: courseIdentity.name,
      university_name: courseIdentity.university,
      location: literal.location,
      degree: literal.degree,
      language: literal.language,
      description: literal.description,
      deadlines: literal.deadlines,
      requirements: literal.requirements,
      tuition: literal.tuition,
      extraction_method: "library",
      field_extraction: { core: "library" },
    });
    after(() => refreshResearch(course, url, text, courseIdentity));
    return await trackAndRespond(course, 201, false);
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
