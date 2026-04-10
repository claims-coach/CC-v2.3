/**
 * POST /api/webhooks/ghl
 * Receives GHL webhook events and applies tags automatically.
 *
 * Events handled:
 *   InvoicePaid      → tag contact "customer"
 *   OpportunityStageChange (to "Won/Settled") → tag "happy customer" if satisfied
 */
import { NextRequest, NextResponse } from "next/server";

const GHL_KEY    = process.env.GHL_API_KEY!;
const LOC        = process.env.GHL_LOCATION_ID!;
const BASE       = "https://services.leadconnectorhq.com";
const HEADERS    = { "Authorization": `Bearer ${GHL_KEY}`, "Content-Type": "application/json", "Version": "2021-07-28" };

async function addTags(contactId: string, newTags: string[]): Promise<boolean> {
  try {
    // Get existing tags first
    const r = await fetch(`${BASE}/contacts/${contactId}`, { headers: HEADERS });
    const d = await r.json();
    const existing: string[] = d.contact?.tags || [];
    const merged = [...new Set([...existing, ...newTags])];
    const up = await fetch(`${BASE}/contacts/${contactId}`, {
      method: "PUT", headers: HEADERS,
      body: JSON.stringify({ tags: merged }),
    });
    return up.ok;
  } catch { return false; }
}

// Stages that mean the client is done and happy — add more as needed
const HAPPY_STAGES = ["won", "settled", "closed - won", "payment received", "complete", "completed"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type || body.event || "";

    console.log("[GHL Webhook]", type, JSON.stringify(body).slice(0, 300));

    // ── Invoice Paid ─────────────────────────────────────────────────────────
    if (type === "InvoicePaid" || type === "INVOICE_PAID") {
      const contactId = body.contactId || body.contact?.id;
      if (contactId) {
        await addTags(contactId, ["customer"]);
        console.log("[GHL Webhook] Tagged as customer:", contactId);
      }
    }

    // ── Opportunity Stage Change ──────────────────────────────────────────────
    if (type === "OpportunityStageChange" || type === "OPPORTUNITY_STAGE_CHANGED") {
      const stageName = (body.stageName || body.stage?.name || "").toLowerCase();
      const contactId = body.contactId || body.contact?.id;
      if (contactId && HAPPY_STAGES.some(s => stageName.includes(s))) {
        await addTags(contactId, ["customer", "happy customer"]);
        console.log("[GHL Webhook] Tagged as happy customer:", contactId, stageName);
      }
    }

    // ── Payment Received (alternative event name) ─────────────────────────────
    if (type === "PaymentReceived" || type === "PAYMENT_RECEIVED") {
      const contactId = body.contactId || body.contact?.id;
      if (contactId) {
        await addTags(contactId, ["customer"]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[GHL Webhook] Error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// GHL sends GET to verify the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true, service: "Claims.Coach GHL Webhook" });
}
