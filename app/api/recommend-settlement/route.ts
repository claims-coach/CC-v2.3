import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 3000): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    agentName: "Settlement Agent",
    route: "recommend-settlement",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      caseId,
      clientName,
      vehicleStr,
      year,
      make,
      model,
      mileage,
      acv,
      damageType,
      repairEstimate,
      totalMedicalBills,
      priorSettlements, // array of past settlement amounts for similar cases
    } = await req.json();

    if (!caseId || !acv) {
      return NextResponse.json({ error: "caseId and acv required" }, { status: 400 });
    }

    agentStart("Settlement Agent", `Recommending settlement range for case ${caseId}`);

    const prompt = `You are an expert claims analyst recommending a settlement range for a vehicle damage claim.

VEHICLE & DAMAGE:
- Vehicle: ${year} ${make} ${model} (${mileage ? Number(mileage).toLocaleString() + " miles" : "Unknown mileage"})
- Actual Cash Value (ACV): $${Number(acv).toLocaleString()}
- Damage Type: ${damageType || "Not specified"}
- Repair Estimate: $${repairEstimate ? Number(repairEstimate).toLocaleString() : "Not obtained"}
- Medical Bills/Injuries: $${totalMedicalBills ? Number(totalMedicalBills).toLocaleString() : "None"}

CASE CONTEXT:
- Client: ${clientName || "Unknown"}
- Similar Past Settlements: ${
      priorSettlements && priorSettlements.length > 0
        ? priorSettlements.map((s: any) => `$${Number(s).toLocaleString()}`).join(", ")
        : "None on record"
    }

SETTLEMENT ANALYSIS TASK:
1. Establish the FLOOR (minimum acceptable settlement):
   - Consider ACV, medical costs, diminished value potential
   
2. Establish the CEILING (maximum realistic demand):
   - Consider repair estimates, loss of use, attorney/adjuster fees
   
3. Identify the TARGET (most likely settlement point):
   - Balance client expectations with insurer resistance
   
4. Provide settlement strategy:
   - Initial demand (80-90% of ceiling)
   - First counter-offer if needed
   - Walk-away threshold

Return EXACTLY this JSON (no other text):
{
  "settlementFloor": 0,
  "settlementCeiling": 0,
  "recommendedTarget": 0,
  "initialDemand": 0,
  "firstCounterOffer": 0,
  "walkAwayThreshold": 0,
  "rationale": "brief explanation of why these numbers",
  "riskFactors": ["factor1", "factor2"],
  "strengthOfCase": "STRONG | MODERATE | WEAK"
}`;

    const recommendationText = await callGPT4(prompt, 3000);

    if (!recommendationText) {
      agentDone("Settlement Agent", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    // Parse JSON
    let recommendation: any = {};
    try {
      const jsonMatch = recommendationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
      }
    } catch {
      recommendation = { analysis: recommendationText };
    }

    agentDone(
      "Settlement Agent",
      `Settlement recommendation: ${recommendation.recommendedTarget ? "$" + Number(recommendation.recommendedTarget).toLocaleString() : "generated"}`
    );

    return NextResponse.json({
      success: true,
      caseId,
      clientName,
      vehicleStr,
      acv,
      recommendation,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Settlement Agent", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
