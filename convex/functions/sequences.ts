// ============================================================
// functions/sequences.ts — Atomic ID generation
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * getNextMasterCaseId — atomic increment, returns new value.
 * Seed: counter "masterCaseId" must exist with currentValue = 149.
 * First real call returns 150.
 */
export const getNextMasterCaseId = mutation({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", "masterCaseId"))
      .unique();

    if (!row) {
      // Bootstrap: create the seed row and return 150
      await ctx.db.insert("sequenceCounters", { name: "masterCaseId", currentValue: 150 });
      return 150;
    }

    const next = row.currentValue + 1;
    await ctx.db.patch(row._id, { currentValue: next });
    return next;
  },
});

/**
 * getNextProspectSeq — atomic increment per year.
 * Counter name: "prospectSeq_YY" (e.g. "prospectSeq_26").
 */
export const getNextProspectSeq = mutation({
  args: { year: v.number() },
  handler: async (ctx, { year }) => {
    const yy = String(year).slice(-2);
    const name = `prospectSeq_${yy}`;

    const row = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    if (!row) {
      await ctx.db.insert("sequenceCounters", { name, currentValue: 1 });
      return 1;
    }

    const next = row.currentValue + 1;
    await ctx.db.patch(row._id, { currentValue: next });
    return next;
  },
});

/** Read current value without incrementing */
export const peekCounter = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const row = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    return row?.currentValue ?? null;
  },
});
