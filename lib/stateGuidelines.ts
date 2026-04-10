/**
 * State-by-state comp search and ACV report guidelines
 * Per state appraisal statutes and industry best practices
 */

export interface StateGuideline {
  state: string;
  stateName: string;
  minCompsRequired: number;
  maxRadius: number;
  expandBy: number;
  preferredSources: string[];
  methodologyNote: string;
  timeframe?: string;
}

export const STATE_GUIDELINES: Record<string, StateGuideline> = {
  WA: {
    state: "WA",
    stateName: "Washington",
    minCompsRequired: 3,
    maxRadius: 150,
    expandBy: 25,
    preferredSources: ["AutoTrader", "CarGurus", "Cars.com", "Local dealers"],
    methodologyNote:
      "Washington appraisal guidelines require a minimum of 3 comparable vehicles within 150 miles of the " +
      "subject's location. If fewer than 3 comps are available, radius expands by 25 miles. Comparables must " +
      "be similar year (±2), make, model, and condition. Market sales method is preferred.",
    timeframe: "Within 30 days of loss",
  },
  OR: {
    state: "OR",
    stateName: "Oregon",
    minCompsRequired: 3,
    maxRadius: 150,
    expandBy: 25,
    preferredSources: ["AutoTrader", "CarGurus", "NADA", "Local dealers"],
    methodologyNote:
      "Oregon requires minimum 3 comparables within 150-mile radius. Cost method acceptable if market " +
      "data insufficient. Comps must be similar year, make, model, mileage, and condition.",
  },
  CA: {
    state: "CA",
    stateName: "California",
    minCompsRequired: 3,
    maxRadius: 75,
    expandBy: 15,
    preferredSources: ["AutoTrader", "TrueCar", "Edmunds", "Local dealers", "CarGurus"],
    methodologyNote:
      "California values require 3+ comparables within 75 miles. Market method is statutory standard. " +
      "Comps must be from last 30 days, same or similar year/make/model, with adjustments for mileage/condition.",
  },
  NV: {
    state: "NV",
    stateName: "Nevada",
    minCompsRequired: 2,
    maxRadius: 100,
    expandBy: 20,
    preferredSources: ["AutoTrader", "CarGurus", "NADA", "Local dealers"],
    methodologyNote:
      "Nevada requires minimum 2 comparable sales within 100 miles. Year range ±3 years acceptable. " +
      "Mileage variance up to ±25,000 miles. Market sales method preferred.",
  },
  ID: {
    state: "ID",
    stateName: "Idaho",
    minCompsRequired: 3,
    maxRadius: 150,
    expandBy: 25,
    preferredSources: ["AutoTrader", "CarGurus", "Local dealers"],
    methodologyNote:
      "Idaho appraisals require 3 comparables within 150 miles of subject property. If unavailable, " +
      "radius expands by 25 miles. Market sales method is standard; cost method supplementary.",
  },
  MT: {
    state: "MT",
    stateName: "Montana",
    minCompsRequired: 2,
    maxRadius: 200,
    expandBy: 25,
    preferredSources: ["AutoTrader", "NADA", "Local dealers", "Online auctions"],
    methodologyNote:
      "Montana recognizes market sales method. Minimum 2 comparables within 200 miles due to geographic " +
      "dispersion. Similar year (±3), make, model, and condition required.",
  },
  AZ: {
    state: "AZ",
    stateName: "Arizona",
    minCompsRequired: 3,
    maxRadius: 100,
    expandBy: 20,
    preferredSources: ["AutoTrader", "CarGurus", "Cars.com", "Local dealers"],
    methodologyNote:
      "Arizona requires 3 comparable vehicle sales within 100 miles. Market approach is standard. " +
      "Adjustments for mileage (up to 0.10/mile) and condition variations documented.",
  },
  TX: {
    state: "TX",
    stateName: "Texas",
    minCompsRequired: 3,
    maxRadius: 100,
    expandBy: 25,
    preferredSources: ["AutoTrader", "CarGurus", "Cars.com", "Local dealers", "eBay Motors"],
    methodologyNote:
      "Texas values require 3 similar sales within 100 miles. Market sales method is standard. " +
      "Year range ±3 years, adjustments for mileage and condition detailed.",
  },
  FL: {
    state: "FL",
    stateName: "Florida",
    minCompsRequired: 3,
    maxRadius: 75,
    expandBy: 15,
    preferredSources: ["AutoTrader", "CarGurus", "Edmunds", "Cars.com"],
    methodologyNote:
      "Florida law requires 3 comparable sales within 75 miles for ACV determinations. Market method " +
      "applies. Recent sales (within 30 days preferred) with similar year, make, model, and condition.",
  },
  NY: {
    state: "NY",
    stateName: "New York",
    minCompsRequired: 3,
    maxRadius: 100,
    expandBy: 20,
    preferredSources: ["AutoTrader", "CarGurus", "TrueCar", "Local dealers"],
    methodologyNote:
      "New York requires comparables within 100 miles. Three sales minimum unless unavailable, then " +
      "radius expands. Year ±3, mileage adjustments (0.15-0.25/mile), condition documented.",
  },
  // Nationwide fallback
  US: {
    state: "US",
    stateName: "United States (Default)",
    minCompsRequired: 3,
    maxRadius: 150,
    expandBy: 25,
    preferredSources: ["AutoTrader", "CarGurus", "Cars.com", "NADA", "Local dealers"],
    methodologyNote:
      "Standard market approach: 3 comparable vehicle sales. Geographic radius 150 miles, expanding by 25 " +
      "if insufficient. Year ±3, mileage adjustments 0.10-0.25/mile, condition adjustments itemized.",
  },
};

export function getStateGuideline(state: string): StateGuideline {
  const key = state?.toUpperCase();
  return STATE_GUIDELINES[key] || STATE_GUIDELINES.US;
}

export function getCompSearchParams(state: string): {
  minCompsRequired: number;
  radiusStart: number;
  radiusExpandBy: number;
} {
  const guide = getStateGuideline(state);
  return {
    minCompsRequired: guide.minCompsRequired,
    radiusStart: guide.maxRadius,
    radiusExpandBy: guide.expandBy,
  };
}
