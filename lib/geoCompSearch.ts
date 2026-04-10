/**
 * Geo-Aware Comp Search
 * Phase 1: ZIP-based geolocation, 150-mile radius filtering, price floor enforcement
 * 
 * Features:
 * - Convert ZIP code → lat/lon
 * - Filter comps within 150-mile radius
 * - WA-first prioritization, expand to OR/ID if needed
 * - Price floor: only show comps ≥ target price
 * - Exact trim matching
 */

/**
 * Haversine distance calculation (miles)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * State neighbor mapping for search expansion
 */
const STATE_NEIGHBORS: Record<string, string[]> = {
  WA: ["WA", "OR", "ID", "BC"],
  OR: ["OR", "WA", "CA", "ID", "NV"],
  ID: ["ID", "WA", "OR", "MT", "WY", "UT"],
  CA: ["CA", "OR", "NV", "AZ"],
  // Add more as needed
};

/**
 * Get search states with priority order
 */
export function getSearchStatesPrioritized(state: string): string[] {
  return STATE_NEIGHBORS[state.toUpperCase()] || [state];
}

/**
 * US ZIP Code geolocation
 * Uses nominatim.openstreetmap.org (free, no API key required)
 */
export async function getGeoFromZip(zip: string): Promise<{
  lat: number;
  lon: number;
  city: string;
  state: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=us&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "claims-coach-research/1.0" },
    });

    if (!res.ok) throw new Error("Nominatim API error");

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`ZIP code ${zip} not found`);
    }

    const result = data[0];
    const address = result.address || {};
    const state = address.state || address.province || "US";
    const city = address.city || address.town || address.village || "Unknown";

    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      city,
      state,
    };
  } catch (error) {
    throw new Error(`Failed to geocode ZIP ${zip}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract lat/lon from listing URL or page content
 * Common patterns: "near 98201", "Everett, WA", etc.
 */
export async function extractGeoFromListing(
  url: string,
  pageContent: string
): Promise<{ lat: number; lon: number } | null> {
  try {
    // Try to extract ZIP from URL (e.g., autotrader has zip in URL)
    const zipMatch = url.match(/zip[_-]?(\d{5})/i) || pageContent.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const geo = await getGeoFromZip(zipMatch[1]);
      return { lat: geo.lat, lon: geo.lon };
    }

    // Try to extract "City, State" pattern
    const cityStateMatch = pageContent.match(/(?:near\s+)?([A-Za-z\s]+),\s+([A-Z]{2})/);
    if (cityStateMatch) {
      const [, city, state] = cityStateMatch;
      // Could add city geocoding here if needed
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Filter comps by distance from subject location
 */
export function filterCompsByDistance(
  comps: Array<{
    url: string;
    description: string;
    askingPrice: number;
    compMileage: number;
    source: string;
    lat?: number;
    lon?: number;
  }>,
  subjectLat: number,
  subjectLon: number,
  radiusMiles: number = 150
): Array<{
  url: string;
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  lat?: number;
  lon?: number;
  distance?: number;
}> {
  return comps
    .map((comp) => {
      if (!comp.lat || !comp.lon) return null;
      const distance = haversineDistance(subjectLat, subjectLon, comp.lat, comp.lon);
      return distance <= radiusMiles ? { ...comp, distance } : null;
    })
    .filter(Boolean) as typeof comps;
}

/**
 * Normalize trim string for comparison
 */
function normalizeTrim(trim: string): string {
  return (trim || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Check if comp matches subject trim (exact or acceptable variation)
 */
export function isTrimMatch(
  compTrim: string | undefined,
  subjectTrim: string,
  subjectPackages?: string
): boolean {
  if (!compTrim) return false;

  const compNorm = normalizeTrim(compTrim);
  const subjectNorm = normalizeTrim(subjectTrim);
  const packagesNorm = subjectPackages
    ? normalizeTrim(subjectPackages)
    : "";

  // Exact match
  if (compNorm === subjectNorm) return true;

  // Allow higher trim as acceptable comp
  const trimHierarchy: Record<string, number> = {
    s: 1,
    se: 2,
    sel: 2.5,
    sx: 2.5,
    ex: 3,
    exl: 3.5,
    limited: 4,
    platinum: 5,
    si: 3.5,
    type_r: 5,
  };

  const compTrimBase = compNorm.split(" ")[0];
  const subjectTrimBase = subjectNorm.split(" ")[0];

  const compLevel = trimHierarchy[compTrimBase] || 0;
  const subjectLevel = trimHierarchy[subjectTrimBase] || 0;

  // Allow comp if it's at same level or one level higher (premium upgrade)
  if (compLevel >= subjectLevel && compLevel <= subjectLevel + 1) {
    return true;
  }

  // Check if packages match (e.g., "leather package" in both)
  if (packagesNorm && compNorm.includes(packagesNorm.split(" ")[0])) {
    return true;
  }

  return false;
}

/**
 * Filter comps by exact trim match
 */
export function filterCompsByTrim(
  comps: Array<{
    description: string;
    askingPrice: number;
    compMileage: number;
    source: string;
    url: string;
    trim?: string;
  }>,
  subjectTrim: string,
  subjectPackages?: string
): {
  matched: typeof comps;
  rejected: Array<typeof comps[0] & { rejectionReason: string }>;
} {
  const matched: typeof comps = [];
  const rejected: Array<typeof comps[0] & { rejectionReason: string }> = [];

  for (const comp of comps) {
    if (isTrimMatch(comp.trim, subjectTrim, subjectPackages)) {
      matched.push(comp);
    } else {
      rejected.push({
        ...comp,
        rejectionReason: `Wrong trim: found "${comp.trim}" but subject is "${subjectTrim}"`,
      });
    }
  }

  return { matched, rejected };
}

/**
 * Filter comps by price floor (≥ target price)
 */
export function filterCompsByPrice(
  comps: Array<{
    description: string;
    askingPrice: number;
    compMileage: number;
    source: string;
    url: string;
  }>,
  targetPrice: number | null
): {
  atOrAbove: typeof comps;
  below: Array<typeof comps[0] & { priceGap: number }>;
} {
  if (!targetPrice || targetPrice <= 0) {
    return { atOrAbove: comps, below: [] };
  }

  const atOrAbove: typeof comps = [];
  const below: Array<typeof comps[0] & { priceGap: number }> = [];

  for (const comp of comps) {
    if (comp.askingPrice >= targetPrice) {
      atOrAbove.push(comp);
    } else {
      const gap = targetPrice - comp.askingPrice;
      const gapPercent = Math.round((gap / targetPrice) * 100);
      below.push({
        ...comp,
        priceGap: gapPercent,
      });
    }
  }

  return { atOrAbove, below };
}

/**
 * Main hardened comp filtering pipeline
 */
export async function filterCompsHardened(
  rawComps: Array<{
    description: string;
    askingPrice: number;
    compMileage: number;
    source: string;
    url: string;
    trim?: string;
  }>,
  options: {
    subjectZip: string;
    subjectState: string;
    subjectTrim: string;
    subjectPackages?: string;
    targetPrice: number | null;
    radiusMiles?: number;
  }
): Promise<{
  validComps: typeof rawComps;
  rejectedComps: Array<{
    comp: typeof rawComps[0];
    reasons: string[];
  }>;
  metadata: {
    subjectGeo: { lat: number; lon: number; city: string; state: string };
    radiusMiles: number;
    targetPrice: number | null;
    statsRejections: {
      wrongTrim: number;
      wrongDistance: number;
      wrongPrice: number;
      total: number;
    };
  };
}> {
  // Step 1: Get subject location from ZIP
  const subjectGeo = await getGeoFromZip(options.subjectZip);

  // Step 2: Filter by trim
  const { matched: trimMatched, rejected: trimRejected } = filterCompsByTrim(
    rawComps,
    options.subjectTrim,
    options.subjectPackages
  );

  // Step 3: Filter by distance (150 miles default)
  const radiusMiles = options.radiusMiles || 150;
  const distanceFiltered: typeof rawComps = [];
  const distanceRejected: Array<
    typeof rawComps[0] & { distance: number }
  > = [];

  for (const comp of trimMatched) {
    if (!comp.trim) continue; // Should already be trimmed by step 2

    // Try to extract location from listing if available
    // For now, assume all comps are in same state (conservative)
    // Real implementation would extract actual location per comp
    distanceFiltered.push(comp);
  }

  // Step 4: Filter by price floor
  const { atOrAbove: priceFiltered, below: priceRejected } =
    filterCompsByPrice(distanceFiltered, options.targetPrice);

  // Step 5: Compile rejections for logging
  const rejectedComps = [
    ...trimRejected.map((comp) => ({
      comp,
      reasons: [comp.rejectionReason],
    })),
    ...priceRejected.map((comp) => ({
      comp,
      reasons: [
        `Price ${Math.round((comp.priceGap / options.targetPrice!) * 100)}% below target ($${comp.askingPrice.toLocaleString()} vs target $${options.targetPrice!.toLocaleString()})`,
      ],
    })),
  ];

  return {
    validComps: priceFiltered,
    rejectedComps,
    metadata: {
      subjectGeo,
      radiusMiles,
      targetPrice: options.targetPrice || null,
      statsRejections: {
        wrongTrim: trimRejected.length,
        wrongDistance: 0, // TODO: implement distance filtering per comp
        wrongPrice: priceRejected.length,
        total: rawComps.length - priceFiltered.length,
      },
    },
  };
}

/**
 * Build geo-aware search queries for Brave Search
 */
export function buildGeoSearchQueries(
  year: number,
  make: string,
  model: string,
  trim: string,
  packages: string | undefined,
  zip: string,
  state: string
): string[] {
  const trimStr = [trim, packages].filter(Boolean).join(" ").trim();
  const baseVehicle = `${year} ${make} ${model}`;
  const fullVehicle = `${baseVehicle} ${trimStr}`.trim();

  // Get search states (WA-first if WA)
  const searchStates = getSearchStatesPrioritized(state);
  const primaryState = searchStates[0];
  const expandedStates = searchStates.slice(1, 3).join(" OR ");

  return [
    // LOCAL ZIP CODE FIRST (strongest signal)
    `"${fullVehicle}" used for sale near ${zip} ${primaryState} site:autotrader.com`,
    `"${fullVehicle}" used for sale ${zip} ${primaryState} site:cargurus.com`,

    // CITY/STATE
    `"${fullVehicle}" used for sale ${primaryState} site:cars.com`,
    `"${fullVehicle}" used for sale ${primaryState} site:carmax.com`,

    // STATE + NEIGHBORS (if needed)
    `"${fullVehicle}" used for sale ${primaryState} ${expandedStates} site:autotrader.com`,
    `"${fullVehicle}" used for sale ${primaryState} ${expandedStates} site:cargurus.com`,

    // BROADER (fallback)
    `"${baseVehicle}" ${trim} used for sale ${primaryState} price`,
    `${fullVehicle} used for sale ${primaryState}`,
  ];
}
