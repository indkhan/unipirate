import { describe, expect, it } from "vitest";

import { adminHref, parseAdminState } from "../admin-state";

describe("admin workspace state", () => {
  it("retains the selected rule country and ignores invalid country values", () => {
    expect(parseAdminState({ view: "rules", country: "in" })).toMatchObject({ country: "in" });
    expect(parseAdminState({ country: "invalid" })).not.toHaveProperty("country");
    expect(parseAdminState({ country: "" })).not.toHaveProperty("country");
  });
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

  it("builds bookmarkable links without empty values", () => {
    expect(adminHref({ view: "rules", q: "aps", status: undefined })).toBe("/admin?view=rules&q=aps");
  });
});
