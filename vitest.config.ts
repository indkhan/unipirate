import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    // Bound the CPU-heavy immutable corpus and avoid fork RPC update timeouts.
    pool: "threads",
    maxWorkers: 1,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".claude/**"],
  },
});
