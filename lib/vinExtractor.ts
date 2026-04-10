/**
 * VIN Extraction & Validation
 * Extracts VINs from listing pages and validates them
 */

/**
 * VIN Check Digit Validation
 * Validates that a VIN has a correct check digit (position 9)
 */
export function validateVINCheckDigit(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;

  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4,
    N: 5, P: 7, R: 9, S: 2, T: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8, "0": 0, "1": 1,
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  };

  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    if (i === 8) continue; // Skip check digit position
    const char = vin[i].toUpperCase();
    const value = transliteration[char];
    if (value === undefined) return false;
    sum += (value * weights[i]) % 11;
  }

  const checkDigit = (11 - (sum % 11)) % 11;
  const checkChar = checkDigit === 10 ? "X" : String(checkDigit);
  return vin[8].toUpperCase() === checkChar;
}

/**
 * Extract VINs from listing HTML/text
 * Looks for 17-character alphanumeric patterns that could be VINs
 */
export function extractVINsFromText(text: string): string[] {
  const vins: string[] = [];
  const vinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
  let match;

  while ((match = vinPattern.exec(text)) !== null) {
    const potentialVin = match[1].toUpperCase();
    // Basic validation: must have letters and numbers, no obviously invalid patterns
    if (/[A-HJ-NPR-Z0-9]/.test(potentialVin) && potentialVin.length === 17) {
      // Don't require check digit validation (some sites use old VINs or errors)
      // but do validate format
      if (validateVINCheckDigit(potentialVin)) {
        vins.push(potentialVin);
      }
    }
  }

  return [...new Set(vins)]; // Deduplicate
}

/**
 * Extract VIN from specific listing page HTML
 * Uses site-specific patterns for AutoTrader, CarGurus, Cars.com, CarMax
 */
export function extractVINFromListingPage(
  html: string,
  source: string
): { vin: string | null; mileage: number | null; price: number | null; title: string | null } {
  const result = { vin: null as string | null, mileage: null as number | null, price: null as number | null, title: null as string | null };

  // Try generic VIN extraction first
  const vins = extractVINsFromText(html);
  if (vins.length > 0) {
    result.vin = vins[0]; // Take first valid VIN
  }

  // Extract mileage (common patterns)
  const mileageMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:mile|mi\b|mileage)/i);
  if (mileageMatch) {
    result.mileage = parseInt(mileageMatch[1].replace(/,/g, ""));
  }

  // Extract price (common patterns)
  const priceMatch = html.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1].replace(/,/g, ""));
  }

  // Extract title/heading
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  return result;
}

/**
 * Verify a listing URL is real and contains the vehicle data
 */
export async function verifyListingURL(
  url: string,
  expectedYear?: number,
  expectedMake?: string
): Promise<{
  valid: boolean;
  vin?: string;
  mileage?: number;
  price?: number;
  title?: string;
  reason?: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; claims-coach-research/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { valid: false, reason: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // Check if page contains expected vehicle info
    if (expectedMake && !html.toLowerCase().includes(expectedMake.toLowerCase())) {
      return { valid: false, reason: "Make not found in page" };
    }

    if (expectedYear && !html.includes(String(expectedYear))) {
      return { valid: false, reason: "Year not found in page" };
    }

    // Extract data from page
    const source = url.includes("autotrader") ? "AutoTrader" : url.includes("cargurus") ? "CarGurus" : url.includes("cars.com") ? "Cars.com" : "Other";
    const extracted = extractVINFromListingPage(html, source);

    if (!extracted.vin && !extracted.price) {
      return { valid: false, reason: "No VIN or price found" };
    }

    return {
      valid: true,
      vin: extracted.vin || undefined,
      mileage: extracted.mileage || undefined,
      price: extracted.price || undefined,
      title: extracted.title || undefined,
    };
  } catch (e) {
    return { valid: false, reason: `Error: ${(e as Error).message}` };
  }
}

/**
 * Batch verify multiple listing URLs
 */
export async function verifyListingURLs(
  urls: string[],
  expectedYear?: number,
  expectedMake?: string
): Promise<
  Array<{
    url: string;
    valid: boolean;
    vin?: string;
    mileage?: number;
    price?: number;
    reason?: string;
  }>
> {
  const results = await Promise.all(
    urls.map((url) => verifyListingURL(url, expectedYear, expectedMake))
  );

  return urls.map((url, i) => ({
    url,
    ...results[i],
  }));
}
