import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => ctx.db.query("content").order("desc").collect(),
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    script: v.optional(v.string()),
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("editing"),
      v.literal("published")
    ),
    platform: v.array(v.string()),
    tags: v.array(v.string()),
    trendScore: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("content", { ...args, createdAt: now, updatedAt: now });
  },
});

export const updateStage = mutation({
  args: {
    id: v.id("content"),
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("editing"),
      v.literal("published")
    ),
  },
  handler: async (ctx, args) =>
    ctx.db.patch(args.id, { stage: args.stage, updatedAt: Date.now() }),
});

export const updateScript = mutation({
  args: { id: v.id("content"), script: v.string() },
  handler: async (ctx, args) =>
    ctx.db.patch(args.id, { script: args.script, updatedAt: Date.now() }),
});

export const remove = mutation({
  args: { id: v.id("content") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});
