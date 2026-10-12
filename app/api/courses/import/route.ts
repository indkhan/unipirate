import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson } from "@/lib/ai/research-course";
import { ResearchDraftSchema, ResearchSeedSchema, ResearchUrlSchema } from "@/lib/courses/research";
import { EMPTY_FACTS, normalizeUrl } from "@/lib/courses/import";
import { parseDaadIdentity } from "@/lib/courses/parse-daad";
import { getCourseById, getCourseByNormalizedUrl, hasApplicationForCourse, insertCourse } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { enqueueResearch } from "@/lib/planning/enqueue";
import { trackCourse } from "@/lib/tasks/materialize";
import type { Tables } from "@/lib/db/database.types";

const recopy = "Return to the DAAD course page and copy the full text, including the programme and university heading.";
const DaadEntrySchema = ResearchUrlSchema.refine(value => {
  const url = new URL(value);
  return ["www2.daad.de", "www.daad.de", "daad.de"].includes(url.hostname)
    && /^\/deutschland\/studienangebote\/international-programmes\/(en|de)\/detail\/[1-9]\d*\/?$/.test(url.pathname);
}, "Use the DAAD International Programmes course-page link.");
const ImportRequestSchema = z.object({
  url: z.string().max(4000, "That link is too long.").pipe(ResearchUrlSchema),
  text: ResearchSeedSchema.shape.text.min(200, recopy).max(200_000, "That text is too long — paste just the full course page.").optional(),
  conflictsWith: z.string().uuid().optional(),
}).strict();

async function savedResearchResponse(db: Awaited<ReturnType<typeof createClient>>, userId: string,
  course: Tables<"courses">, applicationId: string, status: 200 | 201, deduped = false) {
  try {
    const job = await enqueueResearch(db, userId, { applicationId, courseId: course.id });
    return NextResponse.json({ course, applicationId, deduped,
      researchQueued: job.state === "queued" || job.state === "running",
      researchJobId: job.id, researchState: job.state,
      ...(job.state === "failed" ? { researchError: "Course saved. Research failed; retry from the dashboard." } : {}),
    }, { status });
  } catch {
    return NextResponse.json({ course, applicationId, deduped, researchQueued: false,
      researchError: "Course saved. Research could not be queued; retry this import." }, { status });
  }
}

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to import courses." }, { status: 401 });
  let body: unknown;
  try { body = await boundedJson(request, 850_000); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = ImportRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  const { url, text, conflictsWith } = parsed.data;
  const entry = DaadEntrySchema.safeParse(url);
  const host = new URL(url).hostname;
  if ((host === "daad.de" || host.endsWith(".daad.de")) && !entry.success)
    return NextResponse.json({ error: entry.error.issues[0].message }, { status: 400 });
  const normalizedUrl = normalizeUrl(url);
  try {
    // Saved non-DAAD courses remain usable. New catalogue entries require DAAD.
    if (conflictsWith) {
      const oldCourse = await getCourseById(db, conflictsWith);
      if (!oldCourse) return NextResponse.json({ error: "The course this update refers to no longer exists." }, { status: 404 });
      if (!oldCourse.source_url || normalizeUrl(oldCourse.source_url) !== normalizedUrl)
        return NextResponse.json({ error: "Use the same course-page link for this update." }, { status: 400 });
    } else {
      const existing = await getCourseByNormalizedUrl(db, normalizedUrl);
      if (existing) {
        if (!text) return NextResponse.json({ course: existing, deduped: true, onDashboard: await hasApplicationForCourse(db, user.id, existing.id) });
        const applicationId = await trackCourse(db, user.id, existing.id);
        if (existing.review_status === "pending")
          return savedResearchResponse(db, user.id, existing, applicationId, 200, true);
        return NextResponse.json({ course: existing, deduped: true, applicationId });
      }
    }
    if (!entry.success) return NextResponse.json({ error: entry.error.issues[0].message }, { status: 400 });
    if (!text) {
      if (conflictsWith) return NextResponse.json({ error: recopy }, { status: 400 });
      return NextResponse.json({ course: null, deduped: false, onDashboard: false });
    }
    const identity = parseDaadIdentity(text);
    const seed = ResearchSeedSchema.safeParse({ url, text, ...identity });
    if (!seed.success) return NextResponse.json({ error: recopy }, { status: 422 });
    // Identity is a literal catalogue label. Requirements remain unknown until research/review.
    const research = ResearchDraftSchema.parse({ format: "up-course-01/v1", status: "incomplete",
      identity: { name: seed.data.name, university: seed.data.university, source_url: url }, paste: text,
      observations: [], offerings: [], conflicts: [], issues: ["Research has not completed."] });
    const course = await insertCourse(db, {
      imported_by: user.id, source_url: url, normalized_url: normalizedUrl,
      review_status: "pending", conflicts_with: conflictsWith ?? null,
      name: seed.data.name, university_name: seed.data.university,
      location: EMPTY_FACTS.location, degree: EMPTY_FACTS.degree, language: EMPTY_FACTS.language,
      description: EMPTY_FACTS.description, deadlines: [], requirements: [], tuition: null,
      extraction_method: "library", field_extraction: { core: "library", research },
    });
    const applicationId = await trackCourse(db, user.id, course.id);
    return savedResearchResponse(db, user.id, course, applicationId, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key"))
      return NextResponse.json({ error: "This course was already submitted and is under review." }, { status: 409 });
    return NextResponse.json({ error: "Could not finish saving the course to your dashboard. Try again." }, { status: 503 });
  }
}
