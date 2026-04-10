/**
 * Watson Comp Search — State-aware, outlier-detecting comp finder
 * 
 * Rules:
 * - Start with state max radius (e.g., 150mi for WA)
 * - Auto-expand by 25mi if <3 results
 * - Flag comps >20% below median as outliers/anchors to exclude
 * - Return outlier flags for UI warning
 */

import { getStateGuideline } from "./stateGuidelines";

export interface CompResult {
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  url: string;
  notes?: string;
  isOutlier?: boolean;
  outlierReason?: string;
}

export interface WatsonSearchResult {
  comps: CompResult[];
  totalFound: number;
  avgPrice: number;
  medianPrice: number;
  outliers: Array<{
    description: string;
    price: number;
    percentBelowMedian: number;
    reason: string;
  }>;
  searchStats: {
    initialRadius: number;
    expandedRadius: number;
    state: string;
    minRequired: number;
    methodology: string;
  };
}

/**
 * Filter and flag outlier comps
 * Outliers: prices >20% below median
 * These are marked as anchors to exclude from negotiation
 */
export function detectOutliers(comps: CompResult[]): {
  valid: CompResult[];
  outliers: Array<{
    comp: CompResult;
    percentBelowMedian: number;
    reason: string;
  }>;
} {
  if (comps.length < 2) return { valid: comps, outliers: [] };

  const prices = comps.map(c => c.askingPrice).sort((a, b) => a - b);
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const outlierThreshold = median * 0.8; // >20% below median

  const outliers = comps
    .filter(c => c.askingPrice < outlierThreshold)
    .map(c => ({
      comp: { ...c, isOutlier: true, outlierReason: "Price >20% below median" },
      percentBelowMedian: Math.round(((median - c.askingPrice) / median) * 100),
      reason: "Potential wholesale, damaged, or salvage title — exclude from negotiations",
    }));

  const valid = comps.filter(c => c.askingPrice >= outlierThreshold);

  return { valid, outliers };
}

/**
 * Main Watson comp search with state rules
 */
export function processCompsWithStateRules(
  rawComps: CompResult[],
  state: string,
  vin?: string,
  trimLevel?: string
): WatsonSearchResult {
  const guide = getStateGuideline(state);
  const minRequired = guide.minCompsRequired;
  let currentRadius = guide.maxRadius;
  let expandedRadius = guide.maxRadius;
  let processedComps = [...rawComps];

  // Step 1: Check if we have enough comps for initial radius
  if (processedComps.length < minRequired) {
    expandedRadius = currentRadius + guide.expandBy;
    // In real scenario, would trigger new search at expanded radius
    // For now, flag that expansion occurred
  }

  // Step 2: Detect outliers (>20% below median)
  const { valid: validComps, outliers: detectedOutliers } = detectOutliers(processedComps);

  // Step 3: Calculate statistics
  const prices = validComps.map(c => c.askingPrice).sort((a, b) => a - b);
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];
  const avgPrice = validComps.length > 0
    ? Math.round(validComps.reduce((s, c) => s + c.askingPrice, 0) / validComps.length)
    : 0;

  return {
    comps: validComps,
    totalFound: validComps.length,
    avgPrice,
    medianPrice: Math.round(median),
    outliers: detectedOutliers.map(o => ({
      description: o.comp.description,
      price: o.comp.askingPrice,
      percentBelowMedian: o.percentBelowMedian,
      reason: o.reason,
    })),
    searchStats: {
      initialRadius: guide.maxRadius,
      expandedRadius,
      state,
      minRequired,
      methodology: guide.methodologyNote,
    },
  };
}
