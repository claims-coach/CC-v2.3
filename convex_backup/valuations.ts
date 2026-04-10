import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByClaimId = query({
  args: { claimId: v.string(), claimType: v.union(v.literal("ACV"), v.literal("DV"), v.literal("LOU")) },
  handler: async (ctx, { claimId, claimType }) => {
    const all = await ctx.db.query("valuations").collect();
    return all.find(v => v.claimId === claimId && v.claimType === claimType) ?? null;
  },
});

export const upsert = mutation({
  args: {
    claimId: v.string(),
    claimType: v.union(v.literal("ACV"), v.literal("DV"), v.literal("LOU")),
    // ACV
    insurerOffer:     v.optional(v.number()),
    jdPowerValue:     v.optional(v.number()),
    kbbValue:         v.optional(v.number()),
    comps:            v.optional(v.array(v.object({ source: v.string(), description: v.string(), price: v.number(), mileage: v.optional(v.number()), url: v.optional(v.string()) }))),
    conditionAdjPct:  v.optional(v.number()),
    mileageAdjPct:    v.optional(v.number()),
    regionalAdjPct:   v.optional(v.number()),
    calculatedACV:    v.optional(v.number()),
    acvGap:           v.optional(v.number()),
    // DV
    preLossValue:     v.optional(v.number()),
    repairCost:       v.optional(v.number()),
    postRepairValue:  v.optional(v.number()),
    repairQuality:    v.optional(v.union(v.literal("excellent"), v.literal("acceptable"), v.literal("substandard"), v.literal("poor"))),
    structuralDamage: v.optional(v.boolean()),
    airbagDeployment: v.optional(v.boolean()),
    dvMethodology:    v.optional(v.string()),
    calculatedDV:     v.optional(v.number()),
    insurerDVOffer:   v.optional(v.number()),
    dvGap:            v.optional(v.number()),
    notes:            v.optional(v.string()),
    workbenchData:    v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const all = await ctx.db.query("valuations").collect();
    const existing = all.find(v => v.claimId === args.claimId && v.claimType === args.claimType);
    const clean: any = {};
    for (const [k, val] of Object.entries(args)) if (val !== undefined) clean[k] = val;
    if (existing) {
      await ctx.db.patch(existing._id, { ...clean, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("valuations", { ...clean, createdAt: now, updatedAt: now });
  },
});

export const lock = mutation({
  args: { claimId: v.string(), claimType: v.union(v.literal("ACV"), v.literal("DV"), v.literal("LOU")) },
  handler: async (ctx, { claimId, claimType }) => {
    const all = await ctx.db.query("valuations").collect();
    const val = all.find(v => v.claimId === claimId && v.claimType === claimType);
    if (val) await ctx.db.patch(val._id, { lockedAt: Date.now() });
  },
});
