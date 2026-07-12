import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Enums, Tables } from "@/lib/db/database.types";
import { cn } from "@/lib/utils";

import { reverifyRuleAction, updateRuleAction } from "./actions";
import { formatDate, statusBadge } from "./admin-shared";
import { GuidedRuleFields } from "./guided-rule-editor";
import { ActionButton } from "./action-button";

export const ruleStatuses = [
  "draft",
  "beta",
  "verified",
] as const satisfies readonly Enums<"rule_status">[];

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

export function RuleEditor({
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
          <ActionButton pendingText="Verifying…" confirm="Publish this saved rule as verified? Verified rules can affect eligibility results.">Verify saved rule</ActionButton>
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

        <GuidedRuleFields conditions={rule.conditions} outcomes={rule.outcomes} />

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
          <ActionButton pendingText="Saving…">Save rule changes</ActionButton>
        </div>
      </form>
    </section>
  );
}

export function RulesTable({
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
                  <Link href={`/admin?view=rules&rule=${rule.id}`}>Edit</Link>
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
