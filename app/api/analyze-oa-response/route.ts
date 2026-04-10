import { NextRequest, NextResponse } from "next/server";
import { agentStart, agentDone } from "@/lib/agentBeat";
import { MODELS, getModel } from "@/lib/models";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const XAI_KEY       = process.env.XAI_API_KEY || "";

async function callClaude(prompt: string, maxTokens = 3000): Promise<string> {
  if (!ANTHROPIC_KEY) return "";
  const { claudeWithTracking } = await import("@/lib/trackAI");
  return claudeWithTracking(prompt, { model: MODELS.SONNET, maxTokens, agentName: "Chris", route: "analyze-oa-response", apiKey: ANTHROPIC_KEY });
}

async function callGPT4(prompt: string, maxTokens = 2000): Promise<string> {
  const { openaiWithTracking } = await import("@/lib/trackAI");
  return openaiWithTracking(prompt, { model: "gpt-4-turbo", maxTokens, agentName: "Chris", route: "analyze-oa-response", apiKey: process.env.OPENAI_API_KEY || "" });
}

async function callGrok(prompt: string): Promise<string> {
  if (!XAI_KEY) return "";
  const { grokWithTracking } = await import("@/lib/trackAI");
  return grokWithTracking(prompt, { model: "grok-4-0709", maxTokens: 2000, agentName: "Chris", route: "analyze-oa-response", apiKey: XAI_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const {
      oaText,           // raw OA email or PDF text
      ourACV,           // our stated ACV
      ourComps,         // our comp list [{description, askingPrice, compMileage, adjValue}]
      clientName,
      vehicleStr,       // "2022 Toyota Highlander Hybrid XLE AWD"
      mileage,
      location,
      insurerOffer,     // what the insurer originally offered
    } = await req.json();

    if (!oaText) return NextResponse.json({ error: "oaText required" }, { status: 400 });
    agentStart("Chris", `Analyzing OA response for ${clientName || "client"} — ${vehicleStr || "vehicle"}`);

    // ── Step 1: Extract OA's comps from their report ─────────────────────
    const extractPrompt = `You are analyzing an insurance appraiser's (OA = Other Appraiser, hired by the insurer) valuation report or email response.

SUBJECT VEHICLE: ${vehicleStr || "Unknown"}
SUBJECT MILEAGE: ${mileage ? Number(mileage).toLocaleString() + " miles" : "Unknown"}
SUBJECT LOCATION: ${location || "Washington State"}

OA's REPORT / EMAIL TEXT:
${oaText.slice(0, 8000)}

TASK 1: Extract the OA's comparable vehicles from their report. Return a JSON array:
[
  {
    "description": "Year Make Model Trim",
    "price": 12500,
    "mileage": 145000,
    "source": "AutoTrader",
    "url": "https://...",
    "adjustment": -500,
    "adjustedValue": 12000,
    "notes": "any notes they added"
  }
]

TASK 2: Extract the OA's final stated ACV (a single number).

Return EXACTLY this JSON (nothing else):
{
  "oaACV": 38500,
  "oaComps": [/* array from task 1 */]
}`;

    // Try GPT-4 first (reliable), fallback to Claude
    let extractText = await callGPT4(extractPrompt, 2000);
    if (!extractText) {
      console.log("Ollama unavailable for analyze-oa-response extraction, falling back to Claude");
      extractText = await callClaude(extractPrompt, 2000);
    }
    let oaACV = 0;
    let oaComps: any[] = [];
    try {
      const jsonMatch = extractText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        oaACV = parsed.oaACV || 0;
        oaComps = parsed.oaComps || [];
      }
    } catch { /* ignore parse error */ }

    // ── Step 2: Anchor comp detection ────────────────────────────────────
    const subjectMiles = mileage ? parseInt(String(mileage)) : 50000;
    const oaAvg = oaComps.length > 0
      ? oaComps.reduce((s: number, c: any) => s + (c.adjustedValue || c.price || 0), 0) / oaComps.length
      : oaACV;

    const anchorPrompt = `You are a public adjuster's expert assistant analyzing an opposing appraiser's (OA) comparable vehicle selections for manipulation or errors that artificially suppress the vehicle's value.

SUBJECT: ${vehicleStr || "Unknown"} with ${subjectMiles.toLocaleString()} miles in ${location || "Washington State"}
OUR ACV CONCLUSION: $${ourACV ? Number(ourACV).toLocaleString() : "Unknown"}
OA'S ACV CONCLUSION: $${oaACV ? Number(oaACV).toLocaleString() : "Unknown"}
VALUE GAP: $${ourACV && oaACV ? (Number(ourACV) - Number(oaACV)).toLocaleString() : "Unknown"}

OA's COMPS:
${oaComps.map((c: any, i: number) => `C${i+1}: ${c.description} — $${c.price?.toLocaleString()} (${c.mileage?.toLocaleString() || "??"} mi) — Adjusted: $${c.adjustedValue?.toLocaleString() || c.price?.toLocaleString()} — ${c.notes || ""}`).join("\n")}

OUR COMPS (for reference):
${(ourComps || []).map((c: any, i: number) => `C${i+1}: ${c.description} — $${c.askingPrice?.toLocaleString()} (${c.compMileage?.toLocaleString() || "??"} mi) — Adj: $${c.adjValue?.toLocaleString() || c.askingPrice?.toLocaleString()}`).join("\n")}

ANCHOR COMP DETECTION RULES — flag any comp that:
1. Has significantly HIGHER mileage than the subject (drags down mileage-adjusted value unfairly)
2. Is from a distant geographic market where prices are artificially lower
3. Uses an older model year when same-year comps exist in the market
4. Missing key equipment/packages the subject vehicle has (lower trim used as comp)
5. Applied excessive negative adjustments not supported by actual market data
6. Listed at salvage/rebuild title price (masked as clean title)
7. Is a statistical outlier — more than 10% below the other comps average
8. Source URL is dead/unverifiable

For each flagged comp, assign severity: "minor" | "moderate" | "major"
- major: comp should be entirely excluded — it's not a valid market comparison
- moderate: comp requires significant adjustment to be valid
- minor: minor concern, reduces weight of this comp

Return EXACTLY this JSON:
{
  "anchorFlags": [
    {
      "compDescription": "2020 Toyota Highlander XLE",
      "reason": "183,000 miles vs subject's 130,000 — 53k mile gap suppresses adjusted value by ~$3,000 beyond market norm. Mileage adjustment applied ($2,200) understates the actual market premium for lower-mileage vehicles in this class.",
      "severity": "major"
    }
  ],
  "analysisNarrative": "2-3 sentences summarizing the pattern of OA's comp selection strategy and the overall nature of the manipulation"
}`;

    // Try Ollama LOCAL_REASONING first ($0), fallback to Claude
    let anchorText = await callGPT4(anchorPrompt, 2000);
    if (!anchorText) {
      console.log("Ollama unavailable for anchor analysis, falling back to Claude");
      anchorText = await callClaude(anchorPrompt, 2000);
    }
    let anchorFlags: any[] = [];
    let analysisNarrative = "";
    try {
      const jsonMatch = anchorText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        anchorFlags = parsed.anchorFlags || [];
        analysisNarrative = parsed.analysisNarrative || "";
      }
    } catch { /* ignore */ }

    // ── Step 3: Research OA's comps with Grok (live search) ──────────────
    let compResearch = "";
    if (oaComps.length > 0 && XAI_KEY) {
      const researchPrompt = `You are helping a public adjuster rebut an insurance appraiser's vehicle valuation. Research these comparable vehicles used by the opposing appraiser to identify any inaccuracies:

SUBJECT: ${vehicleStr} (${subjectMiles.toLocaleString()} miles, ${location || "WA"})

OA'S COMPS TO RESEARCH:
${oaComps.slice(0, 4).map((c: any, i: number) => `${i+1}. ${c.description} — Listed at $${c.price?.toLocaleString()} — ${c.url || "No URL provided"}`).join("\n")}

For each comp:
- Verify: does the description match the price? Is this a reasonable market price for this vehicle?
- Flag: wrong trim level, salvage history indicators, high-damage auction units, geographic outliers
- Note: current market price range for this vehicle

Keep response concise — 2-3 sentences per comp max.`;

      compResearch = await callGrok(researchPrompt);
    }

    // ── Step 4: Draft rebuttal letter ─────────────────────────────────────
    const majorFlags = anchorFlags.filter((f: any) => f.severity === "major");
    const moderateFlags = anchorFlags.filter((f: any) => f.severity === "moderate");
    const excludedComps = majorFlags.length;
    const adjustedOaComps = oaComps.filter((_: any, i: number) =>
      !majorFlags.some((f: any) => f.compDescription.includes(oaComps[i]?.description?.substring(0, 15)))
    );
    const adjustedOaAvg = adjustedOaComps.length > 0
      ? adjustedOaComps.reduce((s: number, c: any) => s + (c.adjustedValue || c.price || 0), 0) / adjustedOaComps.length
      : oaAvg;

    const rebuttalPrompt = `You are Johnny Walker, a licensed public adjuster at Claims.Coach. Write a professional, firm rebuttal letter to the opposing appraiser (OA) hired by the insurance company.

CONTEXT:
- Client: ${clientName || "Our Client"}
- Vehicle: ${vehicleStr || "Subject Vehicle"}
- Our ACV conclusion: $${ourACV ? Number(ourACV).toLocaleString() : "TBD"}
- OA's ACV conclusion: $${oaACV ? Number(oaACV).toLocaleString() : "TBD"}
- Original insurer offer: $${insurerOffer ? Number(insurerOffer).toLocaleString() : "TBD"}
- Gap from our conclusion: $${ourACV && oaACV ? (Number(ourACV) - Number(oaACV)).toLocaleString() : "TBD"}

FLAGGED ISSUES WITH OA'S COMPARABLES:
${anchorFlags.map((f: any) => `• [${f.severity.toUpperCase()}] ${f.compDescription}: ${f.reason}`).join("\n") || "None flagged — address general methodology differences"}

COMP RESEARCH NOTES:
${compResearch || "N/A"}

ANALYSIS SUMMARY:
${analysisNarrative || "Significant discrepancy between our market analysis and the OA's conclusion."}

LETTER REQUIREMENTS:
- Professional, direct tone — not aggressive, but firm
- Address each major-flagged comp specifically by description
- Cite specific market evidence where possible
- Propose either: (a) specific adjusted value for disputed comps, OR (b) request to exclude outliers and recalculate
- End with a clear proposed resolution: either accept our ACV of $${ourACV ? Number(ourACV).toLocaleString() : "TBD"} or schedule an umpire
- Keep to 3-4 paragraphs — this is a professional letter, not an essay
- Do NOT include salutation headers, signatures, or "Dear [name]" — just the body paragraphs
- Write in first person as the insured's appraiser`;

    // Rebuttal is creative writing — keep with Claude or fallback to Ollama
    let draftRebuttal = await callGPT4(rebuttalPrompt, 2500);
    if (!draftRebuttal) {
      console.log("Ollama unavailable for rebuttal draft, falling back to Claude");
      draftRebuttal = await callClaude(rebuttalPrompt, 2500);
    }

    const gap = ourACV && oaACV ? Number(ourACV) - Number(oaACV) : null;

    agentDone("Chris", `Analysis complete — ${majorFlags.length} anchor comps flagged, gap $${gap ? Math.abs(gap).toLocaleString() : "?"}`);
    return NextResponse.json({
      oaACV,
      oaComps,
      anchorFlags,
      majorCount: majorFlags.length,
      moderateCount: moderateFlags.length,
      analysisNarrative,
      compResearch,
      draftRebuttal,
      gap,
      adjustedOaAvg: Math.round(adjustedOaAvg),
      excludedComps,
    });

  } catch (e: any) {
    console.error("analyze-oa-response error:", e);
    agentDone("Chris");
    return NextResponse.json({ error: e.message || "Analysis failed" }, { status: 500 });
  }
}
