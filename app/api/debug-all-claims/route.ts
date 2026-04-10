import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Direct fetch to Convex project using public HTTP API
    const projectUrl = "https://agreeable-goose-357.convex.cloud";
    
    // Query all claims
    const res = await fetch(`${projectUrl}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "claims:list",
        args: {}
      }),
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    // Extract clientNames
    const claims = parsed.value || [];
    const angelinaLei = claims.filter((c: any) => c.clientName && c.clientName.toLowerCase().includes('angelina'));
    
    return NextResponse.json({ 
      totalClaims: claims.length,
      angelinaMatches: angelinaLei.length,
      angelinaClaims: angelinaLei.map((c: any) => ({
        _id: c._id,
        clientName: c.clientName,
        stage: c.stage,
        vin: c.vin,
        insurer: c.insurer,
        createdAt: c.createdAt
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
