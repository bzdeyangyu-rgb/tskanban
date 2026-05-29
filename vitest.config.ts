import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "web/src/**/*.test.ts", "web/src/**/*.test.tsx"]
  }
});
