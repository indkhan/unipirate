// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TaskProposal } from "@/lib/planning/proposals";
const io = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn(), retry: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock("@/app/(app)/suggestions/actions", () => ({ approveSuggestions: io.approve, rejectSuggestion: io.reject, retrySuggestionJob: io.retry }));
import { SuggestionNotifications } from "../suggestion-notifications";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function proposal(n: number): TaskProposal {
  return { id: id(n), revision: n + 1, user_id: id(999), application_id: null, course_id: null,
    semantic_action_key: `prepare:${n}`, stage: "preliminary", title: `Suggestion ${n}`, description: null,
    reason: "Confirm with official source", due_date: null, verbatim_due: null, evidence: [],
    source_version_id: null, offering_id: null, intake_term: null, intake_year: null, applicant_group: null,
    input_fingerprint: "a".repeat(64), material_fingerprint: "b".repeat(64), status: "pending",
    approved_revision: null, approved_task_id: null, approval_fingerprint: null, base_task_revision: null,
    before_task: null, change_fields: [], legacy_task_key: null, created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z" };
}
type Job = { id: string; application_id: string | null; event: "research" | "preliminary" | "verified"; state: "failed" | "queued" };
let envelope: { proposals: TaskProposal[]; applicationNames: Record<string, string>; jobs: Job[] };
let fetchMock: ReturnType<typeof vi.fn>;
let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  envelope = { proposals: [], applicationNames: {}, jobs: [] };
  for (const mock of Object.values(io)) mock.mockReset();
  io.approve.mockResolvedValue(undefined); io.retry.mockResolvedValue(undefined);
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => envelope })); vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount(full = true) { await act(async () => root.render(<SuggestionNotifications full={full} />)); }
function button(text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(b => b.textContent === text);
  if (!found) throw new Error(`Missing button ${text}`); return found;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function poll() { await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); }
it("polls saved arrivals only while visible and refreshes on visibility change", async () => {
  await mount(); expect(fetchMock).toHaveBeenCalledWith("/api/suggestions", { cache: "no-store" });
  envelope = { ...envelope, proposals: [proposal(1)] }; await poll(); expect(container.textContent).toContain("Suggestion 1");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const calls = fetchMock.mock.calls.length; await poll(); expect(fetchMock).toHaveBeenCalledTimes(calls);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  await act(async () => document.dispatchEvent(new Event("visibilitychange"))); expect(fetchMock).toHaveBeenCalledTimes(calls + 1);
});
it("shows failed planning jobs only on the full page and excludes research jobs", async () => {
  envelope.jobs = [{ id: id(301), application_id: null, event: "preliminary", state: "failed" }, { id: id(302), application_id: null, event: "verified", state: "failed" }, { id: id(303), application_id: null, event: "research", state: "failed" }];
  await mount(false); expect(container.textContent).not.toContain("Retry planning");
  await mount(); expect(Array.from(container.querySelectorAll("button")).filter(b => b.textContent === "Retry planning")).toHaveLength(2);
});
it("guards duplicate retry actions then refreshes persisted job state", async () => {
  const job: Job = { id: id(301), application_id: null, event: "preliminary", state: "failed" }; envelope.jobs = [job];
  let finish!: () => void; const pending = new Promise<void>(resolve => { finish = resolve; }); io.retry.mockReturnValue(pending);
  await mount(); const retry = button("Retry planning"); await act(async () => { retry.click(); retry.click(); });
  expect(io.retry).toHaveBeenCalledExactlyOnceWith({ id: job.id }); expect(retry.disabled).toBe(true);
  envelope = { ...envelope, jobs: [{ ...job, state: "queued" }] }; await act(async () => finish());
  expect(container.textContent).not.toContain("Retry planning"); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("retains failed retry work and permits retry after an unconfirmed action", async () => {
  envelope.jobs = [{ id: id(301), application_id: null, event: "verified", state: "failed" }];
  io.retry.mockRejectedValueOnce(new Error("Offline")); await mount(); await click(button("Retry planning"));
  expect(container.textContent).toContain("The retry could not be confirmed. Your saved work remains available.");
  expect(button("Retry planning").disabled).toBe(false); expect(fetchMock).toHaveBeenCalledTimes(1);
  await click(button("Retry planning")); expect(io.retry).toHaveBeenCalledTimes(2); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("approves over 100 shown proposals in exact bounded batches excluding late arrivals", async () => {
  const original = Array.from({ length: 103 }, (_, n) => proposal(n + 1)); envelope.proposals = original;
  await mount(); expect(container.querySelectorAll("article")).toHaveLength(103); await click(button("Approve all shown (103)"));
  envelope = { ...envelope, proposals: [...original.map(p => ({ ...p, revision: p.revision + 1 })), proposal(200)] }; await poll();
  expect(container.querySelector('[aria-label="Confirm approval"]')!.textContent).not.toContain("Suggestion 200");
  await click(button("Confirm approval")); expect(io.approve).toHaveBeenCalledTimes(2);
  expect(io.approve.mock.calls[0][0]).toEqual(original.slice(0, 100).map(p => ({ id: p.id, revision: p.revision })));
  expect(io.approve.mock.calls[1][0]).toEqual(original.slice(100).map(p => ({ id: p.id, revision: p.revision })));
  expect(io.refresh).toHaveBeenCalledTimes(1);
});
it("reports exactly the confirmed first batch when later approval fails", async () => {
  const original = Array.from({ length: 103 }, (_, n) => proposal(n + 1)); envelope.proposals = original;
  io.approve.mockImplementationOnce(async () => { envelope = { ...envelope, proposals: original.map((p, n) => n < 100 ? { ...p, status: "approved" } : p) }; }).mockRejectedValueOnce(new Error("Source changed"));
  await mount(); await click(button("Approve all shown (103)")); await click(button("Confirm approval"));
  expect(container.querySelector('[aria-label="Confirm approval"]')!.textContent).toContain("100 suggestions were confirmed. The remaining suggestions changed or could not be confirmed; review the refreshed list.");
  expect(container.querySelectorAll("article")).toHaveLength(3); expect(container.textContent).toContain("History (100)");
  expect(io.approve).toHaveBeenCalledTimes(2); expect(io.approve.mock.calls[1][0]).toEqual(original.slice(100).map(p => ({ id: p.id, revision: p.revision })));
  expect(io.refresh).toHaveBeenCalledTimes(1);
});
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
it.each(["response", "json"])("ignores an old pending %s after approval refresh commits approved history", async phase => {
  const pending = proposal(1); envelope.proposals = [pending]; await mount(false);
  const stale = { ...envelope, proposals: [pending] };
  const response = deferred<{ ok: boolean; json: () => Promise<typeof envelope> }>();
  const json = deferred<typeof envelope>();
  fetchMock.mockImplementationOnce(() => phase === "response" ? response.promise : Promise.resolve({ ok: true, json: () => json.promise }));
  await poll(); await click(button("Approve"));
  envelope = { ...envelope, proposals: [{ ...pending, status: "approved" }] };
  await click(button("Confirm approval"));
  expect(container.querySelector('[aria-label="New task suggestion"]')).toBeNull();
  await act(async () => {
    if (phase === "response") response.resolve({ ok: true, json: async () => stale });
    else json.resolve(stale);
  });
  expect(container.querySelector('[aria-label="New task suggestion"]')).toBeNull();
  expect(container.textContent).toBe("Suggestions"); expect(io.approve).toHaveBeenCalledTimes(1);
});
it("ignores an old failed planning job after retry refresh commits queued state", async () => {
  const job: Job = { id: id(301), application_id: null, event: "verified", state: "failed" };
  envelope.jobs = [job]; await mount(); const stale = { ...envelope, jobs: [job] };
  const old = deferred<typeof envelope>();
  fetchMock.mockImplementationOnce(async () => ({ ok: true, json: () => old.promise })); await poll();
  envelope = { ...envelope, jobs: [{ ...job, state: "queued" }] }; await click(button("Retry planning"));
  expect(container.textContent).not.toContain("Retry planning");
  await act(async () => old.resolve(stale));
  expect(container.textContent).not.toContain("Retry planning"); expect(container.textContent).not.toContain("could not be prepared");
  expect(io.retry).toHaveBeenCalledExactlyOnceWith({ id: job.id });
});
it("ignores a late failed fetch after a newer poll renders a new arrival", async () => {
  await mount(); const old = deferred<never>();
  fetchMock.mockImplementationOnce(() => old.promise); await poll();
  envelope = { ...envelope, proposals: [proposal(2)] }; await poll();
  expect(container.textContent).toContain("Suggestion 2");
  await act(async () => old.reject(new Error("Stale poll failed")));
  expect(container.textContent).toContain("Suggestion 2"); expect(container.textContent).not.toContain("Stale poll failed");
  expect(container.querySelector('[role="status"]')).toBeNull();
});
