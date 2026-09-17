/**
 * CandidacyResultCard
 * Displays the candidacy/eligibility result for appraisal clause cases.
 * 
 * CSS includes hyphens: none to prevent mid-word hyphenation of "appraisal"
 * at mobile widths per WAC 284-30-391 communication standards.
 */

import React from "react";

interface CandidacyResultCardProps {
  status: "strong" | "moderate" | "weak" | "not_recommended";
  estimatedGain?: number;
  vehicleDescription?: string;
  insurerOffer?: number;
}

const STATUS_CONFIG = {
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

export default function CandidacyResultCard({
  status,
  estimatedGain,
  vehicleDescription,
  insurerOffer,
}: CandidacyResultCardProps) {
  const config = STATUS_CONFIG[status];
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      {/* Blue Result Banner */}
      <div
        style={{
          background: config.color,
          padding: "20px 24px",
          borderRadius: "12px 12px 0 0",
          hyphens: "none",
          WebkitHyphens: "none",
          wordBreak: "normal",
          overflowWrap: "normal",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          {config.label}
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.35,
            hyphens: "none",
            WebkitHyphens: "none",
            wordBreak: "normal",
            overflowWrap: "normal",
          }}
        >
          {config.headline}
        </h2>
      </div>

      {/* Details Section */}
      <div
        style={{
          padding: "20px 24px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          hyphens: "none",
          WebkitHyphens: "none",
          wordBreak: "normal",
          overflowWrap: "normal",
        }}
      >
        {estimatedGain && estimatedGain > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: "#334155",
              lineHeight: 1.6,
              hyphens: "none",
              WebkitHyphens: "none",
              wordBreak: "normal",
              overflowWrap: "normal",
            }}
          >
            Based on what the market is telling us, disputing your settlement could see you{" "}
            <strong style={{ color: config.color }}>{fmt(estimatedGain)} or more</strong> above the
            insurer&apos;s offer —
          </p>
        )}

        {vehicleDescription && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 13,
              color: "#64748B",
            }}
          >
            Vehicle: {vehicleDescription}
          </p>
        )}

        {insurerOffer && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "#64748B",
            }}
          >
            Current offer: {fmt(insurerOffer)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Generates HTML string for email templates (no React hydration needed).
 * Includes inline styles with hyphens: none to prevent mid-word breaks.
 */
export function generateCandidacyResultHTML({
  status,
  estimatedGain,
  vehicleDescription,
  insurerOffer,
}: CandidacyResultCardProps): string {
  const config = STATUS_CONFIG[status];
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  const noHyphenStyle = "hyphens: none; -webkit-hyphens: none; word-break: normal; overflow-wrap: normal;";

  return `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: ${config.color}; padding: 20px 24px; border-radius: 12px 12px 0 0; ${noHyphenStyle}">
    <p style="margin: 0; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
      ${config.label}
    </p>
    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #FFFFFF; line-height: 1.35; ${noHyphenStyle}">
      ${config.headline}
    </h2>
  </div>
  <div style="padding: 20px 24px; background: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; ${noHyphenStyle}">
    ${
      estimatedGain && estimatedGain > 0
        ? `<p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6; ${noHyphenStyle}">
            Based on what the market is telling us, disputing your settlement could see you 
            <strong style="color: ${config.color}">${fmt(estimatedGain)} or more</strong> above the insurer's offer —
          </p>`
        : ""
    }
    ${vehicleDescription ? `<p style="margin: 12px 0 0; font-size: 13px; color: #64748B;">Vehicle: ${vehicleDescription}</p>` : ""}
    ${insurerOffer ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748B;">Current offer: ${fmt(insurerOffer)}</p>` : ""}
  </div>
</div>`.trim();
}
