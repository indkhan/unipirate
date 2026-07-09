import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Tables } from "@/lib/db/database.types";

import { Finder } from "../finder";

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function course(overrides: Partial<Tables<"courses">>): Tables<"courses"> {
  return {
    conflicts_with: null,
    created_at: "2026-07-07T00:00:00Z",
    created_by: null,
    deadlines: ["15 May for the winter semester"],
    degree: "Master",
    description: null,
    extraction_method: "library",
    field_extraction: null,
    id: "11111111-1111-4111-8111-111111111111",
    language: "English",
    location: "Saarbrucken",
    name: "Computer Science",
    normalized_url: "https://example.edu/cs",
    requirements: [],
    review_status: "approved",
    source_url: "https://example.edu/cs",
    tuition: null,
    university_id: null,
    university_name: "Example University",
    updated_at: "2026-07-07T00:00:00Z",
    ...overrides,
  };
}

describe("course finder", () => {
  it("renders course cards, links, URL import, and tracked state", () => {
    const courses = [
      course({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Computer Science",
        university_name: "Saarland University",
      }),
      course({
        id: "22222222-2222-4222-8222-222222222222",
        name: "Data Engineering",
        university_name: "TU Example",
      }),
    ];

    const html = renderToStaticMarkup(
      <Finder courses={courses} trackedIds={[courses[0].id]} />,
    );

    expect(html).toContain("Computer Science");
    expect(html).toContain("Data Engineering");
    expect(html).toContain('href="/courses/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain("On your dashboard");
    expect(html).toContain("Add to my dashboard");
    expect(html).toContain("Add it by URL");
  });
});
