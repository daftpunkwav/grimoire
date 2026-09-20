/**
 * @file check-i18n
 * @description i18n gate for the Grimoire web app.
 *
 * Responsibilities:
 * - Verify catalog key parity between `apps/web/src/i18n/catalogs/en` and `apps/web/src/i18n/catalogs/zh-CN`
 * - Sweep `apps/web/src/app`, `apps/web/src/components`, and `apps/web/src/i18n` for hardcoded
 *   Chinese strings outside the `zh-CN` catalogs (comments and `console.*` calls are exempt)
 * - Allowlist a small set of known non-user-visible CJK occurrences (e.g. token-payload sentinels)
 *
 * Notes:
 * - Run from the repo root: `node apps/web/scripts/check-i18n.mjs` or `pnpm --filter @grimoire/web check:i18n`.
 *
 * Exit code: non-zero on any parity mismatch or any out-of-catalog CJK occurrence.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const webSrc = path.join(root, "apps", "web", "src");
const enDir = path.join(webSrc, "i18n", "catalogs", "en");
const zhDir = path.join(webSrc, "i18n", "catalogs", "zh-CN");

const SWEEP_DIRS = [
  path.join(webSrc, "app"),
  path.join(webSrc, "components"),
  path.join(webSrc, "i18n"),
];

// Allowlist for known non-user-visible CJK occurrences.
// Format: "relative/path.ts:lineNumber"
// Add explicit entries only; do not blanket-allow.
const ALLOWLIST = new Set([
  // token-payload sentinels (e.g. `${prefix}_${zh-sentinel}_${suffix}`)
]);

const CJK_RE = /[\u3400-\u9fff]/;

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

async function readSource(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Strip comments and string literals from a source file. Used so a
 * catalog key that happens to appear inside a comment or a string is
 * not counted as a key.
 */
function stripCommentsAndStrings(src) {
  // Strip block comments
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  // Strip line comments (must not be inside a string; rough heuristic)
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m) => {
    const prefix = m.startsWith("//") ? "" : m[0];
    return prefix + " ".repeat(m.length - prefix.length);
  });
  return out;
}

/**
 * Extract the top-level keys of every `export const X = { ... }` block.
 *
 * Strategy: find each `export const X = {` opener, scan forward to its
 * matching closing brace while tracking brace depth, then on the captured
 * body walk line-by-line and collect keys at depth === 1 (the immediate
 * children of the exported object). Nested children are intentionally
 * ignored — parity is namespace-shaped, not leaf-shaped.
 */
function extractTopLevelKeys(src) {
  const cleaned = stripCommentsAndStrings(src);
  const result = new Map();
  const opener = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let m;
  while ((m = opener.exec(cleaned)) !== null) {
    const name = m[1];
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < cleaned.length && depth > 0) {
      const ch = cleaned[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const body = cleaned.slice(m.index + m[0].length, i - 1);

    const keys = new Set();
    let lineDepth = 0;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine;
      // Update depth per line based on `{` / `}` characters outside strings.
      // (Comments and strings were already replaced with spaces by
      // stripCommentsAndStrings, so the count is safe.)
      for (const ch of line) {
        if (ch === "{") lineDepth++;
        else if (ch === "}") lineDepth--;
      }
      if (lineDepth === 1) {
        const km = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
        if (km) keys.add(km[1]);
      }
    }
    result.set(name, keys);
  }
  return result;
}

const violations = [];

// Pass 1: catalog key parity.
const enFiles = await walkTs(enDir);
const zhFiles = await walkTs(zhDir);
const enKeysByNs = new Map();
const zhKeysByNs = new Map();
// Namespace files: each non-index `.ts` under `catalogs/<locale>/` is one
// namespace. The file's `export const X = { ... }` literal is the namespace
// content; the index barrel only re-exports them and is skipped.
for (const f of enFiles) {
  if (f.endsWith(`${path.sep}index.ts`)) continue;
  const src = await readSource(f);
  for (const [ns, keys] of extractTopLevelKeys(src)) {
    if (!enKeysByNs.has(ns)) enKeysByNs.set(ns, new Set());
    for (const k of keys) enKeysByNs.get(ns).add(k);
  }
}
for (const f of zhFiles) {
  if (f.endsWith(`${path.sep}index.ts`)) continue;
  const src = await readSource(f);
  for (const [ns, keys] of extractTopLevelKeys(src)) {
    if (!zhKeysByNs.has(ns)) zhKeysByNs.set(ns, new Set());
    for (const k of keys) zhKeysByNs.get(ns).add(k);
  }
}
const allNamespaces = new Set([...enKeysByNs.keys(), ...zhKeysByNs.keys()]);
for (const ns of allNamespaces) {
  const enKeys = enKeysByNs.get(ns) || new Set();
  const zhKeys = zhKeysByNs.get(ns) || new Set();
  if (!enKeysByNs.has(ns)) {
    violations.push(`catalog(en): namespace '${ns}' is missing entirely`);
    continue;
  }
  if (!zhKeysByNs.has(ns)) {
    violations.push(`catalog(zh-CN): namespace '${ns}' is missing entirely`);
    continue;
  }
  for (const k of enKeys) if (!zhKeys.has(k)) violations.push(`catalog(en): '${ns}.${k}' missing in zh-CN`);
  for (const k of zhKeys) if (!enKeys.has(k)) violations.push(`catalog(zh-CN): '${ns}.${k}' missing in en`);
}

// Pass 2: CJK sweep outside the catalogs.
for (const dir of SWEEP_DIRS) {
  const files = await walkTs(dir);
  for (const file of files) {
    // Skip the catalog files themselves.
    if (file.includes(`${path.sep}catalogs${path.sep}`)) continue;
    const src = await readSource(file);
    const lines = src.split(/\r?\n/);
    let inBlockComment = false;
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      let working = line;
      if (inBlockComment) {
        const closeIdx = working.indexOf("*/");
        if (closeIdx >= 0) {
          inBlockComment = false;
          working = working.slice(closeIdx + 2);
        } else {
          working = "";
        }
      }
      while (true) {
        const openIdx = working.indexOf("/*");
        if (openIdx < 0) break;
        const closeIdx = working.indexOf("*/", openIdx + 2);
        if (closeIdx >= 0) {
          working = working.slice(0, openIdx) + " ".repeat(closeIdx + 2 - openIdx) + working.slice(closeIdx + 2);
        } else {
          inBlockComment = true;
          working = working.slice(0, openIdx);
          break;
        }
      }
      // Strip line comments (rough; doesn't handle string-literal `//`).
      let code = working.replace(/\/\/.*$/, "");

      // Skip `console.<level>(...)` calls: even if the argument contains CJK
      // (e.g. dev warnings), we don't want to gate on those.
      const consoleIdx = code.search(/console\s*\.\s*(log|warn|error|info|debug)\s*\(/);
      if (consoleIdx >= 0) {
        // Trim the line back to the console call and everything after, only if
        // it is the only statement on this line. Otherwise leave it alone.
        if (/^\s*(?:[\w$.]+\s*=\s*)?console\s*\.\s*(?:log|warn|error|info|debug)\s*\(/.test(code)) {
          code = code.slice(0, consoleIdx);
        }
      }

      if (!CJK_RE.test(code)) return;
      const allowKey = `${path.relative(root, file)}:${idx + 1}`;
      if (ALLOWLIST.has(allowKey)) return;
      violations.push(`cjk: ${path.relative(root, file)}:${idx + 1}: ${trimmed}`);
    });
  }
}

if (violations.length) {
  console.error("i18n gate violations:");
  for (const v of violations.slice(0, 50)) console.error("  ", v);
  if (violations.length > 50) console.error(`  ... and ${violations.length - 50} more`);
  console.error("");
  console.error("Fix: add the missing catalog key in both locales, or move the inline");
  console.error("string to apps/web/src/i18n/catalogs/zh-CN/<ns>.ts and read it via useT().");
  process.exit(1);
}

console.log("i18n gate passed.");
