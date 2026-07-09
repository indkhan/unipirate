import { Button } from "@/components/ui/button";
import type { Json, Tables } from "@/lib/db/database.types";
import type { ConflictCourse } from "@/lib/db/admin-queries";
import { cn } from "@/lib/utils";

import {
  resolveConflictAction,
  reviewCourseAction,
  updateCourseAction,
} from "./actions";
import { statusBadge } from "./admin-shared";

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

function CourseEditForm({ course }: { course: Tables<"courses"> }) {
  // Per-field-group extraction method — AI-filled groups need human eyes.
  const groups = (course.field_extraction ?? {}) as Record<string, string>;
  const ai = (group: string) => groups[group] === "ai";

  return (
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
  );
}

export function CourseQueue({ courses }: { courses: Tables<"courses">[] }) {
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
          <article key={course.id} className="rounded-lg border p-3">
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
                <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="approved" />
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
                <form action={reviewCourseAction}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="review_status" value="rejected" />
                  <Button type="submit" variant="outline" size="sm">
                    Reject
                  </Button>
                </form>
              </div>
            </div>

            <CourseEditForm course={course} />
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

export function ConflictQueue({ conflicts }: { conflicts: ConflictCourse[] }) {
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
                    <CourseEditForm course={conflict.old_course} />
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
                <CourseEditForm course={conflict} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="false" />
                <Button type="submit" variant="outline" size="sm">
                  Keep existing (reject update)
                </Button>
              </form>
              <form action={resolveConflictAction}>
                <input type="hidden" name="id" value={conflict.id} />
                <input type="hidden" name="keep_new" value="true" />
                <Button type="submit" size="sm">
                  Replace with update (approve)
                </Button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
