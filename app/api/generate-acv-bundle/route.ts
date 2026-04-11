import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { generateAcvCoverPdf } from "@/lib/generateAcvCoverPdf";
import { saveBundleToDrive } from "@/lib/drive";

const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

async function fetchAttachments(claimId: string): Promise<any[]> {
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "caseAttachments:listByClaim", args: { claimId } }),
    });
    const data = await res.json();
    return data.value ?? [];
  } catch {
    return [];
  }
}

async function generateCoverPdf(state: any): Promise<Buffer> {
  const bytes = await generateAcvCoverPdf(state);
  return Buffer.from(bytes);
}

async function fetchPdfFromUrl(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("pdf")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function imageBufferToPdf(imgBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter
  let img;
  if (mimeType.includes("png")) {
    img = await doc.embedPng(imgBuffer);
  } else {
    img = await doc.embedJpg(imgBuffer);
  }
  const { width, height } = img.scale(1);
  const scale = Math.min(540 / width, 720 / height, 1);
  const w = width * scale, h = height * scale;
  page.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h });
  return Buffer.from(await doc.save());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { claimId, ...state } = body;

    const merger = await PDFDocument.create();

    // ── 1. Cover PDF ────────────────────────────────────────────
    const coverBuf = await generateCoverPdf(state);
    const coverDoc = await PDFDocument.load(coverBuf);
    const coverPages = await merger.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach(p => merger.addPage(p));

    // ── 2. Comp listing summary pages ────────────────────────────
    const acceptedComps = (state.comps || []).filter((c: any) => c.askingPrice > 0 && c.accepted !== false);
    const helvetica     = await merger.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await merger.embedFont(StandardFonts.HelveticaBold);
    const W = 612, H = 792;
    const BLUE   = rgb(0.08, 0.49, 0.98);
    const DARK   = rgb(0.06, 0.09, 0.16);
    const GRAY   = rgb(0.58, 0.64, 0.72);
    const ORANGE = rgb(1, 0.53, 0);
    const GREEN  = rgb(0.05, 0.60, 0.28);
    const LGRAY  = rgb(0.96, 0.97, 0.98);
    const BORDER = rgb(0.88, 0.90, 0.93);

    // Try to capture screenshots from local dev server (Mac mini only)
    const captureScreenshot = async (url: string): Promise<{ screenshot: string | null; data: any }> => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/capture-listing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) return { screenshot: null, data: {} };
        const d = await res.json();
        return { screenshot: d.screenshot || null, data: d.data || {} };
      } catch {
        return { screenshot: null, data: {} };
      }
    };

    for (let ci = 0; ci < acceptedComps.length; ci++) {
      const comp = acceptedComps[ci];

      // Capture screenshot + structured data
      const { screenshot, data: scraped } = comp.url ? await captureScreenshot(comp.url) : { screenshot: null, data: {} };

      const milAdj   = comp.mileageAdj ?? 0;
      const otherAdj = comp.otherAdj ?? 0;
      const adjTotal = milAdj + otherAdj;
      const adjPrice = (comp.askingPrice ?? 0) + adjTotal;
      const srcHost  = comp.url
        ? (() => { try { return new URL(comp.url.startsWith("http") ? comp.url : "https://" + comp.url).hostname.replace("www.", ""); } catch { return ""; } })()
        : "Manual entry";

      // ── PAGE 1: Data summary ──────────────────────────────────
      const pg1 = merger.addPage([W, H]);

      // Header
      pg1.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: DARK });
      pg1.drawText("COMPARABLE VEHICLE", { x: 36, y: H - 20, size: 8, font: helveticaBold, color: rgb(0.55,0.62,0.72) });
      pg1.drawText(`COMP ${ci + 1} OF ${acceptedComps.length}`, { x: W - 100, y: H - 20, size: 9, font: helveticaBold, color: ORANGE });
      const descText = (comp.description || `Comp ${ci + 1}`).slice(0, 72);
      pg1.drawText(descText, { x: 36, y: H - 44, size: 14, font: helveticaBold, color: rgb(1,1,1) });

      // Price banner
      pg1.drawRectangle({ x: 0, y: H - 120, width: W, height: 60, color: LGRAY, borderColor: BORDER, borderWidth: 0 });
      // Asking
      pg1.drawText("ASKING PRICE", { x: 36, y: H - 78, size: 8, font: helveticaBold, color: GRAY });
      pg1.drawText(`$${Number(comp.askingPrice).toLocaleString()}`, { x: 36, y: H - 100, size: 24, font: helveticaBold, color: BLUE });
      // Adjusted
      pg1.drawText("ADJUSTED PRICE", { x: 210, y: H - 78, size: 8, font: helveticaBold, color: GRAY });
      pg1.drawText(`$${adjPrice.toLocaleString()}`, { x: 210, y: H - 100, size: 24, font: helveticaBold, color: adjTotal < 0 ? ORANGE : DARK });
      // Mileage adj
      pg1.drawText("MILEAGE ADJ", { x: 390, y: H - 78, size: 8, font: helveticaBold, color: GRAY });
      pg1.drawText(milAdj !== 0 ? `${milAdj > 0 ? "+" : ""}$${milAdj.toLocaleString()}` : "—", { x: 390, y: H - 100, size: 16, font: helveticaBold, color: milAdj < 0 ? ORANGE : DARK });
      // Other adj
      pg1.drawText("OTHER ADJ", { x: 490, y: H - 78, size: 8, font: helveticaBold, color: GRAY });
      pg1.drawText(otherAdj !== 0 ? `${otherAdj > 0 ? "+" : ""}$${otherAdj.toLocaleString()}` : "—", { x: 490, y: H - 100, size: 16, font: helveticaBold, color: otherAdj < 0 ? ORANGE : DARK });

      // ── Left column: vehicle details ──────────────────────────
      let y = H - 140;
      const LX = 36, RX = 320;
      const field = (label: string, value: string | null | undefined, x: number, col: "left" | "right" = "left", highlight = false) => {
        if (!value) return;
        pg1.drawText(label.toUpperCase(), { x, y: y + 2, size: 7, font: helveticaBold, color: GRAY });
        pg1.drawText(value.slice(0, 38), { x, y: y - 12, size: 11, font: highlight ? helveticaBold : helvetica, color: highlight ? BLUE : DARK });
      };

      // Row 1
      field("Mileage", comp.compMileage ? `${Number(comp.compMileage).toLocaleString()} miles` : scraped.mileage ? `${Number(scraped.mileage).toLocaleString()} miles` : null, LX, "left", true);
      field("VIN", scraped.vin || comp.vin || null, RX, "right", true);
      y -= 36;
      pg1.drawLine({ start: { x: 36, y }, end: { x: W - 36, y }, thickness: 0.5, color: BORDER });
      y -= 4;

      // Row 2
      field("Location / Dealer", scraped.location || scraped.dealer || null, LX);
      field("Source", srcHost || null, RX, "right", true);
      y -= 36;
      pg1.drawLine({ start: { x: 36, y }, end: { x: W - 36, y }, thickness: 0.5, color: BORDER });
      y -= 4;

      // Row 3
      field("Color", scraped.color || comp.color || null, LX);
      field("Transmission", scraped.transmission || comp.transmission || null, RX);
      y -= 36;
      pg1.drawLine({ start: { x: 36, y }, end: { x: W - 36, y }, thickness: 0.5, color: BORDER });
      y -= 4;

      // Row 4
      field("Condition", scraped.condition || null, LX);
      field("Days on Market", scraped.daysOnMarket ? `${scraped.daysOnMarket} days` : null, RX);
      y -= 36;
      pg1.drawLine({ start: { x: 36, y }, end: { x: W - 36, y }, thickness: 0.5, color: BORDER });
      y -= 12;

      // Adj note
      if (comp.adjNote) {
        pg1.drawRectangle({ x: 36, y: y - 28, width: W - 72, height: 32, color: rgb(1,0.97,0.92), borderColor: rgb(0.99,0.82,0.56), borderWidth: 1 });
        pg1.drawText("ADJUSTMENT NOTE", { x: 46, y: y - 10, size: 7, font: helveticaBold, color: ORANGE });
        pg1.drawText(comp.adjNote.slice(0, 90), { x: 46, y: y - 23, size: 10, font: helvetica, color: DARK });
        y -= 44;
      }

      // Listing URL
      if (comp.url) {
        y -= 4;
        pg1.drawText("LISTING URL:", { x: 36, y, size: 7, font: helveticaBold, color: GRAY });
        y -= 14;
        const urlText = comp.url.length > 88 ? comp.url.slice(0, 85) + "…" : comp.url;
        pg1.drawText(urlText, { x: 36, y, size: 8, font: helvetica, color: BLUE });
        y -= 20;
      }

      // Embed screenshot on this page if it fits, otherwise add it as page 2
      if (screenshot) {
        try {
          const imgBuf  = Buffer.from(screenshot, "base64");
          const imgEmbed = await merger.embedJpg(imgBuf);
          const availH  = y - 40;  // space remaining above footer
          const availW  = W - 72;
          if (availH > 120) {
            // Fits on this page
            const scale  = Math.min(availW / imgEmbed.width, availH / imgEmbed.height, 1);
            const imgW   = imgEmbed.width  * scale;
            const imgH   = imgEmbed.height * scale;
            const imgX   = 36 + (availW - imgW) / 2;
            const imgY   = y - imgH - 8;
            pg1.drawRectangle({ x: imgX - 2, y: imgY - 2, width: imgW + 4, height: imgH + 4, color: BORDER });
            pg1.drawImage(imgEmbed, { x: imgX, y: imgY, width: imgW, height: imgH });
            pg1.drawText("LISTING SCREENSHOT", { x: imgX, y: imgY - 12, size: 7, font: helveticaBold, color: GRAY });
          } else {
            // Add as separate page
            const pg2  = merger.addPage([W, H]);
            pg2.drawRectangle({ x: 0, y: H - 40, width: W, height: 40, color: DARK });
            pg2.drawText(`LISTING SCREENSHOT — COMP ${ci + 1}`, { x: 36, y: H - 26, size: 11, font: helveticaBold, color: rgb(1,1,1) });
            const scale2 = Math.min((W - 72) / imgEmbed.width, (H - 90) / imgEmbed.height, 1);
            const imgW2  = imgEmbed.width  * scale2;
            const imgH2  = imgEmbed.height * scale2;
            pg2.drawImage(imgEmbed, { x: (W - imgW2) / 2, y: (H - 40 - imgH2) / 2 + 20, width: imgW2, height: imgH2 });
            // Footer
            pg2.drawRectangle({ x: 0, y: 0, width: W, height: 22, color: LGRAY });
            pg2.drawText(comp.url?.slice(0, 88) || "", { x: 36, y: 7, size: 7, font: helvetica, color: GRAY });
          }
        } catch { /* screenshot embed failed — skip gracefully */ }
      }

      // Footer
      pg1.drawRectangle({ x: 0, y: 0, width: W, height: 22, color: LGRAY });
      pg1.drawText(`Claims.Coach  ·  ACV Bundle  ·  ${state.clientName || ""}  ·  ${[state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join(" ")}`, { x: 36, y: 7, size: 7, font: helvetica, color: GRAY });
      pg1.drawText(`Comp ${ci + 1} of ${acceptedComps.length}`, { x: W - 72, y: 7, size: 7, font: helveticaBold, color: GRAY });
    }

    // ── 3. Uploaded attachments (invoices, photos) ───────────────
    if (claimId) {
      const attachments = await fetchAttachments(claimId);

      // Maintenance and aftermarket invoices first, then photos
      const sorted = [
        ...attachments.filter((a: any) => a.section === "maintenance"),
        ...attachments.filter((a: any) => a.section === "aftermarket"),
        ...attachments.filter((a: any) => a.section === "photo"),
      ];

      for (const att of sorted) {
        if (!att.url) continue;
        try {
          const attRes  = await fetch(att.url, { signal: AbortSignal.timeout(10000) });
          if (!attRes.ok) continue;
          const attBuf  = Buffer.from(await attRes.arrayBuffer());
          const mime    = att.mimeType || "";

          if (mime.includes("pdf")) {
            const attDoc = await PDFDocument.load(attBuf);
            const attPages = await merger.copyPages(attDoc, attDoc.getPageIndices());
            attPages.forEach(p => merger.addPage(p));
          } else if (mime.includes("image") || mime.includes("png") || mime.includes("jpeg") || mime.includes("jpg")) {
            const imgPdfBuf = await imageBufferToPdf(attBuf, mime);
            const imgDoc    = await PDFDocument.load(imgPdfBuf);
            const imgPages  = await merger.copyPages(imgDoc, imgDoc.getPageIndices());
            imgPages.forEach(p => merger.addPage(p));
          }
        } catch {
          // Skip failed attachments
        }
      }
    }

    const merged  = await merger.save();
    const veh     = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join("_").replace(/\s+/g, "_");
    const claim   = (state.claimNumber || "DRAFT").replace(/[^a-zA-Z0-9-]/g, "_");
    const filename = `ACV_Bundle_${claim}_${veh}.pdf`;

    // Auto-save to Google Drive (fire-and-forget)
    const vehStr = [state.vehYear, state.vehMake, state.vehModel].filter(Boolean).join(" ");
    saveBundleToDrive(merged, state.claimNumber || "", state.ownerName || "", vehStr).catch(() => {});

    return new NextResponse(Buffer.from(merged), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("generate-acv-bundle error:", err);
    return NextResponse.json({ error: "Bundle generation failed", detail: String(err) }, { status: 500 });
  }
}
