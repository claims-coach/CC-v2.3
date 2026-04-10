#!/usr/bin/env node
/**
 * Array Monitor — Unified Health Dashboard
 * Polls all 3 machines and reports aggregate stats
 * Run on mc-prod to gather array-wide metrics
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const MACHINES = [
  { name: "mc-prod", host: "mc-prod.local", role: "Production" },
  { name: "mc-dev", host: "mc-dev.local", role: "Development" },
  { name: "mc-ollama", host: "mc-ollama.local", role: "LLM Inference" },
];

async function checkMachineHealth(host) {
  try {
    // Ping to check reachability
    execSync(`ping -c 1 ${host}`, { stdio: "pipe", timeout: 5000 });
    return { reachable: true, online: true };
  } catch (e) {
    return { reachable: false, online: false, error: e.message };
  }
}

async function checkOllamaStatus() {
  try {
    const res = await fetch("http://mc-ollama.local:11434/api/tags", { timeout: 5000 });
    const data = await res.json();
    return { running: true, models: data.models?.length || 0 };
  } catch (e) {
    return { running: false, error: e.message };
  }
}

async function main() {
  console.log("\n🌐 Claims.Coach Array Monitor\n");
  console.log("═".repeat(60));

  // Check all machines
  console.log("\n📡 Machine Reachability:");
  for (const machine of MACHINES) {
    const health = await checkMachineHealth(machine.host);
    const status = health.online ? "🟢 Online" : "🔴 Offline";
    console.log(`  ${machine.name.padEnd(12)} | ${status.padEnd(15)} | ${machine.role}`);
  }

  // Check Ollama
  console.log("\n🤖 LLM Services:");
  const ollama = await checkOllamaStatus();
  if (ollama.running) {
    console.log(`  mc-ollama  | 🟢 Running | ${ollama.models} models loaded`);
  } else {
    console.log(`  mc-ollama  | 🔴 Offline | ${ollama.error}`);
  }

  // Array Summary
  console.log("\n📊 Array Summary:");
  console.log(`  Total RAM: 72GB (16 + 24 + 32)`);
  console.log(`  Total GPU Cores: 64 (M4 16 + M4 16 + M1 Max 32)`);
  console.log(`  LLM Pool: llama3.3:70b, qwen2.5:14b, llama3.2:3b`);

  console.log("\n═".repeat(60));
  console.log("✅ Array health check complete\n");
}

main().catch(console.error);
