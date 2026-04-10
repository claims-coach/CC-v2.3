import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Create test case via Convex mutation
    const projectUrl = "https://agreeable-goose-357.convex.cloud";
    
    const res = await fetch(`${projectUrl}/api/mutation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "caseRegistry:create",
        args: {
          division: "AUTO",
          role: "AC",
          lastName: "TestCase",
          carrier: "TestInsurer",
          clientName: "Test Client",
          status: "active",
          notes: "Test case for Drive folder creation and comp search"
        }
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
      message: "Test case created"
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
    }, { status: 500 });
  }
}
