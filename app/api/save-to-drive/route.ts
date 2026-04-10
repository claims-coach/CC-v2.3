import { NextRequest, NextResponse } from "next/server";
import { saveWorkbenchToDrive } from "@/lib/drive";

export async function POST(req: NextRequest) {
  try {
    const { state, claimNumber, clientName, vehicle } = await req.json();
    const driveUrl = await saveWorkbenchToDrive(state, claimNumber || "", clientName || "", vehicle || "");
    if (!driveUrl) return NextResponse.json({ error: "Drive save failed — check credentials" }, { status: 500 });
    return NextResponse.json({ ok: true, driveUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
