import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  listAdminRules,
  listPendingCourses,
  listRecentAdminAuditEvents,
  type AdminRuleFilters,
} from "@/lib/db/admin-queries";
import type { Enums, Json, Tables } from "@/lib/db/database.types";
import { getCountries } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { cn } from "@/lib/utils";

import {
  reverifyRuleAction,
  reviewCourseAction,
  updateCourseAction,
  updateRuleAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ruleStatuses = [
  "draft",
  "beta",
  "verified",
] as const satisfies readonly Enums<"rule_status">[];

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRuleStatus(
  value: string | undefined,
): Enums<"rule_status"> | undefined {
  if (ruleStatuses.some((status) => status === value)) {
    return value as Enums<"rule_status">;
  }
  return undefined;
}

async function requireAdminDb() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");

  return db;
}

function formatJson(value: Json): string {
  return JSON.stringify(value, null, 2);
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isOlderThanSixMonths(value: string | null): boolean {
  if (!value) return true;

  const verifiedAt = new Date(value);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return verifiedAt < sixMonthsAgo;
}

function reviewAgeBadge(rule: Tables<"rules">) {
  const stale = isOlderThanSixMonths(rule.last_verified_at);

  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium",
        stale
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-emerald-300 bg-emerald-50 text-emerald-900",
      )}
    >
      {formatDate(rule.last_verified_at)}
    </span>
  );
}

function statusBadge(status: string) {
  return (
    <span className="inline-flex rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium">
      {status}
    </span>
  );
}

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

function RuleEditor({
  rule,
  countries,
}: {
  rule: Tables<"rules"> | undefined;
  countries: Tables<"countries">[];
}) {
  if (!rule) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Rule editor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a rule from the table to edit conditions, outcomes, source, and
          status.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Rule editor</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {rule.slug ?? rule.id}
          </p>
        </div>
        <form action={reverifyRuleAction}>
          <input type="hidden" name="id" value={rule.id} />
          <Button type="submit" size="sm">
            Verify now
          </Button>
        </form>
      </div>

      <form action={updateRuleAction} className="mt-4 grid gap-3">
        <input type="hidden" name="id" value={rule.id} />
        <label className="grid gap-1 text-xs font-medium">
          Country code
          <select
            name="country_code"
            defaultValue={rule.country_code ?? ""}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Shared / international</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={rule.status}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {ruleStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium">
            Conditions JSON
            <textarea
              name="conditions"
              defaultValue={formatJson(rule.conditions)}
              rows={12}
              className="rounded-md border bg-background p-2 font-mono text-xs"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Outcomes JSON
            <textarea
              name="outcomes"
              defaultValue={formatJson(rule.outcomes)}
              rows={12}
              className="rounded-md border bg-background p-2 font-mono text-xs"
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-medium">
          Source URL
          <input
            name="source_url"
            type="url"
            required
            defaultValue={rule.source_url}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium">
          Source quote
          <textarea
            name="source_quote"
            required
            defaultValue={rule.source_quote}
            rows={4}
            className="rounded-md border bg-background p-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium">
          Notes
          <textarea
            name="notes"
            defaultValue={rule.notes ?? ""}
            rows={3}
            className="rounded-md border bg-background p-2 text-sm"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Last verified: {reviewAgeBadge(rule)}
          </p>
          <Button type="submit" size="sm">
            Save rule
          </Button>
        </div>
      </form>
    </section>
  );
}

function RulesTable({
  rules,
  selectedRuleId,
}: {
  rules: Tables<"rules">[];
  selectedRuleId: string | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Country</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Last verified</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Updated</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={rule.id}
              className={cn(
                "border-b last:border-b-0",
                selectedRuleId === rule.id && "bg-muted/60",
              )}
            >
              <td className="px-3 py-2 font-mono text-xs">
                {rule.country_code ?? "shared"}
              </td>
              <td className="px-3 py-2">{statusBadge(rule.status)}</td>
              <td className="px-3 py-2">{reviewAgeBadge(rule)}</td>
              <td className="max-w-[240px] truncate px-3 py-2 text-xs">
                <a
                  href={rule.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                  title={rule.source_url}
                >
                  {rule.source_url}
                </a>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {formatDate(rule.updated_at)}
              </td>
              <td className="px-3 py-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin?rule=${rule.id}`}>Edit</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rules.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          No rules match these filters.
        </p>
      )}
    </div>
  );
}

function CourseQueue({ courses }: { courses: Tables<"courses">[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Course review queue</h2>
        <span className="text-xs text-muted-foreground">
          {courses.length} pending
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {courses.map((course) => {
          // Per-field-group extraction method — AI-filled groups need human eyes.
          const groups = (course.field_extraction ?? {}) as Record<
            string,
            string
          >;
          const ai = (group: string) => groups[group] === "ai";

          return (
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
                    <span className="font-mono">
                      {compactJson(course.tuition)}
                    </span>
                  </p>
                  <Button type="submit" variant="outline" size="sm">
                    Save edits
                  </Button>
                </div>
              </form>
            </article>
          );
        })}
      </div>

      {courses.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No pending courses need review.
        </p>
      )}
    </section>
  );
}

function AuditLog({ events }: { events: Tables<"admin_audit_events">[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Recent audit events</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Table</th>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Status change</th>
              <th className="px-3 py-2 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-xs">
                  {formatDate(event.created_at)}
                </td>
                <td className="px-3 py-2">{event.table_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{event.row_id}</td>
                <td className="px-3 py-2">{event.action}</td>
                <td className="px-3 py-2">
                  {event.old_status ?? "none"} -&gt;{" "}
                  {event.new_status ?? "none"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {event.actor_user_id ?? "system"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No audit events yet.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const country = singleParam(params.country);
  const status = parseRuleStatus(singleParam(params.status));
  const selectedRuleId = singleParam(params.rule);

  const db = await requireAdminDb();
  const filters: AdminRuleFilters = { country, status };
  const [countries, rules, pendingCourses, auditEvents] = await Promise.all([
    getCountries(db),
    listAdminRules(db, filters),
    listPendingCourses(db),
    listRecentAdminAuditEvents(db),
  ]);
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Verify rules, review extracted courses, and inspect audit history.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to app</Link>
        </Button>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Rules</h2>
              <p className="text-xs text-muted-foreground">
                Filter by country/status, then select a row to edit.
              </p>
            </div>
            <form className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-medium">
                Country
                <select
                  name="country"
                  defaultValue={country ?? ""}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">All</option>
                  {countries.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Status
                <select
                  name="status"
                  defaultValue={status ?? ""}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">All</option>
                  {ruleStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline" size="sm">
                Filter
              </Button>
            </form>
          </div>

          <div className="mt-3">
            <RulesTable rules={rules} selectedRuleId={selectedRuleId} />
          </div>
        </div>

        <RuleEditor rule={selectedRule} countries={countries} />
      </section>

      <CourseQueue courses={pendingCourses} />
      <AuditLog events={auditEvents} />
    </main>
  );
}
