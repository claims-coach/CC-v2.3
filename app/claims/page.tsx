"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Plus, X, ChevronRight, FileText, Clock, DollarSign, AlertTriangle, ExternalLink, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STAGES = [
  { id: "intake",       label: "Intake",       color: "#64748B", bg: "#F1F5F9" },
  { id: "valuation",    label: "Valuation",    color: "#147EFA", bg: "#EFF6FF" },
  { id: "report_draft", label: "Report Draft", color: "#7C3AED", bg: "#F5F3FF" },
  { id: "review",       label: "Review",       color: "#D97706", bg: "#FFFBEB" },
  { id: "negotiation",  label: "Negotiation",  color: "#FF8600", bg: "#FFF7ED" },
  { id: "settled",      label: "Settled",      color: "#16A34A", bg: "#F0FDF4" },
  { id: "closed",       label: "Closed",       color: "#475569", bg: "#F8FAFC" },
] as const;

const ACTIVE_STAGES = STAGES.filter(s => !["settled","closed"].includes(s.id));
const CLOSED_STAGES = STAGES.filter(s => ["settled","closed"].includes(s.id));

const PRI: Record<string, { color: string; bg: string }> = {
  urgent: { color: "#DC2626", bg: "#FEF2F2" },
  high:   { color: "#EA580C", bg: "#FFF7ED" },
  medium: { color: "#D97706", bg: "#FFFBEB" },
  low:    { color: "#64748B", bg: "#F1F5F9" },
};

const DOC_ICONS: Record<string, string> = {
  estimate: "📋", photo: "📷", recording: "🎙️", report: "📄", correspondence: "📧", other: "📎",
};

const fmt = (n?: number) => n !== undefined ? `$${n.toLocaleString()}` : "—";

const S = { background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" };

function DaysOpenBadge({ days }: { days: number }) {
  const color = days > 30 ? "#f87171" : days > 14 ? "#fb923c" : "#22c55e";
  const bg    = days > 30 ? "#2a0a0a" : days > 14 ? "#2a1200" : "#052e16";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: bg, color, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {days > 14 && <AlertTriangle size={9} />} {days}d
    </span>
  );
}

function GainBadge({ opening, settlement }: { opening?: number; settlement?: number }) {
  if (!opening || !settlement) return null;
  const gain = settlement - opening;
  const pct = Math.round((gain / opening) * 100);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: gain > 0 ? "#F0FDF4" : "#FEF2F2", color: gain > 0 ? "#16A34A" : "#DC2626" }}>
      {gain > 0 ? "+" : ""}{fmt(gain)} ({pct > 0 ? "+" : ""}{pct}%)
    </span>
  );
}

function ClaimCard({ claim, onSelect }: { claim: any; onSelect: (c: any) => void }) {
  const stage = STAGES.find(s => s.id === claim.stage)!;
  const pri   = PRI[claim.priority];
  const gap   = claim.openingOffer && claim.targetValue ? claim.targetValue - claim.openingOffer : undefined;
  const updateStage = useMutation(api.claims.updateStage);
  const log = useMutation(api.activity.log);
  const nextStage = STAGES[STAGES.findIndex(s => s.id === claim.stage) + 1];

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #1c1c1c", borderRadius: 10, padding: 14, cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = "1px solid #2a2a2a"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = "1px solid #1c1c1c"}
      onClick={() => onSelect(claim)}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: 0 }}>{claim.clientName}</p>
          <p style={{ fontSize: 11, color: "#64748B", margin: "2px 0 0", fontFamily: "monospace" }}>{claim.vin}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <DaysOpenBadge days={claim.daysOpen} />
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: pri.bg, color: pri.color }}>{claim.priority}</span>
        </div>
      </div>

      {/* Vehicle */}
      {(claim.year || claim.make) && (
        <p style={{ fontSize: 11, color: "#666", margin: "0 0 8px" }}>{[claim.year, claim.make, claim.model].filter(Boolean).join(" ")}</p>
      )}

      {/* Insurer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#888" }}>{claim.insurer}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#1e2a4a", color: "#147EFA" }}>{claim.claimType}</span>
      </div>

      {/* Financials */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 0", borderTop: "1px solid #FFFFFF", borderBottom: "1px solid #FFFFFF", marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 9, color: "#444", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Opening</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#aaa", margin: "2px 0 0" }}>{fmt(claim.openingOffer)}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "#444", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Target</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#147EFA", margin: "2px 0 0" }}>{fmt(claim.targetValue)}</p>
        </div>
        {claim.stage === "settled" || claim.stage === "closed" ? (
          <div style={{ gridColumn: "1/-1" }}>
            <p style={{ fontSize: 9, color: "#444", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Settled</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", margin: 0 }}>{fmt(claim.settlementAmount)}</p>
              <GainBadge opening={claim.openingOffer} settlement={claim.settlementAmount} />
            </div>
          </div>
        ) : gap !== undefined && (
          <div style={{ gridColumn: "1/-1" }}>
            <p style={{ fontSize: 9, color: "#444", margin: 0 }}>Gap to recover: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(gap)}</span></p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "#444" }}>{claim.assignedAgent}</span>
          {claim.documents.length > 0 && (
            <span style={{ fontSize: 10, color: "#64748B", display: "flex", alignItems: "center", gap: 2 }}>
              <Paperclip size={9} /> {claim.documents.length}
            </span>
          )}
        </div>
        {nextStage && (
          <button onClick={async e => {
            e.stopPropagation();
            await updateStage({ id: claim._id, stage: nextStage.id });
            await log({ agentName: "CC", action: `${claim.clientName} → ${nextStage.label}`, type: "task" });
          }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "3px 8px", background: nextStage.bg, color: nextStage.color, border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}>
            → {nextStage.label}
          </button>
        )}
      </div>
    </div>
  );
}

function ClaimDetail({ claim, onClose }: { claim: any; onClose: () => void }) {
  const update    = useMutation(api.claims.update);
  const addDoc    = useMutation(api.claims.addDocument);
  const updateStage = useMutation(api.claims.updateStage);
  const log       = useMutation(api.activity.log);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(claim.notes ?? "");
  const [settlement, setSettlement] = useState(claim.settlementAmount?.toString() ?? "");
  const [outcome, setOutcome] = useState(claim.outcome ?? "");
  const [newDoc, setNewDoc] = useState({ name: "", type: "estimate" as const, url: "" });

  const stage = STAGES.find(s => s.id === claim.stage)!;

  const saveNotes = async () => {
    await update({ id: claim._id, notes });
    setEditNotes(false);
  };

  const saveSettlement = async () => {
    const amt = parseFloat(settlement);
    if (!isNaN(amt)) await update({ id: claim._id, settlementAmount: amt, outcome });
    await log({ agentName: "CC", action: `Settlement recorded: ${claim.clientName} → $${amt.toLocaleString()}`, type: "task" });
  };

  const attachDoc = async () => {
    if (!newDoc.name) return;
    await addDoc({ id: claim._id, ...newDoc, url: newDoc.url || undefined });
    setNewDoc({ name: "", type: "estimate", url: "" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div style={{ width: 560, height: "100vh", background: "#FFFFFF", borderLeft: "1px solid #1e1e1e", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #FFFFFF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#334155", margin: 0 }}>{claim.clientName}</h2>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0", fontFamily: "monospace" }}>{claim.vin}</p>
              {(claim.year || claim.make) && <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>{[claim.year, claim.make, claim.model].filter(Boolean).join(" ")}</p>}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}><X size={18} /></button>
          </div>

          {/* Stage pills */}
          <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
            {STAGES.map(s => (
              <button key={s.id} onClick={async () => {
                await updateStage({ id: claim._id, stage: s.id });
                await log({ agentName: "CC", action: `${claim.clientName} moved to ${s.label}`, type: "task" });
              }} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: s.id === claim.stage ? s.bg : "#FFFFFF", color: s.id === claim.stage ? s.color : "#444", border: s.id === claim.stage ? `1px solid ${s.color}44` : "1px solid transparent", cursor: "pointer", fontWeight: s.id === claim.stage ? 700 : 400 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {/* Financials */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Opening Offer", val: fmt(claim.openingOffer), color: "#aaa" },
              { label: "Target Value",  val: fmt(claim.targetValue),  color: "#147EFA" },
              { label: "Days Open",     val: `${claim.daysOpen}d`,    color: claim.daysOpen > 30 ? "#f87171" : claim.daysOpen > 14 ? "#fb923c" : "#22c55e" },
            ].map(f => (
              <div key={f.label} style={{ background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 12px" }}>
                <p style={{ fontSize: 9, color: "#444", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: f.color, margin: "4px 0 0" }}>{f.val}</p>
              </div>
            ))}
          </div>

          {/* Settlement */}
          {(claim.stage === "negotiation" || claim.stage === "settled" || claim.stage === "closed") && (
            <div style={{ marginBottom: 20, padding: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Settlement</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...S, flex: 1 }} placeholder="Settlement amount ($)" value={settlement} onChange={e => setSettlement(e.target.value)} />
                <button onClick={saveSettlement} style={{ background: "#22c55e", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Save</button>
              </div>
              <input style={S} placeholder="Outcome notes (feeds learning database)" value={outcome} onChange={e => setOutcome(e.target.value)} />
              {claim.settlementAmount && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 700 }}>Settled: {fmt(claim.settlementAmount)}</span>
                  <GainBadge opening={claim.openingOffer} settlement={claim.settlementAmount} />
                </div>
              )}
            </div>
          )}

          {/* Adjuster */}
          <div style={{ marginBottom: 20, padding: 14, background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Adjuster</p>
            <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>{claim.insurer} · {claim.adjusterName ?? "Unknown adjuster"}</p>
            {claim.adjusterPhone && <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>📞 {claim.adjusterPhone}</p>}
            {claim.adjusterEmail && <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>✉️ {claim.adjusterEmail}</p>}
          </div>

          {/* Documents */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Documents ({claim.documents.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {claim.documents.map((doc: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F8FAFC", border: "1px solid #1e1e1e", borderRadius: 8 }}>
                  <span style={{ fontSize: 16 }}>{DOC_ICONS[doc.type]}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>{doc.name}</p>
                    <p style={{ fontSize: 10, color: "#444", margin: 0, textTransform: "capitalize" }}>{doc.type}</p>
                  </div>
                  {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#147EFA" }}><ExternalLink size={12} /></a>}
                </div>
              ))}
            </div>
            {/* Add document */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input style={{ ...S, flex: 2, minWidth: 140 }} placeholder="Document name" value={newDoc.name} onChange={e => setNewDoc(d => ({ ...d, name: e.target.value }))} />
              <select style={{ ...S, flex: 1, minWidth: 110 }} value={newDoc.type} onChange={e => setNewDoc(d => ({ ...d, type: e.target.value as any }))}>
                <option value="estimate">Estimate</option><option value="photo">Photo</option><option value="recording">Recording</option><option value="report">Report</option><option value="correspondence">Correspondence</option><option value="other">Other</option>
              </select>
              <input style={{ ...S, flex: 2, minWidth: 140 }} placeholder="Google Drive URL (optional)" value={newDoc.url} onChange={e => setNewDoc(d => ({ ...d, url: e.target.value }))} />
              <button onClick={attachDoc} style={{ background: "#1e2a4a", color: "#147EFA", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Attach</button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
              <button onClick={() => setEditNotes(e => !e)} style={{ fontSize: 11, color: "#147EFA", background: "none", border: "none", cursor: "pointer" }}>{editNotes ? "Cancel" : "Edit"}</button>
            </div>
            {editNotes ? (
              <div>
                <textarea style={{ ...S, resize: "none", minHeight: 100 }} value={notes} onChange={e => setNotes(e.target.value)} />
                <button onClick={saveNotes} style={{ marginTop: 8, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: claim.notes ? "#888" : "#94A3B8", lineHeight: 1.6, margin: 0 }}>{claim.notes || "No notes yet."}</p>
            )}
          </div>

          {/* Tags */}
          {claim.tags.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {claim.tags.map((t: string) => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#FFFFFF", color: "#64748B" }}>{t}</span>)}
            </div>
          )}

          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 16 }}>Opened {formatDistanceToNow(claim.openedAt, { addSuffix: true })}</p>
        </div>
      </div>
    </div>
  );
}

function NewClaimModal({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.claims.create);
  const log    = useMutation(api.activity.log);
  const [f, setF] = useState({
    clientName: "", vin: "", year: "", make: "", model: "",
    insurer: "", adjusterName: "", adjusterPhone: "", adjusterEmail: "",
    openingOffer: "", targetValue: "",
    claimType: "ACV" as "ACV" | "DV" | "both",
    assignedAgent: "CC", priority: "medium" as "low"|"medium"|"high"|"urgent",
    notes: "", tags: "",
  });

  const submit = async () => {
    if (!f.clientName || !f.vin || !f.insurer) return;
    await create({
      clientName: f.clientName, vin: f.vin,
      year: f.year ? parseInt(f.year) : undefined,
      make: f.make || undefined, model: f.model || undefined,
      insurer: f.insurer,
      adjusterName: f.adjusterName || undefined,
      adjusterPhone: f.adjusterPhone || undefined,
      adjusterEmail: f.adjusterEmail || undefined,
      openingOffer: f.openingOffer ? parseFloat(f.openingOffer) : undefined,
      targetValue: f.targetValue ? parseFloat(f.targetValue) : undefined,
      claimType: f.claimType, assignedAgent: f.assignedAgent, priority: f.priority,
      notes: f.notes || undefined,
      tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
    await log({ agentName: "CC", action: `New claim opened: ${f.clientName} · ${f.vin}`, type: "task" });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#FFFFFF", border: "1px solid #222", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #1e1e1e" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#334155", margin: 0 }}>Open New Claim</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Client & Vehicle</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input style={S} placeholder="Client name *" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} autoFocus />
              <input style={S} placeholder="VIN *" value={f.vin} onChange={e => setF({ ...f, vin: e.target.value.toUpperCase() })} />
              <input style={S} placeholder="Year" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} />
              <input style={S} placeholder="Make" value={f.make} onChange={e => setF({ ...f, make: e.target.value })} />
              <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Model" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} />
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "8px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Insurer & Adjuster</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Insurer name *" value={f.insurer} onChange={e => setF({ ...f, insurer: e.target.value })} />
              <input style={S} placeholder="Adjuster name" value={f.adjusterName} onChange={e => setF({ ...f, adjusterName: e.target.value })} />
              <input style={S} placeholder="Adjuster phone" value={f.adjusterPhone} onChange={e => setF({ ...f, adjusterPhone: e.target.value })} />
              <input style={{ ...S, gridColumn: "1/-1" }} placeholder="Adjuster email" value={f.adjusterEmail} onChange={e => setF({ ...f, adjusterEmail: e.target.value })} />
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "8px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Financials</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <input style={S} placeholder="Opening offer ($)" value={f.openingOffer} onChange={e => setF({ ...f, openingOffer: e.target.value })} />
              <input style={S} placeholder="Target value ($)" value={f.targetValue} onChange={e => setF({ ...f, targetValue: e.target.value })} />
              <select style={S} value={f.claimType} onChange={e => setF({ ...f, claimType: e.target.value as any })}>
                <option value="ACV">ACV</option><option value="DV">DV</option><option value="both">Both</option>
              </select>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "8px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Assignment</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input style={S} placeholder="Assigned agent" value={f.assignedAgent} onChange={e => setF({ ...f, assignedAgent: e.target.value })} />
              <select style={S} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as any })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>

            <textarea style={{ ...S, resize: "none" }} placeholder="Initial notes" rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
            <input style={S} placeholder="Tags (comma-separated)" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ flex: 1, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Open Claim</button>
          <button onClick={onClose} style={{ background: "#FFFFFF", color: "#888", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  const claims  = useQuery(api.claims.list, {});
  const stats   = useQuery(api.claims.stats);
  const [newOpen, setNewOpen]   = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"active" | "closed">("active");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const activeClaims   = claims?.filter(c => !["settled","closed","unassigned"].includes(c.stage)) ?? [];
  const closedClaims   = claims?.filter(c => ["settled","closed"].includes(c.stage)) ?? [];
  const unassigned     = claims?.filter(c => c.stage === "unassigned") ?? [];
  const currentClaims  = viewMode === "active" ? activeClaims : closedClaims;
  const displayed = stageFilter ? currentClaims.filter(c => c.stage === stageFilter) : currentClaims;

  // Reset stage filter when switching tabs
  const switchView = (mode: "active" | "closed") => { setViewMode(mode); setStageFilter(null); };
  const visibleStages = viewMode === "active" ? ACTIVE_STAGES : CLOSED_STAGES;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: 0 }}>Claims Pipeline</h1>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
              {activeClaims.length} active · {closedClaims.length} closed · {stats?.total ?? 0} total
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Active / Closed tab switcher */}
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 2 }}>
              <button onClick={() => switchView("active")}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: viewMode === "active" ? "#FFFFFF" : "transparent",
                  color: viewMode === "active" ? "#147EFA" : "#64748B",
                  boxShadow: viewMode === "active" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                Active Pipeline
              </button>
              <button onClick={() => switchView("closed")}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: viewMode === "closed" ? "#FFFFFF" : "transparent",
                  color: viewMode === "closed" ? "#475569" : "#64748B",
                  boxShadow: viewMode === "closed" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                Closed / Archived
              </button>
            </div>
            {viewMode === "active" && (
              <button onClick={() => setNewOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={14} strokeWidth={2.5} /> Open Claim
              </button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        {viewMode === "active" && (
          <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { label: "Active Cases",    val: activeClaims.length,                                                            color: "#147EFA" },
              { label: "In Negotiation",  val: activeClaims.filter(c => c.stage === "negotiation").length,                     color: "#FF8600" },
              { label: "Awaiting Review", val: activeClaims.filter(c => c.stage === "review").length,                          color: "#D97706" },
              { label: "Intake / New",    val: activeClaims.filter(c => c.stage === "intake").length,                          color: "#64748B" },
              { label: "Closed This Year",val: closedClaims.length,                                                            color: "#16A34A" },
            ].map(k => (
              <div key={k.label}>
                <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.val}</p>
                <p style={{ fontSize: 10, color: "#94A3B8", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</p>
              </div>
            ))}
            {unassigned.length > 0 && (
              <div style={{ marginLeft: "auto", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8" }}>{unassigned.length}</span>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>GHL contacts without pipeline entry — hidden from view</span>
              </div>
            )}
          </div>
        )}
        {stats && viewMode === "closed" && (
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total Recovered", val: `$${(stats.totalRecovered / 1000).toFixed(0)}k`, color: "#22c55e" },
              { label: "Settled",         val: closedClaims.filter(c => c.stage === "settled").length, color: "#16A34A" },
              { label: "Closed",          val: closedClaims.filter(c => c.stage === "closed").length,  color: "#475569" },
              { label: "Win Rate",        val: `${stats.winRate}%`, color: "#a78bfa" },
            ].map(k => (
              <div key={k.label}>
                <p style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: 0 }}>{k.val}</p>
                <p style={{ fontSize: 10, color: "#94A3B8", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stage filter bar */}
      <div style={{ padding: "12px 32px", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 6, alignItems: "center", flexShrink: 0, overflowX: "auto" }}>
        <button onClick={() => setStageFilter(null)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: !stageFilter ? "#EFF6FF" : "#FFFFFF", color: !stageFilter ? "#147EFA" : "#555", border: !stageFilter ? "1px solid #BFDBFE" : "1px solid transparent", cursor: "pointer", fontWeight: !stageFilter ? 700 : 400, whiteSpace: "nowrap" }}>
          All ({currentClaims.length})
        </button>
        {visibleStages.map(s => {
          const count = currentClaims.filter(c => c.stage === s.id).length ?? 0;
          return (
            <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
              style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: stageFilter === s.id ? s.bg : "#FFFFFF", color: stageFilter === s.id ? s.color : "#555", border: stageFilter === s.id ? `1px solid ${s.color}33` : "1px solid transparent", cursor: "pointer", fontWeight: stageFilter === s.id ? 700 : 400, whiteSpace: "nowrap" }}>
              {s.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Active Pipeline — Kanban */}
      {viewMode === "active" && !stageFilter ? (
        <div style={{ flex: 1, overflow: "hidden", padding: "16px 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ACTIVE_STAGES.length},1fr)`, gap: 10, height: "100%", overflowX: "auto" }}>
            {ACTIVE_STAGES.map(stage => {
              const stageClaims = activeClaims.filter(c => c.stage === stage.id);
              return (
                <div key={stage.id} style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: stage.color }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: "#94A3B8", background: "#FFFFFF", padding: "1px 5px", borderRadius: 4 }}>{stageClaims.length}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {stageClaims.map(c => <ClaimCard key={c._id} claim={c} onSelect={setSelected} />)}
                    {stageClaims.length === 0 && (
                      <div style={{ border: "1px dashed #FFFFFF", borderRadius: 8, padding: 12, textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#222", margin: 0 }}>Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === "active" && stageFilter ? (
        // Active filtered list view
        <div style={{ flex: 1, overflow: "auto", padding: "16px 32px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {displayed.map(c => <ClaimCard key={c._id} claim={c} onSelect={setSelected} />)}
            {displayed.length === 0 && <p style={{ fontSize: 13, color: "#94A3B8", gridColumn: "1/-1", padding: "24px 0" }}>No claims in this stage.</p>}
          </div>
        </div>
      ) : (
        // Closed / Archived list view
        <div style={{ flex: 1, overflow: "auto", padding: "16px 32px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                {["Client", "Vehicle", "Insurer", "Type", "Stage", "Opening Offer", "Settlement", "Gain", "Closed"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(c => {
                const gain = c.openingOffer && c.settlementAmount ? c.settlementAmount - c.openingOffer : null;
                const stageInfo = STAGES.find(s => s.id === c.stage)!;
                return (
                  <tr key={c._id} onClick={() => setSelected(c)} style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#334155" }}>{c.clientName}</td>
                    <td style={{ padding: "10px 12px", color: "#64748B" }}>{[c.year, c.make, c.model].filter(Boolean).join(" ") || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#64748B" }}>{c.insurer || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#EFF6FF", color: "#147EFA" }}>{c.claimType}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: stageInfo.bg, color: stageInfo.color }}>{stageInfo.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748B" }}>{c.openingOffer ? `$${c.openingOffer.toLocaleString()}` : "—"}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#16A34A" }}>{c.settlementAmount ? `$${c.settlementAmount.toLocaleString()}` : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {gain !== null ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: gain > 0 ? "#16A34A" : "#DC2626" }}>
                          {gain > 0 ? "+" : ""}{`$${gain.toLocaleString()}`}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 11 }}>{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "32px 12px", textAlign: "center", color: "#94A3B8" }}>No closed files yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {newOpen  && <NewClaimModal onClose={() => setNewOpen(false)} />}
      {selected && <ClaimDetail claim={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
