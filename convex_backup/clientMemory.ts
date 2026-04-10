import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// ── Store a memory ─────────────────────────────────────────────────────────
export const store = mutation({
  args: {
    caseId:     v.optional(v.string()),
    caseKey:    v.optional(v.string()),
    contactId:  v.optional(v.string()),
    clientName: v.optional(v.string()),
    category:   v.string(),
    text:       v.string(),
    source:     v.string(),
    embedding:  v.array(v.float64()),
    agentId:    v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clientMemory", { ...args, ts: Date.now() });
  },
});

// ── Vector search ──────────────────────────────────────────────────────────
export const search = action({
  args: {
    embedding: v.array(v.float64()),
    caseId:    v.optional(v.string()),
    category:  v.optional(v.string()),
    limit:     v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const filter = args.caseId
      ? (q: any) => args.category
          ? q.and(q.eq(q.field("caseId"), args.caseId), q.eq(q.field("category"), args.category))
          : q.eq(q.field("caseId"), args.caseId)
      : undefined;

    const results = await ctx.vectorSearch("clientMemory", "by_embedding", {
      vector: args.embedding,
      limit:  args.limit ?? 8,
      ...(filter ? { filter } : {}),
    });

    return results;
  },
});

// ── List memories for a case ───────────────────────────────────────────────
export const listByCase = query({
  args: { caseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clientMemory")
      .withIndex("by_case", q => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();
  },
});

// ── List memories for a contact ────────────────────────────────────────────
export const listByContact = query({
  args: { contactId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clientMemory")
      .withIndex("by_contact", q => q.eq("contactId", args.contactId))
      .order("desc")
      .collect();
  },
});

// ── Delete a memory ────────────────────────────────────────────────────────
export const remove = mutation({
  args: { id: v.id("clientMemory") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
