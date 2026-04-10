import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";
import { MODELS } from "@/lib/models";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

async function callGPT4(prompt: string, maxTokens = 4000): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    maxTokens,
    agentName: "Demand Letter Agent",
    route: "draft-demand-letter",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, clientName, vehicleStr, acv, damage, injuries, medicalBills, totalDamages } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "caseId required" }, { status: 400 });
    }

    agentStart("Demand Letter Agent", `Drafting demand letter for case ${caseId}`);

    const prompt = `You are an expert public adjuster drafting a professional demand letter to an insurance company.

CASE DETAILS:
- Client Name: ${clientName || "Unknown"}
- Vehicle: ${vehicleStr || "Unknown"}
- Actual Cash Value: $${acv ? Number(acv).toLocaleString() : "0"}
- Damage Description: ${damage || "Not provided"}
- Injuries: ${injuries || "No injuries reported"}
- Medical Bills: $${medicalBills ? Number(medicalBills).toLocaleString() : "0"}
- Total Damages: $${totalDamages ? Number(totalDamages).toLocaleString() : "0"}

Please draft a professional demand letter that:
1. Opens with a clear statement of the claim
2. Summarizes the insured's policy coverage and limits
3. Details the loss (vehicle damage, injuries, and other damages)
4. Provides valuation support (comparable vehicles, repair estimates)
5. Calculates total compensation demand (vehicle value + damages + medical)
6. Sets a clear deadline for response (30 days)
7. Includes professional closing with public adjuster credentials

Format the letter as a formal business document ready for client signature. Do not include placeholders like [DATE] — use actual dates and specific numbers provided.

Generate the complete demand letter now:`;

    const letterText = await callGPT4(prompt, 4000);

    if (!letterText) {
      agentDone("Demand Letter Agent", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    agentDone("Demand Letter Agent", `Successfully drafted demand letter for ${clientName || "case " + caseId}`);

    return NextResponse.json({
      success: true,
      caseId,
      clientName,
      letterContent: letterText,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Demand Letter Agent", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
