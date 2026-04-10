import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { clientName: v.optional(v.string()), category: v.optional(v.string()) },
  handler: async (ctx, { clientName, category }) => {
    let all = await ctx.db.query("files").order("desc").collect();
    if (clientName) all = all.filter(f => f.clientName === clientName);
    if (category)   all = all.filter(f => f.category === category);
    return all;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    if (!q.trim()) return ctx.db.query("files").order("desc").collect();
    return ctx.db.query("files")
      .withSearchIndex("search_files", s => s.search("name", q))
      .collect();
  },
});

export const clients = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("files").collect();
    const names = new Set(all.map(f => f.clientName).filter(Boolean) as string[]);
    return Array.from(names).sort();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.union(
      v.literal("recording"), v.literal("estimate"), v.literal("photo"),
      v.literal("report"), v.literal("correspondence"), v.literal("contract"), v.literal("other")
    ),
    driveUrl: v.optional(v.string()),
    localPath: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    clientName: v.optional(v.string()),
    claimId: v.optional(v.string()),
    recordingId: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("files", { ...args, createdAt: now });
    await ctx.db.insert("activity", {
      agentName: args.uploadedBy,
      action: `File added: ${args.name}`,
      details: args.clientName ?? args.category,
      type: "document",
      createdAt: now,
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
