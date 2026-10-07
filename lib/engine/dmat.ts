import { z } from "zod";
import { CalendarDateSchema } from "./calendar-day";

export const DMAT_SOURCE = "https://aps-india.de/dmat/";
export const DMAT_FIELD_SOURCE = "https://aps-india.de/wp-content/uploads/2026/06/dMAT_India_Affected_Fields_List.pdf";
export const DMAT_FIELD_VERSION = "1.0";
export const DMAT_FIELD_ENTRIES = ["Engineering", "Commerce / Accounting / Finance / Economics", "Business / Management"] as const;
const Report = z.string().trim().min(1).max(200);

// Reported classification, never title matching or a recognition decision.
// Trade-off: the three published groups suffice for clear reported cases;
// mixed/conditional entries and multiple qualifications require APS review.
const FieldSchema = z.discriminatedUnion("basis", [
  z.object({ basis: z.literal("unknown") }).strict(),
  z.object({ basis: z.literal("list_v1"), entry: z.enum(DMAT_FIELD_ENTRIES),
    version: z.literal(DMAT_FIELD_VERSION), sourceUrl: z.literal(DMAT_FIELD_SOURCE) }).strict(),
  z.object({ basis: z.literal("aps_confirmation"), classification: z.enum(["affected", "unaffected"]), reference: Report }).strict(),
]);
const RegistrationSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("completed"), date: CalendarDateSchema }).strict(),
  z.object({ status: z.literal("not_completed") }).strict(),
  z.object({ status: z.literal("unknown") }).strict(),
]);
// Non-complete dispatch can retain a reported date but cannot yield a complete day.
const DispatchSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("complete"), date: CalendarDateSchema }).strict(),
  z.object({ status: z.literal("incomplete"), date: CalendarDateSchema.optional() }).strict(),
  z.object({ status: z.literal("unknown"), date: CalendarDateSchema.optional() }).strict(),
  z.object({ status: z.literal("not_sent") }).strict(),
]);
const PartnershipSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmed"), kind: z.enum(["exchange", "double_degree", "partnership"]),
    issuerRole: z.enum(["home_institution", "german_partner", "coordinator"]),
    issuer: Report, groupNumber: Report, reference: Report }).strict(),
  z.object({ status: z.literal("none") }).strict(),
  z.object({ status: z.literal("pending") }).strict(),
  z.object({ status: z.literal("unknown") }).strict(),
]);
export const DmatProfileSchema = z.object({
  qualificationScope: z.enum(["single", "multiple", "unknown"]),
  degreeTitle: Report.optional(),
  procedure: z.enum(["relevant_completed", "current_initial", "current_new", "unknown"]).optional(),
  field: FieldSchema.optional(), registration: RegistrationSchema.optional(),
  dispatch: DispatchSchema.optional(), partnership: PartnershipSchema.optional(),
  completedSemesters: z.number().int().min(0).max(100).optional(),
}).strict();
export type DmatProfile = z.infer<typeof DmatProfileSchema>;
