import { NextRequest, NextResponse } from 'next/server';
import { researchComps, generateCompsBundle } from '@/lib/compsResearchAgent';

export async function POST(req: NextRequest) {
  try {
    const { vin, year, make, model, mileage, location, radius } = await req.json();

    // Validate required fields
    if (!year || !make || !model || !mileage || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: year, make, model, mileage, location' },
        { status: 400 }
      );
    }

    // Run comps research
    const comps = await researchComps({
      vin: vin || 'N/A',
      year,
      make,
      model,
      mileage,
      location,
      radius: radius || 100,
    });

    // Generate bundle
    const bundle = await generateCompsBundle(comps);

    return NextResponse.json({
      success: true,
      bundle,
    });
  } catch (error) {
    console.error('Comps research error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
