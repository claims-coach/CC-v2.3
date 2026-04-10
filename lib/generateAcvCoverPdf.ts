import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import { getStateGuideline } from "./stateGuidelines";

const NAVY   = rgb(0.078, 0.098, 0.196);
const ORANGE = rgb(1,    0.525, 0);
const BLUE   = rgb(0.08, 0.494, 0.98);      // #147EFA brand blue
const SLATE  = rgb(0.2,  0.27,  0.37);
const LIGHT  = rgb(0.96, 0.97,  0.98);
const MID    = rgb(0.886, 0.902, 0.941);    // row shade
const GREEN  = rgb(0.08, 0.55,  0.27);
const RED    = rgb(0.8,  0.1,   0.1);
const GRAY   = rgb(0.55, 0.6,   0.65);
const WHITE  = rgb(1,    1,     1);
const BLACK  = rgb(0.1,  0.1,   0.1);

const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");

function clamp(val: string | null | undefined, max: number): string {
  if (!val) return "";
  return val.length > max ? val.slice(0, max - 1) + "…" : val;
}

/** Draw an orange left-accent section header (no dark rectangle) */
function sectionHeader(p: any, bold: any, label: string, y: number, x = 50): number {
  p.drawRectangle({ x, y: y - 2, width: 3, height: 14, color: ORANGE });
  p.drawText(label.toUpperCase(), { x: x + 8, y, size: 8, font: bold, color: NAVY });
  return y - 20;
}

/** Thin horizontal rule */
function hRule(p: any, y: number, x1 = 50, x2 = 562, w = 0.5, c = MID) {
  p.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: w, color: c });
}

export async function generateAcvCoverPdf(state: any): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  // Embed logo
  let logoImg: any = null;
  try {
    const logoPath = join(process.cwd(), "public", "logo.png");
    const logoBuf  = readFileSync(logoPath);
    logoImg = await doc.embedPng(logoBuf);
  } catch { /* logo missing — graceful fallback */ }

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  /** Standard footer on every page */
  function addPage() {
    const page = doc.addPage([612, 792]);
    hRule(page, 44, 50, 562, 0.4, GRAY);
    page.drawText("Claims.Coach · Walker Appraisal | Confidential — For Appraisal Use Only", {
      x: 50, y: 32, size: 6.5, font: reg, color: GRAY,
    });
    return page;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER
  // ═══════════════════════════════════════════════════════════════════════════
  let p = addPage();

  // ── Header strip (white bg, orange bottom rule) ─────────────────────────
  // Logo image left-aligned
  if (logoImg) {
    const dims = logoImg.scaleToFit(88, 88);
    p.drawImage(logoImg, { x: 50, y: 718, width: dims.width, height: dims.height });
  }

  // Right side: entity + date
  p.drawText("CLAIMS.COACH · WALKER APPRAISAL", {
    x: logoImg ? 150 : 50, y: 765, size: 11, font: bold, color: NAVY,
  });
  p.drawText("Licensed Public Adjuster — WA | Appraisal & Valuation Services", {
    x: logoImg ? 150 : 50, y: 751, size: 7.5, font: reg, color: SLATE,
  });
  const dw = reg.widthOfTextAtSize(dateStr, 8);
  p.drawText(dateStr, { x: 562 - dw, y: 738, size: 8, font: reg, color: GRAY });

  // Orange accent line below header
  p.drawRectangle({ x: 0, y: 714, width: 612, height: 3, color: ORANGE });

  // ── Title block ─────────────────────────────────────────────────────────
  p.drawText("ACTUAL CASH VALUE DETERMINATION", {
    x: 50, y: 694, size: 21, font: bold, color: NAVY,
  });

  const vehStr = [state.vehYear, state.vehMake, state.vehModel, state.vehTrim]
    .filter(Boolean).join(" ");
  p.drawText(clamp(vehStr, 74), { x: 50, y: 672, size: 13, font: reg, color: ORANGE });

  const claimMeta = [
    state.claimNumber ? `Claim No. ${state.claimNumber}` : null,
    state.dateOfLoss  ? `Date of Loss: ${state.dateOfLoss}` : null,
  ].filter(Boolean).join("   ·   ");
  if (claimMeta) p.drawText(clamp(claimMeta, 90), { x: 50, y: 657, size: 8, font: reg, color: SLATE });

  hRule(p, 645);

  // ── Two-col info box ─────────────────────────────────────────────────────
  // Box background
  p.drawRectangle({ x: 50, y: 496, width: 512, height: 143, color: LIGHT });
  p.drawLine({ start: { x: 50, y: 639 }, end: { x: 562, y: 639 }, thickness: 0.5, color: MID });
  p.drawLine({ start: { x: 50, y: 496 }, end: { x: 562, y: 496 }, thickness: 0.5, color: MID });
  p.drawLine({ start: { x: 50, y: 496 }, end: { x: 50,  y: 639 }, thickness: 0.5, color: MID });
  p.drawLine({ start: { x: 562, y: 496 }, end: { x: 562, y: 639 }, thickness: 0.5, color: MID });
  // Vertical divider
  p.drawLine({ start: { x: 311, y: 496 }, end: { x: 311, y: 639 }, thickness: 0.5, color: MID });

  // LEFT — Claim Information
  p.drawText("CLAIM INFORMATION", { x: 60, y: 630, size: 6.5, font: bold, color: BLUE });
  const claimRows: [string, string][] = [
    ["Carrier",      state.carrier     || "—"],
    ["Claim No.",    state.claimNumber || "—"],
    ["Examiner",     state.examiner    || "—"],
    ["Date of Loss", state.dateOfLoss  || "—"],
    ["Report Date",  dateStr],
  ];
  let lY = 618;
  for (const [lbl, val] of claimRows) {
    p.drawText(lbl, { x: 60,  y: lY, size: 7.5, font: bold, color: SLATE });
    p.drawText(clamp(val, 26), { x: 130, y: lY, size: 8.5, font: reg, color: BLACK });
    lY -= 19;
  }

  // RIGHT — Vehicle Owner
  p.drawText("VEHICLE OWNER", { x: 321, y: 630, size: 6.5, font: bold, color: BLUE });
  const ownerRows: [string, string][] = [
    ["Owner",    state.ownerName    || "—"],
    ["Address",  state.ownerAddress || "—"],
    ["City/ST",  state.ownerCSZ     || "—"],
  ];
  let rY = 618;
  for (const [lbl, val] of ownerRows) {
    p.drawText(lbl, { x: 321, y: rY, size: 7.5, font: bold, color: SLATE });
    p.drawText(clamp(val, 28), { x: 376, y: rY, size: 8.5, font: reg, color: BLACK });
    rY -= 19;
  }

  // RIGHT — Vehicle
  if (vehStr || state.vin || state.mileage) {
    p.drawText("SUBJECT VEHICLE", { x: 321, y: rY - 4, size: 6.5, font: bold, color: BLUE });
    rY -= 18;
    if (vehStr) {
      p.drawText(clamp(vehStr, 30), { x: 321, y: rY, size: 8, font: reg, color: BLACK });
      rY -= 14;
    }
    if (state.vin) {
      p.drawText("VIN", { x: 321, y: rY, size: 7, font: bold, color: SLATE });
      p.drawText(clamp(state.vin, 20), { x: 345, y: rY, size: 7.5, font: reg, color: BLACK });
      rY -= 13;
    }
    if (state.mileage) {
      p.drawText("Mileage", { x: 321, y: rY, size: 7, font: bold, color: SLATE });
      p.drawText(Number(state.mileage).toLocaleString() + " miles", { x: 365, y: rY, size: 7.5, font: reg, color: BLACK });
    }
  }

  // ── Appraiser block ──────────────────────────────────────────────────────
  p.drawText("APPRAISER INFORMATION", { x: 58, y: 483, size: 6.5, font: bold, color: BLUE });
  const appraisers: [string, string, number][] = [
    ["Insured's Appraiser", state.insuredAppraiser || "Johnny Walker", 58],
    ["Insurer's Appraiser", state.insurerAppraiser || "—",            230],
    ["Umpire",              state.umpire           || "—",            420],
  ];
  for (const [lbl, val, ax] of appraisers) {
    p.drawText(lbl, { x: ax, y: 471, size: 7, font: bold, color: SLATE });
    p.drawText(clamp(val, 22), { x: ax, y: 459, size: 8.5, font: reg, color: BLACK });
  }

  hRule(p, 446);

  // ── Cover Letter (fills y=434 down to y=165) ─────────────────────────────
  const ownerN  = state.ownerName || "the Insured";
  const carrierN = state.carrier  || "the Insurance Carrier";
  const vehDesc = vehStr || "the subject vehicle";

  // Get state-specific guidelines if state is provided
  const stateGuide = state.state ? getStateGuideline(state.state) : null;
  const stateNoteSentence = stateGuide
    ? `This analysis complies with ${stateGuide.stateName} appraisal guidelines requiring a minimum of ${stateGuide.minCompsRequired} comparable vehicles within a ${stateGuide.maxRadius}-mile radius of the subject location.`
    : "";

  const coverLines: string[] = [
    `This Actual Cash Value Determination Report has been prepared by Claims.Coach on behalf of`,
    `${clamp(ownerN, 38)} in connection with the total loss claim submitted to ${clamp(carrierN, 36)} for`,
    `the above-referenced ${clamp(vehDesc, 42)}. The purpose of this report is to`,
    `establish the pre-loss Actual Cash Value of the subject vehicle as of the stated date of loss,`,
    `utilizing a market-based methodology grounded in verifiable comparable sales and active listings.`,
    ``,
    `METHODOLOGY`,
    `The comparable vehicles selected for this analysis were identified through a systematic review of`,
    `active and recently sold listings within the relevant geographic market. Each comparable was`,
    `evaluated against the subject vehicle for consistency of year, make, model, trim level, mileage,`,
    `and optional equipment. Where differences existed, appropriate adjustments were applied to reflect`,
    `the impact on market value, including mileage rate adjustments calculated on a per-mile basis and`,
    `specific equipment or condition adjustments documented within this report.`,
    stateNoteSentence || null,
    ``,
    `ADJUSTMENTS`,
    `The following categories of adjustment were considered and applied as supported by documentation:`,
    `(1) Mileage differential between the subject and each comparable vehicle, applied at the stated`,
    `per-mile rate; (2) Aftermarket parts and accessories with documented cost and appropriate`,
    `depreciation applied; (3) Recent maintenance, refurbishments, or repairs with supporting`,
    `receipts; (4) Unrelated prior damage deductions as supported by inspection or records; and`,
    `(5) Condition and date-of-loss adjustments as warranted by the facts of the claim.`,
    ``,
    `SUBMISSION`,
    `This report is submitted pursuant to the appraisal clause of the applicable insurance policy. It`,
    `reflects the appraiser's independent, good-faith opinion of the subject vehicle's Actual Cash`,
    `Value as of the date of loss, and is based solely on verifiable market evidence and documented`,
    `vehicle history. Claims.Coach and Walker Appraisal stand prepared to discuss the findings`,
    `herein and to participate in the appraisal process as required by the policy.`,
  ].filter(Boolean) as string[];

  let cy = 434;
  for (const line of coverLines) {
    if (cy < 175) break;
    if (!line) { cy -= 8; continue; }
    const isSub = line === line.toUpperCase() && line.length < 30 && /^[A-Z ]/.test(line);
    if (isSub) {
      p.drawText(line, { x: 50, y: cy, size: 7.5, font: bold, color: NAVY });
      cy -= 13;
    } else {
      p.drawText(line, { x: 50, y: cy, size: 8.5, font: reg, color: BLACK });
      cy -= 13;
    }
  }

  // ── Signature block ──────────────────────────────────────────────────────
  hRule(p, 163);
  p.drawText("Respectfully submitted,", { x: 50, y: 150, size: 8, font: reg, color: SLATE });
  p.drawText("Johnny Walker", { x: 50, y: 133, size: 10, font: bold, color: NAVY });
  p.drawText("Licensed Public Adjuster · Claims.Coach / Walker Appraisal", {
    x: 50, y: 120, size: 7.5, font: reg, color: SLATE,
  });
  p.drawText(`Report Date: ${dateStr}`, { x: 50, y: 106, size: 7.5, font: reg, color: GRAY });
  p.drawText("Signature: _________________________________", { x: 50, y: 88, size: 8, font: reg, color: GRAY });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: COMPARABLE MARKET ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  p = addPage();

  // Header bar (thin blue-accented, not full navy rectangle)
  p.drawRectangle({ x: 0, y: 768, width: 612, height: 24, color: NAVY });
  if (logoImg) {
    const d = logoImg.scaleToFit(20, 20);
    p.drawImage(logoImg, { x: 50, y: 770, width: d.width, height: d.height });
  }
  p.drawText("COMPARABLE MARKET ANALYSIS", {
    x: logoImg ? 76 : 50, y: 775, size: 10, font: bold, color: WHITE,
  });
  p.drawText("Claims.Coach · Walker Appraisal", {
    x: 400, y: 775, size: 7, font: reg, color: rgb(0.7, 0.78, 0.95),
  });

  // Vehicle summary bar
  p.drawRectangle({ x: 50, y: 748, width: 512, height: 18, color: LIGHT });
  const vehFull = [state.vehYear, state.vehMake, state.vehModel, state.vehTrim].filter(Boolean).join(" ");
  p.drawText(clamp(vehFull || "—", 38), { x: 56, y: 753, size: 8, font: bold, color: NAVY });
  p.drawText(
    `VIN: ${state.vin || "—"}   ·   Mileage: ${state.mileage ? Number(state.mileage).toLocaleString() + " mi" : "—"}`,
    { x: 310, y: 753, size: 8, font: reg, color: SLATE },
  );

  // Comp table
  const colX = [50, 74, 278, 346, 400, 454, 505];
  const hdrs  = ["#", "Vehicle Description / Source", "Asking $", "Mileage", "Mi. Adj", "Other Adj", "Adj. Value"];
  p.drawRectangle({ x: 50, y: 729, width: 512, height: 16, color: MID });
  hdrs.forEach((h, i) => p.drawText(h, { x: colX[i] + 2, y: 732, size: 7, font: bold, color: NAVY }));

  const mileageRate  = state.mileageRate ?? 0.02;
  const subjectMiles = Number(state.mileage) || 0;
  const comps = (state.comps || []).filter((c: any) => c.askingPrice > 0 && c.accepted !== false);

  let tableY = 728;
  let compSum = 0;

  for (let i = 0; i < comps.length; i++) {
    const c      = comps[i];
    const mAdj   = Math.round((subjectMiles - (c.compMileage || 0)) * mileageRate);
    const adjVal = (c.askingPrice || 0) + mAdj + (c.otherAdj || 0);
    compSum += adjVal;

    const hasUrl  = !!c.url;
    const hasNote = !!c.otherAdjNote;
    const rowH    = (hasUrl || hasNote) ? 28 : 18;

    if (i % 2 === 0) p.drawRectangle({ x: 50, y: tableY - rowH, width: 512, height: rowH, color: LIGHT });

    const ry = tableY - 11;
    p.drawText(String(i + 1), { x: colX[0] + 2, y: ry, size: 7.5, font: bold, color: NAVY });
    p.drawText(clamp(c.description || "—", 30), { x: colX[1] + 2, y: ry, size: 7.5, font: reg, color: BLACK });
    p.drawText(fmt(c.askingPrice), { x: colX[2] + 2, y: ry, size: 7.5, font: reg, color: BLACK });
    p.drawText(c.compMileage ? Number(c.compMileage).toLocaleString() : "—",
      { x: colX[3] + 2, y: ry, size: 7.5, font: reg, color: BLACK });
    p.drawText(mAdj >= 0 ? `+${fmt(mAdj)}` : fmt(mAdj),
      { x: colX[4] + 2, y: ry, size: 7.5, font: reg, color: mAdj >= 0 ? GREEN : RED });
    p.drawText(c.otherAdj ? (c.otherAdj > 0 ? `+${fmt(c.otherAdj)}` : fmt(c.otherAdj)) : "—",
      { x: colX[5] + 2, y: ry, size: 7.5, font: reg, color: BLACK });
    p.drawText(fmt(adjVal), { x: colX[6] + 2, y: ry, size: 8, font: bold, color: NAVY });

    if (hasUrl) {
      p.drawText(clamp(c.url, 52), { x: colX[1] + 2, y: ry - 12, size: 6, font: reg, color: BLUE });
    }
    if (hasNote) {
      p.drawText(clamp(c.otherAdjNote, 30), { x: colX[5] + 2, y: ry - 12, size: 6, font: reg, color: SLATE });
    }
    tableY -= rowH;
  }

  // Comp average summary row (orange accent, not full navy)
  const compAvg = comps.length > 0 ? Math.round(compSum / comps.length) : 0;
  p.drawRectangle({ x: 50, y: tableY - 20, width: 512, height: 20, color: NAVY });
  p.drawText("COMPARABLE AVERAGE", { x: colX[1] + 2, y: tableY - 13, size: 8, font: bold, color: WHITE });
  const avgW = bold.widthOfTextAtSize(fmt(compAvg), 9);
  p.drawText(fmt(compAvg), { x: 562 - avgW, y: tableY - 13, size: 9, font: bold, color: ORANGE });
  tableY -= 22;

  // Methodology note
  p.drawText(
    `Mileage adjustment: $${mileageRate.toFixed(2)}/mile differential vs. subject (${subjectMiles.toLocaleString()} mi).` +
    `  ${comps.length} comparable${comps.length !== 1 ? "s" : ""} accepted.`,
    { x: 50, y: tableY - 14, size: 7, font: reg, color: GRAY },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3: ADJUSTMENTS & FINAL DETERMINATION
  // ═══════════════════════════════════════════════════════════════════════════
  p = addPage();

  p.drawRectangle({ x: 0, y: 768, width: 612, height: 24, color: NAVY });
  if (logoImg) {
    const d = logoImg.scaleToFit(20, 20);
    p.drawImage(logoImg, { x: 50, y: 770, width: d.width, height: d.height });
  }
  p.drawText("VALUE ADJUSTMENTS & FINAL DETERMINATION", {
    x: logoImg ? 76 : 50, y: 775, size: 10, font: bold, color: WHITE,
  });
  p.drawText("Claims.Coach · Walker Appraisal", {
    x: 400, y: 775, size: 7, font: reg, color: rgb(0.7, 0.78, 0.95),
  });

  let p3y = 752;
  const tCols  = [56, 130, 280, 340, 400, 460];
  const tHdrs  = ["Category", "Items", "Date", "Cost", "Dep %", "Net Value"];

  // ── Maintenance ──────────────────────────────────────────────────────────
  const maintRows = (state.maintRows || []).filter((r: any) => r.cost > 0);
  let maintTotal  = 0;
  if (maintRows.length > 0) {
    p3y = sectionHeader(p, bold, "Maintenance / Refurbishments", p3y);
    p.drawRectangle({ x: 50, y: p3y - 13, width: 512, height: 14, color: MID });
    tHdrs.forEach((h, i) => p.drawText(h, { x: tCols[i], y: p3y - 10, size: 7, font: bold, color: NAVY }));
    p3y -= 14;
    for (let i = 0; i < maintRows.length; i++) {
      const r   = maintRows[i];
      const net = r.cost * (1 - (r.depPct || 0) / 100);
      maintTotal += net;
      if (i % 2 === 0) p.drawRectangle({ x: 50, y: p3y - 13, width: 512, height: 14, color: LIGHT });
      p.drawText(clamp(r.category, 14), { x: tCols[0], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(clamp(r.items, 24),    { x: tCols[1], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(r.date || "—",         { x: tCols[2], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(fmt(r.cost),            { x: tCols[3], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(`${r.depPct || 0}%`,    { x: tCols[4], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(fmt(net),               { x: tCols[5], y: p3y - 10, size: 7.5, font: bold, color: GREEN });
      p3y -= 14;
    }
    p3y -= 10;
  }

  // ── Aftermarket ──────────────────────────────────────────────────────────
  const afterRows = (state.afterRows || []).filter((r: any) => r.cost > 0);
  let afterTotal  = 0;
  if (afterRows.length > 0) {
    p3y = sectionHeader(p, bold, "Aftermarket Parts", p3y);
    p.drawRectangle({ x: 50, y: p3y - 13, width: 512, height: 14, color: MID });
    tHdrs.forEach((h, i) => p.drawText(h, { x: tCols[i], y: p3y - 10, size: 7, font: bold, color: NAVY }));
    p3y -= 14;
    for (let i = 0; i < afterRows.length; i++) {
      const r   = afterRows[i];
      const net = r.cost * (1 - (r.depPct || 0) / 100);
      afterTotal += net;
      if (i % 2 === 0) p.drawRectangle({ x: 50, y: p3y - 13, width: 512, height: 14, color: LIGHT });
      p.drawText(clamp(r.category, 14), { x: tCols[0], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(clamp(r.items, 24),    { x: tCols[1], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(r.date || "—",         { x: tCols[2], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(fmt(r.cost),            { x: tCols[3], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(`${r.depPct || 0}%`,    { x: tCols[4], y: p3y - 10, size: 7.5, font: reg, color: BLACK });
      p.drawText(fmt(net),               { x: tCols[5], y: p3y - 10, size: 7.5, font: bold, color: ORANGE });
      p3y -= 14;
    }
    p3y -= 10;
  }

  // ── Other adjustments ────────────────────────────────────────────────────
  const hasOther = state.updAmount || state.condAmount;
  if (hasOther) {
    p3y = sectionHeader(p, bold, "Other Adjustments", p3y);
    if (state.updAmount) {
      p.drawRectangle({ x: 50, y: p3y - 13, width: 512, height: 14, color: LIGHT });
      p.drawText(
        `Unrelated Prior Damages${state.updNotes ? ` — ${clamp(state.updNotes, 60)}` : ""}`,
        { x: 56, y: p3y - 10, size: 7.5, font: reg, color: BLACK },
      );
      p.drawText(fmt(-Math.abs(state.updAmount)), { x: 460, y: p3y - 10, size: 7.5, font: bold, color: RED });
      p3y -= 14;
    }
    if (state.condAmount) {
      const cc = (state.condAmount || 0) >= 0 ? GREEN : RED;
      p.drawText(
        `Condition / DOL Adjustment${state.condNotes ? ` — ${clamp(state.condNotes, 55)}` : ""}`,
        { x: 56, y: p3y - 10, size: 7.5, font: reg, color: BLACK },
      );
      p.drawText((state.condAmount >= 0 ? "+" : "") + fmt(state.condAmount),
        { x: 460, y: p3y - 10, size: 7.5, font: bold, color: cc });
      p3y -= 14;
    }
    p3y -= 10;
  }

  // ── Valuation Waterfall + ACV Verdict Box ────────────────────────────────
  const wTop = Math.min(p3y - 16, 700);

  // Financials
  const netValue   = compAvg + maintTotal + afterTotal
                   - Math.abs(state.updAmount || 0)
                   + (state.condAmount || 0);
  const taxRate    = state.taxRate ?? 9.4;
  const taxAmt     = netValue * taxRate / 100;
  const titleFees  = state.titleFees  || 0;
  const unusedReg  = state.unusedReg  || 0;
  const deductible = state.deductible || 0;
  const totalAward = netValue + taxAmt + titleFees + unusedReg - deductible;

  // Divider above waterfall
  p3y = sectionHeader(p, bold, "Valuation Summary", wTop);

  // RIGHT: ACV verdict box
  const bX = 392, bY = wTop - 128, bW = 170, bH = 120;
  p.drawRectangle({ x: bX, y: bY, width: bW, height: bH, color: NAVY });
  p.drawRectangle({ x: bX, y: bY + bH - 4, width: bW, height: 4, color: ORANGE });

  const acvLabel  = "ACTUAL CASH VALUE";
  const acvLW     = bold.widthOfTextAtSize(acvLabel, 8);
  p.drawText(acvLabel, { x: bX + (bW - acvLW) / 2, y: bY + bH - 22, size: 8, font: bold, color: WHITE });

  const acvStr  = fmt(totalAward);
  const acvSW   = bold.widthOfTextAtSize(acvStr, 24);
  p.drawText(acvStr, { x: bX + (bW - acvSW) / 2, y: bY + bH - 66, size: 24, font: bold, color: ORANGE });

  const br  = "Claims.Coach | Walker Appraisal";
  const brW = reg.widthOfTextAtSize(br, 6.5);
  p.drawText(br, { x: bX + (bW - brW) / 2, y: bY + 8, size: 6.5, font: reg, color: GRAY });

  // LEFT: waterfall rows
  const lX = 50, rA = 380;
  let wy = p3y;

  const topRows: [string, number | null][] = [
    ["Comparable Market Average",        compAvg],
    ["+ Maintenance / Refurbishments",   maintTotal],
    ["+ Aftermarket Parts",              afterTotal],
    ["- Unrelated Prior Damages",        -Math.abs(state.updAmount || 0)],
    ["± Condition / Date of Loss",       state.condAmount || 0],
  ];

  for (const [label, val] of topRows) {
    hRule(p, wy - 22, lX, 384, 0.3, MID);
    p.drawText(label, { x: lX + 6, y: wy - 15, size: 8.5, font: reg, color: SLATE });
    const vs = val == null ? "—" : val < 0 ? fmt(val) : val > 0 ? `+${fmt(val)}` : "—";
    const vw = reg.widthOfTextAtSize(vs, 8.5);
    p.drawText(vs, { x: rA - vw, y: wy - 15, size: 8.5, font: reg, color: val && val < 0 ? RED : BLACK });
    wy -= 22;
  }

  // Thin navy line + NET VALUE
  p.drawLine({ start: { x: lX, y: wy }, end: { x: 384, y: wy }, thickness: 1.2, color: NAVY });
  wy -= 6;
  p.drawText("NET VEHICLE VALUE", { x: lX + 6, y: wy - 14, size: 10, font: bold, color: NAVY });
  const nvw = bold.widthOfTextAtSize(fmt(netValue), 10);
  p.drawText(fmt(netValue), { x: rA - nvw, y: wy - 14, size: 10, font: bold, color: NAVY });
  wy -= 26;

  // Lower rows
  const lowRows: [string, number][] = [
    [`+ Vehicular Tax (${taxRate}%)`, taxAmt],
    ["+ Title / Registration / Other", titleFees],
    ["+ Unused Registration",          unusedReg],
    ["- Deductible",                   -deductible],
  ];
  for (const [label, val] of lowRows) {
    hRule(p, wy - 22, lX, 384, 0.3, MID);
    p.drawText(label, { x: lX + 6, y: wy - 15, size: 8.5, font: reg, color: SLATE });
    const vs = val === 0 ? "—" : val < 0 ? fmt(val) : `+${fmt(val)}`;
    const vw = reg.widthOfTextAtSize(vs, 8.5);
    p.drawText(vs, { x: rA - vw, y: wy - 15, size: 8.5, font: reg, color: val < 0 ? RED : BLACK });
    wy -= 22;
  }

  // Thick navy line + TOTAL AWARD
  p.drawLine({ start: { x: lX, y: wy }, end: { x: 384, y: wy }, thickness: 2.5, color: NAVY });
  wy -= 8;
  p.drawText("TOTAL AWARD", { x: lX + 6, y: wy - 17, size: 11, font: bold, color: NAVY });
  const taW = bold.widthOfTextAtSize(fmt(totalAward), 11);
  p.drawText(fmt(totalAward), { x: rA - taW, y: wy - 17, size: 11, font: bold, color: NAVY });
  wy -= 32;

  // Insurer comparison
  if (state.insurerStarting) {
    const diff    = totalAward - state.insurerStarting;
    const pos     = diff >= 0;
    const bg      = pos ? rgb(0.9, 1, 0.93) : rgb(1, 0.93, 0.93);
    const tc      = pos ? GREEN : RED;
    p.drawRectangle({ x: 50, y: wy - 26, width: 512, height: 24, color: bg });
    p.drawRectangle({ x: 50, y: wy - 26, width: 3,   height: 24, color: tc });
    const cmpStr = `Insurer Offered: ${fmt(state.insurerStarting)}   ·   Our Position: ${fmt(totalAward)}   ·   Difference: ${diff >= 0 ? "+" : ""}${fmt(diff)}`;
    p.drawText(cmpStr, { x: 58, y: wy - 15, size: 8, font: bold, color: tc });
    wy -= 34;
  }

  // ── Certification & signatures ───────────────────────────────────────────
  const certY = Math.max(wy - 16, 105);
  hRule(p, certY + 4);
  p.drawText(
    "This valuation was prepared by a licensed public adjuster in accordance with applicable state regulations and industry-standard appraisal",
    { x: 50, y: certY - 8, size: 7, font: reg, color: SLATE },
  );
  p.drawText(
    "methodology. The findings herein are based on verifiable market evidence and are submitted in good faith pursuant to the policy's appraisal clause.",
    { x: 50, y: certY - 19, size: 7, font: reg, color: SLATE },
  );

  const sY = certY - 46;
  if (sY > 55) {
    const sigPairs: [string, number][] = [
      ["Insured's Appraiser  ___________________________", 50],
      ["Date  ________________", 348],
    ];
    for (const [lbl, sx] of sigPairs) {
      p.drawText(lbl, { x: sx, y: sY, size: 7.5, font: reg, color: GRAY });
    }
    const sY2 = sY - 22;
    if (sY2 > 55) {
      p.drawText("Insurer's Appraiser  ___________________________", { x: 50,  y: sY2, size: 7.5, font: reg, color: GRAY });
      p.drawText("Date  ________________",                           { x: 348, y: sY2, size: 7.5, font: reg, color: GRAY });
    }
    const sY3 = sY - 44;
    if (sY3 > 55) {
      p.drawText("Umpire  ___________________________",              { x: 50,  y: sY3, size: 7.5, font: reg, color: GRAY });
      p.drawText("Date  ________________",                           { x: 348, y: sY3, size: 7.5, font: reg, color: GRAY });
    }
  }

  return doc.save();
}
