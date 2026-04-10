"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Search, Plus, FolderOpen, Folder, ExternalLink, X, Mic, FileText, Image, File, Mail, ScrollText } from "lucide-react";

const CATS = {
  recording:      { icon: Mic,        color: "#22c55e", bg: "#052e16",  label: "Recording",      ext: "m4a/mp3" },
  estimate:       { icon: ScrollText, color: "#3b82f6", bg: "#EFF6FF",  label: "Estimate",       ext: "pdf" },
  photo:          { icon: Image,      color: "#f59e0b", bg: "#2a1a00",  label: "Photo",           ext: "jpg/png" },
  report:         { icon: FileText,   color: "#a78bfa", bg: "#1a0f3d",  label: "Report",         ext: "pdf" },
  correspondence: { icon: Mail,       color: "#f97316", bg: "#2a1000",  label: "Correspondence", ext: "pdf/email" },
  contract:       { icon: File,       color: "#ec4899", bg: "#2a0a1a",  label: "Contract",       ext: "pdf" },
  other:          { icon: File,       color: "#64748B", bg: "#FFFFFF",  label: "Other",           ext: "*" },
};

const S: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #252525", color: "#334155",
  borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none",
};

const fmtSize = (b?: number) => {
  if (!b) return null;
  if (b > 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b > 1_000)     return `${(b / 1_000).toFixed(0)} KB`;
  return `${b} B`;
};

type View = "client" | "category" | "all";

export default function FilesPage() {
  const [q,           setQ]           = useState("");
  const [view,        setView]        = useState<View>("client");
  const [catFilter,   setCatFilter]   = useState("");
  const [clientFilter,setClientFilter]= useState("");
  const [addOpen,     setAddOpen]     = useState(false);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [f, setF] = useState({
    name: "", category: "other" as keyof typeof CATS,
    driveUrl: "", clientName: "", claimId: "", notes: "", tags: "",
  });

  const files   = useQuery(api.files.search, { query: q });
  const clients = useQuery(api.files.clients);
  const create  = useMutation(api.files.create);
  const remove  = useMutation(api.files.remove);

  const filtered = (files ?? []).filter(f => {
    if (catFilter    && f.category    !== catFilter)    return false;
    if (clientFilter && f.clientName  !== clientFilter) return false;
    return true;
  });

  const submit = async () => {
    if (!f.name) return;
    await create({
      name: f.name, category: f.category,
      driveUrl: f.driveUrl || undefined,
      clientName: f.clientName || undefined,
      claimId: f.claimId || undefined,
      notes: f.notes || undefined,
      tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      uploadedBy: "CC",
    });
    setF({ name: "", category: "other", driveUrl: "", clientName: "", claimId: "", notes: "", tags: "" });
    setAddOpen(false);
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Group by client
  const byClient: Record<string, typeof filtered> = {};
  for (const f of filtered) {
    const key = f.clientName ?? "— No Client —";
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(f);
  }

  // Group by category
  const byCat: Record<string, typeof filtered> = {};
  for (const f of filtered) {
    if (!byCat[f.category]) byCat[f.category] = [];
    byCat[f.category].push(f);
  }

  const FileRow = ({ file }: { file: any }) => {
    const cat = CATS[file.category as keyof typeof CATS] ?? CATS.other;
    const Icon = cat.icon;
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 12px", borderRadius: 8, background: "#FFFFFF", border: "1px solid #FFFFFF" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1e1e1e"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #FFFFFF"}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} color={cat.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#334155", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: cat.color, background: cat.bg, padding: "1px 5px", borderRadius: 3 }}>{cat.label}</span>
            {file.clientName && <span style={{ fontSize: 10, color: "#22c55e", background: "#052e16", padding: "1px 5px", borderRadius: 3 }}>{file.clientName}</span>}
            {fmtSize(file.sizeBytes) && <span style={{ fontSize: 10, color: "#444" }}>{fmtSize(file.sizeBytes)}</span>}
            <span style={{ fontSize: 10, color: "#94A3B8" }}>{formatDistanceToNow(file.createdAt, { addSuffix: true })}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {file.driveUrl && (
            <a href={file.driveUrl} target="_blank" rel="noopener noreferrer"
              style={{ width: 26, height: 26, borderRadius: 6, background: "#F8FAFC", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#147EFA" }}
              title="Open in Google Drive">
              <ExternalLink size={11} />
            </a>
          )}
          <button onClick={() => remove({ id: file._id })}
            style={{ width: 26, height: 26, borderRadius: 6, background: "#F8FAFC", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#333"}>
            <X size={10} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px 16px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Files</h1>
          <p style={{ fontSize: 12, color: "#444", margin: "4px 0 0" }}>{filtered.length} files · organized by client & type</p>
        </div>
        <button onClick={() => setAddOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Plus size={14} /> Add File
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left sidebar — client tree */}
        <div style={{ width: 200, borderRight: "1px solid #FFFFFF", overflowY: "auto", padding: "12px 8px", flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 8px 8px" }}>Clients</p>
          <button onClick={() => { setClientFilter(""); setCatFilter(""); }}
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: !clientFilter && !catFilter ? "#1e2a4a" : "transparent", color: !clientFilter && !catFilter ? "#147EFA" : "#555", border: "none", cursor: "pointer", fontSize: 12, fontWeight: !clientFilter ? 600 : 400 }}>
            <FolderOpen size={13} /> All Files ({files?.length ?? 0})
          </button>
          {(clients ?? []).map(name => {
            const count = filtered.filter(f => f.clientName === name).length;
            const active = clientFilter === name;
            return (
              <button key={name} onClick={() => setClientFilter(active ? "" : name)}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: active ? "#1e2a4a" : "transparent", color: active ? "#147EFA" : "#555", border: "none", cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400 }}>
                <Folder size={12} /> {name} <span style={{ marginLeft: "auto", fontSize: 10, color: "#444" }}>{count}</span>
              </button>
            );
          })}

          <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 8px 8px" }}>By Type</p>
          {Object.entries(CATS).map(([key, val]) => {
            const count = (files ?? []).filter(f => f.category === key).length;
            if (count === 0) return null;
            const active = catFilter === key;
            const Icon = val.icon;
            return (
              <button key={key} onClick={() => setCatFilter(active ? "" : key)}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: active ? val.bg : "transparent", color: active ? val.color : "#555", border: "none", cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400 }}>
                <Icon size={11} /> {val.label} <span style={{ marginLeft: "auto", fontSize: 10, color: "#444" }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#444" }} />
            <input style={{ ...S, paddingLeft: 40, borderRadius: 10, padding: "10px 14px 10px 40px" }}
              placeholder="Search files by name..." value={q} onChange={e => setQ(e.target.value)} />
          </div>

          {/* Add form */}
          {addOpen && (
            <div style={{ marginBottom: 20, padding: 18, background: "#F8FAFC", border: "1px solid #222", borderRadius: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={{ ...S, gridColumn: "1/-1" }} placeholder="File name *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoFocus />
                <select style={S} value={f.category} onChange={e => setF({ ...f, category: e.target.value as any })}>
                  {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input style={S} placeholder="Client name" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} />
                <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Google Drive URL" value={f.driveUrl} onChange={e => setF({ ...f, driveUrl: e.target.value })} />
                <input style={S} placeholder="Claim ID (optional)" value={f.claimId} onChange={e => setF({ ...f, claimId: e.target.value })} />
                <input style={S} placeholder="Tags (comma-separated)" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
                <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submit} style={{ background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Add File</button>
                <button onClick={() => setAddOpen(false)} style={{ background: "#CBD5E1", color: "#888", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* File listing — grouped by client */}
          {clientFilter ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map(f => <FileRow key={f._id} file={f} />)}
              {filtered.length === 0 && <p style={{ fontSize: 13, color: "#94A3B8" }}>No files for this client.</p>}
            </div>
          ) : catFilter ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map(f => <FileRow key={f._id} file={f} />)}
              {filtered.length === 0 && <p style={{ fontSize: 13, color: "#94A3B8" }}>No files of this type.</p>}
            </div>
          ) : (
            // Client folder tree
            Object.entries(byClient).sort(([a],[b]) => a.localeCompare(b)).map(([client, clientFiles]) => {
              const isOpen = expanded.has(client);
              return (
                <div key={client} style={{ marginBottom: 8 }}>
                  <button onClick={() => toggleExpand(client)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FFFFFF", border: "1px solid #1a1a1a", borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"}>
                    {isOpen ? <FolderOpen size={14} color="#147EFA" /> : <Folder size={14} color="#555" />}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isOpen ? "#334155" : "#888" }}>{client}</span>
                    <span style={{ fontSize: 11, color: "#444", background: "#FFFFFF", padding: "2px 7px", borderRadius: 4 }}>{clientFiles.length} files</span>
                  </button>
                  {isOpen && (
                    <div style={{ border: "1px solid #1a1a1a", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {clientFiles.map(f => (
                        <div key={f._id} style={{ borderTop: "1px solid #FFFFFF" }}>
                          <FileRow file={f} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {filtered.length === 0 && !addOpen && (
            <div style={{ textAlign: "center", padding: "64px 0", color: "#94A3B8" }}>
              <FolderOpen size={36} strokeWidth={1} style={{ margin: "0 auto 14px", display: "block" }} />
              <p style={{ fontSize: 14, margin: 0 }}>No files yet.</p>
              <p style={{ fontSize: 12, color: "#222", margin: "6px 0 0" }}>Add files manually or connect Plaud to auto-ingest recordings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
