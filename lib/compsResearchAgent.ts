/**
 * Comps Research Agent
 * Takes: VIN + mileage + location
 * Returns: Validated comps with links, images, full specs
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface CompListing {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  askingPrice: number;
  listingUrl: string;
  imageUrl?: string;
  source: 'autotrader' | 'carsforsale' | 'craigslist';
  validated: boolean;
}

export async function researchComps(params: {
  vin: string;
  year: number;
  make: string;
  model: string;
  mileage: number;
  location: string;
  radius?: number;
}): Promise<CompListing[]> {
  const prompt = `You are a professional comps researcher for insurance appraisals. Your job is to find comparable vehicle listings.

VEHICLE TO MATCH:
- VIN: ${params.vin}
- Year: ${params.year}
- Make: ${params.make}
- Model: ${params.model}
- Mileage: ${params.mileage.toLocaleString()} miles
- Location: ${params.location}
- Search Radius: ${params.radius || 100} miles

YOUR TASK:
1. Search AutoTrader, Cars for Sale, and Craigslist for similar vehicles (same year ±1, same make/model, mileage ±10k miles)
2. Find at least 3-5 legitimate comparable listings
3. For EACH listing, provide:
   - Direct listing URL (must work)
   - Asking price
   - Trim level
   - Actual mileage shown
   - Photo URL (if available)
   - Source (AutoTrader, CarsfSale, etc.)

FORMAT YOUR RESPONSE AS JSON ARRAY:
[
  {
    "make": "Toyota",
    "model": "RAV4",
    "year": 2021,
    "trim": "XLE",
    "mileage": 45000,
    "askingPrice": 28500,
    "listingUrl": "https://www.autotrader.com/...",
    "imageUrl": "https://...",
    "source": "autotrader",
    "location": "Seattle, WA"
  }
]

IMPORTANT:
- URLs must be complete and clickable
- Prices must be asking prices (not average prices)
- Validate all URLs are REAL (not made up)
- Include actual image URLs when available
- Focus on legitimate, active listings`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    // Extract JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const comps = JSON.parse(jsonMatch[0]);

    // Validate and enrich
    return comps.map((comp: any) => ({
      vin: params.vin,
      year: comp.year,
      make: comp.make,
      model: comp.model,
      trim: comp.trim || 'Unknown',
      mileage: comp.mileage,
      askingPrice: comp.askingPrice,
      listingUrl: comp.listingUrl,
      imageUrl: comp.imageUrl,
      source: comp.source,
      validated: !!comp.listingUrl && comp.listingUrl.startsWith('http'),
    }));
  } catch (error) {
    console.error('Comps research error:', error);
    throw error;
  }
}

export async function generateCompsBundle(comps: CompListing[]) {
  if (comps.length === 0) return null;

  const validatedComps = comps.filter((c) => c.validated);
  const avgPrice =
    validatedComps.length > 0 ? validatedComps.reduce((sum, c) => sum + c.askingPrice, 0) / validatedComps.length : 0;

  return {
    totalFound: comps.length,
    validatedCount: validatedComps.length,
    averagePrice: Math.round(avgPrice),
    minPrice: Math.min(...validatedComps.map((c) => c.askingPrice)),
    maxPrice: Math.max(...validatedComps.map((c) => c.askingPrice)),
    comps: validatedComps,
  };
}
