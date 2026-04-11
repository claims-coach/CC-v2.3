/**
 * POST /api/recall
 * Semantic search across client memories.
 * Body: { query, caseId?, category?, limit? }
 */
import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embed";

const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

async function convexAction(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return res.json();
}

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await res.json();
  return d.value;
}

export async function POST(req: NextRequest) {
  try {
    const { query, caseId, category, limit = 5 } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

    // Embed the query
    const embedding = await embed(query);
    if (!embedding) return NextResponse.json({ error: "Embedding failed — Ollama unreachable" }, { status: 503 });

    // Vector search
    const results = await convexAction("clientMemory:search", { embedding, caseId, category, limit });

    // Hydrate — fetch full records for each result
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ memories: [] });
    }

    const hydrated = await Promise.all(
      results.map(async (r: { _id: string; _score: number }) => {
        const doc = await convexQuery("clientMemory:listByCase", { caseId: caseId || "" });
        const match = Array.isArray(doc) ? doc.find((d: any) => d._id === r._id) : null;
        return match ? { ...match, score: r._score } : { _id: r._id, score: r._score };
      })
    );

    return NextResponse.json({ memories: hydrated, count: hydrated.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
