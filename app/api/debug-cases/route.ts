import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Direct fetch to Convex project using public HTTP API
    const projectUrl = "https://agreeable-goose-357.convex.cloud";
    
    // Query all cases
    const res = await fetch(`${projectUrl}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "caseRegistry:list",
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
    const cases = parsed.value || [];
    const angelinaLei = cases.filter((c: any) => {
      const names = [c.clientName, c.lastName].filter(Boolean).join(' ').toLowerCase();
      return names.includes('angelina') || names.includes('lei');
    });
    
    return NextResponse.json({ 
      totalCases: cases.length,
      angelinaMatches: angelinaLei.length,
      angelinaCases: angelinaLei.map((c: any) => ({
        _id: c._id,
        masterCaseId: c.masterCaseId,
        caseKey: c.caseKey,
        clientName: c.clientName,
        lastName: c.lastName,
        role: c.role,
        carrier: c.carrier,
        status: c.status,
        openedAt: c.openedAt
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
