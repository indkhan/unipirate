import { describe, expect, it } from "vitest";

import { adminHref, parseAdminState, safeAdminReturnTo } from "../admin-state";

describe("admin workspace state", () => {
  it("defaults invalid parameters to the overview", () => {
    expect(parseAdminState({ view: "nope", queue: "bad", course: "bad" })).toEqual({
      view: "overview",
      queue: "pending",
    });
  });

  it("parses valid review state", () => {
    expect(parseAdminState({
      view: "reviews",
      queue: "conflicts",
      course: "0f47ac10-b071-4bf1-a2a4-ec942f23f09a",
    })).toMatchObject({ view: "reviews", queue: "conflicts", course: "0f47ac10-b071-4bf1-a2a4-ec942f23f09a" });
  });

  it("only accepts internal admin return destinations", () => {
    expect(safeAdminReturnTo("/admin?view=rules&status=draft")).toBe("/admin?view=rules&status=draft");
    expect(safeAdminReturnTo("https://evil.test/admin")).toBe("/admin");
    expect(safeAdminReturnTo("/dashboard")).toBe("/admin");
  });

  it("builds bookmarkable links without empty values", () => {
    expect(adminHref({ view: "rules", q: "aps", status: undefined })).toBe("/admin?view=rules&q=aps");
  });
});
