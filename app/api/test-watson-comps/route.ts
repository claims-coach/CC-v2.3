import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Test Watson comp search with state rules integration
    const res = await fetch("http://localhost:3001/api/find-comps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        year: 2002,
        make: "Subaru",
        model: "WRX",
        trim: "STI",
        mileage: 145000,
        state: "WA",
        city: "Seattle",
        clientEstimate: 15000,
        insurerOffer: 8500
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
