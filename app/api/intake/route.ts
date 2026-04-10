import { NextRequest, NextResponse } from "next/server";

/**
 * Intake Pipeline
 * Triggered by: GHL booking webhook
 * Flow: Booking → Case created → Estimate parsed → Valuation auto-run
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      clientName,
      clientPhone,
      clientEmail,
      year,
      make,
      model,
      mileage,
      vin,
      estimateUrl, // PDF URL from GHL
      insurerEstimate,
      ghlContactId,
    } = body;

    if (!clientName || !year || !make || !model) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`📥 Intake: ${clientName} — ${year} ${make} ${model}`);

    // 1. CREATE CASE IN CONVEX
    const caseResponse = await fetch(
      `${process.env.CONVEX_URL || "https://calm-warbler-536.convex.cloud"}/api/cases:create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientPhone,
          clientEmail,
          stage: "valuation", // Move straight to valuation
          vehicleYear: year,
          vehicleMake: make,
          vehicleModel: model,
          vehicleMileage: mileage,
          vehicleVin: vin,
          insurerEstimate,
          ghlContactId,
          createdAt: Date.now(),
        }),
      }
    );

    const caseData = await caseResponse.json();
    const caseId = caseData.id;

    console.log(`✅ Case created: ${caseId}`);

    // 2. PARSE ESTIMATE (if provided)
    if (estimateUrl) {
      try {
        const parseResponse = await fetch(
          new URL("/api/parse-estimate", process.env.NEXTAUTH_URL || "http://localhost:3000"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estimateUrl, caseId }),
          }
        );
        const parseResult = await parseResponse.json();
        console.log(`📄 Estimate parsed:`, parseResult);
      } catch (err) {
        console.warn("Estimate parsing skipped:", err);
      }
    }

    // 3. TRIGGER AUTO-VALUATION (comps + KBB + basic valuation)
    const valuationResponse = await fetch(
      new URL("/api/auto-valuation", process.env.NEXTAUTH_URL || "http://localhost:3000"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          clientName,
          year,
          make,
          model,
          mileage,
          vin,
          insurerEstimate,
        }),
      }
    );

    const valuation = await valuationResponse.json();
    console.log(`📊 Valuation complete:`, valuation);

    return NextResponse.json({
      success: true,
      caseId,
      clientName,
      vehicle: `${year} ${make} ${model}`,
      valuation: valuation.valuation,
      compsCount: valuation.valuation?.compsCount || 0,
      message: `Case created and valuation auto-completed for ${clientName}`,
    });
  } catch (err) {
    console.error("Intake error:", err);
    return NextResponse.json(
      { error: `Intake failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
