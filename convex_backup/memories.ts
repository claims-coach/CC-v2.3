import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => ctx.db.query("memories").order("desc").collect(),
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query) return ctx.db.query("memories").order("desc").take(50);
    return ctx.db
      .query("memories")
      .withSearchIndex("search_memories", (q) => q.search("content", args.query))
      .take(50);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.union(v.literal("conversation"), v.literal("document"), v.literal("client"), v.literal("decision"), v.literal("lesson")),
    tags: v.array(v.string()),
    clientName: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    recordedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("memories", { ...args, createdAt: now, updatedAt: now });
  },
});

export const getBySourceId = query({
  args: { sourceId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.query("memories").filter(q => q.eq(q.field("sourceId"), args.sourceId)).first();
  },
});

export const remove = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});
