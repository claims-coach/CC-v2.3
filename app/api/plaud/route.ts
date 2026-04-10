import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Notify Johnny via Telegram through OpenClaw gateway
async function notifyTelegram(message: string) {
  try {
    await fetch("http://127.0.0.1:18789/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer cef62d78fbff0347ed92d2b5fdfcc8fa0a8b18091e46eade",
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [{
          role: "user",
          content: `SYSTEM: A new Plaud recording was just ingested. Send Johnny a brief Telegram notification (chat ID 8733921180) with this summary: ${message}. Keep it short — just the key info.`,
        }],
      }),
    });
  } catch (e) {
    console.error("Telegram notify failed:", e);
  }
}

// Parse Plaud webhook payload — handles multiple known formats
function parsePlaud(body: any): {
  externalId: string;
  title: string;
  transcript: string;
  summary?: string;
  duration?: number;
  audioUrl?: string;
  recordedAt: number;
  speakers: string[];
  tags: string[];
} {
  // Format 1: Plaud Note / NotePin native webhook
  if (body.note || body.record) {
    const n = body.note ?? body.record;
    const transcript =
      n.transcript ?? n.transcription ?? n.content ?? n.text ?? "";
    const summary = n.summary ?? n.ai_summary ?? n.brief ?? undefined;
    return {
      externalId: String(n.id ?? n.note_id ?? body.id ?? Date.now()),
      title:      n.title ?? n.name ?? `Plaud Recording ${new Date().toLocaleDateString()}`,
      transcript,
      summary,
      duration:   n.duration ?? n.duration_seconds ?? undefined,
      audioUrl:   n.audio_url ?? n.url ?? undefined,
      recordedAt: n.created_at
        ? new Date(n.created_at).getTime()
        : n.recorded_at
        ? new Date(n.recorded_at).getTime()
        : Date.now(),
      speakers:   n.speakers ?? [],
      tags:       n.tags ?? [],
    };
  }

  // Format 2: flat payload
  const transcript =
    body.transcript ?? body.transcription ?? body.text ?? body.content ?? "";
  const summary = body.summary ?? body.ai_summary ?? body.brief ?? undefined;
  return {
    externalId: String(body.id ?? body.recording_id ?? Date.now()),
    title:      body.title ?? body.name ?? `Plaud Recording ${new Date().toLocaleDateString()}`,
    transcript,
    summary,
    duration:   body.duration ?? body.duration_seconds ?? undefined,
    audioUrl:   body.audio_url ?? body.url ?? body.audio ?? undefined,
    recordedAt: body.created_at
      ? new Date(body.created_at).getTime()
      : body.recorded_at
      ? new Date(body.recorded_at).getTime()
      : Date.now(),
    speakers:   body.speakers ?? [],
    tags:       body.tags ?? [],
  };
}

// Heuristic: try to extract a client name from transcript text
function guessClientName(transcript: string): string | undefined {
  // Look for "client: Name", "caller: Name", "customer: Name", "for Name", etc.
  const patterns = [
    /(?:client|caller|customer|insured|claimant)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /(?:speaking with|call with|meeting with|re:)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
  ];
  for (const p of patterns) {
    const m = transcript.match(p);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[plaud webhook]", JSON.stringify(body).slice(0, 300));

    const parsed = parsePlaud(body);

    if (!parsed.transcript && !parsed.title) {
      return NextResponse.json({ error: "No transcript content found" }, { status: 400 });
    }

    // Try to guess client from transcript
    const clientName = body.client_name ?? body.clientName ?? guessClientName(parsed.transcript);

    // Ingest into Convex
    const recordingId = await convex.mutation(api.recordings.ingest, {
      source:     "plaud",
      externalId: parsed.externalId,
      title:      parsed.title,
      transcript: parsed.transcript,
      summary:    parsed.summary,
      duration:   parsed.duration,
      clientName,
      audioUrl:   parsed.audioUrl,
      speakers:   parsed.speakers.length ? parsed.speakers : undefined,
      driveUrl:   body.drive_url ?? undefined,
      tags:       ["plaud", "call", ...parsed.tags],
      recordedAt: parsed.recordedAt,
    });

    // Also create a file entry if audio URL present
    if (parsed.audioUrl) {
      await convex.mutation(api.files.create, {
        name:       `${parsed.title}.m4a`,
        category:   "recording",
        driveUrl:   body.drive_url ?? undefined,
        clientName,
        notes:      parsed.summary,
        tags:       ["plaud", "audio"],
        uploadedBy: "Plaud",
      });
    }

    // Notify Johnny
    const preview = parsed.summary
      ?? parsed.transcript.slice(0, 200).replace(/\n/g, " ") + "…";
    const mins    = parsed.duration ? `${Math.round(parsed.duration / 60)}m` : "unknown length";
    await notifyTelegram(
      `📼 **${parsed.title}** (${mins})${clientName ? ` — client: ${clientName}` : ""}. Preview: "${preview}"`
    );

    return NextResponse.json({ ok: true, recordingId });
  } catch (err: any) {
    console.error("[plaud webhook error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok:      true,
    webhook: "Plaud recording ingestion endpoint",
    usage:   "POST JSON with transcript/note payload from Plaud app",
  });
}
