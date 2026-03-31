#!/usr/bin/env node

import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import got from "got";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8766";
const DEFAULT_REQUIRED_ENDPOINTS = ["/health"];

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
  });
  return response.body;
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

  console.log(`[langconfig bootstrap] Backend URL: ${backendUrl}`);
  await checkRequiredApis(backendUrl, endpoints);
  await checkDatabaseHealth(backendUrl);
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
    console.error(`[langconfig bootstrap] Startup connectivity check failed: ${error.message}`);
    process.exit(1);
  });
}
