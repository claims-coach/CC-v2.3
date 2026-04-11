/**
 * Case Registry API
 * POST /api/cases — create new case (assigns next MasterCaseID)
 * GET  /api/cases — list all cases (optional ?status=active)
 */
import { NextRequest, NextResponse } from "next/server";
import { stampCase } from "@/lib/ghlCaseStamp";

const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return res.json();
}

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await res.json();
  return d.value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { division, role, lastName, carrier, clientName, contactId, opportunityId, status, notes } = body;

    if (!division || !role || !lastName || !carrier) {
      return NextResponse.json({ error: "division, role, lastName, carrier are required" }, { status: 400 });
    }

    const result = await convexMutation("caseRegistry:create", {
      division, role, lastName, carrier, clientName, contactId, opportunityId, status, notes,
    });

    // ── Stamp GHL contact + opportunity ───────────────────────────────────
    if (result.caseKey && (contactId || opportunityId)) {
      stampCase(result.caseKey, contactId, opportunityId).catch(() => {});
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const cases = await convexQuery("caseRegistry:list", { status });
    return NextResponse.json({ cases, count: cases?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
