/**
 * Unified Invoice Send — creates a GHL invoice and sends both email + SMS
 * POST /api/send-invoice
 * Body: { contactId, contactName, email, phone, itemName, description, amount, dueDays? }
 */
import { NextRequest, NextResponse } from "next/server";

const GHL_KEY      = process.env.GHL_API_KEY!;
const LOCATION_ID  = process.env.GHL_LOCATION_ID!;
const JOHNNY_USER  = "KvnBNYWtA7RjvWXkvJnp";
const BASE         = "https://services.leadconnectorhq.com";
const HEADERS      = { "Authorization": `Bearer ${GHL_KEY}`, "Content-Type": "application/json", "Version": "2021-07-28" };

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    const { contactId, contactName, email, phone, itemName, description, amount, dueDays = 7, conversationId } = await req.json();

    // ── 1. Create invoice ─────────────────────────────────────────────────
    const invoiceRes = await fetch(`${BASE}/invoices/`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({
        altId: LOCATION_ID, altType: "location",
        name: `${contactName} - ${itemName}`,
        currency: "USD",
        businessDetails: {
          name: "Claims.Coach", email: "johnny@claims.coach", phoneNo: "+14255852622",
          address: { addressLine1: "12323 31st Ave SE", city: "Everett", state: "WA", postalCode: "98208", countryCode: "US" },
        },
        contactDetails: { id: contactId, name: contactName, email, phoneNo: phone },
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: daysFromNow(dueDays),
        items: [{ name: itemName, description: description || itemName, currency: "USD", amount, qty: 1, unitPrice: amount, taxes: [] }],
      }),
    });
    const invoice = await invoiceRes.json();
    const invoiceId = invoice._id;
    if (!invoiceId) return NextResponse.json({ error: "Invoice creation failed", detail: invoice }, { status: 500 });

    // ── 2. Send email ─────────────────────────────────────────────────────
    const sendRes = await fetch(`${BASE}/invoices/${invoiceId}/send`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ altId: LOCATION_ID, altType: "location", action: "email", liveMode: true, userId: JOHNNY_USER }),
    });
    const sendData = await sendRes.json();
    const invoiceLink = sendData.emailData?.message?.body?.match(/https:\/\/link\.claims\.coach\/\S+/)?.[0] || "";

    // ── 3. Send SMS ───────────────────────────────────────────────────────
    let smsMessageId = null;
    if (phone && conversationId) {
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + dueDays);
      const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const smsBody = `Hi ${contactName.split(" ")[0]}! Here is your invoice for ${itemName} — $${amount.toLocaleString()} due by ${dueDateStr}.${invoiceLink ? `\n\n${invoiceLink}` : ""}\n\nQuestions? Reply anytime. — Claims.Coach`;
      const smsRes = await fetch(`${BASE}/conversations/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${GHL_KEY}`, "Content-Type": "application/json", "Version": "2021-04-15" },
        body: JSON.stringify({ type: "SMS", conversationId, contactId, message: smsBody }),
      });
      const smsData = await smsRes.json();
      smsMessageId = smsData.messageId;
    }

    return NextResponse.json({
      success: true,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      emailSent: sendRes.ok,
      smsSent: !!smsMessageId,
      invoiceLink,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
