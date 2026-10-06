// Pure contracts. Captured wording is never normalized or trimmed.
import { z } from "zod";
const text = z.string().refine((value) => value.trim().length > 0, "Must not be blank");
const timestamp = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const httpUrl = z.string().url().refine((value) => /^https?:\/\//.test(value), "HTTP(S) source required");
export const CourseRouteSchema = z.enum(["direct", "uni_assist", "vpd_then_university", "unresolved"]);
export const ProgrammeSchema = z.object({
  legacy_course_id: uuid.nullable(), name: text, university_name: text,
  degree: text.nullable(), source_url: httpUrl,
}).strict();
export const ProgrammeCorrectionSchema = ProgrammeSchema.omit({ legacy_course_id: true }).partial()
  .refine((value) => Object.keys(value).length > 0, "Provide a correction");
export const OfferingSchema = z.object({
  programme_id: uuid, intake_term: z.enum(["summer", "winter"]),
  intake_year: z.number().int().min(1).max(9999), applicant_group: text,
  // Explicit reviewed applicability vocabulary belongs to the future resolver.
  applicability: z.record(z.string(), z.union([text, z.boolean(), z.array(text)]) ),
}).strict();
export const CourseEvidenceSchema = z.object({
  source_url: httpUrl, source_quote: text, retrieved_at: timestamp,
  last_verified_at: timestamp.nullable(), verified_by: uuid.nullable(),
  source_hash: text.nullable(),
}).strict().superRefine((value, ctx) => {
  if ((value.last_verified_at === null) !== (value.verified_by === null)) ctx.addIssue({ code: "custom", message: "Verification requires both reviewer and timestamp" });
  if (value.last_verified_at && Date.parse(value.last_verified_at) < Date.parse(value.retrieved_at)) ctx.addIssue({ code: "custom", message: "Verification precedes retrieval" });
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
export const OfferingFactSchema = z.object({
  key: text, kind: z.enum(["route", "deadline", "language", "prerequisite", "fee", "document", "description"]),
  status: z.enum(["pending", "verified", "rejected", "unresolved"]),
  verbatim: text.nullable(), applicability: text, evidence: z.array(CourseEvidenceSchema),
  route: CourseRouteSchema.nullable(),
  deadline_kind: z.enum(["application_opening", "application_closing", "document_supplement", "enrolment", "vpd_preparation_target"]).nullable(),
  date: date.nullable(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).nullable(),
  timezone: text.nullable(),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.kind === "route" ? value.route === null : value.route !== null) fail("Route belongs only to route facts");
  if (value.kind === "deadline" ? value.deadline_kind === null : [value.deadline_kind, value.date, value.time, value.timezone].some((v) => v !== null)) fail("Deadline fields belong only to deadline facts");
  if (value.time !== null && value.date === null) fail("Time requires an explicit date");
  // A source can give a local time without specifying a timezone. Preserve that unknown.
  if (value.timezone !== null && value.time === null) fail("Timezone requires an explicit time");
  if (value.status !== "verified" && [value.date, value.time, value.timezone].some((v) => v !== null)) fail("Only reviewed dates may drive planning");
  if (value.status === "verified") {
    if (!value.verbatim || !value.evidence.some((e) => e.last_verified_at && e.source_quote.includes(value.verbatim!))) fail("Verified wording needs verified literal evidence");
    if (value.route === "unresolved") fail("An unresolved route cannot be verified");
  }
  if (value.status === "unresolved" && value.route !== null && value.route !== "unresolved") fail("Unresolved route must remain unresolved");
});
export const OfferingVersionSchema = z.object({
  offering_id: uuid, version: z.number().int().positive(),
  review_status: z.enum(["pending", "verified", "rejected"]),
  reviewed_at: timestamp.nullable(), reviewed_by: uuid.nullable(),
  facts: z.array(OfferingFactSchema),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.review_status === "pending" ? value.reviewed_at !== null || value.reviewed_by !== null : value.reviewed_at === null || value.reviewed_by === null) fail("Review state and metadata disagree");
  if (new Set(value.facts.map((f) => f.key)).size !== value.facts.length) fail("Duplicate fact identity");
  if (value.review_status === "verified" && value.facts.some((f) => !["verified", "unresolved"].includes(f.status))) fail("Pending/rejected fields cannot be published as reviewed");
});
export type Programme = z.infer<typeof ProgrammeSchema>;
export type CourseOffering = z.infer<typeof OfferingSchema>;
export type OfferingVersion = z.infer<typeof OfferingVersionSchema>;
const recordMetadata = z.object({ id: uuid, created_at: timestamp }).strict();
// Strict payloads are validated independently from database-generated metadata.
export function parseProgrammeRow(row: unknown): Programme & { id: string; created_at: string } {
  const { id, created_at, ...payload } = z.object({ id: uuid, created_at: timestamp }).passthrough().parse(row);
  return { ...ProgrammeSchema.parse(payload), id, created_at };
}
export function parseOfferingRow(row: unknown): CourseOffering & { id: string; created_at: string } {
  const { id, created_at, ...payload } = recordMetadata.passthrough().parse(row);
  return { ...OfferingSchema.parse(payload), id, created_at };
}
export function parseOfferingVersionRow(row: unknown): OfferingVersion & { id: string; created_at: string } {
  const { id, created_at, ...payload } = recordMetadata.passthrough().parse(row);
  return { ...OfferingVersionSchema.parse(payload), id, created_at };
}
export const CourseCatalogueIdSchema = uuid;
