/**
 * Comp Minimum Threshold Filter
 * 
 * Core Rule: Only accept comps that are AT OR ABOVE the insurer's opening offer
 * 
 * Why: 
 * - If a comp is lower than what insurer already offered, it WEAKENS our negotiating position
 * - We need comps HIGHER than the insurer offer to anchor negotiations UP
 * - Then let insurer negotiate DOWN to a better number for our client
 * 
 * Comps below the insurer's opening offer are 100% REJECTED
 */

export interface CompWithThreshold {
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  url: string;
  notes?: string;
}

export interface ThresholdCheckResult {
  accepted: CompWithThreshold[];
  rejected: Array<{
    comp: CompWithThreshold;
    reason: string;
    priceGap: number;
    percentBelowThreshold: number;
  }>;
  stats: {
    insurerOffer: number;
    minimumAcceptablePrice: number;
    totalCompsReviewed: number;
    acceptedCount: number;
    rejectedCount: number;
    successRate: string;
  };
}

/**
 * Filter comps against insurer's opening offer (HARD minimum)
 * 
 * @param comps - List of comparable vehicles
 * @param insurerOffer - The insurer's opening offer in dollars
 * @returns Comps above threshold + rejection details
 */
export function enforceInsurerofferThreshold(
  comps: CompWithThreshold[],
  insurerOffer: number
): ThresholdCheckResult {
  const minimumAcceptablePrice = insurerOffer; // Must be AT OR ABOVE insurer's offer

  const accepted: CompWithThreshold[] = [];
  const rejected: ThresholdCheckResult["rejected"] = [];

  for (const comp of comps) {
    if (comp.askingPrice >= minimumAcceptablePrice) {
      // ✅ ACCEPTED: Comp is AT or ABOVE insurer offer
      accepted.push(comp);
    } else {
      // ❌ REJECTED: Comp is BELOW insurer offer
      const priceGap = minimumAcceptablePrice - comp.askingPrice;
      const percentBelowThreshold = Math.round((priceGap / minimumAcceptablePrice) * 100);
      
      rejected.push({
        comp,
        reason: `Comp price is BELOW insurer's opening offer ($${comp.askingPrice.toLocaleString()} vs $${insurerOffer.toLocaleString()}). This weakens our negotiating position. REJECTED.`,
        priceGap,
        percentBelowThreshold,
      });
    }
  }

  const successRate = comps.length > 0 
    ? `${Math.round((accepted.length / comps.length) * 100)}%`
    : "0%";

  return {
    accepted,
    rejected,
    stats: {
      insurerOffer,
      minimumAcceptablePrice,
      totalCompsReviewed: comps.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      successRate,
    },
  };
}

/**
 * Get negotiation advice based on comp quality
 */
export function getCompQualityAdvice(result: ThresholdCheckResult): string[] {
  const advice: string[] = [];
  const { acceptedCount, rejectedCount, stats } = result;

  if (acceptedCount === 0 && rejectedCount > 0) {
    advice.push("⚠️  NO VALID COMPS FOUND ABOVE INSURER OFFER");
    advice.push(`Market ceiling appears to be below insurer's offer of $${stats.insurerOffer.toLocaleString()}`);
    advice.push("Recommendation: Accept insurer's offer OR request professional appraisal");
  } else if (acceptedCount === 1) {
    advice.push("⚠️  Only 1 comp above insurer offer — limited negotiating power");
    advice.push("Recommendation: Find 2-3 more comps to strengthen position");
  } else if (acceptedCount >= 3) {
    const avgPrice = result.accepted.reduce((sum, c) => sum + c.askingPrice, 0) / result.accepted.length;
    const negotiationSpread = avgPrice - stats.insurerOffer;
    const negotiationPercent = Math.round((negotiationSpread / stats.insurerOffer) * 100);
    
    advice.push(`✅ STRONG POSITION: ${acceptedCount} comps above insurer offer`);
    advice.push(`Comp average: $${avgPrice.toLocaleString()}`);
    advice.push(`Negotiation spread: $${negotiationSpread.toLocaleString()} (${negotiationPercent}% above insurer)`);
    advice.push(`Target negotiation: Anchor at $${Math.round(avgPrice).toLocaleString()}, accept $${Math.round(avgPrice * 0.95).toLocaleString()}`);
  }

  if (rejectedCount > 0) {
    advice.push(`\n❌ ${rejectedCount} comps rejected for being below insurer offer (market noise filtered)`);
  }

  return advice;
}
