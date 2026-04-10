import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Auto-Valuation Pipeline
 * When case enters valuation stage with vehicle data:
 * 1. Trigger Watson comp search
 * 2. Pull KBB/JD Power valuations
 * 3. Generate basic valuation summary
 */

export const triggerAutoValuation = mutation({
  args: {
    caseId: v.string(),
    clientName: v.string(),
    year: v.number(),
    make: v.string(),
    model: v.string(),
    mileage: v.optional(v.number()),
    vin: v.optional(v.string()),
    insurerEstimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🔧 Auto-valuation triggered for: ${args.year} ${args.make} ${args.model}`);

      // 1. TRIGGER WATSON COMP SEARCH
      const compSearchResult = await fetch(
        `${process.env.CONVEX_URL || "https://calm-warbler-536.convex.cloud"}/api/find-comps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: args.year,
            make: args.make,
            model: args.model,
            mileage: args.mileage || 50000,
            state: "WA",
            caseId: args.caseId,
          }),
        }
      );

      const compData = await compSearchResult.json();
      console.log(`✅ Comps found: ${compData.comps?.length || 0} results`);

      // 2. PULL KBB VALUE
      const kbbResult = await fetch(
        `${process.env.CONVEX_URL || "https://calm-warbler-536.convex.cloud"}/api/kbb-value`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: args.year,
            make: args.make,
            model: args.model,
            mileage: args.mileage || 50000,
          }),
        }
      ).catch(() => null);

      const kbbData = kbbResult ? await kbbResult.json() : null;
      console.log(`✅ KBB value retrieved: $${kbbData?.acvValue || "N/A"}`);

      // 3. GENERATE BASIC VALUATION
      const basicValuation = {
        caseId: args.caseId,
        clientName: args.clientName,
        vehicle: `${args.year} ${args.make} ${args.model}`,
        compsAvg: compData.avgAskingPrice || 0,
        compsMedian: compData.medianPrice || 0,
        compsCount: compData.comps?.length || 0,
        kbbValue: kbbData?.acvValue || null,
        insurerEstimate: args.insurerEstimate || null,
        valuationGap:
          args.insurerEstimate && compData.avgAskingPrice
            ? compData.avgAskingPrice - args.insurerEstimate
            : null,
        status: "preliminary",
        completedAt: new Date().toISOString(),
      };

      console.log(`📊 Basic valuation completed:`, basicValuation);

      return {
        success: true,
        caseId: args.caseId,
        valuation: basicValuation,
        comps: compData.comps,
        kbb: kbbData,
      };
    } catch (err) {
      console.error("Auto-valuation failed:", err);
      return {
        success: false,
        error: `Valuation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
