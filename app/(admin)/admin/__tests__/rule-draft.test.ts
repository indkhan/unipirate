import { describe, expect, it } from "vitest";
import { jsonToConditionRows, conditionRowsToJson } from "../rule-draft";

describe("guided rule draft", () => {
  it("round trips supported conditions without changing meaning", () => {
    const source = { certificate_country: { op: "in", value: ["in", "pk"] }, class12_percent: { op: "gte", value: 75 }, has_existing_aps: true };
    expect(conditionRowsToJson(jsonToConditionRows(source))).toEqual(source);
  });

  it("reports invalid advanced JSON", () => {
    expect(() => jsonToConditionRows("{" as never)).toThrow("valid JSON object");
  });
});
