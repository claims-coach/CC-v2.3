import { NextRequest, NextResponse } from "next/server";
import { trackAI } from "@/lib/trackAI";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const XAI_KEY       = process.env.XAI_API_KEY || "";

type ImageMode = "damage" | "carfax" | "estimate" | "general";

const MODE_PROMPTS: Record<ImageMode, string> = {
  damage: `You are an auto damage expert analyzing vehicle damage photos for a public adjuster's diminished value and ACV report.

Analyze this vehicle damage photo and return structured JSON:
{
  "severity": "minor | moderate | severe | total_loss",
  "affectedAreas": ["hood", "driver_door", "front_bumper", ...],
  "damageTypes": ["paint_scratch", "panel_dent", "structural", "airbag_deployed", "frame_damage", "glass_broken", ...],
  "structuralConcerns": true/false,
  "estimatedRepairRange": { "low": 2500, "high": 4500 },
  "dvImpact": "high | medium | low",
  "dvNotes": "Structural damage or airbag deployment significantly increases DV claim strength...",
  "findings": ["Visible crease in driver door suggests body shop repair required", ...],
  "photoQuality": "good | adequate | poor",
  "additionalPhotosNeeded": ["undercarriage", "frame rails", ...]
}`,

  carfax: `You are analyzing a Carfax or AutoCheck vehicle history report screenshot for a public adjuster preparing a DV or ACV claim.

Extract all available information and return structured JSON:
{
  "vin": "...",
  "year": 2020,
  "make": "Toyota",
  "model": "Camry",
  "trim": "XSE",
  "accidentCount": 2,
  "accidents": [
    { "date": "2023-04", "severity": "moderate", "airbagDeployed": false, "structuralDamage": false, "description": "..." }
  ],
  "ownerCount": 2,
  "titleProblems": false,
  "odometer": [{ "date": "2024-01", "miles": 45000 }],
  "serviceRecords": 3,
  "dvRelevance": "Prior accidents reduce resale value — strong basis for DV claim",
  "acvImpact": "Clean title with 2 accidents supports ACV dispute if offer is below NADA clean"
}`,

  estimate: `You are analyzing an insurance repair estimate or body shop invoice for a public adjuster.

Extract all line items and return structured JSON:
{
  "shopName": "...",
  "estimateDate": "2024-03-01",
  "totalAmount": 8450.00,
  "laborHours": 42.5,
  "laborRate": 65.00,
  "lineItems": [
    { "description": "R&R Front Bumper Cover", "hours": 2.5, "partsCost": 450, "laborCost": 162.50, "type": "repair|replace|refinish" }
  ],
  "partsTotal": 3200,
  "laborTotal": 2762.50,
  "paintMaterials": 487.50,
  "discrepancies": ["Labor rate $65 is below market rate of $75-85/hr in WA", "Missing airbag sensor replacement"],
  "missedItems": ["Structural alignment check not included", "Rental car not authorized"],
  "supplementNeeded": true,
  "notes": "..."
}`,

  general: `You are an expert insurance claims analyst examining a document or image for a public adjuster.

Describe what you see and extract any relevant claims-related information. Return JSON:
{
  "documentType": "...",
  "keyFindings": ["...", "..."],
  "extractedData": {},
  "relevanceToClaimsWork": "...",
  "actionItems": ["..."]
}`
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const url      = formData.get("url") as string | null;
    const mode     = (formData.get("mode") as ImageMode) || "damage";
    const agentName = (formData.get("agentName") as string) || "Analysis Agent";

    if (!file && !url) {
      return NextResponse.json({ error: "file or url required" }, { status: 400 });
    }

    const prompt = MODE_PROMPTS[mode] || MODE_PROMPTS.general;

    // Build image content for Claude vision
    let imageContent: any;
    if (file) {
      const bytes  = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const mime   = file.type || "image/jpeg";
      imageContent = { type: "base64", media_type: mime, data: base64 };
    } else if (url) {
      imageContent = { type: "url", url };
    }

    const t0 = Date.now();

    // Try Claude vision first (best for documents/estimates)
    if (ANTHROPIC_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: imageContent },
              { type: "text", text: prompt + "\n\nReturn ONLY valid JSON, no markdown fences." }
            ]
          }]
        }),
      });

      const d = await res.json();
      const text = d.content?.[0]?.text || "";

      trackAI({
        model: "claude-sonnet-4-6",
        agentName,
        route: `analyze-vehicle-image:${mode}`,
        inputTokens:  d.usage?.input_tokens,
        outputTokens: d.usage?.output_tokens,
        durationMs:   Date.now() - t0,
        success: res.ok,
      });

      if (text) {
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
          return NextResponse.json({ mode, result: parsed, model: "claude-sonnet-4-6" });
        } catch {
          return NextResponse.json({ mode, result: { raw: text }, model: "claude-sonnet-4-6" });
        }
      }
    }

    // Fallback: Grok vision
    if (XAI_KEY && url) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI_KEY}` },
        body: JSON.stringify({
          model: "grok-4-0709",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url } },
              { type: "text", text: prompt + "\n\nReturn ONLY valid JSON." }
            ]
          }]
        }),
      });
      const d = await res.json();
      const text = d.choices?.[0]?.message?.content || "";

      trackAI({
        model: "grok-4-0709",
        agentName,
        route: `analyze-vehicle-image:${mode}`,
        inputTokens:  d.usage?.prompt_tokens,
        outputTokens: d.usage?.completion_tokens,
        durationMs:   Date.now() - t0,
        success: res.ok,
      });

      if (text) {
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
          return NextResponse.json({ mode, result: parsed, model: "grok-4-0709" });
        } catch {
          return NextResponse.json({ mode, result: { raw: text }, model: "grok-4-0709" });
        }
      }
    }

    return NextResponse.json({ error: "No vision AI available" }, { status: 500 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
