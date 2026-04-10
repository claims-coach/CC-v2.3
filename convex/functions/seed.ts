// ============================================================
// functions/seed.ts — One-time bootstrap for sequence counters
// Run via Convex dashboard: npx convex run functions/seed:bootstrap
// ============================================================

import { mutation } from "../_generated/server";

export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];

    // ---- masterCaseId counter ----
    const mcRow = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", "masterCaseId"))
      .unique();

    if (!mcRow) {
      await ctx.db.insert("sequenceCounters", {
        name: "masterCaseId",
        currentValue: 149, // Next call to getNextMasterCaseId returns 150
      });
      results.push("Created masterCaseId counter at 149 (next = 150)");
    } else {
      results.push(`masterCaseId counter already exists at ${mcRow.currentValue}`);
    }

    // ---- prospectSeq_26 counter ----
    const yy = String(new Date().getFullYear()).slice(-2);
    const prospectName = `prospectSeq_${yy}`;
    const pRow = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", prospectName))
      .unique();

    if (!pRow) {
      await ctx.db.insert("sequenceCounters", {
        name: prospectName,
        currentValue: 0, // First prospect will be 1
      });
      results.push(`Created ${prospectName} counter at 0`);
    } else {
      results.push(`${prospectName} counter already exists at ${pRow.currentValue}`);
    }

    return results;
  },
});
