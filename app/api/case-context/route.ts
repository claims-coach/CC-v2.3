/**
 * Case Context API — Contextual Threading
 * Given a claimId (or clientName), returns a rich context bundle:
 *   - Claim data
 *   - Recent recordings mentioning this client
 *   - Recent activity for this claim
 *   - Open negotiation tasks
 *   - AI-generated "where we left off" summary
 *
 * Used to restore CC's context on any active case without re-explaining.
 */
import { NextRequest, NextResponse } from "next/server";
import { trackAI, openaiWithTracking, claudeWithTracking } from "@/lib/trackAI";
import { getModel } from "@/lib/models";

const CONVEX_URL    = "https://fabulous-roadrunner-674.convex.cloud";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

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
    const { claimId, clientName, generateSummary = true } = await req.json();
    if (!claimId && !clientName) {
      return NextResponse.json({ error: "claimId or clientName required" }, { status: 400 });
    }

    // ── Fetch all context in parallel ────────────────────────────────────
    const [claims, allRecordings, allActivity, negTasks] = await Promise.all([
      convexQuery("claims:list", {}),
      convexQuery("recordings:list", {}),
      convexQuery("activity:list", { limit: 200 }),
      convexQuery("negotiationTasks:list", {}),
    ]);

    // Find the claim
    const claim = claimId
      ? claims?.find((c: any) => c._id === claimId)
      : claims?.find((c: any) => c.clientName?.toLowerCase() === clientName?.toLowerCase());

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const nameSearch = claim.clientName?.toLowerCase() || "";
    const vinSearch  = claim.vin?.toLowerCase() || "";

    // Recordings mentioning this client (by name or VIN)
    const relatedRecordings = (allRecordings || [])
      .filter((r: any) =>
        r.clientName?.toLowerCase() === nameSearch ||
        r.transcript?.toLowerCase().includes(nameSearch) ||
        (vinSearch && r.transcript?.toLowerCase().includes(vinSearch))
      )
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 5);

    // Recent activity for this claim
    const relatedActivity = (allActivity || [])
      .filter((a: any) =>
        a.details?.toLowerCase().includes(nameSearch) ||
        a.details?.includes(claimId || "") ||
        a.details?.toLowerCase().includes((claim.vin || "").toLowerCase())
      )
      .slice(0, 15);

    // Open negotiation tasks for this client
    const negTasksForClaim = (negTasks || [])
      .filter((t: any) =>
        t.claimId === claim._id ||
        t.clientName?.toLowerCase() === nameSearch
      )
      .filter((t: any) => t.status === "pending_review" || t.status === "approved");

    // Build the context bundle
    const context = {
      claim: {
        id:          claim._id,
        clientName:  claim.clientName,
        vehicle:     [claim.year, claim.make, claim.model, claim.trim].filter(Boolean).join(" "),
        vin:         claim.vin,
        stage:       claim.stage,
        insurer:     claim.insurer,
        openingOffer: claim.openingOffer,
        targetValue: claim.targetValue,
        daysOpen:    claim.daysOpen,
        priority:    claim.priority,
        adjusterName: claim.adjusterName,
      },
      recordings: relatedRecordings.map((r: any) => ({
        title:      r.title,
        summary:    r.summary,
        recordedAt: r.recordedAt,
        createdAt:  r.createdAt,
      })),
      recentActivity: relatedActivity.map((a: any) => ({
        agent:     a.agentName,
        action:    a.action,
        details:   a.details,
        createdAt: a.createdAt,
      })),
      openNegotiations: negTasksForClaim.map((t: any) => ({
        oaACV:        t.oaACV,
        gap:          t.gap,
        anchorFlags:  t.anchorFlags?.length || 0,
        status:       t.status,
        draftReady:   !!t.draftRebuttal,
      })),
    };

    // ── Generate AI "where we left off" summary ───────────────────────────
    let threadSummary = "";
    if (generateSummary && ANTHROPIC_KEY) {
      // Pull full transcripts, not just summaries
      const recordingTexts = relatedRecordings.map((r: any) => {
        const body = r.transcript?.slice(0, 600) || r.summary?.slice(0, 300) || "";
        return body ? `[${r.title}]: ${body}` : null;
      }).filter(Boolean).join("\n\n");

      const summaryPrompt = `You are CC, the AI Chief of Staff at Claims.Coach. A case was just loaded in the ACV Workbench. Extract structured intel from the client's recorded calls/notes.

CLAIM: ${context.claim.clientName} — ${context.claim.vehicle || "vehicle unknown"} (VIN: ${context.claim.vin || "unknown"})
INSURER: ${context.claim.insurer || "unknown"} | INSURER OFFER: ${context.claim.openingOffer ? "$" + context.claim.openingOffer.toLocaleString() : "unknown"}

CALL RECORDINGS / NOTES:
${recordingTexts || "No recordings found for this client."}

Extract the following. If something was not mentioned, use null or [].

1. callSummary — 2–3 sentences describing what the vehicle owner told Johnny during the call: the situation, the vehicle condition, any damage history, mileage notes, or anything notable about the car. Be specific to what was actually said. If no recordings, return null.
2. clientRequests — specific items the client wants addressed: disputed deductions, aftermarket equipment, prior repairs, specific comps they mentioned, anything they flagged. Short bullet phrases. Return [] if none.
3. happyWith — the number or range the client said they'd be happy with or would accept (e.g. "anything over $36k", "$38,500"). Return null if not stated.
4. targetValue — if the client mentioned a specific floor/target dollar amount as a number (e.g. 36000), return it as an integer. Return null if not mentioned.
5. vehicleNotes — any specific details about the vehicle mentioned in the call: condition, options, recent work, accident history, mileage context. 1–2 sentences. Return null if nothing notable.

Respond ONLY with valid JSON — no markdown, no explanation:
{"callSummary": "...", "clientRequests": ["..."], "happyWith": "...", "targetValue": 36000, "vehicleNotes": "..."}`;




      const t0 = Date.now();
      // Try Ollama LOCAL_FAST first ($0), fallback to Claude Haiku
      let raw = "";
      try {
        raw = await openaiWithTracking(summaryPrompt, { agentName: "CC", route: "case-context", model: getModel("case-context"), apiKey: process.env.OPENAI_API_KEY || "" });
      } catch (err) {
        console.log("Ollama unavailable for case-context summary, falling back to Claude");
        if (ANTHROPIC_KEY) {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              messages: [{ role: "user", content: summaryPrompt }],
            }),
          });
          const d = await res.json();
          raw = d.content?.[0]?.text || "";
          trackAI({
            model: "claude-haiku-4-5-20251001", agentName: "CC", route: "case-context",
            inputTokens: d.usage?.input_tokens, outputTokens: d.usage?.output_tokens,
            durationMs: Date.now() - t0, success: res.ok,
          });
        }
      }
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        threadSummary = JSON.stringify(parsed);
        // If AI found a target value and claim doesn't have one, surface it
        if (parsed.targetValue && !context.claim.targetValue) {
          context.claim.targetValue = parsed.targetValue;
        }
      } catch {
        threadSummary = raw;
      }
    }

    return NextResponse.json({
      ...context,
      threadSummary,
      targetValue: context.claim.targetValue ?? null,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
