import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

import { CheckFlow } from "../check-flow";
import { ProfileReview } from "../profile-review";
import { visibleSteps, type PartialAnswers } from "../steps";

// Reuse the hook-control approach from history-restoration.test.tsx, but run
// the rendered buttons' actual handlers and rerender their resulting state.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => hooks.effects.push(effect),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[index], (next: unknown) => {
      hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next;
    }];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("../actions", () => ({ submitCheck: vi.fn() }));
vi.mock("@/components/app/theme-toggle", () => ({ ThemeToggle: () => null }));

const initialAnswers: PartialAnswers = {
  targetDegree: "bachelor", certificateCountry: "sa", nationality: "pk",
  visaApplicationCountry: "pk", curriculumType: "gce", gceVersion: 1,
};
type ElementProps = {
  children?: ReactNode; onClick?: () => void; disabled?: boolean;
  "aria-pressed"?: boolean; className?: string;
};
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function label(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(label).join("");
  if (React.isValidElement<ElementProps>(node)) return label(node.props.children);
  return typeof node === "string" ? node : "";
}
function button(tree: ReactNode, name: string) {
  const found = elements(tree).find(node => node.type === "button" && label(node) === name);
  expect(found, name).toBeDefined();
  return found!;
}
function render(component: () => ReactNode) {
  hooks.cursor = 0;
  hooks.effects = [];
  return component();
}
beforeEach(() => {
  hooks.values = [];
  vi.stubGlobal("window", { history: { state: {}, pushState: vi.fn(), replaceState: vi.fn() }, location: { href: "http://localhost/check" } });
});
afterEach(() => vi.unstubAllGlobals());

it("a clicked British international selection survives session draft restoration", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("queueMicrotask", (callback: () => void) => callback());
  const component = () => CheckFlow({ initialAnswers, initialStepIndex: visibleSteps(initialAnswers).indexOf("gceQualificationContext") });
  render(component);
  hooks.effects[1](); // Recover the initial draft and mark restoration complete.
  let tree = render(component);
  button(tree, "British international A-Level qualification").props.onClick!();
  render(component);
  hooks.effects[2](); // Persist the clicked answer through CheckFlow's effect.
  expect(JSON.parse(storage.get("unipirate.check.v1:sa")!).answers.gceQualificationContext).toBe("british_international");
  hooks.values = []; // Fresh component instance reads the persisted draft.
  render(component);
  hooks.effects[1]();
  tree = render(component);
  expect(button(tree, "British international A-Level qualification").props["aria-pressed"]).toBe(true);
  expect(button(tree, "Continue").props.disabled).toBe(false);
});

const choices = [
  ["british_international", "British international A-Level qualification"],
  ["uk", "UK GCE qualification"],
  ["national", "Part of a national school-leaving system"],
  ["unknown", "Not sure"],
] as const;

it.each(choices)("checker button selects %s visibly and retains it through Continue and Back", (value, name) => {
  const component = () => CheckFlow({ initialAnswers, initialStepIndex: visibleSteps(initialAnswers).indexOf("gceQualificationContext") });
  let tree = render(component);
  expect(button(tree, "Continue").props.disabled).toBe(true);
  button(tree, name).props.onClick!();
  tree = render(component);
  expect((hooks.values[0] as PartialAnswers).gceQualificationContext).toBe(value);
  expect(button(tree, name).props["aria-pressed"]).toBe(true);
  expect(button(tree, name).props.className).toContain("optionSelected");
  expect(button(tree, "Continue").props.disabled).toBe(false);
  button(tree, "Continue").props.onClick!();
  tree = render(component);
  expect(elements(tree).some(node => node.type === "h1" && label(node).includes("printed on"))).toBe(true);
  button(tree, "‹ Back").props.onClick!();
  tree = render(component);
  expect(button(tree, name).props["aria-pressed"]).toBe(true);
});

it("profile editing restores the stored identity and visibly switches between all alternatives", () => {
  const saved = { ...initialAnswers, gceQualificationContext: "british_international" as const };
  const component = () => ProfileReview({ initialAnswers: saved });
  let tree = render(component);
  expect(button(tree, choices[0][1]).props["aria-pressed"]).toBe(true);
  for (const [value, name] of [...choices.slice(1), choices[0]]) {
    button(tree, name).props.onClick!();
    tree = render(component);
    expect((hooks.values[0] as PartialAnswers).gceQualificationContext).toBe(value);
    expect(button(tree, name).props["aria-pressed"]).toBe(true);
    expect(button(tree, name).props.className).toContain("reviewChoiceSelected");
    expect(choices.filter(([, choice]) => button(tree, choice).props["aria-pressed"])).toHaveLength(1);
  }
  expect(saved.gceQualificationContext).toBe("british_international");
});
