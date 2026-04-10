"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Search, Plus, Brain, FileText, Users, Lightbulb, BookOpen,
  Mic, Clock, ExternalLink, X, ChevronDown, ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
const MEM_TYPES = {
  conversation: { icon: Brain,      color: "#a78bfa", bg: "#1a0f3d", label: "Convo" },
  document:     { icon: FileText,   color: "#3b82f6", bg: "#EFF6FF", label: "Doc" },
  client:       { icon: Users,      color: "#22c55e", bg: "#052e16", label: "Client" },
  decision:     { icon: Lightbulb,  color: "#f59e0b", bg: "#2a1a00", label: "Decision" },
  lesson:       { icon: BookOpen,   color: "#f97316", bg: "#2a1000", label: "Lesson" },
};

const SRC_COLORS: Record<string, { color: string; bg: string }> = {
  plaud:  { color: "#22c55e", bg: "#052e16" },
  manual: { color: "#3b82f6", bg: "#EFF6FF" },
  upload: { color: "#a78bfa", bg: "#1a0f3d" },
};

const S: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #252525", color: "#334155",
  borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none",
};

type Tab = "memories" | "recordings" | "timeline";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDur = (s?: number) => {
  if (!s) return null;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

// ── Recording Card ─────────────────────────────────────────────────────────
function RecordingCard({ rec, onExpand }: { rec: any; onExpand: (r: any) => void }) {
  const src = SRC_COLORS[rec.source] ?? SRC_COLORS.manual;
  return (
    <div onClick={() => onExpand(rec)}
      style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #252525"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1a1a1a"}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: src.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Mic size={15} color={src.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#334155", margin: 0 }}>{rec.title}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: src.bg, color: src.color, flexShrink: 0 }}>{rec.source.toUpperCase()}</span>
        </div>
        {rec.summary && <p style={{ fontSize: 12, color: "#666", margin: "5px 0 0", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{rec.summary}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          {rec.clientName && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#052e16", color: "#22c55e", fontWeight: 600 }}>{rec.clientName}</span>}
          {fmtDur(rec.duration) && <span style={{ fontSize: 10, color: "#444", display: "flex", alignItems: "center", gap: 3 }}><Clock size={9} /> {fmtDur(rec.duration)}</span>}
          <span style={{ fontSize: 10, color: "#94A3B8" }}>{formatDistanceToNow(rec.createdAt, { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}

// ── Recording Detail Modal ─────────────────────────────────────────────────
function RecordingModal({ rec, onClose }: { rec: any; onClose: () => void }) {
  const update  = useMutation(api.recordings.update);
  const remove  = useMutation(api.recordings.remove);
  const [summary, setSummary] = useState(rec.summary ?? "");
  const [client,  setClient]  = useState(rec.clientName ?? "");
  const [saving,  setSaving]  = useState(false);
  const [tab, setTab] = useState<"summary"|"transcript">("summary");

  const save = async () => {
    setSaving(true);
    await update({ id: rec._id, summary: summary || undefined, clientName: client || undefined });
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div style={{ width: 600, height: "100vh", background: "#FFFFFF", borderLeft: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #FFFFFF", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Mic size={14} color="#22c55e" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase" }}>{rec.source}</span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#334155", margin: 0 }}>{rec.title}</h2>
            <p style={{ fontSize: 11, color: "#444", margin: "4px 0 0" }}>
              {format(rec.recordedAt, "MMM d, yyyy · h:mm a")} {fmtDur(rec.duration) && `· ${fmtDur(rec.duration)}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}><X size={16} /></button>
        </div>

        <div style={{ padding: "14px 24px", borderBottom: "1px solid #FFFFFF", display: "flex", gap: 6 }}>
          {(["summary","transcript"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: tab === t ? "#1e2a4a" : "#FFFFFF", color: tab === t ? "#147EFA" : "#555", border: "none", cursor: "pointer", fontWeight: tab === t ? 600 : 400, textTransform: "capitalize" }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {tab === "summary" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Client</p>
                <input style={S} placeholder="Client name" value={client} onChange={e => setClient(e.target.value)} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Summary / Notes</p>
                <textarea style={{ ...S, resize: "none", minHeight: 140 }} placeholder="AI summary or your notes..." value={summary} onChange={e => setSummary(e.target.value)} />
              </div>
              {rec.driveUrl && (
                <a href={rec.driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 8, color: "#147EFA", fontSize: 13, textDecoration: "none" }}>
                  <ExternalLink size={12} /> Open in Google Drive
                </a>
              )}
              {rec.audioUrl && (
                <a href={rec.audioUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 8, color: "#22c55e", fontSize: 13, textDecoration: "none" }}>
                  <Mic size={12} /> Play Audio
                </a>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
                <button onClick={async () => { await remove({ id: rec._id }); onClose(); }} style={{ background: "#2a0a0a", color: "#f87171", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          ) : (
            <pre style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>
              {rec.transcript || "No transcript available."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Memory Form ────────────────────────────────────────────────────────
function AddMemoryForm({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.memories.create);
  const log    = useMutation(api.activity.log);
  const [f, setF] = useState({ title: "", content: "", type: "conversation" as const, tags: "", clientName: "" });

  const submit = async () => {
    if (!f.title || !f.content) return;
    await create({ ...f, tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [], clientName: f.clientName || undefined });
    await log({ agentName: "CC", action: `Memory saved: ${f.title}`, type: "memory" });
    onClose();
  };

  return (
    <div style={{ marginBottom: 20, padding: 20, background: "#F8FAFC", border: "1px solid #222", borderRadius: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        <input style={S} placeholder="Title..." value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
        <textarea style={{ ...S, resize: "none" }} placeholder="Content..." rows={4} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <select style={S} value={f.type} onChange={e => setF({ ...f, type: e.target.value as any })}>
            <option value="conversation">Conversation</option><option value="document">Document</option><option value="client">Client</option><option value="decision">Decision</option><option value="lesson">Lesson</option>
          </select>
          <input style={S} placeholder="Client name" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} />
          <input style={S} placeholder="Tags (comma-separated)" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save</button>
        <button onClick={onClose} style={{ background: "#CBD5E1", color: "#888", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MemoryPage() {
  const [tab,  setTab]  = useState<Tab>("recordings");
  const [q,    setQ]    = useState("");
  const [open, setOpen] = useState(false);
  const [expandedRec, setExpandedRec] = useState<any>(null);

  const memories   = useQuery(api.memories.search,    { query: q });
  const recordings = useQuery(api.recordings.search,  { query: q });

  // Build unified timeline
  const timeline = [
    ...(memories   ?? []).map(m => ({ ...m, _kind: "memory" as const })),
    ...(recordings ?? []).map(r => ({ ...r, _kind: "recording" as const })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const recCount = recordings?.length ?? 0;
  const memCount = memories?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 16px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Memory</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>
            {recCount} recordings · {memCount} memories · full-text search
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#052e16", border: "1px solid #0f3a22", borderRadius: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Plaud webhook ready</span>
          </div>
          <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <Plus size={14} /> Add Memory
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: "0 32px", display: "flex", gap: 2, borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        {([
          { id: "recordings", label: `Calls & Recordings (${recCount})` },
          { id: "memories",   label: `Memories (${memCount})` },
          { id: "timeline",   label: "Timeline" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? "#334155" : "#555",
            background: "none", border: "none", cursor: "pointer",
            padding: "12px 16px", borderBottom: tab === t.id ? "2px solid #5e6ad2" : "2px solid transparent",
            marginBottom: -1, transition: "all 0.1s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 24px" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#444" }} />
          <input style={{ ...S, paddingLeft: 40, borderRadius: 10, padding: "11px 14px 11px 40px" }}
            placeholder={tab === "recordings" ? "Search transcripts, client names, summaries..." : "Search all memories..."}
            value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {open && tab === "memories" && <AddMemoryForm onClose={() => setOpen(false)} />}

        {/* ── Recordings tab ── */}
        {tab === "recordings" && (
          <>
            {/* Plaud webhook info */}
            <div style={{ marginBottom: 20, padding: "14px 18px", background: "#0a1a0a", border: "1px solid #0f2a0f", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", margin: 0 }}>🎙️ Plaud Webhook Active</p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                    Point your Plaud app or Zapier automation to:
                  </p>
                  <code style={{ fontSize: 11, color: "#aaa", background: "#F8FAFC", padding: "4px 8px", borderRadius: 4, display: "inline-block", marginTop: 6 }}>
                    POST http://YOUR_IP:3000/api/plaud
                  </code>
                </div>
                <span style={{ fontSize: 10, color: "#22c55e", background: "#052e16", padding: "3px 8px", borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>LIVE</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recordings?.map(r => <RecordingCard key={r._id} rec={r} onExpand={setExpandedRec} />)}
              {(recordings?.length ?? 0) === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
                  <Mic size={32} strokeWidth={1} style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ fontSize: 14, margin: 0 }}>{q ? "No recordings match." : "No recordings yet."}</p>
                  <p style={{ fontSize: 12, color: "#222", margin: "6px 0 0" }}>Calls from Plaud will appear here automatically.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Memories tab ── */}
        {tab === "memories" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(MEM_TYPES).map(([key, val]) => {
                const count = memories?.filter(m => m.type === key).length ?? 0;
                return (
                  <button key={key} onClick={() => setQ(q === key ? "" : key)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: q === key ? val.bg : "#FFFFFF", color: q === key ? val.color : "#555", border: "none", cursor: "pointer", fontWeight: q === key ? 600 : 400 }}>
                    {val.label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
              {q && <button onClick={() => setQ("")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#E2E8F0", color: "#888", border: "none", cursor: "pointer" }}>Clear</button>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memories?.map(mem => {
                const t = MEM_TYPES[mem.type as keyof typeof MEM_TYPES];
                if (!t) return null;
                const Icon = t.icon;
                return (
                  <div key={mem._id} style={{ display: "flex", gap: 14, padding: 16, background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #252525"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1a1a1a"}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={13} color={t.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#334155", margin: 0 }}>{mem.title}</p>
                        <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, flexShrink: 0 }}>{formatDistanceToNow(mem.createdAt, { addSuffix: true })}</p>
                      </div>
                      <p style={{ fontSize: 12, color: "#64748B", margin: "5px 0 0", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{mem.content}</p>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: t.bg, color: t.color, fontWeight: 600 }}>{t.label}</span>
                        {mem.clientName && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#052e16", color: "#22c55e" }}>{mem.clientName}</span>}
                        {mem.tags.map((tag: string) => <span key={tag} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#FFFFFF", color: "#64748B" }}>{tag}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(memories?.length ?? 0) === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
                  <Brain size={32} strokeWidth={1} style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ fontSize: 14, margin: 0 }}>{q ? "No memories match." : "No memories yet."}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Timeline tab ── */}
        {tab === "timeline" && (
          <div style={{ maxWidth: 720 }}>
            {timeline.map((item, i) => {
              const isRec = item._kind === "recording";
              const color = isRec ? "#22c55e" : "#147EFA";
              const bg    = isRec ? "#052e16"  : "#1a0f3d";
              return (
                <div key={item._id} style={{ display: "flex", gap: 14, paddingBottom: 2, position: "relative" }}>
                  {i < timeline.length - 1 && (
                    <div style={{ position: "absolute", left: 18, top: 40, bottom: -2, width: 1, background: "#FFFFFF" }} />
                  )}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                    {isRec ? <Mic size={13} color={color} /> : <Brain size={13} color={color} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 18, paddingTop: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                        {isRec ? "📼" : "🧠"} {item.title}
                      </span>
                      {(item as any).clientName && (
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#052e16", color: "#22c55e", fontWeight: 600 }}>{(item as any).clientName}</span>
                      )}
                    </div>
                    {isRec
                      ? <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>{(item as any).summary ?? "Call recording"}</p>
                      : <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{(item as any).content}</p>
                    }
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>
                      {formatDistanceToNow(item.createdAt, { addSuffix: true })} · {format(item.createdAt, "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
            {timeline.length === 0 && (
              <p style={{ fontSize: 13, color: "#94A3B8", padding: "24px 0" }}>No items yet.</p>
            )}
          </div>
        )}
      </div>

      {expandedRec && <RecordingModal rec={expandedRec} onClose={() => setExpandedRec(null)} />}
    </div>
  );
}
