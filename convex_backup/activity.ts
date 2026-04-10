import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) =>
    ctx.db.query("activity").order("desc").take(limit ?? 200),
});

export const log = mutation({
  args: {
    agentName: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    type: v.union(v.literal("task"), v.literal("memory"), v.literal("agent"), v.literal("system"), v.literal("api")),
  },
  handler: async (ctx, args) => ctx.db.insert("activity", { ...args, createdAt: Date.now() }),
});
