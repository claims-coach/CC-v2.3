/**
 * POST /api/remember
 * Store a semantic memory for a case/client.
 * Body: { caseId?, caseKey?, contactId?, clientName?, category, text, source, agentId? }
 */
import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embed";

const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, caseKey, contactId, clientName, category = "fact", text, source = "manual", agentId } = body;

    if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

    // Generate embedding
    const embedding = await embed(text);
    if (!embedding) return NextResponse.json({ error: "Embedding failed — Ollama unreachable" }, { status: 503 });

    const result = await convexMutation("clientMemory:store", {
      caseId, caseKey, contactId, clientName, category, text, source, embedding, agentId,
    });

    return NextResponse.json({ success: true, id: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
