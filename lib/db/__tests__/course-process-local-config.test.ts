import { describe, expect, it } from "vitest";
import { courseProcessLocalConfig } from "./course-process-local-config";
const ci = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public", SUPABASE_SECRET_KEY: "synthetic-secret" };
describe("disposable course integration settings", () => {
  it("uses existing CI settings", () => {
    expect(courseProcessLocalConfig(ci)).toEqual({ api: ci.NEXT_PUBLIC_SUPABASE_URL, publicKey: ci.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, serviceKey: ci.SUPABASE_SECRET_KEY, enabled: true });
  });
  it("accepts explicit isolated local settings and overrides CI", () => {
    expect(courseProcessLocalConfig({ ...ci, COURSE_PROCESS_LOCAL_API: "http://127.0.0.1:55321", COURSE_PROCESS_LOCAL_PUBLIC_KEY: "local-public", COURSE_PROCESS_LOCAL_SERVICE_KEY: "local-secret" })).toEqual({ api: "http://127.0.0.1:55321", publicKey: "local-public", serviceKey: "local-secret", enabled: true });
  });
  it.each(["https://linked.supabase.co", "http://localhost:54321", "http://127.0.0.1:54320", "http://127.0.0.1:54321/", "http://127.0.0.1:54321?x=1", "http://user@127.0.0.1:54321", "https://127.0.0.1:54321"])("rejects nonallowlisted API %s even with keys", api => {
    expect(courseProcessLocalConfig({ ...ci, COURSE_PROCESS_LOCAL_API: api }).enabled).toBe(false);
  });
  it.each([{}, {...ci, SUPABASE_SECRET_KEY:""}, {...ci, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:""}, {...ci, COURSE_PROCESS_LOCAL_API:""}])("missing or explicitly empty settings never authorize service access", env => {
    expect(courseProcessLocalConfig(env).enabled).toBe(false);
  });
});
