import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { message: "expired" } }) } }) }));
import { completeAuthRedirect } from "../confirm";

describe("auth return failures", () => {
  it.each(["error_code=otp_expired", "code=invalid"])("preserves the saved-path destination after %s", async (failure) => {
    const next = "/result/123?claim=1";
    const response = await completeAuthRedirect(new Request(`https://example.com/auth/confirm?${failure}&next=${encodeURIComponent(next)}`));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(next);
  });
});
