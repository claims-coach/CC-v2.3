import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";

async function callGPT4(prompt: string, maxTokens = 1500): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, {
    model: "gpt-4-turbo",
    agentName: "Document Classifier",
    route: "classify-and-file-document",
    apiKey: process.env.OPENAI_API_KEY || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, documentName, documentText, documentType } = await req.json();

    if (!caseId || !documentText) {
      return NextResponse.json({ error: "caseId and documentText required" }, { status: 400 });
    }

    agentStart("Document Classifier", `Classifying document for case ${caseId}`);

    const prompt = `You are a document classification expert for insurance claims.

DOCUMENT NAME: ${documentName || "unknown"}
DOCUMENT TEXT (first 2000 chars):
${documentText.slice(0, 2000)}

TASK: Classify this document and determine the Drive folder it belongs to. Return EXACTLY this JSON:
{
  "classification": "INVOICE | ESTIMATE | PHOTO | EMAIL | REPAIR_AUTH | LETTER | MEDICAL_REPORT | POLICE_REPORT | OTHER",
  "driveFolder": "04_COMMUNICATIONS | 05_EXHIBITS | OTHER",
  "confidence": 0.95,
  "reasoning": "brief explanation of classification",
  "suggested_filename": "descriptive-filename.ext"
}

FOLDER GUIDE:
- 04_COMMUNICATIONS: emails, letters, demand letters, correspondence
- 05_EXHIBITS: photos, estimates, invoices, repair authorizations, medical reports
- Use 04_COMMUNICATIONS for written correspondence
- Use 05_EXHIBITS for supporting documents, images, and records

Return ONLY the JSON object.`;

    const classificationText = await callGPT4(prompt, 1500);

    if (!classificationText) {
      agentDone("Document Classifier", "Failed - Llama unavailable");
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    // Parse JSON
    let classification: any = {};
    try {
      const jsonMatch = classificationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      }
    } catch {
      classification = { error: "Failed to parse classification" };
    }

    agentDone("Document Classifier", `Classified as ${classification.classification || "unknown"}`);

    return NextResponse.json({
      success: true,
      caseId,
      documentName,
      classification,
      targetFolder: classification.driveFolder || "04_COMMUNICATIONS",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    agentDone("Document Classifier", `Error: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
