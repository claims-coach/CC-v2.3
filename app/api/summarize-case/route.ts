import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 800): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    agentName: "Summary Agent",
    route: "summarize-case",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      caseId,
      clientName,
      vehicleStr,
      claimNumber,
      damageDescription,
      acv,
      currentStatus,
      lastActivity,
    } = await req.json();

    if (!caseId) {
      return NextResponse.json({ error: "caseId required" }, { status: 400 });
    }

    agentStart("Summary Agent", `Summarizing case ${caseId}`);

    const prompt = `You are a claims analyst creating a brief executive summary of a vehicle damage insurance claim.

CASE DETAILS:
- Case ID: ${caseId}
- Client: ${clientName || "Unknown"}
- Vehicle: ${vehicleStr || "Unknown"}
- Claim #: ${claimNumber || "Not assigned"}
- Vehicle Value (ACV): $${acv ? Number(acv).toLocaleString() : "Unknown"}
- Current Status: ${currentStatus || "In progress"}
- Last Update: ${lastActivity || "No recent activity"}

DAMAGE SUMMARY:
${damageDescription || "No damage description provided"}

TASK: Write a 2-3 sentence executive summary that:
1. Identifies the key issue (total loss, repairable, dispute type)
2. Highlights the current status and next action
3. Mentions any red flags or opportunities

Write ONLY the summary text. No preamble. Keep it professional and factual.`;

    const summaryText = await callGPT4(prompt, 800);

    if (!summaryText) {
      agentDone("Summary Agent", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    agentDone("Summary Agent", `Summarized case ${caseId}`);

    return NextResponse.json({
      success: true,
      caseId,
      clientName,
      summary: summaryText.trim(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Summary Agent", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
