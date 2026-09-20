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

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@grimoire/contracts": new URL("./packages/contracts/src/index.ts", import.meta.url).pathname,
      "@grimoire/foundation": new URL("./packages/foundation/src/index.ts", import.meta.url).pathname,
      "@grimoire/llm": new URL("./services/llm/src/index.ts", import.meta.url).pathname,
      "@grimoire/identity": new URL("./services/identity/src/index.ts", import.meta.url).pathname,
      "@grimoire/content": new URL("./services/content/src/index.ts", import.meta.url).pathname,
      "@grimoire/community": new URL("./services/community/src/index.ts", import.meta.url).pathname,
      "@grimoire/agent": new URL("./services/agent/src/index.ts", import.meta.url).pathname,
      "@grimoire/api": new URL("./services/api/src", import.meta.url).pathname,
      "@grimoire/web": new URL("./apps/web/src", import.meta.url).pathname,
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "packages/*/tests/**/*.test.ts",
      "services/*/tests/**/*.test.ts",
      "apps/*/tests/**/*.test.{ts,tsx}",
    ],
    testTimeout: 30_000,
    retry: 1,
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "json-summary"],
      reportsDirectory: "cov-report",
      clean: false,
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
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
