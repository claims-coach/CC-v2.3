import { NextRequest, NextResponse } from "next/server";

const GHL_KEY = process.env.GHL_API_KEY || "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const LOC     = process.env.GHL_LOCATION_ID || "Lud9I0SSpb992pgRS4gJ";

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ amount: 0 }, { status: 400 });

  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/invoices/?altId=${LOC}&altType=location&limit=20&offset=0`,
      { headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-04-15" } }
    );
    if (!res.ok) return NextResponse.json({ amount: 0 });
    const data = await res.json();
    const invoices: any[] = data.invoices || [];

    // Find the most recent invoice for this contact (unpaid first, then any)
    const contactInvoices = invoices
      .filter(inv => inv.contactDetails?.id === contactId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const best = contactInvoices.find(inv => inv.status !== "paid") || contactInvoices[0];
    if (!best) return NextResponse.json({ amount: 0 });

    return NextResponse.json({
      amount: best.total || best.invoiceTotal || 0,
      invoiceNumber: best.invoiceNumber,
      status: best.status,
    });
  } catch {
    return NextResponse.json({ amount: 0 });
  }
}
