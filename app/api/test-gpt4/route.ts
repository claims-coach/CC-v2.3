import { NextRequest, NextResponse } from "next/server";
import { openaiWithTracking } from "@/lib/trackAI";

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 400 });
    }

    const { prompt = "Analyze this test claim data and provide a brief summary." } = await req.json();

    const response = await openaiWithTracking(prompt, {
      model: "gpt-4-turbo",
      maxTokens: 500,
      agentName: "QA Test Agent",
      route: "test-gpt4",
      apiKey: OPENAI_KEY,
    });

    return NextResponse.json({
      model: "gpt-4-turbo",
      response,
      timestamp: new Date().toISOString(),
      success: !!response,
    });

  } catch (e: any) {
    console.error("test-gpt4 error:", e);
    return NextResponse.json({ error: e.message || "Test failed" }, { status: 500 });
  }
}
