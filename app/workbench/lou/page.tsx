"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Plus, Trash2, Copy, Check, Search, ChevronDown, ChevronUp, Cloud, CloudOff, Clock } from "lucide-react";

// ── Styles ─────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 };
const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, marginBottom: 16 };
const row: React.CSSProperties = { display: "flex", gap: 12, marginBottom: 12 };
const fmt  = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, minWidth: 0 }}><label style={lbl}>{label}</label>{children}</div>;
}
function Section({ id, title, color = "#7C3AED", children, defaultOpen = true }: { id: string; title: string; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

interface TransportRow { date: string; type: string; description: string; cost: number; receipt: boolean; }
const emptyTransport = (): TransportRow => ({ date: "", type: "Rideshare (Uber/Lyft)", description: "", cost: 0, receipt: false });
const TRANSPORT_TYPES = ["Rideshare (Uber/Lyft)", "Taxi", "Bus/Transit", "Rental Car (OOP)", "Mileage Reimbursement", "Other"];

// Days between two dates
function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

export default function LOUWorkbench() {
  // ── Case Selector ────────────────────────────────────────────────────────
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch]           = useState("");
  const [showCasePicker, setShowCasePicker]   = useState(false);
  const [syncStatus, setSyncStatus]           = useState<"saved"|"saving"|"unsaved"|"idle">("idle");
  const saveToConvex = useMutation(api.valuations.upsert);
  const activeClaims = useQuery(api.claims.list, {});
  const existingVal  = useQuery(api.valuations.getByClaimId, selectedClaimId ? { claimId: selectedClaimId, claimType: "LOU" } : "skip");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Intake ───────────────────────────────────────────────────────────────
  const [carrier, setCarrier]           = useState("");
  const [claimNumber, setClaimNumber]   = useState("");
  const [examiner, setExaminer]         = useState("");
  const [dateOfLoss, setDateOfLoss]     = useState("");
  const [ownerName, setOwnerName]       = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [ownerCSZ, setOwnerCSZ]         = useState("");
  const [coverageType, setCoverageType] = useState("Third Party / At-Fault");
  const [vehYear, setVehYear]           = useState("");
  const [vehMake, setVehMake]           = useState("");
  const [vehModel, setVehModel]         = useState("");
  const [vehTrim, setVehTrim]           = useState("");
  const [vin, setVin]                   = useState("");
  const [insurerLOUOffer, setInsurerLOUOffer] = useState(0);
  const [louMethod, setLouMethod]       = useState("Rental Rate");

  // ── Loss Period ──────────────────────────────────────────────────────────
  const [dateTaken, setDateTaken]           = useState("");
  const [dateReturned, setDateReturned]     = useState("");
  const [rentalRateSource, setRentalRateSource] = useState("");
  const [dailyRentalRate, setDailyRentalRate]   = useState(0);
  const [manualDays, setManualDays]         = useState<number | null>(null);
  const autoDays   = daysBetween(dateTaken, dateReturned);
  const totalDays  = manualDays !== null ? manualDays : autoDays;
  const rentalTotal = totalDays * dailyRentalRate;

  // ── Additional Transportation ─────────────────────────────────────────────
  const [transportRows, setTransportRows] = useState<TransportRow[]>([]);
  const updateTransport = (i: number, k: keyof TransportRow, v: string | number | boolean) =>
    setTransportRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const transportTotal = transportRows.reduce((s, r) => s + (r.cost || 0), 0);

  // ── Storage / Diminution of Use ────────────────────────────────────────
  const [storageNotes, setStorageNotes]   = useState("");
  const [storageCost, setStorageCost]     = useState(0);
  const [diminutionNotes, setDiminutionNotes] = useState("");
  const [diminutionAmount, setDiminutionAmount] = useState(0);

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal    = rentalTotal + transportTotal + storageCost + diminutionAmount;
  const [manualTotal, setManualTotal] = useState<number | null>(null);
  const finalTotal  = manualTotal !== null ? manualTotal : subtotal;

  // ── Results ───────────────────────────────────────────────────────────────
  const [awardedLOU, setAwardedLOU]           = useState(0);
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [awardDate, setAwardDate]             = useState("");
  const [genDemand, setGenDemand]             = useState("");
  const [genEmail, setGenEmail]               = useState("");
  const [generatingDemand, setGeneratingDemand] = useState(false);
  const [generatingEmail, setGeneratingEmail]   = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copyText = async (text: string, key: string) => { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };

  // ── Load from Convex ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!existingVal?.workbenchData) return;
    try {
      const s = JSON.parse(existingVal.workbenchData);
      if (s.carrier)         setCarrier(s.carrier);
      if (s.claimNumber)     setClaimNumber(s.claimNumber);
      if (s.examiner)        setExaminer(s.examiner);
      if (s.dateOfLoss)      setDateOfLoss(s.dateOfLoss);
      if (s.ownerName)       setOwnerName(s.ownerName);
      if (s.vehYear)         setVehYear(s.vehYear);
      if (s.vehMake)         setVehMake(s.vehMake);
      if (s.vehModel)        setVehModel(s.vehModel);
      if (s.vin)             setVin(s.vin);
      if (s.dateTaken)       setDateTaken(s.dateTaken);
      if (s.dateReturned)    setDateReturned(s.dateReturned);
      if (s.dailyRentalRate) setDailyRentalRate(s.dailyRentalRate);
      if (s.manualDays != null)  setManualDays(s.manualDays);
      if (s.transportRows)   setTransportRows(s.transportRows);
      if (s.storageCost)     setStorageCost(s.storageCost);
      if (s.diminutionAmount) setDiminutionAmount(s.diminutionAmount);
      if (s.manualTotal != null) setManualTotal(s.manualTotal);
      if (s.awardedLOU)      setAwardedLOU(s.awardedLOU);
      if (s.investmentAmount) setInvestmentAmount(s.investmentAmount);
      setSyncStatus("saved");
    } catch {}
  }, [existingVal]);

  const loadClaimData = (claim: any) => {
    if (claim.clientName)   setOwnerName(claim.clientName);
    if (claim.insurer)      setCarrier(claim.insurer);
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
      const state = { carrier, claimNumber, examiner, dateOfLoss, ownerName, ownerAddress, ownerCSZ, vehYear, vehMake, vehModel, vehTrim, vin, insurerLOUOffer, dateTaken, dateReturned, dailyRentalRate, manualDays, transportRows, storageCost, diminutionAmount, manualTotal, awardedLOU, investmentAmount };
      try {
        await saveToConvex({ claimId: selectedClaimId, claimType: "LOU", insurerOffer: insurerLOUOffer || undefined, calculatedACV: finalTotal || undefined, acvGap: finalTotal && insurerLOUOffer ? finalTotal - insurerLOUOffer : undefined, workbenchData: JSON.stringify(state) });
        setSyncStatus("saved");
      } catch { setSyncStatus("unsaved"); }
    }, 2000);
  };

  const handleGenDemand = async () => {
    setGeneratingDemand(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Generate a Loss of Use demand letter from Johnny Walker at Claims.Coach to ${carrier || "[Carrier]"}. Claim: ${claimNumber}. Client: ${ownerName}. Vehicle: ${vehYear} ${vehMake} ${vehModel}. VIN: ${vin}. Date of Loss: ${dateOfLoss}. Days without vehicle: ${totalDays}. Daily rental rate: ${fmt(dailyRentalRate)}. Rental total: ${fmt(rentalTotal)}. Additional transportation: ${fmt(transportTotal)}. Storage: ${fmt(storageCost)}. Total LOU claim: ${fmt(finalTotal)}. Insurer offer: ${insurerLOUOffer > 0 ? fmt(insurerLOUOffer) : "none"}. Professional, firm tone. Reference Washington state law where applicable.` }) });
      const data = await res.json();
      setGenDemand(data.content);
    } catch { setGenDemand("Error — check API key"); }
    setGeneratingDemand(false);
  };

  const handleGenEmail = async () => {
    setGeneratingEmail(true);
    try {
      const increase = awardedLOU - insurerLOUOffer;
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `Write a results email from Johnny Walker at Claims.Coach to ${ownerName.split(" ")[0] || "the client"}. Loss of Use recovered: ${fmt(awardedLOU)}. Insurer offered: ${fmt(insurerLOUOffer)}. Increase: ${fmt(increase)}. Investment: ${fmt(investmentAmount)}. Warm, professional, concise. Include next steps.` }) });
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
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED" }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em", textTransform: "uppercase" }}>Loss of Use Workbench</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#1E2A3D", color: "#7C3AED" }}>At-Fault / UM / UIM</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {totalDays > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED", background: "#1E1532", padding: "4px 14px", borderRadius: 20, border: "1px solid #2D1F4A" }}>{totalDays} days</span>}
          {finalTotal > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", background: "#052e16", padding: "4px 14px", borderRadius: 20, border: "1px solid #14532d" }}>TOTAL: {fmtN(finalTotal)}</span>}
        </div>
      </div>

      {/* Case Selector */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "8px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 460 }}>
          <button onClick={() => setShowCasePicker(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: selectedClaimId ? "#F5F3FF" : "#F8FAFC", border: `1px solid ${selectedClaimId ? "#DDD6FE" : "#E2E8F0"}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
            <Search size={13} color="#94A3B8" />
            <span style={{ flex: 1, fontSize: 13, color: selectedClaimId ? "#7C3AED" : "#94A3B8", fontWeight: selectedClaimId ? 600 : 400, textAlign: "left" }}>
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
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F5F3FF"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#FFFFFF"}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{c.clientName ?? "Unknown"}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.year} {c.make} {c.model} {c.vin ? `· ${c.vin}` : ""} {c.insurer ? `· ${c.insurer}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: syncStatus === "saved" ? "#16A34A" : syncStatus === "saving" ? "#7C3AED" : "#94A3B8" }}>
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
          <Section id="intake" title="Intake" color="#7C3AED">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Claim Info</div>
                  <div style={row}><Field label="Carrier (At-Fault)"><input style={inp} value={carrier} onChange={e => setCarrier(e.target.value)} /></Field></div>
                  <div style={row}>
                    <Field label="Claim Number"><input style={inp} value={claimNumber} onChange={e => setClaimNumber(e.target.value)} /></Field>
                    <Field label="Adjuster / Examiner"><input style={inp} value={examiner} onChange={e => setExaminer(e.target.value)} /></Field>
                  </div>
                  <div style={row}><Field label="Date of Loss"><input type="date" style={inp} value={dateOfLoss} onChange={e => setDateOfLoss(e.target.value)} /></Field></div>
                  <div style={row}><Field label="Coverage Type"><select style={inp} value={coverageType} onChange={e => setCoverageType(e.target.value)}><option>Third Party / At-Fault</option><option>UM/UIM</option></select></Field></div>
                  <div style={row}><Field label="Insurer's LOU Offer"><input type="number" style={inp} value={insurerLOUOffer || ""} onChange={e => setInsurerLOUOffer(parseFloat(e.target.value) || 0)} /></Field></div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Vehicle Owner</div>
                  <div style={row}><Field label="Owner Name"><input style={inp} value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field></div>
                  <div style={row}><Field label="Address"><input style={inp} value={ownerAddress} onChange={e => setOwnerAddress(e.target.value)} /></Field></div>
                  <div style={row}><Field label="City / State / Zip"><input style={inp} value={ownerCSZ} onChange={e => setOwnerCSZ(e.target.value)} /></Field></div>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Vehicle</div>
                <div style={row}>
                  <Field label="Year"><input style={inp} value={vehYear} onChange={e => setVehYear(e.target.value)} /></Field>
                  <Field label="Make"><input style={inp} value={vehMake} onChange={e => setVehMake(e.target.value)} /></Field>
                  <Field label="Model"><input style={inp} value={vehModel} onChange={e => setVehModel(e.target.value)} /></Field>
                </div>
                <div style={row}><Field label="Trim"><input style={inp} value={vehTrim} onChange={e => setVehTrim(e.target.value)} /></Field></div>
                <div style={row}><Field label="VIN"><input style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.05em" }} value={vin} onChange={e => setVin(e.target.value)} /></Field></div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Calculation Method</div>
                  {["Rental Rate", "Actual Expenses", "Hybrid (Rental + Expenses)"].map(m => (
                    <div key={m} onClick={() => setLouMethod(m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 6, cursor: "pointer", border: `1px solid ${louMethod === m ? "#DDD6FE" : "#E2E8F0"}`, background: louMethod === m ? "#F5F3FF" : "#F8FAFC" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${louMethod === m ? "#7C3AED" : "#CBD5E1"}`, background: louMethod === m ? "#7C3AED" : "transparent" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: louMethod === m ? "#7C3AED" : "#64748B" }}>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── LOSS PERIOD ───────────────────────────────────────────── */}
          <Section id="period" title="Loss Period & Rental Rate" color="#7C3AED">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Period Without Vehicle</div>
                <div style={row}>
                  <Field label="Date Vehicle Taken / DOL"><input type="date" style={inp} value={dateTaken} onChange={e => setDateTaken(e.target.value)} /></Field>
                  <Field label="Date Returned / Repaired"><input type="date" style={inp} value={dateReturned} onChange={e => setDateReturned(e.target.value)} /></Field>
                </div>
                {autoDays > 0 && (
                  <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>Auto-calculated: <strong>{autoDays} days</strong></div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Based on dates entered above</div>
                  </div>
                )}
                <div style={row}>
                  <Field label="Override Days (optional)">
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="number" style={inp} placeholder={autoDays > 0 ? `Auto: ${autoDays}` : "Days"} value={manualDays ?? ""} onChange={e => setManualDays(e.target.value ? parseInt(e.target.value) : null)} />
                      {manualDays !== null && <button onClick={() => setManualDays(null)} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", cursor: "pointer", color: "#94A3B8", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>Auto</button>}
                    </div>
                  </Field>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0F172A", borderRadius: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Total Days</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#7C3AED" }}>{totalDays || "—"}</span>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Daily Rental Rate</div>
                <div style={row}><Field label="Rate Source (NADA, Enterprise, etc.)"><input style={inp} value={rentalRateSource} onChange={e => setRentalRateSource(e.target.value)} placeholder="e.g. Enterprise — Class D sedan" /></Field></div>
                <div style={row}><Field label="Daily Rate ($)"><input type="number" style={{ ...inp, fontSize: 18, fontWeight: 700, color: "#7C3AED" }} value={dailyRentalRate || ""} onChange={e => setDailyRentalRate(parseFloat(e.target.value) || 0)} placeholder="0.00" /></Field></div>
                {rentalTotal > 0 && (
                  <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "14px 16px", marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", marginBottom: 4 }}>Rental Total</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>{fmt(rentalTotal)}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{totalDays} days × {fmt(dailyRentalRate)}/day</div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── ADDITIONAL TRANSPORTATION ────────────────────────────── */}
          <Section id="transport" title="Additional Transportation Costs" color="#147EFA" defaultOpen={transportRows.length > 0}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>Uber, Lyft, taxi, bus, rental OOP — log each expense with receipt status</span>
                <button onClick={() => setTransportRows(rs => [...rs, emptyTransport()])} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#147EFA", fontSize: 12, fontWeight: 700 }}>
                  <Plus size={13} /> Add Expense
                </button>
              </div>
              {transportRows.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px", color: "#94A3B8", fontSize: 13 }}>No additional transportation expenses added.</div>
              )}
              {transportRows.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1.5fr 1fr 80px 32px", gap: 8, marginBottom: 8 }}>
                  {["Date","Type","Description","Cost","Receipt?",""].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{h}</div>)}
                </div>
              )}
              {transportRows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1.5fr 1fr 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input type="date" style={inp} value={r.date} onChange={e => updateTransport(i, "date", e.target.value)} />
                  <select style={inp} value={r.type} onChange={e => updateTransport(i, "type", e.target.value)}>
                    {TRANSPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input style={inp} value={r.description} onChange={e => updateTransport(i, "description", e.target.value)} placeholder="Description" />
                  <input type="number" style={inp} value={r.cost || ""} onChange={e => updateTransport(i, "cost", parseFloat(e.target.value) || 0)} />
                  <div onClick={() => updateTransport(i, "receipt", !r.receipt)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", background: r.receipt ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${r.receipt ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 8, padding: "8px 4px", fontSize: 11, fontWeight: 700, color: r.receipt ? "#16A34A" : "#94A3B8" }}>
                    {r.receipt ? <><Check size={11} /> Yes</> : "No"}
                  </div>
                  <button onClick={() => setTransportRows(rs => rs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}><Trash2 size={13} /></button>
                </div>
              ))}
              {transportRows.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0", borderTop: "1px solid #F1F5F9", marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#147EFA" }}>Total: {fmt(transportTotal)}</span>
                </div>
              )}
            </div>
          </Section>

          {/* ── OTHER RECOVERABLE COSTS ───────────────────────────────── */}
          <Section id="other" title="Other Recoverable Costs" color="#16A34A" defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Storage Fees</div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={storageNotes} onChange={e => setStorageNotes(e.target.value)} placeholder="Impound, storage yard, tow fees…" />
                <label style={{ ...lbl, marginTop: 10 }}>Amount</label>
                <input type="number" style={inp} value={storageCost || ""} onChange={e => setStorageCost(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Diminution of Use (Value)</div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={diminutionNotes} onChange={e => setDiminutionNotes(e.target.value)} placeholder="Loss of vehicle utility, special circumstances…" />
                <label style={{ ...lbl, marginTop: 10 }}>Amount</label>
                <input type="number" style={inp} value={diminutionAmount || ""} onChange={e => setDiminutionAmount(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </Section>

          {/* ── RESULTS & COMMS ───────────────────────────────────────── */}
          <Section id="results" title="Results & Client Comms" color="#16A34A" defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Award Entry</div>
                <label style={lbl}>LOU Awarded</label>
                <input type="number" style={{ ...inp, fontSize: 18, fontWeight: 700, color: "#7C3AED" }} value={awardedLOU || ""} onChange={e => setAwardedLOU(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                <div style={row}>
                  <Field label="Investment"><input type="number" style={inp} value={investmentAmount || ""} onChange={e => setInvestmentAmount(parseFloat(e.target.value) || 0)} /></Field>
                  <Field label="Award Date"><input type="date" style={inp} value={awardDate} onChange={e => setAwardDate(e.target.value)} /></Field>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>Total Override (optional)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" style={inp} placeholder={`Calculated: ${fmtN(subtotal)}`} value={manualTotal ?? ""} onChange={e => setManualTotal(e.target.value ? parseFloat(e.target.value) : null)} />
                    {manualTotal !== null && <button onClick={() => setManualTotal(null)} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", cursor: "pointer", color: "#94A3B8", fontSize: 11, flexShrink: 0 }}>Auto</button>}
                  </div>
                </div>
              </div>
              <div style={{ ...card, background: "#0F172A", border: "1px solid #1E293B" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 12 }}>Results</div>
                {[
                  { label: "Rental Total",      val: fmtN(rentalTotal) },
                  { label: "Transport Expenses", val: fmtN(transportTotal) },
                  { label: "Storage",            val: fmtN(storageCost) },
                  { label: "Diminution",         val: fmtN(diminutionAmount) },
                  { label: "Insurer's Offer",    val: fmtN(insurerLOUOffer) },
                  { label: "Increase",           val: fmtN(awardedLOU - insurerLOUOffer) },
                  { label: "Investment",         val: fmtN(investmentAmount) },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1E293B" }}>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>Net to Client</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#7C3AED" }}>{fmtN(awardedLOU - investmentAmount)}</span>
                </div>
              </div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={handleGenDemand} disabled={generatingDemand} style={{ flex: 1, padding: "10px", background: "#7C3AED", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: generatingDemand ? 0.7 : 1, minWidth: 150 }}>
                  {generatingDemand ? "Generating…" : "Generate Demand Letter"}
                </button>
                <button onClick={handleGenEmail} disabled={generatingEmail} style={{ flex: 1, padding: "10px", background: "#16A34A", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: generatingEmail ? 0.7 : 1, minWidth: 150 }}>
                  {generatingEmail ? "Generating…" : "Generate Client Email"}
                </button>
              </div>
              {[
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

          <div style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 4 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Days Out</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#7C3AED", marginLeft: "auto" }}>{totalDays || "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Daily Rate</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginLeft: "auto" }}>{dailyRentalRate > 0 ? fmt(dailyRentalRate) : "—"}</span>
            </div>
          </div>

          {[
            { label: "Rental Total",       val: rentalTotal,       color: "#7C3AED" },
            { label: "Transportation",     val: transportTotal,    color: "#147EFA" },
            { label: "Storage",            val: storageCost,       color: "#64748B" },
            { label: "Diminution of Use",  val: diminutionAmount,  color: "#64748B" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.val === 0 ? "#CBD5E1" : r.color }}>{r.val > 0 ? fmtN(r.val) : "—"}</span>
            </div>
          ))}

          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "12px 14px", margin: "12px 0 4px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Total LOU Claim</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>{finalTotal > 0 ? fmtN(finalTotal) : "—"}</div>
            {manualTotal !== null && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>Manual override active</div>}
          </div>

          {insurerLOUOffer > 0 && finalTotal > 0 && (
            <div style={{ background: finalTotal > insurerLOUOffer ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, padding: "8px 12px", marginTop: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase" }}>vs Insurer Offer</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: finalTotal > insurerLOUOffer ? "#16A34A" : "#EF4444" }}>
                {finalTotal > insurerLOUOffer ? "+" : ""}{fmtN(finalTotal - insurerLOUOffer)}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
