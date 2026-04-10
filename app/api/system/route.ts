import { execSync } from "child_process";
import { NextResponse } from "next/server";

function run(cmd: string) {
  try { return execSync(cmd, { encoding: "utf8" }).trim(); }
  catch { return ""; }
}

export async function GET() {
  // ── RAM via vm_stat ──────────────────────────────────────────────
  const vmstat  = run("vm_stat");
  const memsize = run("sysctl -n hw.memsize");

  const totalBytes = parseInt(memsize) || 0;
  const totalGB    = totalBytes / (1024 ** 3);

  // page size (16384 on Apple Silicon, 4096 on Intel)
  const pagesizeMatch = vmstat.match(/page size of (\d+) bytes/);
  const pageSize = pagesizeMatch ? parseInt(pagesizeMatch[1]) : 16384;

  const parse = (label: string) => {
    const m = vmstat.match(new RegExp(`${label}:\\s+([\\d]+)`));
    return m ? parseInt(m[1]) : 0;
  };

  const free        = parse("Pages free");
  const active      = parse("Pages active");
  const inactive    = parse("Pages inactive");
  const speculative = parse("Pages speculative");
  const wired       = parse("Pages wired down");
  const compressed  = parse("Pages occupied by compressor");
  const purgeable   = parse("Pages purgeable");

  const usedPages = active + wired + compressed;
  const usedBytes = usedPages * pageSize;
  const freeBytes = (free + speculative + purgeable) * pageSize;
  const usedGB    = usedBytes / (1024 ** 3);
  const freeGB    = freeBytes / (1024 ** 3);
  const usedPct   = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

  // memory pressure
  const pressure = run("memory_pressure 2>/dev/null | head -1");
  let pressureLevel: "normal" | "warning" | "critical" = "normal";
  if (pressure.toLowerCase().includes("critical")) pressureLevel = "critical";
  else if (pressure.toLowerCase().includes("warn")) pressureLevel = "warning";

  // ── CPU via top (one snapshot) ───────────────────────────────────
  const topOut  = run("top -l 1 -n 0 -s 0");
  const cpuLine = topOut.split("\n").find(l => l.startsWith("CPU usage"));
  let cpuUser = 0, cpuSys = 0, cpuIdle = 100;
  if (cpuLine) {
    const u = cpuLine.match(/([\d.]+)% user/);
    const s = cpuLine.match(/([\d.]+)% sys/);
    const i = cpuLine.match(/([\d.]+)% idle/);
    if (u) cpuUser = parseFloat(u[1]);
    if (s) cpuSys  = parseFloat(s[1]);
    if (i) cpuIdle = parseFloat(i[1]);
  }

  // ── Disk via df ──────────────────────────────────────────────────
  const df        = run("df -k /");
  const dfLines   = df.split("\n").filter(l => l.startsWith("/"));
  let diskTotal = 0, diskUsed = 0, diskAvail = 0, diskPct = 0;
  if (dfLines[0]) {
    const parts = dfLines[0].split(/\s+/);
    diskTotal = parseInt(parts[1]) * 1024;
    diskUsed  = parseInt(parts[2]) * 1024;
    diskAvail = parseInt(parts[3]) * 1024;
    diskPct   = Math.round((diskUsed / diskTotal) * 100);
  }

  // ── Uptime ───────────────────────────────────────────────────────
  const uptimeRaw = run("sysctl -n kern.boottime");
  let uptimeStr = "";
  const secMatch = uptimeRaw.match(/sec = (\d+)/);
  if (secMatch) {
    const bootSec = parseInt(secMatch[1]);
    const nowSec  = Math.floor(Date.now() / 1000);
    const diff    = nowSec - bootSec;
    const days    = Math.floor(diff / 86400);
    const hrs     = Math.floor((diff % 86400) / 3600);
    const mins    = Math.floor((diff % 3600) / 60);
    uptimeStr = days > 0 ? `${days}d ${hrs}h ${mins}m` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }

  // ── Chip info ────────────────────────────────────────────────────
  const chip = run("sysctl -n machdep.cpu.brand_string") ||
               run("sysctl -n hw.model");

  return NextResponse.json({
    ram: {
      totalGB: +totalGB.toFixed(1),
      usedGB:  +usedGB.toFixed(1),
      freeGB:  +freeGB.toFixed(1),
      usedPct,
      pressureLevel,
      breakdown: {
        activeGB:     +(active     * pageSize / 1024 ** 3).toFixed(1),
        inactiveGB:   +(inactive   * pageSize / 1024 ** 3).toFixed(1),
        wiredGB:      +(wired      * pageSize / 1024 ** 3).toFixed(1),
        compressedGB: +(compressed * pageSize / 1024 ** 3).toFixed(1),
        freeGB:       +(free       * pageSize / 1024 ** 3).toFixed(1),
      },
    },
    cpu: { user: +cpuUser.toFixed(1), sys: +cpuSys.toFixed(1), idle: +cpuIdle.toFixed(1) },
    disk: {
      totalGB: +(diskTotal / 1024 ** 3).toFixed(0),
      usedGB:  +(diskUsed  / 1024 ** 3).toFixed(0),
      availGB: +(diskAvail / 1024 ** 3).toFixed(0),
      pct:     diskPct,
    },
    uptime: uptimeStr,
    chip,
    ts: Date.now(),
  });
}
