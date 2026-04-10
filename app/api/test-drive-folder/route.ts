import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { caseKey } = await req.json();
    if (!caseKey) {
      return NextResponse.json({ error: "caseKey required" }, { status: 400 });
    }

    // Call Drive folder creation action
    const projectUrl = "https://agreeable-goose-357.convex.cloud";
    
    const res = await fetch(`${projectUrl}/api/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "caseRegistry:createDriveFolderForCase",
        args: { caseKey }
      }),
    });

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    return NextResponse.json({ 
      status: res.status,
      result: result,
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
