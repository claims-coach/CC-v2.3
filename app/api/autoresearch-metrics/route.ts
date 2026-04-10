/**
 * Autoresearch Metrics API
 * Real-time access to autoresearch improvement metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAutoresearchMetrics } from "@/lib/dashboardSync";

export async function GET(req: NextRequest) {
  try {
    const metrics = await fetchAutoresearchMetrics();

    return NextResponse.json({
      success: true,
      metrics,
      lastUpdated: new Date().toISOString(),
      summary: {
        claimsImprovement: `${metrics.claimsLoop.improvement.toFixed(1)}% (${metrics.claimsLoop.currentBaseline.toFixed(3)} val_bpb)`,
        codeImprovement: `+${metrics.codeLoop.improvement.toFixed(1)}% (${metrics.codeLoop.currentBaseline.toFixed(1)}% test passage)`,
        nextClaimsLoop: new Date(
          metrics.claimsLoop.lastRun + 24 * 60 * 60 * 1000
        ).toISOString(),
        nextCodeLoop: new Date(
          metrics.codeLoop.lastRun + 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
  } catch (e) {
    console.error("Error fetching autoresearch metrics:", e);
    return NextResponse.json(
      { error: "Failed to fetch autoresearch metrics" },
      { status: 500 }
    );
  }
}
