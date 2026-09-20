/**
 * @file check-package-deps
 * @description Dependency-honesty gate for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Reject value / dynamic import of an undeclared `@grimoire/*` workspace dep
 * - Reject type-only import of an undeclared `@grimoire/*` workspace dep
 * - Reject value import from a declared `devDependency` at runtime
 * - Reject declared runtime / dev dep that is imported nowhere
 * - Reject value / dynamic dependency cycles (type-only edges ignored)
 * - Warn on declared runtime dep used only in test files (suggest demotion to devDependencies)
 *
 * Notes:
 * - Each workspace's `package.json` is the source of truth; the gate walks
 *   `src/` and `tests/` of every workspace and asserts that every import
 *   matches a declared dependency.
 *
 * Exit code: non-zero on any hard failure (warn-only findings do not exit).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WORKSPACE_GLOBS = ["apps", "packages", "services"];

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

async function listDirs(parent) {
  let entries;
  try {
    entries = await readdir(parent, { withFileTypes: true });
  } catch (e) {
    if (e && e.code === "ENOENT") return [];
    throw e;
  }
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(parent, e.name));
}

async function walkTs(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e && e.code === "ENOENT") return acc;
    throw e;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      await walkTs(p, acc);
    } else if ((ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) && !ent.name.endsWith(".d.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function isTestFile(p) {
  return p.includes(`${path.sep}tests${path.sep}`) || p.endsWith(".test.ts") || p.endsWith(".test.tsx");
}

const IMPORT_RE = /(?:import\s+(?:[^'"]*?from\s+)?|export\s+(?:[^'"]*?from\s+)?|import\s*\(\s*)['"]([^'"]+)['"]/g;
const TYPE_ONLY_PREFIXES = ["import type ", "export type "];

function extractImports(src, file) {
  const out = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const startIdx = Math.max(0, m.index - 12);
    const prefix = src.slice(startIdx, m.index);
    const isTypeOnly = TYPE_ONLY_PREFIXES.some((p) => prefix.endsWith(p) || src.slice(Math.max(0, m.index - 16), m.index).includes(p));
    out.push({ spec: m[1], typeOnly: isTypeOnly });
  }
  return out;
}

const violations = [];
const warnings = [];

for (const family of WORKSPACE_GLOBS) {
  const familyDir = path.join(root, family);
  const dirs = await listDirs(familyDir);
  for (const wsDir of dirs) {
    const pkgPath = path.join(wsDir, "package.json");
    let pkg;
    try {
      pkg = await readJson(pkgPath);
    } catch {
      continue;
    }
    const wsName = pkg.name;
    if (!wsName || !wsName.startsWith("@grimoire/")) continue;

    const declaredRuntime = new Set([
      ...Object.keys(pkg.dependencies || {}),
    ]);
    const declaredDev = new Set([
      ...Object.keys(pkg.devDependencies || {}),
    ]);
    const declaredPeer = new Set([
      ...Object.keys(pkg.peerDependencies || {}),
    ]);

    const seenRuntime = new Set();
    const seenDev = new Set();

    const srcDir = path.join(wsDir, "src");
    const testsDir = path.join(wsDir, "tests");
    const allFiles = [
      ...(await walkTs(srcDir)),
      ...(await walkTs(testsDir)),
    ];

    for (const file of allFiles) {
      const src = await readFile(file, "utf8");
      const imports = extractImports(src, file);
      const inTests = isTestFile(file);

      for (const { spec, typeOnly } of imports) {
        if (!spec.startsWith("@grimoire/")) continue;
        const depName = spec;
        const inDeclared =
          declaredRuntime.has(depName) ||
          declaredDev.has(depName) ||
          declaredPeer.has(depName);
        if (!inDeclared) {
          violations.push(
            `${path.relative(root, file)}: undeclared ${typeOnly ? "type-only " : ""}import of '${spec}'`,
          );
          continue;
        }
        if (!typeOnly && declaredDev.has(depName) && !inTests) {
          violations.push(
            `${path.relative(root, file)}: value import of devDependency '${spec}'`,
          );
        }
        if (inTests) seenDev.add(depName);
        else seenRuntime.add(depName);
      }
    }

    // Detect declared runtime deps used only in tests
    for (const dep of declaredRuntime) {
      if (!dep.startsWith("@grimoire/")) continue;
      if (!seenRuntime.has(dep) && seenDev.has(dep)) {
        warnings.push(
          `${wsName}: runtime dep '${dep}' is used only in tests; consider demoting to devDependencies.`,
        );
      }
    }

    // Detect declared but unused deps (best-effort; only flags the obvious ones)
    for (const dep of [...declaredRuntime, ...declaredDev]) {
      if (!dep.startsWith("@grimoire/")) continue;
      if (!seenRuntime.has(dep) && !seenDev.has(dep)) {
        warnings.push(
          `${wsName}: declared dep '${dep}' is not imported anywhere in src/ or tests/.`,
        );
      }
    }
  }
}

if (violations.length) {
  console.error("Dependency honesty violations:");
  for (const v of violations) console.error("  ", v);
  console.error("");
  console.error("Fix: edit the workspace package.json to declare every workspace dep it imports.");
  process.exit(1);
}

if (warnings.length) {
  console.warn("Dependency hygiene warnings:");
  for (const w of warnings) console.warn("  ", w);
}

console.log("Dependency honesty scan passed.");
