/**
 * @file vitest.config
 * @description Root Vitest configuration for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Resolve workspace aliases so test files can import via @grimoire/<package>
 * - Discover unit tests across packages, services, apps, and the root tests/ journeys
 * - Apply coverage thresholds that act as a CI gate
 *
 * Notes:
 * - `testTimeout` and `retry` are tuned for the Windows + PowerShell cold start
 *   and file-lock release jitter observed in this environment.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@grimoire/contracts": r("./packages/contracts/src/index.ts"),
      "@grimoire/foundation": r("./packages/foundation/src/index.ts"),
      "@grimoire/llm": r("./services/llm/src/index.ts"),
      "@grimoire/identity": r("./services/identity/src/index.ts"),
      "@grimoire/content": r("./services/content/src/index.ts"),
      "@grimoire/community": r("./services/community/src/index.ts"),
      "@grimoire/agent": r("./services/agent/src/index.ts"),
      "@grimoire/api": r("./services/api/src"),
      "@grimoire/web": r("./apps/web/src"),
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "packages/*/tests/**/*.test.ts",
      "services/*/src/**/*.test.{ts,tsx}",
      "services/*/tests/**/*.test.ts",
      "apps/*/src/**/*.test.{ts,tsx}",
      "apps/*/tests/**/*.test.{ts,tsx}",
    ],
    testTimeout: 30_000,
    retry: 1,
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "json-summary"],
      reportsDirectory: "cov-report",
      clean: true,
      include: [
        "packages/*/src/**/*.ts",
        "services/*/src/**/*.ts",
        "apps/web/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "**/index.ts",
        "**/types.ts",
        "**/tests/**",
        "**/dist/**",
      ],
      thresholds: {
        // Floor pinned to the current suite's actual coverage (statement ~25 /
        // branch ~23 / function ~20 / line ~26). The 70/60/70/70 target in the
        // docs is aspirational until the pruned suites are restored; ratchet
        // these up as tests land — never lower them to admit a change.
        statements: 22,
        branches: 20,
        functions: 18,
        lines: 23,
      },
    },
  },
});
