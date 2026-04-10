"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Plus, Trash2, Copy, Check, Save, Search, ChevronDown, Cloud, CloudOff, ChevronUp, FileText, Award, Upload, Zap, Loader } from "lucide-react";
import { generateEmail, generateText } from "@/lib/masterPromptComms";

// ── Styles ───────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#334155",
  borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%",
  outline: "none", fontFamily: "inherit",
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase",
  letterSpacing: "0.08em", display: "block", marginBottom: 4,
};
const card: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #E2E8F0",
  borderRadius: 12, padding: 20, marginBottom: 16,
};
const sectionHead = (color = "#0F172A"): React.CSSProperties => ({
  fontSize: 12, fontWeight: 800, color, textTransform: "uppercase",
  letterSpacing: "0.1em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
});
const row: React.CSSProperties = { display: "flex", gap: 12, marginBottom: 12 };

const fmt  = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
// Normalize parsed name: "Last, First" → "First Last", capitalize words
const normalizeName = (raw: string) => {
  if (!raw) return "";
  const s = raw.includes(",") ? raw.split(",").map(p => p.trim()).reverse().join(" ") : raw;
  return s.replace(/\b\w/g, c => c.toUpperCase());
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, minWidth: 0 }}><label style={lbl}>{label}</label>{children}</div>;
}

interface Comp { description: string; url: string; askingPrice: number; compMileage: number; otherAdj: number; otherAdjNote: string; accepted: boolean; vin?: string; color?: string; transmission?: string; dealer?: string; location?: string; condition?: string; daysOnMarket?: string; screenshotCaptured?: boolean; }
interface AddRow { category: string; items: string; date: string; cost: number; depPct: number; }
const emptyComp = (): Comp => ({ description: "", url: "", askingPrice: 0, compMileage: 0, otherAdj: 0, otherAdjNote: "", accepted: true });
const emptyRow  = (): AddRow => ({ category: "", items: "", date: "", cost: 0, depPct: 0 });

// ── CC Context Dropdown ───────────────────────────────────────────────────────
function CCContextDropdown({ threadContext, onDismiss, onTargetSave }: {
  threadContext: any;
  onDismiss: () => void;
  onTargetSave: (val: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetEdit, setTargetEdit] = useState<string>(
    threadContext.targetValue != null ? String(threadContext.targetValue) : ""
  );
  const [saved, setSaved] = useState(false);

  // Parse structured summary
  let clientRequests: string[] = [];
  let happyWith: string | null = null;
  let callSummary: string | null = null;
  let vehicleNotes: string | null = null;
  try {
    const parsed = JSON.parse(threadContext.threadSummary || "{}");
    clientRequests = parsed.clientRequests || [];
    happyWith = parsed.happyWith || null;
    callSummary = parsed.callSummary || null;
    vehicleNotes = parsed.vehicleNotes || null;
  } catch {
    callSummary = typeof threadContext.threadSummary === "string" ? threadContext.threadSummary : null;
  }

  const handleTargetSave = () => {
    const n = targetEdit.trim() === "" ? null : parseFloat(targetEdit.replace(/[^0-9.]/g, ""));
    onTargetSave(isNaN(n as number) ? null : n);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const hasContent = clientRequests.length > 0 || happyWith || threadContext.targetValue != null || callSummary || vehicleNotes;

  return (
    <div style={{ borderBottom: "1px solid #bfdbfe", flexShrink: 0 }}>
      {/* Header row — always visible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: "#eff6ff", padding: "8px 24px",
          display: "flex", gap: 10, alignItems: "center", cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>🧠</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.4, flex: 1 }}>
          CC · Client Notes
          {clientRequests.length > 0 && (
            <span style={{ fontWeight: 500, color: "#3b82f6", marginLeft: 8, textTransform: "none" }}>
              · {clientRequests.length} request{clientRequests.length !== 1 ? "s" : ""}
            </span>
          )}
          {happyWith && (
            <span style={{ fontWeight: 500, color: "#059669", marginLeft: 8, textTransform: "none" }}>
              · happy with noted
            </span>
          )}
          {threadContext.targetValue != null && (
            <span style={{ fontWeight: 600, color: "#7c3aed", marginLeft: 8, textTransform: "none" }}>
              · target ${threadContext.targetValue.toLocaleString()}
            </span>
          )}
          {!hasContent && (
            <span style={{ fontWeight: 400, color: "#93c5fd", marginLeft: 8, textTransform: "none", fontStyle: "italic" }}>
              · no client notes found in recordings
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "#93c5fd", marginRight: 4 }}>{open ? "▲" : "▼"}</span>
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0 }}
        >×</button>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ background: "#f0f7ff", padding: "12px 24px 14px 24px", borderTop: "1px solid #dbeafe" }}>

          {/* Call Summary + Vehicle Notes — full width row */}
          {(callSummary || vehicleNotes) && (
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              {callSummary && (
                <div style={{ flex: 3, minWidth: 240, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>📞 Call Summary</div>
                  <p style={{ fontSize: 12, color: "#1e3a5f", lineHeight: 1.6, margin: 0 }}>{callSummary}</p>
                </div>
              )}
              {vehicleNotes && (
                <div style={{ flex: 2, minWidth: 180, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>🚗 Vehicle Notes</div>
                  <p style={{ fontSize: 12, color: "#0c4a6e", lineHeight: 1.6, margin: 0 }}>{vehicleNotes}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Client Requests */}
          <div style={{ flex: 2, minWidth: 220 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Client Requests
            </div>
            {clientRequests.length > 0
              ? <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {clientRequests.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>{r}</li>
                  ))}
                </ul>
              : <span style={{ fontSize: 12, color: "#93c5fd", fontStyle: "italic" }}>None noted in recordings</span>
            }
          </div>

          {/* Happy With */}
          <div style={{ flex: 2, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Would Be Happy With
            </div>
            {happyWith
              ? <span style={{ fontSize: 13, color: "#065f46", fontWeight: 600 }}>{happyWith}</span>
              : <span style={{ fontSize: 12, color: "#93c5fd", fontStyle: "italic" }}>Not stated</span>
            }
          </div>

          {/* Target Number */}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Target
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>$</span>
              <input
                value={targetEdit}
                onChange={e => setTargetEdit(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleTargetSave()}
                onClick={e => e.stopPropagation()}
                placeholder="e.g. 14500"
                style={{
                  ...inp, width: 110, fontSize: 13, fontWeight: 600,
                  color: "#6d28d9", border: "1px solid #c4b5fd",
                  background: "#faf5ff",
                }}
              />
              <button
                onClick={e => { e.stopPropagation(); handleTargetSave(); }}
                style={{
                  background: saved ? "#059669" : "#7c3aed", border: "none", borderRadius: 6,
                  color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer",
                }}
              >{saved ? "✓" : "Set"}</button>
            </div>
          </div>

          </div>{/* end flex row */}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, title, color = "#147EFA", children, defaultOpen = true, forceCollapsed }: {
  id: string; title: string; color?: string; children: React.ReactNode; defaultOpen?: boolean; forceCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceCollapsed ? false : open;
  return (
    <div id={id} style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: isOpen ? "10px 10px 0 0" : 10,
        padding: "12px 20px", cursor: "pointer", borderBottom: isOpen ? "none" : undefined,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 16, background: color, borderRadius: 2 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        </div>
        {isOpen ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
      </button>
      {isOpen && (
        <div className="mc-wb-section" style={{ border: "1px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "20px 20px 8px", background: "#FFFFFF", marginBottom: 16 }}>
          {children}
        </div>
      )}
      {!isOpen && <div style={{ marginBottom: 16 }} />}
    </div>
  );
}

// ── AI Image Analysis result renderer ────────────────────────────────────
function AiImageResult({ result, mode }: { result: any; mode: string }) {
  if (!result) return null;
  if (result.error) return <div style={{ fontSize: 12, color: "#ef4444" }}>{result.error}</div>;
  if (result.raw) return <pre style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-wrap", margin: 0 }}>{result.raw.slice(0, 800)}</pre>;

  const rows: [string, any][] = Object.entries(result).filter(([k]) => !["raw"].includes(k));

  const fmt = (val: any): string => {
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object" && val !== null) return Object.entries(val).map(([k,v]) => `${k}: ${v}`).join(" · ");
    return String(val);
  };

  const highlights: Record<string, { color: string; bg: string }> = {
    severity:         { color: "#dc2626", bg: "#fef2f2" },
    structuralConcerns: { color: "#dc2626", bg: "#fef2f2" },
    dvImpact:         { color: "#FF8600", bg: "#fff7ed" },
    totalAmount:      { color: "#16a34a", bg: "#f0fdf4" },
    supplementNeeded: { color: "#d97706", bg: "#fffbeb" },
    accidentCount:    { color: "#dc2626", bg: "#fef2f2" },
    discrepancies:    { color: "#dc2626", bg: "#fef2f2" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map(([key, val]) => {
        const hi = highlights[key];
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
        return (
          <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 6px", borderRadius: 4, background: hi?.bg || "transparent" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: hi?.color || "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, width: 130, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 11, color: hi?.color || "#334155", flex: 1 }}>{fmt(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ACVWorkbench() {
  // ── Case Selector / Convex Sync ─────────────────────────────────────────
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch]           = useState("");
  const [showCasePicker, setShowCasePicker]   = useState(false);
  const [syncStatus, setSyncStatus]           = useState<"saved"|"saving"|"unsaved"|"idle">("idle");
  const saveToConvex       = useMutation(api.valuations.upsert);
  const generateUploadUrl  = useMutation(api.caseAttachments.generateUploadUrl);
  const saveAttachment     = useMutation(api.caseAttachments.save);
  const removeAttachment   = useMutation(api.caseAttachments.remove);
  const caseAttachments    = useQuery(api.caseAttachments.listByClaim,
    selectedClaimId ? { claimId: selectedClaimId } : "skip") ?? [];
  const activeClaims = useQuery(api.claims.list, {});
  const existingVal  = useQuery(api.valuations.getByClaimId,
    selectedClaimId ? { claimId: selectedClaimId, claimType: "ACV" } : "skip");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Intake ──────────────────────────────────────────────────────────────
  const [carrier, setCarrier]               = useState("");
  const [claimNumber, setClaimNumber]       = useState("");
  const [examiner, setExaminer]             = useState("");
  const [dateOfLoss, setDateOfLoss]         = useState("");
  const [purpose, setPurpose]               = useState("Appraisal Clause");
  const [dateOfAppraisal, setDateOfAppraisal] = useState("");
  const [ownerName, setOwnerName]           = useState("");
  const [ownerAddress, setOwnerAddress]     = useState("");
  const [ownerCSZ, setOwnerCSZ]             = useState("");
  const [insuredAppraiser, setInsuredAppraiser] = useState("Johnny Walker");
  const [insurerAppraiser, setInsurerAppraiser] = useState("");
  const [umpire, setUmpire]                 = useState("");
  const [vehYear, setVehYear]               = useState("");
  const [vehMake, setVehMake]               = useState("");
  const [vehModel, setVehModel]             = useState("");
  const [vehTrim, setVehTrim]               = useState("");
  const [vehPackages, setVehPackages]       = useState("");
  const [vin, setVin]                       = useState("");
  const [mileage, setMileage]               = useState(0);
  const [insurerStarting, setInsurerStarting] = useState(0);
  const [opposingAmount, setOpposingAmount] = useState(0);
  const [clientEstimate, setClientEstimate] = useState(0);
  const [appraiserName, setAppraiserName]   = useState("Johnny Walker");
  const [brandName, setBrandName]           = useState("Claims.Coach");
  const [appEmail, setAppEmail]             = useState("johnny@claims.coach");
  const [appWebsite, setAppWebsite]         = useState("www.claims.coach");
  const [tagline, setTagline]               = useState("Helping Insureds Get What They Deserve.");

  // ── Communications ────────────────────────────────────────────────────────
  const [toneOverride, setToneOverride] = useState<'strong_win' | 'modest' | 'mixed' | 'disappointing' | null>(null);

  // ── Comparables ─────────────────────────────────────────────────────────
  const [mileageRate, setMileageRate] = useState(0.02);
  const [comps, setComps]             = useState<Comp[]>([emptyComp(), emptyComp(), emptyComp(), emptyComp(), emptyComp()]);
  const updateComp = (i: number, k: keyof Comp, v: string | number | boolean) =>
    setComps(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const compMileAdj  = (c: Comp) => c.askingPrice > 0 ? (mileage - c.compMileage) * mileageRate : 0;
  const compAdjusted = (c: Comp) => c.askingPrice > 0 ? c.askingPrice + compMileAdj(c) + c.otherAdj : 0;
  const filledComps  = comps.filter(c => c.askingPrice > 0 && c.accepted !== false);
  const compAvg      = filledComps.length > 0 ? filledComps.reduce((s, c) => s + compAdjusted(c), 0) / filledComps.length : 0;

  // ── Add-Ons ─────────────────────────────────────────────────────────────
  const [maintRows, setMaintRows]   = useState<AddRow[]>([emptyRow()]);
  const [afterRows, setAfterRows]   = useState<AddRow[]>([emptyRow()]);
  const [updNotes, setUpdNotes]     = useState("");
  const [updAmount, setUpdAmount]   = useState(0);
  const [condNotes, setCondNotes]   = useState("");
  const [condAmount, setCondAmount] = useState(0);
  const netVal       = (r: AddRow) => r.cost * (1 - r.depPct / 100);
  const maintTotal   = maintRows.reduce((s, r) => s + netVal(r), 0);
  const afterTotal   = afterRows.reduce((s, r) => s + netVal(r), 0);
  const updateRow = (setter: React.Dispatch<React.SetStateAction<AddRow[]>>, i: number, k: keyof AddRow, v: string | number) =>
    setter(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  // ── Summary ──────────────────────────────────────────────────────────────
  const [taxRate, setTaxRate]     = useState(9.4);
  const [titleFees, setTitleFees] = useState(0);
  const [unusedReg, setUnusedReg] = useState(0);
  const [deductible, setDeductible] = useState(0);
  const netValue     = compAvg + maintTotal + afterTotal - Math.abs(updAmount) + condAmount;
  const vehicularTax = netValue * (taxRate / 100);
  const totalAward   = netValue + vehicularTax + (titleFees || 0) + (unusedReg || 0) - (deductible || 0);

  // ── Results & Comms ──────────────────────────────────────────────────────
  const [acvAward, setAcvAward]             = useState(0);
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [awardDate, setAwardDate]           = useState(new Date().toISOString().split("T")[0]);
  const [clientFirst, setClientFirst]       = useState("");
  const [generatingAward, setGeneratingAward] = useState(false);
  const [awardFormResult, setAwardFormResult] = useState<string | null>(null);
  const [genEmail, setGenEmail]             = useState("");
  const [genText, setGenText]               = useState("");
  const [generating, setGenerating]         = useState(false);
  const [genDemand, setGenDemand]           = useState("");
  const [genRebuttal, setGenRebuttal]       = useState("");
  const [generatingDemand, setGeneratingDemand]     = useState(false);
  const [generatingRebuttal, setGeneratingRebuttal] = useState(false);
  const [generatingBundle, setGeneratingBundle]     = useState(false);
  const [aiImgAnalysis, setAiImgAnalysis]           = useState<{ loading: boolean; result: any; mode: string } | null>(null);
  const [threadContext,  setThreadContext]           = useState<any>(null);
  const updateClaim = useMutation(api.claims.update);
  const [copied, setCopied]                 = useState<string | null>(null);
  const [sendingComms, setSendingComms]     = useState(false);
  const [commsSentResult, setCommsSentResult] = useState<string | null>(null);
  const [allCollapsed, setAllCollapsed]     = useState(false);
  const [savingDrive, setSavingDrive]       = useState(false);
  const [driveResult, setDriveResult]       = useState<string | null>(null);
  const [awardId, setAwardId]               = useState<string | null>(null);
  const [sendingSig, setSendingSig]         = useState(false);
  const [sigSentResult, setSigSentResult]   = useState<string | null>(null);
  const copyText = async (text: string, key: string) => { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };

  const increase        = acvAward - insurerStarting;
  const salesTaxInc     = increase * (taxRate / 100);
  const totalIncrease   = increase + salesTaxInc;
  const pctIncrease     = insurerStarting > 0 ? (increase / insurerStarting) * 100 : 0;
  const potentialPayment = acvAward + (acvAward * taxRate / 100) + (titleFees || 0) + (unusedReg || 0) - (deductible || 0);

  // ── PDF Evaluation Parser ────────────────────────────────────────────────
  const [parsingPDF, setParsingPDF]       = useState(false);
  const [parseResult, setParseResult]     = useState<string | null>(null);
  const pdfInputRef                       = useRef<HTMLInputElement>(null);

  const handleParsePDF = async (file: File) => {
    setParsingPDF(true);
    setParseResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/parse-evaluation", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "SCANNED_PDF") {
          setParseResult(`📷 Scanned PDF — ${data.message}`);
        } else {
          setParseResult(`Error: ${data.error || data.message || "Unknown error"}`);
        }
        return;
      }
      if (!data.fields || data.fieldCount === 0) {
        setParseResult(`⚠️ PDF uploaded but no fields extracted (source: ${data.source || "unknown"}). Vision model may not support this PDF type.`);
        return;
      }
      const f = data.fields;
      if (f.carrier)             setCarrier(f.carrier);
      if (f.claimNumber)         setClaimNumber(f.claimNumber);
      if (f.adjusterName)        setExaminer(f.adjusterName);
      if (f.dateOfLoss)          setDateOfLoss(f.dateOfLoss);
      if (f.dateOfReport)        setDateOfAppraisal(f.dateOfReport);
      if (f.ownerName)           setOwnerName(normalizeName(f.ownerName));
      if (f.ownerAddress)        setOwnerAddress(f.ownerAddress);
      if (f.ownerCSZ)            setOwnerCSZ(f.ownerCSZ);
      if (f.vehYear)             setVehYear(f.vehYear);
      if (f.vehMake)             setVehMake(f.vehMake);
      if (f.vehModel)            setVehModel(f.vehModel);
      if (f.vehTrim)             setVehTrim(f.vehTrim);
      if (f.vehPackages)         setVehPackages(f.vehPackages);
      if (f.vin)                 setVin(f.vin);
      if (f.mileage)             setMileage(f.mileage);
      if (f.insurerStartingOffer) setInsurerStarting(f.insurerStartingOffer);
      if (f.taxRate)             setTaxRate(f.taxRate);
      if (f.titleFees)           setTitleFees(f.titleFees);
      if (f.unusedReg)           setUnusedReg(f.unusedReg);
      if (f.deductible)          setDeductible(f.deductible);
      setParseResult(`✓ Auto-filled ${data.fieldCount} fields from PDF`);
      setSyncStatus("unsaved");
      triggerAutoSave();
    } catch { setParseResult("Error — could not reach parse API"); }
    setParsingPDF(false);
  };

  // ── AI Comp Finder ───────────────────────────────────────────────────────
  const [findingComps, setFindingComps]   = useState(false);
  const [compFindResult, setCompFindResult] = useState<string | null>(null);

  const handleFindComps = async () => {
    if (!vehYear || !vehMake || !vehModel) { setCompFindResult("Enter vehicle year, make, and model first"); return; }
    setFindingComps(true);
    setCompFindResult(null);
    try {
      // Parse state from ownerCSZ ("Tacoma, WA 98409" → "WA") or ownerAddress
      const cszParts = ownerCSZ?.match(/,\s*([A-Z]{2})\s*\d/);
      const subjectState = cszParts?.[1] || undefined;
      const cszCity = ownerCSZ?.split(",")?.[0]?.trim() || undefined;
      const res  = await fetch("/api/find-comps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: vehYear, make: vehMake, model: vehModel, trim: vehTrim, packages: vehPackages, mileage, state: subjectState, city: cszCity, clientEstimate: clientEstimate || undefined, insurerOffer: insurerStarting || undefined }) });
      const data = await res.json();
      if (!res.ok || data.error) { setCompFindResult(`Error: ${data.error}`); return; }
      const newComps = data.comps as { description: string; url: string; askingPrice: number; compMileage: number }[];
      if (newComps.length === 0) { setCompFindResult("No listings found — try fewer trim details or enter comps manually"); return; }
      // Fill empty slots first; if all slots are filled, append new comps
      const updated = [...comps];
      let filled = 0;
      for (const nc of newComps) {
        const emptyIdx = updated.findIndex(c => !c.askingPrice && !c.description);
        if (emptyIdx !== -1) {
          updated[emptyIdx] = { description: nc.description, url: nc.url, askingPrice: nc.askingPrice, compMileage: nc.compMileage, otherAdj: 0, otherAdjNote: "", accepted: true };
        } else {
          updated.push({ description: nc.description, url: nc.url, askingPrice: nc.askingPrice, compMileage: nc.compMileage, otherAdj: 0, otherAdjNote: "", accepted: true });
        }
        filled++;
      }
      setComps(updated);
      setCompFindResult(`✓ Found ${newComps.length} comps — ${data.methodology}`);
      triggerAutoSave();
    } catch { setCompFindResult("Error — could not reach find-comps API"); }
    setFindingComps(false);
  };

  // ── Invoice Parser ───────────────────────────────────────────────────────
  const [parsingInvoice, setParsingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult]   = useState<string | null>(null);
  const invoiceInputRef                     = useRef<HTMLInputElement>(null);
  const [invoiceTarget, setInvoiceTarget]   = useState<"maint" | "after">("maint");

  const handleParseInvoice = async (file: File, target: "maint" | "after") => {
    setParsingInvoice(true);
    setInvoiceResult(null);
    // Also save to Convex storage if case is loaded
    if (selectedClaimId) {
      try {
        const uploadUrl = await generateUploadUrl();
        await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const storageId = new URL(uploadUrl).pathname.split("/").pop()!;
        await saveAttachment({ claimId: selectedClaimId, section: target === "maint" ? "maintenance" : "aftermarket", fileName: file.name, mimeType: file.type, storageId, sizeBytes: file.size });
      } catch (e) { console.error("Storage save failed", e); }
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/parse-invoice", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) { setInvoiceResult(`Error: ${data.error}`); return; }
      const items = data.items as { category: string; items: string; date: string; cost: number; depPct: number }[];
      if (target === "maint") setMaintRows(r => [...r.filter(x => x.category || x.items || x.cost), ...items]);
      else                    setAfterRows(r => [...r.filter(x => x.category || x.items || x.cost), ...items]);
      setInvoiceResult(`✓ Added ${items.length} line item${items.length !== 1 ? "s" : ""}${selectedClaimId ? " · saved to case" : " (load case to save)"}`);
      triggerAutoSave();
    } catch { setInvoiceResult("Error parsing invoice"); }
    setParsingInvoice(false);
  };

  // ── Convex load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!existingVal?.workbenchData) return;
    try {
      const s = JSON.parse(existingVal.workbenchData);
      if (s.carrier !== undefined)          setCarrier(s.carrier);
      if (s.claimNumber !== undefined)      setClaimNumber(s.claimNumber);
      if (s.examiner !== undefined)         setExaminer(s.examiner);
      if (s.dateOfLoss !== undefined)       setDateOfLoss(s.dateOfLoss);
      if (s.ownerName !== undefined)        setOwnerName(s.ownerName);
      if (s.ownerAddress !== undefined)     setOwnerAddress(s.ownerAddress);
      if (s.ownerCSZ !== undefined)         setOwnerCSZ(s.ownerCSZ);
      if (s.insuredAppraiser !== undefined) setInsuredAppraiser(s.insuredAppraiser);
      if (s.insurerAppraiser !== undefined) setInsurerAppraiser(s.insurerAppraiser);
      if (s.umpire !== undefined)           setUmpire(s.umpire);
      if (s.vehYear !== undefined)          setVehYear(s.vehYear);
      if (s.vehMake !== undefined)          setVehMake(s.vehMake);
      if (s.vehModel !== undefined)         setVehModel(s.vehModel);
      if (s.vehTrim !== undefined)          setVehTrim(s.vehTrim);
      if (s.vehPackages !== undefined)      setVehPackages(s.vehPackages);
      if (s.vin !== undefined)              setVin(s.vin);
      if (s.mileage !== undefined)          setMileage(s.mileage);
      if (s.insurerStarting !== undefined)  setInsurerStarting(s.insurerStarting);
      if (s.opposingAmount !== undefined)   setOpposingAmount(s.opposingAmount);
      if (s.clientEstimate !== undefined)   setClientEstimate(s.clientEstimate);
      if (s.mileageRate !== undefined)      setMileageRate(s.mileageRate);
      if (s.comps !== undefined)            setComps(s.comps);
      if (s.maintRows !== undefined)        setMaintRows(s.maintRows);
      if (s.afterRows !== undefined)        setAfterRows(s.afterRows);
      if (s.updAmount !== undefined)        setUpdAmount(s.updAmount);
      if (s.condAmount !== undefined)       setCondAmount(s.condAmount);
      if (s.taxRate !== undefined)          setTaxRate(s.taxRate);
      if (s.titleFees !== undefined)        setTitleFees(s.titleFees);
      if (s.unusedReg !== undefined)        setUnusedReg(s.unusedReg);
      if (s.deductible !== undefined)       setDeductible(s.deductible);
      if (s.acvAward !== undefined)         setAcvAward(s.acvAward);
      if (s.investmentAmount !== undefined) setInvestmentAmount(s.investmentAmount);
      setSyncStatus("saved");
    } catch {}
  }, [existingVal]);

  // ── GHL eval URL auto-detect ─────────────────────────────────────────────
  const [ghlEvalUrl, setGhlEvalUrl]         = useState<string | null>(null);
  const [ghlAllDocs, setGhlAllDocs]         = useState<Array<{name: string; url: string; type: string}>>([]);
  const [autoParseStatus, setAutoParseStatus] = useState<string | null>(null);

  const loadClaimData = async (claim: any) => {
    // ── Reset ALL workbench state first so nothing bleeds between cases ──
    setCarrier(""); setClaimNumber(""); setExaminer(""); setDateOfLoss("");
    setDateOfAppraisal(""); setPurpose("Appraisal Clause");
    setOwnerName(""); setOwnerAddress(""); setOwnerCSZ("");
    setInsuredAppraiser("Johnny Walker"); setInsurerAppraiser(""); setUmpire("");
    setVehYear(""); setVehMake(""); setVehModel(""); setVehTrim(""); setVehPackages("");
    setVin(""); setMileage(0); setInsurerStarting(0); setOpposingAmount(0); setClientEstimate(0);
    setMileageRate(0.02);
    setComps([emptyComp(), emptyComp(), emptyComp()]);
    setMaintRows([emptyRow()]); setAfterRows([emptyRow()]);
    setUpdNotes(""); setUpdAmount(0); setCondNotes(""); setCondAmount(0);
    setTaxRate(9.4); setTitleFees(0); setUnusedReg(0); setDeductible(0);
    setAcvAward(0); setInvestmentAmount(0);
    setParseResult(null); setCompFindResult(null); setInvoiceResult(null);
    setAutoParseStatus(null);

    // ── Then populate from GHL/Convex claim data ─────────────────────────
    if (claim.clientName)    setOwnerName(normalizeName(claim.clientName));
    if (claim.insurer)       setCarrier(claim.insurer);
    if (claim.adjusterName)  setExaminer(claim.adjusterName);
    if (claim.vin && claim.vin !== "UNKNOWN") setVin(claim.vin);
    if (claim.year)          setVehYear(String(claim.year));
    if (claim.make)          setVehMake(claim.make);
    if (claim.model)         setVehModel(claim.model);
    if (claim.trim)          setVehTrim(claim.trim);
    if (claim.mileage)       setMileage(claim.mileage);
    if (claim.openingOffer)  setInsurerStarting(claim.openingOffer);
    // Address & contact from GHL
    if (claim.address1)      setOwnerAddress(claim.address1);
    if (claim.city || claim.state || claim.postalCode) {
      setOwnerCSZ([claim.city, claim.state, claim.postalCode].filter(Boolean).join(", "));
    }
    // Phone/email — store in notes field so they're visible in the workbench
    const contactInfo = [claim.phone, claim.email].filter(Boolean).join(" · ");
    if (contactInfo && !claim.insurer) {
      // Only pre-fill examiner field with contact info if no adjuster name
    }
    // Check for insurer eval uploaded to GHL
    const docs = (claim.documents || []).filter((d: any) => d.url);
    setGhlAllDocs(docs);
    const estDoc = docs.find((d: any) => d.type === "estimate") || docs[0];
    setGhlEvalUrl(estDoc?.url ?? null);
    setSelectedClaimId(claim._id);
    setShowCasePicker(false);
    setSyncStatus("unsaved");
    setThreadContext(null);
    // ── Contextual Threading — load case context in background ───────────
    fetch("/api/case-context", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId: claim._id }),
    }).then(r => r.json()).then(ctx => {
      if (ctx.threadSummary) setThreadContext(ctx);
    }).catch(() => {});
    // ── Auto-fetch investment amount from GHL invoice ────────────────────
    if (claim.ghlContactId) {
      try {
        const invRes = await fetch(`/api/ghl-invoice?contactId=${claim.ghlContactId}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.amount > 0) setInvestmentAmount(invData.amount);
        }
      } catch { /* silent — investment field still manually editable */ }
    }
  };

  const handleAutoParseGHL = async (overrideUrl?: string) => {
    const urlToUse = overrideUrl || ghlEvalUrl;
    if (!urlToUse) return;
    if (overrideUrl) setGhlEvalUrl(overrideUrl);
    setParsingPDF(true);
    setAutoParseStatus("Fetching & parsing…");
    setParseResult(null);
    try {
      const res  = await fetch("/api/parse-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToUse, ghlAuth: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAutoParseStatus(`⚠️ ${data.error || "Could not parse"}`);
        setParsingPDF(false);
        return;
      }
      if (!data.fields || data.fieldCount === 0) {
        setAutoParseStatus("⚠️ File parsed but no eval fields found — may not be a CCC valuation");
        setParsingPDF(false);
        return;
      }
      const f = data.fields;
      if (f.carrier)              setCarrier(f.carrier);
      if (f.claimNumber)          setClaimNumber(f.claimNumber);
      if (f.adjusterName)         setExaminer(f.adjusterName);
      if (f.dateOfLoss)           setDateOfLoss(f.dateOfLoss);
      if (f.dateOfReport)         setDateOfAppraisal(f.dateOfReport);
      if (f.ownerName)            setOwnerName(normalizeName(f.ownerName));
      if (f.ownerAddress)         setOwnerAddress(f.ownerAddress);
      if (f.ownerCSZ)             setOwnerCSZ(f.ownerCSZ);
      if (f.vehYear)              setVehYear(f.vehYear);
      if (f.vehMake)              setVehMake(f.vehMake);
      if (f.vehModel)             setVehModel(f.vehModel);
      if (f.vehTrim)              setVehTrim(f.vehTrim);
      if (f.vehPackages)          setVehPackages(f.vehPackages);
      if (f.vin)                  setVin(f.vin);
      if (f.mileage)              setMileage(f.mileage);
      if (f.insurerStartingOffer) setInsurerStarting(f.insurerStartingOffer);
      if (f.taxRate)              setTaxRate(f.taxRate);
      if (f.titleFees)            setTitleFees(f.titleFees);
      if (f.unusedReg)            setUnusedReg(f.unusedReg);
      if (f.deductible)           setDeductible(f.deductible);
      setAutoParseStatus(`✓ Auto-filled ${data.fieldCount} fields from GHL eval (source: ${data.source})`);
      setGhlEvalUrl(null); // dismiss banner
      setSyncStatus("unsaved");
      triggerAutoSave();
    } catch {
      setAutoParseStatus("Error — could not reach parse API");
    }
    setParsingPDF(false);
  };

  // Use a ref to always hold the latest state snapshot for auto-save
  // (avoids stale closure bug where setTimeout captures old values)
  const latestStateRef = useRef<Record<string, unknown>>({});
  latestStateRef.current = {
    carrier, claimNumber, examiner, dateOfLoss, ownerName, ownerAddress, ownerCSZ,
    insuredAppraiser, insurerAppraiser, umpire,
    vehYear, vehMake, vehModel, vehTrim, vehPackages, vin, mileage,
    insurerStarting, opposingAmount, clientEstimate, mileageRate, comps,
    maintRows, afterRows, updNotes, updAmount, condNotes, condAmount,
    taxRate, titleFees, unusedReg, deductible, acvAward, investmentAmount,
  };
  const selectedClaimIdRef = useRef(selectedClaimId);
  selectedClaimIdRef.current = selectedClaimId;
  const netValueRef = useRef(netValue);
  netValueRef.current = netValue;

  const triggerAutoSave = () => {
    if (!selectedClaimIdRef.current) return;
    setSyncStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const claimId   = selectedClaimIdRef.current;
      const state     = latestStateRef.current;
      const nv        = netValueRef.current;
      const insOffer  = (state.insurerStarting as number) || undefined;
      if (!claimId) return;
      try {
        await saveToConvex({
          claimId, claimType: "ACV",
          insurerOffer: insOffer,
          calculatedACV: nv || undefined,
          acvGap: nv && insOffer ? nv - insOffer : undefined,
          workbenchData: JSON.stringify(state),
        });
        setSyncStatus("saved");
      } catch { setSyncStatus("unsaved"); }
    }, 2000);
  };

  const handleGenerateAwardForm = async () => {
    if (!acvAward) return;
    setGeneratingAward(true);
    setAwardFormResult(null);
    try {
      const clientName  = clientFirst || normalizeName(ownerName).split(" ")[0] || ownerName;
      const displayDate = awardDate ? new Date(awardDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const vehicleStr  = [vehYear, vehMake, vehModel, vehTrim].filter(Boolean).join(" ");
      const res = await fetch("/api/award-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: normalizeName(ownerName) || clientName,
          carrier, claimNumber, dateOfLoss, awardDate: displayDate,
          vehicle: vehicleStr, vin, acvAward,
          insuredAppraiser, insurerAppraiser, umpire,
          // Send via ORCA if opposing appraiser contact exists
          sendViaOrca: !!insurerAppraiser,
        }),
      });
      const data = await res.json();
      if (data.pdf) {
        // Download the PDF
        const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/pdf" });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement("a");
        a.href = url; a.download = `ACV_Award_${claimNumber || "draft"}.pdf`; a.click();
        URL.revokeObjectURL(url);
        if (data.awardId) setAwardId(data.awardId);
        setSigSentResult(null);
        setAwardFormResult(`✓ PDF downloaded`);
      } else {
        setAwardFormResult(data.error || "Error generating award form");
      }
    } catch { setAwardFormResult("Error — could not generate award form"); }
    setGeneratingAward(false);
  };

  const stripMd = (s: string) => s
    .split("\n").filter(l => !l.trim().match(/^\|.*\|/) && !l.trim().match(/^[-|:]+$/)).join("\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[\-\*•]\s+/gm, "")
    .replace(/^---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const handleSendComms = async () => {
    const claim = (activeClaims as any[])?.find((c: any) => c._id === selectedClaimId);
    if (!selectedClaimId) {
      setCommsSentResult("⚠️ No case loaded. Select a case first.");
      return;
    }
    if (!claim?.ghlContactId) {
      setCommsSentResult("⚠️ No GHL contact linked to this case.");
      return;
    }
    setSendingComms(true);
    setCommsSentResult(null);

    // Strip any "EMAIL", "Subject: ...", "TEXT MESSAGE" header lines Claude may have left
    const cleanEmail = (genEmail || "")
      .replace(/^EMAIL\s*\n/i, "")
      .replace(/^Subject:.*\n/im, "")
      .replace(/^TEXT MESSAGE\s*\n/i, "")
      .trim();
    const cleanText = (genText || "")
      .replace(/^TEXT MESSAGE\s*\n/i, "")
      .replace(/^EMAIL\s*\n/i, "")
      .trim();

    try {
      const res = await fetch("/api/send-comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: claim.ghlContactId,
          email: claim.email || "",
          phone: claim.phone || "",
          clientName: clientFirst || normalizeName(ownerName).split(" ")[0] || ownerName,
          emailBody: cleanEmail,
          textBody: cleanText,
          subject: `Appraisal Clause Success — ${fmt(totalIncrease)} Increase Secured!`,
          claimNumber,
          clientLastName: normalizeName(ownerName).split(" ").pop() || "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const emailOk = data.results?.email?.messageId || data.results?.email?.ok;
        const smsOk   = data.results?.sms?.messageId   || data.results?.sms?.ok;
        setCommsSentResult(
          `✓ Sent! ${emailOk ? "Email ✓" : "Email ✗"}  ${smsOk ? "SMS ✓" : (claim.phone ? "SMS ✗" : "SMS skipped (no phone)")}`,
        );
      } else {
        setCommsSentResult(`✗ Error: ${data.error || JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setCommsSentResult(`✗ Network error: ${e.message}`);
    }
    setSendingComms(false);
  };

  const handleGenComms = async () => {
    setGenerating(true);
    const clientName = clientFirst || normalizeName(ownerName).split(" ")[0] || ownerName || "there";
    try {
      // Use hardened Master Prompt generator
      const email = generateEmail({
        clientFirstName: clientName,
        originalOffer: insurerStarting || 0,
        finalAppraisedValue: acvAward || 0,
        vehicularTax: vehicularTax || 0,
        titleRegFees: titleFees || undefined,
        unusedRegCredit: unusedReg || undefined,
        investmentAmount: investmentAmount || 0,
        carrierName: carrier || "the insurance carrier",
        appraiserName: appraiserName || "Johnny Walker",
        vin: vin || undefined,
        year: vehYear || undefined,
        make: vehMake || undefined,
        model: vehModel || undefined,
        claimNumber: claimNumber || undefined,
      });

      const sms = generateText({
        clientFirstName: clientName,
        originalOffer: insurerStarting || 0,
        finalAppraisedValue: acvAward || 0,
        vehicularTax: vehicularTax || 0,
        investmentAmount: investmentAmount || 0,
        carrierName: carrier || "the insurance carrier",
        appraiserName: appraiserName || "Johnny Walker",
        vin: vin || undefined,
        year: vehYear || undefined,
        make: vehMake || undefined,
        model: vehModel || undefined,
        claimNumber: claimNumber || undefined,
      });

      // Use hardened generator directly (no API needed)
      setGenEmail(email);
      setGenText(sms);
    } catch (e: any) { setGenEmail("Error: " + (e.message || "unknown error")); }
    setGenerating(false);
  };

  const handleGenDemand = async () => {
    setGeneratingDemand(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Generate a professional demand letter. Plain text only — no markdown, no asterisks, no bold symbols.\n\nFrom: ${appraiserName}, Claims.Coach, Phone: (425) 585-2622, Email: johnny@claims.coach\nTo: ${carrier || "Insurance Carrier"}\nRe: Claim ${claimNumber || "—"} — ${vehYear} ${vehMake} ${vehModel} ${vehTrim}, VIN: ${vin}, ${mileage.toLocaleString()} miles\nInsurer offer: ${fmt(insurerStarting)}. Our documented ACV: ${fmt(netValue)}. Total award with fees: ${fmt(totalAward)}.\n\nWrite a firm but professional demand letter requesting the carrier honor the appraisal result. Reference the appraisal clause. Close with signature block using the exact contact info above.` }) });
      const data = await res.json();
      setGenDemand(stripMd(data.content));
    } catch { setGenDemand("Error — check API key"); }
    setGeneratingDemand(false);
  };

  const handleGenRebuttal = async () => {
    setGeneratingRebuttal(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Generate a Rebuttal Report for Claims.Coach. Plain text only, no markdown, no asterisks, no bold.\n\nFrom: ${appraiserName}, Claims.Coach, Phone: (425) 585-2622, Email: johnny@claims.coach\nClaim ${claimNumber}, Vehicle: ${vehYear} ${vehMake} ${vehModel}, VIN: ${vin}. Carrier: ${carrier}, offer ${fmt(insurerStarting)}, opposing appraisal ${fmt(opposingAmount)}. Comps: ${filledComps.map((c,i)=>`C${i+1}: ${c.description} ${fmt(c.askingPrice)} adj: ${fmt(compAdjusted(c))}`).join("; ")}. Net ACV: ${fmt(netValue)}. Tax (${taxRate}%): ${fmt(vehicularTax)}. Total: ${fmt(totalAward)}. WAC 284-30-391 compliant. Professional, factual tone. Close with the exact contact info above.` }) });
      const data = await res.json();
      setGenRebuttal(stripMd(data.content));
    } catch { setGenRebuttal("Error — check API key"); }
    setGeneratingRebuttal(false);
  };

  // ── File Upload Handler ──────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null, section: "maintenance" | "aftermarket" | "photo") => {
    if (!files || !selectedClaimId) return;
    for (const file of Array.from(files)) {
      try {
        const uploadUrl = await generateUploadUrl();
        await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const storageId = new URL(uploadUrl).pathname.split("/").pop()!;
        await saveAttachment({ claimId: selectedClaimId, section, fileName: file.name, mimeType: file.type, storageId, sizeBytes: file.size });
      } catch (e) { console.error("Upload failed", e); }
    }
  };

  // ── ACV Bundle Generator ─────────────────────────────────────────────────
  const handleGenerateBundle = async () => {
    // Enforce minimum 2 accepted comps
    const acceptedCount = comps.filter(c => c.askingPrice > 0 && c.accepted !== false).length;
    if (acceptedCount < 2) {
      alert(`⚠️ Bundle requires at least 2 comparable vehicles.\n\nYou have ${acceptedCount === 0 ? "none" : "only 1"} accepted comp. Use "Find Comps" to add more, or manually enter at least one more comp before generating.`);
      return;
    }
    setGeneratingBundle(true);
    try {
      const state = { ...latestStateRef.current, claimId: selectedClaimId };
      const res = await fetch("/api/generate-acv-bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!res.ok) { alert("Bundle generation failed: " + await res.text()); return; }
      const blob = await res.blob();
      const veh = [vehYear, vehMake, vehModel].filter(Boolean).join("_");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ACV_Bundle_${(claimNumber || "DRAFT").replace(/[^a-zA-Z0-9-]/g, "_")}_${veh}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert("Bundle error: " + e); }
    setGeneratingBundle(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <div className="mc-wb-flow" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Sticky Header */}
      <div className="mc-wb-header mc-wb-sticky" style={{ background: "#FFFFFF", padding: "10px 24px", flexShrink: 0, borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/workbench" style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#147EFA" }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "0.02em" }}>ACV Workbench</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#EFF6FF", color: "#147EFA", border: "1px solid #BFDBFE" }}>Appraisal Clause</span>
          </div>
          {(claimNumber || ownerName) && (
            <span style={{ fontSize: 12, color: "#94A3B8", borderLeft: "1px solid #E2E8F0", paddingLeft: 14 }}>
              {claimNumber && <span style={{ color: "#64748B" }}>#{claimNumber}</span>}
              {ownerName && <span style={{ color: "#0F172A", fontWeight: 600, marginLeft: 8 }}>{ownerName}</span>}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {netValue > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#FF8600", background: "#FFF7ED", padding: "4px 14px", borderRadius: 20, border: "1px solid #FED7AA" }}>NET: {fmtN(netValue)}</span>}
          {totalAward > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", background: "#F0FDF4", padding: "4px 14px", borderRadius: 20, border: "1px solid #BBF7D0" }}>TOTAL: {fmtN(totalAward)}</span>}
        </div>
      </div>

      {/* Case Selector */}
      <div className="mc-wb-toolbar mc-wb-sticky2" style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "8px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div className="mc-case-selector" style={{ position: "relative", flex: 1, maxWidth: 460 }}>
          <button onClick={() => setShowCasePicker(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: selectedClaimId ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${selectedClaimId ? "#BFDBFE" : "#E2E8F0"}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
            <Search size={13} color="#94A3B8" />
            <span style={{ flex: 1, fontSize: 13, color: selectedClaimId ? "#147EFA" : "#94A3B8", fontWeight: selectedClaimId ? 600 : 400, textAlign: "left" }}>
              {selectedClaimId ? ((activeClaims as any[])?.find((c: any) => c._id === selectedClaimId)?.clientName ?? "Case loaded") : "Load a case to auto-fill & save to cloud…"}
            </span>
            <ChevronDown size={13} color="#94A3B8" />
          </button>
          {showCasePicker && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: 4, maxHeight: 320, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9" }}>
                <input autoFocus style={{ width: "100%", border: "none", outline: "none", fontSize: 13, color: "#334155" }} placeholder="Search name, VIN, carrier…" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} />
              </div>
              <div style={{ overflowY: "auto" }}>
                {((activeClaims as any[]) ?? []).filter((c: any) => !caseSearch || `${c.clientName} ${c.vin} ${c.insurer}`.toLowerCase().includes(caseSearch.toLowerCase())).slice(0, 30).map((c: any) => (
                  <div key={c._id} onClick={() => loadClaimData(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EFF6FF"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#FFFFFF"}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{c.clientName ?? "Unknown"}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.year} {c.make} {c.model} {c.vin ? `· ${c.vin}` : ""} {c.insurer ? `· ${c.insurer}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* GHL Files — show all docs from client's file */}
        {ghlAllDocs.length > 0 && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: ghlAllDocs.length > 1 ? 8 : 0 }}>
              <FileText size={13} color="#16A34A" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#15803D" }}>
                {ghlAllDocs.length} file{ghlAllDocs.length > 1 ? "s" : ""} in client&apos;s GHL record
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {ghlAllDocs.map((doc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📄 {doc.name}
                  </span>
                  <button
                    onClick={() => { setGhlEvalUrl(doc.url); handleAutoParseGHL(); }}
                    disabled={parsingPDF}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: ghlEvalUrl === doc.url ? "#15803D" : "#16A34A", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                  >
                    {parsingPDF && ghlEvalUrl === doc.url
                      ? <><Loader size={10} style={{ animation: "spin 1s linear infinite" }} /> Parsing…</>
                      : <><Zap size={10} /> Parse</>
                    }
                  </button>
                  <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#64748B", textDecoration: "none", flexShrink: 0 }}>View</a>
                </div>
              ))}
            </div>
          </div>
        )}
        {autoParseStatus && (
          <div style={{ fontSize: 11, fontWeight: 600, color: autoParseStatus.startsWith("✓") ? "#16A34A" : "#FF8600", padding: "0 4px" }}>{autoParseStatus}</div>
        )}
        {/* PDF Evaluation Parser (manual upload) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input ref={pdfInputRef} type="file" accept=".pdf,image/*,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleParsePDF(f); e.target.value = ""; }} />
          <button onClick={() => pdfInputRef.current?.click()} disabled={parsingPDF} style={{ display: "flex", alignItems: "center", gap: 6, background: parsingPDF ? "#F8FAFC" : "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#147EFA", fontSize: 12, fontWeight: 700, opacity: parsingPDF ? 0.7 : 1, flexShrink: 0 }}>
            {parsingPDF ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Parsing PDF…</> : <><Upload size={12} /> Upload Insurer Eval</>}
          </button>
          {parseResult && (
            <span style={{ fontSize: 11, fontWeight: 600, color: parseResult.startsWith("✓") ? "#16A34A" : parseResult.startsWith("📷") ? "#FF8600" : "#EF4444", maxWidth: 420 }}>{parseResult}</span>
          )}
        </div>

        {/* Collapse All / Expand All */}
        <button
          onClick={() => setAllCollapsed(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: allCollapsed ? "#F1F5F9" : "#FFFFFF", cursor: "pointer", color: "#64748B", whiteSpace: "nowrap" }}
        >
          {allCollapsed ? <><ChevronDown size={12} /> Expand All</> : <><ChevronUp size={12} /> Collapse All</>}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: syncStatus === "saved" ? "#16A34A" : syncStatus === "saving" ? "#FF8600" : "#94A3B8", marginLeft: "auto" }}>
          {syncStatus === "saved"   && <><Cloud size={12} /> Saved</>}
          {syncStatus === "saving"  && <><Cloud size={12} /> Saving…</>}
          {syncStatus === "unsaved" && <><CloudOff size={12} /> Unsaved</>}
          {syncStatus === "idle"    && <><CloudOff size={12} /> No case loaded</>}
        </div>
      </div>

      {/* Main Layout: Left scroll + Right sticky */}
      {/* ── Contextual Thread Banner ─────────────────────────────────────── */}
      {threadContext?.threadSummary && (
        <CCContextDropdown
          threadContext={threadContext}
          onDismiss={() => setThreadContext(null)}
          onTargetSave={async (val) => {
            if (!selectedClaimId) return;
            await updateClaim({ id: selectedClaimId as any, targetValue: val ?? undefined });
            setThreadContext((prev: any) => ({ ...prev, targetValue: val }));
          }}
        />
      )}

      <div className="mc-wb-outer" style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>

        {/* ── LEFT: Scrollable workbench ──────────────────────────────────── */}
        <div className="mc-wb-left" style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#F1F5F9" }} onChange={triggerAutoSave}>

          {/* ── INTAKE ─────────────────────────────────────────────────── */}
          <Section id="intake" title="Intake" forceCollapsed={allCollapsed} color="#147EFA">
            <div className="mc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Left */}
              <div>
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={sectionHead()}>Carrier Information</div>
                  <div className="mc-row" style={row}><Field label="Carrier / Insurance Company"><input style={inp} value={carrier} onChange={e => setCarrier(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}>
                    <Field label="Claim Number"><input style={inp} value={claimNumber} onChange={e => setClaimNumber(e.target.value)} /></Field>
                    <Field label="Examiner / Adjuster"><input style={inp} value={examiner} onChange={e => setExaminer(e.target.value)} /></Field>
                  </div>
                  <div className="mc-row" style={row}>
                    <Field label="Date of Loss"><input type="date" style={inp} value={dateOfLoss} onChange={e => setDateOfLoss(e.target.value)} /></Field>
                    <Field label="Date of Appraisal"><input type="date" style={inp} value={dateOfAppraisal} onChange={e => setDateOfAppraisal(e.target.value)} /></Field>
                  </div>
                  <div className="mc-row" style={row}><Field label="Purpose"><select style={inp} value={purpose} onChange={e => setPurpose(e.target.value)}><option>Appraisal Clause</option><option>Total Loss</option><option>Diminished Value</option></select></Field></div>
                </div>
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={sectionHead()}>Vehicle Owner</div>
                  <div className="mc-row" style={row}><Field label="Owner Name"><input style={inp} value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}><Field label="Street Address"><input style={inp} value={ownerAddress} onChange={e => setOwnerAddress(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}><Field label="City / State / Zip"><input style={inp} value={ownerCSZ} onChange={e => setOwnerCSZ(e.target.value)} /></Field></div>
                </div>
                <div style={card}>
                  <div style={sectionHead()}>Appraiser / Umpire</div>
                  <div className="mc-row" style={row}><Field label="Insured's Appraiser"><input style={inp} value={insuredAppraiser} onChange={e => setInsuredAppraiser(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}><Field label="Insurer's Appraiser"><input style={inp} value={insurerAppraiser} onChange={e => setInsurerAppraiser(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}><Field label="Umpire (if applicable)"><input style={inp} value={umpire} onChange={e => setUmpire(e.target.value)} /></Field></div>
                </div>
              </div>
              {/* Right */}
              <div>
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={sectionHead()}>Vehicle Information</div>
                  <div className="mc-row" style={row}>
                    <Field label="Year"><input style={inp} value={vehYear} onChange={e => setVehYear(e.target.value)} /></Field>
                    <Field label="Make"><input style={inp} value={vehMake} onChange={e => setVehMake(e.target.value)} /></Field>
                    <Field label="Model"><input style={inp} value={vehModel} onChange={e => setVehModel(e.target.value)} /></Field>
                  </div>
                  <div className="mc-row" style={row}>
                    <Field label="Trim"><input style={inp} value={vehTrim} onChange={e => setVehTrim(e.target.value)} /></Field>
                    <Field label="Packages / Options"><input style={inp} value={vehPackages} onChange={e => setVehPackages(e.target.value)} /></Field>
                  </div>
                  <div className="mc-row" style={row}><Field label="VIN"><input style={inp} value={vin} onChange={e => setVin(e.target.value)} /></Field></div>
                  <div className="mc-row" style={row}><Field label="Mileage"><input type="number" style={inp} value={mileage || ""} onChange={e => setMileage(parseFloat(e.target.value) || 0)} /></Field></div>
                </div>
                <div style={{ ...card, marginBottom: 12 }}>
                  <div style={sectionHead()}>Opposing Party Tracking</div>
                  <div className="mc-row" style={row}>
                    <Field label="Insurer's ACV (Adjusted Vehicle Value)"><input type="number" style={inp} value={insurerStarting || ""} onChange={e => setInsurerStarting(parseFloat(e.target.value) || 0)} /></Field>
                    <Field label="Opposing Appraiser Amount"><input type="number" style={inp} value={opposingAmount || ""} onChange={e => setOpposingAmount(parseFloat(e.target.value) || 0)} /></Field>
                  </div>
                  <div className="mc-row" style={row}>
                    <Field label="Client's Target Value (Floor)">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="number" style={inp} placeholder="What client needs to settle at" value={clientEstimate || ""} onChange={e => setClientEstimate(parseFloat(e.target.value) || 0)} />
                        {clientEstimate > 0 && insurerStarting > 0 && (
                          <div style={{ fontSize: 11, color: clientEstimate > insurerStarting ? "#22C55E" : "#94A3B8", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {clientEstimate > insurerStarting ? `+${fmtN(clientEstimate - insurerStarting)} vs insurer` : `${fmtN(clientEstimate - insurerStarting)} vs insurer`}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>Comps bot will find listings <strong>above</strong> this number — anchor high, negotiate down</div>
                    </Field>
                  </div>
                  {(insurerStarting > 0 || opposingAmount > 0) && (
                    <div className="mc-pill-grid" style={{ display: "grid", gridTemplateColumns: clientEstimate > 0 ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                      {[
                        { label: "INSURER",  val: insurerStarting, color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
                        { label: "OPPOSING", val: opposingAmount,  color: "#FF8600", bg: "#FFF7ED", border: "#FED7AA" },
                        ...(clientEstimate > 0 ? [{ label: "CLIENT EST.", val: clientEstimate, color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE" }] : []),
                        { label: "OUR VALUE",val: netValue,        color: "#147EFA", bg: "#EFF6FF", border: "#BFDBFE" },
                      ].map(({ label, val, color, bg, border }) => (
                        <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color }}>{val > 0 ? fmtN(val) : "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </Section>

          {/* ── COMPARABLES ─────────────────────────────────────────────── */}
          <Section id="comps" title="Comparables" forceCollapsed={allCollapsed} color="#FF8600">
            {/* AI Comp Finder */}
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#FF8600", marginBottom: 2 }}>AI Comp Finder</div>
                <div style={{ fontSize: 11, color: "#92400E" }}>Searches AutoTrader, CarGurus, Cars.com · Upper 20th percentile · Matches year/make/model/trim</div>
              </div>
              <button onClick={handleFindComps} disabled={findingComps || !vehYear || !vehMake || !vehModel} style={{ display: "flex", alignItems: "center", gap: 7, background: findingComps ? "#F8FAFC" : "#FF8600", border: "none", borderRadius: 8, padding: "9px 18px", cursor: (!vehYear || !vehMake || !vehModel) ? "not-allowed" : "pointer", color: findingComps ? "#94A3B8" : "#FFFFFF", fontSize: 13, fontWeight: 700, opacity: findingComps ? 0.7 : 1, flexShrink: 0 }}>
                {findingComps ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Searching…</> : <><Zap size={13} /> Find Comps</>}
              </button>
              {!vehYear || !vehMake || !vehModel ? <span style={{ fontSize: 11, color: "#94A3B8" }}>Enter vehicle details in Intake first</span> : null}
              {compFindResult && <span style={{ fontSize: 11, color: compFindResult.startsWith("✓") ? "#16A34A" : "#EF4444", fontWeight: 600, width: "100%" }}>{compFindResult}</span>}
            </div>
            {/* Mileage Rate */}
            <div style={{ background: "#0F172A", borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...lbl, color: "#64748B" }}>Mileage Adjustment Rate (per mile)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={0.50} step={0.01} value={mileageRate} onChange={e => setMileageRate(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#FF8600" }} />
                  <input type="number" min={0} max={2} step={0.001} value={mileageRate} onChange={e => setMileageRate(parseFloat(e.target.value) || 0.02)} style={{ ...inp, width: 80, background: "#1E293B", border: "1px solid #334155", color: "#FFFFFF" }} />
                </div>
              </div>
              <div style={{ borderLeft: "1px solid #1E293B", paddingLeft: 18, textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Subject Vehicle</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>{vehYear} {vehMake} {vehModel} {vehTrim}</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>{mileage.toLocaleString()} miles</div>
              </div>
            </div>
            {comps.map((c, i) => {
              const mAdj = compMileAdj(c); const adjCost = compAdjusted(c);
              return (
                <div key={i} style={{ ...card, borderLeft: `3px solid ${c.askingPrice > 0 ? (c.accepted !== false ? "#16A34A" : "#CBD5E1") : "#E2E8F0"}`, marginBottom: 12, opacity: c.askingPrice > 0 && c.accepted === false ? 0.55 : 1 }}>
                  {/* Row header: accept checkbox + comp # + description + clear + delete */}
                  <div className="mc-comp-header" style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                    {/* Accept toggle */}
                    <label title={c.accepted !== false ? "Included in report — click to exclude" : "Excluded from report — click to include"} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0, userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={c.accepted !== false}
                        onChange={e => updateComp(i, "accepted", e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#16A34A", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.accepted !== false ? "#16A34A" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {c.accepted !== false ? "Use" : "Skip"}
                      </span>
                    </label>
                    <span style={{ fontSize: 14, fontWeight: 800, color: c.accepted !== false ? "#FF8600" : "#94A3B8", flexShrink: 0, minWidth: 24 }}>C{i + 1}</span>
                    <input style={{ ...inp, fontWeight: 600 }} placeholder="Year Make Model Trim · Source (AutoTrader, CarGurus…)" value={c.description} onChange={e => updateComp(i, "description", e.target.value)} />
                    {/* Clear this comp */}
                    {(c.askingPrice > 0 || c.description) && (
                      <button title="Clear this comp" onClick={() => setComps(cs => cs.map((x, idx) => idx === i ? emptyComp() : x))} style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#FF8600", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        Clear
                      </button>
                    )}
                    {/* Delete row (only if more than 1 comp) */}
                    {comps.length > 1 && (
                      <button title="Remove this comp" onClick={() => setComps(cs => cs.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 4, flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mc-row" style={row}>
                    <Field label="Listing URL">
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input style={{ ...inp, color: "#147EFA", flex: 1 }} placeholder="https://autotrader.com/… or paste any listing URL" value={c.url} onChange={e => updateComp(i, "url", e.target.value)} />
                        {c.url && (
                          <button
                            title="Capture screenshot + auto-fill VIN, dealer, location"
                            onClick={async () => {
                              updateComp(i, "screenshotCaptured", false);
                              try {
                                const res = await fetch("/api/capture-listing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: c.url, compIndex: i }) });
                                const d = await res.json();
                                if (d.data) {
                                  if (d.data.vin)          updateComp(i, "vin", d.data.vin);
                                  if (d.data.mileage && !c.compMileage) updateComp(i, "compMileage", parseInt(d.data.mileage));
                                  if (d.data.color)        updateComp(i, "color", d.data.color);
                                  if (d.data.transmission) updateComp(i, "transmission", d.data.transmission);
                                  if (d.data.dealer)       updateComp(i, "dealer", d.data.dealer);
                                  if (d.data.location)     updateComp(i, "location", d.data.location);
                                  if (d.data.condition)    updateComp(i, "condition", d.data.condition);
                                  if (d.data.daysOnMarket) updateComp(i, "daysOnMarket", d.data.daysOnMarket);
                                }
                                if (d.screenshot) updateComp(i, "screenshotCaptured", true);
                              } catch {}
                            }}
                            style={{ background: c.screenshotCaptured ? "#f0fdf4" : "#fff7ed", border: `1px solid ${c.screenshotCaptured ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: c.screenshotCaptured ? "#16a34a" : "#FF8600", whiteSpace: "nowrap" }}
                          >
                            {c.screenshotCaptured ? "✓ Captured" : "📸 Capture"}
                          </button>
                        )}
                      </div>
                      {/* Show scraped data as chips */}
                      {(c.vin || c.dealer || c.location || c.color) && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {c.vin         && <span style={{ fontSize: 10, background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 10, fontFamily: "monospace", fontWeight: 700 }}>VIN: {c.vin}</span>}
                          {c.location    && <span style={{ fontSize: 10, background: "#f0fdf4", color: "#15803d", padding: "2px 8px", borderRadius: 10 }}>📍 {c.location}</span>}
                          {c.dealer      && <span style={{ fontSize: 10, background: "#f8fafc", color: "#475569", padding: "2px 8px", borderRadius: 10 }}>🏢 {c.dealer}</span>}
                          {c.color       && <span style={{ fontSize: 10, background: "#faf5ff", color: "#7c3aed", padding: "2px 8px", borderRadius: 10 }}>{c.color}</span>}
                          {c.transmission && <span style={{ fontSize: 10, background: "#faf5ff", color: "#7c3aed", padding: "2px 8px", borderRadius: 10 }}>{c.transmission}</span>}
                          {c.condition   && <span style={{ fontSize: 10, background: "#fff7ed", color: "#c2410c", padding: "2px 8px", borderRadius: 10 }}>{c.condition}</span>}
                        </div>
                      )}
                    </Field>
                    <Field label="Asking Price ($)">
                      <input type="number" style={inp} placeholder="e.g. 34995" value={c.askingPrice || ""} onChange={e => updateComp(i, "askingPrice", parseFloat(e.target.value) || 0)} />
                    </Field>
                  </div>
                  <div className="mc-comp-row2 mc-row" style={row}>
                    <Field label="Comp Mileage">
                      <input type="number" style={inp} placeholder="e.g. 44337" value={c.compMileage || ""} onChange={e => updateComp(i, "compMileage", parseFloat(e.target.value) || 0)} />
                    </Field>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Mileage Adj (auto)</label>
                      <div style={{ padding: "8px 12px", borderRadius: 8, minHeight: 44, display: "flex", alignItems: "center", background: mAdj > 0 ? "#F0FDF4" : mAdj < 0 ? "#FEF2F2" : "#F1F5F9", border: `1px solid ${mAdj > 0 ? "#BBF7D0" : mAdj < 0 ? "#FECACA" : "#E2E8F0"}` }}>
                        <span style={{ fontWeight: 700, color: mAdj > 0 ? "#16A34A" : mAdj < 0 ? "#EF4444" : "#94A3B8" }}>{c.askingPrice > 0 ? fmt(mAdj) : "—"}</span>
                      </div>
                    </div>
                    <Field label="Other Adj ($)">
                      <input type="number" style={inp} placeholder="+ or −" value={c.otherAdj || ""} onChange={e => updateComp(i, "otherAdj", parseFloat(e.target.value) || 0)} />
                    </Field>
                    <Field label="Adj Note">
                      <input style={inp} placeholder="e.g. wrong trim −$500" value={c.otherAdjNote} onChange={e => updateComp(i, "otherAdjNote", e.target.value)} />
                    </Field>
                  </div>
                  {c.askingPrice > 0 && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#16A34A", textTransform: "uppercase" }}>Adjusted Value</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#16A34A" }}>{fmt(adjCost)}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Add Comp + summary bar */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => setComps(cs => [...cs, emptyComp()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #FED7AA", borderRadius: 8, padding: "7px 16px", cursor: "pointer", color: "#FF8600", fontSize: 12, fontWeight: 700 }}>
                <Plus size={13} /> Add Comp
              </button>
              <button onClick={() => setComps([emptyComp(), emptyComp(), emptyComp()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #E2E8F0", borderRadius: 8, padding: "7px 16px", cursor: "pointer", color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>
                Clear All
              </button>
            </div>
            <div style={{ background: "#0F172A", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Comps Average ({filledComps.length} vehicles)</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#FF8600" }}>{fmt(compAvg)}</span>
            </div>
          </Section>

          {/* ── ADD-ONS ─────────────────────────────────────────────────── */}
          <Section id="addons" title="Add-Ons" forceCollapsed={allCollapsed} color="#7C3AED">
            {/* Hidden invoice input */}
            <input ref={invoiceInputRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleParseInvoice(f, invoiceTarget); e.target.value = ""; }} />
            {invoiceResult && (
              <div style={{ background: invoiceResult.startsWith("✓") ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${invoiceResult.startsWith("✓") ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, fontWeight: 600, color: invoiceResult.startsWith("✓") ? "#16A34A" : "#EF4444" }}>
                {invoiceResult}
              </div>
            )}
            {/* Maintenance */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 4, height: 18, background: "#147EFA", borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em" }}>Maintenance / Refurbishments</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => { setInvoiceTarget("maint"); invoiceInputRef.current?.click(); }} disabled={parsingInvoice} style={{ display: "flex", alignItems: "center", gap: 5, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 7, padding: "4px 12px", cursor: "pointer", color: "#147EFA", fontSize: 11, fontWeight: 700 }}>
                    {parsingInvoice && invoiceTarget === "maint" ? <><Loader size={11} /> Reading…</> : <><Upload size={11} /> Upload Invoice</>}
                  </button>
                  {selectedClaimId && caseAttachments?.filter((a: any) => a.section === "maintenance")?.length > 0 && (
                    <span style={{ fontSize: 10, color: "#22C55E", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                      ✓ {((caseAttachments ?? []).filter((a: any) => a.section === "maintenance")).length} saved
                    </span>
                  )}
                  {!selectedClaimId && <span style={{ fontSize: 10, color: "#F59E0B", display: "flex", alignItems: "center" }}>Load case to save files</span>}
                </div>
              </div>
              {/* Saved maintenance files list */}
              {selectedClaimId && caseAttachments?.filter((a: any) => a.section === "maintenance")?.map((a: any) => (
                <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "5px 10px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                  <FileText size={12} color="#147EFA" />
                  <span style={{ flex: 1, fontSize: 11, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#147EFA", fontWeight: 600 }}>View</a>}
                  <button onClick={() => removeAttachment({ id: a._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><Trash2 size={11} /></button>
                </div>
              ))}
              <div className="mc-maint-scroll" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 520 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 32px", gap: 8, marginBottom: 8 }}>
                {["Category","Item(s)","Date","Cost","Dep %","Net Value",""].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{h}</div>)}
              </div>
              {maintRows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 32px", gap: 8, marginBottom: 8 }}>
                  <input style={inp} value={r.category} onChange={e => updateRow(setMaintRows, i, "category", e.target.value)} placeholder="Category" />
                  <input style={inp} value={r.items} onChange={e => updateRow(setMaintRows, i, "items", e.target.value)} placeholder="Description" />
                  <input type="date" style={inp} value={r.date} onChange={e => updateRow(setMaintRows, i, "date", e.target.value)} />
                  <input type="number" style={inp} value={r.cost || ""} onChange={e => updateRow(setMaintRows, i, "cost", parseFloat(e.target.value) || 0)} />
                  <input type="number" style={inp} value={r.depPct || ""} onChange={e => updateRow(setMaintRows, i, "depPct", parseFloat(e.target.value) || 0)} />
                  <div style={{ ...inp, background: "#F0FDF4", color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{fmt(netVal(r))}</div>
                  <button onClick={() => setMaintRows(rs => rs.filter((_,j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}><Trash2 size={13} /></button>
                </div>
              ))}
              </div>{/* end minWidth */}
              </div>{/* end mc-maint-scroll */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <button onClick={() => setMaintRows(rs => [...rs, emptyRow()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #BFDBFE", borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: "#147EFA", fontSize: 12, fontWeight: 600 }}>
                  <Plus size={13} /> Add Row
                </button>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#147EFA" }}>Total: {fmt(maintTotal)}</span>
              </div>
            </div>
            {/* Aftermarket */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 4, height: 18, background: "#FF8600", borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aftermarket Parts</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => { setInvoiceTarget("after"); invoiceInputRef.current?.click(); }} disabled={parsingInvoice} style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 7, padding: "4px 12px", cursor: "pointer", color: "#FF8600", fontSize: 11, fontWeight: 700 }}>
                    {parsingInvoice && invoiceTarget === "after" ? <><Loader size={11} /> Reading…</> : <><Upload size={11} /> Upload Invoice</>}
                  </button>
                  {selectedClaimId && caseAttachments?.filter((a: any) => a.section === "aftermarket")?.length > 0 && (
                    <span style={{ fontSize: 10, color: "#22C55E", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                      ✓ {((caseAttachments ?? []).filter((a: any) => a.section === "aftermarket")).length} saved
                    </span>
                  )}
                  {!selectedClaimId && <span style={{ fontSize: 10, color: "#F59E0B", display: "flex", alignItems: "center" }}>Load case to save files</span>}
                </div>
              </div>
              <div className="mc-maint-scroll" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 520 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 32px", gap: 8, marginBottom: 8 }}>
                {["Category","Item(s)","Date","Cost","Dep %","Net Value",""].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{h}</div>)}
              </div>
              {afterRows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 32px", gap: 8, marginBottom: 8 }}>
                  <input style={inp} value={r.category} onChange={e => updateRow(setAfterRows, i, "category", e.target.value)} placeholder="Category" />
                  <input style={inp} value={r.items} onChange={e => updateRow(setAfterRows, i, "items", e.target.value)} placeholder="Description" />
                  <input type="date" style={inp} value={r.date} onChange={e => updateRow(setAfterRows, i, "date", e.target.value)} />
                  <input type="number" style={inp} value={r.cost || ""} onChange={e => updateRow(setAfterRows, i, "cost", parseFloat(e.target.value) || 0)} />
                  <input type="number" style={inp} value={r.depPct || ""} onChange={e => updateRow(setAfterRows, i, "depPct", parseFloat(e.target.value) || 0)} />
                  <div style={{ ...inp, background: "#FFF7ED", color: "#FF8600", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{fmt(netVal(r))}</div>
                  <button onClick={() => setAfterRows(rs => rs.filter((_,j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}><Trash2 size={13} /></button>
                </div>
              ))}
              </div>{/* end minWidth */}
              </div>{/* end mc-maint-scroll */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <button onClick={() => setAfterRows(rs => [...rs, emptyRow()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #FED7AA", borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: "#FF8600", fontSize: 12, fontWeight: 600 }}>
                  <Plus size={13} /> Add Row
                </button>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#FF8600" }}>Total: {fmt(afterTotal)}</span>
              </div>
              {/* Saved aftermarket files */}
              {selectedClaimId && caseAttachments?.filter((a: any) => a.section === "aftermarket")?.map((a: any) => (
                <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "5px 10px", background: "#FFF7ED", borderRadius: 6, border: "1px solid #FED7AA" }}>
                  <FileText size={12} color="#FF8600" />
                  <span style={{ flex: 1, fontSize: 11, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#FF8600", fontWeight: 600 }}>View</a>}
                  <button onClick={() => removeAttachment({ id: a._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
            {/* UPD + Condition */}
            <div className="mc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>UPD — Unrelated Prior Damages</div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={updNotes} onChange={e => setUpdNotes(e.target.value)} placeholder="Describe prior damage…" />
                <label style={{ ...lbl, marginTop: 10 }}>Deduction Amount</label>
                <input type="number" style={inp} value={updAmount || ""} onChange={e => setUpdAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Condition / DOL Adjustment</div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={condNotes} onChange={e => setCondNotes(e.target.value)} placeholder="Condition / date of loss factors…" />
                <label style={{ ...lbl, marginTop: 10 }}>Amount (+ or –)</label>
                <input type="number" style={inp} value={condAmount || ""} onChange={e => setCondAmount(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </Section>

          {/* ── VEHICLE PHOTOS & ATTACHMENTS ─────────────────────────────── */}
          <Section id="photos" title="Photos & Supporting Documents" forceCollapsed={allCollapsed} color="#8B5CF6" defaultOpen={true}>
            {!selectedClaimId && (
              <div style={{ ...card, textAlign: "center", color: "#94A3B8", padding: 20 }}>
                <p style={{ margin: 0 }}>Load a case to enable file uploads — attachments are saved per case.</p>
              </div>
            )}
            {selectedClaimId && (<>
              {/* Photo Upload + AI Analysis */}
              <div style={card}>
                <div style={{ ...sectionHead("#8B5CF6"), marginBottom: 12 }}>Vehicle Photos</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#F5F3FF", border: "2px dashed #DDD6FE", borderRadius: 8, padding: "10px 14px", cursor: "pointer", color: "#8B5CF6", fontSize: 13, fontWeight: 600, flex: 1 }}>
                    <Upload size={16} /> Upload Photos
                    <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files, "photo")} />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFF7ED", border: "2px dashed #FED7AA", borderRadius: 8, padding: "10px 14px", cursor: "pointer", color: "#FF8600", fontSize: 13, fontWeight: 600, flex: 1 }}>
                    <Zap size={16} /> AI Analyze Photo
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const modeMap: Record<string, string> = { damage: "Damage", carfax: "Carfax / History", estimate: "Estimate" };
                      const mode = (window.prompt("Analysis mode:\n  damage — vehicle damage\n  carfax — vehicle history report\n  estimate — repair estimate\n(leave blank for damage)", "damage") || "damage") as string;
                      setAiImgAnalysis({ loading: true, result: null, mode });
                      const fd = new FormData(); fd.append("file", file); fd.append("mode", mode); fd.append("agentName", "Analysis Agent");
                      try {
                        const res = await fetch("/api/analyze-vehicle-image", { method: "POST", body: fd });
                        const d = await res.json();
                        setAiImgAnalysis({ loading: false, result: d.result, mode: d.mode });
                      } catch { setAiImgAnalysis({ loading: false, result: { error: "Analysis failed" }, mode }); }
                      e.target.value = "";
                    }} />
                  </label>
                </div>
                {/* AI Image Analysis result */}
                {aiImgAnalysis && (aiImgAnalysis.loading || aiImgAnalysis.result) && (
                  <div style={{ marginBottom: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FF8600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        🔬 AI Analysis — {aiImgAnalysis.mode}
                      </span>
                      <button onClick={() => setAiImgAnalysis(null)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 14 }}>×</button>
                    </div>
                    {aiImgAnalysis.loading ? (
                      <div style={{ fontSize: 12, color: "#FF8600" }}>Analyzing image with Claude vision…</div>
                    ) : (
                      <AiImageResult result={aiImgAnalysis.result} mode={aiImgAnalysis.mode} />
                    )}
                  </div>
                )}
                {((caseAttachments ?? []).filter((a: any) => a.section === "photo")).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginTop: 10 }}>
                    {(caseAttachments ?? []).filter((a: any) => a.section === "photo").map((a: any) => (
                      <div key={a._id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                        {a.url && <img src={a.url} alt={a.fileName} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />}
                        <div style={{ padding: "3px 6px", background: "#F8FAFC" }}>
                          <p style={{ fontSize: 10, color: "#64748B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</p>
                        </div>
                        <button onClick={() => removeAttachment({ id: a._id })} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "white", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Maintenance Invoices */}
              <div style={card}>
                <div style={{ ...sectionHead("#147EFA"), marginBottom: 12 }}>Maintenance / Service Records</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFF6FF", border: "2px dashed #BFDBFE", borderRadius: 8, padding: "12px 16px", cursor: "pointer", color: "#147EFA", fontSize: 13, fontWeight: 600 }}>
                  <Upload size={16} /> Upload Invoices / Service Records (PDF/JPG)
                  <input type="file" accept=".pdf,image/*" multiple style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files, "maintenance")} />
                </label>
                {(caseAttachments ?? []).filter((a: any) => a.section === "maintenance").map((a: any) => (
                  <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                    <FileText size={13} color="#147EFA" />
                    <span style={{ flex: 1, fontSize: 12, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</span>
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#147EFA" }}>View</a>}
                    <button onClick={() => removeAttachment({ id: a._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              {/* Aftermarket Invoices */}
              <div style={card}>
                <div style={{ ...sectionHead("#FF8600"), marginBottom: 12 }}>Aftermarket / Parts Invoices</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFF7ED", border: "2px dashed #FED7AA", borderRadius: 8, padding: "12px 16px", cursor: "pointer", color: "#FF8600", fontSize: 13, fontWeight: 600 }}>
                  <Upload size={16} /> Upload Invoices / Receipts (PDF/JPG)
                  <input type="file" accept=".pdf,image/*" multiple style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files, "aftermarket")} />
                </label>
                {(caseAttachments ?? []).filter((a: any) => a.section === "aftermarket").map((a: any) => (
                  <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                    <FileText size={13} color="#FF8600" />
                    <span style={{ flex: 1, fontSize: 12, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</span>
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#FF8600" }}>View</a>}
                    <button onClick={() => removeAttachment({ id: a._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </>)}
          </Section>

          {/* ── SUMMARY & OFFERS ─────────────────────────────────────────── */}
          <Section id="summary" title="Summary & Offers" forceCollapsed={allCollapsed} color="#16A34A">
            <div className="mc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={sectionHead()}>Valuation Breakdown</div>
                {[
                  { label: "Comps Average",    val: fmt(compAvg) },
                  { label: "Maintenance",       val: fmt(maintTotal) },
                  { label: "Aftermarket",       val: fmt(afterTotal) },
                  { label: "UPD Deduction",     val: `-${fmt(Math.abs(updAmount))}`, neg: true },
                  { label: "Condition / DOL",   val: condAmount >= 0 ? `+${fmt(condAmount)}` : fmt(condAmount) },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 13, color: "#64748B" }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.neg ? "#EF4444" : "#334155" }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "14px 16px", marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Net Value</span>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#FF8600" }}>{fmt(netValue)}</span>
                </div>
              </div>
              <div style={card}>
                <div style={sectionHead()}>Tax, Fees & Total Award</div>
                <div className="mc-row" style={row}>
                  <Field label="Tax Rate %"><input type="number" style={inp} value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} /></Field>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Vehicular Tax (auto)</label>
                    <div style={{ ...inp, background: "#F8FAFC", color: "#64748B" }}>{fmt(vehicularTax)}</div>
                  </div>
                </div>
                <div className="mc-row" style={row}>
                  <Field label="Title / Reg / Other"><input type="number" style={inp} value={titleFees || ""} onChange={e => setTitleFees(parseFloat(e.target.value) || 0)} /></Field>
                  <Field label="Unused Registration"><input type="number" style={inp} value={unusedReg || ""} onChange={e => setUnusedReg(parseFloat(e.target.value) || 0)} /></Field>
                </div>
                <div className="mc-row" style={row}><Field label="Deductible"><input type="number" style={inp} value={deductible || ""} onChange={e => setDeductible(parseFloat(e.target.value) || 0)} /></Field></div>
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "14px 16px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Total Award</span>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#FF8600" }}>{fmt(totalAward)}</span>
                </div>
                {insurerStarting > 0 && netValue > 0 && (
                  <div style={{ marginTop: 10, background: netValue > insurerStarting ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${netValue > insurerStarting ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: netValue > insurerStarting ? "#16A34A" : "#EF4444" }}>
                      {netValue > insurerStarting ? "+" : ""}{fmt(netValue - insurerStarting)} vs. insurer offer
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── RESULTS & CLIENT COMMS ────────────────────────────────────── */}
          <Section id="results" title="Results & Client Comms" forceCollapsed={allCollapsed} color="#16A34A" defaultOpen={false}>
            <div className="mc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ ...card, border: "2px solid #FF8600" }}>
                <div style={{ ...sectionHead(), color: "#FF8600" }}>🏆 Award Entry</div>
                <label style={{ ...lbl, fontWeight: 700, color: "#FF8600" }}>Final Award / Settlement Amount</label>
                <input
                  type="number"
                  style={{ ...inp, fontSize: 22, fontWeight: 800, color: "#FF8600", background: "#1A1200", border: "2px solid #FF8600", textAlign: "center" }}
                  value={acvAward || ""}
                  onChange={e => setAcvAward(parseFloat(e.target.value) || 0)}
                  placeholder="Enter award amount…"
                />
                {acvAward > 0 && (
                  <div style={{ background: "#052e16", borderRadius: 8, padding: "6px 10px", marginTop: 6, textAlign: "center", fontSize: 12, color: "#86efac" }}>
                    ✓ Results sheet populated → <strong>{fmt(increase)}</strong> increase ({pctIncrease.toFixed(1)}%)
                  </div>
                )}
                <div className="mc-row" style={row}>
                  <Field label="Investment (auto-filled from ORCA)"><input type="number" style={inp} value={investmentAmount || ""} onChange={e => setInvestmentAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" /></Field>
                  <Field label="Award Date"><input type="date" style={inp} value={awardDate} onChange={e => setAwardDate(e.target.value)} /></Field>
                </div>
                <Field label="Client First Name"><input style={inp} value={clientFirst || normalizeName(ownerName).split(" ")[0]} onChange={e => setClientFirst(e.target.value)} /></Field>
              </div>
              <div style={{ ...card, background: "#0F172A", border: "1px solid #1E293B" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Results Sheet</div>
                {[
                  { label: "Original Offer",    val: fmt(insurerStarting) },
                  { label: "Appraisal Result",   val: fmt(acvAward) },
                  { label: "Investment",         val: fmt(investmentAmount) },
                  { label: "Increase",           val: fmt(increase) },
                  { label: "Tax on Increase",    val: fmt(salesTaxInc) },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1E293B" }}>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#FF8600" }}>Total Increase</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#FF8600" }}>{fmt(totalIncrease)}</span>
                </div>
              </div>
            </div>
            {/* Comms generator */}
            <div style={card}>
              <div style={sectionHead()}>Client Communication Generator</div>
              <button onClick={handleGenComms} disabled={generating} style={{ width: "100%", padding: "11px", background: "#147EFA", border: "none", borderRadius: 10, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 16, opacity: generating ? 0.7 : 1 }}>
                {generating ? "Generating…" : "✨ Generate Email & Text Message"}
              </button>
              {genEmail && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={lbl}>Email</label>
                    <button onClick={() => copyText(genEmail, "email")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, color: copied === "email" ? "#16A34A" : "#64748B" }}>
                      {copied === "email" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <textarea style={{ ...inp, minHeight: 180, resize: "vertical" }} value={genEmail} onChange={e => setGenEmail(e.target.value)} />
                </div>
              )}
              {genText && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={lbl}>Text Message</label>
                    <button onClick={() => copyText(genText, "text")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, color: copied === "text" ? "#16A34A" : "#64748B" }}>
                      {copied === "text" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={genText} onChange={e => setGenText(e.target.value)} />
                </div>
              )}
              {/* Send via GHL button — only shown once content is ready */}
              {(genEmail || genText) && (
                <div style={{ marginTop: 14, borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
                  <button
                    onClick={handleSendComms}
                    disabled={sendingComms || (!genEmail && !genText)}
                    style={{
                      width: "100%", padding: "12px", border: "none", borderRadius: 10,
                      background: commsSentResult?.startsWith("✓") ? "#16A34A" : "#FF8600",
                      color: "#FFFFFF", fontSize: 14, fontWeight: 700,
                      cursor: sendingComms ? "not-allowed" : "pointer",
                      opacity: sendingComms ? 0.7 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    {sendingComms
                      ? "Sending via GHL…"
                      : commsSentResult?.startsWith("✓")
                        ? "✓ Sent via GHL"
                        : "📤 Send Email + Text via GHL"}
                  </button>
                  {commsSentResult && (
                    <div style={{
                      marginTop: 8, fontSize: 12, fontWeight: 600, textAlign: "center", padding: "6px 10px", borderRadius: 6,
                      background: commsSentResult.startsWith("✓") ? "#F0FDF4" : "#FEF2F2",
                      color: commsSentResult.startsWith("✓") ? "#16A34A" : "#DC2626",
                    }}>
                      {commsSentResult}
                    </div>
                  )}
                  {!selectedClaimId && (
                    <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 6 }}>Load a case to enable GHL send</p>
                  )}
                </div>
              )}
            </div>
            {/* Demand + Rebuttal */}
            <div className="mc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={sectionHead()}>Demand Letter</div>
                <button onClick={handleGenDemand} disabled={generatingDemand} style={{ width: "100%", padding: "10px", background: "#147EFA", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10, opacity: generatingDemand ? 0.7 : 1 }}>
                  {generatingDemand ? "Generating…" : "Generate Demand Letter"}
                </button>
                {genDemand && (
                  <>
                    <button onClick={() => copyText(genDemand, "demand")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, color: copied === "demand" ? "#16A34A" : "#64748B", marginBottom: 6 }}>
                      {copied === "demand" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                    <textarea style={{ ...inp, minHeight: 250, resize: "vertical" }} value={genDemand} onChange={e => setGenDemand(e.target.value)} />
                  </>
                )}
              </div>
              <div style={card}>
                <div style={sectionHead()}>Rebuttal Report</div>
                <button onClick={handleGenRebuttal} disabled={generatingRebuttal} style={{ width: "100%", padding: "10px", background: "#FF8600", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10, opacity: generatingRebuttal ? 0.7 : 1 }}>
                  {generatingRebuttal ? "Generating…" : "Generate Rebuttal Report"}
                </button>
                {genRebuttal && (
                  <>
                    <button onClick={() => copyText(genRebuttal, "rebuttal")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, color: copied === "rebuttal" ? "#16A34A" : "#64748B", marginBottom: 6 }}>
                      {copied === "rebuttal" ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                    <textarea style={{ ...inp, minHeight: 250, resize: "vertical" }} value={genRebuttal} onChange={e => setGenRebuttal(e.target.value)} />
                  </>
                )}
              </div>
            </div>
          </Section>

          {/* ── DOCUMENTS ─────────────────────────────────────────────────── */}
          <Section id="documents" title="Documents & Save" forceCollapsed={allCollapsed} color="#64748B" defaultOpen={false}>
            <div style={card}>
              <div style={sectionHead()}>Save / Load</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => {
                  const state = { carrier, claimNumber, examiner, dateOfLoss, ownerName, ownerAddress, ownerCSZ, insuredAppraiser, insurerAppraiser, umpire, vehYear, vehMake, vehModel, vehTrim, vehPackages, vin, mileage, insurerStarting, opposingAmount, mileageRate, comps, maintRows, afterRows, updNotes, updAmount, condNotes, condAmount, taxRate, titleFees, unusedReg, deductible, acvAward, investmentAmount };
                  localStorage.setItem(`claim_acv_${claimNumber || "draft"}_${Date.now()}`, JSON.stringify(state));
                }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#147EFA", border: "none", borderRadius: 8, padding: "9px 18px", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  <Save size={14} /> Save Locally
                </button>
                {selectedClaimId && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16A34A", fontWeight: 600 }}>
                    <Cloud size={13} /> Auto-saving to cloud
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  setSavingDrive(true); setDriveResult(null);
                  try {
                    const state = latestStateRef.current;
                    const lastName = (ownerName || "").split(" ").pop() || "";
                    const res = await fetch("/api/save-to-drive", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ state, claimNumber, clientName: ownerName || "", vehicle: [vehYear, vehMake, vehModel].filter(Boolean).join(" ") }),
                    });
                    const d = await res.json();
                    if (d.driveUrl) setDriveResult("✓ Saved to Drive");
                    else setDriveResult("✗ " + (d.error || "Save failed"));
                  } catch (e: any) { setDriveResult("✗ " + e.message); }
                  setSavingDrive(false);
                }}
                disabled={savingDrive}
                style={{ display: "flex", alignItems: "center", gap: 6, background: driveResult?.startsWith("✓") ? "#16A34A" : "#F8FAFC", border: `1px solid ${driveResult?.startsWith("✓") ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 8, padding: "9px 18px", color: driveResult?.startsWith("✓") ? "#FFFFFF" : "#64748B", fontSize: 13, fontWeight: 700, cursor: savingDrive ? "not-allowed" : "pointer", opacity: savingDrive ? 0.7 : 1 }}
              >
                {savingDrive ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : driveResult?.startsWith("✓") ? <>✓ Saved to Drive</> : <><Cloud size={13} /> Save to Drive</>}
              </button>
              {driveResult && !driveResult.startsWith("✓") && (
                <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{driveResult}</p>
              )}
              <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
                Saves workbench snapshot to Cases/[ClaimNo] in your Google Drive.
              </p>
            </div>
          </Section>

        </div>

        {/* ── RIGHT: Sticky Summary Panel ──────────────────────────────────── */}
        <div className="mc-wb-right" style={{ width: 260, flexShrink: 0, overflowY: "auto", background: "#FFFFFF", borderLeft: "1px solid #E2E8F0", padding: "20px 16px", paddingBottom: 40 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Live Summary</p>

          {[
            { label: "Comps Average",   val: compAvg,    color: "#FF8600" },
            { label: "Maintenance",     val: maintTotal, color: "#147EFA" },
            { label: "Aftermarket",     val: afterTotal, color: "#FF8600" },
            { label: "UPD Deduction",   val: -Math.abs(updAmount), color: "#EF4444" },
            { label: "Condition / DOL", val: condAmount, color: condAmount >= 0 ? "#16A34A" : "#EF4444" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.val === 0 ? "#CBD5E1" : r.color }}>{r.val !== 0 ? fmtN(r.val) : "—"}</span>
            </div>
          ))}

          <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 14px", margin: "12px 0 4px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#FF8600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Net Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF8600" }}>{netValue > 0 ? fmtN(netValue) : "—"}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>Tax ({taxRate}%)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{vehicularTax > 0 ? fmtN(vehicularTax) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>Fees / Reg</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{(titleFees + unusedReg) > 0 ? fmtN(titleFees + unusedReg) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>Deductible</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: deductible > 0 ? "#EF4444" : "#CBD5E1" }}>{deductible > 0 ? `-${fmtN(deductible)}` : "—"}</span>
          </div>

          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 14px", margin: "12px 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Total Award</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>{totalAward > 0 ? fmtN(totalAward) : "—"}</div>
          </div>

          {insurerStarting > 0 && netValue > 0 && (
            <div style={{ background: netValue > insurerStarting ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, padding: "8px 12px", marginBottom: 12, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>vs Insurer</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: netValue > insurerStarting ? "#16A34A" : "#EF4444" }}>
                {netValue > insurerStarting ? "+" : ""}{fmtN(netValue - insurerStarting)}
              </div>
            </div>
          )}

          {/* Award Form Tool */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Award Tool</p>
            <button
              onClick={handleGenerateAwardForm}
              disabled={!acvAward || generatingAward}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: acvAward ? "#FF8600" : "#F8FAFC", border: acvAward ? "none" : "1px dashed #CBD5E1", borderRadius: 10, padding: "12px", cursor: acvAward ? "pointer" : "not-allowed", color: acvAward ? "#FFFFFF" : "#94A3B8", fontSize: 12, fontWeight: 700, opacity: generatingAward ? 0.7 : 1 }}>
              {generatingAward ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Award size={13} /> Generate ACV Award Form</>}
            </button>
            {awardFormResult && (
              <div style={{ marginTop: 8, fontSize: 11, color: awardFormResult.startsWith("✓") ? "#16A34A" : "#EF4444", fontWeight: 600, textAlign: "center" }}>{awardFormResult}</div>
            )}
            {awardId && insurerAppraiser && (
              <button
                onClick={async () => {
                  setSendingSig(true);
                  setSigSentResult(null);
                  try {
                    const vehicleStr = [vehYear, vehMake, vehModel, vehTrim].filter(Boolean).join(" ");
                    const res = await fetch("/api/send-award-signature", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        awardId,
                        insurerAppraiser,
                        insurerEmail: "",
                        insurerPhone: "",
                        umpire: umpire || undefined,
                        claimNumber,
                        vehicle: vehicleStr,
                        acvAward,
                      }),
                    });
                    const data = await res.json();
                    if (data.ok) {
                      setSigSentResult(`✓ Signature request sent to ${insurerAppraiser}`);
                    } else {
                      setSigSentResult(data.error || "Failed to send");
                    }
                  } catch { setSigSentResult("Error — could not send signature request"); }
                  setSendingSig(false);
                }}
                disabled={sendingSig}
                style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "9px", cursor: "pointer", color: "#1D4ED8", fontSize: 11, fontWeight: 700, opacity: sendingSig ? 0.7 : 1 }}>
                {sendingSig ? "Sending…" : "📨 Send for Signature"}
              </button>
            )}
            {sigSentResult && (
              <div style={{ marginTop: 6, fontSize: 11, color: sigSentResult.startsWith("✓") ? "#16A34A" : "#EF4444", fontWeight: 600, textAlign: "center" }}>{sigSentResult}</div>
            )}
            {!acvAward && <p style={{ fontSize: 10, color: "#CBD5E1", textAlign: "center", marginTop: 6 }}>Enter award amount above to enable</p>}
          </div>

          {/* ── Report PDF ─────────────────────────────── */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Valuation Report</p>
            <button
              onClick={async () => {
                try {
                  const state = latestStateRef.current;
                  const res = await fetch("/api/generate-acv-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(state),
                  });
                  if (!res.ok) throw new Error("PDF generation failed");
                  const blob = await res.blob();
                  const veh = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join("_");
                  const claim = (state.claimNumber as string || "DRAFT").replace(/\s+/g, "_");
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `ACV_${claim}_${veh}.pdf`; a.click();
                  URL.revokeObjectURL(url);
                } catch (e) { alert("PDF error: " + e); }
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#147EFA", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", color: "#FFFFFF", fontSize: 12, fontWeight: 700 }}
            >
              <FileText size={13} /> Generate Report PDF
            </button>
          </div>

          {/* ── ACV Bundle ─────────────────────────────── */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>ACV Bundle (Send to OA)</p>
            <p style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8, lineHeight: 1.4 }}>Cover + comps + invoices + photos — merged into one PDF</p>
            <button
              onClick={handleGenerateBundle}
              disabled={generatingBundle}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: generatingBundle ? "#F1F5F9" : "#7c3aed", border: "none", borderRadius: 10, padding: "12px", cursor: generatingBundle ? "not-allowed" : "pointer", color: generatingBundle ? "#94A3B8" : "#FFFFFF", fontSize: 12, fontWeight: 700, opacity: generatingBundle ? 0.8 : 1 }}
            >
              {generatingBundle
                ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Building bundle…</>
                : <>📦 Generate ACV Bundle</>}
            </button>
            {!selectedClaimId && <p style={{ fontSize: 10, color: "#CBD5E1", textAlign: "center", marginTop: 6 }}>Load a case to attach invoices & photos</p>}
            {selectedClaimId && (caseAttachments ?? []).length > 0 && (
              <p style={{ fontSize: 10, color: "#16A34A", textAlign: "center", marginTop: 6, fontWeight: 600 }}>
                {(caseAttachments ?? []).length} attachment{(caseAttachments ?? []).length > 1 ? "s" : ""} ready to bundle
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
