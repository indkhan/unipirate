import { describe, expect, it } from "vitest";

import {
  deriveCourseTaskCandidates,
  courseTaskAdminPreview,
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
