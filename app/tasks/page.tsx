"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Plus, X, Clock, ChevronRight, FileText, Tag, User, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import TaskQueueStatus from "@/app/components/TaskQueueStatus";

const COLS = [
  { id: "todo",        label: "To Do",             dot: "#64748B" },
  { id: "in_progress", label: "In Progress",        dot: "#3b82f6" },
  { id: "review",      label: "⏳ Awaiting Approval", dot: "#f59e0b" },
  { id: "done",        label: "Done",               dot: "#22c55e" },
] as const;

const PRI: Record<string, { bg: string; text: string }> = {
  urgent: { bg: "#FEE2E2", text: "#DC2626" },
  high:   { bg: "#FFEDD5", text: "#EA580C" },
  medium: { bg: "#FEF9C3", text: "#B45309" },
  low:    { bg: "#F1F5F9", text: "#64748B" },
};

// Per-assignee visual identity
const ASSIGNEE: Record<string, { emoji: string; label: string; cardBorder: string; cardBg: string; avatarBg: string; avatarColor: string }> = {
  Johnny:  { emoji: "👤", label: "Johnny",  cardBorder: "#BBF7D0", cardBg: "#FFFFFF", avatarBg: "#F0FDF4", avatarColor: "#16A34A" },
  CC:      { emoji: "🧠", label: "CC",      cardBorder: "#C7D2FE", cardBg: "#FFFFFF", avatarBg: "#EEF2FF", avatarColor: "#4F46E5" },
  default: { emoji: "🤖", label: "Agent",   cardBorder: "#E2E8F0", cardBg: "#FFFFFF", avatarBg: "#F8FAFC", avatarColor: "#64748B" },
};

function getAssignee(name: string) {
  return ASSIGNEE[name] ?? { ...ASSIGNEE.default, emoji: "🤖", label: name };
}

const S = { background: "#FFFFFF", border: "1px solid #252525", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" };

export default function TasksPage() {
  const tasks  = useQuery(api.tasks.list);
  const create = useMutation(api.tasks.create);
  const move   = useMutation(api.tasks.updateStatus);
  const update = useMutation(api.tasks.update);
  const del    = useMutation(api.tasks.remove);
  const log    = useMutation(api.activity.log);
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<"All" | "Johnny" | "CC">("All");

  const openTask = (task: any) => {
    setSelectedTask(task);
    setEditContent(task.content ?? "");
    setEditDesc(task.description ?? "");
  };

  const saveTask = async () => {
    if (!selectedTask) return;
    await update({ id: selectedTask._id, content: editContent, description: editDesc });
    setSelectedTask((t: any) => ({ ...t, content: editContent, description: editDesc }));
  };

  const moveTask = async (taskId: any, status: any) => {
    await move({ id: taskId, status });
    if (selectedTask?._id === taskId) setSelectedTask((t: any) => ({ ...t, status }));
  };
  const [f, setF] = useState({ title: "", description: "", assignee: "CC", priority: "medium" as const, tags: "" });

  const awaitingApproval = tasks?.filter(t => t.status === "review") ?? [];

  const submit = async () => {
    if (!f.title.trim()) return;
    await create({ ...f, status: "todo", tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [] });
    await log({ agentName: "CC", action: `Created task: ${f.title}`, type: "task" });
    setF({ title: "", description: "", assignee: "CC", priority: "medium", tags: "" });
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Task Queue Status */}
      <div style={{ padding: "0 32px", marginTop: "20px" }}>
        <TaskQueueStatus />
      </div>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 20px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Task Board</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>
            {(assigneeFilter === "All" ? tasks : tasks?.filter(t => t.assignee === assigneeFilter))?.length ?? 0} tasks
            {assigneeFilter !== "All" ? ` · ${assigneeFilter}` : ""}
            {" · "}live sync
            {awaitingApproval.length > 0 && (
              <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>
                · ⏳ {awaitingApproval.length} awaiting your approval
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["All", "Johnny", "CC"] as const).map(a => {
            const isActive = assigneeFilter === a;
            const bg  = isActive ? (a === "Johnny" ? "#1a3a1a" : a === "CC" ? "#1a1a3a" : "#222") : "#FFFFFF";
            const clr = isActive ? (a === "Johnny" ? "#4ade80" : a === "CC" ? "#818cf8" : "#334155") : "#444";
            const label = a === "Johnny" ? "👤 Johnny" : a === "CC" ? "🧠 CC" : "All";
            return <button key={a} onClick={() => setAssigneeFilter(a)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", background: bg, color: clr }}>{label}</button>;
          })}
          <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", marginLeft: 8 }}>
            <Plus size={14} strokeWidth={2.5} /> New Task
          </button>
        </div>
      </div>

      {/* New task form */}
      {open && (
        <div style={{ margin: "16px 32px 0", padding: 20, background: "#F8FAFC", border: "1px solid #222", borderRadius: 12, flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Task title..." value={f.title} onChange={e => setF({ ...f, title: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
            <input style={S} placeholder="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
            <input style={S} placeholder="Assignee (CC, Johnny...)" value={f.assignee} onChange={e => setF({ ...f, assignee: e.target.value })} />
            <select style={S} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as any })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <input style={S} placeholder="Tags (comma-separated)" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submit} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Create</button>
            <button onClick={() => setOpen(false)} style={{ background: "#CBD5E1", color: "#888", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, padding: "12px 32px 0", flexShrink: 0 }}>
        {Object.entries(ASSIGNEE).filter(([k]) => k !== "default").map(([key, a]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: a.cardBorder, border: `1px solid ${a.avatarColor}` }} />
            <span style={{ fontSize: 11, color: "#64748B" }}>{a.emoji} {a.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: "#FFFBEB", border: "1px solid #D97706" }} />
          <span style={{ fontSize: 11, color: "#64748B" }}>⏳ Awaiting your approval</span>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, minHeight: "100%" }}>
          {COLS.map(col => {
            const filtered = assigneeFilter === "All" ? tasks : tasks?.filter(t => t.assignee === assigneeFilter);
            const ct = filtered?.filter(t => t.status === col.id) ?? [];
            const isApprovalCol = col.id === "review";
            return (
              <div key={col.id} style={{ display: "flex", flexDirection: "column" }}>
                {/* Column header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: isApprovalCol ? "#f59e0b" : "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 11, background: isApprovalCol && ct.length > 0 ? "#2a1800" : "#FFFFFF", color: isApprovalCol && ct.length > 0 ? "#f59e0b" : "#444", padding: "2px 6px", borderRadius: 4 }}>{ct.length}</span>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {ct.map(task => {
                    const a = getAssignee(task.assignee);
                    const isAwaitingApproval = task.status === "review";
                    return (
                      <div key={task._id} style={{
                        background: a.cardBg,
                        border: `1px solid ${isAwaitingApproval ? "#FDE68A" : a.cardBorder}`,
                        borderLeft: `3px solid ${isAwaitingApproval ? "#D97706" : a.avatarColor}`,
                        borderRadius: 10,
                        padding: 14,
                        position: "relative",
                        transition: "box-shadow 0.15s",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                        onClick={() => openTask(task)}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"}>

                        {/* Awaiting approval badge */}
                        {isAwaitingApproval && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, padding: "3px 8px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, width: "fit-content" }}>
                            <Clock size={10} color="#D97706" />
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706" }}>AWAITING YOUR APPROVAL</span>
                          </div>
                        )}

                        {/* Title row */}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: 0, lineHeight: 1.4 }}>{task.title}</p>
                          <button onClick={e => { e.stopPropagation(); del({ id: task._id }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", flexShrink: 0, padding: 0 }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#EF4444"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#CBD5E1"}>
                            <X size={12} />
                          </button>
                        </div>

                        {task.description && <p style={{ fontSize: 12, color: "#475569", margin: "6px 0 0", lineHeight: 1.5 }}>{task.description}</p>}

                        {/* Priority + Assignee avatar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: PRI[task.priority].bg, color: PRI[task.priority].text }}>{task.priority}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: a.avatarBg }}>
                            <span style={{ fontSize: 11 }}>{a.emoji}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: a.avatarColor }}>{a.label}</span>
                          </div>
                        </div>

                        {/* Tags */}
                        {task.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                            {task.tags.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 6px", background: "#E2E8F0", color: "#64748B", borderRadius: 4 }}>{t}</span>)}
                          </div>
                        )}

                        {/* Move buttons */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                          {COLS.filter(c => c.id !== col.id).map(c => (
                            <button key={c.id} onClick={e => { e.stopPropagation(); moveTask(task._id, c.id); }}
                              style={{ fontSize: 10, padding: "3px 8px", background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 4, cursor: "pointer", borderLeft: `2px solid ${c.dot}` }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EFF6FF"}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                        <p style={{ fontSize: 10, color: "#94A3B8", margin: "8px 0 0" }}>{formatDistanceToNow(task.createdAt, { addSuffix: true })}</p>
                      </div>
                    );
                  })}
                  {ct.length === 0 && (
                    <div style={{ border: "1px dashed #E2E8F0", borderRadius: 10, padding: 16, textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (() => {
        const a = getAssignee(selectedTask.assignee);
        const isAwaitingApproval = selectedTask.status === "review";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}
            onClick={() => setSelectedTask(null)}>
            <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", borderLeft: `4px solid ${isAwaitingApproval ? "#D97706" : a.avatarColor}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {isAwaitingApproval && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8, padding: "3px 10px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 20 }}>
                        <Clock size={11} color="#D97706" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>AWAITING YOUR APPROVAL</span>
                      </div>
                    )}
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0, lineHeight: 1.4 }}>{selectedTask.title}</h2>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: PRI[selectedTask.priority].bg, color: PRI[selectedTask.priority].text }}>{selectedTask.priority}</span>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: a.avatarBg, color: a.avatarColor, fontWeight: 600 }}>{a.emoji} {a.label}</span>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#F1F5F9", color: "#64748B", fontWeight: 600, borderLeft: `2px solid ${COLS.find(c => c.id === selectedTask.status)?.dot ?? "#94A3B8"}` }}>
                        {COLS.find(c => c.id === selectedTask.status)?.label}
                      </span>
                      {selectedTask.tags?.map((t: string) => (
                        <span key={t} style={{ fontSize: 11, padding: "2px 8px", background: "#F1F5F9", color: "#64748B", borderRadius: 4 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setSelectedTask(null)} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#64748B", flexShrink: 0 }}>Close</button>
                </div>
              </div>

              {/* Modal body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                    Summary
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onBlur={saveTask}
                    rows={2}
                    style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#334155", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    placeholder="Task summary…"
                  />
                </div>

                {/* Script / Content */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                    Script / Content
                  </label>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    onBlur={saveTask}
                    rows={12}
                    style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#334155", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box", background: "#FAFAFA" }}
                    placeholder="Paste script, notes, or full content here…"
                  />
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Auto-saves on blur. Edit freely.</p>
                </div>
              </div>

              {/* Modal footer — move actions */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#FAFAFA" }}>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginRight: 4 }}>MOVE TO:</span>
                {COLS.filter(c => c.id !== selectedTask.status).map(c => (
                  <button key={c.id} onClick={() => moveTask(selectedTask._id, c.id)}
                    style={{ fontSize: 12, padding: "6px 14px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderLeft: `3px solid ${c.dot}`, borderRadius: 6, cursor: "pointer", color: "#334155", fontWeight: 600 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F1F5F9"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#FFFFFF"}>
                    {c.label}
                  </button>
                ))}
                <button onClick={async () => { await del({ id: selectedTask._id }); setSelectedTask(null); }}
                  style={{ marginLeft: "auto", fontSize: 12, padding: "6px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", color: "#DC2626", fontWeight: 600 }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
