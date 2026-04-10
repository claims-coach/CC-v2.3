import { mutation, action } from "./_generated/server";
import { v } from "convex/values";

/**
 * FEATURE 5: AUTO-NOTE TAGGING (Cron Job)
 *
 * Parses Gemini Notes from johnny@claims.coach and extracts:
 * - Claim #
 * - Vehicle (year/make/model)
 * - Carrier
 * - Damage type
 * - Next action
 *
 * Runs hourly or on-demand via cron
 */

export const parseLatestGeminiNotes = action({
  args: {},
  handler: async (ctx) => {
    // This is a stub for demonstration
    // In production, this would:
    // 1. Fetch latest Gmail from johnny@claims.coach (via Gmail API)
    // 2. Call llama3.3:70b to extract claim details
    // 3. Upsert to Convex geminiNotesParsed table
    //
    // For now, return placeholder indicating the action would run

    return {
      status: "ready",
      message: "parseLatestGeminiNotes cron job initialized",
      nextRun: new Date(Date.now() + 3600000).toISOString(),
    };
  },
});

export const saveParsedNote = mutation({
  args: {
    originalNoteId: v.string(),
    claimNumber: v.optional(v.string()),
    vehicleYear: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    carrier: v.optional(v.string()),
    damageType: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("geminiNotesParsed", {
      originalNoteId: args.originalNoteId,
      claimNumber: args.claimNumber,
      vehicleYear: args.vehicleYear,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      carrier: args.carrier,
      damageType: args.damageType,
      nextAction: args.nextAction,
      confidence: args.confidence,
      parsedAt: Date.now(),
    });

    return { ok: true, id };
  },
});
