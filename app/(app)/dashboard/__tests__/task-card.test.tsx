import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DashboardTask } from "@/lib/tasks/view";

import { NowTask } from "../task-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  resolveCourseTaskUpdate: vi.fn(),
  toggleTask: vi.fn(),
}));

const courseTask: DashboardTask = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "app:1:course-task:1",
  kind: "course_task",
  title: "Submit application — Saarland University",
  description: "My personal note",
  done: false,
  dueDate: "2026-07-15",
  verbatimDue: "One final deadline on 15 July for the following winter semester",
  order: 30,
  preferredBucket: null,
  applicationId: "22222222-2222-4222-8222-222222222222",
  source: null,
  scope: "university",
  adminChangeState: "update_pending",
  adminSnapshot: {
    title: "Send application through uni-assist",
    description: "Upload the certified transcript first",
    verbatim_due: "15 July 2026, 23:59 CET",
  },
};

describe("NowTask", () => {
  it("uses full-size text actions for a pending admin task update", () => {
    const html = renderToStaticMarkup(
      <NowTask
        task={courseTask}
        todayIso="2026-07-10"
        applications={[]}
        onDragStart={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(html).toContain("Admin updated this task");
    expect(html).toContain("Title changed");
    expect(html).toContain("Send application through uni-assist");
    expect(html).toContain("Description changed");
    expect(html).toContain("Upload the certified transcript first");
    expect(html).toContain("Deadline changed");
    expect(html).toContain("15 July 2026, 23:59 CET");
    expect(html).toContain("Keep mine");
    expect(html).toContain("Use admin");
    expect(html).toContain("taskTextButton");
  });
});
