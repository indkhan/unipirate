// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DAAD_PAGE_TEXT } from "@/lib/courses/__tests__/fixtures";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), add: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ addCourseToDashboard: mocks.add }));
import { AddCourseSheet } from "../add-course-sheet";
let root: Root;
let host: HTMLDivElement;
const fetchMock = vi.fn();
beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", fetchMock);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AddCourseSheet />));
  await click("Add it by URL");
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find(button => button.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function enter(selector: string, value: string) {
  const input = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
const url = "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/12345/";
async function pasteStep() {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ course: null }), { status: 200 }));
  await enter("input", url); await submit();
}
it("has only link/full paste inputs and submits their exact values", async () => {
  await pasteStep();
  expect(host.querySelectorAll("input")).toHaveLength(0);
  const textarea = host.querySelector("textarea")!;
  expect(textarea.minLength).toBe(200); expect(textarea.maxLength).toBe(200_000);
  expect(host.textContent).not.toMatch(/research seed|Programme name|University name/i);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ course: { id: "course" }, researchQueued: true }), { status: 201 }));
  const text = ` \n${DAAD_PAGE_TEXT}\n `;
  await enter("textarea", text); await submit();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ url, text });
  expect(mocks.refresh).toHaveBeenCalled(); expect(host.textContent).toContain("Course saved.");
});
it.each([
  [422, "Return to the DAAD course page and copy the full text."],
  [503, "Could not finish saving the course to your dashboard. Try again."],
])("keeps paste and shows actual %i error with no extra name fallback", async (status, error) => {
  await pasteStep(); await enter("textarea", DAAD_PAGE_TEXT);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error }), { status }));
  await submit();
  expect(host.textContent).toContain(error); expect(host.querySelector("textarea")!.value).toBe(DAAD_PAGE_TEXT);
  expect(host.querySelectorAll("input")).toHaveLength(0); expect(mocks.refresh).not.toHaveBeenCalled();
});
it("shows an invalid-host error at the URL step", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Use the DAAD International Programmes course-page link." }), { status: 400 }));
  await enter("input", "https://daad.de.evil.example/course"); await submit();
  expect(host.textContent).toContain("Use the DAAD International Programmes"); expect(host.querySelector("textarea")).toBeNull();
});
it("retains found-course update target and already-added state", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ course: { id: "saved", name: "Saved course", university_name: "University", review_status: "approved" }, onDashboard: true }), { status: 200 }));
  await enter("input", url); await submit();
  expect(host.textContent).toContain("Already in dashboard");
  await click("The page changed — submit an update"); await enter("textarea", DAAD_PAGE_TEXT);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ course: { id: "update" } }), { status: 201 })); await submit();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ url, text: DAAD_PAGE_TEXT, conflictsWith: "saved" });
});
