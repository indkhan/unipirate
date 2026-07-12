export type ConditionRow = { fact: string; operator: string; value: string; valueType: "string" | "number" | "boolean" | "array" };

export function jsonToConditionRows(input: unknown): ConditionRow[] {
  let value = input;
  if (typeof value === "string") try { value = JSON.parse(value); } catch { throw new Error("Conditions must be a valid JSON object."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Conditions must be a valid JSON object.");
  return Object.entries(value).map(([fact, condition]) => {
    const structured = condition && typeof condition === "object" && !Array.isArray(condition) && "op" in condition && "value" in condition;
    const operator = structured ? String(condition.op) : "eq";
    const raw = structured ? condition.value : condition;
    return { fact, operator, value: Array.isArray(raw) ? JSON.stringify(raw) : String(raw), valueType: Array.isArray(raw) ? "array" : typeof raw === "number" ? "number" : typeof raw === "boolean" ? "boolean" : "string" };
  });
}

export function conditionRowsToJson(rows: ConditionRow[]): Record<string, unknown> {
  return Object.fromEntries(rows.map(row => {
    const value = row.valueType === "number" ? Number(row.value) : row.valueType === "boolean" ? row.value === "true" : row.valueType === "array" ? JSON.parse(row.value) : row.value;
    return [row.fact, row.operator === "eq" && row.valueType === "boolean" ? value : { op: row.operator, value }];
  }));
}
