"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { FolderOpen, Plus, Search, ExternalLink, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";

const DIVISIONS = ["AUTO", "PROP"] as const;
const ROLES = [
  { code: "DV",  label: "Diminished Value" },
  { code: "AC",  label: "Appraisal Clause" },
  { code: "UMP", label: "Umpire (Neutral)" },
  { code: "EXP", label: "Expert Witness" },
  { code: "CON", label: "Consulting" },
  { code: "LIT", label: "Litigation Support" },
  { code: "OTH", label: "Other" },
] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:    { bg: "#dcfce7", color: "#16a34a" },
  prospect:  { bg: "#eff6ff", color: "#2563eb" },
  settled:   { bg: "#f0fdf4", color: "#15803d" },
  closed:    { bg: "#f1f5f9", color: "#64748b" },
  cancelled: { bg: "#fef2f2", color: "#dc2626" },
};

const ROLE_COLORS: Record<string, string> = {
  DV: "#FF8600", AC: "#147EFA", UMP: "#8b5cf6",
  EXP: "#dc2626", CON: "#0891b2", LIT: "#b45309", OTH: "#64748b",
};

const inp = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#0f172a", outline: "none", width: "100%" };
const sel = { ...inp, cursor: "pointer" };

export default function CasesPage() {
  const cases   = useQuery(api.caseRegistry.list, {}) ?? [];
  const nextId  = useQuery(api.caseRegistry.nextId, {});
  const create  = useMutation(api.caseRegistry.create);

  const [search,    setSearch]    = useState("");
  const [statusFil, setStatusFil] = useState("");
  const [roleFil,   setRoleFil]   = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const [form, setForm] = useState({
    division: "AUTO" as "AUTO" | "PROP",
    role: "DV" as any,
    lastName: "", carrier: "", clientName: "",
    contactId: "", opportunityId: "", notes: "",
    status: "active" as any,
  });

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.caseKey.toLowerCase().includes(q) || c.clientName?.toLowerCase().includes(q) || c.carrier.toLowerCase().includes(q);
    const matchStatus = !statusFil || c.status === statusFil;
    const matchRole   = !roleFil   || c.role   === roleFil;
    return matchSearch && matchStatus && matchRole;
  });

  const handleCreate = async () => {
    if (!form.lastName || !form.carrier) return;
    setSaving(true);
    try {
      await create({
        division:      form.division,
        role:          form.role,
        lastName:      form.lastName.trim(),
        carrier:       form.carrier.trim(),
        clientName:    form.clientName.trim() || undefined,
        contactId:     form.contactId.trim() || undefined,
        opportunityId: form.opportunityId.trim() || undefined,
        status:        form.status,
        notes:         form.notes.trim() || undefined,
      });

      // Also stamp GHL via API
      if (form.contactId || form.opportunityId) {
        fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).catch(() => {});
      }

      setForm({ division: "AUTO", role: "DV", lastName: "", carrier: "", clientName: "", contactId: "", opportunityId: "", notes: "", status: "active" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 24px 14px", borderBottom: "1px solid #e2e8f0", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderOpen size={16} color="#FF8600" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Case Registry</h1>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{cases.length} matters · next ID: <strong style={{ color: "#FF8600" }}>{nextId}</strong></p>
            </div>
          </div>
          <button onClick={() => setShowForm(s => !s)} style={{
            display: "flex", alignItems: "center", gap: 6, background: "#0f172a", color: "#fff",
            border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <Plus size={14} /> New Case
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* New Case Form */}
        {showForm && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>New Matter</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Will be assigned: <strong style={{ color: "#FF8600" }}>{nextId}</strong></span>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Client Last Name *</label>
                <input style={inp} placeholder="Smith" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Full Client Name</label>
                <input style={inp} placeholder="John Smith" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Carrier / Opposing Party *</label>
                <input style={inp} placeholder="GEICO" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Division *</label>
                <select style={sel} value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value as any }))}>
                  {DIVISIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Role *</label>
                <select style={sel} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                  {ROLES.map(r => <option key={r.code} value={r.code}>{r.code} — {r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Status</label>
                <select style={sel} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  {["active","prospect","settled","closed","cancelled"].map(s => <option key={s}>{s}</option>)}
                </select>
                {(form.status === "settled" || form.status === "closed") && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, cursor: "pointer", color: "#16a34a", fontWeight: 600 }}>
                    <input type="checkbox" checked={(form as any).happyCustomer || false} onChange={e => setForm(f => ({ ...f, happyCustomer: e.target.checked } as any))} />
                    😊 Happy Customer (adds "happy customer" tag in GHL)
                  </label>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>GHL Contact ID</label>
                <input style={inp} placeholder="Optional" value={form.contactId} onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>GHL Opportunity ID</label>
                <input style={inp} placeholder="Optional" value={form.opportunityId} onChange={e => setForm(f => ({ ...f, opportunityId: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Notes</label>
                <input style={inp} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Preview */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontFamily: "monospace", fontSize: 13, color: "#0f172a" }}>
              {nextId}_{new Date().getFullYear().toString().slice(-2)}-{form.division}-{form.role}_{form.lastName || "LastName"}_{form.carrier || "Carrier"}
            </div>

            <button onClick={handleCreate} disabled={saving || !form.lastName || !form.carrier} style={{
              background: saving ? "#94a3b8" : "#0f172a", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer",
            }}>
              {saving ? "Creating…" : "Create Case & Stamp GHL →"}
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input style={{ ...inp, paddingLeft: 32 }} placeholder="Search case key, client, carrier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select style={{ ...sel, width: 130 }} value={statusFil} onChange={e => setStatusFil(e.target.value)}>
            <option value="">All statuses</option>
            {["active","prospect","settled","closed","cancelled"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={{ ...sel, width: 130 }} value={roleFil} onChange={e => setRoleFil(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
          </select>
        </div>

        {/* Case list */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#94a3b8" }}>
              {cases.length === 0 ? "No cases yet. Create your first matter above." : "No cases match your search."}
            </div>
          ) : filtered.map((c, i) => {
            const sc  = STATUS_COLORS[c.status] ?? STATUS_COLORS.active;
            const rc  = ROLE_COLORS[c.role] ?? "#64748b";
            const isX = expanded === c._id;
            return (
              <div key={c._id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div
                  onClick={() => setExpanded(isX ? null : c._id)}
                  style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: isX ? "#f8fafc" : "#fff" }}
                >
                  {/* Role badge */}
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: rc + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: rc }}>{c.role}</span>
                  </div>

                  {/* Case key */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{c.caseKey}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                      {c.clientName && <span style={{ marginRight: 10 }}>{c.clientName}</span>}
                      <span style={{ color: "#94a3b8" }}>Opened {format(c.openedAt, "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                    {c.status}
                  </div>

                  {/* GHL link indicator */}
                  {c.contactId && (
                    <a href={`https://app.gohighlevel.com/contacts/${c.contactId}`} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: "#147EFA", display: "flex", alignItems: "center", gap: 3, fontSize: 11, flexShrink: 0 }}>
                      <ExternalLink size={12} /> GHL
                    </a>
                  )}

                  <ChevronDown size={14} color="#94a3b8" style={{ transform: isX ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                </div>

                {/* Expanded */}
                {isX && (
                  <div style={{ padding: "10px 16px 14px 64px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                      {[
                        ["Master Case ID", c.masterCaseId],
                        ["Division", c.division],
                        ["Role", ROLES.find(r => r.code === c.role)?.label || c.role],
                        ["Carrier", c.carrier],
                        ["GHL Contact", c.contactId || "—"],
                        ["GHL Opportunity", c.opportunityId || "—"],
                        ["Drive Folder", c.driveFolder || "Pending auth"],
                      ].map(([label, val]) => (
                        <div key={label as string}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
                          <div style={{ fontSize: 12, color: "#334155", fontFamily: label === "Master Case ID" ? "monospace" : "inherit", fontWeight: label === "Master Case ID" ? 700 : 400 }}>{val as string}</div>
                        </div>
                      ))}
                    </div>
                    {c.notes && <div style={{ marginTop: 10, fontSize: 12, color: "#475569", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px" }}>{c.notes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
