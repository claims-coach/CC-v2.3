import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => ctx.db.query("calendar").order("asc").collect(),
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("task"), v.literal("cron"), v.literal("event")),
    scheduledAt: v.number(),
    cronExpression: v.optional(v.string()),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    assignee: v.string(),
  },
  handler: async (ctx, args) => ctx.db.insert("calendar", { ...args, createdAt: Date.now() }),
});

export const updateStatus = mutation({
  args: {
    id: v.id("calendar"),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, args) => ctx.db.patch(args.id, { status: args.status }),
});
