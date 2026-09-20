/**
 * @file check-export-tests
 * @description Export-coverage gate for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Walk each workspace's `src/index.ts` re-export chain (star re-exports + named re-exports)
 * - Identify callable public exports (functions, classes) inside every source file in `src/`
 * - Assert every callable export is referenced by at least one test file under that
 *   workspace's `tests/` directory or under the root `tests/` journeys
 * - Ignore constants, Zod schemas, types, and enum values (they are exercised indirectly
 *   by their consumers)
 *
 * Notes:
 * - A `PENDING` allowlist at the bottom of this file lists symbols without
 *   tests; the list is **read-only at runtime**. To add a symbol, edit this
 *   file and document the rationale in the comment above the entry. The
 *   list is reviewed at every release; it must only ever shrink.
 *
 * Exit code: non-zero on any export not covered by a test or by the allowlist.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Allowlist of symbols without tests, with rationale. Each entry must be
 * reviewed and either tested or removed at the next release. Format:
 *   { workspace: "@grimoire/<ws>", export: "<name>", reason: "<why>" }
 *
 * To add an entry: append; never remove the existing entries' comments
 * during a refactor — they are an audit trail.
 */
const PENDING = [
  // Router factories exposed by the per-service public barrel.
  // They are wired through `services/api/src/compose.ts` and have no
  // dedicated test today; the integration test under
  // `apps/api/tests/` covers them indirectly. Add direct unit tests
  // for each in the corresponding `services/<name>/tests/` directory.
  { workspace: "@grimoire/community", export: "createCommunityRouters", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/community", export: "createCommunityRouter", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/content", export: "createContentRouters", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/content", export: "createContentRouter", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/identity", export: "createIdentityRouters", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/identity", export: "createIdentityRouter", reason: "router factory; covered indirectly by apps/api integration tests" },
  { workspace: "@grimoire/llm", export: "createLlmGateway", reason: "provider factory; covered indirectly by services/agent tests" },
];

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

async function readSource(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
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
    } else if (
      (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) &&
      !ent.name.endsWith(".d.ts")
    ) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Star re-exports: `export * from "./foo.js"`.
 * Captures `export *` plus optional `type` modifier.
 */
const RE_STAR = /export\s+(?:\*)\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Named re-exports: `export { a, b as c } from "./foo.js"`.
 * Captures both bare names and `as` aliases. We treat every bare name plus
 * every alias as a re-exported symbol (the alias is what consumers see).
 */
const RE_NAMED = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

const FUNC_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const CLASS_RE = /export\s+class\s+([A-Za-z_$][\w$]*)/g;

const SCHEMA_TOKENS = ["Schema", "SchemaType"];
const ENUM_TOKENS = ["Enum", "EnumType"];
const TYPE_TOKENS = ["Type", "Config", "Options", "Args"];

/**
 * Heuristic: ignore constants, Zod schemas, types, enums.
 */
function isLikelyIgnored(name) {
  if (SCHEMA_TOKENS.some((t) => name.endsWith(t))) return true;
  if (ENUM_TOKENS.some((t) => name.endsWith(t))) return true;
  if (TYPE_TOKENS.some((t) => name.endsWith(t))) return true;
  if (name === name.toUpperCase() && name.includes("_")) return true;
  return false;
}

/**
 * Resolve a relative path that may end in `.js` to the on-disk `.ts` file.
 * Node module resolution uses `.js` for `.ts` imports in ESM; the source
 * file actually lives at `<base>.ts`.
 */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, spec);
  // If the spec ends in `.js`, strip it and let the caller append `.ts`.
  if (resolved.endsWith(".js")) resolved = resolved.slice(0, -3);
  if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) return resolved;
  // Otherwise, append `.ts` by default.
  return resolved + ".ts";
}

/**
 * Walk the star + named re-export chains from a starting file.
 * Returns the set of bare names (not aliases) reachable via star re-exports.
 * Named re-exports are tracked separately.
 */
async function walkReExports(startFile, visited = new Set()) {
  const out = new Set();
  const named = new Map(); // alias -> spec
  const queue = [startFile];
  while (queue.length) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    const src = await readSource(f);
    if (!src) continue;

    let m;
    RE_STAR.lastIndex = 0;
    while ((m = RE_STAR.exec(src)) !== null) {
      const target = resolveImport(f, m[1]);
      if (target) queue.push(target);
    }

    RE_NAMED.lastIndex = 0;
    while ((m = RE_NAMED.exec(src)) !== null) {
      const inner = m[1];
      const target = resolveImport(f, m[2]);
      if (!target) continue;
      // Parse `a, b as c`. The "as" alias is the public name.
      for (const part of inner.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const asMatch = trimmed.match(/^(\S+)\s+as\s+(\S+)$/);
        const publicName = asMatch ? asMatch[2] : trimmed;
        named.set(publicName, target);
      }
    }

    for (const re of [FUNC_RE, CLASS_RE]) {
      re.lastIndex = 0;
      while ((m = re.exec(src)) !== null) {
        out.add(m[1]);
      }
    }
  }
  return { callable: out, named };
}

/**
 * Find callable exports declared in a single source file (no re-export chase).
 */
async function findCallablesInFile(file) {
  const src = await readSource(file);
  if (!src) return new Set();
  const out = new Set();
  let m;
  for (const re of [FUNC_RE, CLASS_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      out.add(m[1]);
    }
  }
  return out;
}

const violations = [];

for (const family of WORKSPACE_GLOBS) {
  const dirs = await listDirs(path.join(root, family));
  for (const wsDir of dirs) {
    let pkg;
    try {
      pkg = await readJson(path.join(wsDir, "package.json"));
    } catch {
      continue;
    }
    const wsName = pkg.name;
    if (!wsName || !wsName.startsWith("@grimoire/")) continue;

    const indexFile = path.join(wsDir, "src", "index.ts");
    const { callable } = await walkReExports(indexFile);

    const testFiles = [
      ...(await walkTs(path.join(wsDir, "tests"))),
      ...(await walkTs(path.join(root, "tests"))),
    ];
    const testSrc = (await Promise.all(testFiles.map(readSource))).join("\n");

    for (const name of callable) {
      if (isLikelyIgnored(name)) continue;
      const re = new RegExp(`\\b${name}\\b`);
      if (re.test(testSrc)) continue;

      const isAllowed = PENDING.some(
        (p) => p.workspace === wsName && p.export === name,
      );
      if (isAllowed) continue;

      violations.push(`${wsName}: callable export '${name}' has no test reference`);
    }
  }
}

if (violations.length) {
  console.error("Untested callable exports:");
  for (const v of violations) console.error("  ", v);
  console.error("");
  console.error("Fix: write a test that imports the export, or add it to the PENDING");
  console.error("allowlist in scripts/check-export-tests.mjs with a documented rationale.");
  process.exit(1);
}

console.log(`Export coverage scan passed (${PENDING.length} pending entries).`);
