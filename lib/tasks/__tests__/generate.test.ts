import { describe, expect, it } from "vitest";

import { evaluate, type EngineRule } from "@/lib/engine/evaluate";
import { p1CbseNoJee } from "@/lib/engine/__tests__/personas";
import { ruleData } from "@/scripts/rules.bootstrap";

import {
  bucketTasks,
  generateTasks,
  parseDeadlineDate,
  prepareGeneratedTaskSync,
  type ApplicationForTaskGeneration,
} from "../generate";

const PROCESS_RULE_IDS = new Set([
  "aps-india-process",
  "uni-assist-vpd-process",
  "blocked-account-open",
  "visa-appointment-booking",
]);

const promotedRules: EngineRule[] = ruleData.map((rule) =>
  PROCESS_RULE_IDS.has(rule.id) ? { ...rule, status: "beta" } : rule,
);

function app(
  index: number,
  deadline: string,
  requirement = "Certified school transcript",
): ApplicationForTaskGeneration {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    status: "planning",
    course: {
      id: `10000000-0000-4000-8000-00000000000${index}`,
      name: `Computer Science ${index}`,
      university_name: `University ${index}`,
      deadlines: ["Non-EU students:", deadline],
      requirements: [requirement],
      source_url: `https://uni${index}.example/course`,
      created_at: "2026-07-04T00:00:00Z",
      review_status: "approved",
    },
  };
}

describe("parseDeadlineDate", () => {
  it("parses supported official-page date shapes", () => {
    expect(parseDeadlineDate("Application deadline: 15 July 2026")).toBe(
      "2026-07-15",
    );
    expect(parseDeadlineDate("Deadline 15.07.2026")).toBe("2026-07-15");
    expect(parseDeadlineDate("Deadline 2026-07-15")).toBe("2026-07-15");
    expect(parseDeadlineDate("Bewerbungsfrist: 15. Juli 2026")).toBe(
      "2026-07-15",
    );
    expect(parseDeadlineDate("Deadline: July 15, 2026")).toBe("2026-07-15");
    expect(parseDeadlineDate("Non-EU students:")).toBeNull();
  });
});

describe("generateTasks", () => {
  it("merges global rule steps with three per-university plans", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const tasks = generateTasks(result, [
      app(1, "Application deadline: 15 July 2026"),
      app(2, "Application deadline: 2026-08-15"),
      app(3, "Application deadline: 15.09.2026"),
    ]);

    expect(tasks.some((task) => /Register for APS India/.test(task.title))).toBe(
      true,
    );
    expect(tasks.some((task) => /uni-assist account/.test(task.title))).toBe(true);
    expect(tasks.filter((task) => task.title.startsWith("Submit application")))
      .toHaveLength(3);
    expect(tasks.some((task) => /blocked account/.test(task.title))).toBe(true);
    expect(tasks.some((task) => /student-visa appointment/.test(task.title))).toBe(
      true,
    );

    const orders = tasks.map((task) => task.order).sort((a, b) => a - b);
    expect(orders[0]).toBe(10);
    expect(orders).toContain(20);
    expect(orders).toContain(28);
    expect(orders).toContain(30);
    expect(orders).toContain(41);
    expect(orders).toContain(44);
  });

  it("is deterministic for unchanged inputs", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const applications = [
      app(1, "Application deadline: 15 July 2026"),
      app(2, "Application deadline: 2026-08-15"),
      app(3, "Application deadline: 15.09.2026"),
    ];

    expect(generateTasks(result, applications)).toEqual(
      generateTasks(result, applications),
    );
  });

  it("omits per-app tasks once the application has been submitted", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const submitted = { ...app(1, "Application deadline: 15 July 2026"), status: "applied" };

    expect(
      generateTasks(result, [submitted]).some((task) =>
        task.key.startsWith(`app:${submitted.id}:`),
      ),
    ).toBe(false);
  });
});

describe("bucketTasks", () => {
  const t = (key: string, order: number, dueDate: string | null) => ({
    key,
    order,
    dueDate,
  });

  it("caps Now at three tasks and lets overdue tasks jump the band queue", () => {
    const buckets = bucketTasks(
      [
        t("aps-1", 10, null),
        t("aps-2", 11, null),
        t("blocked", 41, "2026-07-20"),
        t("overdue", 30, "2026-07-01"),
        t("submit", 30, "2026-07-15"),
      ],
      "2026-07-06",
    );

    expect(buckets.now).toHaveLength(3);
    expect(buckets.now.map((task) => task.key)).toContain("overdue");
    expect(buckets.now.map((task) => task.key)).not.toContain("blocked");
  });

  it("keeps blocked-account and undated tasks in Later while lower bands are pending", () => {
    const buckets = bucketTasks(
      [t("aps", 10, null), t("blocked", 41, null), t("undated-submit", 30, null)],
      "2026-07-06",
    );

    expect(buckets.now.map((task) => task.key)).toEqual(["aps"]);
    expect(buckets.later.map((task) => task.key)).toContain("blocked");
    expect(buckets.later.map((task) => task.key)).toContain("undated-submit");
  });
});

describe("prepareGeneratedTaskSync", () => {
  it("produces idempotent upsert rows and zero stale deletes on a second run", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);
    const existing = desired.map((task) => ({
      task_key: task.key,
      title: task.title,
      due_date: task.dueDate,
      application_id: task.applicationId,
      generated_from_rule_id: task.ruleId,
      done: false,
    }));

    const sync = prepareGeneratedTaskSync("user-1", desired, existing);

    expect(sync.staleKeysToDelete).toEqual([]);
    expect(sync.upsertRows).toEqual([]);
  });

  it("does not include done in generated upsert payloads", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);

    const sync = prepareGeneratedTaskSync("user-1", desired, []);

    expect(sync.upsertRows).toHaveLength(desired.length);
    expect(sync.upsertRows.every((row) => !("done" in row))).toBe(true);
  });

  it("keeps completed generated rows out of stale cleanup", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);

    const sync = prepareGeneratedTaskSync("user-1", desired, [
      {
        task_key: "old-not-done",
        title: "Old",
        due_date: null,
        application_id: null,
        generated_from_rule_id: null,
        done: false,
      },
      {
        task_key: "old-done",
        title: "Old done",
        due_date: null,
        application_id: null,
        generated_from_rule_id: null,
        done: true,
      },
    ]);

    expect(sync.staleKeysToDelete).toEqual(["old-not-done"]);
  });
});
