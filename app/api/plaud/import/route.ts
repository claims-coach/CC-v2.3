import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Plaud API base — update if their endpoint changes
const PLAUD_API = "https://api.plaud.ai/api/v1";

interface PlaudNote {
  id: string;
  title: string;
  summary?: string;
  transcript?: string;
  content?: string;
  created_at?: string;   // ISO string
  recorded_at?: string;  // ISO string
  tags?: string[];
}

async function fetchPlaudNotes(apiKey: string): Promise<PlaudNote[]> {
  const res = await fetch(`${PLAUD_API}/notes`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Plaud API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  // Plaud may return { data: [...] } or just an array
  return Array.isArray(data) ? data : (data.data ?? data.notes ?? data.items ?? []);
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, email } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }

    // Fetch notes from Plaud
    const notes = await fetchPlaudNotes(apiKey);

    if (!notes.length) {
      return NextResponse.json({ imported: 0, message: "No notes found in Plaud account." });
    }

    let imported = 0;
    let skipped = 0;

    for (const note of notes) {
      const sourceId = `plaud:${note.id}`;

      // Check for duplicate
      const existing = await convex.query(api.memories.getBySourceId, { sourceId });
      if (existing) { skipped++; continue; }

      const title = note.title || `Plaud Recording — ${new Date(note.recorded_at || note.created_at || Date.now()).toLocaleDateString()}`;
      const content = note.summary || note.transcript || note.content || "(no content)";
      const recordedAt = note.recorded_at || note.created_at ? new Date(note.recorded_at || note.created_at!).getTime() : undefined;
      const tags = ["plaud", ...(note.tags ?? [])];

      await convex.mutation(api.memories.create, {
        title,
        content,
        type: "conversation",
        tags,
        source: "plaud",
        sourceId,
        recordedAt,
        clientName: email || undefined,
      });

      imported++;
    }

    return NextResponse.json({
      imported,
      skipped,
      total: notes.length,
      message: `Imported ${imported} notes from Plaud (${skipped} already existed).`,
    });
  } catch (err: any) {
    console.error("[plaud/import]", err);
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 });
  }
}
