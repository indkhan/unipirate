// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalPopup, SuggestionsList, type TaskProposalView } from "../task-suggestions";

function proposal(id: string, revision = 1): TaskProposalView {
  return { id, revision, user_id: "owner", application_id: null, course_id: null,
    semantic_action_key: id, stage: "preliminary", title: `Suggestion ${id}`, description: null,
    reason: "Confirm with official source", due_date: "2027-07-15", verbatim_due: null,
    evidence: [], source_version_id: null, offering_id: null, intake_term: null, intake_year: null,
    applicant_group: null, input_fingerprint: "input", material_fingerprint: id, status: "pending",
    approved_revision: null, approved_task_id: null, base_task_revision: null, before_task: null,
    change_fields: [], legacy_task_key: null, created_at: "2026-10-09", updated_at: "2026-10-09" };
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function button(text: string, scope: ParentNode = container): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll("button")).find(b => b.textContent === text);
  if (!found) throw new Error(`Missing button ${text}`); return found;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
function dialog() { return container.querySelector('[aria-label="Confirm approval"]')!; }
async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
for (const [name, Component] of [["list", SuggestionsList], ["popup", ProposalPopup]] as const) {
  describe(`${name} mounted approval`, () => {
    it("sends the original individual ID/revision despite arrivals and revision refresh", async () => {
      const approve = vi.fn().mockResolvedValue(undefined), reject = vi.fn();
      const render = async (proposals: TaskProposalView[]) => act(async () => root.render(<Component proposals={proposals} applicationNames={{}} approve={approve} reject={reject} />));
      await render([proposal("one", 3)]); await click(button("Approve"));
      await render([proposal("one", 4), proposal("arriving", 2)]);
      expect(dialog().textContent).not.toContain("Suggestion arriving");
      await click(button("Confirm approval")); expect(approve).toHaveBeenCalledExactlyOnceWith([{ id: "one", revision: 3 }]);
    });
    it("clears a reminder in the real edit form and confirmation payload", async () => {
      const approve = vi.fn().mockResolvedValue(undefined);
      await act(async () => root.render(<Component proposals={[proposal("one", 3)]} applicationNames={{}} approve={approve} reject={vi.fn()} />));
      await click(button("Edit & approve")); await change(container.querySelector('input[type="date"]')!, "");
      await click(button("Approve with edits"));
      expect(dialog().textContent).not.toContain("2027-07-15");
      await click(button("Confirm approval"));
      expect(approve).toHaveBeenCalledExactlyOnceWith([{ id: "one", revision: 3, edit: { title: "Suggestion one", description: null, dueDate: null } }]);
    });
    it("resets the edit form when the reviewed proposal revision changes", async () => {
      const approve = vi.fn().mockResolvedValue(undefined), reject = vi.fn();
      const render = async (proposals: TaskProposalView[]) => act(async () => root.render(<Component proposals={proposals} applicationNames={{}} approve={approve} reject={reject} />));
      await render([proposal("one", 3)]); await click(button("Edit & approve"));
      await change(container.querySelector('input:not([type])')!, "Unsaved old edit");
      const refreshed = { ...proposal("one", 4), title: "New reviewed title", description: "New reviewed description", due_date: "2027-08-01" };
      await render([refreshed]);
      // A refreshed source invalidates the old edit session and requires renewed review.
      expect(container.querySelector('input[type="date"]')).toBeNull();
      await click(button("Edit & approve"));
      expect(container.querySelector<HTMLInputElement>('input:not([type])')!.value).toBe("New reviewed title");
      expect(container.querySelector("textarea")!.value).toBe("New reviewed description");
      expect(container.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe("2027-08-01");
      await click(button("Approve with edits")); await click(button("Confirm approval"));
      expect(approve).toHaveBeenCalledExactlyOnceWith([{ id: "one", revision: 4, edit: { title: "New reviewed title", description: "New reviewed description", dueDate: "2027-08-01" } }]);
    });
    it("rejects through the caller then reflects persisted props without deleting locally", async () => {
      const reject = vi.fn().mockResolvedValue(undefined), p = proposal("one", 3);
      const render = async (proposals: TaskProposalView[]) => act(async () => root.render(<Component proposals={proposals} applicationNames={{}} approve={vi.fn()} reject={reject} />));
      await render([p]); await click(button("Reject"));
      expect(reject).toHaveBeenCalledExactlyOnceWith("one", 3); expect(container.querySelectorAll("article")).toHaveLength(1);
      await render([{ ...p, status: "dismissed" }]); expect(container.querySelectorAll("article")).toHaveLength(0);
    });
    it("retains pending proposals and confirmation after an approval error", async () => {
      const approve = vi.fn().mockRejectedValue(new Error("Review changed source"));
      await act(async () => root.render(<Component proposals={[proposal("one")]} applicationNames={{}} approve={approve} reject={vi.fn()} />));
      await click(button("Approve")); await click(button("Confirm approval"));
      expect(dialog().textContent).toContain("Review changed source"); expect(container.querySelectorAll("article")).toHaveLength(1);
      expect(button("Confirm approval").disabled).toBe(false);
    });
    it("guards same-tick duplicate confirmation while the caller is pending", async () => {
      let finish!: () => void;
      const pending = new Promise<void>(resolve => { finish = resolve; });
      const approve = vi.fn(() => pending);
      await act(async () => root.render(<Component proposals={[proposal("one")]} applicationNames={{}} approve={approve} reject={vi.fn()} />));
      await click(button("Approve")); const confirm = button("Confirm approval");
      await act(async () => { confirm.click(); confirm.click(); });
      const calls = approve.mock.calls.length;
      expect(confirm.disabled).toBe(true);
      await act(async () => finish()); expect(calls).toBe(1);
    });
    it("keeps a failed rejection pending and permits a later retry", async () => {
      const reject = vi.fn().mockRejectedValueOnce(new Error("Reject was not saved")).mockResolvedValueOnce(undefined);
      await act(async () => root.render(<Component proposals={[proposal("one", 3)]} applicationNames={{}} approve={vi.fn()} reject={reject} />));
      await click(button("Reject")); expect(container.textContent).toContain("Reject was not saved");
      expect(container.querySelectorAll("article")).toHaveLength(1); expect(button("Reject").disabled).toBe(false);
      await click(button("Reject")); expect(reject).toHaveBeenCalledTimes(2);
      expect(container.textContent).not.toContain("Reject was not saved");
    });
    it("guards same-tick duplicate rejection while persistence is pending", async () => {
      let finish!: () => void;
      const pending = new Promise<void>(resolve => { finish = resolve; });
      const reject = vi.fn(() => pending);
      await act(async () => root.render(<Component proposals={[proposal("one", 3)]} applicationNames={{}} approve={vi.fn()} reject={reject} />));
      const rejectButton = button("Reject");
      await act(async () => { rejectButton.click(); rejectButton.click(); });
      const calls = reject.mock.calls.length; expect(rejectButton.disabled).toBe(true);
      await act(async () => finish()); expect(calls).toBe(1);
    });
    it("renders more than five proposals", async () => {
      await act(async () => root.render(<Component proposals={Array.from({ length: 8 }, (_, i) => proposal(String(i)))} applicationNames={{}} approve={vi.fn()} reject={vi.fn()} />));
      expect(container.querySelectorAll("article")).toHaveLength(8);
    });
  });
}
it.each(["selected", "all shown"])("snapshots exact %s IDs and revisions before new arrivals", async mode => {
  const approve = vi.fn().mockResolvedValue(undefined), reject = vi.fn();
  const render = async (proposals: TaskProposalView[]) => act(async () => root.render(<SuggestionsList proposals={proposals} applicationNames={{}} approve={approve} reject={reject} />));
  const original = [proposal("one", 3), proposal("two", 7)]; await render(original);
  if (mode === "selected") await click(container.querySelector('input[type="checkbox"]')!);
  await click(button(mode === "selected" ? "Approve selected (1)" : "Approve all shown (2)"));
  await render([...original.map(p => ({ ...p, revision: p.revision + 1 })), proposal("arrival")]);
  await click(button("Confirm approval"));
  expect(approve).toHaveBeenCalledExactlyOnceWith((mode === "selected" ? original.slice(0, 1) : original).map(p => ({ id: p.id, revision: p.revision })));
});
