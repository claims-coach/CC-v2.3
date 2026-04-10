"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, CheckCircle, XCircle, Zap, Send, Copy, RotateCcw, ChevronDown, ChevronUp, FileText, Search } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = {
    major:    { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", label: "MAJOR" },
    moderate: { bg: "#fffbeb", border: "#fcd34d", color: "#d97706", label: "MODERATE" },
    minor:    { bg: "#f0f9ff", border: "#7dd3fc", color: "#0369a1", label: "MINOR" },
  }[severity] || { bg: "#f8fafc", border: "#cbd5e1", color: "#64748b", label: severity.toUpperCase() };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, letterSpacing: 0.5,
    }}>{cfg.label}</span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function NegotiatePage() {
  const claims = useQuery(api.claims.list, {}) ?? [];
  const createTask = useMutation(api.negotiationTasks.create);
  const updateTask = useMutation(api.negotiationTasks.update);
  const tasks = useQuery(api.negotiationTasks.list, {}) ?? [];

  // ── Input state ───────────────────────────────────────────────────────
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [oaText, setOaText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [editedDraft, setEditedDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"input" | "analysis" | "tasks">("input");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedClaim = claims.find(c => c._id === selectedClaimId);
  const claimTasks = tasks.filter(t => t.claimId === selectedClaimId);

  // ── PDF upload → extract text ─────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "text/plain") {
      setOaText(await file.text());
      return;
    }
    // For PDFs, use parse-evaluation route to extract text
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/parse-evaluation", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setOaText(data.rawText || data.text || JSON.stringify(data, null, 2));
      } else {
        alert("Could not parse PDF — paste the text manually instead.");
      }
    } catch {
      alert("PDF parse failed — paste the text manually.");
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!oaText.trim()) { alert("Paste the OA's email or report text first."); return; }
    setAnalyzing(true);
    setResult(null);
    try {
      const payload: any = { oaText };
      if (selectedClaim) {
        payload.clientName = selectedClaim.clientName;
        payload.vehicleStr = [selectedClaim.year, selectedClaim.make, selectedClaim.model, selectedClaim.trim].filter(Boolean).join(" ");
        payload.mileage    = selectedClaim.mileage;
        payload.location   = selectedClaim.city ? `${selectedClaim.city}, ${selectedClaim.state || "WA"}` : selectedClaim.state || "WA";
        payload.insurerOffer = selectedClaim.openingOffer;
        // Try to pull workbench comps from valuation
      }
      const res = await fetch("/api/analyze-oa-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { alert("Analysis failed: " + await res.text()); return; }
      const data = await res.json();
      setResult(data);
      setEditedDraft(data.draftRebuttal || "");
      setActiveTab("analysis");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setAnalyzing(false);
  }

  // ── Save to Convex tasks ──────────────────────────────────────────────
  async function handleSaveTask() {
    if (!result) return;
    await createTask({
      claimId:       selectedClaimId || undefined,
      clientName:    selectedClaim?.clientName || "Unknown Client",
      vehicleStr:    [selectedClaim?.year, selectedClaim?.make, selectedClaim?.model, selectedClaim?.trim].filter(Boolean).join(" ") || "Unknown Vehicle",
      ourACV:        undefined,
      oaACV:         result.oaACV || undefined,
      gap:           result.gap || undefined,
      oaRawText:     oaText,
      oaComps:       result.oaComps || [],
      anchorFlags:   result.anchorFlags || [],
      analysis:      result.analysisNarrative || "",
      draftRebuttal: editedDraft,
      ghlContactId:  selectedClaim?.ghlContactId || undefined,
    });
    alert("✅ Saved to Negotiation Tasks");
  }

  // ── Send via GHL ──────────────────────────────────────────────────────
  async function handleSend(taskId?: string) {
    const draft = editedDraft || result?.draftRebuttal;
    if (!draft) { alert("No draft to send."); return; }
    if (!selectedClaim?.ghlContactId) {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(draft);
      setSendStatus("📋 Copied to clipboard — paste into GHL email thread manually.");
      return;
    }
    setSending(true);
    setSendStatus("");
    try {
      const res = await fetch("/api/ghl-send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedClaim.ghlContactId,
          subject: `Re: Appraisal Response — ${[selectedClaim.year, selectedClaim.make, selectedClaim.model].filter(Boolean).join(" ")}`,
          body: draft,
        }),
      });
      if (res.ok) {
        setSendStatus("✅ Sent via GHL");
        if (taskId) await updateTask({ id: taskId as any, status: "sent", sentAt: Date.now() });
      } else {
        const err = await res.text();
        // GHL send route might not exist yet — fall back to clipboard
        await navigator.clipboard.writeText(draft);
        setSendStatus("📋 GHL send not configured — copied to clipboard instead.");
      }
    } catch {
      await navigator.clipboard.writeText(draft);
      setSendStatus("📋 Copied to clipboard — paste into GHL email thread.");
    }
    setSending(false);
  }

  // ── Pending tasks count ───────────────────────────────────────────────
  const pendingTasks = tasks.filter(t => t.status === "pending_review");

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="mc-wb-flow" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mc-wb-header mc-wb-sticky" style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 52, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="#FF8600" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Negotiation Workbench</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Analyze OA response · Flag anchor comps · Draft rebuttal</div>
          </div>
        </div>
        {pendingTasks.length > 0 && (
          <button onClick={() => setActiveTab("tasks")} style={{
            background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#92400e", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertTriangle size={14} color="#d97706" />
            {pendingTasks.length} pending review
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="mc-wb-sticky2" style={{
        background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
        display: "flex", padding: "0 24px", gap: 4, flexShrink: 0,
      }}>
        {[
          { id: "input",    label: "Input" },
          { id: "analysis", label: result ? `Analysis ${result.anchorFlags?.length ? `(${result.anchorFlags.length} flags)` : ""}` : "Analysis" },
          { id: "tasks",    label: `Tasks (${tasks.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: "10px 16px", fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500,
            color: activeTab === tab.id ? "#147EFA" : "#64748b",
            background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #147EFA" : "2px solid transparent",
            cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="mc-wb-outer" style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ─────────── INPUT TAB ──────────────────────────────────────── */}
        {activeTab === "input" && (
          <div style={{ maxWidth: 780, margin: "0 auto" }}>

            {/* Case selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                Link to Claim (optional but recommended)
              </label>
              <select
                value={selectedClaimId}
                onChange={e => setSelectedClaimId(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff", color: "#0f172a", outline: "none" }}
              >
                <option value="">— Select a claim —</option>
                {claims
                  .filter(c => c.stage === "negotiation" || c.stage === "report_draft" || c.stage === "review")
                  .map(c => (
                    <option key={c._id} value={c._id}>
                      {c.clientName} — {[c.year, c.make, c.model].filter(Boolean).join(" ")} ({c.insurer || "Unknown Carrier"})
                    </option>
                  ))}
                <optgroup label="── All claims ──">
                  {claims.map(c => (
                    <option key={c._id + "-all"} value={c._id}>
                      {c.clientName} — {[c.year, c.make, c.model].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </optgroup>
              </select>
              {selectedClaim && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe",
                  borderRadius: 6, fontSize: 12, color: "#1d4ed8", display: "flex", gap: 16,
                }}>
                  <span><strong>Offer:</strong> {selectedClaim.openingOffer ? fmt(selectedClaim.openingOffer) : "—"}</span>
                  <span><strong>Stage:</strong> {selectedClaim.stage}</span>
                  <span><strong>VIN:</strong> {selectedClaim.vin || "—"}</span>
                </div>
              )}
            </div>

            {/* OA text input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  OA's Response (email text or PDF content)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
                      background: "#fff", fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <FileText size={12} /> Upload PDF / TXT
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
                  {oaText && (
                    <button onClick={() => setOaText("")} style={{
                      padding: "5px 10px", borderRadius: 6, border: "1px solid #fca5a5",
                      background: "#fef2f2", fontSize: 11, color: "#dc2626", cursor: "pointer",
                    }}>Clear</button>
                  )}
                </div>
              </div>
              <textarea
                value={oaText}
                onChange={e => setOaText(e.target.value)}
                placeholder={`Paste the OA's email or report text here...\n\nExamples:\n• Their reply email with comp listings\n• Extracted text from their PDF appraisal\n• Their stated ACV and supporting analysis\n\nTip: Upload a PDF and it will be automatically parsed.`}
                style={{
                  width: "100%", minHeight: 280, padding: "12px 14px",
                  borderRadius: 8, border: "1px solid #e2e8f0",
                  fontSize: 12, fontFamily: "monospace", lineHeight: 1.6,
                  color: "#334155", resize: "vertical", outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                {oaText.length.toLocaleString()} chars · {oaText.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !oaText.trim()}
              style={{
                width: "100%", padding: "14px 24px",
                background: analyzing || !oaText.trim() ? "#e2e8f0" : "#0f172a",
                color: analyzing || !oaText.trim() ? "#94a3b8" : "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: analyzing || !oaText.trim() ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              {analyzing ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                  Analyzing OA Response… (Grok + Claude)
                </>
              ) : (
                <><Search size={16} /> Analyze OA Response</>
              )}
            </button>
          </div>
        )}

        {/* ─────────── ANALYSIS TAB ───────────────────────────────────── */}
        {activeTab === "analysis" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {!result ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                <Search size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>No analysis yet — go to Input tab and analyze an OA response.</p>
              </div>
            ) : (
              <>
                {/* ── Summary row ─────────────────────────────────────── */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12, marginBottom: 20,
                }}>
                  {[
                    { label: "OA's ACV", val: result.oaACV ? fmt(result.oaACV) : "—", color: "#dc2626" },
                    { label: "Value Gap", val: result.gap ? fmt(result.gap) : "—", color: result.gap > 0 ? "#16a34a" : "#dc2626" },
                    { label: "OA Comps", val: String(result.oaComps?.length || 0), color: "#0f172a" },
                    { label: "Flags", val: `${result.majorCount || 0} major · ${result.moderateCount || 0} mod`, color: result.majorCount > 0 ? "#dc2626" : "#d97706" },
                    { label: "Excl. Comps Avg", val: result.adjustedOaAvg ? fmt(result.adjustedOaAvg) : "—", color: "#147EFA" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px",
                    }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* ── Analysis narrative ──────────────────────────────── */}
                {result.analysisNarrative && (
                  <div style={{
                    background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginBottom: 16,
                    fontSize: 13, color: "#92400e", lineHeight: 1.6,
                  }}>
                    <strong style={{ display: "block", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>📊 Analysis</strong>
                    {result.analysisNarrative}
                  </div>
                )}

                {/* ── OA Comps with flags ─────────────────────────────── */}
                {result.oaComps?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      OA's Comparable Vehicles
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                      {result.oaComps.map((comp: any, i: number) => {
                        const flag = result.anchorFlags?.find((f: any) =>
                          f.compDescription?.toLowerCase().includes(comp.description?.substring(0, 10)?.toLowerCase())
                        );
                        const isFlagged = !!flag;
                        return (
                          <div key={i} style={{
                            padding: "10px 14px", borderBottom: i < result.oaComps.length - 1 ? "1px solid #e2e8f0" : "none",
                            background: isFlagged ? (flag?.severity === "major" ? "#fef2f2" : "#fffbeb") : "#fff",
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>
                                  {isFlagged && <span style={{ marginRight: 6 }}>{flag.severity === "major" ? "🚩" : "⚠️"}</span>}
                                  {comp.description}
                                </div>
                                {isFlagged && (
                                  <div style={{ fontSize: 12, color: flag.severity === "major" ? "#dc2626" : "#d97706", marginTop: 4, lineHeight: 1.5 }}>
                                    {flag.reason}
                                  </div>
                                )}
                                {comp.notes && !isFlagged && (
                                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{comp.notes}</div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(comp.price)}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{comp.mileage?.toLocaleString() || "??"} mi</div>
                                {flag && <div style={{ marginTop: 4 }}><SeverityBadge severity={flag.severity} /></div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Anchor flags detail ─────────────────────────────── */}
                {result.anchorFlags?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      Flagged Issues
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {result.anchorFlags.map((flag: any, i: number) => (
                        <div key={i} style={{
                          padding: "10px 14px", borderRadius: 8,
                          background: flag.severity === "major" ? "#fef2f2" : flag.severity === "moderate" ? "#fffbeb" : "#f0f9ff",
                          border: `1px solid ${flag.severity === "major" ? "#fca5a5" : flag.severity === "moderate" ? "#fcd34d" : "#7dd3fc"}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <SeverityBadge severity={flag.severity} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{flag.compDescription}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{flag.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Comp research from Grok ─────────────────────────── */}
                {result.compResearch && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      Comp Research (Grok-4 Live Search)
                    </div>
                    <div style={{
                      background: "#f0f9ff", border: "1px solid #7dd3fc", borderRadius: 8,
                      padding: "12px 16px", fontSize: 12, color: "#0f172a", lineHeight: 1.7, whiteSpace: "pre-wrap",
                    }}>
                      {result.compResearch}
                    </div>
                  </div>
                )}

                {/* ── Draft rebuttal ──────────────────────────────────── */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Draft Rebuttal Letter
                    </div>
                    <button
                      onClick={() => setEditedDraft(result.draftRebuttal)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                  </div>
                  <textarea
                    value={editedDraft}
                    onChange={e => setEditedDraft(e.target.value)}
                    style={{
                      width: "100%", minHeight: 320, padding: "14px 16px",
                      borderRadius: 8, border: "1px solid #e2e8f0",
                      fontSize: 13, lineHeight: 1.7, color: "#1e293b",
                      resize: "vertical", outline: "none", fontFamily: "Georgia, serif",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* ── Action buttons ──────────────────────────────────── */}
                {sendStatus && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                    background: sendStatus.startsWith("✅") ? "#f0fdf4" : "#eff6ff",
                    border: `1px solid ${sendStatus.startsWith("✅") ? "#86efac" : "#bfdbfe"}`,
                    fontSize: 13, color: sendStatus.startsWith("✅") ? "#16a34a" : "#1d4ed8",
                  }}>{sendStatus}</div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleSaveTask}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 8,
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <CheckCircle size={15} /> Save to Tasks
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(editedDraft); setSendStatus("📋 Copied to clipboard"); }}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 8,
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Copy size={15} /> Copy Letter
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={sending}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 8,
                      background: sending ? "#e2e8f0" : "#0f172a",
                      color: sending ? "#94a3b8" : "#fff",
                      border: "none", fontSize: 13, fontWeight: 700, cursor: sending ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Send size={15} /> {sending ? "Sending…" : selectedClaim?.ghlContactId ? "Send via GHL" : "Copy & Open GHL"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─────────── TASKS TAB ──────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                <CheckCircle size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 14 }}>No negotiation tasks yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tasks.map(task => {
                  const isExpanded = expandedTask === task._id;
                  const statusCfg = {
                    pending_review: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", label: "Pending Review" },
                    approved:       { bg: "#f0fdf4", border: "#86efac", color: "#166534", label: "Approved" },
                    sent:           { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", label: "Sent" },
                    dismissed:      { bg: "#f8fafc", border: "#cbd5e1", color: "#64748b", label: "Dismissed" },
                  }[task.status] || { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b", label: task.status };

                  return (
                    <div key={task._id} style={{
                      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden",
                    }}>
                      {/* Task header */}
                      <div
                        onClick={() => setExpandedTask(isExpanded ? null : task._id)}
                        style={{
                          padding: "14px 16px", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: isExpanded ? "#f8fafc" : "#fff",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                            {task.clientName} — {task.vehicleStr}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 12 }}>
                            {task.oaACV && <span>OA: {fmt(task.oaACV)}</span>}
                            {task.gap && <span style={{ color: task.gap > 0 ? "#16a34a" : "#dc2626" }}>Gap: {fmt(task.gap)}</span>}
                            {task.anchorFlags?.length ? <span style={{ color: "#d97706" }}>{task.anchorFlags.length} flags</span> : null}
                            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                            background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color,
                          }}>{statusCfg.label}</span>
                          {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                        </div>
                      </div>

                      {/* Expanded task detail */}
                      {isExpanded && (
                        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #e2e8f0" }}>
                          {task.analysis && (
                            <div style={{
                              background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "10px 12px",
                              fontSize: 12, color: "#92400e", lineHeight: 1.5, margin: "12px 0",
                            }}>
                              {task.analysis}
                            </div>
                          )}
                          {task.anchorFlags?.map((flag, i) => (
                            <div key={i} style={{
                              display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12,
                            }}>
                              <SeverityBadge severity={flag.severity} />
                              <span style={{ color: "#475569" }}><strong>{flag.compDescription}:</strong> {flag.reason}</span>
                            </div>
                          ))}
                          {task.draftRebuttal && (
                            <div style={{
                              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6,
                              padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "#1e293b",
                              whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", marginTop: 12,
                            }}>
                              {task.draftRebuttal}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            {task.status === "pending_review" && (
                              <button
                                onClick={() => updateTask({ id: task._id, status: "approved" })}
                                style={{ padding: "8px 16px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                ✓ Approve
                              </button>
                            )}
                            {(task.status === "pending_review" || task.status === "approved") && task.draftRebuttal && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(task.draftRebuttal!); setSendStatus("📋 Copied"); }}
                                style={{ padding: "8px 16px", borderRadius: 6, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                              >
                                <Copy size={12} /> Copy Letter
                              </button>
                            )}
                            <button
                              onClick={() => updateTask({ id: task._id, status: "dismissed" })}
                              style={{ padding: "8px 16px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
