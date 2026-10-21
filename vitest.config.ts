import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    reporters: ["default", "json"],
    outputFile: ".reports/unit.json",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    maxWorkers: 2,
  },
});
