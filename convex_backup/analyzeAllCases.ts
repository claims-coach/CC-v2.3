import { mutation, action, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * FEATURE 8: NIGHTLY CASE ANALYSIS (Cron Job)
 *
 * Runs daily at 10pm PST
 * Analyzes all 146 open cases for:
 * - Cases stalled >30 days (flag for follow-up)
 * - High-variance comps (quality check)
 * - Settlement patterns (trending higher/lower)
 * - Outliers (unusually high/low valuations)
 *
 * Outputs:
 * - Convex table `caseAnalysisReport`
 * - Telegram summary to Johnny
 */

export const generateNightlyCaseAnalysis = action({
  args: {},
  handler: async (ctx) => {
    // Stub for demonstration
    // In production, this would:
    // 1. Query all open cases from caseRegistry
    // 2. Call llama3.3:70b with aggregated case data
    // 3. Get analysis of patterns, outliers, trends
    // 4. Save to caseAnalysisReport table
    // 5. Send Telegram message to Johnny
    //
    // For now, return placeholder

    const analysisDate = new Date().toISOString().split("T")[0];

    return {
      status: "ready",
      message: "Nightly case analysis ready to execute",
      analysisDate,
      expectedOutput: "caseAnalysisReport table + Telegram summary",
    };
  },
});

export const saveCaseAnalysisReport = mutation({
  args: {
    reportDate: v.string(),
    totalCasesAnalyzed: v.number(),
    stalledCases: v.array(
      v.object({
        caseId: v.string(),
        daysStalled: v.number(),
        lastActivity: v.optional(v.string()),
      })
    ),
    highVarianceComps: v.array(
      v.object({
        caseId: v.string(),
        issue: v.string(),
      })
    ),
    settlementTrends: v.object({
      direction: v.union(
        v.literal("TRENDING_UP"),
        v.literal("STABLE"),
        v.literal("TRENDING_DOWN")
      ),
      averageSettlement: v.number(),
      previousAverage: v.optional(v.number()),
    }),
    outliers: v.array(
      v.object({
        caseId: v.string(),
        type: v.union(v.literal("UNUSUALLY_HIGH"), v.literal("UNUSUALLY_LOW")),
        reason: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("caseAnalysisReport", {
      reportDate: args.reportDate,
      totalCasesAnalyzed: args.totalCasesAnalyzed,
      stalledCases: args.stalledCases,
      highVarianceComps: args.highVarianceComps,
      settlementTrends: args.settlementTrends,
      outliers: args.outliers,
      createdAt: Date.now(),
    });

    return { ok: true, id, reportDate: args.reportDate };
  },
});
