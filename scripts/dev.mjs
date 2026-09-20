/**
 * @file dev
 * @description Combined dev launcher for the Grimoire monorepo.
 *
 * Responsibilities:
 * - Pre-check ports 8180 (web) and 8181 (api) and refuse to start if either is in use
 * - Spawn `@grimoire/api` (dev) and `@grimoire/web` (dev) with env forwarding
 * - Install SIGINT / SIGTERM handlers with a graceful shutdown (3 s force-kill fallback)
 * - Tear down the partner process if either child exits non-zero
 *
 * Usage:
 *   pnpm dev                              # 8180 + 8181
 *   VITE_PORT=5555 pnpm dev               # 5555 + 8181
 *   PORT=3333 pnpm dev                    # 8180 + 3333 (front-end proxy follows)
 *   VITE_PORT=5555 PORT=3333 pnpm dev     # 5555 + 3333
 *
 * On Windows (CMD / PowerShell), use the equivalent syntax:
 *   $env:VITE_PORT=5555; $env:PORT=3333; pnpm dev
 */

import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const WEB_PORT = Number(process.env.VITE_PORT) || 8180;
const API_PORT = Number(process.env.PORT) || 8181;
const WEB_API_PORT = Number(process.env.VITE_API_PORT) || API_PORT;

function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    let server;
    const done = (inUse) => {
      if (server) {
        try {
          server.close();
        } catch {
          /* ignore */
        }
      }
      resolve(inUse);
    };
    try {
      server = net.createServer();
      server.once("listening", () => done(false));
      server.once("error", (err) => done(err.code === "EADDRINUSE"));
      server.listen(port, host);
    } catch (err) {
      done(err.code === "EADDRINUSE");
    }
  });
}

async function checkPorts() {
  const webBusy = await isPortInUse(WEB_PORT);
  const apiBusy = await isPortInUse(API_PORT);
  if (!webBusy && !apiBusy) return;

  console.error("");
  if (webBusy) console.error(`[dev] ✖ web port ${WEB_PORT} is already in use.`);
  if (apiBusy) console.error(`[dev] ✖ api port ${API_PORT} is already in use.`);
  console.error("");
  console.error("Start on different ports instead:");
  if (webBusy && apiBusy) {
    console.error(`  VITE_PORT=${WEB_PORT + 1} PORT=${API_PORT + 1} pnpm dev`);
  } else if (webBusy) {
    console.error(`  VITE_PORT=${WEB_PORT + 1} pnpm dev`);
  } else {
    console.error(`  PORT=${API_PORT + 1} pnpm dev`);
  }
  console.error("Or free the port and retry.");
  console.error("");
  process.exit(1);
}

async function main() {
  await checkPorts();

  console.log(`[dev] starting api (PORT=${API_PORT}) and web (VITE_PORT=${WEB_PORT})`);
  if (process.env.VITE_API_PORT) {
    console.log(`[dev] web /api proxy is pinned to VITE_API_PORT=${WEB_API_PORT}`);
  } else {
    console.log(`[dev] web /api proxy follows PORT=${WEB_API_PORT}`);
  }

  const env = { ...process.env };
  env.PORT = String(API_PORT);
  env.VITE_PORT = String(WEB_PORT);
  env.VITE_API_PORT = String(WEB_API_PORT);

  // shell: true avoids an EINVAL on Windows when spawning npm via Node ≥ 18;
  // args are still passed as an array and properly quoted by the shell.
  const apiProc = spawn("npm", ["run", "dev:api"], {
    stdio: "inherit",
    shell: true,
    env,
  });
  const webProc = spawn("npm", ["run", "dev:web"], {
    stdio: "inherit",
    shell: true,
    env,
  });

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[dev] received ${signal}, stopping services...`);

    const kill = (proc) =>
      new Promise((resolve) => {
        if (!proc || proc.exitCode !== null) {
          resolve();
          return;
        }
        proc.once("exit", () => resolve());
        // On Windows, npm spawns a child shell and SIGTERM may not propagate;
        // send SIGTERM first, escalate to SIGKILL after 3 s.
        proc.kill(signal);
        setTimeout(() => {
          if (proc.exitCode === null) proc.kill("SIGKILL");
        }, 3000);
      });

    Promise.all([kill(apiProc), kill(webProc)]).then(() => {
      console.log("[dev] services stopped");
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  [apiProc, webProc].forEach((proc, idx) => {
    const name = idx === 0 ? "api" : "web";
    proc.on("exit", (code) => {
      if (!shuttingDown && code !== 0 && code !== null) {
        console.log(`[dev] ${name} exited unexpectedly (code=${code}); stopping the other service`);
        shutdown("SIGTERM");
      }
    });
  });
}

main().catch((err) => {
  console.error("[dev] failed to start:", err);
  process.exit(1);
});
