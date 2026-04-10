"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, Clock, DollarSign, Mail, ChevronDown, ChevronUp, Download } from "lucide-react";

const TIME_CATEGORIES  = ["Review", "Correspondence", "Research", "Report Writing", "Inspection", "Deposition", "Court", "Travel", "Other"];
const EXP_CATEGORIES   = ["Mileage", "Filing Fee", "Expert Fee", "Travel", "Printing", "Postage", "Other"];
const DEFAULT_RATE     = 295; // $295/hr — confirmed by Johnny 2026-03-18

const fmt  = (n: number) => "$" + n.toFixed(2);
const fmtH = (h: number) => h % 1 === 0 ? h + "h" : h.toFixed(1) + "h";

const inp: React.CSSProperties = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", background: "#FAFAFA" };
const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px" };

export default function TEPage() {
  const [caseId, setCaseId]     = useState("");
  const [tab, setTab]           = useState<"time"|"expense"|"pending">("time");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any[] | null>(null);
  const [scanError, setScanError]   = useState<string | null>(null);
  const [lookback, setLookback]     = useState(7);

  // T&E eligible roles: EXP, LIT, UMP, PROP division — auto-filter
  const TE_ROLES = ["EXP", "LIT", "UMP"];
  const allCases = useQuery(api.caseRegistry.list, {}) ?? [];
  // Cases are T&E if: role is EXP/LIT/UMP, division is PROP, or billingType is explicitly "te"
  const cases = allCases.filter((c: any) =>
    TE_ROLES.includes(c.role) || c.division === "PROP" || c.billingType === "te"
  );

  // T&E queries
  const timeEntries    = useQuery(api.timeAndExpense.listTime, caseId ? { caseId } : "skip") ?? [];
  const expenseEntries = useQuery(api.timeAndExpense.listExpenses, caseId ? { caseId } : "skip") ?? [];
  const pending        = useQuery(api.timeAndExpense.listPending, caseId ? { caseId } : {}) ?? { time: [], expense: [] };
  const summary        = useQuery(api.timeAndExpense.summary, caseId ? { caseId } : "skip");

  // Mutations
  const addTime     = useMutation(api.timeAndExpense.addTime);
  const addExpense  = useMutation(api.timeAndExpense.addExpense);
  const deleteTime  = useMutation(api.timeAndExpense.deleteTime);
  const deleteExp   = useMutation(api.timeAndExpense.deleteExpense);
  const updateTime  = useMutation(api.timeAndExpense.updateTime);
  const updateExp   = useMutation(api.timeAndExpense.updateExpense);

  // New entry form state
  const today = new Date().toISOString().split("T")[0];
  const [tDate, setTDate]   = useState(today);
  const [tCat, setTCat]     = useState(TIME_CATEGORIES[0]);
  const [tDesc, setTDesc]   = useState("");
  const [tHours, setTHours] = useState("0.5");
  const [tRate, setTRate]   = useState("295");
  const [tBill, setTBill]   = useState(true);

  const [eDate, setEDate]   = useState(today);
  const [eCat, setECat]     = useState(EXP_CATEGORIES[0]);
  const [eDesc, setEDesc]   = useState("");
  const [eAmt, setEAmt]     = useState("");
  const [eBill, setEBill]   = useState(true);

  const handleAddTime = async () => {
    if (!caseId || !tDesc || !tHours) return;
    await addTime({ caseId, date: tDate, category: tCat, description: tDesc, hours: parseFloat(tHours), rate: parseFloat(tRate) || undefined, billable: tBill, source: "manual", approved: true });
    setTDesc(""); setTHours("0.5");
  };

  const handleAddExpense = async () => {
    if (!caseId || !eDesc || !eAmt) return;
    await addExpense({ caseId, date: eDate, category: eCat, description: eDesc, amount: parseFloat(eAmt), billable: eBill, source: "manual", approved: true });
    setEDesc(""); setEAmt("");
  };

  const handleScanEmails = async () => {
    setScanning(true); setScanResult(null); setScanError(null);
    try {
      const res = await fetch("/api/parse-te-from-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: caseId || undefined, lookbackDays: lookback }),
      });
      const d = await res.json();
      if (d.error) { setScanError(d.error); return; }
      setScanResult(d.suggestions || []);
    } catch (e: any) { setScanError(e.message); }
    setScanning(false);
  };

  const handleApproveSuggestion = async (s: any) => {
    const targetCase = s.caseId || caseId;
    if (!targetCase) return;
    if (s.type === "time") {
      await addTime({ caseId: targetCase, date: s.emailDate, category: s.category, description: s.description, hours: s.hours, billable: s.billable, source: "email_parsed", emailRef: s.emailSubject, approved: true });
    } else {
      await addExpense({ caseId: targetCase, date: s.emailDate, category: s.category, description: s.description, amount: s.amount, billable: s.billable, source: "email_parsed", emailRef: s.emailSubject, approved: true });
    }
    setScanResult(prev => prev ? prev.filter(x => x !== s) : prev);
  };

  const totalBillable = (summary?.billableHours || 0) * DEFAULT_RATE + (summary?.billableExpenses || 0);

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: active ? "#0F172A" : "#F1F5F9", color: active ? "#FFFFFF" : "#64748B",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{ color: "#94A3B8", display: "flex" }}><ArrowLeft size={18} /></Link>
        <div style={{ width: 4, height: 20, background: "#147EFA", borderRadius: 2 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Time & Expenses</span>
        {summary && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 20, fontSize: 13 }}>
            <span style={{ color: "#64748B" }}>⏱ <strong>{fmtH(summary.billableHours)}</strong> billable</span>
            <span style={{ color: "#64748B" }}>💰 <strong>{fmt(summary.billableExpenses)}</strong> expenses</span>
            <span style={{ background: "#FFF7ED", color: "#FF8600", fontWeight: 700, padding: "3px 12px", borderRadius: 20, border: "1px solid #FED7AA" }}>
              Est. {fmt(totalBillable)}
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        {/* Case selector */}
        <div style={{ ...card, marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Case</label>
          <select value={caseId} onChange={e => setCaseId(e.target.value)} style={{ ...inp, marginTop: 6, fontSize: 14 }}>
            <option value="">— Select a case —</option>
            {cases.map((c: any) => (
              <option key={c._id} value={c.caseKey || c.caseId || c.fileNumber || c._id}>
                [{c.role}] {c.caseKey || c.masterCaseId} — {c.clientName || c.lastName} / {c.carrier}
              </option>
            ))}
            {allCases.filter((c: any) => !TE_ROLES.includes(c.role) && c.division !== "PROP" && c.billingType !== "te").length > 0 && (
              <optgroup label="── Other cases (flat rate) ──">
                {allCases.filter((c: any) => !TE_ROLES.includes(c.role) && c.division !== "PROP" && c.billingType !== "te").map((c: any) => (
                  <option key={c._id} value={c.caseKey || c.caseId || c._id} style={{ color: "#94A3B8" }}>
                    [{c.role}] {c.caseKey || c.masterCaseId} — {c.clientName || c.lastName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {caseId && (
            <input style={{ ...inp, marginTop: 8, fontSize: 12, color: "#94A3B8" }} value={caseId} onChange={e => setCaseId(e.target.value)} placeholder="Or type case ID manually" />
          )}
          {!caseId && (
            <input style={{ ...inp, marginTop: 8, fontSize: 12 }} value={caseId} onChange={e => setCaseId(e.target.value)} placeholder="Or type case ID manually e.g. 000421_26-AUTO-AC_Movsky_StateFarm" />
          )}
        </div>

        {/* Email scanner */}
        <div style={{ ...card, marginBottom: 20, background: "#F0F7FF", border: "1px solid #BFDBFE" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Mail size={16} color="#147EFA" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Scan Emails for T&E Suggestions</span>
            <span style={{ fontSize: 11, color: "#64748B", marginLeft: "auto" }}>Last</span>
            <select value={lookback} onChange={e => setLookback(Number(e.target.value))} style={{ border: "1px solid #BFDBFE", borderRadius: 6, padding: "3px 8px", fontSize: 12, background: "#FFFFFF" }}>
              {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
            <button onClick={handleScanEmails} disabled={scanning} style={{ background: "#147EFA", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.7 : 1 }}>
              {scanning ? "Scanning…" : "Scan Gmail"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
            Reads your recent emails, matches to {caseId ? "this case" : "any case"}, and suggests T&E entries for one-click approval.
          </p>
          {scanError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>✗ {scanError}</p>}
          {scanResult !== null && scanResult.length === 0 && <p style={{ color: "#64748B", fontSize: 12, marginTop: 8 }}>No billable activity found in recent emails.</p>}
          {scanResult && scanResult.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{scanResult.length} suggestion{scanResult.length !== 1 ? "s" : ""} — review and approve:</p>
              {scanResult.map((s, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: s.type === "time" ? "#EFF6FF" : "#FFF7ED", color: s.type === "time" ? "#147EFA" : "#FF8600", padding: "2px 8px", borderRadius: 10 }}>{s.type === "time" ? "⏱ TIME" : "💰 EXPENSE"}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{s.emailDate}</span>
                      <span style={{ fontSize: 11, color: "#64748B" }}>{s.category}</span>
                      <span style={{ fontSize: 10, color: s.confidence === "high" ? "#16A34A" : s.confidence === "medium" ? "#FF8600" : "#EF4444", fontWeight: 600 }}>{s.confidence} confidence</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#0F172A", margin: "0 0 4px" }}>{s.description}</p>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>From: {s.emailSubject}</p>
                    {s.type === "time" && <p style={{ fontSize: 12, color: "#147EFA", fontWeight: 600, margin: "4px 0 0" }}>{fmtH(s.hours)}{s.rate ? ` × ${fmt(s.rate)}/hr = ${fmt(s.hours * s.rate)}` : ""}</p>}
                    {s.type === "expense" && <p style={{ fontSize: 12, color: "#FF8600", fontWeight: 600, margin: "4px 0 0" }}>{fmt(s.amount)}</p>}
                  </div>
                  <button onClick={() => handleApproveSuggestion(s)} style={{ background: "#16A34A", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <Check size={12} style={{ marginRight: 4 }} />Approve
                  </button>
                  <button onClick={() => setScanResult(prev => prev ? prev.filter((_, j) => j !== i) : prev)} style={{ background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button style={pillStyle(tab === "time")} onClick={() => setTab("time")}><Clock size={12} style={{ marginRight: 5 }} />Time ({timeEntries.length})</button>
          <button style={pillStyle(tab === "expense")} onClick={() => setTab("expense")}><DollarSign size={12} style={{ marginRight: 5 }} />Expenses ({expenseEntries.length})</button>
          {(pending.time.length + pending.expense.length) > 0 && (
            <button style={pillStyle(tab === "pending")} onClick={() => setTab("pending")}>⏳ Pending ({pending.time.length + pending.expense.length})</button>
          )}
        </div>

        {/* Time tab */}
        {tab === "time" && (
          <div style={card}>
            {/* Add new */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 80px 80px auto auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Date</label><input type="date" style={inp} value={tDate} onChange={e => setTDate(e.target.value)} /></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Description</label><input style={inp} placeholder="What did you do?" value={tDesc} onChange={e => setTDesc(e.target.value)} /></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Category</label><select style={inp} value={tCat} onChange={e => setTCat(e.target.value)}>{TIME_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Hours</label><input type="number" step="0.1" min="0.1" style={inp} value={tHours} onChange={e => setTHours(e.target.value)} /></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Rate $</label><input type="number" style={inp} value={tRate} onChange={e => setTRate(e.target.value)} /></div>
              <div style={{ paddingTop: 18 }}><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={tBill} onChange={e => setTBill(e.target.checked)} />Billable</label></div>
              <div style={{ paddingTop: 14 }}><button onClick={handleAddTime} disabled={!caseId || !tDesc} style={{ background: "#147EFA", color: "#FFF", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, opacity: (!caseId || !tDesc) ? 0.5 : 1 }}><Plus size={14} />Add</button></div>
            </div>

            {/* List */}
            {timeEntries.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No time entries yet{caseId ? " for this case" : " — select a case"}.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8FAFC" }}>
                  {["Date","Category","Description","Hours","Rate","Amount","Billable","Src",""].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {timeEntries.map((t: any) => (
                    <tr key={t._id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px" }}>{t.date}</td>
                      <td style={{ padding: "10px" }}><span style={{ background: "#EFF6FF", color: "#147EFA", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>{t.category}</span></td>
                      <td style={{ padding: "10px", color: "#334155" }}>{t.description}</td>
                      <td style={{ padding: "10px", fontWeight: 700 }}>{fmtH(t.hours)}</td>
                      <td style={{ padding: "10px", color: "#64748B" }}>{t.rate ? `$${t.rate}/hr` : "—"}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#147EFA" }}>{t.rate ? fmt(t.hours * t.rate) : "—"}</td>
                      <td style={{ padding: "10px" }}>{t.billable ? <span style={{ color: "#16A34A", fontSize: 11, fontWeight: 700 }}>✓</span> : <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>}</td>
                      <td style={{ padding: "10px" }}>{t.source === "email_parsed" ? <Mail size={12} color="#147EFA" /> : <span style={{ fontSize: 10, color: "#CBD5E1" }}>manual</span>}</td>
                      <td style={{ padding: "10px" }}><button onClick={() => deleteTime({ id: t._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td colSpan={3} style={{ padding: "10px", fontWeight: 700, textAlign: "right", color: "#64748B" }}>Total billable:</td>
                  <td style={{ padding: "10px", fontWeight: 700 }}>{fmtH(summary?.billableHours || 0)}</td>
                  <td /><td style={{ padding: "10px", fontWeight: 800, color: "#147EFA", fontSize: 15 }}>{fmt((summary?.billableHours || 0) * DEFAULT_RATE)}</td>
                  <td colSpan={3} />
                </tr></tfoot>
              </table>
            )}
          </div>
        )}

        {/* Expense tab */}
        {tab === "expense" && (
          <div style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px auto auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Date</label><input type="date" style={inp} value={eDate} onChange={e => setEDate(e.target.value)} /></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Description</label><input style={inp} placeholder="What was the expense?" value={eDesc} onChange={e => setEDesc(e.target.value)} /></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Category</label><select style={inp} value={eCat} onChange={e => setECat(e.target.value)}>{EXP_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>Amount $</label><input type="number" step="0.01" style={inp} value={eAmt} onChange={e => setEAmt(e.target.value)} /></div>
              <div style={{ paddingTop: 18 }}><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={eBill} onChange={e => setEBill(e.target.checked)} />Billable</label></div>
              <div style={{ paddingTop: 14 }}><button onClick={handleAddExpense} disabled={!caseId || !eDesc || !eAmt} style={{ background: "#FF8600", color: "#FFF", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, opacity: (!caseId || !eDesc || !eAmt) ? 0.5 : 1 }}><Plus size={14} />Add</button></div>
            </div>
            {expenseEntries.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No expenses yet{caseId ? " for this case" : " — select a case"}.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F8FAFC" }}>
                  {["Date","Category","Description","Amount","Billable","Src",""].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {expenseEntries.map((e: any) => (
                    <tr key={e._id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px" }}>{e.date}</td>
                      <td style={{ padding: "10px" }}><span style={{ background: "#FFF7ED", color: "#FF8600", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>{e.category}</span></td>
                      <td style={{ padding: "10px", color: "#334155" }}>{e.description}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#FF8600" }}>{fmt(e.amount)}</td>
                      <td style={{ padding: "10px" }}>{e.billable ? <span style={{ color: "#16A34A", fontSize: 11, fontWeight: 700 }}>✓</span> : "—"}</td>
                      <td style={{ padding: "10px" }}>{e.source === "email_parsed" ? <Mail size={12} color="#147EFA" /> : <span style={{ fontSize: 10, color: "#CBD5E1" }}>manual</span>}</td>
                      <td><button onClick={() => deleteExp({ id: e._id })} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1" }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td colSpan={2} style={{ padding: "10px", fontWeight: 700, textAlign: "right", color: "#64748B" }}>Total billable expenses:</td>
                  <td /><td style={{ padding: "10px", fontWeight: 800, color: "#FF8600", fontSize: 15 }}>{fmt(summary?.billableExpenses || 0)}</td>
                  <td colSpan={3} />
                </tr></tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
