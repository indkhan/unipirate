// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Provider hook and router are external I/O boundaries; React state remains real.
const chat = vi.hoisted(() => ({ messages: [] as UIMessage[], finish: null as (() => void) | null, refresh: vi.fn(), send: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: chat.refresh }) }));
vi.mock("@ai-sdk/react", () => ({ useChat: (options: { onFinish: () => void }) => {
  chat.finish = options.onFinish;
  return { messages: chat.messages, status: "ready", sendMessage: chat.send, regenerate: vi.fn(), error: undefined };
} }));
vi.mock("@/app/(app)/dashboard/actions", () => ({ reportAssistantAnswer: vi.fn() }));
import { AssistantSidebar } from "../assistant-sidebar";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chat.messages = []; chat.finish = null; chat.refresh.mockClear(); chat.send.mockClear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(initialUsed: number) { await act(async () => root.render(<AssistantSidebar initialUsed={initialUsed} />)); }
async function open() { await act(async () => container.querySelector("button")!.click()); }
function question(id: string): UIMessage { return { id, role: "user", parts: [{ type: "text", text: "My question" }] }; }
function receipt(data: unknown, kind = "data-task-receipt", state = "output-available"): UIMessage {
  const part = kind === "data-task-receipt" ? { type: kind, data } : { type: kind, toolCallId: "call", state, input: {}, output: data };
  return { id: "answer", role: "assistant", parts: [part] } as unknown as UIMessage;
}
const saved = { status: "created", task: { id: "00000000-0000-4000-8000-000000000001", title: "Persisted database title", description: null, due_date: "2027-06-01", source_url: null, application_id: null } };
it("preserves real mounted quota state across server refreshes without double counting", async () => {
  await render(17); await open(); expect(container.textContent).toContain("17/20 today");
  chat.messages = [question("first")]; await render(17); expect(container.textContent).toContain("18/20 today");
  await act(async () => chat.finish!()); expect(chat.refresh).toHaveBeenCalledTimes(1);
  await render(18); expect(container.textContent).toContain("18/20 today"); expect(container.textContent).not.toContain("19/20 today");
  chat.messages = [question("first"), question("second")]; await render(18);
  expect(container.textContent).toContain("19/20 today"); expect(container.querySelector("input")!.disabled).toBe(false);
  await render(19); expect(container.textContent).toContain("19/20 today");
  chat.messages.push(question("third")); await render(19);
  expect(container.textContent).toContain("20/20 today"); expect(container.querySelector("input")!.disabled).toBe(true);
});
it.each(["data-task-receipt", "tool-create_task"])("renders validated %s stored receipts", async kind => {
  chat.messages = [receipt(saved, kind)]; await render(0); await open();
  expect(container.querySelector('[role="status"]')!.textContent).toContain("Task saved");
  expect(container.textContent).toContain("Persisted database title"); expect(container.textContent).toContain("Personal reminder: 2027-06-01");
  expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
});
it.each([null, { status: "created", task: { ...saved.task, id: "invented" } }, { status: "created", task: { ...saved.task, due_date: "2027-02-30" } }, { task: saved.task }])("does not display malformed receipt %j as saved", async data => {
  chat.messages = [receipt(data)]; await render(0); await open();
  expect(container.querySelector('[role="status"]')).toBeNull(); expect(container.textContent).not.toContain("Task saved");
});
it("does not treat an unfinished tool part or unrelated tool as a saved receipt", async () => {
  chat.messages = [receipt(saved, "tool-create_task", "input-available")]; await render(0); await open();
  expect(container.querySelector('[role="status"]')).toBeNull();
  chat.messages = [receipt(saved, "tool-other")]; await render(0); expect(container.querySelector('[role="status"]')).toBeNull();
});
it("shows persisted retry receipts and failures honestly", async () => {
  chat.messages = [receipt({ ...saved, status: "already_exists" })]; await render(0); await open();
  expect(container.textContent).toContain("Task already saved");
  chat.messages = [receipt({ status: "failed", error: "No task was saved" })]; await render(0);
  expect(container.querySelector('[role="alert"]')!.textContent).toBe("No task was saved"); expect(container.querySelector('[role="status"]')).toBeNull();
});
