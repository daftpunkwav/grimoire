/**
 * @file smoke
 * @description Post-deploy smoke probe for the Grimoire API.
 *
 * Responsibilities:
 * - Probe the running server's `/health`, `/ready`, and a small set of
 *   public endpoints that exercise the request pipeline end-to-end
 * - Apply a bounded timeout (default 30 s) for the entire run
 * - Exit non-zero on any probe failure or unreachable host
 *
 * Notes:
 * - Read-only: never writes to the database, never invokes the LLM
 *   gateway, never consumes a quota
 * - Intended for CI `smoke` jobs and on-call verification; never
 *   used for synthetic load
 *
 * Exit code: non-zero on any probe failure.
 */

const HOST = process.env.SMOKE_HOST || "127.0.0.1";
const PORT = Number(process.env.SMOKE_PORT || process.env.PORT || 8181);
const BASE = `http://${HOST}:${PORT}`;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);

const PROBES = [
  { name: "health", method: "GET", path: "/health", expectStatus: 200 },
  { name: "ready", method: "GET", path: "/ready", expectStatus: 200 },
  { name: "auth-login (validation)", method: "POST", path: "/api/v1/auth/login", body: {}, expectStatus: 400 },
];

async function fetchWithTimeout(url, init, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probe({ name, method, path, body, expectStatus }) {
  const url = `${BASE}${path}`;
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  try {
    const res = await fetchWithTimeout(url, init, 5_000);
    if (res.status !== expectStatus) {
      const text = await res.text();
      throw new Error(`${name}: expected ${expectStatus} got ${res.status} — ${text.slice(0, 200)}`);
    }
    console.log(`  ✓ ${name.padEnd(28)} ${method} ${path} -> ${res.status}`);
  } catch (err) {
    throw new Error(`${name}: ${err.message}`);
  }
}

const overall = AbortSignal.timeout(TIMEOUT_MS);
console.log(`[smoke] probing ${BASE} (timeout ${TIMEOUT_MS} ms)`);
let failed = 0;
for (const p of PROBES) {
  if (overall.aborted) {
    console.error(`[smoke] aborted before ${p.name}`);
    failed++;
    break;
  }
  try {
    await probe(p);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    failed++;
  }
}
if (failed) {
  console.error(`[smoke] ${failed} probe(s) failed`);
  process.exit(1);
}
console.log(`[smoke] all probes passed`);
