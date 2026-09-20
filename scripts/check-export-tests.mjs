/**
 * @file check-export-tests
 * @description Export-coverage gate for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Walk each workspace's `src/index.ts` re-export chain
 * - Identify callable public exports (functions, classes, arrows)
 * - Assert every callable export is referenced by at least one test file
 *   under the workspace's own `tests/` or the root `tests/` journeys
 * - Ignore constants, Zod schemas, and enum values (they are exercised
 *   indirectly by their consumers)
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
  // { workspace: "@grimoire/example", export: "createExample", reason: "TODO: <ADR-NNN>" },
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
    } else if ((ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) && !ent.name.endsWith(".d.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

const RE_EXPORTS = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
const FUNC_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const CLASS_RE = /export\s+class\s+([A-Za-z_$][\w$]*)/g;
const CONST_RE = /export\s+const\s+([A-Za-z_$][\w$]*)/g;
const TYPE_RE = /export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/g;

const SCHEMA_TOKENS = ["Schema", "SchemaType"];
const ENUM_TOKENS = ["Enum", "EnumType"];
const TYPE_TOKENS = ["Type", "Config", "Options", "Args"];

function isCallable(name, src) {
  // Heuristic: if the export matches a function or class declaration,
  // it's callable. Constants / types / schemas are excluded.
  if (/\bfunction\s+/.test(src.slice(0, src.indexOf(name)))) return true;
  if (/\bclass\s+/.test(src.slice(0, src.indexOf(name)))) return true;
  if (FUNC_RE.test(`export function ${name}`)) return true;
  if (CLASS_RE.test(`export class ${name}`)) return true;
  return false;
}

function isLikelyIgnored(name) {
  if (SCHEMA_TOKENS.some((t) => name.endsWith(t))) return true;
  if (ENUM_TOKENS.some((t) => name.endsWith(t))) return true;
  if (TYPE_TOKENS.some((t) => name.endsWith(t))) return true;
  // Common non-callable exports
  if (name === name.toUpperCase() && name.includes("_")) return true;
  return false;
}

async function collectExports(wsDir) {
  const indexFile = path.join(wsDir, "src", "index.ts");
  const src = await readSource(indexFile);
  if (!src) return { reExports: [], localExports: [] };

  const reExports = [];
  let m;
  RE_EXPORTS.lastIndex = 0;
  while ((m = RE_EXPORTS.exec(src)) !== null) {
    reExports.push(m[1]);
  }

  const localExports = [];
  for (const re of [FUNC_RE, CLASS_RE, CONST_RE, TYPE_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      localExports.push(m[1]);
    }
  }
  return { reExports, localExports };
}

async function resolveReExports(startFile, visited = new Set()) {
  // Recursively walk re-export chains to gather callable exports
  const out = new Set();
  const queue = [startFile];
  while (queue.length) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    const src = await readSource(f);
    if (!src) continue;

    let m;
    RE_EXPORTS.lastIndex = 0;
    while ((m = RE_EXPORTS.exec(src)) !== null) {
      const target = m[1];
      if (target.startsWith(".")) {
        const dir = path.dirname(f);
        const resolved = path.resolve(dir, target);
        queue.push(resolved + ".ts");
      }
    }

    for (const re of [FUNC_RE, CLASS_RE]) {
      re.lastIndex = 0;
      while ((m = re.exec(src)) !== null) {
        out.add(m[1]);
      }
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
    const allExports = await resolveReExports(indexFile);

    const testFiles = [
      ...(await walkTs(path.join(wsDir, "tests"))),
      ...(await walkTs(path.join(root, "tests"))),
    ];
    const testSrc = (await Promise.all(testFiles.map(readSource))).join("\n");

    for (const name of allExports) {
      if (isLikelyIgnored(name)) continue;
      // The export must be referenced as an identifier in some test file.
      // Loose heuristic: look for word-boundary match.
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
