import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const log = mutation({
  args: {
    ts:           v.number(),
    provider:     v.string(),
    model:        v.string(),
    agentName:    v.string(),
    route:        v.string(),
    inputTokens:  v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    estCostUsd:   v.optional(v.number()),
    durationMs:   v.optional(v.number()),
    success:      v.boolean(),
  },
  handler: async (ctx, args) => ctx.db.insert("aiUsageLogs", args),
});

export const stats = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    const since = Date.now() - days * 86400_000;
    const logs = await ctx.db.query("aiUsageLogs")
      .withIndex("by_ts", q => q.gte("ts", since))
      .collect();

    // Per-provider rollup
    const byProvider: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byModel:    Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byAgent:    Record<string, { calls: number; costUsd: number; models: Record<string, number> }> = {};

    for (const l of logs) {
      // Provider
      if (!byProvider[l.provider]) byProvider[l.provider] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      byProvider[l.provider].calls++;
      byProvider[l.provider].inputTokens  += l.inputTokens  || 0;
      byProvider[l.provider].outputTokens += l.outputTokens || 0;
      byProvider[l.provider].costUsd      += l.estCostUsd   || 0;

      // Model
      if (!byModel[l.model]) byModel[l.model] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      byModel[l.model].calls++;
      byModel[l.model].inputTokens  += l.inputTokens  || 0;
      byModel[l.model].outputTokens += l.outputTokens || 0;
      byModel[l.model].costUsd      += l.estCostUsd   || 0;

      // Agent
      if (!byAgent[l.agentName]) byAgent[l.agentName] = { calls: 0, costUsd: 0, models: {} };
      byAgent[l.agentName].calls++;
      byAgent[l.agentName].costUsd += l.estCostUsd || 0;
      byAgent[l.agentName].models[l.model] = (byAgent[l.agentName].models[l.model] || 0) + 1;
    }

    const totalCost  = logs.reduce((s, l) => s + (l.estCostUsd || 0), 0);
    const totalCalls = logs.length;
    const ollamaCalls = byProvider["ollama"]?.calls || 0;
    const savedByOllama = ollamaCalls * 0.001; // rough estimate of what it would have cost on Claude Haiku

    return { byProvider, byModel, byAgent, totalCost, totalCalls, ollamaCalls, savedByOllama, days, logCount: logs.length };
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    ctx.db.query("aiUsageLogs").order("desc").take(limit),
});
