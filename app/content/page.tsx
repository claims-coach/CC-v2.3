"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Plus, X, ChevronRight, Flame, ExternalLink, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STAGES = [
  { id: "idea",      label: "Idea",      color: "#64748B", accent: "#374151", emoji: "💡" },
  { id: "script",    label: "Script",    color: "#3b82f6", accent: "#1d4ed8", emoji: "📝" },
  { id: "thumbnail", label: "Thumbnail", color: "#a78bfa", accent: "#7c3aed", emoji: "🎨" },
  { id: "filming",   label: "Filming",   color: "#f59e0b", accent: "#d97706", emoji: "🎬" },
  { id: "editing",   label: "Editing",   color: "#f97316", accent: "#ea580c", emoji: "✂️" },
  { id: "published", label: "Published", color: "#22c55e", accent: "#16a34a", emoji: "🚀" },
] as const;

type Stage = typeof STAGES[number]["id"];

const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook"];

const inputStyle = {
  background: "#FFFFFF",
  border: "1px solid #2a2a2a",
  color: "#334155",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

function ScriptModal({ item, onClose, onSave }: { item: any; onClose: () => void; onSave: (script: string) => void }) {
  const [text, setText] = useState(item.script || "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-[680px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" style={{ background: "#EFF6FF", border: "1px solid #2a2a2a" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "#334155" }}>{item.title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#444444" }}>Script editor</p>
          </div>
          <button onClick={onClose} style={{ color: "#444444" }}><X size={16} /></button>
        </div>
        <textarea
          className="flex-1 p-6 resize-none text-[13px] leading-relaxed"
          style={{ background: "#F8FAFC", color: "#334155", outline: "none", minHeight: 400 }}
          placeholder="Script goes here..."
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: "1px solid #1e1e1e" }}>
          <button onClick={() => { onSave(text); onClose(); }} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white" style={{ background: "#147EFA" }}>
            Save Script
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium" style={{ background: "#CBD5E1", color: "#888888" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const items = useQuery(api.content.list);
  const createItem = useMutation(api.content.create);
  const updateStage = useMutation(api.content.updateStage);
  const updateScript = useMutation(api.content.updateScript);
  const removeItem = useMutation(api.content.remove);
  const logActivity = useMutation(api.activity.log);

  const [showForm, setShowForm] = useState(false);
  const [scriptItem, setScriptItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    platforms: [] as string[],
    tags: "",
    trendScore: "",
    sourceUrl: "",
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await createItem({
      title: form.title,
      description: form.description || undefined,
      stage: "idea",
      platform: form.platforms,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      trendScore: form.trendScore ? Number(form.trendScore) : undefined,
      sourceUrl: form.sourceUrl || undefined,
    });
    await logActivity({ agentName: "CC", action: `Content idea added: ${form.title}`, type: "task" });
    setForm({ title: "", description: "", platforms: [], tags: "", trendScore: "", sourceUrl: "" });
    setShowForm(false);
  };

  const handleMove = async (id: Id<"content">, stage: Stage) => {
    await updateStage({ id, stage });
    await logActivity({ agentName: "Marketing Agent", action: `Content moved to ${stage}`, type: "task" });
  };

  const togglePlatform = (p: string) => {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }));
  };

  const published = items?.filter(i => i.stage === "published").length ?? 0;
  const total = items?.length ?? 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "#334155" }}>Content Pipeline</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "#444444" }}>
            {total} pieces · {published} published · Research agent drops ideas daily at 8am
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg"
          style={{ background: "#147EFA", color: "white" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Add Idea
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mx-8 mt-4 p-5 rounded-xl flex-shrink-0" style={{ background: "#EFF6FF", border: "1px solid #222222" }}>
          <p className="text-[13px] font-semibold mb-4" style={{ color: "#334155" }}>New Content Idea</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Title / hook..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
            <input style={inputStyle} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <input style={inputStyle} placeholder="Source URL (optional)" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
            <input style={inputStyle} placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
            <input style={inputStyle} type="number" min="1" max="10" placeholder="Trend score (1-10)" value={form.trendScore} onChange={e => setForm({ ...form, trendScore: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[12px]" style={{ color: "#555555" }}>Platforms:</span>
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
                style={{
                  background: form.platforms.includes(p) ? "#1e2a4a" : "#E2E8F0",
                  color: form.platforms.includes(p) ? "#147EFA" : "#555555",
                  border: `1px solid ${form.platforms.includes(p) ? "#2a3a6a" : "#94A3B8"}`,
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white" style={{ background: "#147EFA" }}>Add to Pipeline</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px] font-medium" style={{ background: "#CBD5E1", color: "#888888" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="flex gap-4 h-full" style={{ minWidth: "max-content" }}>
          {STAGES.map(stage => {
            const stageItems = items?.filter(i => i.stage === stage.id) ?? [];
            return (
              <div key={stage.id} className="flex flex-col" style={{ width: 260, minWidth: 260 }}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{stage.emoji}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#444444" }}>{stage.label}</span>
                  </div>
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#E2E8F0", color: "#444444" }}>{stageItems.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {stageItems.map(item => (
                    <div
                      key={item._id}
                      className="group rounded-xl p-4 transition-all duration-150"
                      style={{ background: "#FFFFFF", border: "1px solid #1c1c1c" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #272727"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1c1c1c"}
                    >
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-snug flex-1" style={{ color: "#334155" }}>{item.title}</p>
                        <button
                          onClick={() => removeItem({ id: item._id })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                          style={{ color: "#444444" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444444"}
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p className="text-[11px] mt-1.5 leading-relaxed line-clamp-2" style={{ color: "#555555" }}>{item.description}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center justify-between mt-2.5">
                        {item.trendScore ? (
                          <div className="flex items-center gap-1">
                            <Flame size={10} style={{ color: item.trendScore >= 8 ? "#f97316" : "#555555" }} />
                            <span className="text-[11px] font-medium" style={{ color: item.trendScore >= 8 ? "#f97316" : "#555555" }}>
                              {item.trendScore}/10
                            </span>
                          </div>
                        ) : <div />}
                        <span className="text-[10px]" style={{ color: "#333333" }}>
                          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                        </span>
                      </div>

                      {/* Platforms */}
                      {item.platform.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.platform.map((p: string) => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#E2E8F0", color: "#555555" }}>{p}</span>
                          ))}
                        </div>
                      )}

                      {/* Script indicator */}
                      {item.script && (
                        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "#EFF6FF" }}>
                          <FileText size={10} style={{ color: "#3b82f6" }} />
                          <span className="text-[10px]" style={{ color: "#3b82f6" }}>Script ready</span>
                        </div>
                      )}

                      {/* Source link */}
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1.5" style={{ color: "#444444" }}>
                          <ExternalLink size={9} />
                          <span className="text-[10px] truncate">Source</span>
                        </a>
                      )}

                      {/* Actions */}
                      <div className="mt-3 pt-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: "1px solid #1e1e1e" }}>
                        {/* Script editor button */}
                        <button
                          onClick={() => setScriptItem(item)}
                          className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md w-full transition-all"
                          style={{ background: "#EFF6FF", color: "#3b82f6" }}
                        >
                          <FileText size={10} />
                          {item.script ? "Edit script" : "Write script"}
                        </button>

                        {/* Move buttons */}
                        <div className="flex gap-1 flex-wrap">
                          {STAGES.filter(s => s.id !== stage.id).map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleMove(item._id, s.id)}
                              className="text-[10px] px-2 py-1 rounded-md font-medium transition-all"
                              style={{ background: "#E2E8F0", color: "#555555", borderLeft: `2px solid ${s.color}` }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#aaaaaa"}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#555555"}
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageItems.length === 0 && (
                    <div className="rounded-xl p-4 text-center" style={{ border: "1px dashed #1e1e1e" }}>
                      <p className="text-[12px]" style={{ color: "#94A3B8" }}>Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Script modal */}
      {scriptItem && (
        <ScriptModal
          item={scriptItem}
          onClose={() => setScriptItem(null)}
          onSave={async (script) => {
            await updateScript({ id: scriptItem._id, script });
            await logActivity({ agentName: "CC", action: `Script updated: ${scriptItem.title}`, type: "task" });
          }}
        />
      )}
    </div>
  );
}
