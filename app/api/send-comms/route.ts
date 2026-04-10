/**
 * POST /api/send-comms
 * Sends appraisal result email + SMS to client via GHL
 * Body: { contactId, email, phone, clientName, emailBody, textBody, subject? }
 */
import { NextRequest, NextResponse } from "next/server";
import { saveCommsToDrive } from "@/lib/drive";

const GHL_KEY     = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const BASE        = "https://services.leadconnectorhq.com";
const HEADERS     = {
  "Authorization": `Bearer ${GHL_KEY}`,
  "Content-Type": "application/json",
  "Version": "2021-07-28",
};

export async function POST(req: NextRequest) {
  try {
    const { contactId, email, phone, clientName, emailBody: rawEmail, textBody: rawText, subject, claimNumber, clientLastName } = await req.json();

    // Strip any "EMAIL", "Subject: ...", "TEXT MESSAGE" header lines Claude may have left
    const stripHeaders = (s: string) => (s || "")
      .replace(/^EMAIL\s*[\r\n]+/im, "")
      .replace(/^Subject:.*[\r\n]+/im, "")
      .replace(/^TEXT MESSAGE\s*[\r\n]+/im, "")
      .trim();
    const emailBody = stripHeaders(rawEmail);
    const textBody  = stripHeaders(rawText);

    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

    const results: Record<string, any> = {};

    // ── 1. Get or create conversation ──────────────────────────────────────
    let conversationId: string | null = null;
    try {
      const convSearch = await fetch(
        `${BASE}/conversations/search?contactId=${contactId}&locationId=${LOCATION_ID}`,
        { headers: HEADERS }
      );
      const convData = await convSearch.json();
      conversationId = convData.conversations?.[0]?.id || null;

      if (!conversationId) {
        const newConv = await fetch(`${BASE}/conversations/`, {
          method: "POST", headers: HEADERS,
          body: JSON.stringify({ contactId, locationId: LOCATION_ID }),
        });
        const nc = await newConv.json();
        conversationId = nc.conversation?.id || null;
      }
    } catch (e) {
      results.conversationError = String(e);
    }

    // ── 2. Send Email ──────────────────────────────────────────────────────
    if (email && emailBody) {
      try {
        const emailRes = await fetch(`${BASE}/conversations/messages`, {
          method: "POST", headers: HEADERS,
          body: JSON.stringify({
            type: "Email",
            contactId,
            conversationId,
            locationId: LOCATION_ID,
            emailFrom: "johnny@claims.coach",
            emailTo: email,
            subject: subject || "Appraisal Clause — Your Results",
            html: emailBody.replace(/\n/g, "<br>"),
            message: emailBody,
          }),
        });
        const emailData = await emailRes.json();
        results.email = { ok: !!(emailData.messageId || emailData.emailMessageId), messageId: emailData.messageId || emailData.emailMessageId, msg: emailData.msg, raw: emailData };
      } catch (e) {
        results.emailError = String(e);
      }
    }

    // ── 3. Send SMS ────────────────────────────────────────────────────────
    if (phone && textBody && conversationId) {
      try {
        const smsRes = await fetch(`${BASE}/conversations/messages`, {
          method: "POST", headers: HEADERS,
          body: JSON.stringify({
            type: "SMS",
            contactId,
            conversationId,
            locationId: LOCATION_ID,
            message: textBody,
          }),
        });
        const smsData = await smsRes.json();
        results.sms = { ok: !!(smsData.messageId), messageId: smsData.messageId };
      } catch (e) {
        results.smsError = String(e);
      }
    }

    // Auto-save to Google Drive (fire-and-forget)
    if (emailBody || textBody) {
      saveCommsToDrive(emailBody || "", textBody || "", claimNumber || "", clientName || "").catch(() => {});
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
