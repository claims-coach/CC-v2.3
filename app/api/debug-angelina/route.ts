import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";

export async function GET() {
  try {
    // Direct fetch to Convex project using public HTTP API
    const projectUrl = "https://agreeable-goose-357.convex.cloud";
    
    // Query all claims and search for Angelina Lei
    const res = await fetch(`${projectUrl}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "claims:search",
        args: { query: "Angelina Lei" }
      }),
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return NextResponse.json({ 
      status: res.status,
      data: parsed
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
