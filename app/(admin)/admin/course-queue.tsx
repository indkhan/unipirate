import { isDeepStrictEqual } from "node:util";

import { Button } from "@/components/ui/button";
import type { Json, Tables } from "@/lib/db/database.types";
import type { ConflictCourse } from "@/lib/db/admin-queries";
import { courseTaskAdminPreview, deriveCourseTaskCandidates } from "@/lib/tasks/course-tasks";
import { cn } from "@/lib/utils";
import { hasResearch, researchNeedsReconciliation, readResearch, type ResearchAuditRecord } from "@/lib/courses/research";

import {
  resolveConflictAction,
  adoptCourseTaskSourceChangeAction,
  reviewCourseAction,
  publishCourseResearchAction,
  saveCourseResearchDraftAction,
  retireCourseTaskAction,
  saveCourseTaskAction,
  updateCourseAction,
} from "./actions";
import { statusBadge } from "./admin-shared";
import { ActionButton } from "./action-button";
import { ResearchHistory, UntrustedLegacyReconciliation } from "./research-history";
import { ResearchFactReview } from "./research-review-field";

function compactJson(value: Json | null): string {
  if (value === null) return "Not extracted";
  return JSON.stringify(value);
}

function formatEditableJson(value: Json | null): string {
  return JSON.stringify(value, null, 2);
}

function formatEditableArrayJson(value: Json | null): string {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function CourseEditField({
  label,
  name,
  defaultValue,
  highlighted,
  multiline,
}: {
  label: string;
  name: string;
  defaultValue: string;
  highlighted: boolean;
  multiline?: boolean;
}) {
  const className = cn(
    "rounded-md border bg-background px-2 text-sm",
    highlighted && "border-amber-300 bg-amber-50",
    multiline ? "min-h-20 py-2 font-mono text-xs" : "h-8",
  );

  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-medium uppercase text-muted-foreground">
      {label}
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={4}
          className={className}
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className={className}
        />
      )}
    </label>
  );
}

function CourseTaskForm({
  course,
  task,
}: {
  course: Tables<"courses">;
  task: {
    id?: string;
    kind: "submission" | "requirement" | "custom";
    sourceKey: string | null;
    titleTemplate: string;
    description: string | null;
    sourceUrl: string | null;
    dueMode: "source_deadline" | "fixed_date" | "none";
    dueDate: string | null;
    sourceSnapshot: Json | null;
    sortOrder: number;
    retiredAt?: string | null;
  };
}) {
  const preview = courseTaskAdminPreview(task, course.name ?? course.university_name ?? "this course");
  return (
    <div className="rounded-md border p-2">
      <form action={saveCourseTaskAction} className="grid gap-2">
        <input type="hidden" name="id" value={task.id ?? ""} />
        <input type="hidden" name="course_id" value={course.id} />
        <input type="hidden" name="kind" value={task.kind} />
        <input type="hidden" name="source_key" value={task.sourceKey ?? ""} />
        <input type="hidden" name="source_snapshot" value={JSON.stringify(task.sourceSnapshot)} />
        <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_100px]">
          <label className="grid min-w-0 gap-1 text-xs font-medium">Student task title<input name="title_template" defaultValue={preview.title} className="h-8 w-full min-w-0 rounded border bg-background px-2 text-sm" /></label>
          <label className="grid min-w-0 gap-1 text-xs font-medium">Order<input name="sort_order" type="number" min="1" defaultValue={task.sortOrder} className="h-8 w-full min-w-0 rounded border bg-background px-2 text-sm" /></label>
        </div>
        <textarea name="description" defaultValue={task.description ?? ""} rows={2} className="rounded border bg-background p-2 text-sm" placeholder="Notes" />
        <div className="grid gap-2 md:grid-cols-3">
          <input name="source_url" type="url" defaultValue={task.sourceUrl ?? ""} className="h-8 rounded border bg-background px-2 text-sm" placeholder="Source URL" />
          <select name="due_mode" defaultValue={task.dueMode} className="h-8 rounded border bg-background px-2 text-sm">
            <option value="source_deadline">Official deadline</option>
            <option value="fixed_date">Fixed date</option>
            <option value="none">No date</option>
          </select>
          <input name="due_date" type="date" defaultValue={task.dueDate ?? ""} className="h-8 rounded border bg-background px-2 text-sm" />
        </div>
        {preview.sourceDeadlineLines.length > 0 && <div className="rounded-md border border-[var(--verified-line)] bg-[var(--verified-tint)] p-2 text-xs text-[var(--ink)]"><strong>Official deadline shown to students</strong><ul className="mt-1 list-disc pl-4">{preview.sourceDeadlineLines.map((line) => <li key={line}>{line}</li>)}</ul></div>}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{task.kind}{task.sourceKey ? ` · ${task.sourceKey}` : ""}</span>
          <Button type="submit" variant="outline" size="sm">Save task</Button>
        </div>
      </form>
      {task.id && !task.retiredAt ? (
        <form action={retireCourseTaskAction} className="mt-2 text-right">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="course_id" value={course.id} />
          <ActionButton variant="destructive" pendingText="Removing…" confirm={`Remove “${task.titleTemplate}” from future student task lists? Students using an edited copy will keep their changes.`}>Remove task</ActionButton>
        </form>
      ) : null}
    </div>
  );
}

function CourseTaskEditor({
  course,
  definitions,
}: {
  course: Tables<"courses">;
  definitions: Tables<"course_task_definitions">[];
}) {
  const existingKeys = new Set(definitions.map((definition) => definition.source_key));
  const candidates = deriveCourseTaskCandidates(course).filter(
    (candidate) => !existingKeys.has(candidate.sourceKey),
  );
  const displayed = definitions.map((definition) => ({
    id: definition.id,
    kind: definition.kind,
    sourceKey: definition.source_key,
    titleTemplate: definition.title_template,
    description: definition.description,
    sourceUrl: definition.source_url,
    dueMode: definition.due_mode,
    dueDate: definition.due_date,
    sourceSnapshot: definition.source_snapshot,
    sortOrder: definition.sort_order,
    retiredAt: definition.retired_at,
  }));

  return (
    <section className="mt-3 grid gap-2 border-t pt-3">
      <div>
        <h4 className="text-sm font-semibold">Course tasks</h4>
        <p className="text-xs text-muted-foreground">Generated deadline and requirement tasks, plus custom tasks. Pending-course edits publish on approval.</p>
      </div>
      {displayed.map((task) => <CourseTaskForm key={task.id} course={course} task={task} />)}
      {candidates.map((candidate, index) => (
        <CourseTaskForm key={candidate.sourceKey} course={course} task={{
          kind: candidate.kind,
          sourceKey: candidate.sourceKey,
          titleTemplate: candidate.titleTemplate,
          description: candidate.description,
          sourceUrl: candidate.sourceUrl,
          dueMode: candidate.dueMode,
          dueDate: null,
          sourceSnapshot: candidate.sourceSnapshot as Json,
          sortOrder: 30 + definitions.length + index,
        }} />
      ))}
      <details className="rounded-md border bg-muted/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--route-blue)]">Add custom task</summary>
        <p className="mt-1 text-xs text-muted-foreground">Create a task that is not generated from the course source.</p>
        <div className="mt-3"><CourseTaskForm course={course} task={{
          kind: "custom", sourceKey: null, titleTemplate: "", description: null,
          sourceUrl: null, dueMode: "none", dueDate: null, sourceSnapshot: null,
          sortOrder: 30 + definitions.length + candidates.length,
        }} /></div>
      </details>
    </section>
  );
}

function CourseEditForm({ course, definitions }: { course: Tables<"courses">; definitions: Tables<"course_task_definitions">[] }) {
  // Per-field-group extraction method — AI-filled groups need human eyes.
  const groups = (course.field_extraction ?? {}) as Record<string, string>;
  const ai = (group: string) => groups[group] === "ai";

  return (
    <>
    <form action={updateCourseAction} className="mt-3 grid gap-3">
      <input type="hidden" name="id" value={course.id} />
      <label className="grid gap-1 text-[11px] font-medium uppercase text-muted-foreground">
        Source URL
        <input
          name="source_url"
          type="url"
          required
          defaultValue={course.source_url}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <CourseEditField
          label="Name"
          name="name"
          defaultValue={course.name ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="University"
          name="university_name"
          defaultValue={course.university_name ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Location"
          name="location"
          defaultValue={course.location ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Degree"
          name="degree"
          defaultValue={course.degree ?? ""}
          highlighted={ai("core")}
        />
        <CourseEditField
          label="Language"
          name="language"
          defaultValue={course.language ?? ""}
          highlighted={ai("core")}
        />
      </div>

      <CourseEditField
        label="Description/content"
        name="description"
        defaultValue={course.description ?? ""}
        highlighted={ai("description")}
        multiline
      />

      <div className="grid gap-2 lg:grid-cols-3">
        <CourseEditField
          label="Tuition JSON"
          name="tuition"
          defaultValue={formatEditableJson(course.tuition)}
          highlighted={ai("tuition")}
          multiline
        />
        <CourseEditField
          label="Deadlines JSON"
          name="deadlines"
          defaultValue={formatEditableArrayJson(course.deadlines)}
          highlighted={ai("deadlines")}
          multiline
        />
        <CourseEditField
          label="Requirements JSON"
          name="requirements"
          defaultValue={formatEditableArrayJson(course.requirements)}
          highlighted={ai("requirements")}
          multiline
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Current extracted values: tuition{" "}
          <span className="font-mono">{compactJson(course.tuition)}</span>
        </p>
        <Button type="submit" variant="outline" size="sm">
          Save edits
        </Button>
      </div>
    </form>
    <CourseTaskEditor course={course} definitions={definitions} />
    </>
  );
}

export function CourseQueue({ courses, definitionsByCourse, researchHistoryByCourse = new Map() }: { courses: Tables<"courses">[]; definitionsByCourse: Map<string, Tables<"course_task_definitions">[]>; researchHistoryByCourse?: Map<string, ResearchAuditRecord[]> }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Course review queue</h2>
        <span className="text-xs text-muted-foreground">
          {courses.length} pending
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {courses.map((course) => (
          <article key={course.id} className="min-w-0 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    {course.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(course.extraction_method ?? "unknown")}
                </div>
                <a
                  href={course.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                >
                  {course.source_url}
                </a>
              </div>
              <div className="flex gap-2">
                {!hasResearch(course.field_extraction) && <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="approved" />
                  <ActionButton pendingText="Approving…">Approve course</ActionButton>
                </form>}
                <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="rejected" />
                  <ActionButton variant="destructive" pendingText="Rejecting…" confirm={`Reject “${course.name ?? "this course"}”? It will remain private and leave this queue.`}>Reject course</ActionButton>
                </form>
              </div>
            </div>

            <CourseEditForm course={course} definitions={definitionsByCourse.get(course.id) ?? []} />
            <ResearchReview course={course} history={researchHistoryByCourse.get(course.id) ?? []} />
          </article>
        ))}
      </div>

      {courses.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No pending courses need review.
        </p>
      )}
    </section>
  );
}

function ResearchReview({ course, history }: { course: Tables<"courses">; history: ResearchAuditRecord[] }) {
  const legacy = course.field_extraction && typeof course.field_extraction === "object" && !Array.isArray(course.field_extraction) ? course.field_extraction.research_reconciliations : undefined;
  const journal = <><ResearchHistory records={history} /><UntrustedLegacyReconciliation value={legacy} /></>;
  if (!hasResearch(course.field_extraction)) return journal;
  let draft;
  try { draft = readResearch(course.field_extraction); }
  catch { return <>{journal}<p role="alert">Invalid research capture. Publication blocked; retain the manual source and submit a corrected draft.</p></>; }
  if (!draft) return journal;
  const needsReconciliation = researchNeedsReconciliation(draft);
  return <>{journal}<form action={publishCourseResearchAction} className="mt-4 grid gap-3 rounded border p-3">
    <input type="hidden" name="id" value={course.id} />
    <h4 className="font-semibold">Research: {draft.status} · pending human review</h4>
    <p className="text-sm">Open the official sources and check programme identity, actual effective intake and applicant scope before accepting a fact. Unchecked facts publish as unresolved. No dates or tasks are inferred from this draft.</p>
    {needsReconciliation && <p className="text-amber-700">The AI context omitted captured content. Compare every full captured source before deciding each accepted field; known conflicts require explicit correction first.</p>}
    {draft.issues.map(issue => <p className="text-sm text-amber-700" key={issue}>{issue}</p>)}
    {draft.offerings.length === 0 && <p>Publication requires supported effective intake and applicant scope. Repair the offering scope before publishing; sourced captures and manual pasted values remain available for review.</p>}
    {!!draft.unscoped?.length && <details><summary>Sourced captures with unknown effective intake (not publishable)</summary>{draft.unscoped.map(f => <div key={f.key}><p>{f.verbatim} · {f.applicability}</p>{f.evidence.map((e, i) => <blockquote key={i}><q>{e.source_quote}</q> · <a href={e.source_url} target="_blank" rel="noreferrer">{e.source_url}</a> · retrieved {e.retrieved_at}</blockquote>)}</div>)}</details>}
    {draft.offerings.map((offering, index) => <fieldset key={index} className="grid gap-2 rounded border p-3">
      <legend>{offering.intake_term} {offering.intake_year} · {offering.applicant_group}</legend>
      <p className="text-sm">Effective scope: <q>{offering.scope.source_quote}</q> · <a href={offering.scope.source_url} target="_blank" rel="noreferrer" className="underline">Official scope source</a></p>
      {offering.facts.map(fact => <div key={fact.key} className="border-b pb-2 text-sm">
        <ResearchFactReview offeringIndex={index} factKey={fact.key} verbatim={fact.verbatim} status={fact.status} />
        <p>Applicability: {fact.applicability}</p>
        {fact.evidence.map((e, i) => <blockquote key={i}><q>{e.source_quote}</q> · <a href={e.source_url} target="_blank" rel="noreferrer" className="underline">{e.source_url}</a> · retrieved {e.retrieved_at}</blockquote>)}
        {draft.conflicts.filter(c => c.offering === index && c.key === fact.key).map(c => <p key={c.key} className="text-amber-700">Source conflict: {c.alternatives.map(a => a.verbatim).join(" / ")}. Remains unresolved.</p>)}
      </div>)}
    </fieldset>)}
    <details><summary>Captured sources and manual fallback</summary>{draft.paste && <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{draft.paste}</pre>}{draft.observations.map((o, i) => <article key={i}><p>{o.origin} · {o.url} · captured {o.retrieved_at}</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{o.content}</pre></article>)}</details>
    <label className="flex gap-2 text-sm"><input type="checkbox" name="attest" value="yes" required />I checked the current official sources, identity, applicability and effective intake of every accepted assertion. Unaccepted facts remain unknown.</label>
    <ActionButton pendingText="Publishing…" confirm="Publish these explicitly reviewed facts? Unaccepted assertions stay unresolved; existing task progress is retained.">Publish reviewed research</ActionButton>
  </form>
  <details className="mt-3"><summary>Manual research recovery (JSON)</summary>
    <p className="text-sm">Capture current official source text with its real URL and retrieval time using origin &quot;manual&quot;. Correct scope/wording only when those observations support it; keep unknown scope in unscoped captures. Resolve a conflict explicitly before removing its conflict entry. Saving does not verify or publish any fact.</p>
    <form action={saveCourseResearchDraftAction} className="grid gap-2">
      <input type="hidden" name="id" value={course.id} />
      <label>Pending research draft<textarea name="draft" required maxLength={850000} defaultValue={JSON.stringify(draft, null, 2)} className="min-h-60 w-full rounded border p-2 font-mono text-xs" /></label>
      <ActionButton pendingText="Saving…">Save pending research recovery</ActionButton>
    </form>
  </details></>;
}

export function CourseTaskLibrary({
  courses,
  definitionsByCourse,
}: {
  courses: Tables<"courses">[];
  definitionsByCourse: Map<string, Tables<"course_task_definitions">[]>;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Approved course task library</h2>
          <p className="text-xs text-muted-foreground">Task edits publish to all students currently planning that course.</p>
        </div>
        <span className="text-xs text-muted-foreground">{courses.length} approved</span>
      </div>
      <div className="mt-3 grid gap-3">
        {courses.map((course) => (
          <article key={course.id} className="rounded-lg border p-3">
            <h3 className="text-sm font-semibold">{course.name ?? "Untitled course"}</h3>
            <p className="text-xs text-muted-foreground">{course.university_name ?? "University not extracted"}</p>
            <SourceChanges course={course} definitions={definitionsByCourse.get(course.id) ?? []} />
            <CourseTaskEditor course={course} definitions={definitionsByCourse.get(course.id) ?? []} />
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Live diff between what the course facts propose and the current definitions.
 * No stored queue: a difference stays visible until it is adopted or the
 * definition itself is edited, which is the honest state — students keep the
 * current task until an admin acts either way.
 */
function SourceChanges({
  course,
  definitions,
}: {
  course: Tables<"courses">;
  definitions: Tables<"course_task_definitions">[];
}) {
  const candidates = deriveCourseTaskCandidates(course);
  const bySourceKey = new Map(
    definitions
      .filter((definition) => definition.source_key)
      .map((definition) => [definition.source_key!, definition]),
  );
  const candidateKeys = new Set(candidates.map((candidate) => candidate.sourceKey));
  const changes = [
    ...candidates.flatMap((candidate) => {
      if (!candidate.sourceKey) return [];
      const definition = bySourceKey.get(candidate.sourceKey);
      if (!definition) {
        return [{ key: candidate.sourceKey, label: "new", current: null, proposed: candidate.sourceSnapshot }];
      }
      if (definition.retired_at) return [];
      return isDeepStrictEqual(definition.source_snapshot, candidate.sourceSnapshot)
        ? []
        : [{ key: candidate.sourceKey, label: "changed", current: definition.source_snapshot, proposed: candidate.sourceSnapshot }];
    }),
    ...definitions.flatMap((definition) =>
      definition.source_key && !definition.retired_at && !candidateKeys.has(definition.source_key)
        ? [{ key: definition.source_key, label: "removed", current: definition.source_snapshot, proposed: null }]
        : [],
    ),
  ];
  if (changes.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2">
      <p className="text-xs font-semibold text-amber-700">Official source differs from the current tasks. Students keep the current task until you act.</p>
      {changes.map((change) => (
        <article key={change.key} className="rounded border p-3 text-sm">
          <p><strong>{change.label}</strong> · {change.key}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2"><div className="rounded bg-muted p-3"><span className="text-xs font-semibold uppercase text-muted-foreground">Current task source value</span><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{change.current ? JSON.stringify(change.current, null, 2) : "None"}</pre></div><div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"><span className="text-xs font-semibold uppercase">Proposed source value</span><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{change.proposed ? JSON.stringify(change.proposed, null, 2) : "Removed"}</pre></div></div>
          <form action={adoptCourseTaskSourceChangeAction} className="mt-2">
            <input type="hidden" name="courseId" value={course.id} />
            <input type="hidden" name="sourceKey" value={change.key} />
            <ActionButton pendingText="Applying…" confirm="Use this official source change? Student tasks may receive an update decision.">Use source change</ActionButton>
          </form>
        </article>
      ))}
    </div>
  );
}

export function ConflictQueue({ conflicts, researchHistoryByCourse = new Map() }: { conflicts: ConflictCourse[]; researchHistoryByCourse?: Map<string, ResearchAuditRecord[]> }) {
  if (conflicts.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Conflicting courses</h2>
        <span className="text-xs text-muted-foreground">
          {conflicts.length} to resolve
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        A user reported that the saved course is outdated and submitted the
        page again. Compare, edit either side if needed, then keep one — user
        dashboards move to the survivor automatically.
      </p>

      <div className="mt-3 grid gap-3">
        {conflicts.map((conflict) => (
          <article key={conflict.id} className="rounded-lg border p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="min-w-0 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    Existing: {conflict.old_course?.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(conflict.old_course?.review_status ?? "missing")}
                </div>
                {conflict.old_course ? (
                  <>
                    <a
                      href={conflict.old_course.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                    >
                      {conflict.old_course.source_url}
                    </a>
                    <CourseEditForm course={conflict.old_course} definitions={[]} />
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    The disputed course no longer exists.
                  </p>
                )}
              </div>

              <div className="min-w-0 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">
                    Update: {conflict.name ?? "Untitled course"}
                  </h3>
                  {statusBadge(conflict.extraction_method ?? "unknown")}
                </div>
                <a
                  href={conflict.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-2"
                >
                  {conflict.source_url}
                </a>
                    <CourseEditForm course={conflict} definitions={[]} />
                    <ResearchReview course={conflict} history={researchHistoryByCourse.get(conflict.id) ?? []} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="false" />
                <ActionButton pendingText="Resolving…" variant="outline" confirm="Keep the existing course and reject this submission? Linked dashboards remain on the existing course.">Keep existing (reject update)</ActionButton>
              </form>
              {!hasResearch(conflict.field_extraction) && <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="true" />
                <ActionButton pendingText="Replacing…" confirm="Replace the existing course with this update? Linked dashboards will move to the submitted record.">Replace with update (approve)</ActionButton>
              </form>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
