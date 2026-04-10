/**
 * Hardened Comp Search Integration
 * Combines VIN extraction + Consensus validation for production-grade comp search
 */

import { verifyListingURLs } from "./vinExtractor";
import { validateCompsConsensus } from "./compConsensusValidator";

export interface HardenedCompResult {
  url: string;
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  vin: string | null;
  title: string | null;
  consensusScore: number; // 0-100
  grokApproval: boolean;
  mistralApproval: boolean;
  issues: string[];
}

export interface HardenedCompSearchResult {
  comps: HardenedCompResult[];
  rejected: Array<{
    url: string;
    description: string;
    askingPrice: number;
    reason: string;
  }>;
  summary: {
    totalProcessed: number;
    totalApproved: number;
    totalRejected: number;
    avgConsensusScore: number;
    avgPrice: number;
    medianPrice: number;
  };
  warnings: string[];
}

/**
 * Process raw AI-generated comps through full hardening pipeline
 */
export async function hardenCompsForProduction(
  rawComps: Array<{
    description: string;
    askingPrice: number;
    compMileage: number;
    source: string;
    url: string;
  }>,
  options: {
    subjectYear: number;
    subjectMake: string;
    subjectModel: string;
    subjectTrim: string;
    subjectMileage: number;
    targetPrice: number | null;
  }
): Promise<HardenedCompSearchResult> {
  const warnings: string[] = [];
  const rejected: Array<{ url: string; description: string; askingPrice: number; reason: string }> = [];

  // Step 1: Verify all URLs and extract VINs
  console.log(`[Harden] Verifying ${rawComps.length} comp URLs...`);

  const urlVerifications = await verifyListingURLs(
    rawComps.map((c) => c.url),
    options.subjectYear,
    options.subjectMake
  );

  const compsWithVINs = rawComps.map((comp, idx) => {
    const verification = urlVerifications[idx];
    if (!verification.valid) {
      rejected.push({
        url: comp.url,
        description: comp.description,
        askingPrice: comp.askingPrice,
        reason: `URL invalid: ${verification.reason}`,
      });
      return null;
    }

    return {
      ...comp,
      vin: verification.vin || null,
      title: verification.title || null,
      mileage: verification.mileage || comp.compMileage,
      price: verification.price || comp.askingPrice,
    };
  });

  const validComps = compsWithVINs.filter(Boolean) as any[];

  if (validComps.length === 0) {
    warnings.push("No comps passed URL verification");
    return {
      comps: [],
      rejected,
      summary: {
        totalProcessed: rawComps.length,
        totalApproved: 0,
        totalRejected: rawComps.length,
        avgConsensusScore: 0,
        avgPrice: 0,
        medianPrice: 0,
      },
      warnings,
    };
  }

  // Step 2: Run consensus validation
  console.log(`[Harden] Running consensus validation on ${validComps.length} comps...`);

  const subjectVehicle = `${options.subjectYear} ${options.subjectMake} ${options.subjectModel} ${options.subjectTrim}`;

  const consensusResult = await validateCompsConsensus(
    validComps.map((c) => ({
      description: c.description,
      askingPrice: c.price,
      compMileage: c.mileage,
      source: c.source,
      url: c.url,
      vin: c.vin,
      title: c.title,
    })),
    subjectVehicle,
    options.subjectTrim,
    options.subjectMileage,
    options.targetPrice
  );

  // Step 3: Compile final results
  const finalComps: HardenedCompResult[] = consensusResult.validated.map((comp) => ({
    url: comp.url,
    description: comp.description,
    askingPrice: comp.askingPrice,
    compMileage: comp.compMileage,
    source: comp.source,
    vin: comp.vin || null,
    title: comp.title || null,
    consensusScore: comp.consensusScore,
    grokApproval: comp.grokApproval,
    mistralApproval: comp.mistralApproval,
    issues: comp.issues,
  }));

  // Add rejected comps from consensus validation
  for (const rejectedComp of consensusResult.rejected) {
    rejected.push({
      url: rejectedComp.url,
      description: rejectedComp.description,
      askingPrice: rejectedComp.askingPrice,
      reason: rejectedComp.reason,
    });
  }

  // Step 4: Calculate summary stats
  const avgPrice = finalComps.length > 0 ? Math.round(finalComps.reduce((s, c) => s + c.askingPrice, 0) / finalComps.length) : 0;
  const prices = finalComps.map((c) => c.askingPrice).sort((a, b) => a - b);
  const medianPrice =
    finalComps.length > 0
      ? finalComps.length % 2 === 0
        ? Math.round((prices[finalComps.length / 2 - 1] + prices[finalComps.length / 2]) / 2)
        : prices[Math.floor(finalComps.length / 2)]
      : 0;

  if (finalComps.length < 3) {
    warnings.push(`Only ${finalComps.length} comps approved (minimum recommended: 3)`);
  }

  if (finalComps.every((c) => c.vin === null)) {
    warnings.push("No VINs could be extracted from any comps");
  }

  return {
    comps: finalComps,
    rejected,
    summary: {
      totalProcessed: rawComps.length,
      totalApproved: finalComps.length,
      totalRejected: rejected.length,
      avgConsensusScore: consensusResult.avgConfidence,
      avgPrice,
      medianPrice,
    },
    warnings,
  };
}
