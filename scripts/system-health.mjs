#!/usr/bin/env node
/**
 * System Health Poller — pushes Mac mini M4 stats to Convex every 30s
 * Stats: CPU, RAM, GPU (via IOAccelerator), Disk, Ollama running models
 * Also collects per-node data from remote machines and pushes as nodesJson
 * No sudo required.
 */
import { execSync } from "child_process";
const CONVEX_URL = process.env.SYSTEM_HEALTH_CONVEX_URL || "https://calm-warbler-536.convex.cloud";

function run(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 5000 }); }
  catch { return ""; }
}

function parseCpu() {
  const out = run("top -l 1 -s 0 -n 0");
  const match = out.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys,\s*([\d.]+)%\s*idle/);
  if (!match) return 0;
  const idle = parseFloat(match[3]);
  return Math.round(100 - idle);
}

function parseMemory() {
  const stat = run("vm_stat");
  const PAGE = 16384; // 16KB pages on Apple Silicon
  const get = (label) => {
    const m = stat.match(new RegExp(label + ":\\s*(\\d+)"));
    return m ? parseInt(m[1]) : 0;
  };
  const active   = get("Pages active");
  const inactive = get("Pages inactive");
  const wired    = get("Pages wired down");
  const spec     = get("Pages speculative");
  const free     = get("Pages free");
  const used     = (active + inactive + wired + spec) * PAGE;
  const total    = (active + inactive + wired + spec + free) * PAGE;
  const hwMem = run("sysctl -n hw.memsize").trim();
  const totalBytes = hwMem ? parseInt(hwMem) : total;
  const usedGb  = Math.round((used / 1e9) * 10) / 10;
  const totalGb = Math.round((totalBytes / 1e9) * 10) / 10;
  return { usedGb, totalGb, pct: Math.round((usedGb / totalGb) * 100) };
}

function parseGpu() {
  const out = run("ioreg -r -d 1 -w 0 -c IOAccelerator");
  const getNum = (key) => {
    const m = out.match(new RegExp(`"${key}"=(\\d+)`));
    return m ? parseInt(m[1]) : 0;
  };
  return {
    device:   getNum("Device Utilization %"),
    renderer: getNum("Renderer Utilization %"),
    tiler:    getNum("Tiler Utilization %"),
  };
}

function parseDisk() {
  const out = run("df -k /");
  const lines = out.trim().split("\n");
  if (lines.length < 2) return { usedGb: 0, totalGb: 0, pct: 0 };
  const parts = lines[1].split(/\s+/);
  const totalKb = parseInt(parts[1]) || 0;
  const usedKb  = parseInt(parts[2]) || 0;
  const totalGb = Math.round((totalKb / 1024 / 1024) * 10) / 10;
  const usedGb  = Math.round((usedKb  / 1024 / 1024) * 10) / 10;
  const pct     = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;
  return { usedGb, totalGb, pct };
}

async function parseOllama() {
  try {
    const res = await fetch("http://mc-ollama.local:11434/api/ps", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { reachable: true, models: [] };
    const d = await res.json();
    return { reachable: true, models: (d.models || []).map(m => m.name || m.model || "unknown") };
  } catch { return { reachable: false, models: [] }; }
}

function checkReachable(host) {
  try {
    execSync(`nc -zw2 ${host} 22`, { timeout: 3000, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

const SSH_OPTS = {
  "mc-dev.local":    "-i ~/.ssh/mc-dev-key    -l cc3",
  "mc-ollama.local": "-i ~/.ssh/mc-ollama-key -l ccm1",
  "10.0.2.3":        "-i ~/.ssh/id_ed25519    -l cc2",
};

function remoteMemory(host) {
  const opts = SSH_OPTS[host] || "";
  try {
    const out = run(`ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no ${opts} ${host} "vm_stat && echo '---' && sysctl -n hw.memsize"`);
    if (!out || !out.includes("Pages active")) return null;
    const PAGE = 16384;
    const get = (label) => {
      const m = out.match(new RegExp(label + ":\\s*(\\d+)"));
      return m ? parseInt(m[1]) : 0;
    };
    const active   = get("Pages active");
    const inactive = get("Pages inactive");
    const wired    = get("Pages wired down");
    const spec     = get("Pages speculative");
    const used     = (active + inactive + wired + spec) * PAGE;
    const hwMatch  = out.match(/---\s*\n(\d+)/);
    const totalBytes = hwMatch ? parseInt(hwMatch[1]) : used;
    const totalGb = Math.round((totalBytes / 1e9) * 10) / 10;
    const usedGb  = Math.round((used / 1e9) * 10) / 10;
    const pct     = Math.round((usedGb / totalGb) * 100);
    return { usedGb, totalGb, pct };
  } catch { return null; }
}

function remoteCpu(host) {
  const opts = SSH_OPTS[host] || "";
  try {
    const out = run(`ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no ${opts} ${host} "top -l 1 -s 0 -n 0"`);
    const match = out.match(/CPU usage:\s*([\d.]+)%\s*user,\s*([\d.]+)%\s*sys,\s*([\d.]+)%\s*idle/);
    if (!match) return 0;
    return Math.round(100 - parseFloat(match[3]));
  } catch { return 0; }
}

function remoteDisk(host) {
  const opts = SSH_OPTS[host] || "";
  try {
    const out = run(`ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no ${opts} ${host} "df -k /"`);
    const lines = out.trim().split("\n");
    if (lines.length < 2) return { usedGb: 0, totalGb: 0, pct: 0 };
    const parts = lines[1].split(/\s+/);
    const totalKb = parseInt(parts[1]) || 0;
    const usedKb  = parseInt(parts[2]) || 0;
    const totalGb = Math.round((totalKb / 1024 / 1024) * 10) / 10;
    const usedGb  = Math.round((usedKb  / 1024 / 1024) * 10) / 10;
    const pct     = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;
    return { usedGb, totalGb, pct };
  } catch { return { usedGb: 0, totalGb: 0, pct: 0 }; }
}

async function remoteMlxModels(host) {
  try {
    const res = await fetch(`http://${host}:8000/v1/manager/models`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.models || []).filter(m => m.status === "loaded").map(m => m.name || m.id || "unknown");
  } catch { return []; }
}

async function collect() {
  const cpu       = parseCpu();
  const mem       = parseMemory();
  const gpu       = parseGpu();
  const disk      = parseDisk();
  const ollama    = await parseOllama();
  const mcDevOnline    = checkReachable("mc-dev.local");
  const mcOllamaOnline = checkReachable("mc-ollama.local");

  // Parallel remote collection
  const [devMem, ollamaMem, cc2Mem,
         devCpu, ollamaCpu, cc2Cpu,
         devDisk, ollamaDisk, cc2Disk,
         devMlx, cc2Mlx, ollamaMlxModels] = await Promise.all([
    Promise.resolve(mcDevOnline    ? remoteMemory("mc-dev.local")    : null),
    Promise.resolve(mcOllamaOnline ? remoteMemory("mc-ollama.local") : null),
    Promise.resolve(remoteMemory("10.0.2.3")),
    Promise.resolve(mcDevOnline    ? remoteCpu("mc-dev.local")    : 0),
    Promise.resolve(mcOllamaOnline ? remoteCpu("mc-ollama.local") : 0),
    Promise.resolve(remoteCpu("10.0.2.3")),
    Promise.resolve(mcDevOnline    ? remoteDisk("mc-dev.local")    : { usedGb: 0, totalGb: 0, pct: 0 }),
    Promise.resolve(mcOllamaOnline ? remoteDisk("mc-ollama.local") : { usedGb: 0, totalGb: 0, pct: 0 }),
    Promise.resolve(remoteDisk("10.0.2.3")),
    remoteMlxModels("10.0.2.2"),   // mc-dev TB IP
    remoteMlxModels("10.0.2.3"),   // cc2 TB IP
    remoteMlxModels("10.0.0.2"),   // mc-ollama TB IP (mlx-gui, may not be running)
  ]);

  const cc2Online = cc2Mem !== null;

  // Build per-node JSON
  const nodesJson = JSON.stringify([
    {
      name: "mc-prod", role: "Gateway", ip: "10.0.0.1",
      hardware: "M4 Mac mini (16GB)", battery: null, online: true,
      cpu, memory: mem.pct, memUsedGb: mem.usedGb, memTotalGb: mem.totalGb,
      gpu: gpu.device, neuralEngine: gpu.renderer,
      disk: disk.pct, diskUsedGb: disk.usedGb, diskTotalGb: disk.totalGb,
      mlxModels: [], ollamaModels: ollama.models,
    },
    {
      name: "mc-ollama", role: "LLM Inference", ip: "10.0.0.2",
      hardware: "M1 Max MacBook Pro (32GB)", battery: 100, online: mcOllamaOnline,
      cpu: ollamaCpu, memory: ollamaMem?.pct || 0, memUsedGb: ollamaMem?.usedGb || 0, memTotalGb: ollamaMem?.totalGb || 32,
      gpu: 0, neuralEngine: 0,
      disk: ollamaDisk.pct, diskUsedGb: ollamaDisk.usedGb, diskTotalGb: ollamaDisk.totalGb,
      mlxModels: ollamaMlxModels, ollamaModels: ollama.models,
    },
    {
      name: "mc-dev", role: "Report Gen", ip: "10.0.2.2",
      hardware: "M4 Pro MacBook Pro (24GB)", battery: 100, online: mcDevOnline,
      cpu: devCpu, memory: devMem?.pct || 0, memUsedGb: devMem?.usedGb || 0, memTotalGb: devMem?.totalGb || 24,
      gpu: 0, neuralEngine: 0,
      disk: devDisk.pct, diskUsedGb: devDisk.usedGb, diskTotalGb: devDisk.totalGb,
      mlxModels: devMlx, ollamaModels: [],
    },
    {
      name: "cc2", role: "Failover", ip: "10.0.2.3",
      hardware: "M1 Mac mini (24GB)", battery: null, online: cc2Online,
      cpu: cc2Cpu, memory: cc2Mem?.pct || 0, memUsedGb: cc2Mem?.usedGb || 0, memTotalGb: cc2Mem?.totalGb || 24,
      gpu: 0, neuralEngine: 0,
      disk: cc2Disk.pct, diskUsedGb: cc2Disk.usedGb, diskTotalGb: cc2Disk.totalGb,
      mlxModels: cc2Mlx, ollamaModels: [],
    },
  ]);

  const stats = {
    ts: Date.now(),
    cpu,
    memUsedGb:   mem.usedGb,
    memTotalGb:  mem.totalGb,
    memPct:      mem.pct,
    gpuDevice:   gpu.device,
    gpuRenderer: gpu.renderer,
    gpuTiler:    gpu.tiler,
    diskUsedGb:  disk.usedGb,
    diskTotalGb: disk.totalGb,
    diskPct:     disk.pct,
    ollamaModels: ollama.models,
    mcDevOnline,
    mcOllamaOnline,
    nodesJson,
  };
  if (devMem)    { stats.memDevUsedGb = devMem.usedGb;     stats.memDevPct = devMem.pct;     stats.memDevTs = Date.now(); }
  if (ollamaMem) { stats.memOllamaUsedGb = ollamaMem.usedGb; stats.memOllamaPct = ollamaMem.pct; stats.memOllamaTs = Date.now(); }
  return stats;
}

async function push(stats) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "systemHealth:upsert",
      args: stats,
      format: "json",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[system-health] Convex push failed: ${txt}`);
  }
}

async function tick() {
  try {
    const stats = await collect();
    await push(stats);
    const nodes = JSON.parse(stats.nodesJson);
    const onlineCount = nodes.filter(n => n.online).length;
    console.log(`[system-health] ${new Date().toLocaleTimeString()} CPU:${stats.cpu}% MEM:${stats.memPct}% GPU:${stats.gpuDevice}% DISK:${stats.diskPct}% Nodes:${onlineCount}/4 Ollama:[${stats.ollamaModels.join(",")||"idle"}]`);
  } catch (e) {
    console.error("[system-health] error:", e.message);
  }
}

console.log("[system-health] Starting — pushing to", CONVEX_URL);
tick();
setInterval(tick, 30_000);
