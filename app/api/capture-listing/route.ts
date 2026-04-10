/**
 * POST /api/capture-listing
 * Takes a screenshot of a vehicle listing URL and extracts structured data.
 * 
 * Architecture:
 * - Local dev (Node.js): Uses local Playwright
 * - Vercel (serverless): Routes to Mac mini webhook at http://CCs-Mac-mini.local:3333
 * 
 * Returns: { screenshot: base64, data: { vin, dealer, location, color, transmission, ... } }
 */
import { NextRequest, NextResponse } from "next/server";

const IS_LOCAL = process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";
const MAC_MINI_CAPTURE_URL = process.env.MAC_MINI_CAPTURE_URL || "http://CCs-Mac-mini.local:3333/api/capture-listing";

export async function POST(req: NextRequest) {
  try {
    const { url, compIndex } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    // ── If local dev (Playwright available) ──────────────────────────────
    if (IS_LOCAL) {
      return handleLocalCapture(url, compIndex);
    }

    // ── If Vercel (route to Mac mini) ────────────────────────────────────
    return routeToMacMini(url, compIndex);

  } catch (e: any) {
    console.error("capture-listing error:", e);
    return NextResponse.json({ error: e.message, fallback: true }, { status: 500 });
  }
}

/**
 * Handle screenshot locally using Playwright
 */
async function handleLocalCapture(url: string, compIndex: number) {
  try {
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();

    // Block ads/trackers
    await page.route("**/{ads,analytics,tracking,pixel,beacon}**", (r) => r.abort());
    await page.route("**/*.{mp4,webm,ogg}", (r) => r.abort());

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);

    const screenshotBuf = await page.screenshot({
      type: "jpeg",
      quality: 82,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });

    const extracted = await page.evaluate(() => extractListingData());
    await browser.close();

    return NextResponse.json({
      success: true,
      screenshot: screenshotBuf.toString("base64"),
      mimeType: "image/jpeg",
      data: extracted,
      compIndex,
      source: "local",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, fallback: true }, { status: 500 });
  }
}

/**
 * Route to Mac mini webhook server
 */
async function routeToMacMini(url: string, compIndex: number) {
  try {
    const res = await fetch(MAC_MINI_CAPTURE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, compIndex }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Mac mini capture failed: ${res.status} ${res.statusText}`,
          fallback: true,
          hint: `Is Mac mini running? Check: curl ${MAC_MINI_CAPTURE_URL}`,
        },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ...data, source: "mac-mini" });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: `Cannot reach Mac mini: ${e.message}`,
        fallback: true,
        hint: `Start Mac mini capture server: npx ts-node mac-mini-capture-server.ts`,
      },
      { status: 503 }
    );
  }
}

/**
 * Extract listing data from DOM (runs in page context)
 */
function extractListingData() {
  const body = document.body.innerText;

  // VIN
  const vinMatch =
    body.match(/\bVIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i) ||
    body.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  const vin = vinMatch?.[1] || null;

  // Mileage
  const milMatch = body.match(/(\d{1,3}(?:,\d{3})*)\s*(?:miles|mi)\b/i);
  const mileage = milMatch?.[1]?.replace(/,/g, "") || null;

  // Price
  const priceMatch = body.match(/\$\s*([\d,]+)/);
  const price = priceMatch?.[1]?.replace(/,/g, "") || null;

  // Location
  const locMatch = body.match(
    /(?:located?|dealer|seller)\s+(?:in|at)?\s+([A-Za-z\s,]+,\s*[A-Z]{2})/i
  );
  const location = locMatch?.[1]?.trim() || null;

  // Color
  const colorMatch = body.match(
    /(?:exterior|color|colour)[:\s]+([A-Za-z\s]+?)(?:\n|,|\|)/i
  );
  const color = colorMatch?.[1]?.trim() || null;

  // Transmission
  const transMatch = body.match(/\b(automatic|manual|CVT|dual.?clutch|DCT)\b/i);
  const transmission = transMatch?.[1] || null;

  // Condition
  const condMatch = body.match(/\b(certified|CPO|pre-owned|used|new)\b/i);
  const condition = condMatch?.[1] || null;

  // Dealer name
  const dealer =
    (document.querySelector(".dealer-name") as HTMLElement)?.textContent?.trim() ||
    (document.querySelector("[data-dealer-name]") as HTMLElement)?.textContent?.trim() ||
    null;

  // Days on market
  const domMatch = body.match(
    /(\d+)\s*days?\s+(?:on\s+)?(?:market|listed|ago)/i
  );
  const daysOnMarket = domMatch?.[1] || null;

  // Primary image
  const img = document.querySelector(
    ".gallery img, .vehicle-image img, [class*='photo'] img, [class*='image'] img"
  ) as HTMLImageElement;
  const primaryImageUrl = img?.src || null;

  return {
    vin,
    mileage,
    price,
    location,
    color,
    transmission,
    condition,
    dealer,
    daysOnMarket,
    primaryImageUrl,
  };
}
