import { NextRequest, NextResponse } from "next/server";
import { ollamaSmart } from "@/lib/ollama";

// Parses maintenance/repair invoices (PDF or image) and returns structured line items
// Uses Ollama (local, free) for PDFs; falls back to Claude/xAI for vision (images)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    const systemPrompt = `You are an expert at reading auto repair and maintenance invoices and receipts.
Extract each line item and return a JSON array. Each item should have:
{
  "category": "Maintenance type (e.g. Tires, Brakes, Oil Change, Detailing, Audio, Wheels, Suspension, etc.)",
  "items": "Description of the work or parts",
  "date": "YYYY-MM-DD (from invoice date)",
  "cost": number (dollar amount, no $ sign),
  "depPct": 0
}
If a document has a single total and no line items, return one item with the full description.
Return ONLY a valid JSON array. No explanation. No markdown.`;

    let aiText = "";

    if (mimeType.startsWith("image/")) {
      // Images need vision — use Claude or xAI (Ollama vision not reliable enough yet)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const xaiKey       = process.env.XAI_API_KEY;
      const base64 = buffer.toString("base64");

      if (anthropicKey) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", // cheapest vision model
            max_tokens: 1000,
            system: systemPrompt,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
              { type: "text", text: "Extract all line items from this invoice." }
            ]}],
          }),
        });
        const data = await res.json();
        aiText = data.content?.[0]?.text || "";
      } else if (xaiKey) {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
          body: JSON.stringify({
            model: "grok-4-0709",
            max_tokens: 1000,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: "text", text: "Extract all line items from this invoice." }
              ]}
            ],
          }),
        });
        const data = await res.json();
        aiText = data.choices?.[0]?.message?.content || "";
      }
    } else if (mimeType === "application/pdf") {
      // PDFs: extract text → send to LOCAL Ollama (free)
      let pdfText = "";
      try {
        const pdfParse = await import("pdf-parse") as any;
        const parsed = await pdfParse(buffer);
        pdfText = parsed.text.slice(0, 8000);
      } catch {
        return NextResponse.json({ error: "Could not read PDF text." }, { status: 422 });
      }

      try {
        aiText = await ollamaSmart(pdfText, systemPrompt);
      } catch {
        // Ollama unavailable — fall back to Claude
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: pdfText }] }),
          });
          const data = await res.json();
          aiText = data.content?.[0]?.text || "";
        }
      }
    } else {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF, JPG, or PNG." }, { status: 400 });
    }

    if (!aiText) return NextResponse.json({ error: "No AI available or AI returned empty." }, { status: 500 });

    const jsonMatch = aiText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not parse line items from this document." }, { status: 422 });

    const items = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("parse-invoice error:", err);
    return NextResponse.json({ error: "Unexpected error parsing invoice." }, { status: 500 });
  }
}
