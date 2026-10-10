import { expect, it } from "vitest";
import { responseTaskReceipts } from "../assistant-receipts";
const task = { id: "00000000-0000-4000-8000-000000000001", title: "Stored title", description: null, due_date: null, source_url: null, application_id: null };
const data = (value: unknown) => ({ type: "data-task-receipt", data: value });
it("prefers the original created receipt over repeated retry receipts in either order", () => {
  const created = { status: "created", task }, retry = { status: "already_exists", task };
  expect(responseTaskReceipts([data(retry), data(created), data(retry)])).toEqual([created]);
  expect(responseTaskReceipts([data(created), data(retry), data(created)])).toEqual([created]);
});
it("retains distinct confirmed task IDs while dropping recovered failure feedback", () => {
  const first = { status: "created", task }, second = { status: "created", task: { ...task, id: "00000000-0000-4000-8000-000000000002" } };
  expect(responseTaskReceipts([data({ status: "failed", error: "Not confirmed" }), data(first), data(second)])).toEqual([first, second]);
});
it("invalid or unfinished receipts cannot suppress honest failure feedback", () => {
  const failure = { status: "failed", error: "No saved task" };
  expect(responseTaskReceipts([data(failure), data({ status: "created", task: { ...task, id: "invalid" } }), { type: "tool-create_task", state: "input-available", output: { status: "created", task } }])).toEqual([failure]);
});
