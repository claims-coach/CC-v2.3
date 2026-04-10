"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";

// ── Main page ─────────────────────────────────────────────────────────────
export default function OfficePage() {
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshCounter(c => c + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Agent team with their roles and locations
  const agentTeam = [
    { name: "CC 🧠", role: "Chief of Staff", desk: "command-center", color: "#147EFA", status: "active" },
    { name: "Jason ⚡", role: "Lead Developer", desk: "dev-station", color: "#22c55e", status: "active" },
    { name: "Watson 🔍", role: "Research Agent", desk: "research-desk", color: "#f59e0b", status: "active" },
    { name: "Analysis 📊", role: "Estimate Parser", desk: "analysis-desk", color: "#8b5cf6", status: "working" },
    { name: "Report 📄", role: "PDF Generator", desk: "report-station", color: "#ec4899", status: "working" },
    { name: "Chris 🤝", role: "Negotiator", desk: "negotiation-desk", color: "#06b6d4", status: "working" },
    { name: "ALEX 📣", role: "Marketing Strategist (Hormozi)", desk: "marketing-desk", color: "#f97316", status: "working" },
    { name: "Database 🗄️", role: "RAG Indexer", desk: "data-center", color: "#10b981", status: "idle" },
  ];

  // Desk positions in 2D office grid
  const deskPositions: Record<string, { x: number; y: number; label: string }> = {
    "command-center": { x: 50, y: 20, label: "Command Center" },
    "dev-station": { x: 200, y: 50, label: "Dev Station" },
    "research-desk": { x: 350, y: 50, label: "Research Desk" },
    "analysis-desk": { x: 500, y: 50, label: "Analysis Desk" },
    "report-station": { x: 200, y: 250, label: "Report Station" },
    "negotiation-desk": { x: 350, y: 250, label: "Negotiation Desk" },
    "marketing-desk": { x: 500, y: 250, label: "Marketing Desk" },
    "data-center": { x: 650, y: 150, label: "Data Center" },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc" }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#ffffff" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
          🏢 Claims.Coach HQ
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Agent headquarters • Real-time task board • {agentTeam.filter(a => a.status === "working").length} working · {agentTeam.filter(a => a.status === "active").length} active · {agentTeam.filter(a => a.status === "idle").length} idle
        </p>
      </div>

      {/* ── Content ────────────────────────────────────────────────────– */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>

        {/* ── 2D OFFICE MAP ────────────────────────────────────────── */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
            Headquarters Layout
          </h2>
          
          {/* SVG-based office layout */}
          <svg width="100%" height="380" viewBox="0 0 800 350" style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fafafa" }}>
            {/* Floor */}
            <rect x="10" y="10" width="780" height="330" fill="#f9f9f9" stroke="#d1d5db" strokeWidth="2" />
            
            {/* Desks/Stations - rectangles */}
            {Object.entries(deskPositions).map(([key, pos]) => (
              <g key={key}>
                {/* Desk */}
                <rect x={pos.x - 30} y={pos.y - 20} width="60" height="40" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" rx="3" />
                {/* Desk label */}
                <text x={pos.x} y={pos.y + 55} textAnchor="middle" fontSize="10" fontWeight="600" fill="#4b5563">
                  {pos.label}
                </text>
              </g>
            ))}

            {/* Agents - circles with status */}
            {agentTeam.map((agent) => {
              const pos = deskPositions[agent.desk];
              const statusColor = agent.status === "working" ? "#f59e0b" : agent.status === "active" ? "#22c55e" : "#94a3b8";
              return (
                <g key={agent.name}>
                  {/* Agent circle */}
                  <circle cx={pos.x} cy={pos.y} r="12" fill={agent.color} opacity="0.85" />
                  
                  {/* Status indicator */}
                  <circle cx={pos.x + 8} cy={pos.y - 8} r="4" fill={statusColor} stroke="white" strokeWidth="1" />
                  
                  {/* Agent name tooltip (shows on hover via title) */}
                  <title>{agent.name} - {agent.role}</title>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
            {[
              { label: "Working", color: "#f59e0b" },
              { label: "Active", color: "#22c55e" },
              { label: "Idle", color: "#94a3b8" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── AGENT STATUS TABLE ────────────────────────────────── */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0", textTransform: "uppercase" }}>
            Active Agents
          </h2>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "10px 0", fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Agent</th>
                  <th style={{ textAlign: "left", padding: "10px 0", fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Role</th>
                  <th style={{ textAlign: "center", padding: "10px 0", fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {agentTeam.map((agent) => (
                  <tr key={agent.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 0", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: agent.color }} />
                        {agent.name}
                      </div>
                    </td>
                    <td style={{ padding: "12px 0", fontSize: 12, color: "#64748b" }}>{agent.role}</td>
                    <td style={{ padding: "12px 0", fontSize: 11, textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: agent.status === "working" ? "#fef3c7" : agent.status === "active" ? "#dcfce7" : "#f1f5f9",
                        color: agent.status === "working" ? "#92400e" : agent.status === "active" ? "#166534" : "#475569",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: 10,
                      }}>
                        {agent.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── TASK QUEUE ────────────────────────────────────────────– */}
      <div style={{ borderTop: "1px solid #e2e8f0", background: "#ffffff", padding: "20px 32px", maxHeight: "35%" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 12px 0", textTransform: "uppercase" }}>
          Current Tasks by Agent
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, overflowY: "auto", maxHeight: "120px" }}>
          {agentTeam
            .filter(a => a.status === "working")
            .map((agent) => (
              <div key={agent.name} style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
              }}>
                <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#0f172a" }}>{agent.name}</p>
                <p style={{ margin: 0, color: "#64748b", fontSize: 10 }}>{agent.role}</p>
                <div style={{ marginTop: 4, padding: "4px 6px", background: "#fff", borderRadius: 4, borderLeft: `2px solid ${agent.color}` }}>
                  <span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>Task in progress...</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
