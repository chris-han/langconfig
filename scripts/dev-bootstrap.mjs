#!/usr/bin/env node

import process from "node:process";
import { spawn, execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import got from "got";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8765";
const DEFAULT_REQUIRED_ENDPOINTS = ["/health"];
const BACKEND_START_TIMEOUT_MS = 30_000;
const BACKEND_POLL_INTERVAL_MS = 500;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(__dirname, "../backend");
const UVICORN_BIN = resolve(BACKEND_DIR, ".venv/bin/uvicorn");

function normalizeUrl(url) {
  return url.replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1").replace(/\/+$/, "");
}

function resolveBackendUrl() {
  return normalizeUrl(process.env.VITE_BACKEND_PROXY_TARGET || process.env.LANGCONFIG_BACKEND_URL || DEFAULT_BACKEND_URL);
}

function resolveRequiredEndpoints() {
  const raw = process.env.LANGCONFIG_BOOTSTRAP_REQUIRED_ENDPOINTS;
  if (!raw) return DEFAULT_REQUIRED_ENDPOINTS;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith("/") ? value : `/${value}`));
}

async function fetchJson(url) {
  const response = await got(url, {
    timeout: { request: 4000 },
    retry: { limit: 0 },
    responseType: "json",
    followRedirect: true,
  });
  return response.body;
}

async function isBackendUp(baseUrl) {
  try {
    await fetchJson(`${baseUrl}/health/`);
    return true;
  } catch {
    return false;
  }
}

async function waitForBackend(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBackendUp(baseUrl)) return true;
    await new Promise((r) => setTimeout(r, BACKEND_POLL_INTERVAL_MS));
  }
  return false;
}

function startBackend(port) {
  if (!existsSync(UVICORN_BIN)) {
    console.warn(`[langconfig bootstrap] Warning: venv not found at ${UVICORN_BIN}`);
    console.warn(`[langconfig bootstrap] Run: cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt`);
    return null;
  }
  console.log(`[langconfig bootstrap] Starting backend (uvicorn on port ${port})...`);
  const child = spawn(UVICORN_BIN, ["main:app", "--port", String(port)], {
    cwd: BACKEND_DIR,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  return child;
}

async function checkRequiredApis(baseUrl, endpoints) {
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      await fetchJson(url);
      console.log(`[langconfig bootstrap] API OK ${url}`);
    } catch (error) {
      throw new Error(`Required API check failed for ${url}: ${error.message}`);
    }
  }
}

async function checkDatabaseHealth(baseUrl) {
  const detailedUrl = `${baseUrl}/health/detailed`;
  let payload;
  try {
    payload = await fetchJson(detailedUrl);
  } catch (error) {
    const fallbackUrl = `${baseUrl}/health`;
    try {
      payload = await fetchJson(fallbackUrl);
    } catch (fallbackError) {
      throw new Error(
        `Detailed health check failed for ${detailedUrl}: ${error.message}; fallback /health also failed: ${fallbackError.message}`,
      );
    }
  }

  const dbStatus = payload?.components?.database?.status || payload?.database?.status;
  const dbMessage =
    payload?.components?.database?.message ||
    payload?.components?.database?.error ||
    payload?.database?.message ||
    payload?.database?.error;

  if (dbStatus !== "healthy") {
    throw new Error(`Database health is ${dbStatus || "unknown"}${dbMessage ? `: ${dbMessage}` : ""}`);
  }

  console.log("[langconfig bootstrap] Database OK");
}

async function runChecks() {
  const backendUrl = resolveBackendUrl();
  const endpoints = resolveRequiredEndpoints();
  const port = new URL(backendUrl).port || "8765";

  console.log(`\n[langconfig bootstrap] ── Startup sequence ──────────────────────────`);
  console.log(`[langconfig bootstrap] Step 1/4  Check backend at ${backendUrl}`);

  const alreadyUp = await isBackendUp(backendUrl);
  if (alreadyUp) {
    console.log(`[langconfig bootstrap]           Backend already running ✓`);
  } else {
    console.log(`[langconfig bootstrap]           Backend not responding — attempting auto-start...`);
    startBackend(port);
    const started = await waitForBackend(backendUrl, BACKEND_START_TIMEOUT_MS);
    if (!started) {
      throw new Error(
        `Backend did not become ready within ${BACKEND_START_TIMEOUT_MS / 1000}s.\n` +
        `  Start it manually: cd backend && .venv/bin/uvicorn main:app --port ${port}`,
      );
    }
    console.log(`[langconfig bootstrap]           Backend started ✓`);
  }

  console.log(`[langconfig bootstrap] Step 2/4  Check required API endpoints`);
  await checkRequiredApis(backendUrl, endpoints);

  console.log(`[langconfig bootstrap] Step 3/4  Check database health`);
  await checkDatabaseHealth(backendUrl);

  console.log(`[langconfig bootstrap] Step 4/4  Free Vite port 19001`);
  freePort(19001);

  console.log(`[langconfig bootstrap] ── All checks passed — launching Vite ────────\n`);
}

function freePort(port) {
  try {
    const pids = execSync(`lsof -ti tcp:${port} 2>/dev/null`, { encoding: "utf8" }).trim();
    if (!pids) return;
    for (const pid of pids.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGTERM");
        console.log(`[langconfig bootstrap] Killed stale process ${pid} on port ${port}`);
      } catch {
        // already gone
      }
    }
  } catch {
    // lsof not available or no match — ignore
  }
}

function runViteDev() {
  const child = spawn("vite", [], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

export async function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes("--check-only");
  await runChecks();
  if (checkOnly) return;
  runViteDev();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n[langconfig bootstrap] ✗ Startup failed: ${error.message}\n`);
    process.exit(1);
  });
}
