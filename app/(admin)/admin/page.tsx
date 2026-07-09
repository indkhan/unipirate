import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import {
  listAdminRules,
  listConflictCourses,
  listPendingCourses,
  listRecentAdminAuditEvents,
  type AdminRuleFilters,
} from "@/lib/db/admin-queries";
import type { Enums } from "@/lib/db/database.types";
import { getCountries } from "@/lib/db/queries";

import { AuditLog } from "./audit-log";
import { ConflictQueue, CourseQueue } from "./course-queue";
import { RuleEditor, RulesTable, ruleStatuses } from "./rules-panel";

export const dynamic = "force-dynamic";

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

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const country = singleParam(params.country);
  const status = parseRuleStatus(singleParam(params.status));
  const selectedRuleId = singleParam(params.rule);

  const { db } = await requireAdmin();
  const filters: AdminRuleFilters = { country, status };
  const [countries, rules, pendingCourses, conflictCourses, auditEvents] =
    await Promise.all([
      getCountries(db),
      listAdminRules(db, filters),
      listPendingCourses(db),
      listConflictCourses(db),
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
      <ConflictQueue conflicts={conflictCourses} />
      <AuditLog events={auditEvents} />
    </main>
  );
}
