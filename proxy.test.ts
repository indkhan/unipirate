import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/env", () => ({
  getClientEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testkey123",
  }),
}));

import proxy from "./proxy";

function requestTo(path: string) {
  return new NextRequest(new URL(path, "https://unipirate.local"));
}

function locationOf(response: Response) {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location!);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createServerClient.mockReturnValue({
    auth: { getClaims: mocks.getClaims },
  });
});

describe("proxy login return destination", () => {
  it("sends an anonymous /profile visit to /login with next=/profile", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const location = locationOf(await proxy(requestTo("/profile")));
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/profile");
  });

  it("preserves the exact /courses query inside next and leaks no top-level params", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const location = locationOf(
      await proxy(requestTo("/courses?degree=bachelor&city=Berlin")),
    );
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(
      "/courses?degree=bachelor&city=Berlin",
    );
    expect(location.searchParams.get("degree")).toBeNull();
    expect(location.searchParams.get("city")).toBeNull();
  });

  it("never trusts a user next parameter as redirect authority", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const location = locationOf(
      await proxy(requestTo("/profile?next=https://evil.example/phish")),
    );
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(
      "/profile?next=https://evil.example/phish",
    );
  });

  it("lets an authenticated request through without a redirect", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", app_metadata: {} } },
    });
    const response = await proxy(requestTo("/profile"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("keeps the non-admin /admin redirect on /dashboard", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", app_metadata: { role: "user" } } },
    });
    const location = locationOf(await proxy(requestTo("/admin")));
    expect(location.pathname).toBe("/dashboard");
  });

  it("lets an admin through to /admin without a redirect", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "admin-1", app_metadata: { role: "admin" } } },
    });
    const response = await proxy(requestTo("/admin"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("treats a missing claims payload as anonymous and keeps the destination", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });
    const location = locationOf(await proxy(requestTo("/dashboard")));
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });
});
