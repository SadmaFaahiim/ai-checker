import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    testTimeout: 10_000,
    coverage: {
      // Measure only first-party library code (TASKS.md T6 / ROADMAP §5 KPI).
      provider: "v8",
      include: ["lib/**"],
      exclude: ["lib/**/*.test.ts", "lib/**/types.ts"],
      thresholds: {
        // Phase 1 KPI: fail the run (and CI) when lib/ coverage drops below 60%.
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
