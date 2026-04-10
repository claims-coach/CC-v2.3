import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 3000): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    agentName: "Estimate Agent",
    route: "preprocess-estimate",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, estimatePdfText, estimateSource } = await req.json();

    if (!caseId || !estimatePdfText) {
      return NextResponse.json({ error: "caseId and estimatePdfText required" }, { status: 400 });
    }

    agentStart("Estimate Agent", `Pre-processing repair estimate for case ${caseId}`);

    const prompt = `You are an expert claims processor extracting line items from a repair estimate.

ESTIMATE TEXT:
${estimatePdfText.slice(0, 8000)}

TASK: Extract all repair line items and return EXACTLY this JSON structure (no other text):
{
  "totalEstimate": 0,
  "laborTotal": 0,
  "partsTotal": 0,
  "otherChargesTotal": 0,
  "lineItems": [
    {
      "description": "Replace front bumper",
      "quantity": 1,
      "unitCost": 500,
      "totalCost": 500,
      "category": "PARTS | LABOR | PAINT | OTHER",
      "notes": "OEM part"
    }
  ],
  "paintWork": {
    "included": true,
    "cost": 0,
    "description": "..."
  },
  "repairType": "STRUCTURAL | COSMETIC | MIXED",
  "estimator": "shop name or unknown",
  "estimateDate": "YYYY-MM-DD or unknown",
  "recommendations": ["recommendation1", "recommendation2"],
  "redFlags": ["issue1", "issue2"],
  "drivability": "TOTALED | NON_DRIVABLE | DRIVABLE_WITH_CAUTION | FULLY_DRIVABLE"
}

Extract ONLY what's clearly stated in the estimate. If a field is not found, use null or 0. For recommendations and red flags, infer from the estimate context if needed.`;

    const extractedText = await callGPT4(prompt, 3000);

    if (!extractedText) {
      agentDone("Estimate Agent", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    // Parse JSON
    let extracted: any = {};
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      extracted = { rawExtraction: extractedText };
    }

    agentDone("Estimate Agent", `Pre-processed estimate total: $${extracted.totalEstimate || "N/A"}`);

    return NextResponse.json({
      success: true,
      caseId,
      estimateSource: estimateSource || "unknown",
      extracted,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Estimate Agent", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
