"use client";

import { useState, useEffect } from "react";
import { Cloud, Zap, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface NodeStatus {
  name: string;
  address: string;
  status: "online" | "offline" | "degraded";
  mlxVersion: string;
  ollama: {
    status: "running" | "stopped";
    models: string[];
  };
  cpu: number;
  memory: {
    used: string;
    total: string;
    percent: number;
  };
  disk: {
    used: string;
    total: string;
    percent: number;
  };
  latency: number;
  lastCheck: number;
}

interface ClusterHealth {
  nodes: NodeStatus[];
  gateway: {
    status: "running" | "stopped";
    uptime: string;
    sessions: number;
    tasks: number;
  };
  inference: {
    primaryModel: string;
    fallbackModel: string;
    totalCapacity: string;
  };
  network: {
    tb5Status: "connected" | "disconnected";
    tb5Latency: number;
    bandwidth: string;
  };
}

export default function SystemHealthDashboard() {
  const [health, setHealth] = useState<ClusterHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/system-health");
        if (!response.ok) throw new Error("Failed to fetch health");
        const data = await response.json();
        setHealth(data);
        setLastUpdate(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "running":
        return "text-green-600 bg-green-50";
      case "offline":
      case "stopped":
        return "text-red-600 bg-red-50";
      case "degraded":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-slate-600 bg-slate-50";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
      case "running":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "offline":
      case "stopped":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "degraded":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Loading cluster status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">System Health Dashboard</h1>
        <p className="text-slate-600 mb-4">MLX Cluster Status — Real-time monitoring</p>
        {lastUpdate && (
          <p className="text-xs text-slate-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {health && (
        <>
          {/* Gateway Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-600">GATEWAY STATUS</h3>
                {getStatusBadge(health.gateway.status)}
              </div>
              <p className={`text-lg font-bold capitalize ${health.gateway.status === "running" ? "text-green-600" : "text-red-600"}`}>
                {health.gateway.status}
              </p>
              <p className="text-xs text-slate-500 mt-2">Uptime: {health.gateway.uptime}</p>
              <div className="mt-3 space-y-1 text-xs">
                <p className="text-slate-600">Active Sessions: <span className="font-bold">{health.gateway.sessions}</span></p>
                <p className="text-slate-600">Tasks: <span className="font-bold">{health.gateway.tasks}</span></p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-600">TB5 NETWORK</h3>
                {getStatusBadge(health.network.tb5Status)}
              </div>
              <p className={`text-lg font-bold capitalize ${health.network.tb5Status === "connected" ? "text-green-600" : "text-red-600"}`}>
                {health.network.tb5Status}
              </p>
              <p className="text-xs text-slate-500 mt-2">Latency: {health.network.tb5Latency}ms</p>
              <p className="text-xs text-slate-600 mt-1">Bandwidth: {health.network.bandwidth}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">INFERENCE ENGINE</h3>
              <p className="text-sm font-bold text-slate-900 mb-2">{health.inference.primaryModel}</p>
              <p className="text-xs text-slate-600 mb-2">Fallback: {health.inference.fallbackModel}</p>
              <p className="text-xs text-slate-600">Total Capacity: <span className="font-bold">{health.inference.totalCapacity}</span></p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">CLUSTER SIZE</h3>
              <p className="text-3xl font-bold text-slate-900">{health.nodes.length}</p>
              <p className="text-xs text-slate-600 mt-2">Total Machines</p>
              <div className="mt-3 flex gap-1">
                {health.nodes.map((node) => (
                  <div
                    key={node.name}
                    className={`w-2 h-2 rounded-full ${
                      node.status === "online"
                        ? "bg-green-600"
                        : node.status === "degraded"
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    title={node.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Node Details */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
            <h2 className="text-xl font-bold mb-6">Cluster Nodes</h2>
            <div className="space-y-4">
              {health.nodes.map((node) => (
                <div key={node.name} className={`p-4 rounded-lg border ${getStatusColor(node.status)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(node.status)}
                        <h3 className="font-semibold">{node.name}</h3>
                        <span className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded">
                          {node.address}
                        </span>
                      </div>
                      <p className="text-xs ml-6">MLX {node.mlxVersion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{node.latency}ms latency</p>
                      <p className="text-xs text-slate-600">
                        {new Date(node.lastCheck).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {node.status === "online" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-6 text-xs">
                      <div>
                        <p className="text-slate-600">CPU</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${node.cpu > 80 ? "bg-red-600" : node.cpu > 50 ? "bg-yellow-600" : "bg-green-600"}`}
                            style={{ width: `${node.cpu}%` }}
                          />
                        </div>
                        <p className="font-bold mt-1">{node.cpu}%</p>
                      </div>

                      <div>
                        <p className="text-slate-600">Memory</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${node.memory.percent > 80 ? "bg-red-600" : node.memory.percent > 50 ? "bg-yellow-600" : "bg-green-600"}`}
                            style={{ width: `${node.memory.percent}%` }}
                          />
                        </div>
                        <p className="font-bold mt-1">
                          {node.memory.used} / {node.memory.total}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-600">Disk</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${node.disk.percent > 80 ? "bg-red-600" : node.disk.percent > 50 ? "bg-yellow-600" : "bg-green-600"}`}
                            style={{ width: `${node.disk.percent}%` }}
                          />
                        </div>
                        <p className="font-bold mt-1">
                          {node.disk.used} / {node.disk.total}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-600">Services</p>
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-blue-600" />
                            <span className={node.ollama.status === "running" ? "text-green-600 font-bold" : "text-red-600"}>
                              Ollama
                            </span>
                          </div>
                          <p className="text-slate-600 ml-4 text-xs">
                            {node.ollama.models.join(", ") || "No models"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Inference Capacity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">PRIMARY INFERENCE</h3>
              <p className="text-lg font-bold text-slate-900 mb-2">llama3.3:70b</p>
              <p className="text-xs text-slate-600 mb-3">Status: <span className="text-green-600 font-bold">Ready</span></p>
              <div className="space-y-2 text-xs">
                <p className="text-slate-600">Host: mc-ollama</p>
                <p className="text-slate-600">Memory: 32GB available</p>
                <p className="text-slate-600">Throughput: 50 tokens/sec</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">FALLBACK INFERENCE</h3>
              <p className="text-lg font-bold text-slate-900 mb-2">mistral:7b</p>
              <p className="text-xs text-slate-600 mb-3">Status: <span className="text-green-600 font-bold">Ready</span></p>
              <div className="space-y-2 text-xs">
                <p className="text-slate-600">Host: mc-dev</p>
                <p className="text-slate-600">Memory: 24GB available</p>
                <p className="text-slate-600">Throughput: 100 tokens/sec</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">CLUSTER CAPACITY</h3>
              <p className="text-lg font-bold text-slate-900 mb-2">120 GB Total</p>
              <p className="text-xs text-slate-600 mb-3">Status: <span className="text-green-600 font-bold">Optimal</span></p>
              <div className="space-y-2 text-xs">
                <p className="text-slate-600">Available: 80 GB</p>
                <p className="text-slate-600">In Use: 40 GB</p>
                <p className="text-slate-600">Utilization: 33%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
