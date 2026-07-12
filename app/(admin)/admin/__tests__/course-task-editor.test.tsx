import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tables } from "@/lib/db/database.types";

import { CourseTaskLibrary } from "../course-queue";

const course = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Computer Science",
  university_name: "Example University",
  review_status: "approved",
  deadlines: ["Winter semester: 15 July 2026"],
  requirements: [],
  source_url: "https://example.edu/course",
} as unknown as Tables<"courses">;

const definition = {
  id: "22222222-2222-4222-8222-222222222222",
  course_id: course.id,
  kind: "submission",
  source_key: "submission",
  title_template: "Submit application — {{course}}",
  description: null,
  source_url: course.source_url,
  due_mode: "source_deadline",
  due_date: null,
  source_snapshot: { deadlines: course.deadlines },
  sort_order: 30,
  revision: 1,
  retired_at: null,
} as unknown as Tables<"course_task_definitions">;

describe("course task editor", () => {
  it("provides explicit add and remove task controls", () => {
    const html = renderToStaticMarkup(<CourseTaskLibrary courses={[course]} definitionsByCourse={new Map([[course.id, [definition]]])} />);
    expect(html).toContain("Add custom task");
    expect(html).toContain("Remove task");
  });
});
