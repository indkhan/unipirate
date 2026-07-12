import { afterEach, describe, expect, it, vi } from "vitest";
import posthog from "posthog-js";

vi.mock("posthog-js", () => ({
  default: { init: vi.fn() },
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/env", () => ({
  getClientEnv: () => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PostHogProvider", () => {
  it("does not initialize PostHog while the module is evaluated", async () => {
    vi.stubGlobal("window", {});

    await import("../posthog-provider");

    expect(posthog.init).not.toHaveBeenCalled();
  });
});
