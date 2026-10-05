import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useState: vi.fn(), addCourse: vi.fn(), setBusy: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: mocks.useState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ addCourseToDashboard: mocks.addCourse }));

import { AddCourseSheet } from "../add-course-sheet";

function findAddButton(node: ReactNode): (() => Promise<void>) | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(child)) continue;
    if (child.type === "button" && child.props.children === "Add to my dashboard") return child.props.onClick;
    const found = findAddButton(child.props.children);
    if (found) return found;
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  const states = [true, "https://example.edu/course", "", {
    step: "found", onDashboard: false,
    course: { id: "course", name: "Course", university_name: "University", review_status: "approved", extraction_method: "library" },
  }, null, false];
  let index = 0;
  mocks.useState.mockImplementation(() => {
    const current = index++;
    return [states[current], current === 5 ? mocks.setBusy : vi.fn()];
  });
});

it("allows another import after successfully adding an existing course", async () => {
  mocks.addCourse.mockResolvedValue(undefined);
  const add = findAddButton(AddCourseSheet({}));
  expect(add).toBeDefined();
  await add!();
  expect(mocks.addCourse).toHaveBeenCalledWith("course");
  expect(mocks.refresh).toHaveBeenCalled();
  expect(mocks.setBusy).toHaveBeenLastCalledWith(false);
});
