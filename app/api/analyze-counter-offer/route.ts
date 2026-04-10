import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 2000): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    maxTokens,
    agentName: "Chris",
    route: "analyze-counter-offer",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      caseId,
      clientName,
      vehicleStr,
      previousOfferAmount,
      counterOfferAmount,
      clientTargetFloor,
      ourDemand,
      reasonsForCounter,
    } = await req.json();

    if (!counterOfferAmount || !clientTargetFloor) {
      return NextResponse.json(
        { error: "counterOfferAmount and clientTargetFloor required" },
        { status: 400 }
      );
    }

    agentStart(
      "Chris",
      `Analyzing counter-offer for ${clientName || "client"} — ${vehicleStr || "vehicle"}`
    );

    const prompt = `You are an expert public adjuster analyzing an insurer's counter-offer in a vehicle damage claim negotiation.

CASE CONTEXT:
- Client: ${clientName || "Unknown"}
- Vehicle: ${vehicleStr || "Unknown"}
- Our Demand: $${ourDemand ? Number(ourDemand).toLocaleString() : "Not set"}
- Their Previous Offer: $${previousOfferAmount ? Number(previousOfferAmount).toLocaleString() : "Unknown"}
- Their Counter-Offer: $${Number(counterOfferAmount).toLocaleString()}
- Client Target Floor: $${Number(clientTargetFloor).toLocaleString()}
- Insurer's Stated Reasons: ${reasonsForCounter || "Not provided"}

ANALYSIS TASK:
1. Assess the reasonableness of their counter-offer relative to our demand and their previous position
2. Analyze the gap between their offer and the client's target floor
3. Evaluate the strength of their stated reasons
4. Determine if this is a good-faith negotiation or delay tactic
5. Calculate percentage increases from their previous offer

RECOMMENDATION:
Based on your analysis, should the client:
A) Accept this counter-offer
B) Make a counter-proposal (if so, suggest a target amount with justification)
C) Prepare for appraisal clause / litigation

Provide a clear, actionable recommendation with specific dollar amounts and rationale. Format as JSON:
{
  "recommendation": "ACCEPT | COUNTER | ESCALATE",
  "counterProposalAmount": 0,
  "reasoning": "...",
  "strengthOfInsurerPosition": "WEAK | MODERATE | STRONG",
  "nextSteps": ["action1", "action2"],
  "confidenceLevel": "HIGH | MODERATE | LOW"
}`;

    const analysisText = await callGPT4(prompt, 2000);

    if (!analysisText) {
      agentDone("Chris", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    // Parse JSON if possible
    let analysis: any = {};
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back to raw text
      analysis = { analysis: analysisText };
    }

    agentDone("Chris", `Analyzed counter-offer: ${analysis.recommendation || "completed"}`);

    return NextResponse.json({
      success: true,
      caseId,
      clientName,
      previousOffer: previousOfferAmount,
      counterOffer: counterOfferAmount,
      clientTargetFloor,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Chris", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
