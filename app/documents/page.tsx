"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Search, Plus, FileText, X } from "lucide-react";

const CATS = {
  report:   { color: "#3b82f6", bg: "#EFF6FF",  label: "Report" },
  template: { color: "#a78bfa", bg: "#1a0f3d",  label: "Template" },
  script:   { color: "#22c55e", bg: "#052e16",  label: "Script" },
  sop:      { color: "#f59e0b", bg: "#2a1a00",  label: "SOP" },
  note:     { color: "#94a3b8", bg: "#FFFFFF",  label: "Note" },
  contract: { color: "#f97316", bg: "#2a1000",  label: "Contract" },
};
const S = { background: "#FFFFFF", border: "1px solid #252525", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" };

export default function DocumentsPage() {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [f, setF] = useState({ title: "", content: "", category: "note" as const, tags: "", clientName: "" });

  const docs = useQuery(api.documents.search, { query: q });
  const create = useMutation(api.documents.create);
  const remove = useMutation(api.documents.remove);
  const log    = useMutation(api.activity.log);

  const filtered = catFilter ? docs?.filter(d => d.category === catFilter) : docs;

  const submit = async () => {
    if (!f.title || !f.content) return;
    await create({ ...f, tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [], clientName: f.clientName || undefined });
    await log({ agentName: "CC", action: `Document created: ${f.title}`, type: "task" });
    setF({ title: "", content: "", category: "note", tags: "", clientName: "" });
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 20px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Documents</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>{docs?.length ?? 0} documents · searchable</p>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Plus size={14} /> New Document
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 32px 24px" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#444" }} />
          <input style={{ ...S, paddingLeft: 40, borderRadius: 10, padding: "11px 14px 11px 40px" }} placeholder="Search documents, reports, templates, scripts..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setCatFilter("")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: !catFilter ? "#1e2a4a" : "#FFFFFF", color: !catFilter ? "#147EFA" : "#555", border: "none", cursor: "pointer", fontWeight: !catFilter ? 600 : 400 }}>
            All ({docs?.length ?? 0})
          </button>
          {Object.entries(CATS).map(([key, val]) => {
            const count = docs?.filter(d => d.category === key).length ?? 0;
            return (
              <button key={key} onClick={() => setCatFilter(catFilter === key ? "" : key)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: catFilter === key ? val.bg : "#FFFFFF", color: catFilter === key ? val.color : "#555", border: "none", cursor: "pointer", fontWeight: catFilter === key ? 600 : 400 }}>
                {val.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* New doc form */}
        {open && (
          <div style={{ marginBottom: 20, padding: 20, background: "#F8FAFC", border: "1px solid #222", borderRadius: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              <input style={S} placeholder="Document title..." value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
              <textarea style={{ ...S, resize: "none", minHeight: 120 }} placeholder="Content..." value={f.content} onChange={e => setF({ ...f, content: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <select style={S} value={f.category} onChange={e => setF({ ...f, category: e.target.value as any })}>
                  <option value="report">Report</option><option value="template">Template</option><option value="script">Script</option><option value="sop">SOP</option><option value="note">Note</option><option value="contract">Contract</option>
                </select>
                <input style={S} placeholder="Client name" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} />
                <input style={S} placeholder="Tags" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save</button>
              <button onClick={() => setOpen(false)} style={{ background: "#CBD5E1", color: "#888", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Document grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filtered?.map(doc => {
            const cat = CATS[doc.category];
            return (
              <div key={doc._id} style={{ background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: 10, padding: 16, cursor: "pointer", position: "relative" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #252525"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1a1a1a"}
                onClick={() => setViewing(doc)}>
                <button onClick={e => { e.stopPropagation(); remove({ id: doc._id }); }} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}>
                  <X size={12} />
                </button>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <FileText size={13} color={cat.color} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#334155", margin: 0, paddingRight: 20 }}>{doc.title}</p>
                <p style={{ fontSize: 12, color: "#64748B", margin: "5px 0 10px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{doc.content}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: cat.bg, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>{formatDistanceToNow(doc.createdAt, { addSuffix: true })}</span>
                </div>
                {doc.clientName && <p style={{ fontSize: 10, color: "#22c55e", margin: "6px 0 0" }}>{doc.clientName}</p>}
              </div>
            );
          })}
        </div>

        {(filtered?.length ?? 0) === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
            <FileText size={32} strokeWidth={1} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, margin: 0 }}>{q ? "No documents match." : "No documents yet."}</p>
          </div>
        )}
      </div>

      {/* Doc viewer modal */}
      {viewing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 680, maxHeight: "80vh", display: "flex", flexDirection: "column", background: "#F8FAFC", border: "1px solid #222", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #1e1e1e" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#334155", margin: 0 }}>{viewing.title}</p>
                {viewing.clientName && <p style={{ fontSize: 11, color: "#22c55e", margin: "3px 0 0" }}>{viewing.clientName}</p>}
              </div>
              <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              <pre style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{viewing.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
