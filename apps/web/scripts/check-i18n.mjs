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

const ALLOWLIST = new Set([
  // token-payload sentinels (e.g. `${prefix}_${zh-sentinel}_${suffix}`)
  // add explicit file:line entries as the codebase grows; do not blanket-allow.
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

const violations = [];

// Pass 1: catalog key parity.
const enFiles = await walkTs(enDir);
const zhFiles = await walkTs(zhDir);
const enKeys = new Set();
const zhKeys = new Set();
for (const f of enFiles) {
  const src = await readSource(f);
  for (const m of src.matchAll(/['"]([a-z][a-zA-Z0-9_.]+)['"]\s*:/g)) {
    enKeys.add(m[1]);
  }
}
for (const f of zhFiles) {
  const src = await readSource(f);
  for (const m of src.matchAll(/['"]([a-z][a-zA-Z0-9_.]+)['"]\s*:/g)) {
    zhKeys.add(m[1]);
  }
}
for (const k of enKeys) if (!zhKeys.has(k)) violations.push(`catalog(en): missing in zh-CN: '${k}'`);
for (const k of zhKeys) if (!enKeys.has(k)) violations.push(`catalog(zh-CN): missing in en: '${k}'`);

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
      // Strip block comments line-by-line (cheap heuristic).
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
          working = working.slice(0, openIdx) + working.slice(closeIdx + 2);
        } else {
          inBlockComment = true;
          working = working.slice(0, openIdx);
          break;
        }
      }
      // Strip line comments (rough; doesn't handle string-literal `//`).
      const code = working.replace(/\/\/.*$/, "");
      if (!CJK_RE.test(code)) return;
      // Exempt `console.*` calls.
      if (/console\.(log|warn|error|info|debug)\s*\(/.test(trimmed)) return;
      const allowKey = `${path.relative(root, file)}:${idx + 1}`;
      if (ALLOWLIST.has(allowKey)) return;
      violations.push(`cjk: ${path.relative(root, file)}:${idx + 1}: ${trimmed}`);
    });
  }
}

if (violations.length) {
  console.error("i18n gate violations:");
  for (const v of violations) console.error("  ", v);
  console.error("");
  console.error("Fix: add the missing catalog key in both locales, or move the inline");
  console.error("string to apps/web/src/i18n/catalogs/zh-CN/<ns>.ts and read it via useT().");
  process.exit(1);
}

console.log("i18n gate passed.");
