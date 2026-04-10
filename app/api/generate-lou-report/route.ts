import { NextRequest, NextResponse } from "next/server";
import {
  generateLOUReport,
  type LOUReportInput,
} from "@/lib/louReportGenerator";

/**
 * Generate Loss of Use Report
 * POST /api/generate-lou-report
 * Body: LOUReportInput (structured report data)
 * Response: Generated report text (plain text or markdown)
 */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LOUReportInput;

    // Validate required fields
    const required = [
      "vehicleOwnerName",
      "year",
      "make",
      "model",
      "dateOfLoss",
      "claimReportedDate",
      "vehicleInspectedDate",
      "valuationIssuedDate",
      "totalLossLetterDate",
      "rentalRegion",
      "rentalCompany",
      "rentalVehicleClass",
      "rentalDailyRate",
      "louStartDate",
      "louEndDate",
      "louTotalDays",
      "louDailyRate",
      "louCalculatedAmount",
      "expertName",
      "expertCredentials",
    ];

    for (const field of required) {
      if (!body[field as keyof LOUReportInput]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    console.log(`📄 Generating LOU report for ${body.vehicleOwnerName}...`);

    // Generate report
    const reportText = await generateLOUReport(body);

    // Return report
    return NextResponse.json({
      success: true,
      vehicle: `${body.year} ${body.make} ${body.model}`,
      report: reportText,
      generatedAt: new Date().toISOString(),
      status: "ready_for_review",
    });
  } catch (err) {
    console.error("LOU report generation error:", err);
    return NextResponse.json(
      {
        error: `Report generation failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
