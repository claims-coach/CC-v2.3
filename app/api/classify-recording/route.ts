import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = [
  "claims_coach",
  "walker_appraisal",
  "mas_solutions",
  "reca",
  "church",
  "personal",
  "uncategorized",
] as const;

type Category = (typeof CATEGORIES)[number];

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, summary } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }

    const prompt = `You are a recording classifier for a multi-business operator. Classify the following recording into exactly one category.

Categories and their meanings:
- claims_coach: Insurance claims consulting, ACV/DV reports, total loss, public adjusting work
- walker_appraisal: Vehicle appraisal, diminished value, loss of use expert reports
- mas_solutions: MAS Solutions business matters
- reca: RECA (Real Estate or related) business
- church: Church, faith, ministry, or spiritual matters
- personal: Personal conversations, family, health, non-business
- uncategorized: Cannot determine category from content

Recording Title: ${title || "(no title)"}
Summary: ${summary || "(no summary)"}
Transcript (first 800 chars): ${(transcript || "").slice(0, 800)}

Respond ONLY with a JSON object in this exact format:
{"category": "<one of the categories above>", "confidence": <0.0-1.0>}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text ?? "{}";

    let parsed: { category: Category; confidence: number } = {
      category: "uncategorized",
      confidence: 0,
    };
    try {
      const raw = JSON.parse(text);
      const cat = raw.category as Category;
      parsed.category    = CATEGORIES.includes(cat) ? cat : "uncategorized";
      parsed.confidence  = typeof raw.confidence === "number" ? raw.confidence : 0.5;
    } catch {
      // keep defaults
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
