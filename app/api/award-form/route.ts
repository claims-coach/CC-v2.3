import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { saveAwardToDrive } from "@/lib/drive";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Brand colors
const NAVY   = rgb(0.078, 0.098, 0.196);   // #141932
const ORANGE = rgb(1,     0.525, 0);         // #FF8600
const BLUE   = rgb(0.08,  0.494, 0.98);      // #147EFA
const SLATE  = rgb(0.2,   0.27,  0.37);
const LIGHT  = rgb(0.965, 0.973, 0.984);
const MID    = rgb(0.882, 0.902, 0.933);
const GRAY   = rgb(0.55,  0.6,   0.65);
const WHITE  = rgb(1,     1,     1);
const BLACK  = rgb(0.1,   0.1,   0.1);
const GREEN  = rgb(0.086, 0.647, 0.314);

const W = 612, H = 792;
const ML = 52, MR = 52; // left/right margin
const CW = W - ML - MR; // content width = 508

const fmtCurrency = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateAwardPdf(fields: {
  ownerName: string;
  carrier: string;
  claimNumber: string;
  dateOfLoss: string;
  awardDate: string;
  vehicle: string;
  vin: string;
  acvAward: number;
  insuredAppraiser: string;
  insurerAppraiser: string;
  umpire: string;
  signatures?: {
    insured?: { date: string };
    insurer?: { date: string };
    umpire?:  { date: string };
  };
}): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const ital = await doc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([W, H]);

  // Logo
  let logoImg: any = null;
  try {
    // Use cropped logo (whitespace trimmed) if available, else fallback
    const croppedPath = join(process.cwd(), "public", "logo-cropped.png");
    const logoPath    = join(process.cwd(), "public", "logo.png");
    const usePath     = existsSync(croppedPath) ? croppedPath : logoPath;
    if (existsSync(usePath)) logoImg = await doc.embedPng(readFileSync(usePath));
  } catch { /* optional */ }

  // ── HEADER ──────────────────────────────────────────────────────────────
  // Orange bar at very top
  page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: ORANGE });

  // Logo — centered, sitting just below top bar
  const LOGO_W = 80, LOGO_H = 40;
  if (logoImg) {
    const d = logoImg.scaleToFit(LOGO_W, LOGO_H);
    page.drawImage(logoImg, { x: (W - d.width) / 2, y: H - 14 - d.height, width: d.width, height: d.height });
  }

  // Tagline only — no redundant company name (logo has it)
  const tagline = "(425) 585-2622  ·  claims.coach  ·  Everett, WA";
  const taglineW = reg.widthOfTextAtSize(tagline, 7.5);
  page.drawText(tagline, { x: (W - taglineW) / 2, y: H - (logoImg ? 66 : 32), size: 7.5, font: reg, color: SLATE });

  // Rule below header — pushed lower so it doesn't bleed into title
  page.drawLine({ start: { x: ML, y: H - (logoImg ? 78 : 44) }, end: { x: W - MR, y: H - (logoImg ? 78 : 44) }, thickness: 0.6, color: MID });

  // ── TITLE ────────────────────────────────────────────────────────────────
  const title = "ACTUAL CASH VALUE AWARD";
  const titleW = bold.widthOfTextAtSize(title, 22);
  page.drawText(title, { x: (W - titleW) / 2, y: H - 118, size: 22, font: bold, color: NAVY });
  // Orange underline
  page.drawLine({
    start: { x: (W - titleW) / 2, y: H - 124 },
    end:   { x: (W - titleW) / 2 + titleW, y: H - 124 },
    thickness: 2.5, color: ORANGE,
  });

  // ── INFO GRID ─────────────────────────────────────────────────────────────
  // 3 rows × 2 cols — fits neatly, no dead space
  // ── INFO GRID ─────────────────────────────────────────────────────────────
  const infoRows: [string, string, string, string][] = [
    ["Policyholder:",      fields.ownerName   || "—", "Date of Loss:",  fields.dateOfLoss  || "—"],
    ["Insurance Company:", fields.carrier     || "—", "Date of Award:", fields.awardDate   || "—"],
    ["Claim Number:",      fields.claimNumber || "—", "Vehicle:",       fields.vehicle     || "—"],
    ["",                   "",                        "VIN:",           fields.vin         || "—"],
  ];
  const ROW_H  = 22;
  const bTop   = H - 128;
  const bH     = infoRows.length * ROW_H + 10;
  const bBot   = bTop - bH;
  const divX   = ML + CW / 2;

  page.drawRectangle({ x: ML, y: bBot, width: CW, height: bH, color: LIGHT });
  // Outer border
  [
    [{ x: ML, y: bBot }, { x: ML, y: bTop }],
    [{ x: W - MR, y: bBot }, { x: W - MR, y: bTop }],
    [{ x: ML, y: bTop }, { x: W - MR, y: bTop }],
    [{ x: ML, y: bBot }, { x: W - MR, y: bBot }],
    [{ x: divX, y: bBot }, { x: divX, y: bTop }],
  ].forEach(([s, e]) => page.drawLine({ start: s as any, end: e as any, thickness: 0.5, color: MID }));

  // Fixed value column offsets — widest label is "Insurance Company:" ~105px at 7.5pt
  // Left: label at ML+8, value at ML+118. Right: label at divX+8, value at divX+104
  const L_VAL_X  = ML + 118;
  const R_VAL_X  = divX + 104;
  const L_MAX_W  = divX - L_VAL_X - 6;
  const R_MAX_W  = W - MR - R_VAL_X - 6;

  infoRows.forEach(([l1, v1, l2, v2], i) => {
    const y = bTop - 16 - i * ROW_H;
    if (i > 0) page.drawLine({ start: { x: ML, y: y + ROW_H - 5 }, end: { x: W - MR, y: y + ROW_H - 5 }, thickness: 0.3, color: MID });

    // Left cell — fixed label + fixed value column
    if (l1) page.drawText(l1, { x: ML + 8, y, size: 7.5, font: bold, color: SLATE });
    if (v1) {
      let v1t = v1;
      while (v1t.length > 1 && reg.widthOfTextAtSize(v1t, 9) > L_MAX_W) v1t = v1t.slice(0, -2) + "…";
      page.drawText(v1t, { x: L_VAL_X, y, size: 9, font: reg, color: BLACK });
    }

    // Right cell — fixed label + fixed value column
    if (l2) page.drawText(l2, { x: divX + 8, y, size: 7.5, font: bold, color: SLATE });
    if (v2) {
      let v2t = v2;
      while (v2t.length > 1 && reg.widthOfTextAtSize(v2t, 9) > R_MAX_W) v2t = v2t.slice(0, -2) + "…";
      page.drawText(v2t, { x: R_VAL_X, y, size: 9, font: reg, color: BLACK });
    }
  });

  // ── BODY TEXT ────────────────────────────────────────────────────────────
  const bodyText = "We, the undersigned, pursuant to our appointment as appraisers and in accordance with the appraisal provisions of the applicable insurance policy, have carefully examined the vehicle described below and do hereby certify that the Actual Cash Value of said vehicle at the time of loss is as stated herein.";
  const bodyLines = wrapText(bodyText, reg, 9.5, CW);
  let bodyY = bBot - 18;
  for (const line of bodyLines) {
    page.drawText(line, { x: ML, y: bodyY, size: 9.5, font: reg, color: SLATE });
    bodyY -= 14;
  }

  // ── VEHICLE TABLE ────────────────────────────────────────────────────────
  const tblTop = bodyY - 12;
  const hdrH = 24, rowH = 34;

  page.drawRectangle({ x: ML, y: tblTop - hdrH, width: CW, height: hdrH, color: NAVY });
  const c1 = ML + 8, c2 = ML + 210, c3 = ML + 370;
  page.drawText("VEHICLE",           { x: c1, y: tblTop - 16, size: 8, font: bold, color: WHITE });
  page.drawText("VIN",               { x: c2, y: tblTop - 16, size: 8, font: bold, color: WHITE });
  page.drawText("ACTUAL CASH VALUE", { x: c3, y: tblTop - 16, size: 8, font: bold, color: WHITE });

  const drTop = tblTop - hdrH;
  page.drawRectangle({ x: ML, y: drTop - rowH, width: CW, height: rowH, color: LIGHT });
  page.drawLine({ start: { x: ML, y: drTop - rowH }, end: { x: W - MR, y: drTop - rowH }, thickness: 0.5, color: MID });

  const vehLines = wrapText(fields.vehicle || "—", reg, 9, 195);
  vehLines.slice(0, 2).forEach((l, i) => {
    page.drawText(l, { x: c1, y: drTop - 12 - i * 13, size: 9, font: reg, color: BLACK });
  });
  page.drawText(fields.vin || "—", { x: c2, y: drTop - 12, size: 9, font: reg, color: BLACK });

  const acvStr = fmtCurrency(fields.acvAward);
  const acvW   = bold.widthOfTextAtSize(acvStr, 18);
  page.drawText(acvStr, { x: W - MR - 8 - acvW, y: drTop - 16, size: 18, font: bold, color: ORANGE });

  // ── EXCLUSION NOTE ───────────────────────────────────────────────────────
  const excTop = drTop - rowH - 12;
  const excText = "This award does not include: Deductible(s), Tax, Title, & License Fees. Such amounts are payable in addition to the Actual Cash Value stated above.";
  const excLines = wrapText(excText, ital, 8, CW - 14);
  const excH = excLines.length * 11 + 8;
  page.drawRectangle({ x: ML, y: excTop - excH, width: 3, height: excH, color: ORANGE });
  excLines.forEach((l, i) => {
    page.drawText(l, { x: ML + 10, y: excTop - 8 - i * 11, size: 8, font: ital, color: SLATE });
  });

  // ── SIGNATURE SECTION — STACKED VERTICALLY, GENEROUS SPACE ─────────────
  const sigTop = excTop - excH - 18;

  const sigHdr = "SIGNATURES";
  const sigHdrW = bold.widthOfTextAtSize(sigHdr, 9);
  page.drawText(sigHdr, { x: (W - sigHdrW) / 2, y: sigTop, size: 9, font: bold, color: NAVY });
  page.drawLine({ start: { x: ML, y: sigTop - 6 }, end: { x: W - MR, y: sigTop - 6 }, thickness: 0.5, color: MID });

  const sigBlocks = [
    { role: "Insured's Appraiser", name: fields.insuredAppraiser || "Johnny Walker", sigKey: "insured" as const },
    { role: "Insurer's Appraiser", name: fields.insurerAppraiser || "",               sigKey: "insurer" as const },
    { role: "Umpire",              name: fields.umpire            || "",               sigKey: "umpire"  as const },
  ];

  // Distribute remaining space evenly between 3 blocks above footer
  const sigAreaTop    = sigTop - 18;
  const sigAreaBottom = 65; // above footer
  const SIG_BLOCK_H   = Math.floor((sigAreaTop - sigAreaBottom) / 3);
  const SIG_LINE_W    = Math.floor(CW * 0.5);  // 50% width — not full page

  sigBlocks.forEach((blk, i) => {
    const blockTop = sigAreaTop - i * SIG_BLOCK_H;
    const sig = fields.signatures?.[blk.sigKey];

    // Role label
    page.drawText(blk.role, { x: ML, y: blockTop, size: 9, font: bold, color: NAVY });

    // Long signature line — full content width
    const lineY = blockTop - 32;
    if (sig) {
      page.drawRectangle({ x: ML, y: lineY - 4, width: SIG_LINE_W, height: 18, color: rgb(0.92, 1, 0.94) });
      page.drawText("✓  Digitally Signed — " + sig.date, { x: ML + 8, y: lineY + 5, size: 9, font: bold, color: GREEN });
    } else {
      page.drawLine({ start: { x: ML, y: lineY }, end: { x: ML + SIG_LINE_W, y: lineY }, thickness: 1, color: GRAY });
    }

    // "Signature" label left + printed name left-aligned below line
    page.drawText("Signature", { x: ML, y: lineY - 11, size: 7.5, font: reg, color: GRAY });

    // Printed name — left-aligned below "Signature" label, same x position
    let nm = blk.name;
    while (nm.length > 1 && reg.widthOfTextAtSize(nm, 9) > SIG_LINE_W) nm = nm.slice(0, -2) + "…";
    if (nm) {
      page.drawText(nm, { x: ML, y: lineY - 23, size: 9, font: reg, color: BLACK });
    }

    // Date line — left side, below
    const dateY = lineY - 38;
    page.drawLine({ start: { x: ML, y: dateY }, end: { x: ML + 180, y: dateY }, thickness: 0.6, color: GRAY });
    page.drawText("Date", { x: ML, y: dateY - 11, size: 7.5, font: reg, color: GRAY });

    // Light separator between blocks (not after last)
    if (i < sigBlocks.length - 1) {
      page.drawLine({ start: { x: ML, y: blockTop - SIG_BLOCK_H + 8 }, end: { x: W - MR, y: blockTop - SIG_BLOCK_H + 8 }, thickness: 0.3, color: MID });
    }
  });

  // ── FOOTER ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y: 50 }, end: { x: W - MR, y: 50 }, thickness: 0.4, color: MID });
  const footer = "Claims.Coach  ·  Walker Appraisal  ·  2707 Colby Ave #1200B, Everett WA 98201  ·  (425) 585-2622  ·  claims.coach  ·  WAC 284-30-391 Compliant";
  const footerW = reg.widthOfTextAtSize(footer, 6.5);
  page.drawText(footer, { x: (W - footerW) / 2, y: 36, size: 6.5, font: reg, color: GRAY });

  return doc.save();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ownerName, carrier, claimNumber, dateOfLoss, awardDate,
      vehicle, vin, acvAward,
      insuredAppraiser, insurerAppraiser, umpire,
      awardId,
    } = body;

    // ── Load or create Convex record ────────────────────────────────────────
    let resolvedAwardId = awardId;
    let signatures: { insured?: { date: string }; insurer?: { date: string }; umpire?: { date: string } } | undefined;

    if (awardId) {
      try {
        const record = await convex.query(api.awardRequests.get, { id: awardId });
        if (record) {
          signatures = {};
          if (record.insuredSigDate) signatures.insured = { date: record.insuredSigDate };
          if (record.insurerSigDate) signatures.insurer = { date: record.insurerSigDate };
          if (record.umpireSigDate)  signatures.umpire  = { date: record.umpireSigDate };
        }
      } catch { /* continue without sigs */ }
    } else {
      try {
        resolvedAwardId = await convex.mutation(api.awardRequests.create, {
          claimNumber: claimNumber || undefined,
          ownerName:   ownerName   || undefined,
          carrier:     carrier     || undefined,
          vehicle:     vehicle     || undefined,
          vin:         vin         || undefined,
          acvAward:    acvAward    || 0,
          insuredAppraiser: insuredAppraiser || undefined,
          insurerAppraiser: insurerAppraiser || undefined,
          umpire:      umpire      || undefined,
          dateOfLoss:  dateOfLoss  || undefined,
          awardDate:   awardDate   || undefined,
        });
      } catch (e) {
        console.error("Convex create awardRequest failed:", e);
      }
    }

    // ── Generate PDF ─────────────────────────────────────────────────────────
    const pdfBytes = await generateAwardPdf({
      ownerName:        ownerName || "",
      carrier:          carrier || "",
      claimNumber:      claimNumber || "",
      dateOfLoss:       dateOfLoss || "",
      awardDate:        awardDate || "",
      vehicle:          vehicle || "",
      vin:              vin || "",
      acvAward:         acvAward || 0,
      insuredAppraiser: insuredAppraiser || "Johnny Walker",
      insurerAppraiser: insurerAppraiser || "",
      umpire:           umpire || "",
      signatures,
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");

    // Auto-save to Google Drive (fire-and-forget)
    saveAwardToDrive(pdfBytes, claimNumber || "", ownerName || "", vehicle || "").catch(() => {});

    return NextResponse.json({ pdf: base64, awardId: resolvedAwardId });

  } catch (err) {
    console.error("award-form error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
