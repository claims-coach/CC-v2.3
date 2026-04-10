import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 2500): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    agentName: "Competitive Analysis Agent",
    route: "analyze-competitor-settlement",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      caseId,
      carrier,
      claimType,
      vehicleValue,
      vehicleStr,
      damageType,
      priorSettlementsForCarrier, // past settlements we've had with this carrier
      historicalCompCases, // array of similar cases from our database
    } = await req.json();

    if (!caseId || !carrier || !vehicleValue) {
      return NextResponse.json(
        { error: "caseId, carrier, and vehicleValue required" },
        { status: 400 }
      );
    }

    agentStart("Competitive Analysis Agent", `Analyzing competitor settlement for case ${caseId}`);

    const prompt = `You are a competitive claims analyst reviewing settlement patterns and positioning.

CURRENT CASE:
- Case ID: ${caseId}
- Carrier: ${carrier}
- Claim Type: ${claimType || "ACV/Total Loss"}
- Vehicle Value: $${Number(vehicleValue).toLocaleString()}
- Vehicle: ${vehicleStr || "Unknown"}
- Damage: ${damageType || "Not specified"}

CLAIMS.COACH SETTLEMENT HISTORY WITH THIS CARRIER:
${
  priorSettlementsForCarrier && priorSettlementsForCarrier.length > 0
    ? `Past 10 settlements: ${priorSettlementsForCarrier.map((s: any) => `$${Number(s).toLocaleString()}`).join(", ")}`
    : "No prior settlements found"
}

SIMILAR CASES FROM CLAIMS.COACH DATABASE:
${
  historicalCompCases && historicalCompCases.length > 0
    ? historicalCompCases
        .slice(0, 10)
        .map((c: any) => `- ${c.vehicleValue ? "$" + Number(c.vehicleValue).toLocaleString() : "N/A"} settlement`)
        .join("\n")
    : "No historical comp cases available"
}

ANALYSIS TASK:
1. What's our typical settlement range for this carrier?
2. How do our settlements compare to market rates?
3. What's the trend (are we settling higher or lower over time)?
4. What's a competitive target for this claim?

Return EXACTLY this JSON:
{
  "carrierSettlementPattern": "FAVORABLE | MODERATE | CHALLENGING",
  "averageOurSettlement": 0,
  "competitiveBenchmark": 0,
  "suggestedTarget": 0,
  "initialDemandAmount": 0,
  "marketTrend": "TRENDING_HIGHER | STABLE | TRENDING_LOWER",
  "recommendation": "description of positioning strategy",
  "dataQualityNote": "sample size and confidence level"
}`;

    const analysisText = await callGPT4(prompt, 2500);

    if (!analysisText) {
      agentDone("Competitive Analysis Agent", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    // Parse JSON
    let analysis: any = {};
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch {
      analysis = { analysis: analysisText };
    }

    agentDone(
      "Competitive Analysis Agent",
      `Competitive analysis: suggest target $${analysis.suggestedTarget || "TBD"}`
    );

    return NextResponse.json({
      success: true,
      caseId,
      carrier,
      vehicleValue,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Competitive Analysis Agent", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
