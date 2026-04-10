import { NextRequest, NextResponse } from "next/server";

// Unified AI route — prefers Anthropic, falls back to xAI (Grok)
export async function POST(req: NextRequest) {
  const { prompt, maxTokens = 2000 } = await req.json();

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const xaiKey       = process.env.XAI_API_KEY;

  if (anthropicKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    return NextResponse.json({ content: data.content?.[0]?.text || "Error generating content." });
  }

  if (xaiKey) {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
      body: JSON.stringify({ model: "grok-4-0709", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    return NextResponse.json({ content: data.choices?.[0]?.message?.content || "Error generating content." });
  }

  return NextResponse.json({ content: "No AI API key configured. Add ANTHROPIC_API_KEY or XAI_API_KEY to .env.local" }, { status: 500 });
}
