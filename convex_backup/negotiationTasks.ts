import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const all = await ctx.db.query("negotiationTasks")
      .order("desc")
      .collect();
    if (status) return all.filter(t => t.status === status);
    return all;
  },
});

export const get = query({
  args: { id: v.id("negotiationTasks") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const listByClaim = query({
  args: { claimId: v.string() },
  handler: async (ctx, { claimId }) =>
    ctx.db.query("negotiationTasks")
      .withIndex("by_claim", q => q.eq("claimId", claimId))
      .order("desc")
      .collect(),
});

export const create = mutation({
  args: {
    claimId:       v.optional(v.string()),
    clientName:    v.string(),
    vehicleStr:    v.string(),
    ourACV:        v.optional(v.number()),
    oaACV:         v.optional(v.number()),
    gap:           v.optional(v.number()),
    oaRawText:     v.string(),
    oaComps:       v.optional(v.array(v.object({
      description: v.string(),
      price:       v.number(),
      mileage:     v.optional(v.number()),
      source:      v.optional(v.string()),
      url:         v.optional(v.string()),
      notes:       v.optional(v.string()),
    }))),
    anchorFlags:   v.optional(v.array(v.object({
      compDescription: v.string(),
      reason:          v.string(),
      severity:        v.string(),
    }))),
    analysis:      v.optional(v.string()),
    draftRebuttal: v.optional(v.string()),
    ghlContactId:  v.optional(v.string()),
    ghlThreadId:   v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("negotiationTasks", {
      ...args,
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id:            v.id("negotiationTasks"),
    draftRebuttal: v.optional(v.string()),
    analysis:      v.optional(v.string()),
    status:        v.optional(v.union(
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("dismissed")
    )),
    sentAt:        v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("negotiationTasks") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
