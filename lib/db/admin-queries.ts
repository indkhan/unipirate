import { ProgrammeCorrectionSchema, ProgrammeSchema, OfferingSchema, OfferingVersionSchema, CourseCatalogueIdSchema, parseProgrammeRow, parseOfferingRow, parseOfferingVersionRow } from "@/lib/courses/offerings";
// Queries for the /admin review workspace: rule editing/verification, the
// course review queues, and the audit trail. Callers must hold an admin
// session (requireAdmin) — RLS rejects these writes for everyone else.
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/db/database.types";
import { z } from "zod";
import { JsonSchema, DraftSaveSchema, RawRuleSchema, RuleDraftSchema, RuleIdSchema, RuleVersionSchema, jsonEqual, preflightPublication, type RuleDraft, type RuleVersion } from "@/lib/rules/versioning";
import { toCourseTaskDefinition } from "@/lib/tasks/course-tasks";
import {
  generateCourseTasks,
  prepareCourseTaskDefinitionSync,
  type GeneratedTaskUpsert,
} from "@/lib/tasks/generate";
import type { ApplicationWithCourse } from "@/lib/db/queries";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { todayIsoBerlin } from "@/lib/tasks/dates";
import { unwrap } from "@/lib/db/unwrap";
import { hasResearch, readResearch, ResearchReconciliationSchema, prepareResearchReview, ResearchDraftSchema, ObservationSchema, parseResearchAuditEvent } from "@/lib/courses/research";
import { getProgrammeByLegacyCourse, listCourseOfferings } from "@/lib/db/queries";

type Db = Pick<SupabaseClient<Database>, "from">;

export type AdminRuleFilters = {
  country?: string;
  status?: Enums<"rule_status">;
};

export type AdminRule = z.infer<typeof RawRuleSchema> & { draft: RuleDraft; versions: RuleVersion[] };
function adminRule(draft: RuleDraft, versions: RuleVersion[]): AdminRule {
 const raw = RawRuleSchema.parse(draft.raw_snapshot);
 if(raw.id!==draft.rule_id) throw new Error("Workspace logical identity mismatch.");
 return {...raw,draft,versions};
}
export async function listAdminRules(db: Db, filters: AdminRuleFilters): Promise<AdminRule[]> {
 const [draftRows,versionRows]=await Promise.all([
  db.from("rule_drafts").select().order("edited_at",{ascending:false}),
  db.from("rule_versions").select().order("version_number",{ascending:false}),
 ]);
 const versions=z.array(RuleVersionSchema).parse(unwrap(versionRows));
 return z.array(RuleDraftSchema).parse(unwrap(draftRows)).map(draft=>adminRule(draft,versions.filter(v=>v.rule_id===draft.rule_id)))
  .filter(rule=>(!filters.country||rule.country_code===filters.country)&&(!filters.status||rule.status===filters.status));
}
export async function getAdminRuleDraft(db:Db,id:string):Promise<RuleDraft> {
 return RuleDraftSchema.parse(unwrap(await db.from("rule_drafts").select().eq("rule_id",RuleIdSchema.parse(id)).single()));
}
export async function listAdminRuleVersions(db:Db,id:string):Promise<RuleVersion[]> {
 return z.array(RuleVersionSchema).parse(unwrap(await db.from("rule_versions").select().eq("rule_id",RuleIdSchema.parse(id)).order("version_number",{ascending:false})));
}
export async function getAdminRule(db:Db,id:string):Promise<AdminRule> {
 const [draft,versions]=await Promise.all([getAdminRuleDraft(db,id),listAdminRuleVersions(db,id)]);
 return adminRule(draft,versions);
}
export class RuleReviewStaleError extends Error {
 constructor(){super("Rule draft or predecessor changed; reload and review again. Your changes were not published.");}
}
/** Compare-and-save the workspace only. DB stamps its revision, editor and time. */
export async function updateAdminRule(db:Db,input:unknown):Promise<RuleDraft> {
 const values=DraftSaveSchema.parse(input);
 const result=await db.from("rule_drafts").update({raw_snapshot:values.next_snapshot,
  effective_from:values.effective_from,effective_until:values.effective_until,intake_from:values.intake_from,intake_until:values.intake_until})
  .eq("rule_id",values.rule_id).eq("revision",values.revision).eq("raw_snapshot",JSON.stringify(values.raw_snapshot)).select().maybeSingle();
 const row=unwrap(result);if(!row)throw new RuleReviewStaleError();
 return RuleDraftSchema.parse(row);
}
/** Preflight exact raw data, compare review tokens, then append through the protected RPC. */
export async function publishAdminRuleVersion(db:Pick<SupabaseClient<Database>,"from"|"rpc">,input:unknown):Promise<RuleVersion> {
 const approval=preflightPublication(input);
 const [draft,versions]=await Promise.all([getAdminRuleDraft(db,approval.rule_id),listAdminRuleVersions(db,approval.rule_id)]);
 if(draft.revision!==approval.revision||!jsonEqual(draft.raw_snapshot,approval.raw_snapshot)||(versions[0]?.id??null)!==approval.predecessor_id)throw new RuleReviewStaleError();
 preflightPublication({...approval,raw_snapshot:draft.raw_snapshot});
 const response=await db.rpc("publish_rule_version",{p_rule_id:approval.rule_id,p_expected_draft_revision:approval.revision,
  p_expected_raw_snapshot:draft.raw_snapshot,p_expected_predecessor_id:approval.predecessor_id as string,p_approval_status:approval.approval_status});
 // Trade-off: generated RPC types spell the nullable SQL predecessor as string; null is the
 // explicit first-publication token required by the DB contract, never a UUID substitute.
 if(response.error&&/rule (draft|predecessor) changed/.test(response.error.message))throw new RuleReviewStaleError();
 return RuleVersionSchema.parse(unwrap(response));
}

export async function listPendingCourses(
  db: Db,
): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .eq("review_status", "pending")
      // conflict submissions have their own review section
      .is("conflicts_with", null)
      .order("created_at", { ascending: true }),
  );
}

export type ConflictCourse = Tables<"courses"> & {
  old_course: Tables<"courses"> | null;
};

/**
 * Pending "the page changed" submissions with the course they dispute.
 *
 * Trade-off: two round trips rather than a PostgREST embed on the
 * `conflicts_with` self-FK — the generated types resolve that embed to an array
 * rather than a to-one object, so it cannot be typed without a cast that hides
 * whether the shape is right. Upgrade path: switch to
 * `courses!courses_conflicts_with_fkey(*)` once verified against the project.
 */
export async function listConflictCourses(db: Db): Promise<ConflictCourse[]> {
  const updates = unwrap(
    await db
      .from("courses")
      .select()
      .not("conflicts_with", "is", null)
      .order("created_at", { ascending: true }),
  );
  if (updates.length === 0) return [];

  const oldIds = updates
    .map((c) => c.conflicts_with)
    .filter((id): id is string => id !== null);
  const oldCourses = unwrap(
    await db.from("courses").select().in("id", oldIds),
  );
  const byId = new Map(oldCourses.map((c) => [c.id, c]));
  return updates.map((c) => ({
    ...c,
    old_course: c.conflicts_with ? (byId.get(c.conflicts_with) ?? null) : null,
  }));
}

export async function resolveCourseConflict(
  db: Pick<SupabaseClient<Database>, "rpc" | "from">,
  newCourseId: string,
  keepNew: boolean,
): Promise<void> {
  if (keepNew) {
    const incoming = await getAdminCourse(db, newCourseId);
    if (hasResearch(incoming.field_extraction)
      || (incoming.conflicts_with && hasResearch((await getAdminCourse(db, incoming.conflicts_with)).field_extraction))) throw new Error("Research requires explicit review/publication");
  }
  unwrap(
    await db.rpc("resolve_course_conflict", {
      p_new_course_id: newCourseId,
      p_keep_new: keepNew,
    }),
  );
}

export async function updateCourseReviewStatus(
  db: Db,
  id: string,
  reviewStatus: Extract<Enums<"course_review_status">, "approved" | "rejected">,
): Promise<Tables<"courses">> {
  if (reviewStatus === "approved" && hasResearch((await getAdminCourse(db, id)).field_extraction)) throw new Error("Research requires explicit review/publication");
  return unwrap(
    await db
      .from("courses")
      .update({ review_status: reviewStatus })
      .eq("id", id)
      .select()
      .single(),
  );
}

export async function updateAdminCourse(
  db: Db,
  id: string,
  course: Pick<
    TablesUpdate<"courses">,
    | "deadlines"
    | "description"
    | "degree"
    | "extraction_method"
    | "field_extraction"
    | "language"
    | "location"
    | "name"
    | "normalized_url"
    | "requirements"
    | "source_url"
    | "tuition"
    | "university_name"
  >,
): Promise<Tables<"courses">> {
  const existing = await getAdminCourse(db, id);
  if (hasResearch(existing.field_extraction)) {
    if (existing.review_status === "approved") throw new Error("Published research requires a new reviewed offering version; legacy edits cannot republish it");
    const metadata = existing.field_extraction as Record<string, Json>;
    const next = course.field_extraction && typeof course.field_extraction === "object" && !Array.isArray(course.field_extraction) ? course.field_extraction : {};
    course = { ...course, field_extraction: { ...next, research: metadata.research } };
  }
  return unwrap(
    await db.from("courses").update(course).eq("id", id).select().single(),
  );
}

export async function getAdminCourse(db: Db, id: string): Promise<Tables<"courses">> {
  return unwrap(await db.from("courses").select().eq("id", id).single());
}

export async function listAdminCourses(db: Db): Promise<Tables<"courses">[]> {
  return unwrap(
    await db
      .from("courses")
      .select()
      .neq("review_status", "rejected")
      .order("updated_at", { ascending: false }),
  );
}

export async function listAdminCourseTaskDefinitions(
  db: Db,
  courseId: string,
): Promise<Tables<"course_task_definitions">[]> {
  return unwrap(
    await db
      .from("course_task_definitions")
      .select()
      .eq("course_id", courseId)
      .order("sort_order"),
  );
}

export async function insertAdminCourseTaskDefinition(
  db: Db,
  definition: TablesInsert<"course_task_definitions">,
): Promise<Tables<"course_task_definitions">> {
  return unwrap(
    await db.from("course_task_definitions").insert(definition).select().single(),
  );
}

export async function updateAdminCourseTaskDefinition(
  db: Db,
  id: string,
  definition: TablesUpdate<"course_task_definitions">,
): Promise<Tables<"course_task_definitions">> {
  return unwrap(
    await db
      .from("course_task_definitions")
      .update(definition)
      .eq("id", id)
      .select()
      .single(),
  );
}

/**
 * Fans an admin's course-task definition edits out to every student tracking the
 * course, using the same intake-aware generator as initial materialization —
 * SQL cannot do the deadline selection, and a second parser would eventually
 * disagree with the first about which deadline line applies.
 *
 * Trade-off: not transactional. Every write is idempotent and keyed on
 * (user_id, task_key), so a partial failure leaves some students synced and the
 * rest untouched — never a half-written task — and re-saving the definition
 * converges. Upgrade path: hand these pre-computed rows to one security-definer
 * SQL function as jsonb, which buys atomicity while keeping one parser.
 */
export async function syncAdminCourseTaskDefinitions(
  db: Db,
  courseId: string,
): Promise<void> {
  const applications = unwrap(
    await db
      .from("applications")
      .select("*, courses(*)")
      .eq("course_id", courseId)
      .eq("status", "planning"),
  ) as ApplicationWithCourse[];
  if (applications.length === 0) return;

  const userIds = applications.map((application) => application.user_id);
  const [profiles, tasks, definitions] = await Promise.all([
    unwrap(await db.from("profiles").select().in("user_id", userIds)),
    unwrap(await db.from("tasks").select().in("application_id", applications.map((application) => application.id))),
    listAdminCourseTaskDefinitions(db, courseId),
  ]);
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const definitionsForGeneration = definitions.map(toCourseTaskDefinition);

  const today = todayIsoBerlin();
  const upsertRows: GeneratedTaskUpsert[] = [];
  const deactivateKeys: string[] = [];
  const removalPendingKeys: string[] = [];
  const personalUpdates: {
    userId: string;
    taskKey: string;
    adminSnapshot: Json | null;
  }[] = [];

  for (const application of applications) {
    if (!application.courses) continue;
    const profile = profileFromAnswers(profilesByUser.get(application.user_id) ?? null).profile;
    const desired = generateCourseTasks([{
      id: application.id,
      status: application.status,
      course: {
        ...application.courses,
        task_definitions: definitionsForGeneration,
      },
    }], today, profile?.intake);
    const sync = prepareCourseTaskDefinitionSync(
      application.user_id,
      desired,
      tasks.filter((task) => task.application_id === application.id),
    );

    upsertRows.push(...sync.upsertRows);
    deactivateKeys.push(...sync.deactivateKeys);
    removalPendingKeys.push(...sync.removalPendingKeys);
    personalUpdates.push(
      ...sync.personalUpdates.map((update) => ({
        userId: application.user_id,
        ...update,
      })),
    );
  }

  // task_key embeds the application uuid, so the key sets are globally unique;
  // the user_id filters are kept so the planner uses the (user_id, task_key) index.
  if (upsertRows.length > 0) {
    unwrap(await db.from("tasks").upsert(upsertRows, { onConflict: "user_id,task_key" }));
  }
  if (deactivateKeys.length > 0) {
    unwrap(
      await db
        .from("tasks")
        .update({ generated_active: false })
        .in("user_id", userIds)
        .in("task_key", deactivateKeys),
    );
  }
  if (removalPendingKeys.length > 0) {
    unwrap(
      await db
        .from("tasks")
        .update({ admin_change_state: "removal_pending" })
        .in("user_id", userIds)
        .in("task_key", removalPendingKeys),
    );
  }
  // ponytail: one update per personalized copy — each carries a distinct
  // admin_snapshot, so it cannot batch. Fine below ~50 trackers per course.
  for (const update of personalUpdates) {
    unwrap(
      await db
        .from("tasks")
        .update({
          admin_snapshot: update.adminSnapshot,
          admin_change_state: "update_pending",
          generated_active: true,
        })
        .eq("user_id", update.userId)
        .eq("task_key", update.taskKey),
    );
  }
}





export async function listRecentAdminAuditEvents(
  db: Db,
  limit = 25,
): Promise<Tables<"admin_audit_events">[]> {
  return unwrap(
    await db
      .from("admin_audit_events")
      .select()
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

// Catalogue writes; RLS requires the caller's admin session, never service escalation.
export async function insertAdminProgramme(db: Db, input: unknown) {
  const row = unwrap(await db.from("programmes").insert(ProgrammeSchema.parse(input)).select().single());
  return parseProgrammeRow(row);
}
export async function insertAdminCourseOffering(db: Db, input: unknown) {
  const row = unwrap(await db.from("course_offerings").insert(OfferingSchema.parse(input)).select().single());
  return parseOfferingRow(row);
}
export async function insertAdminOfferingVersion(db: Db, input: unknown) {
  const row = unwrap(await db.from("course_offering_versions").insert(OfferingVersionSchema.parse(input)).select().single());
  return parseOfferingVersionRow(row);
}
export async function listAdminOfferingVersions(db: Db, offeringId: string) {
  const rows = unwrap(await db.from("course_offering_versions").select().eq("offering_id", CourseCatalogueIdSchema.parse(offeringId)).order("version", { ascending: false }));
  return rows.map(parseOfferingVersionRow);
}

/** Correct catalogue labels without changing canonical/legacy identity or review state. */
export async function updateAdminProgramme(db: Db, id: string, input: unknown) {
  const programmeId = CourseCatalogueIdSchema.parse(id);
  const correction = ProgrammeCorrectionSchema.parse(input);
  const row = unwrap(await db.from("programmes").update(correction).eq("id", programmeId).select().single());
  return parseProgrammeRow(row);
}

/** Attach once after approval; the DB checks course lifecycle and freezes the link. */
export async function attachAdminProgrammeLegacyCourse(db: Db, id: string, courseId: string) {
  const programmeId = CourseCatalogueIdSchema.parse(id);
  const legacyCourseId = CourseCatalogueIdSchema.parse(courseId);
  const row = unwrap(await db.from("programmes").update({ legacy_course_id: legacyCourseId })
    .eq("id", programmeId).is("legacy_course_id", null).select().single());
  return parseProgrammeRow(row);
}

/** Explicit human publication; caller is requireAdmin(), RLS binds the reviewer.
 * Trade-off: identity/attachment and multiple offerings are separate requests.
 * Each RPC atomically appends one version and its protected journal; an earlier
 * successful offering survives a later failure. Retry may append another version.
 * No automatic retry, conflict cleanup or success is reported after failure.
 */
export async function publishAdminCourseResearch(
  db: Pick<SupabaseClient<Database>, "from" | "rpc">, courseId: string, accepted: string[], reviewerId: string, reconciliation: unknown = [],
) {
  const id = CourseCatalogueIdSchema.parse(courseId);
  const reviewer = CourseCatalogueIdSchema.parse(reviewerId);
  accepted = z.array(z.string().min(1).max(250)).max(400).parse(accepted);
  const submitted = await getAdminCourse(db, id);
  const rawResearch = hasResearch(submitted.field_extraction) ? (submitted.field_extraction as Record<string, Json>).research : undefined;
  const draft = readResearch(submitted.field_extraction);
  if (!draft) throw new Error("No research draft to review");
  if (!draft.offerings.length) throw new Error("Effective offering scope is required before research publication; unscoped captures require manual recovery");
  const decisions = ResearchReconciliationSchema.parse(reconciliation);
  if (new Set(decisions.map(d => d.key)).size !== decisions.length || decisions.some(d => !accepted.includes(d.key))) throw new Error("Invalid reconciliation selection");
  if (accepted.some(key => !decisions.some(d => d.key === key))) throw new Error("Each accepted field requires an explicit reconciliation decision");
  const known = new Set(draft.offerings.flatMap((o, i) => o.facts.map(f => `${i}:${f.key}`)));
  if (new Set(accepted).size !== accepted.length || accepted.some(key => !known.has(key))) throw new Error("Unknown or duplicate research review selection");
  const now = new Date().toISOString();
  // Validate EVERY selection/snapshot before the first mutation.
  const snapshots = draft.offerings.map((scope, index) => {
    const keys = accepted.filter(k => k.startsWith(index + ":")).map(k => k.slice(k.indexOf(":") + 1));
    const localDecisions = decisions.filter(d => d.key.startsWith(index + ":")).map(d => ({ ...d, key: d.key.slice(d.key.indexOf(":") + 1) }));
    prepareResearchReview(draft, index, keys, reviewer, now, localDecisions);
    return { scope, index, keys, decisions: localDecisions };
  });
  const canonicalId = submitted.conflicts_with ?? submitted.id;
  const canonical = submitted.conflicts_with ? await getAdminCourse(db, canonicalId) : submitted;
  if (canonical.name !== draft.identity.name || canonical.university_name !== draft.identity.university) throw new Error("Research identity does not match the canonical course; reconcile labels before review");
  if (canonical.review_status === "rejected") throw new Error("Rejected course cannot publish research");
  if (!submitted.conflicts_with) {
    // Rich assertions stay in explicitly scoped reviewed versions. Do not feed
    // broad pasted/AI wording into legacy task/date parsing on approval.
    unwrap(await db.from("courses").update({ review_status: "approved", degree: null, location: null, language: null, description: null, deadlines: [], requirements: [], tuition: null }).eq("id", canonicalId).select().single());
  } else if (canonical.review_status !== "approved") throw new Error("Research updates require an approved canonical course");
  let programme = await getProgrammeByLegacyCourse(db, canonicalId);
  if (!programme && snapshots.length) programme = await insertAdminProgramme(db, {
    legacy_course_id: canonicalId, name: canonical.name ?? draft.identity.name, university_name: canonical.university_name ?? draft.identity.university,
    degree: submitted.conflicts_with ? canonical.degree : null, source_url: draft.identity.source_url,
  });
  // This untrusted marker guards generic legacy edits; it never authenticates history.
  // Compare complete original metadata so concurrent sibling edits cannot be lost.
  if (!hasResearch(canonical.field_extraction)) {
    const metadata = z.record(z.unknown()).parse(canonical.field_extraction ?? {});
    let marker = db.from("courses").update({ field_extraction: { ...metadata, research: rawResearch } as Json }).eq("id", canonicalId);
    marker = canonical.field_extraction === null ? marker.is("field_extraction", null) : marker.eq("field_extraction", JSON.stringify(canonical.field_extraction));
    const rows = unwrap(await marker.select("id"));
    if (rows.length !== 1) throw new Error("Canonical metadata changed; reload and review again");
  }
  if (programme) {
    const scopes = await listCourseOfferings(db, programme.id);
    for (const snapshot of snapshots) {
      const { scope: capturedScope, facts: pendingFacts, ...payload } = snapshot.scope;
      void capturedScope; void pendingFacts;
      let stored = scopes.find(o => o.intake_term === payload.intake_term && o.intake_year === payload.intake_year && o.applicant_group === payload.applicant_group && JSON.stringify(o.applicability) === JSON.stringify(payload.applicability));
      if (!stored) {
        stored = await insertAdminCourseOffering(db, { ...payload, programme_id: programme.id });
        scopes.push(stored);
      }
      const versions = await listAdminOfferingVersions(db, stored.id);
      const next = Math.max(0, ...versions.map(v => v.version)) + 1;
      const row = unwrap(await db.rpc("publish_course_research_version", {
        p_submitted_course_id: id, p_offering_id: stored.id, p_offering_index: snapshot.index,
        p_version: next, p_accepted_keys: snapshot.keys, p_decisions: snapshot.decisions,
        p_expected_research: rawResearch!,
      }));
      const published = parseOfferingVersionRow(row);
      if (published.review_status !== "verified" || published.offering_id !== stored.id || published.version !== next) throw new Error("Unexpected research publication result");
    }
  }
  // Retain the original identity, existing facts, definitions and task progress.
  // The existing reject-update RPC merges the submitter's tracking link safely.
  if (submitted.conflicts_with) await resolveCourseConflict(db, id, false);
}

/** Admin-only pending recovery. Human source observations are labelled manual,
 * never represented as provider retrieval or reviewer verification. */
export async function saveAdminCourseResearchDraft(db: Db, courseId: string, input: unknown) {
  const id = CourseCatalogueIdSchema.parse(courseId);
  const incoming = z.object({ observations: z.array(ObservationSchema).max(12) }).passthrough().parse(input);
  const existing = await getAdminCourse(db, id);
  if (existing.review_status !== "pending" || !hasResearch(existing.field_extraction)) throw new Error("Only pending research can be repaired; published history requires a new submission");
  const previous = readResearch(existing.field_extraction);
  // Retain every original capture including paste. New web content is a human
  // capture and cannot masquerade as a provider observation.
  const observations = incoming.observations.map(o => o.origin === "web" && !previous?.observations.some(p => JSON.stringify(p) === JSON.stringify(o)) ? { ...o, origin: "manual" as const } : o);
  const retained = (previous?.observations ?? []).filter(o => !observations.some(p => JSON.stringify(p) === JSON.stringify(o)));
  const draft = ResearchDraftSchema.parse({ ...incoming, ...(previous?.paste !== undefined ? { paste: previous.paste } : {}), observations: [...retained, ...observations] });
  if (draft.identity.name !== existing.name || draft.identity.university !== existing.university_name) throw new Error("Research identity must match the course being reviewed");
  const metadata = existing.field_extraction as Record<string, Json>;
  return unwrap(await db.from("courses").update({ field_extraction: { ...metadata, research: ResearchDraftSchema.parse(draft) } }).eq("id", id).eq("field_extraction", JSON.stringify(existing.field_extraction)).select().single());
}

/** Protected history is read only through a caller-scoped admin client/RLS. */
export async function listAdminCourseResearchHistory(db: Db, canonicalId: string, limit = 25) {
  const id = CourseCatalogueIdSchema.parse(canonicalId);
  const rows = unwrap(await db.from("admin_audit_events")
    .select("id,row_id,table_name,action,actor_user_id,created_at,course_reconciliation")
    .eq("row_id", id).not("course_reconciliation", "is", null)
    .order("created_at", { ascending: false }).limit(z.number().int().min(1).max(100).parse(limit)));
  return rows.map(row => {
    const record = parseResearchAuditEvent(row);
    return record.status === "available" && record.canonicalId !== id ? { status: "unavailable" as const, id: record.id } : record;
  });
}

/** Complete authorized population, including previously uncovered profiles.
 * Page until empty; do not mistake PostgREST's response cap for the population. */
export async function listAdminImpactProfiles(db: Db) {
  const rows: {user_id: string; answers: Json}[] = [];
  for (let offset = 0; ; ) {
    const response = await db.from("profiles").select("user_id, answers", {count: "exact"}).order("user_id").range(offset, offset + 499);
    const page = z.array(z.object({user_id: RuleIdSchema, answers: JsonSchema})).parse(
      unwrap(response));
    rows.push(...page); offset += page.length;
    if (response.count !== null ? offset >= response.count : page.length < 500) return rows;
    if (!page.length) throw new Error("Incomplete impact population read.");
  }
}

/** Write replacement vectors before retiring hints. Retrieval never trusts old text. */
export async function replaceAdminKbChunks(db: Db, input: unknown) {
  const rows = z.array(z.object({source_type: z.literal("rule"), rule_id: RuleIdSchema, slug: z.string().min(1), title: z.string(), content: z.string(), source_url: z.string().url(), last_verified_at: z.string().datetime({offset: true}).nullable(), country_code: z.string().nullable(), embedding: z.string().refine(value => {try {return z.array(z.number().finite()).min(1).safeParse(JSON.parse(value)).success;} catch {return false;}})}).strict()).parse(input);
  const existing = unwrap(await db.from("kb_chunks").select("id, slug"));
  if (rows.length) unwrap(await db.from("kb_chunks").upsert(rows, {onConflict: "slug"}));
  const keep = new Set(rows.map(row => row.slug));
  const stale = existing.filter(row => !keep.has(row.slug)).map(row => row.id);
  if (stale.length) unwrap(await db.from("kb_chunks").delete().in("id", stale));
}
