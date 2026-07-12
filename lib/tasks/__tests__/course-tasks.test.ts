import { describe, expect, it } from "vitest";

import {
  deriveCourseTaskCandidates,
  courseTaskAdminPreview,
  reconcileCourseTaskAssignment,
  type CourseTaskDefinition,
} from "../course-tasks";

const course = {
  id: "course-1",
  name: "Computer Science",
  university_name: "Example University",
  deadlines: ["Winter semester: 15 July 2026"],
  requirements: ["Certified school transcript", "Proof of English"],
  source_url: "https://example.edu/course",
  created_at: "2026-07-10T00:00:00Z",
};

describe("deriveCourseTaskCandidates", () => {
  it("creates one submission candidate and one candidate per verbatim requirement", () => {
    const candidates = deriveCourseTaskCandidates(course);

    expect(candidates).toMatchObject([
      {
        sourceKey: "submission",
        kind: "submission",
        titleTemplate: "Submit application — {{course}}",
        dueMode: "source_deadline",
        sourceSnapshot: { deadlines: course.deadlines },
      },
      {
        kind: "requirement",
        titleTemplate: "Prepare: Certified school transcript — {{course}}",
        dueMode: "source_deadline",
        sourceSnapshot: { requirement: "Certified school transcript" },
      },
      {
        kind: "requirement",
        titleTemplate: "Prepare: Proof of English — {{course}}",
      },
    ]);
    expect(candidates.map((candidate) => candidate.sourceKey)).toEqual([
      "submission",
      "requirement:Certified school transcript",
      "requirement:Proof of English",
    ]);
  });
});

describe("courseTaskAdminPreview", () => {
  it("shows admins the title and verbatim source deadline students receive", () => {
    expect(courseTaskAdminPreview({
      titleTemplate: "Submit application — {{course}}",
      dueMode: "source_deadline",
      sourceSnapshot: { deadlines: ["Winter semester: 15 July 2026"] },
    }, "Computer Science")).toEqual({
      title: "Submit application — Computer Science",
      sourceDeadlineLines: ["Winter semester: 15 July 2026"],
    });
  });
});

const definition: CourseTaskDefinition = {
  id: "definition-1",
  courseId: "course-1",
  kind: "custom",
  sourceKey: null,
  titleTemplate: "Send portfolio — {{course}}",
  description: "Use the official upload portal.",
  sourceUrl: "https://example.edu/portfolio",
  dueMode: "fixed_date",
  dueDate: "2026-08-01",
  sortOrder: 40,
  sourceSnapshot: null,
  revision: 2,
  retiredAt: null,
};

describe("reconcileCourseTaskAssignment", () => {
  it("updates untouched copies without touching completion or dashboard placement", () => {
    expect(
      reconcileCourseTaskAssignment({
        hasPersonalEdits: false,
        changeState: "current",
      }, definition),
    ).toEqual({ action: "replace", nextChangeState: "current" });
  });

  it("protects personalized copies and requests a review", () => {
    expect(
      reconcileCourseTaskAssignment({
        hasPersonalEdits: true,
        changeState: "current",
      }, definition),
    ).toEqual({ action: "keep_personal", nextChangeState: "update_pending" });
  });

  it("asks before removing a personalized copy", () => {
    expect(
      reconcileCourseTaskAssignment(
        { hasPersonalEdits: true, changeState: "current" },
        { ...definition, retiredAt: "2026-07-10T12:00:00Z" },
      ),
    ).toEqual({ action: "keep_personal", nextChangeState: "removal_pending" });
  });
});
