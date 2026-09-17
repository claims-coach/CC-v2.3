/**
 * POST /api/candidacy-result
 * 
 * Generates the candidacy screener result HTML email/page.
 * This is the "RESULT" banner showing whether a vehicle is a strong candidate
 * for invoking the appraisal clause.
 * 
 * CSS: hyphens:none prevents mid-word breaking of "appraisal" at mobile widths.
 * 
 * Body: { status, estimatedGain, vehicleDescription, insurerOffer, clientName }
 */
import { NextRequest, NextResponse } from "next/server";

type CandidacyStatus = "strong" | "moderate" | "weak" | "not_recommended";

interface CandidacyResultRequest {
  status: CandidacyStatus;
  estimatedGain?: number;
  vehicleDescription?: string;
  insurerOffer?: number;
  clientName?: string;
}

const STATUS_CONFIG: Record<CandidacyStatus, { label: string; headline: string; color: string }> = {
  strong: {
    label: "RESULT",
    headline: "Your vehicle is likely a strong candidate for invoking the appraisal clause.",
    color: "#147EFA",
  },
  moderate: {
    label: "RESULT",
    headline: "Your vehicle may be a candidate for invoking the appraisal clause.",
    color: "#3b82f6",
  },
  weak: {
    label: "RESULT",
    headline: "Your vehicle has limited potential for the appraisal clause process.",
    color: "#64748b",
  },
  not_recommended: {
    label: "RESULT",
    headline: "The appraisal clause may not be the best option for your situation.",
    color: "#94a3b8",
  },
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

function generateCandidacyHTML(data: CandidacyResultRequest): string {
  const config = STATUS_CONFIG[data.status] || STATUS_CONFIG.strong;
  
  const noHyphenStyle = "hyphens: none; -webkit-hyphens: none; -moz-hyphens: none; -ms-hyphens: none; word-break: normal; overflow-wrap: normal;";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appraisal Clause Candidacy Result</title>
</head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: #F1F5F9;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- RESULT Banner - CRITICAL: hyphens:none prevents "appraisal" from breaking -->
    <div style="background: ${config.color}; padding: 20px 24px; border-radius: 12px 12px 0 0; ${noHyphenStyle}">
      <p style="margin: 0; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; ${noHyphenStyle}">
        ${config.label}
      </p>
      <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; line-height: 1.35; ${noHyphenStyle}">
        ${config.headline}
      </h2>
    </div>

    <!-- Details Section -->
    <div style="padding: 20px 24px; background: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; ${noHyphenStyle}">
      ${data.estimatedGain && data.estimatedGain > 0 ? `
      <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6; ${noHyphenStyle}">
        Based on what the market is telling us, disputing your settlement could see you 
        <strong style="color: ${config.color}">${fmt(data.estimatedGain)} or more</strong> above the insurer's offer —
      </p>
      ` : ""}
      
      ${data.vehicleDescription ? `
      <p style="margin: 12px 0 0; font-size: 13px; color: #64748B;">
        Vehicle: ${data.vehicleDescription}
      </p>
      ` : ""}
      
      ${data.insurerOffer ? `
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748B;">
        Current offer: ${fmt(data.insurerOffer)}
      </p>
      ` : ""}

      <!-- CTA -->
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
        <a href="https://claims.coach/schedule" style="display: inline-block; background: ${config.color}; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Schedule Your Free Consultation →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 20px; padding: 16px;">
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">
        Claims.Coach · Walker Appraisal · Everett, WA<br>
        WAC 284-30-391 Compliant
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CandidacyResultRequest = await req.json();
    
    if (!body.status || !STATUS_CONFIG[body.status]) {
      return NextResponse.json(
        { error: "Invalid status. Must be: strong, moderate, weak, or not_recommended" },
        { status: 400 }
      );
    }

    const html = generateCandidacyHTML(body);

    return NextResponse.json({
      ok: true,
      html,
      status: body.status,
      headline: STATUS_CONFIG[body.status].headline,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") as CandidacyStatus) || "strong";
  const estimatedGain = parseFloat(url.searchParams.get("gain") || "1400");
  const vehicleDescription = url.searchParams.get("vehicle") || "";
  const insurerOffer = parseFloat(url.searchParams.get("offer") || "0");

  const html = generateCandidacyHTML({
    status,
    estimatedGain,
    vehicleDescription: vehicleDescription || undefined,
    insurerOffer: insurerOffer || undefined,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
