import { describe, expect, it } from "vitest";

import { evaluate, type EngineRule } from "@/lib/engine/evaluate";
import { p1CbseNoJee } from "@/lib/engine/__tests__/personas";
import { ruleData } from "@/scripts/rules.bootstrap";

import {
  bucketTasks,
  generateTasks,
  parseDeadlineDate,
  prepareGeneratedTaskMaterialization,
  type ApplicationForTaskGeneration,
  type ExistingGeneratedTask,
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

  it("creates one submit task per application even when the source has several deadline lines", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const application = app(1, "Normal deadline: 15 May");
    application.course!.deadlines = [
      "Normal deadline: 15 May",
      "Early deadline: 15 November",
      "Early deadline: 15 May",
      "Normal deadline: 15 November",
    ];

    const submitTasks = generateTasks(result, [application], "2026-07-06").filter(
      (task) => task.title.startsWith("Submit application"),
    );

    expect(submitTasks).toHaveLength(1);
    expect(submitTasks[0]).toMatchObject({
      key: `app:${application.id}:submit`,
      verbatimDue: "Normal deadline: 15 May",
    });
  });

  it("selects the deadline line matching the chosen winter intake", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const application = app(1, "Normal deadline: 15 May");
    application.course!.deadlines = [
      "Normal deadline: 15 May",
      "Normal deadline: 15 November",
    ];

    const submitTask = generateTasks(result, [application], "2026-07-06", {
      term: "winter",
      year: 2026,
    }).find((task) => task.title.startsWith("Submit application"));

    expect(submitTask).toMatchObject({
      dueDate: null,
      verbatimDue: "Normal deadline: 15 May",
    });
  });

  it("selects the deadline line matching the chosen summer intake", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const application = app(1, "Normal deadline: 15 May");
    application.course!.deadlines = [
      "Normal deadline: 15 May",
      "Normal deadline: 15 November",
    ];

    const submitTask = generateTasks(result, [application], "2026-07-06", {
      term: "summer",
      year: 2027,
    }).find((task) => task.title.startsWith("Submit application"));

    expect(submitTask).toMatchObject({
      dueDate: null,
      verbatimDue: "Normal deadline: 15 November",
    });
  });

  it("computes the selected intake deadline date from DAAD semester wording", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const application = app(1, "15 April to 31 May of the year for the winter semester");
    application.course!.deadlines = [
      "Non-EU students:",
      "15 April to 31 May of the year for the winter semester",
      "15 October to 30 November of the previous year for the summer semester",
    ];

    const winterTask = generateTasks(result, [application], "2026-07-06", {
      term: "winter",
      year: 2026,
    }).find((task) => task.title.startsWith("Submit application"));
    const summerTask = generateTasks(result, [application], "2026-07-06", {
      term: "summer",
      year: 2027,
    }).find((task) => task.title.startsWith("Submit application"));

    expect(winterTask).toMatchObject({
      dueDate: "2026-05-31",
      verbatimDue: "15 April to 31 May of the year for the winter semester",
    });
    expect(summerTask).toMatchObject({
      dueDate: "2026-11-30",
      verbatimDue:
        "15 October to 30 November of the previous year for the summer semester",
    });
  });

  it("uses the next upcoming parsed deadline for a course submission task", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const application = app(1, "Application deadline: 15 May 2026");
    application.course!.deadlines = [
      "Application deadline: 15 May 2026",
      "Application deadline: 15 November 2026",
      "Application deadline: 15 May 2027",
    ];

    const submitTask = generateTasks(result, [application], "2026-07-06").find(
      (task) => task.title.startsWith("Submit application"),
    );

    expect(submitTask).toMatchObject({
      dueDate: "2026-11-15",
      verbatimDue: "Application deadline: 15 November 2026",
    });
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

function existingGenerated(
  overrides: Partial<ExistingGeneratedTask> & Pick<ExistingGeneratedTask, "task_key">,
): ExistingGeneratedTask {
  return {
    task_key: overrides.task_key,
    title: overrides.title ?? "Existing",
    due_date: overrides.due_date ?? null,
    verbatim_due: overrides.verbatim_due ?? null,
    sort_order: overrides.sort_order ?? 25,
    source_url: overrides.source_url ?? null,
    source_verified_at: overrides.source_verified_at ?? null,
    application_id: overrides.application_id ?? null,
    generated_from_rule_id: overrides.generated_from_rule_id ?? null,
    done: overrides.done ?? false,
    generated_active: overrides.generated_active ?? true,
    course_task_definition_id: overrides.course_task_definition_id ?? null,
    admin_snapshot: overrides.admin_snapshot ?? null,
    definition_revision: overrides.definition_revision ?? null,
    has_personal_edits: overrides.has_personal_edits ?? false,
  };
}

describe("prepareGeneratedTaskMaterialization", () => {
  it("produces no rows for source keys that already exist", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);
    const existing = desired.map((task) => existingGenerated({
      task_key: task.key,
      title: task.title,
      due_date: task.dueDate,
      verbatim_due: task.verbatimDue,
      sort_order: task.order,
      source_url: task.source?.url ?? null,
      source_verified_at: task.source?.verifiedAt ?? null,
      application_id: task.applicationId,
      generated_from_rule_id: task.ruleId,
      generated_active: true,
    }));

    const materialization = prepareGeneratedTaskMaterialization(
      "user-1",
      desired,
      existing,
    );

    expect(materialization.upsertRows).toEqual([]);
  });

  it("does not include done in generated upsert payloads", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);

    const materialization = prepareGeneratedTaskMaterialization("user-1", desired, []);

    expect(materialization.upsertRows).toHaveLength(desired.length);
    expect(materialization.upsertRows.every((row) => !("done" in row))).toBe(true);
    expect(materialization.upsertRows.every((row) => !("preferred_bucket" in row))).toBe(true);
    expect(materialization.upsertRows.every((row) => row.generated_active)).toBe(true);
  });

  it("adds only newly discovered source keys", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);
    const first = desired[0];

    const materialization = prepareGeneratedTaskMaterialization("user-1", desired, [
      existingGenerated({
        task_key: first.key,
        title: "User-edited title",
        due_date: "2030-01-01",
        done: true,
      }),
    ]);

    expect(materialization.upsertRows.map((row) => row.task_key)).toEqual(
      desired.slice(1).map((task) => task.key),
    );
  });

  it("does not recreate a user-deleted source task", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const desired = generateTasks(result, [app(1, "Application deadline: 15 July 2026")]);
    const first = desired[0];

    const materialization = prepareGeneratedTaskMaterialization("user-1", [first], [
      existingGenerated({
        task_key: first.key,
        title: first.title,
        due_date: first.dueDate,
        verbatim_due: first.verbatimDue,
        sort_order: first.order,
        source_url: first.source?.url ?? null,
        source_verified_at: first.source?.verifiedAt ?? null,
        application_id: first.applicationId,
        generated_from_rule_id: first.ruleId,
        done: true,
        generated_active: false,
      }),
    ]);

    expect(materialization.upsertRows).toEqual([]);
  });
});
