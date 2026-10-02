import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stub/server-only.ts") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
