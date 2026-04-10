import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { safeClone, safeStringify } from "@/lib/json-validator";

export const runtime = "nodejs";

interface HealthData {
  system: {
    gateway: "up" | "down" | "degraded";
    memory_percent: number;
    disk_percent: number;
    load_average: number;
    uptime_days: number;
    uptime_hours: number;
    uptime_minutes: number;
  };
  machines: Array<{
    name: string;
    status: "online" | "offline" | "degraded";
    memory_used_gb: number;
    memory_total_gb: number;
    ram_percent: number;
    cpu_temp: number;
    queue_size: number;
    model: string;
    latency_ms: number;
  }>;
  integrations: Array<{
    name: string;
    status: "active" | "inactive" | "error";
    last_sync?: string;
    error?: string;
  }>;
  cron_jobs: Array<{
    name: string;
    status: "ok" | "error" | "pending";
    last_run?: string;
    next_run?: string;
    duration_ms?: number;
    error_count: number;
  }>;
}

function getSystemMemory(): { used: number; total: number; percent: number } {
  try {
    const output = execSync("vm_stat | grep 'Pages free'").toString();
    const freePages = parseInt(output.match(/\d+/)?.[0] || "0");
    const usedPercent = Math.round((1 - freePages / 2000000) * 100);
    return {
      used: Math.round((usedPercent * 256) / 100),
      total: 256,
      percent: usedPercent,
    };
  } catch {
    return { used: 0, total: 256, percent: 0 };
  }
}

function getSystemDisk(): { used: number; total: number; percent: number } {
  try {
    const output = execSync("df -h / | tail -1").toString();
    const parts = output.split(/\s+/);
    const total = parseInt(parts[1]) || 1000;
    const used = parseInt(parts[2]) || 0;
    const percent = parseInt(parts[4]) || 0;
    return { used, total, percent };
  } catch {
    return { used: 0, total: 1000, percent: 0 };
  }
}

function getLoadAverage(): number {
  try {
    const output = execSync("uptime").toString();
    const match = output.match(/load average: ([\d.]+)/);
    return parseFloat(match?.[1] || "0");
  } catch {
    return 0;
  }
}

function getUptime(): {
  days: number;
  hours: number;
  minutes: number;
} {
  try {
    const output = execSync("uptime").toString();
    const match = output.match(/up\s+(\d+)\s+days?,\s+(\d+):(\d+)/);
    if (match) {
      return {
        days: parseInt(match[1]),
        hours: parseInt(match[2]),
        minutes: parseInt(match[3]),
      };
    }
    return { days: 0, hours: 0, minutes: 0 };
  } catch {
    return { days: 0, hours: 0, minutes: 0 };
  }
}

export async function GET() {
  try {
    const memory = getSystemMemory();
    const disk = getSystemDisk();
    const load = getLoadAverage();
    const uptime = getUptime();

    const data: HealthData = {
      system: {
        gateway: "up",
        memory_percent: memory.percent,
        disk_percent: disk.percent,
        load_average: load,
        uptime_days: uptime.days,
        uptime_hours: uptime.hours,
        uptime_minutes: uptime.minutes,
      },

      machines: [
        {
          name: "mc-prod",
          status: "online",
          memory_used_gb: 8.4,
          memory_total_gb: 16,
          ram_percent: 59,
          cpu_temp: 54,
          queue_size: 0,
          model: "qwen3-4b-4bit (MLX)",
          latency_ms: 3,
        },
        {
          name: "mc-ollama",
          status: "online",
          memory_used_gb: 10.4,
          memory_total_gb: 32,
          ram_percent: 35,
          cpu_temp: 61,
          queue_size: 0,
          model: "qwen3:30b-a3b (Ollama)",
          latency_ms: 20,
        },
        {
          name: "mc-dev",
          status: "online",
          memory_used_gb: 7.3,
          memory_total_gb: 24,
          ram_percent: 37,
          cpu_temp: 48,
          queue_size: 0,
          model: "qwen2.5-coder-14b (MLX)",
          latency_ms: 10,
        },
        {
          name: "cc2",
          status: "online",
          memory_used_gb: 5.7,
          memory_total_gb: 24,
          ram_percent: 37,
          cpu_temp: 45,
          queue_size: 0,
          model: "qwen3-14b-4bit (MLX)",
          latency_ms: 5,
        },
      ],

      integrations: [
        { name: "Convex DB", status: "active", last_sync: "2m ago" },
        { name: "GHL CRM", status: "active", last_sync: "15m ago" },
        { name: "Plaud Voice", status: "active", last_sync: "30m ago" },
        { name: "Telegram Bot", status: "active", last_sync: "1m ago" },
        { name: "Google Ads", status: "active", last_sync: "1h ago" },
        { name: "Facebook Ads", status: "active", last_sync: "1h ago" },
        { name: "Vercel Deploy", status: "active", last_sync: "3h ago" },
        { name: "GitHub Sync", status: "active", last_sync: "5m ago" },
      ],

      cron_jobs: [
        {
          name: "morning-brief",
          status: "ok",
          last_run: "7h ago",
          next_run: "07:00",
          duration_ms: 3500,
          error_count: 0,
        },
        {
          name: "research-agent",
          status: "ok",
          last_run: "6h ago",
          next_run: "06:00",
          duration_ms: 1800,
          error_count: 0,
        },
        {
          name: "ghl-sync",
          status: "ok",
          last_run: "15m ago",
          next_run: "16:40",
          duration_ms: 2300,
          error_count: 0,
        },
        {
          name: "plaud-sync",
          status: "ok",
          last_run: "30m ago",
          next_run: "16:30",
          duration_ms: 1200,
          error_count: 0,
        },
        {
          name: "autoresearch-claims",
          status: "ok",
          last_run: "23h ago",
          next_run: "23:00",
          duration_ms: 7200,
          error_count: 0,
        },
      ],
    };

    // Safe serialization and response
    const safeData = safeClone(data) as HealthData;
    return NextResponse.json(safeData, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Health check error:", e);
    return NextResponse.json(
      {
        error: "Health check failed",
        message: (e as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
