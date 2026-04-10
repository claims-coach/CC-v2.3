import { NextRequest, NextResponse } from "next/server";
import { geminiWithTracking } from "@/lib/trackAI";

const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_KEY) {
      return NextResponse.json({ 
        error: "GOOGLE_GEMINI_API_KEY not configured",
        status: "KEY_MISSING"
      }, { status: 400 });
    }

    const { prompt = "Write a brief blog post outline about handling insurance claims after vehicle damage." } = await req.json();

    // Test Gemini API directly to get real error
    const testRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-goog-api-key": GEMINI_KEY 
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );
    
    const testData = await testRes.json();
    
    // Check for quota error
    if (testRes.status === 429 && testData.error?.message?.includes("quota")) {
      return NextResponse.json({
        model: "gemini-2.0-flash",
        response: "",
        timestamp: new Date().toISOString(),
        success: false,
        status: "QUOTA_EXCEEDED",
        error: testData.error?.message,
        note: "Gemini API key exists but is on free tier with $0 budget. Upgrade to paid plan to enable API calls.",
      });
    }
    
    // If API call succeeded, use the wrapper function
    const response = await geminiWithTracking(prompt, {
      model: "gemini-2.0-flash",
      maxTokens: 500,
      agentName: "QA Test Agent",
      route: "test-gemini",
      apiKey: GEMINI_KEY,
    });

    return NextResponse.json({
      model: "gemini-2.0-flash",
      response,
      timestamp: new Date().toISOString(),
      success: !!response,
      status: response ? "OK" : "EMPTY_RESPONSE",
    });

  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message || "Test failed",
      status: "EXCEPTION"
    }, { status: 500 });
  }
}
