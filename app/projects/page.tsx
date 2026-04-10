"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { ChevronRight, TrendingUp } from "lucide-react";

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  active:    { bg: "#0a2a1a", text: "#22c55e", dot: "#22c55e" },
  paused:    { bg: "#2a2200", text: "#f59e0b", dot: "#f59e0b" },
  completed: { bg: "#EFF6FF", text: "#3b82f6", dot: "#3b82f6" },
};
const PRI_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#64748B" };

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const seed     = useMutation(api.projects.seed);
  const update   = useMutation(api.projects.update);
  const log      = useMutation(api.activity.log);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { seed(); }, []);

  const active    = projects?.filter(p => p.status === "active") ?? [];
  const paused    = projects?.filter(p => p.status === "paused") ?? [];
  const completed = projects?.filter(p => p.status === "completed") ?? [];

  const totalProgress = projects?.length
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 20px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>{active.length} active · {totalProgress}% avg progress</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 8 }}>
          <TrendingUp size={13} color="#22c55e" />
          <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 500 }}>Growth mode</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 24px" }}>
        {/* Progress overview */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Active Projects", value: active.length, color: "#22c55e" },
            { label: "Avg Completion", value: `${totalProgress}%`, color: "#147EFA" },
            { label: "Total Next Actions", value: projects?.reduce((s, p) => s + p.nextActions.length, 0) ?? 0, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10, padding: "16px 20px" }}>
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#444", margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Project cards */}
        {[{ label: "Active", items: active }, { label: "Paused", items: paused }, { label: "Completed", items: completed }].map(group =>
          group.items.length > 0 ? (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{group.label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.items.map(proj => {
                  const st = STATUS_STYLE[proj.status];
                  const isOpen = expanded === proj._id;
                  return (
                    <div key={proj._id} style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #252525"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1a1a1a"}>
                      <div style={{ padding: "16px 20px", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : proj._id)}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                          <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{proj.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: 0 }}>{proj.name}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: st.bg, color: st.text }}>{proj.status}</span>
                                <span style={{ fontSize: 10, color: PRI_COLOR[proj.priority], fontWeight: 600 }}>● {proj.priority}</span>
                                <ChevronRight size={14} color="#333" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: "#64748B", margin: "5px 0 10px", lineHeight: 1.5 }}>{proj.description}</p>

                            {/* Progress bar */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1, height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${proj.progress}%`, height: "100%", background: st.dot, borderRadius: 2, transition: "width 0.3s" }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#444", flexShrink: 0 }}>{proj.progress}%</span>
                            </div>
                            <p style={{ fontSize: 11, color: "#444", margin: "6px 0 0" }}>Owner: {proj.owner}</p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded: next actions */}
                      {isOpen && (
                        <div style={{ borderTop: "1px solid #FFFFFF", padding: "14px 20px 16px 58px", background: "#090909" }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Next Actions</p>
                          {proj.nextActions.map((a, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#147EFA", flexShrink: 0, marginTop: 5 }} />
                              <p style={{ fontSize: 13, color: "#aaa", margin: 0, lineHeight: 1.4 }}>{a}</p>
                            </div>
                          ))}

                          {/* Progress controls */}
                          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                            {[0, 25, 50, 75, 100].map(p => (
                              <button key={p} onClick={async () => {
                                await update({ id: proj._id, progress: p });
                                await log({ agentName: "CC", action: `${proj.name} → ${p}% complete`, type: "task" });
                              }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: proj.progress === p ? "#1e2a4a" : "#FFFFFF", color: proj.progress === p ? "#147EFA" : "#555", border: "none", cursor: "pointer", fontWeight: proj.progress === p ? 600 : 400 }}>
                                {p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
