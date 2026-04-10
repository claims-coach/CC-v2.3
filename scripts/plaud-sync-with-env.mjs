#!/usr/bin/env node

/**
 * plaud-sync-with-env.mjs — Wrapper that loads .env.local then runs plaud-sync
 * 
 * This handles environment variables safely for cron execution.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");

// Parse .env.local line by line
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found at:", envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const lines = envContent.split("\n");

for (const line of lines) {
  // Skip empty lines and comments
  if (!line.trim() || line.trim().startsWith("#")) continue;

  // Parse KEY=VALUE
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) continue;

  const key = line.substring(0, eqIdx).trim();
  const value = line.substring(eqIdx + 1).trim();

  // Set env var (handles quoted values)
  process.env[key] = value.replace(/^["']|["']$/g, "");
}

// Map NEXT_PUBLIC_* vars to their runtime equivalents
if (process.env.NEXT_PUBLIC_CONVEX_URL && !process.env.CONVEX_URL) {
  process.env.CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
}

if (!process.env.CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in .env.local");
  process.exit(1);
}

// Now run the plaud-sync script
console.log("✅ Environment loaded from .env.local");
console.log("🚀 Starting plaud-sync.mjs...\n");

try {
  // Use execSync to run the script in the current process context
  execSync("node scripts/plaud-sync.mjs", {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  console.error("❌ Plaud sync failed:", err.message);
  process.exit(1);
}
