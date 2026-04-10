import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const GHL_KEY = process.env.GHL_API_KEY     || "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const LOC     = process.env.GHL_LOCATION_ID || "Lud9I0SSpb992pgRS4gJ";
const BASE_URL = "https://claims-coach-mc.vercel.app";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ── GHL helpers ─────────────────────────────────────────────────────────────

async function findOrCreateContact(name: string, email?: string, phone?: string): Promise<string | null> {
  try {
    // Search by email first, then name
    const query = email || name;
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${LOC}&query=${encodeURIComponent(query)}&limit=5`,
      { headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28" } }
    );
    const data = await res.json();
    const contact = data?.contacts?.[0];
    if (contact?.id) return contact.id;

    // Create contact
    const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28", "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: LOC,
        firstName: name.split(" ")[0] || name,
        lastName: name.split(" ").slice(1).join(" ") || undefined,
        email: email || undefined,
        phone: phone || undefined,
        tags: ["award-signer"],
      }),
    });
    const created = await createRes.json();
    return created?.contact?.id || null;
  } catch {
    return null;
  }
}

async function sendEmail(contactId: string, toEmail: string, subject: string, body: string) {
  return fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28", "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "Email",
      contactId,
      locationId: LOC,
      subject,
      html: body,
    }),
  });
}

async function sendSms(contactId: string, message: string) {
  return fetch("https://services.leadconnectorhq.com/conversations/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28", "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "SMS",
      contactId,
      locationId: LOC,
      message,
    }),
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const {
      awardId,
      insurerAppraiser,
      insurerEmail,
      insurerPhone,
      umpire,
      umpireEmail,
      umpirePhone,
      claimNumber,
      vehicle,
      acvAward,
    } = await req.json();

    if (!awardId) {
      return NextResponse.json({ error: "awardId required" }, { status: 400 });
    }

    // Load award to get token
    const record = await convex.query(api.awardRequests.get, { id: awardId });
    if (!record?.sigPageToken) {
      return NextResponse.json({ error: "Award not found or missing token" }, { status: 404 });
    }

    const token = record.sigPageToken;
    const insurerUrl = `${BASE_URL}/sign/${token}`;
    const umpireUrl  = umpire ? `${BASE_URL}/sign/${token}-u` : undefined;

    const acvFmt = fmt(acvAward || record.acvAward || 0);
    const claimStr = claimNumber || record.claimNumber || "your claim";
    const vehicleStr = vehicle || record.vehicle || "the vehicle";

    // ── Insurer appraiser ─────────────────────────────────────────────────
    let insurerSent = false;
    if (insurerAppraiser) {
      const contactId = await findOrCreateContact(insurerAppraiser, insurerEmail, insurerPhone);
      if (contactId) {
        const emailBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#141931;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#FF8600;margin:0;font-size:20px">Claims.Coach</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:13px">Walker Appraisal · Digital Signature Request</p>
  </div>
  <div style="padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:15px;color:#334155">Hi ${insurerAppraiser},</p>
    <p style="color:#475569;line-height:1.6">Johnny Walker at Claims.Coach / Walker Appraisal requests your digital signature on the ACV Award for <strong>${claimStr}</strong> (${vehicleStr}).</p>
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #FF8600">
      <p style="margin:0;font-size:13px;color:#64748B">Agreed Actual Cash Value</p>
      <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#FF8600">${acvFmt}</p>
    </div>
    <a href="${insurerUrl}" style="display:inline-block;background:#FF8600;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">
      Review &amp; Sign Award →
    </a>
    <p style="margin-top:24px;font-size:11px;color:#94A3B8">
      Claims.Coach · Walker Appraisal · 2707 Colby Ave #1200B, Everett WA 98201 · (425) 585-2622<br>
      WAC 284-30-391 Compliant
    </p>
  </div>
</div>`;

        await sendEmail(contactId, insurerEmail || "", `ACV Award Signature Request — ${claimStr}`, emailBody);

        if (insurerPhone) {
          await sendSms(contactId, `Hi ${insurerAppraiser} — Johnny Walker, Claims.Coach. ACV Award for claim ${claimStr} (${vehicleStr}) is ready for your signature. Agreed ACV: ${acvFmt}. Sign here: ${insurerUrl}`);
        }
        insurerSent = true;
      }
    }

    // ── Umpire ────────────────────────────────────────────────────────────
    let umpireSent = false;
    if (umpire && umpireUrl) {
      const contactId = await findOrCreateContact(umpire, umpireEmail, umpirePhone);
      if (contactId) {
        const emailBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#141931;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#FF8600;margin:0;font-size:20px">Claims.Coach</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:13px">Walker Appraisal · Digital Signature Request (Umpire)</p>
  </div>
  <div style="padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:15px;color:#334155">Hi ${umpire},</p>
    <p style="color:#475569;line-height:1.6">Your signature as Umpire is requested on the ACV Award for <strong>${claimStr}</strong> (${vehicleStr}).</p>
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #FF8600">
      <p style="margin:0;font-size:13px;color:#64748B">Awarded Actual Cash Value</p>
      <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#FF8600">${acvFmt}</p>
    </div>
    <a href="${umpireUrl}" style="display:inline-block;background:#FF8600;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">
      Review &amp; Sign as Umpire →
    </a>
    <p style="margin-top:24px;font-size:11px;color:#94A3B8">
      Claims.Coach · Walker Appraisal · 2707 Colby Ave #1200B, Everett WA 98201 · (425) 585-2622
    </p>
  </div>
</div>`;

        await sendEmail(contactId, umpireEmail || "", `ACV Award Umpire Signature — ${claimStr}`, emailBody);

        if (umpirePhone) {
          await sendSms(contactId, `Hi ${umpire} — Umpire signature needed for ACV Award on claim ${claimStr}. Awarded ACV: ${acvFmt}. Sign here: ${umpireUrl}`);
        }
        umpireSent = true;
      }
    }

    return NextResponse.json({ ok: true, insurerUrl, umpireUrl, insurerSent, umpireSent });

  } catch (err) {
    console.error("send-award-signature error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
