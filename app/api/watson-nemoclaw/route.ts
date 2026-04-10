/**
 * Watson + NemoClaw Integration
 * 
 * Handles browser tab pages sent via NemoClaw extension
 * Extracts vehicle comp data from actual listing pages
 * Returns structured comp data + working links
 * 
 * Endpoint: POST /api/watson-nemoclaw
 * Input: { htmlContent: string, url: string, caseId: string }
 * Output: { comps: [{vin, price, mileage, ...}], links: [...], pdfUrl?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";
import { MODELS } from "@/lib/models";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

async function extractCompData(htmlContent: string, url: string): Promise<any> {
  const { claudeWithTracking } = await import("@/lib/trackAI");
  
  const prompt = `You are Watson, Claims.Coach's comp research specialist.

A user found this AutoTrader/CarGurus/Edmunds listing page and sent it via NemoClaw browser extension.

URL: ${url}
Page HTML (excerpt): ${htmlContent.slice(0, 3000)}...

EXTRACT:
1. Vehicle details: VIN (MUST be exact), year, make, model, trim, mileage, color, transmission, condition, damage/accident history
2. Pricing: asking price, comparable range
3. Location: city, state, zip, dealer name
4. Photo/condition notes: overall condition tier (excellent/good/fair/poor)
5. Confirm URL is working/accessible
6. Date the listing was posted

STRICT RULES:
- VIN must be EXACT (not hallucinated)
- Price must be EXACT from page
- If VIN is not visible, say "VIN NOT FOUND" (do NOT guess)
- If page loads error, note it
- Return JSON format only

JSON OUTPUT:
{
  "vin": "exact VIN from page or null",
  "year": number,
  "make": string,
  "model": string,
  "trim": string,
  "mileage": number,
  "price": number,
  "color": string,
  "transmission": "automatic/manual",
  "condition": "excellent/good/fair/poor",
  "location": { "city": string, "state": string, "zip": string },
  "dealerName": string,
  "url": string,
  "urlWorking": boolean,
  "photoNotes": string,
  "listingDate": string,
  "dataQuality": "high/medium/low",
  "extractionNotes": string
}`;

  const response = await claudeWithTracking(prompt, {
    model: MODELS.SONNET,
    maxTokens: 1000,
    agentName: "Watson",
    route: "watson-nemoclaw",
    apiKey: ANTHROPIC_KEY,
  });

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse extraction" };
  } catch (e) {
    return { error: "Extraction failed", raw: response };
  }
}

async function generateCompPDF(compData: any, caseId: string): Promise<string> {
  const { claudeWithTracking } = await import("@/lib/trackAI");

  // Placeholder: would call PDF generation route
  // For now, return a note that PDF generation is queued
  return `PDF generation queued for case ${caseId}`;
}

export async function POST(req: NextRequest) {
  try {
    agentStart("Watson", "NemoClaw comp extraction started");

    const { htmlContent, url, caseId, pageTitle } = await req.json();

    if (!htmlContent || !url) {
      return NextResponse.json(
        { error: "Missing htmlContent or url" },
        { status: 400 }
      );
    }

    // Extract comp data from actual page
    console.log(`🔍 Watson analyzing comp page: ${url}`);
    const compData = await extractCompData(htmlContent, url);

    if (compData.error) {
      agentDone(
        "Watson",
        `Extraction failed: ${compData.error}`
      );
      return NextResponse.json({ success: false, ...compData }, { status: 400 });
    }

    // Validate critical fields
    if (!compData.vin || compData.vin === "VIN NOT FOUND") {
      console.warn("⚠️ VIN not found on page — data quality compromised");
      compData.dataQuality = "low";
    }

    if (!compData.urlWorking) {
      console.warn("⚠️ URL may not be accessible");
    }

    // Generate PDF if caseId provided
    let pdfUrl = null;
    if (caseId) {
      pdfUrl = await generateCompPDF(compData, caseId);
    }

    agentDone(
      "Watson",
      `Extracted comp: ${compData.year} ${compData.make} ${compData.model} @ $${compData.price}`
    );

    return NextResponse.json({
      success: true,
      comp: compData,
      pdfUrl,
      caseId,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    agentDone("Watson", `NemoClaw extraction failed: ${err.message}`);
    console.error("Watson NemoClaw error:", err);
    return NextResponse.json(
      { error: "Watson extraction failed", details: err.message },
      { status: 500 }
    );
  }
}
