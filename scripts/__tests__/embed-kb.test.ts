import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ write: vi.fn(), remove: vi.fn(), exit: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (table: string) => table === "rules"
  ? { select: () => ({ in: async () => ({ data: [], error: null }) }) }
  : { select: async () => ({ data: [{ id: "old", slug: "old" }], error: null }), insert: mocks.write, upsert: mocks.write, delete: () => ({ neq: mocks.remove, in: mocks.remove }) } }) }));
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: () => ({ textEmbeddingModel: () => ({}) }) }));
vi.mock("ai", () => ({ embedMany: async () => ({ embeddings: [[]] }) }));
vi.mock("../../lib/env", () => ({ getServerEnv: () => ({ OPENROUTER_API_KEY: "test" }) }));
vi.mock("../kb.snippets", () => ({ kbSnippets: [{ slug: "new", title: "New", content: "Test" }] }));

afterEach(() => { vi.restoreAllMocks(); });

it("retains the old knowledge base if writing replacement embeddings fails", async () => {
  mocks.write.mockResolvedValue({ error: { message: "Invalid vector dimension" } });
  mocks.remove.mockResolvedValue({ error: null });
  vi.spyOn(process, "exit").mockImplementation(mocks.exit as never);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../embed-kb");
  await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledWith(1));
  expect(mocks.write).toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
