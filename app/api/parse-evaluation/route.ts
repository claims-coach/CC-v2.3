import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are an expert at parsing insurance vehicle evaluation reports (CCC ONE, Mitchell, ADP, Audatex, State Farm Estimating, etc.).
Extract ONLY fields that are clearly present. Return a JSON object with these keys (omit any you cannot find):
{
  "carrier": "Insurance company name",
  "claimNumber": "Claim or file number",
  "adjusterName": "Adjuster or examiner full name",
  "adjusterPhone": "Adjuster phone",
  "adjusterEmail": "Adjuster email",
  "dateOfLoss": "YYYY-MM-DD",
  "dateOfReport": "YYYY-MM-DD",
  "ownerName": "Vehicle owner full name",
  "ownerAddress": "Street address",
  "ownerCSZ": "City, State ZIP",
  "vehYear": "4-digit year as string",
  "vehMake": "Make",
  "vehModel": "Model",
  "vehTrim": "Trim level",
  "vehPackages": "Packages or options listed",
  "vin": "17-character VIN uppercase",
  "mileage": 0,
  "preAccidentCondition": "Excellent/Very Good/Good/Fair/Poor if stated",
  "insurerStartingOffer": 0,  // IMPORTANT: use "Adjusted Vehicle Value" (ACV after condition adjustment, BEFORE tax/fees/deductible) — NOT the final total payout
  "baseValue": 0,
  "repairCost": 0,
  "taxRate": 0,
  "titleFees": 0,
  "unusedReg": 0,
  "deductible": 0
}
mileage, insurerStartingOffer, baseValue, repairCost, taxRate, titleFees, unusedReg, deductible must be numbers (no $ sign, no commas).
For insurerStartingOffer: look for "Adjusted Vehicle Value" (this is Base Vehicle Value + Condition Adjustment). Do NOT use the final total payout. This is the pre-tax ACV the insurer is claiming.
Return ONLY valid JSON. No explanation. No markdown fences.`;

// ── Extract the first embedded JPEG from a scanned PDF binary ─────────────────
// Scanned PDFs store page content as JPEG streams inside the PDF container.
// We find the JPEG SOI/EOI markers and slice out the image bytes directly.
function extractJpegFromPDF(buffer: Buffer): Buffer | null {
  const SOI = Buffer.from([0xFF, 0xD8, 0xFF]);
  const EOI = Buffer.from([0xFF, 0xD9]);
  const start = buffer.indexOf(SOI);
  if (start === -1) return null;
  let end = -1;
  let pos = start;
  while (pos < buffer.length - 1) {
    const idx = buffer.indexOf(EOI, pos);
    if (idx === -1) break;
    end = idx + 2;
    pos = idx + 1;
  }
  if (end === -1) return null;
  return buffer.subarray(start, end);
}

export async function POST(req: NextRequest) {
  try {
    // Support both multipart file upload AND JSON { url: "https://..." }
    const contentType = req.headers.get("content-type") || "";
    let buffer: Buffer;
    let mimeType: string;

    if (contentType.includes("application/json")) {
      // URL mode — fetch the file from GHL or any URL
      const { url, ghlAuth } = await req.json();
      if (!url) return NextResponse.json({ error: "No url provided" }, { status: 400 });
      const fetchHeaders: Record<string, string> = {};
      // GHL document URLs require Bearer auth
      if (ghlAuth || url.includes("leadconnectorhq.com") || url.includes("msgsndr.com")) {
        fetchHeaders["Authorization"] = `Bearer ${process.env.GHL_API_KEY || "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1"}`;
        fetchHeaders["Version"] = "2021-07-28";
      }
      const fetched = await fetch(url, { headers: fetchHeaders });
      if (!fetched.ok) return NextResponse.json({ error: `Could not fetch file from URL: ${fetched.status}` }, { status: 400 });
      const ab = await fetched.arrayBuffer();
      buffer   = Buffer.from(ab);
      mimeType = fetched.headers.get("content-type")?.split(";")[0] || "application/pdf";
    } else {
      // Multipart file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      const arrayBuffer = await file.arrayBuffer();
      buffer   = Buffer.from(arrayBuffer);
      mimeType = file.type;
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const xaiKey       = process.env.XAI_API_KEY;

    // ── Call AI with plain text — Ollama first, then cheap fallback ───────
    async function parseWithText(text: string): Promise<string> {
      // Try local Ollama (free)
      try {
        const { ollamaSmart } = await import("@/lib/ollama");
        const result = await ollamaSmart(`Parse this insurance evaluation:\n\n${text}`, systemPrompt);
        if (result) return result;
      } catch { /* Ollama unavailable */ }

      // Fallback: Claude Haiku (cheap)
      if (anthropicKey) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: `Parse this insurance evaluation:\n\n${text}` }] }),
        });
        const d = await res.json();
        return d.content?.[0]?.text || "";
      }
      if (xaiKey) {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
          body: JSON.stringify({ model: "grok-4-0709", max_tokens: 1000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Parse this insurance evaluation:\n\n${text}` }] }),
        });
        const d = await res.json();
        return d.choices?.[0]?.message?.content || "";
      }
      return "";
    }

    // ── Call AI with image (vision) ───────────────────────────────────────
    async function parseWithImage(base64: string, mime: string): Promise<string> {
      if (anthropicKey) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: systemPrompt,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
              { type: "text", text: "Extract all available fields from this insurance evaluation document." },
            ]}],
          }),
        });
        const d = await res.json();
        return d.content?.[0]?.text || "";
      }
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
        body: JSON.stringify({
          model: "grok-4-0709", max_tokens: 1000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
              { type: "text", text: "Extract all available fields from this insurance evaluation document." },
            ]},
          ],
        }),
      });
      const d = await res.json();
      return d.choices?.[0]?.message?.content || "";
    }

    let aiText = "";
    let source = "text";

    // ── IMAGE FILE: direct screenshot or photo ────────────────────────────
    if (mimeType.startsWith("image/")) {
      source = "vision";
      aiText = await parseWithImage(buffer.toString("base64"), mimeType);

    // ── PDF FILE ──────────────────────────────────────────────────────────
    } else if (mimeType === "application/pdf") {

      // 1. Try text extraction (works for digital/e-mailed PDFs)
      let pdfText = "";
      try {
        const pdfParse = (await import("pdf-parse")) as any;
        const parsed   = await pdfParse(buffer);
        pdfText = parsed.text || "";
      } catch {}

      if (anthropicKey) {
        // Use Claude's native PDF document support — works on all PDF types (digital + scanned)
        source = "pdf-native";
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: systemPrompt,
            messages: [{ role: "user", content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
              { type: "text", text: "Extract all available fields from this insurance evaluation document." },
            ]}],
          }),
        });
        const d = await res.json();
        aiText = d.content?.[0]?.text || "";
      } else if (pdfText.trim().length >= 50) {
        // xAI fallback with text extraction
        source = "text";
        aiText = await parseWithText(pdfText.slice(0, 12000));
      } else {
        // xAI fallback with JPEG extraction
        const jpeg = extractJpegFromPDF(buffer);
        if (jpeg) {
          source = "vision-scanned";
          aiText = await parseWithImage(jpeg.toString("base64"), "image/jpeg");
        } else {
          return NextResponse.json({
            error: "SCANNED_PDF",
            message: "Could not extract image from this PDF. Take a photo or screenshot of the eval page and upload as JPG.",
          }, { status: 422 });
        }
      }

    } else {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF or image (JPG/PNG/WEBP)." }, { status: 400 });
    }

    if (!aiText) return NextResponse.json({ error: "AI returned empty response.", source }, { status: 500 });

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("parse-evaluation: AI returned non-JSON:", aiText.slice(0, 300));
      return NextResponse.json({ error: "AI could not extract structured data. Raw response: " + aiText.slice(0, 200), source }, { status: 422 });
    }

    const extracted  = JSON.parse(jsonMatch[0]);
    const fieldCount = Object.keys(extracted).filter(k => {
      const v = extracted[k];
      return v !== null && v !== undefined && v !== "" && v !== 0;
    }).length;

    return NextResponse.json({ success: true, fields: extracted, fieldCount, source });

  } catch (err) {
    console.error("parse-evaluation error:", err);
    return NextResponse.json({ error: "Unexpected error parsing document." }, { status: 500 });
  }
}
