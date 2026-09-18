import { describe, expect, it } from "vitest";

import { evaluate, type EngineRule } from "@/lib/engine/evaluate";
import { p1CbseNoJee } from "@/lib/engine/__tests__/personas";
import { ruleData } from "@/scripts/rules.bootstrap";
import type { CourseTaskDefinition } from "@/lib/tasks/course-tasks";

import {
  bucketTasks,
  generateCourseTasks,
  generateGlobalTasks,
  newGeneratedTaskRows,
  parseDeadlineDate,
  prepareCourseTaskDefinitionSync,
  selectSubmissionDeadline,
  type ApplicationForTaskGeneration,
  type ExistingGeneratedTask,
} from "../generate";

const PROCESS_RULE_IDS = new Set([
  "aps-india-process",
  "uni-assist-vpd-process",
  "blocked-account-open",
  "visa-appointment-in",
  "visa-appointment-sa",
]);

const promotedRules: EngineRule[] = ruleData.map((rule) =>
  PROCESS_RULE_IDS.has(rule.id) ? { ...rule, status: "beta" } : rule,
);

function definition(
  overrides: Partial<CourseTaskDefinition> & Pick<CourseTaskDefinition, "id" | "courseId">,
): CourseTaskDefinition {
  return {
    kind: "submission",
    sourceKey: "submission",
    titleTemplate: "Submit application — {{course}}",
    description: null,
    sourceUrl: "https://uni.example/course",
    dueMode: "source_deadline",
    dueDate: null,
    sortOrder: 30,
    sourceSnapshot: { deadlines: [] },
    retiredAt: null,
    ...overrides,
  };
}

/** One tracked course with a submission definition plus a requirement definition. */
function app(
  index: number,
  deadlines: string[],
  requirement: string | null = "Certified school transcript",
): ApplicationForTaskGeneration {
  const courseId = `10000000-0000-4000-8000-00000000000${index}`;
  const sourceUrl = `https://uni${index}.example/course`;
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    status: "planning",
    course: {
      id: courseId,
      name: `Computer Science ${index}`,
      university_name: `University ${index}`,
      source_url: sourceUrl,
      created_at: "2026-07-04T00:00:00Z",
      review_status: "approved",
      task_definitions: [
        definition({
          id: `d-submit-${index}`,
          courseId,
          sourceUrl,
          sourceSnapshot: { deadlines },
        }),
        ...(requirement
          ? [
              definition({
                id: `d-req-${index}`,
                courseId,
                sourceUrl,
                kind: "requirement",
                sourceKey: `requirement:${requirement}`,
                titleTemplate: `Prepare: ${requirement} — {{course}}`,
                sortOrder: 28,
                sourceSnapshot: { deadlines },
              }),
            ]
          : []),
      ],
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

describe("selectSubmissionDeadline", () => {
  it("picks a single line even when the source lists several", () => {
    expect(
      selectSubmissionDeadline(
        [
          "Normal deadline: 15 May",
          "Early deadline: 15 November",
          "Early deadline: 15 May",
          "Normal deadline: 15 November",
        ],
        "2026-07-06",
      ),
    ).toMatchObject({ verbatim: "Normal deadline: 15 May" });
  });

  it("selects the line matching the chosen winter intake", () => {
    expect(
      selectSubmissionDeadline(
        ["Normal deadline: 15 May", "Normal deadline: 15 November"],
        "2026-07-06",
        { term: "winter", year: 2026 },
      ),
    ).toEqual({ date: null, verbatim: "Normal deadline: 15 May" });
  });

  it("selects the line matching the chosen summer intake", () => {
    expect(
      selectSubmissionDeadline(
        ["Normal deadline: 15 May", "Normal deadline: 15 November"],
        "2026-07-06",
        { term: "summer", year: 2027 },
      ),
    ).toEqual({ date: null, verbatim: "Normal deadline: 15 November" });
  });

  it("computes the selected intake deadline date from DAAD semester wording", () => {
    const lines = [
      "Non-EU students:",
      "15 April to 31 May of the year for the winter semester",
      "15 October to 30 November of the previous year for the summer semester",
    ];

    expect(
      selectSubmissionDeadline(lines, "2026-07-06", { term: "winter", year: 2026 }),
    ).toEqual({
      date: "2026-05-31",
      verbatim: "15 April to 31 May of the year for the winter semester",
    });
    expect(
      selectSubmissionDeadline(lines, "2026-07-06", { term: "summer", year: 2027 }),
    ).toEqual({
      date: "2026-11-30",
      verbatim:
        "15 October to 30 November of the previous year for the summer semester",
    });
  });

  it("uses the next upcoming parsed deadline when no intake is chosen", () => {
    expect(
      selectSubmissionDeadline(
        [
          "Application deadline: 15 May 2026",
          "Application deadline: 15 November 2026",
          "Application deadline: 15 May 2027",
        ],
        "2026-07-06",
      ),
    ).toEqual({
      date: "2026-11-15",
      verbatim: "Application deadline: 15 November 2026",
    });
  });
});

describe("generateCourseTasks", () => {
  it("merges global rule steps with three per-university plans", () => {
    const result = evaluate(p1CbseNoJee, promotedRules);
    const tasks = [
      ...generateGlobalTasks(result),
      ...generateCourseTasks([
        app(1, ["Application deadline: 15 July 2026"]),
        app(2, ["Application deadline: 2026-08-15"]),
        app(3, ["Application deadline: 15.09.2026"]),
      ]),
    ];

    expect(
      tasks.some((task) => /Register online at aps-india\.de/.test(task.title)),
    ).toBe(true);
    expect(tasks.some((task) => /My assist account/.test(task.title))).toBe(true);
    expect(tasks.filter((task) => task.title.startsWith("Submit application")))
      .toHaveLength(3);
    expect(tasks.some((task) => /blocked account/.test(task.title))).toBe(true);
    expect(
      tasks.some((task) => /Consular Services Portal/.test(task.title)),
    ).toBe(true);

    const orders = tasks.map((task) => task.order).sort((a, b) => a - b);
    expect(orders[0]).toBe(10);
    expect(orders).toContain(20);
    expect(orders).toContain(28);
    expect(orders).toContain(30);
    expect(orders).toContain(41);
    expect(orders).toContain(44);
  });

  it("is deterministic for unchanged inputs", () => {
    const applications = [
      app(1, ["Application deadline: 15 July 2026"]),
      app(2, ["Application deadline: 2026-08-15"]),
      app(3, ["Application deadline: 15.09.2026"]),
    ];

    expect(generateCourseTasks(applications)).toEqual(
      generateCourseTasks(applications),
    );
  });

  it("omits per-app tasks once the application has been submitted", () => {
    const submitted = {
      ...app(1, ["Application deadline: 15 July 2026"]),
      status: "applied",
    };

    expect(generateCourseTasks([submitted])).toEqual([]);
  });

  it("skips retired definitions", () => {
    const application = app(1, ["Application deadline: 15 July 2026"], null);
    application.course!.task_definitions[0].retiredAt = "2026-07-01T00:00:00Z";

    expect(generateCourseTasks([application])).toEqual([]);
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
    done: overrides.done ?? false,
    generated_active: overrides.generated_active ?? true,
    course_task_definition_id: overrides.course_task_definition_id ?? null,
    admin_snapshot: overrides.admin_snapshot ?? null,
    has_personal_edits: overrides.has_personal_edits ?? false,
  };
}

describe("newGeneratedTaskRows", () => {
  const desiredFor = () => [
    ...generateGlobalTasks(evaluate(p1CbseNoJee, promotedRules)),
    ...generateCourseTasks([app(1, ["Application deadline: 15 July 2026"])]),
  ];

  it("produces no rows for source keys that already exist", () => {
    const desired = desiredFor();
    const existing = desired.map((task) => existingGenerated({ task_key: task.key }));

    expect(newGeneratedTaskRows("user-1", desired, existing)).toEqual([]);
  });

  it("does not include done or preferred_bucket in generated upsert payloads", () => {
    const desired = desiredFor();

    const rows = newGeneratedTaskRows("user-1", desired, []);

    expect(rows).toHaveLength(desired.length);
    expect(rows.every((row) => !("done" in row))).toBe(true);
    expect(rows.every((row) => !("preferred_bucket" in row))).toBe(true);
    expect(rows.every((row) => row.generated_active)).toBe(true);
  });

  it("adds only newly discovered source keys, leaving a user-edited copy alone", () => {
    const desired = desiredFor();
    const first = desired[0];

    const rows = newGeneratedTaskRows("user-1", desired, [
      existingGenerated({
        task_key: first.key,
        title: "User-edited title",
        due_date: "2030-01-01",
        done: true,
      }),
    ]);

    expect(rows.map((row) => row.task_key)).toEqual(
      desired.slice(1).map((task) => task.key),
    );
  });

  it("does not reactivate a deactivated source task", () => {
    const first = desiredFor()[0];

    const rows = newGeneratedTaskRows("user-1", [first], [
      existingGenerated({
        task_key: first.key,
        done: true,
        generated_active: false,
      }),
    ]);

    expect(rows).toEqual([]);
  });
});

describe("prepareCourseTaskDefinitionSync", () => {
  it("updates an untouched assignment with its intake-specific deadline", () => {
    const application = app(1, [], null);
    application.course!.task_definitions = [
      definition({
        id: "definition-1",
        courseId: application.course!.id,
        sourceUrl: application.course!.source_url,
        sourceSnapshot: {
          deadlines: [
            "Introduction",
            "15 April to 31 May of the year for the winter semester",
            "15 October to 30 November of the previous year for the summer semester",
          ],
        },
      }),
    ];
    const desired = generateCourseTasks([application], "2026-07-06", {
      term: "summer",
      year: 2027,
    });

    const sync = prepareCourseTaskDefinitionSync("user-1", desired, [
      existingGenerated({
        task_key: desired[0].key,
        course_task_definition_id: "definition-1",
      }),
    ]);

    expect(sync.upsertRows).toMatchObject([{
      task_key: desired[0].key,
      due_date: "2026-11-30",
      verbatim_due: "15 October to 30 November of the previous year for the summer semester",
    }]);
  });

  it("keeps a personally edited copy and flags it for a decision", () => {
    const application = app(1, ["Application deadline: 15 July 2026"], null);
    const desired = generateCourseTasks([application], "2026-07-06");

    const sync = prepareCourseTaskDefinitionSync("user-1", desired, [
      existingGenerated({
        task_key: desired[0].key,
        course_task_definition_id: "d-submit-1",
        has_personal_edits: true,
      }),
    ]);

    expect(sync.upsertRows).toEqual([]);
    expect(sync.personalUpdates).toHaveLength(1);
    expect(sync.personalUpdates[0].taskKey).toBe(desired[0].key);
  });
});
