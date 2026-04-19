import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@/app": path.resolve(__dirname, "app"),
      "@/tests": path.resolve(__dirname, "tests"),
      "@": path.resolve(__dirname, "src")
    }
  }
});