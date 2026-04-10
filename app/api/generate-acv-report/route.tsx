import { NextRequest, NextResponse } from "next/server";
import ReactPDF, { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { saveReportToDrive } from "@/lib/drive";

const fmt  = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

const S = StyleSheet.create({
  page:        { fontFamily: "Helvetica", fontSize: 9, padding: "28 42", color: "#1e293b", backgroundColor: "#ffffff" },
  // Header
  headerWrap:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "#FF8600" },
  logo1:       { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f172a", letterSpacing: 1 },
  logo2:       { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FF8600", letterSpacing: 0.5 },
  logoSub:     { fontSize: 8, color: "#64748b", marginTop: 3, letterSpacing: 0.8 },
  metaRight:   { alignItems: "flex-end" },
  metaRow:     { fontSize: 8, color: "#64748b", marginBottom: 2 },
  metaNum:     { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#147EFA", marginBottom: 2 },
  // Section titles
  secTitle:    { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", backgroundColor: "#0f172a", padding: "3 8", marginBottom: 6, marginTop: 16, letterSpacing: 0.8, textTransform: "uppercase" },
  // Two-col rows
  row2:        { flexDirection: "row", gap: 10, marginBottom: 8 },
  row3:        { flexDirection: "row", gap: 10, marginBottom: 8 },
  fieldBlock:  { flex: 1 },
  fLabel:      { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  fValue:      { fontSize: 9, color: "#1e293b", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 2 },
  // Cover letter
  letterBody:  { fontSize: 8.5, color: "#334155", lineHeight: 1.5, marginBottom: 8 },
  // Table
  tHead:       { flexDirection: "row", backgroundColor: "#0f172a", padding: "5 6", marginBottom: 0 },
  tRow:        { flexDirection: "row", borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#e2e8f0", padding: "4 6" },
  tRowAlt:     { flexDirection: "row", borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#e2e8f0", padding: "4 6", backgroundColor: "#f8fafc" },
  tTotalRow:   { flexDirection: "row", backgroundColor: "#fff7ed", borderWidth: 0.5, borderColor: "#fed7aa", padding: "6 6" },
  th:          { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.4 },
  td:          { fontSize: 8, color: "#334155" },
  // Adjustment rows
  adjHead:     { flexDirection: "row", backgroundColor: "#f1f5f9", padding: "3 6", marginBottom: 0, borderWidth: 0.5, borderColor: "#e2e8f0" },
  adjRow:      { flexDirection: "row", padding: "3 6", borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#e2e8f0" },
  adjRowAlt:   { flexDirection: "row", padding: "3 6", borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#e2e8f0", backgroundColor: "#fafafa" },
  adjSubtotal: { flexDirection: "row", padding: "4 6", backgroundColor: "#eff6ff", borderWidth: 0.5, borderColor: "#bfdbfe", marginBottom: 10 },
  adjTh:       { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  adjTd:       { fontSize: 8, color: "#334155" },
  // Summary
  summaryBox:  { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 3, padding: "12 14", marginTop: 8, marginBottom: 4 },
  sumRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#fed7aa" },
  sumLabel:    { fontSize: 8.5, color: "#64748b" },
  sumVal:      { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#334155" },
  acvBox:      { backgroundColor: "#FF8600", borderRadius: 3, padding: "12 14", marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  acvLabel:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  acvVal:      { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  // Footer
  footer:      { position: "absolute", bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  footerTxt:   { fontSize: 7, color: "#94a3b8" },
});

function AcvReport({ state }: { state: any }) {
  const {
    carrier, claimNumber, examiner, dateOfLoss,
    ownerName, ownerAddress, ownerCSZ,
    insuredAppraiser, insurerAppraiser, umpire,
    vehYear, vehMake, vehModel, vehTrim, vehPackages, vin, mileage,
    subjectState, cszCity,
    mileageRate = 0.02,
    comps = [], maintRows = [], afterRows = [],
    updAmount = 0, updNotes = "",
    condAmount = 0, condNotes = "",
  } = state;

  // Get today's date in Pacific Time (UTC-7/8)
  const today = new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric",
    timeZone: "America/Los_Angeles"
  });
  const vehicleStr = [vehYear, vehMake, vehModel, vehTrim, vehPackages].filter(Boolean).join(" ");
  const locationStr = [cszCity, subjectState].filter(Boolean).join(", ");

  // Calculations
  const netVal  = (r: any) => Math.max(0, (r.cost || 0) * (1 - (r.depPct || 0) / 100));
  const depAmt  = (r: any) => (r.cost || 0) * ((r.depPct || 0) / 100);
  const mAdj    = (c: any) => ((mileage || 0) - c.compMileage) * mileageRate;
  const adjVal  = (c: any) => c.askingPrice + mAdj(c) + (c.otherAdj || 0);

  const acceptedComps = comps.filter((c: any) => c.askingPrice > 0 && c.accepted !== false);
  const compAvg   = acceptedComps.length > 0
    ? acceptedComps.reduce((s: number, c: any) => s + adjVal(c), 0) / acceptedComps.length : 0;
  const maintTotal = maintRows.reduce((s: number, r: any) => s + netVal(r), 0);
  const afterTotal = afterRows.reduce((s: number, r: any) => s + netVal(r), 0);
  const netValue   = compAvg + maintTotal + afterTotal - Math.abs(updAmount) + condAmount;

  return (
    <Document>
      <Page size="LETTER" style={S.page}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <View style={S.headerWrap}>
          <View>
            <Text style={S.logo1}>CLAIMS.COACH</Text>
            <Text style={S.logoSub}>ACTUAL CASH VALUE REPORT</Text>
          </View>
          <View style={S.metaRight}>
            {claimNumber && <Text style={S.metaNum}>Claim #{claimNumber}</Text>}
            <Text style={S.metaRow}>Date of Report: {today}</Text>
            {dateOfLoss  && <Text style={S.metaRow}>Date of Loss: {dateOfLoss}</Text>}
            {carrier     && <Text style={S.metaRow}>Carrier: {carrier}</Text>}
            {examiner    && <Text style={S.metaRow}>Examiner: {examiner}</Text>}
          </View>
        </View>

        {/* ── VEHICLE & PARTY INFO ─────────────────────────────────── */}
        <Text style={S.secTitle}>Subject Vehicle</Text>
        <View style={S.row2}>
          <View style={S.fieldBlock}>
            <Text style={S.fLabel}>Year / Make / Model / Trim</Text>
            <Text style={S.fValue}>{vehicleStr || "—"}</Text>
          </View>
          <View style={S.fieldBlock}>
            <Text style={S.fLabel}>VIN</Text>
            <Text style={S.fValue}>{vin || "—"}</Text>
          </View>
          <View style={{ flex: 0.6 }}>
            <Text style={S.fLabel}>Odometer</Text>
            <Text style={S.fValue}>{(mileage || 0).toLocaleString()} mi</Text>
          </View>
        </View>
        <View style={S.row2}>
          <View style={S.fieldBlock}>
            <Text style={S.fLabel}>Insured / Owner</Text>
            <Text style={S.fValue}>{ownerName || "—"}</Text>
          </View>
          <View style={{ flex: 2 }}>
            <Text style={S.fLabel}>Address</Text>
            <Text style={S.fValue}>{[ownerAddress, ownerCSZ].filter(Boolean).join(", ") || "—"}</Text>
          </View>
        </View>
        <View style={S.row2}>
          <View style={S.fieldBlock}>
            <Text style={S.fLabel}>Insured's Appraiser</Text>
            <Text style={S.fValue}>{insuredAppraiser || "Johnny Walker"}</Text>
          </View>
        </View>

        {/* ── COVER LETTER ─────────────────────────────────────────── */}
        <Text style={S.secTitle}>Valuation Statement</Text>
        <Text style={S.letterBody}>
          This report has been prepared by Claims.Coach on behalf of {ownerName || "the insured"} in connection with the total loss claim for the above-described vehicle
          {claimNumber ? ` (Claim #${claimNumber})` : ""}{dateOfLoss ? `, with a reported date of loss of ${dateOfLoss}` : ""}. The valuation methodology employed herein utilizes actual market comparable sales and active listings to establish the pre-loss Actual Cash Value (ACV) of the subject {vehicleStr || "vehicle"}.
        </Text>
        <Text style={S.letterBody}>
          The comparable vehicles presented in this report were selected based on similarity of year, make, model, trim level, and geographic market{locationStr ? ` (${locationStr} region)` : ""}. Each comparable has been adjusted for mileage differential and any relevant equipment or condition differences to arrive at an adjusted market value. The weighted analysis of these comparables, combined with documented vehicle-specific adjustments for aftermarket equipment, recent maintenance and refurbishments, unrepaired prior damage, and condition factors, supports the ACV determination set forth herein.
        </Text>
        <Text style={S.letterBody}>
          This report is prepared for use in the appraisal and negotiation process and reflects the appraiser's opinion of value as of the date of loss. All comparable data is sourced from publicly available market listings and reflects current regional market conditions.
        </Text>

        {/* ── COMPARABLE VEHICLES ──────────────────────────────────── */}
        <Text style={S.secTitle}>Market Comparable Vehicles</Text>
        <View style={S.tHead}>
          {[["#",0.3],["Vehicle Description",2.8],["Source / URL",1.2],["Asking",0.9],["Miles",0.7],["Mi Adj",0.7],["Other Adj",0.7],["Note",1.1],["Adj Value",0.9]].map(([h, f]: any, i) => (
            <Text key={i} style={{ ...S.th, flex: f }}>{h}</Text>
          ))}
        </View>
        {acceptedComps.length === 0 && (
          <View style={S.tRow}><Text style={{ ...S.td, color: "#94a3b8" }}>No comparable vehicles entered</Text></View>
        )}
        {acceptedComps.map((c: any, i: number) => {
          const ma = mAdj(c);
          const av = adjVal(c);
          const RowStyle = i % 2 === 0 ? S.tRow : S.tRowAlt;
          return (
            <View key={i} style={RowStyle}>
              <Text style={{ ...S.td, flex: 0.3, fontFamily: "Helvetica-Bold" }}>C{i+1}</Text>
              <Text style={{ ...S.td, flex: 2.8 }}>{c.description || "—"}</Text>
              <Text style={{ ...S.td, flex: 1.2, color: "#147EFA", fontSize: 7 }}>{c.url ? c.url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 28) + "…" : "—"}</Text>
              <Text style={{ ...S.td, flex: 0.9 }}>{fmt(c.askingPrice)}</Text>
              <Text style={{ ...S.td, flex: 0.7 }}>{(c.compMileage || 0).toLocaleString()}</Text>
              <Text style={{ ...S.td, flex: 0.7, color: ma >= 0 ? "#16a34a" : "#ef4444" }}>{fmt(ma)}</Text>
              <Text style={{ ...S.td, flex: 0.7 }}>{c.otherAdj ? fmt(c.otherAdj) : "—"}</Text>
              <Text style={{ ...S.td, flex: 1.1, fontSize: 7, color: "#64748b" }}>{c.otherAdjNote || ""}</Text>
              <Text style={{ ...S.td, flex: 0.9, fontFamily: "Helvetica-Bold", color: "#0f172a" }}>{fmt(av)}</Text>
            </View>
          );
        })}
        {acceptedComps.length > 0 && (
          <View style={S.tTotalRow}>
            <Text style={{ ...S.th, flex: 5.3, color: "#FF8600", fontSize: 8 }}>COMPARABLES AVERAGE</Text>
            <Text style={{ ...S.th, flex: 4, color: "#FF8600", fontSize: 10, textAlign: "right" }}>{fmt(compAvg)}</Text>
          </View>
        )}

        {/* ── VALUE ADJUSTMENTS — MAINTENANCE ─────────────────────── */}
        {maintRows.filter((r: any) => r.cost > 0).length > 0 && (<View wrap={false}>
          <Text style={S.secTitle}>Value Adjustments — Maintenance &amp; Refurbishments</Text>
          <View style={S.adjHead}>
            {[["Category",1.2],["Item(s)",2],["Date",0.8],["Cost",0.8],["Dep %",0.6],["Dep Amt",0.8],["Net Value",0.8]].map(([h,f]: any,i) => (
              <Text key={i} style={{ ...S.adjTh, flex: f }}>{h}</Text>
            ))}
          </View>
          {maintRows.filter((r: any) => r.cost > 0).map((r: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? S.adjRow : S.adjRowAlt}>
              <Text style={{ ...S.adjTd, flex: 1.2 }}>{r.category || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 2 }}>{r.items || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, color: "#64748b" }}>{r.date || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8 }}>{fmt(r.cost || 0)}</Text>
              <Text style={{ ...S.adjTd, flex: 0.6, color: "#ef4444" }}>{r.depPct || 0}%</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, color: "#ef4444" }}>{r.depPct > 0 ? `-${fmt(depAmt(r))}` : "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, fontFamily: "Helvetica-Bold", color: "#147EFA" }}>{fmt(netVal(r))}</Text>
            </View>
          ))}
          <View style={S.adjSubtotal}>
            <Text style={{ ...S.adjTh, flex: 5.6 }}>MAINTENANCE SUBTOTAL</Text>
            <Text style={{ ...S.adjTh, flex: 2.4, color: "#147EFA", fontSize: 9, textAlign: "right" }}>{fmt(maintTotal)}</Text>
          </View>
        </View>)}

        {/* ── VALUE ADJUSTMENTS — AFTERMARKET ─────────────────────── */}
        {afterRows.filter((r: any) => r.cost > 0).length > 0 && (<View wrap={false}>
          <Text style={S.secTitle}>Value Adjustments — Aftermarket Parts &amp; Equipment</Text>
          <View style={S.adjHead}>
            {[["Category",1.2],["Item(s)",2],["Date",0.8],["Cost",0.8],["Dep %",0.6],["Dep Amt",0.8],["Net Value",0.8]].map(([h,f]: any,i) => (
              <Text key={i} style={{ ...S.adjTh, flex: f }}>{h}</Text>
            ))}
          </View>
          {afterRows.filter((r: any) => r.cost > 0).map((r: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? S.adjRow : S.adjRowAlt}>
              <Text style={{ ...S.adjTd, flex: 1.2 }}>{r.category || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 2 }}>{r.items || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, color: "#64748b" }}>{r.date || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8 }}>{fmt(r.cost || 0)}</Text>
              <Text style={{ ...S.adjTd, flex: 0.6, color: "#ef4444" }}>{r.depPct || 0}%</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, color: "#ef4444" }}>{r.depPct > 0 ? `-${fmt(depAmt(r))}` : "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 0.8, fontFamily: "Helvetica-Bold", color: "#FF8600" }}>{fmt(netVal(r))}</Text>
            </View>
          ))}
          <View style={{ ...S.adjSubtotal, backgroundColor: "#fff7ed", borderColor: "#fed7aa" }}>
            <Text style={{ ...S.adjTh, flex: 5.6 }}>AFTERMARKET SUBTOTAL</Text>
            <Text style={{ ...S.adjTh, flex: 2.4, color: "#FF8600", fontSize: 9, textAlign: "right" }}>{fmt(afterTotal)}</Text>
          </View>
        </View>)}

        {/* ── OTHER ADJUSTMENTS ────────────────────────────────────── */}
        {(Math.abs(updAmount) > 0 || condAmount !== 0) && (<View wrap={false}>
          <Text style={S.secTitle}>Other Adjustments</Text>
          {Math.abs(updAmount) > 0 && (
            <View style={{ ...S.adjRow, marginBottom: 4 }}>
              <Text style={{ ...S.adjTd, flex: 1.5, fontFamily: "Helvetica-Bold" }}>Unrepaired Prior Damage (UPD)</Text>
              <Text style={{ ...S.adjTd, flex: 3, color: "#64748b" }}>{updNotes || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 1, color: "#ef4444", fontFamily: "Helvetica-Bold" }}>-{fmt(Math.abs(updAmount))}</Text>
            </View>
          )}
          {condAmount !== 0 && (
            <View style={S.adjRow}>
              <Text style={{ ...S.adjTd, flex: 1.5, fontFamily: "Helvetica-Bold" }}>Condition / Date of Loss</Text>
              <Text style={{ ...S.adjTd, flex: 3, color: "#64748b" }}>{condNotes || "—"}</Text>
              <Text style={{ ...S.adjTd, flex: 1, color: condAmount >= 0 ? "#16a34a" : "#ef4444", fontFamily: "Helvetica-Bold" }}>{condAmount >= 0 ? "+" : ""}{fmt(condAmount)}</Text>
            </View>
          )}
        </View>)}

        {/* ── VALUATION SUMMARY — kept together, no orphan header ─── */}
        <View wrap={false}>
          <Text style={S.secTitle}>Valuation Summary</Text>
          <View style={S.summaryBox}>
            {[
              { label: "Comparables Average",           val: fmt(compAvg),                                                    show: true },
              { label: "Maintenance & Refurbishments",  val: `+${fmt(maintTotal)}`,                                           show: maintTotal > 0 },
              { label: "Aftermarket Equipment",         val: `+${fmt(afterTotal)}`,                                           show: afterTotal > 0 },
              { label: "Unrepaired Prior Damage (UPD)", val: `-${fmt(Math.abs(updAmount))}`,                                  show: Math.abs(updAmount) > 0 },
              { label: "Condition / Date of Loss Adj",  val: condAmount >= 0 ? `+${fmt(condAmount)}` : fmt(condAmount),       show: condAmount !== 0 },
            ].filter(r => r.show).map(({ label, val }) => (
              <View key={label} style={S.sumRow}>
                <Text style={S.sumLabel}>{label}</Text>
                <Text style={S.sumVal}>{val}</Text>
              </View>
            ))}
          </View>
          <View style={S.acvBox}>
            <Text style={S.acvLabel}>ACTUAL CASH VALUE</Text>
            <Text style={S.acvVal}>{fmt(netValue)}</Text>
          </View>
        </View>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerTxt}>Claims.Coach  ·  claims.coach</Text>
          <Text style={S.footerTxt}>ACV Report — {vehicleStr || "Vehicle"} — Claim #{claimNumber || "DRAFT"}</Text>
          <Text style={S.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

async function beatConvex(path: string, args: Record<string, unknown>) {
  try {
    await fetch("https://calm-warbler-536.convex.cloud/api/mutation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* non-blocking */ }
}

export async function POST(req: NextRequest) {
  try {
    const state = await req.json();
    const vehStr = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join(" ");
    beatConvex("agents:setWorking", { name: "Report Agent", task: `Generating ACV report: ${vehStr}` });
    const stream = await ReactPDF.renderToStream(<AcvReport state={state} />);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdf = Buffer.concat(chunks);
    const vehSlug = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join("_").replace(/\s+/g, "_");
    const claim   = (state.claimNumber || "DRAFT").replace(/[^a-zA-Z0-9-]/g, "_");
        beatConvex("agents:completeTask", { name: "Report Agent", result: `ACV report generated: ${vehStr}` });
    // Track report generation (no external AI in PDF render, but log the event)
    fetch("https://calm-warbler-536.convex.cloud/api/mutation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "aiUsage:log", args: { ts: Date.now(), provider: "anthropic", model: "react-pdf", agentName: "Report Agent", route: "generate-acv-report", success: true }, format: "json" }),
    }).catch(() => {});
    // Auto-save to Google Drive (fire-and-forget)
    const vehForDrive = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join(" ");
    saveReportToDrive(pdf, state.claimNumber || "", state.ownerName || "", vehForDrive).catch(() => {});

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ACV_${claim}_${vehSlug}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-acv-report error:", err);
    beatConvex("agents:completeTask", { name: "Report Agent" });
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
