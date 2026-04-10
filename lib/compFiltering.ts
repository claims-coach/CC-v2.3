/**
 * Comp filtering utilities for Watson comp search
 * Filters by trim, geography, and price anchoring
 */

export interface FilteredComp {
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  url: string;
  notes?: string;
  trimScore?: number; // 0-100: how well trim matches
  priceScore?: number; // 0-100: how well priced relative to anchors
}

/**
 * Calculate trim level match score
 * Returns 100 for exact match, 50 for partial, 0 for no match
 */
export function calculateTrimScore(compDescription: string, subjectTrim: string): number {
  if (!subjectTrim || !compDescription) return 50; // neutral score

  const compDesc = compDescription.toLowerCase();
  const subjectLower = subjectTrim.toLowerCase();

  // Exact match
  if (compDesc.includes(subjectLower)) return 100;

  // Partial match (e.g., "STI" in "Subaru WRX STI")
  const trimParts = subjectLower.split(/\s+/).filter(p => p.length > 2);
  const matches = trimParts.filter(p => compDesc.includes(p)).length;
  const partialScore = (matches / Math.max(trimParts.length, 1)) * 75;

  return Math.round(partialScore);
}

/**
 * Calculate price score relative to client target and insurer offer
 * Client target = floor (100 points)
 * Insurer offer = anchor (0 points)
 * Above client target = bonus points
 */
export function calculatePriceScore(
  price: number,
  clientEstimate: number | null,
  insurerOffer: number | null
): number {
  if (!clientEstimate && !insurerOffer) return 50; // neutral

  const floor = clientEstimate || insurerOffer || price;
  const anchor = insurerOffer || clientEstimate || price;

  if (price < anchor) return 0; // below anchor = worthless
  if (price >= floor) {
    // Above floor = good, bonus if much higher
    const aboveFloorPercent = ((price - floor) / floor) * 100;
    return Math.min(100, 75 + aboveFloorPercent / 10);
  }

  // Between anchor and floor
  const betweenPercent = ((price - anchor) / (floor - anchor)) * 100;
  return Math.round(25 + (betweenPercent * 50) / 100);
}

/**
 * Filter comps by trim, price, geography
 * Returns sorted array with scores
 */
export function filterComps(
  comps: FilteredComp[],
  subjectTrim: string,
  clientEstimate: number | null,
  minTrimScore: number = 40 // require at least 40% trim match
): FilteredComp[] {
  return comps
    .map(c => ({
      ...c,
      trimScore: calculateTrimScore(c.description, subjectTrim),
      priceScore: calculatePriceScore(c.askingPrice, clientEstimate, null),
    }))
    .filter(c => c.trimScore >= minTrimScore) // trim filter
    .filter(c => !clientEstimate || c.askingPrice >= (clientEstimate * 0.5)) // price filter: at least 50% of target
    .sort((a, b) => {
      // Sort by combined score: 60% price, 40% trim
      const scoreA = (a.priceScore ?? 0) * 0.6 + (a.trimScore ?? 0) * 0.4;
      const scoreB = (b.priceScore ?? 0) * 0.6 + (b.trimScore ?? 0) * 0.4;
      return scoreB - scoreA; // descending
    });
}

/**
 * Helper: Extract trim level from description
 * E.g., "2002 Subaru WRX STI" → "STI"
 */
export function extractTrimFromDescription(description: string): string {
  // Common trim indicators: STI, S, T, XT, Limited, Sport, SE, etc.
  const trimPatterns = /\b(STI|XT|Limited|Sport|SE|S\b|SL|SVX|RS|Outback|Forester|Impreza|Legacy|Crosstrek)\b/i;
  const match = description.match(trimPatterns);
  return match ? match[1] : "";
}

/**
 * Generate comp quality summary
 */
export function summarizeCompQuality(
  comps: FilteredComp[],
  medianPrice: number
): {
  avgPrice: number;
  medianPrice: number;
  bestTrimMatch: FilteredComp | null;
  bestPrice: FilteredComp | null;
  quality: "excellent" | "good" | "fair" | "poor";
} {
  if (comps.length === 0) {
    return {
      avgPrice: 0,
      medianPrice: 0,
      bestTrimMatch: null,
      bestPrice: null,
      quality: "poor",
    };
  }

  const avgPrice = Math.round(comps.reduce((s, c) => s + c.askingPrice, 0) / comps.length);
  const bestTrimMatch = comps.sort((a, b) => (b.trimScore ?? 0) - (a.trimScore ?? 0))[0];
  const bestPrice = comps.sort((a, b) => b.askingPrice - a.askingPrice)[0];

  let quality: "excellent" | "good" | "fair" | "poor" = "good";
  if (comps.length >= 5 && bestTrimMatch.trimScore! >= 75) quality = "excellent";
  if (comps.length < 2 || bestTrimMatch.trimScore! < 40) quality = "fair";
  if (comps.length === 0) quality = "poor";

  return { avgPrice, medianPrice, bestTrimMatch, bestPrice, quality };
}
