import { describe, expect, it } from "vitest";

import { safeNextPath } from "../redirect";

describe("safeNextPath", () => {
  it("keeps internal result paths and query strings", () => {
    expect(safeNextPath("/result/abc?claim=1")).toBe("/result/abc?claim=1");
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.example/result",
    "//evil.example/result",
    "javascript:alert(1)",
  ])("falls back for unsafe destination %s", (value) => {
    expect(safeNextPath(value)).toBe("/hello");
  });
});

