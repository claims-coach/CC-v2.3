"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

const STATUS: Record<string, { dot: string; text: string; label: string }> = {
  active:  { dot: "#22c55e", text: "#22c55e", label: "Active" },
  working: { dot: "#f59e0b", text: "#f59e0b", label: "Working" },
  idle:    { dot: "#333",    text: "#555",    label: "Idle" },
  offline: { dot: "#ef4444", text: "#ef4444", label: "Offline" },
};

function AgentCard({ agent, featured }: { agent: any; featured?: boolean }) {
  const st = STATUS[agent.status] ?? STATUS.idle;
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 12, padding: featured ? 22 : 18, transition: "border 0.1s" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #252525"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1a1a1a"}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: featured ? 52 : 44, height: featured ? 52 : 44, borderRadius: 12, background: "#FFFFFF", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: featured ? 26 : 22, flexShrink: 0 }}>
          {agent.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: featured ? 15 : 14, fontWeight: 700, color: "#334155", margin: 0 }}>{agent.name}</p>
              <p style={{ fontSize: 12, color: "#147EFA", margin: "3px 0 0", fontWeight: 500 }}>{agent.role}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, boxShadow: agent.status === "working" ? `0 0 8px ${st.dot}` : "none" }} />
              <span style={{ fontSize: 11, color: st.text, fontWeight: 500 }}>{st.label}</span>
            </div>
          </div>

          {agent.currentTask && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 6 }}>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>↳ {agent.currentTask}</p>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            {agent.responsibilities.map((r: string, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 4 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#333", flexShrink: 0, marginTop: 6 }} />
                <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.4 }}>{r}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #FFFFFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{agent.tasksCompleted} tasks completed</span>
            {agent.type === "primary" && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#1e2a4a", color: "#147EFA", textTransform: "uppercase", letterSpacing: "0.06em" }}>Command</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const agents = useQuery(api.agents.list);
  const seed   = useMutation(api.agents.seed);
  useEffect(() => { seed(); }, []);

  const primary = agents?.filter(a => a.type === "primary") ?? [];
  const subs    = agents?.filter(a => a.type === "sub-agent") ?? [];
  const working = agents?.filter(a => a.status === "working").length ?? 0;
  const active  = agents?.filter(a => a.status === "active").length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Team</h1>
        <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>{agents?.length ?? 0} agents · {working} working · {active} active</p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 24px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Total Agents", val: agents?.length ?? 0, color: "#147EFA" },
            { label: "Active",       val: active,              color: "#22c55e" },
            { label: "Working Now",  val: working,             color: "#f59e0b" },
            { label: "Tasks Done",   val: agents?.reduce((s,a) => s+a.tasksCompleted,0)??0, color: "#a78bfa" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
              <p style={{ fontSize: 11, color: "#444", margin: "3px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Command */}
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Command</p>
        <div style={{ marginBottom: 24 }}>{primary.map(a => <AgentCard key={a._id} agent={a} featured />)}</div>

        {/* Sub-agents */}
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Sub-Agents</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {subs.map(a => <AgentCard key={a._id} agent={a} />)}
        </div>
      </div>
    </div>
  );
}
