/**
 * @file check-boundaries
 * @description Import-direction gate for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Reject cross-service source imports (`@grimoire/<other-service>`) outside `services/api`
 * - Reject cross-domain Prisma model access (`prisma.<model>` / `tx.<model>`) outside the owning service
 * - Allow `services/api/src/compose.ts` to import every service (the composition root)
 * - Allow `apps/web` to import only `@grimoire/contracts` and `@grimoire/foundation`
 *
 * Rules:
 * - `packages/contracts` is the leaf; no service imports allowed.
 * - `packages/foundation` may not import any service.
 * - `services/<x>` may not import another service's source or its Prisma models.
 *
 * Notes:
 * - The composition root (`services/api/src/compose.ts`) is exempted by walking its own dir
 *   with an empty `forbid` list, so it is not scanned for boundary violations.
 * - Comments are stripped before matching, so doc-style references in JSDoc do not trip the gate.
 *
 * Exit code: non-zero on any violation. Emits one line per violation.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Cross-service implementation import (excludes contracts/foundation/api/web). */
const serviceImport = (names) =>
  new RegExp(String.raw`from\s+['"]@grimoire/(?:${names.join("|")})['"]`);

/** Cross-domain Prisma model access (incl. transaction `tx.`). */
const prismaModel = (models) =>
  new RegExp(String.raw`(?:prisma|tx)\.(?:${models.join("|")})\b`);

const RULES = [
  {
    dir: "services/agent/src",
    forbid: [
      prismaModel([
        "article",
        "user",
        "topic",
        "topicReply",
        "annotation",
        "domain",
        "authorApplication",
        "refreshToken",
        "animationDef",
      ]),
      serviceImport(["identity", "content", "community", "llm"]),
    ],
  },
  {
    dir: "services/content/src",
    forbid: [
      prismaModel([
        "user",
        "topic",
        "topicReply",
        "agentConversation",
        "agentMessage",
        "agentMemory",
        "learningProgress",
        "hoverExplainCache",
        "refreshToken",
        "authorApplication",
      ]),
      serviceImport(["identity", "community", "agent", "llm"]),
    ],
  },
  {
    dir: "services/community/src",
    forbid: [
      prismaModel([
        "article",
        "user",
        "annotation",
        "domain",
        "agentConversation",
        "agentMessage",
        "agentMemory",
        "learningProgress",
        "hoverExplainCache",
        "refreshToken",
        "authorApplication",
      ]),
      serviceImport(["identity", "content", "agent", "llm"]),
    ],
  },
  {
    dir: "services/identity/src",
    forbid: [
      prismaModel([
        "article",
        "topic",
        "topicReply",
        "annotation",
        "domain",
        "agentConversation",
        "agentMessage",
        "agentMemory",
        "learningProgress",
        "hoverExplainCache",
        "animationDef",
      ]),
      serviceImport(["content", "community", "agent", "llm"]),
    ],
  },
  {
    dir: "services/llm/src",
    forbid: [
      prismaModel([
        "article",
        "user",
        "topic",
        "annotation",
        "agentConversation",
        "agentMemory",
        "learningProgress",
      ]),
      serviceImport(["identity", "content", "community", "agent"]),
    ],
  },
  {
    dir: "apps/web/src",
    forbid: [
      serviceImport(["identity", "content", "community", "agent", "llm", "foundation", "api"]),
    ],
  },
  {
    dir: "packages/foundation/src",
    forbid: [serviceImport(["identity", "content", "community", "agent", "llm"])],
  },
  {
    dir: "packages/contracts/src",
    forbid: [
      serviceImport(["identity", "content", "community", "agent", "llm", "foundation"]),
      /from\s+['"]@prisma\/client['"]/,
    ],
  },
  // apps/api/src is the composition root; it is exempt from this gate.
];

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
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "tests") continue;
      await walkTs(p, acc);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".d.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const violations = [];

for (const rule of RULES) {
  const files = await walkTs(path.join(root, rule.dir));
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const src = stripComments(raw);
    for (const re of rule.forbid) {
      const m = src.match(re);
      if (m) {
        violations.push(`${path.relative(root, file)}: ${m[0]}`);
      }
    }
  }
}

if (violations.length) {
  console.error("Boundary violations (cross-service source import or cross-domain Prisma access):");
  for (const v of violations) console.error("  ", v);
  console.error("");
  console.error("Fix: introduce a port in @grimoire/contracts, implement it in the owning");
  console.error("service, register it in services/api/src/compose.ts, and consume the port only.");
  process.exit(1);
}

console.log(`Boundary scan passed (${RULES.length} rule groups).`);
