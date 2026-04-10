"use client";

import { useState, useEffect } from "react";

interface SystemStatus {
  gateway: "up" | "down" | "degraded";
  memory_percent: number;
  disk_percent: number;
  load_average: number;
  uptime_days: number;
  uptime_hours: number;
  uptime_minutes: number;
}

interface MachineStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  memory_used_gb: number;
  memory_total_gb: number;
  ram_percent: number;
  cpu_temp: number;
  queue_size: number;
  model: string;
  latency_ms: number;
}

interface IntegrationStatus {
  name: string;
  status: "active" | "inactive" | "error";
  last_sync?: string;
  error?: string;
}

interface CronJobStatus {
  name: string;
  status: "ok" | "error" | "pending";
  last_run?: string;
  next_run?: string;
  duration_ms?: number;
  error_count: number;
}

export default function OperationsDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [machines, setMachines] = useState<MachineStatus[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobStatus[]>([]);
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    // Load mock data
    const mockSystem: SystemStatus = {
      gateway: "up",
      memory_percent: 59,
      disk_percent: 42,
      load_average: 1.27,
      uptime_days: 5,
      uptime_hours: 8,
      uptime_minutes: 23,
    };

    const mockMachines: MachineStatus[] = [
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
    ];

    const mockIntegrations: IntegrationStatus[] = [
      { name: "Convex DB", status: "active", last_sync: "2m ago" },
      { name: "GHL CRM", status: "active", last_sync: "15m ago" },
      { name: "Plaud Voice", status: "active", last_sync: "30m ago" },
      { name: "Telegram Bot", status: "active", last_sync: "1m ago" },
      { name: "Google Ads", status: "active", last_sync: "1h ago" },
      { name: "Facebook Ads", status: "active", last_sync: "1h ago" },
      { name: "Vercel Deploy", status: "active", last_sync: "3h ago" },
      { name: "GitHub Sync", status: "active", last_sync: "5m ago" },
    ];

    const mockCronJobs: CronJobStatus[] = [
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
    ];

    setSystemStatus(mockSystem);
    setMachines(mockMachines);
    setIntegrations(mockIntegrations);
    setCronJobs(mockCronJobs);
    setTimestamp(new Date().toLocaleTimeString());
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "up":
      case "online":
      case "ok":
      case "active":
        return "bg-green-50 border-green-200";
      case "down":
      case "offline":
      case "error":
      case "inactive":
        return "bg-red-50 border-red-200";
      case "degraded":
      case "pending":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const getStatusDot = (status: string): string => {
    switch (status) {
      case "up":
      case "online":
      case "ok":
      case "active":
        return "🟢";
      case "down":
      case "offline":
      case "error":
      case "inactive":
        return "🔴";
      case "degraded":
      case "pending":
        return "🟡";
      default:
        return "⚪";
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-mono text-xs">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            MISSION CONTROL
          </h1>
          <p className="text-slate-600">CLAIMS.COACH · EVERETT WA</p>
        </div>
        <div className="text-right">
          <div className="flex gap-2 mb-2">
            {systemStatus?.gateway === "up" ? (
              <span className="px-3 py-1 bg-green-100 text-green-900 rounded font-semibold text-xs">
                ● LIVE
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-900 rounded font-semibold text-xs">
                ● GATEWAY DOWN
              </span>
            )}
          </div>
          <p className="text-slate-600">{timestamp}</p>
        </div>
      </div>

      {/* System Overview */}
      {systemStatus && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded border border-slate-200">
            <h3 className="text-slate-600 font-semibold mb-2 uppercase text-xs tracking-wider">
              Memory
            </h3>
            <p className="text-4xl font-bold text-slate-900 mb-1">
              {systemStatus.memory_percent}%
            </p>
            <p className="text-slate-500 text-xs">
              {Math.round((systemStatus.memory_percent * 256) / 100)}GB / 256GB
              used
            </p>
          </div>

          <div className="bg-white p-6 rounded border border-slate-200">
            <h3 className="text-slate-600 font-semibold mb-2 uppercase text-xs tracking-wider">
              Disk
            </h3>
            <p className="text-4xl font-bold text-slate-900 mb-1">
              {systemStatus.disk_percent}%
            </p>
            <p className="text-slate-500 text-xs">
              {Math.round((systemStatus.disk_percent * 8000) / 100)}GB / 8000GB
              used
            </p>
          </div>

          <div className="bg-white p-6 rounded border border-slate-200">
            <h3 className="text-slate-600 font-semibold mb-2 uppercase text-xs tracking-wider">
              System Load
            </h3>
            <p className="text-4xl font-bold text-slate-900 mb-1">
              {systemStatus.load_average.toFixed(2)}
            </p>
            <p className="text-slate-500 text-xs">
              Uptime: {systemStatus.uptime_days}d{" "}
              {systemStatus.uptime_hours}h
            </p>
          </div>

          <div className="bg-white p-6 rounded border border-slate-200">
            <h3 className="text-slate-600 font-semibold mb-2 uppercase text-xs tracking-wider">
              Integrations
            </h3>
            <p className="text-4xl font-bold text-slate-900 mb-1">
              {integrations.filter((i) => i.status === "active").length}/
              {integrations.length}
            </p>
            <p className="text-slate-500 text-xs">
              Active services
            </p>
          </div>
        </div>
      )}

      {/* Machine Cluster Status */}
      <div className="bg-white rounded border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
          Cluster Machines (TB5 Connected)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {machines.map((machine) => (
            <div
              key={machine.name}
              className={`p-4 rounded border-2 ${getStatusColor(machine.status)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold">{machine.name}</h3>
                <span className="text-lg">{getStatusDot(machine.status)}</span>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-semibold">Model:</span> {machine.model}
                </p>
                <p>
                  <span className="font-semibold">RAM:</span>{" "}
                  {machine.ram_percent}% ({machine.memory_used_gb}/
                  {machine.memory_total_gb}GB)
                </p>
                <p>
                  <span className="font-semibold">CPU Temp:</span>{" "}
                  {machine.cpu_temp}°C
                </p>
                <p>
                  <span className="font-semibold">Queue:</span>{" "}
                  {machine.queue_size} tasks
                </p>
                <p>
                  <span className="font-semibold">Latency:</span>{" "}
                  {machine.latency_ms}ms
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inference Engine Details */}
      <div className="bg-white rounded border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
          Inference Engine - QWEN3:30B-A3B · MC-OLLAMA
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h3 className="text-slate-600 font-semibold mb-3 uppercase text-xs">
              Model
            </h3>
            <div className="space-y-2">
              <p className="font-semibold">🟢 Qwen3:30b-a3b Q4_K_M</p>
              <div className="text-xs text-slate-600 space-y-1">
                <p>Status: <span className="font-semibold">ok</span></p>
                <p>KV Cache: Quantized (40% reduction)</p>
                <p>Context: 32K tokens</p>
                <p>Slots: 2 parallel · 4 threads</p>
                <p>Flash Att: on</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-slate-600 font-semibold mb-3 uppercase text-xs">
              Throughput
            </h3>
            <div className="space-y-2">
              <p className="text-3xl font-bold">3</p>
              <p className="text-xs text-slate-600">t/s prompt</p>
              <p className="text-2xl font-bold mt-2">5</p>
              <p className="text-xs text-slate-600">t/s generate</p>
            </div>
          </div>

          <div>
            <h3 className="text-slate-600 font-semibold mb-3 uppercase text-xs">
              Distributed Nodes
            </h3>
            <div className="space-y-2">
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="font-semibold">🟢 ollama-master</p>
                <p className="text-xs text-slate-600">Endpoint: 10.0.0.x:11434</p>
                <p className="text-xs text-slate-600">Model alloc: 21.9GB</p>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="font-semibold">🟢 ollama-worker</p>
                <p className="text-xs text-slate-600">Endpoint: 192.168.1.x</p>
                <p className="text-xs text-slate-600">Model alloc: 7.5GB</p>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Total: 24.5GB across 2 nodes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cron Jobs */}
      <div className="bg-white rounded border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
          Scheduled Jobs ({cronJobs.filter((j) => j.status === "ok").length}/{cronJobs.length} OK)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="text-left p-2 font-semibold">Job</th>
                <th className="text-left p-2 font-semibold">Status</th>
                <th className="text-left p-2 font-semibold">Last Run</th>
                <th className="text-left p-2 font-semibold">Duration</th>
                <th className="text-left p-2 font-semibold">Next Run</th>
                <th className="text-left p-2 font-semibold">Errors</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.map((job) => (
                <tr key={job.name} className="border-b border-slate-100">
                  <td className="p-2 font-semibold">{job.name}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        job.status === "ok"
                          ? "bg-green-100 text-green-900"
                          : job.status === "error"
                          ? "bg-red-100 text-red-900"
                          : "bg-yellow-100 text-yellow-900"
                      }`}
                    >
                      {getStatusDot(job.status)} {job.status}
                    </span>
                  </td>
                  <td className="p-2 text-slate-600">{job.last_run}</td>
                  <td className="p-2 text-slate-600">{job.duration_ms}ms</td>
                  <td className="p-2 text-slate-600">{job.next_run}</td>
                  <td className="p-2 text-slate-600">{job.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-white rounded border border-slate-200 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
          Services & Integrations ({integrations.filter((i) => i.status === "active").length}/{integrations.length} Active)
        </h2>

        <div className="space-y-4">
          {/* Infrastructure */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Infrastructure
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { name: "OpenClaw Gateway", status: "active" as const, latency: "182ms" },
                { name: "TB5 Relay", status: "active" as const, latency: "14ms" },
                { name: "Convex DB", status: "active" as const, latency: "342ms" },
                { name: "Vercel CDN", status: "active" as const, latency: "45ms" },
                { name: "Cloudflare", status: "active" as const, latency: "23ms" },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className={`p-3 rounded border ${getStatusColor(svc.status)}`}
                >
                  <p className="font-semibold text-xs">{getStatusDot(svc.status)} {svc.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{svc.latency}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI & ML */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              AI & ML
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { name: "Anthropic", status: "active" as const },
                { name: "xAI / Grok", status: "active" as const },
                { name: "Ollama Local", status: "active" as const },
                { name: "MLX Framework", status: "active" as const },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className={`p-3 rounded border ${getStatusColor(svc.status)}`}
                >
                  <p className="font-semibold text-xs">{getStatusDot(svc.status)} {svc.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Marketing & CRM */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Marketing & CRM
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { name: "GHL", status: "active" as const },
                { name: "Plaud", status: "active" as const },
                { name: "Telegram Bot", status: "active" as const },
                { name: "Google Ads", status: "active" as const },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className={`p-3 rounded border ${getStatusColor(svc.status)}`}
                >
                  <p className="font-semibold text-xs">{getStatusDot(svc.status)} {svc.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
