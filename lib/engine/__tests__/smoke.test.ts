import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// Smoke test: vitest runs, path aliases resolve, app code imports.
describe("smoke", () => {
  it("cn merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
