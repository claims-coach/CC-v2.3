import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({ handler: async (ctx) => ctx.db.query("documents").order("desc").collect() });

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query) return ctx.db.query("documents").order("desc").take(100);
    return ctx.db.query("documents").withSearchIndex("search_documents", (q) => q.search("content", args.query)).take(50);
  },
});

export const create = mutation({
  args: { title: v.string(), content: v.string(), category: v.union(v.literal("report"), v.literal("template"), v.literal("script"), v.literal("sop"), v.literal("note"), v.literal("contract")), tags: v.array(v.string()), clientName: v.optional(v.string()), fileType: v.optional(v.string()) },
  handler: async (ctx, args) => { const now = Date.now(); return ctx.db.insert("documents", { ...args, createdAt: now, updatedAt: now }); },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});
