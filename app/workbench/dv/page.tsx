"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Plus, Trash2, Copy, Check, Save, Search, ChevronDown, ChevronUp, Cloud, CloudOff, TrendingDown } from "lucide-react";

// ── Styles ────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, marginBottom: 16 };
const row: React.CSSProperties = { display: "flex", gap: 12, marginBottom: 12 };
const fmt  = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, minWidth: 0 }}><label style={lbl}>{label}</label>{children}</div>;
}
function Section({ id, title, color = "#FF8600", children, defaultOpen = true }: { id: string; title: string; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: open ? "10px 10px 0 0" : 10, padding: "12px 20px", cursor: "pointer", borderBottom: open ? "none" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 16, background: color, borderRadius: 2 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
      </button>
      {open && <div style={{ border: "1px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "20px 20px 8px", background: "#FFFFFF", marginBottom: 16 }}>{children}</div>}
      {!open && <div style={{ marginBottom: 16 }} />}
    </div>
  );
}

interface Comp { description: string; url: string; price: number; mileage: number; }
const emptyComp = (): Comp => ({ description: "", url: "", price: 0, mileage: 0 });

// Damage severity multipliers (market-based, not 17c)
const DAMAGE_LEVELS: { label: string; pct: number }[] = [
  { label: "Minor (cosmetic only)", pct: 0.03 },
  { label: "Moderate (panel replacement, no structural)", pct: 0.07 },
  { label: "Significant (structural, frame, airbags)", pct: 0.13 },
  { label: "Severe (major structural, totaled-adjacent)", pct: 0.20 },
];

export default function DVWorkbench() {
  // ── Case Selector ────────────────────────────────────────────────────────
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch]           = useState("");
  const [showCasePicker, setShowCasePicker]   = useState(false);
  const [syncStatus, setSyncStatus]           = useState<"saved"|"saving"|"unsaved"|"idle">("idle");
  const saveToConvex = useMutation(api.valuations.upsert);
  const activeClaims = useQuery(api.claims.list, {});
  const existingVal  = useQuery(api.valuations.getByClaimId, selectedClaimId ? { claimId: selectedClaimId, claimType: "DV" } : "skip");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Intake ───────────────────────────────────────────────────────────────
  const [carrier, setCarrier]               = useState("");
  const [claimNumber, setClaimNumber]       = useState("");
  const [examiner, setExaminer]             = useState("");
  const [dateOfLoss, setDateOfLoss]         = useState("");
  const [dateOfReport, setDateOfReport]     = useState("");
  const [ownerName, setOwnerName]           = useState("");
  const [ownerAddress, setOwnerAddress]     = useState("");
  const [ownerCSZ, setOwnerCSZ]             = useState("");
  const [atFaultParty, setAtFaultParty]     = useState("");
  const [atFaultCarrier, setAtFaultCarrier] = useState("");
  const [coverageType, setCoverageType]     = useState("Third Party / At-Fault");
  const [vehYear, setVehYear]               = useState("");
  const [vehMake, setVehMake]               = useState("");
  const [vehModel, setVehModel]             = useState("");
  const [vehTrim, setVehTrim]               = useState("");
  const [vin, setVin]                       = useState("");
  const [mileage, setMileage]               = useState(0);
  const [preAccidentValue, setPreAccidentValue] = useState(0);
  const [repairCost, setRepairCost]         = useState(0);
  const [repairShop, setRepairShop]         = useState("");
  const [repairCompletedDate, setRepairCompletedDate] = useState("");
  const [insurerDVOffer, setInsurerDVOffer] = useState(0);

  // ── Vehicle History / Condition ──────────────────────────────────────────
  const [structuralDamage, setStructuralDamage]  = useState(false);
  const [airbagDeployed, setAirbagDeployed]      = useState(false);
  const [frameRail, setFrameRail]                = useState(false);
  const [floodFire, setFloodFire]                = useState(false);
  const [priorAccidents, setPriorAccidents]       = useState(0);
  const [preAccidentCondition, setPreAccidentCondition] = useState("Excellent");
  const [damageDesc, setDamageDesc]              = useState("");
  const [repairNotes, setRepairNotes]            = useState("");
  const [carfaxFlags, setCarfaxFlags]            = useState("");

  // ── Market Research ──────────────────────────────────────────────────────
  const [comps, setComps]             = useState<Comp[]>([emptyComp(), emptyComp(), emptyComp()]);
  const updateComp = (i: number, k: keyof Comp, v: string | number) => setComps(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const filledComps  = comps.filter(c => c.price > 0);
  const compAvgPrice = filledComps.length > 0 ? filledComps.reduce((s, c) => s + c.price, 0) / filledComps.length : 0;

  // ── DV Calculation (market-based) ────────────────────────────────────────
  const [damageLevelIdx, setDamageLevelIdx]     = useState(1);
  const [mktConditionPct, setMktConditionPct]   = useState(1.0);
  const [vehicleDesirabilityPct, setVehicleDesirabilityPct] = useState(1.0);
  const [manualDVOverride, setManualDVOverride] = useState<number | null>(null);
  const baseValue    = preAccidentValue || compAvgPrice;
  const damagePct    = DAMAGE_LEVELS[damageLevelIdx].pct;
  const calcDV       = baseValue * damagePct * mktConditionPct * vehicleDesirabilityPct;
  const dvAmount     = manualDVOverride !== null ? manualDVOverride : calcDV;
  const dvPct        = baseValue > 0 ? (dvAmount / baseValue) * 100 : 0;

  // ── Results ──────────────────────────────────────────────────────────────
  const [awardedDV, setAwardedDV]               = useState(0);
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [awardDate, setAwardDate]               = useState("");
  const [genReport, setGenReport]               = useState("");
  const [genDemand, setGenDemand]               = useState("");
  const [genEmail, setGenEmail]                 = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingDemand, setGeneratingDemand] = useState(false);
  const [generatingEmail, setGeneratingEmail]   = useState(false);
  const [copied, setCopied]                     = useState<string | null>(null);
  const copyText = async (text: string, key: string) => { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };

  // ── Load from Convex ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!existingVal?.workbenchData) return;
    try {
      const s = JSON.parse(existingVal.workbenchData);
      if (s.carrier)              setCarrier(s.carrier);
      if (s.claimNumber)          setClaimNumber(s.claimNumber);
      if (s.examiner)             setExaminer(s.examiner);
      if (s.dateOfLoss)           setDateOfLoss(s.dateOfLoss);
      if (s.ownerName)            setOwnerName(s.ownerName);
      if (s.ownerAddress)         setOwnerAddress(s.ownerAddress);
      if (s.vin)                  setVin(s.vin);
      if (s.vehYear)              setVehYear(s.vehYear);
      if (s.vehMake)              setVehMake(s.vehMake);
      if (s.vehModel)             setVehModel(s.vehModel);
      if (s.vehTrim)              setVehTrim(s.vehTrim);
      if (s.mileage)              setMileage(s.mileage);
      if (s.preAccidentValue)     setPreAccidentValue(s.preAccidentValue);
      if (s.repairCost)           setRepairCost(s.repairCost);
      if (s.damageLevelIdx != null) setDamageLevelIdx(s.damageLevelIdx);
      if (s.mktConditionPct)      setMktConditionPct(s.mktConditionPct);
      if (s.vehicleDesirabilityPct) setVehicleDesirabilityPct(s.vehicleDesirabilityPct);
      if (s.manualDVOverride != null) setManualDVOverride(s.manualDVOverride);
      if (s.comps)                setComps(s.comps);
      if (s.awardedDV)            setAwardedDV(s.awardedDV);
      if (s.investmentAmount)     setInvestmentAmount(s.investmentAmount);
      setSyncStatus("saved");
    } catch {}
  }, [existingVal]);

  const loadClaimData = (claim: any) => {
    if (claim.clientName)   setOwnerName(claim.clientName);
    if (claim.insurer)      setAtFaultCarrier(claim.insurer);
    if (claim.adjusterName) setExaminer(claim.adjusterName);
    if (claim.vin)          setVin(claim.vin);
    if (claim.year)         setVehYear(String(claim.year));
    if (claim.make)         setVehMake(claim.make);
    if (claim.model)        setVehModel(claim.model);
    setSelectedClaimId(claim._id);
    setShowCasePicker(false);
    setSyncStatus("unsaved");
  };

  const triggerAutoSave = () => {
    if (!selectedClaimId) return;
    setSyncStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const state = { carrier, claimNumber, examiner, dateOfLoss, ownerName, ownerAddress, ownerCSZ, vehYear, vehMake, vehModel, vehTrim, vin, mileage, preAccidentValue, repairCost, damageLevelIdx, mktConditionPct, vehicleDesirabilityPct, manualDVOverride, comps, awardedDV, investmentAmount };
      try {
        await saveToConvex({ claimId: selectedClaimId, claimType: "DV", insurerOffer: insurerDVOffer || undefined, calculatedACV: dvAmount || undefined, acvGap: dvAmount && insurerDVOffer ? dvAmount - insurerDVOffer : undefined, workbenchData: JSON.stringify(state) });
        setSyncStatus("saved");
      } catch { setSyncStatus("unsaved"); }
    }, 2000);
  };

  const handleGenReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Generate a professional Diminished Value Report for Claims.Coach. Vehicle: ${vehYear} ${vehMake} ${vehModel} ${vehTrim}. VIN: ${vin}. Mileage: ${mileage.toLocaleString()}. Owner: ${ownerName}. Carrier: ${atFaultCarrier || carrier}. Claim: ${claimNumber}. Date of Loss: ${dateOfLoss}. Pre-accident value: ${fmt(baseValue)}. Repair cost: ${fmt(repairCost)}. Damage level: ${DAMAGE_LEVELS[damageLevelIdx].label}. Structural damage: ${structuralDamage}. Airbags: ${airbagDeployed}. DV calculated: ${fmt(dvAmount)} (${dvPct.toFixed(1)}% of pre-accident value). Methodology: Market-based. Do NOT use or reference the 17c formula. Include: Executive Summary, Vehicle Description, Pre-Accident Condition, Accident Details, Repair Analysis, Market Research, DV Methodology, Conclusion. WAC 284-30-391 compliant. Professional tone.` }) });
      const data = await res.json();
      setGenReport(data.content);
    } catch { setGenReport("Error — check API key"); }
    setGeneratingReport(false);
  };

  const handleGenDemand = async () => {
    setGeneratingDemand(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Generate a Diminished Value demand letter from Johnny Walker at Claims.Coach to ${atFaultCarrier || carrier || "[Carrier]"}. Claim: ${claimNumber}. Vehicle: ${vehYear} ${vehMake} ${vehModel}. VIN: ${vin}. Pre-accident value: ${fmt(baseValue)}. Repair cost: ${fmt(repairCost)}. Diminished Value: ${fmt(dvAmount)}. Coverage: ${coverageType}. Firm, professional, legally grounded tone. Reference market-based methodology.` }) });
      const data = await res.json();
      setGenDemand(data.content);
    } catch { setGenDemand("Error — check API key"); }
    setGeneratingDemand(false);
  };

  const handleGenEmail = async () => {
    setGeneratingEmail(true);
    try {
      const increase = awardedDV - insurerDVOffer;
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Write a results email from Johnny Walker at Claims.Coach to client ${ownerName.split(" ")[0] || "there"}. We recovered ${fmt(awardedDV)} in diminished value (insurer offered ${fmt(insurerDVOffer)}, increase of ${fmt(increase)}). Investment: ${fmt(investmentAmount)}. Warm, professional, celebratory but not over the top. Include next steps and offer upsell to review for any future claims.` }) });
      const data = await res.json();
      setGenEmail(data.content);
    } catch { setGenEmail("Error — check API key"); }
    setGeneratingEmail(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "#0F172A", padding: "12px 24px", flexShrink: 0, borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/workbench" style={{ color: "#475569", display: "flex", alignItems: "center" }}><ArrowLeft size={16} /></Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF8600" }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em", textTransform: "uppercase" }}>DV Workbench</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#1E2A3D", color: "#FF8600" }}>Diminished Value</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {dvAmount > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#FF8600", background: "#1A1200", padding: "4px 14px", borderRadius: 20, border: "1px solid #2A1E00" }}>DV: {fmtN(dvAmount)}</span>}
          {dvPct > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", background: "#1E293B", padding: "4px 14px", borderRadius: 20 }}>{dvPct.toFixed(1)}% of Pre-ACV</span>}
        </div>
      </div>

      {/* Case Selector */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "8px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 460 }}>
          <button onClick={() => setShowCasePicker(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: selectedClaimId ? "#FFF7ED" : "#F8FAFC", border: `1px solid ${selectedClaimId ? "#FED7AA" : "#E2E8F0"}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
            <Search size={13} color="#94A3B8" />
            <span style={{ flex: 1, fontSize: 13, color: selectedClaimId ? "#FF8600" : "#94A3B8", fontWeight: selectedClaimId ? 600 : 400, textAlign: "left" }}>
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
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#FFF7ED"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#FFFFFF"}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{c.clientName ?? "Unknown"}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.year} {c.make} {c.model} {c.vin ? `· ${c.vin}` : ""} {c.insurer ? `· ${c.insurer}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: syncStatus === "saved" ? "#16A34A" : syncStatus === "saving" ? "#FF8600" : "#94A3B8" }}>
          {syncStatus === "saved" && <><Cloud size={12} /> Saved</>}
          {syncStatus === "saving" && <><Cloud size={12} /> Saving…</>}
          {syncStatus === "unsaved" && <><CloudOff size={12} /> Unsaved</>}
          {syncStatus === "idle" && <><CloudOff size={12} /> No case loaded</>}
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* Left: Scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#F1F5F9" }} onChange={triggerAutoSave}>

          {/* ── INTAKE ────────────────────────────────────────────────── */}
          <Section id="intake" title="Intake" color="#FF8600">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Claim Info</div>
                  <div style={row}><Field label="Carrier (At-Fault)"><input style={inp} value={atFaultCarrier} onChange={e => setAtFaultCarrier(e.target.value)} /></Field></div>
                  <div style={row}>
                    <Field label="Claim Number"><input style={inp} value={claimNumber} onChange={e => setClaimNumber(e.target.value)} /></Field>
                    <Field label="Adjuster / Examiner"><input style={inp} value={examiner} onChange={e => setExaminer(e.target.value)} /></Field>
                  </div>
                  <div style={row}>
                    <Field label="Date of Loss"><input type="date" style={inp} value={dateOfLoss} onChange={e => setDateOfLoss(e.target.value)} /></Field>
                    <Field label="Report Date"><input type="date" style={inp} value={dateOfReport} onChange={e => setDateOfReport(e.target.value)} /></Field>
                  </div>
                  <div style={row}><Field label="Coverage Type"><select style={inp} value={coverageType} onChange={e => setCoverageType(e.target.value)}><option>Third Party / At-Fault</option><option>UM/UIM</option><option>First Party (rare)</option></select></Field></div>
                  <div style={row}><Field label="At-Fault Party Name"><input style={inp} value={atFaultParty} onChange={e => setAtFaultParty(e.target.value)} /></Field></div>
                  <div style={row}><Field label="Insurer's DV Offer"><input type="number" style={inp} value={insurerDVOffer || ""} onChange={e => setInsurerDVOffer(parseFloat(e.target.value) || 0)} /></Field></div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Vehicle Owner</div>
                  <div style={row}><Field label="Owner Name"><input style={inp} value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field></div>
                  <div style={row}><Field label="Address"><input style={inp} value={ownerAddress} onChange={e => setOwnerAddress(e.target.value)} /></Field></div>
                  <div style={row}><Field label="City / State / Zip"><input style={inp} value={ownerCSZ} onChange={e => setOwnerCSZ(e.target.value)} /></Field></div>
                </div>
              </div>
              <div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Vehicle</div>
                  <div style={row}>
                    <Field label="Year"><input style={inp} value={vehYear} onChange={e => setVehYear(e.target.value)} /></Field>
                    <Field label="Make"><input style={inp} value={vehMake} onChange={e => setVehMake(e.target.value)} /></Field>
                    <Field label="Model"><input style={inp} value={vehModel} onChange={e => setVehModel(e.target.value)} /></Field>
                  </div>
                  <div style={row}><Field label="Trim / Packages"><input style={inp} value={vehTrim} onChange={e => setVehTrim(e.target.value)} /></Field></div>
                  <div style={row}><Field label="VIN"><input style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.05em" }} value={vin} onChange={e => setVin(e.target.value)} /></Field></div>
                  <div style={row}><Field label="Mileage at Loss"><input type="number" style={inp} value={mileage || ""} onChange={e => setMileage(parseFloat(e.target.value) || 0)} /></Field></div>
                  <div style={row}><Field label="Pre-Accident Value (PAV)"><input type="number" style={{ ...inp, fontWeight: 700 }} value={preAccidentValue || ""} onChange={e => setPreAccidentValue(parseFloat(e.target.value) || 0)} /></Field></div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Repair Info</div>
                  <div style={row}><Field label="Repair Shop"><input style={inp} value={repairShop} onChange={e => setRepairShop(e.target.value)} /></Field></div>
                  <div style={row}>
                    <Field label="Total Repair Cost"><input type="number" style={inp} value={repairCost || ""} onChange={e => setRepairCost(parseFloat(e.target.value) || 0)} /></Field>
                    <Field label="Repair Completed"><input type="date" style={inp} value={repairCompletedDate} onChange={e => setRepairCompletedDate(e.target.value)} /></Field>
                  </div>
                  <label style={lbl}>Repair Notes</label>
                  <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={repairNotes} onChange={e => setRepairNotes(e.target.value)} placeholder="OEM vs aftermarket parts, incomplete repairs…" />
                </div>
              </div>
            </div>
          </Section>

          {/* ── VEHICLE HISTORY & CONDITION ───────────────────────────── */}
          <Section id="condition" title="Vehicle History & Condition" color="#EF4444">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Damage Flags</div>
                {[
                  { label: "Structural Damage", val: structuralDamage, set: setStructuralDamage },
                  { label: "Airbag Deployed",   val: airbagDeployed,   set: setAirbagDeployed },
                  { label: "Frame Rail Damage",  val: frameRail,        set: setFrameRail },
                  { label: "Flood / Fire History", val: floodFire,      set: setFloodFire },
                ].map(({ label, val, set }) => (
                  <div key={label} onClick={() => set(!val)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: val ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${val ? "#FECACA" : "#E2E8F0"}`, marginBottom: 8, cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: val ? "#EF4444" : "#64748B" }}>{label}</span>
                    <div style={{ width: 18, height: 18, borderRadius: 4, background: val ? "#EF4444" : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {val && <Check size={12} color="#FFFFFF" />}
                    </div>
                  </div>
                ))}
                <div style={row}>
                  <Field label="Prior Accidents on CARFAX"><input type="number" style={inp} value={priorAccidents || ""} onChange={e => setPriorAccidents(parseInt(e.target.value) || 0)} /></Field>
                </div>
              </div>
              <div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Pre-Accident Condition</div>
                  <label style={lbl}>Condition Rating</label>
                  <select style={inp} value={preAccidentCondition} onChange={e => setPreAccidentCondition(e.target.value)}>
                    {["Excellent","Very Good","Good","Fair","Poor"].map(o => <option key={o}>{o}</option>)}
                  </select>
                  <label style={{ ...lbl, marginTop: 12 }}>Damage Description</label>
                  <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={damageDesc} onChange={e => setDamageDesc(e.target.value)} placeholder="Describe the accident damage…" />
                  <label style={{ ...lbl, marginTop: 10 }}>CARFAX / History Flags</label>
                  <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={carfaxFlags} onChange={e => setCarfaxFlags(e.target.value)} placeholder="Notable CARFAX entries…" />
                </div>
              </div>
            </div>
          </Section>

          {/* ── MARKET RESEARCH ───────────────────────────────────────── */}
          <Section id="market" title="Market Research — Comparable Vehicles" color="#7C3AED">
            <div style={{ ...card, background: "#0F172A", border: "1px solid #1E293B", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Comparable Market Average ({filledComps.length} vehicles)</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#7C3AED" }}>{compAvgPrice > 0 ? fmtN(compAvgPrice) : "—"}</span>
              </div>
              {preAccidentValue > 0 && compAvgPrice > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                  Using <span style={{ color: "#FF8600", fontWeight: 700 }}>entered PAV ({fmtN(preAccidentValue)})</span> as base value for DV calculation
                </div>
              )}
            </div>
            {comps.map((c, i) => (
              <div key={i} style={{ ...card, borderLeft: `3px solid ${c.price > 0 ? "#7C3AED" : "#E2E8F0"}`, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#7C3AED", flexShrink: 0 }}>C{i + 1}</span>
                  <input style={{ ...inp, fontWeight: 600 }} placeholder="Year Make Model Trim · Source" value={c.description} onChange={e => updateComp(i, "description", e.target.value)} />
                </div>
                <div style={row}>
                  <Field label="Listing URL"><input style={{ ...inp, color: "#147EFA" }} placeholder="https://…" value={c.url} onChange={e => updateComp(i, "url", e.target.value)} /></Field>
                  <Field label="Retail Price"><input type="number" style={inp} value={c.price || ""} onChange={e => updateComp(i, "price", parseFloat(e.target.value) || 0)} /></Field>
                  <Field label="Mileage"><input type="number" style={inp} value={c.mileage || ""} onChange={e => updateComp(i, "mileage", parseFloat(e.target.value) || 0)} /></Field>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setComps(cs => [...cs, emptyComp()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #DDD6FE", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#7C3AED", fontSize: 12, fontWeight: 600 }}>
                <Plus size={13} /> Add Comp
              </button>
              {comps.length > 1 && (
                <button onClick={() => setComps(cs => cs.slice(0, -1))} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#94A3B8", fontSize: 12 }}>
                  <Trash2 size={13} /> Remove Last
                </button>
              )}
            </div>
          </Section>

          {/* ── DV CALCULATION ────────────────────────────────────────── */}
          <Section id="calc" title="DV Calculation — Market-Based Methodology" color="#FF8600">
            <div style={{ background: "#FEF9F0", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FF8600" }}>⚠️ Claims.Coach uses market-based methodology only. The 17c formula is NOT used.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Base Value */}
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Base Value (Pre-Accident)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{baseValue > 0 ? fmtN(baseValue) : "—"}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{preAccidentValue > 0 ? "From PAV entry above" : compAvgPrice > 0 ? "From comp average" : "Enter PAV or comps"}</div>
                {repairCost > 0 && baseValue > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#F1F5F9", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#64748B" }}>Repair-to-Value Ratio: <strong>{((repairCost / baseValue) * 100).toFixed(1)}%</strong></div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{">"} 30% = significant stigma</div>
                  </div>
                )}
              </div>
              {/* Damage Level */}
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Damage Severity</div>
                {DAMAGE_LEVELS.map((d, i) => (
                  <div key={i} onClick={() => setDamageLevelIdx(i)} style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 6, cursor: "pointer", border: `1px solid ${damageLevelIdx === i ? "#FED7AA" : "#E2E8F0"}`, background: damageLevelIdx === i ? "#FFF7ED" : "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: damageLevelIdx === i ? "#FF8600" : "#64748B" }}>{d.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: damageLevelIdx === i ? "#FF8600" : "#94A3B8" }}>{(d.pct * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Multipliers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Market Conditions Multiplier</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="range" min={0.5} max={2.0} step={0.05} value={mktConditionPct} onChange={e => setMktConditionPct(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#FF8600" }} />
                  <input type="number" min={0.5} max={2.0} step={0.05} value={mktConditionPct} onChange={e => setMktConditionPct(parseFloat(e.target.value) || 1)} style={{ ...inp, width: 70 }} />
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>1.0 = normal · {">"} 1.0 = hot market · {"<"} 1.0 = soft market</div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Vehicle Desirability Multiplier</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="range" min={0.5} max={2.0} step={0.05} value={vehicleDesirabilityPct} onChange={e => setVehicleDesirabilityPct(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#7C3AED" }} />
                  <input type="number" min={0.5} max={2.0} step={0.05} value={vehicleDesirabilityPct} onChange={e => setVehicleDesirabilityPct(parseFloat(e.target.value) || 1)} style={{ ...inp, width: 70 }} />
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>1.0 = average · {">"} 1.0 = high-demand model · {"<"} 1.0 = niche/low demand</div>
              </div>
            </div>
            {/* Calculation display */}
            <div style={{ ...card, background: "#0F172A", border: "1px solid #1E293B" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Calculation</div>
              {[
                { label: "Base Value",                val: fmtN(baseValue) },
                { label: `× Damage (${(damagePct * 100).toFixed(0)}%)`, val: fmtN(baseValue * damagePct) },
                { label: `× Market (${mktConditionPct}×)`,              val: fmtN(baseValue * damagePct * mktConditionPct) },
                { label: `× Desirability (${vehicleDesirabilityPct}×)`, val: fmtN(calcDV) },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1E293B" }}>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{r.val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#FF8600" }}>Calculated DV</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#FF8600" }}>{fmt(calcDV)}</span>
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Manual Override (optional)</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input type="number" style={{ ...inp, fontWeight: 700, color: manualDVOverride !== null ? "#FF8600" : "#334155" }} placeholder={`Calculated: ${fmtN(calcDV)}`} value={manualDVOverride ?? ""} onChange={e => setManualDVOverride(e.target.value ? parseFloat(e.target.value) : null)} />
                {manualDVOverride !== null && <button onClick={() => setManualDVOverride(null)} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#94A3B8", fontSize: 12, flexShrink: 0 }}>Use Calculated</button>}
              </div>
              <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>Override the calculation if additional market data justifies a different figure.</p>
            </div>
          </Section>

          {/* ── RESULTS & COMMS ───────────────────────────────────────── */}
          <Section id="results" title="Results & Client Comms" color="#16A34A" defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Award Entry</div>
                <label style={lbl}>DV Awarded</label>
                <input type="number" style={{ ...inp, fontSize: 18, fontWeight: 700, color: "#FF8600" }} value={awardedDV || ""} onChange={e => setAwardedDV(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                <div style={row}>
                  <Field label="Investment"><input type="number" style={inp} value={investmentAmount || ""} onChange={e => setInvestmentAmount(parseFloat(e.target.value) || 0)} /></Field>
                  <Field label="Award Date"><input type="date" style={inp} value={awardDate} onChange={e => setAwardDate(e.target.value)} /></Field>
                </div>
              </div>
              <div style={{ ...card, background: "#0F172A", border: "1px solid #1E293B" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Results</div>
                {[
                  { label: "Insurer's Offer",    val: fmtN(insurerDVOffer) },
                  { label: "DV Awarded",         val: fmtN(awardedDV) },
                  { label: "Increase",           val: fmtN(awardedDV - insurerDVOffer) },
                  { label: "Investment",         val: fmtN(investmentAmount) },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1E293B" }}>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#FF8600" }}>Net to Client</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#FF8600" }}>{fmtN(awardedDV - investmentAmount)}</span>
                </div>
              </div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={handleGenReport} disabled={generatingReport} style={{ flex: 1, padding: "10px", background: "#FF8600", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: generatingReport ? 0.7 : 1, minWidth: 150 }}>
                  {generatingReport ? "Generating…" : "✨ Generate DV Report"}
                </button>
                <button onClick={handleGenDemand} disabled={generatingDemand} style={{ flex: 1, padding: "10px", background: "#147EFA", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: generatingDemand ? 0.7 : 1, minWidth: 150 }}>
                  {generatingDemand ? "Generating…" : "Generate Demand Letter"}
                </button>
                <button onClick={handleGenEmail} disabled={generatingEmail} style={{ flex: 1, padding: "10px", background: "#16A34A", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: generatingEmail ? 0.7 : 1, minWidth: 150 }}>
                  {generatingEmail ? "Generating…" : "Generate Client Email"}
                </button>
              </div>
              {[
                { key: "report", label: "DV Report", val: genReport, set: setGenReport },
                { key: "demand", label: "Demand Letter", val: genDemand, set: setGenDemand },
                { key: "email",  label: "Client Email",  val: genEmail,  set: setGenEmail },
              ].filter(x => x.val).map(x => (
                <div key={x.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={lbl}>{x.label}</label>
                    <button onClick={() => copyText(x.val, x.key)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12, color: copied === x.key ? "#16A34A" : "#64748B" }}>
                      {copied === x.key ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <textarea style={{ ...inp, minHeight: 200, resize: "vertical" }} value={x.val} onChange={e => x.set(e.target.value)} />
                </div>
              ))}
            </div>
          </Section>

        </div>

        {/* Right: Sticky Panel */}
        <div style={{ width: 240, flexShrink: 0, overflowY: "auto", background: "#FFFFFF", borderLeft: "1px solid #E2E8F0", padding: "20px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Live Summary</p>
          {[
            { label: "Pre-Accident Value", val: baseValue,    color: "#0F172A" },
            { label: "Repair Cost",        val: repairCost,   color: "#EF4444" },
            { label: "Repair-to-Value",    val: -1,           color: "#64748B", text: baseValue > 0 && repairCost > 0 ? `${((repairCost / baseValue) * 100).toFixed(1)}%` : "—" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.val === 0 ? "#CBD5E1" : r.color }}>{r.text ?? (r.val > 0 ? fmtN(r.val) : "—")}</span>
            </div>
          ))}
          <div style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", margin: "12px 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Damage Level</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF8600" }}>{DAMAGE_LEVELS[damageLevelIdx].label}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{(damagePct * 100).toFixed(0)}% × {mktConditionPct}× mkt × {vehicleDesirabilityPct}× desirability</div>
          </div>
          <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 14px", margin: "12px 0 4px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#FF8600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Calculated DV</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF8600" }}>{calcDV > 0 ? fmtN(calcDV) : "—"}</div>
            {dvPct > 0 && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{dvPct.toFixed(1)}% of pre-accident value</div>}
          </div>
          {manualDVOverride !== null && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#147EFA", textTransform: "uppercase" }}>Manual Override Active</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#147EFA" }}>{fmtN(manualDVOverride)}</div>
            </div>
          )}
          {insurerDVOffer > 0 && dvAmount > 0 && (
            <div style={{ background: dvAmount > insurerDVOffer ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, padding: "8px 12px", marginBottom: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase" }}>vs Insurer Offer</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: dvAmount > insurerDVOffer ? "#16A34A" : "#EF4444" }}>
                {dvAmount > insurerDVOffer ? "+" : ""}{fmtN(dvAmount - insurerDVOffer)}
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12, marginTop: 4 }}>
            <div style={{ padding: "8px 12px", background: "#FEF9F0", border: "1px solid #FED7AA", borderRadius: 8, fontSize: 11, color: "#92400E", fontWeight: 600 }}>
              ⚠️ Market-based only.<br />17c formula not used.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
