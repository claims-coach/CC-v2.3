import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const STAGE = v.union(
  v.literal("intake"),
  v.literal("valuation"),
  v.literal("report_draft"),
  v.literal("review"),
  v.literal("negotiation"),
  v.literal("settled"),
  v.literal("closed")
);

export const list = query({
  args: { stage: v.optional(v.string()) },
  handler: async (ctx, { stage }) => {
    const all = await ctx.db.query("claims").collect();
    if (stage) return all.filter(c => c.stage === stage);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("claims") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    if (!q.trim()) return ctx.db.query("claims").collect();
    return ctx.db.query("claims").withSearchIndex("search_claims", s => s.search("clientName", q)).collect();
  },
});

export const create = mutation({
  args: {
    clientName: v.string(),
    vin: v.string(),
    year: v.optional(v.number()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    insurer: v.string(),
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    openingOffer: v.optional(v.number()),
    targetValue: v.optional(v.number()),
    claimType: v.union(v.literal("ACV"), v.literal("DV"), v.literal("both")),
    assignedAgent: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("claims", {
      ...args,
      stage: "intake",
      daysOpen: 0,
      openedAt: now,
      documents: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStage = mutation({
  args: { id: v.id("claims"), stage: STAGE },
  handler: async (ctx, { id, stage }) => {
    const now = Date.now();
    const claim = await ctx.db.get(id);
    if (!claim) return;
    const patch: any = { stage, updatedAt: now };
    if (stage === "settled") patch.settledAt = now;
    if (stage === "closed") patch.closedAt = now;
    await ctx.db.patch(id, patch);
  },
});

export const update = mutation({
  args: {
    id: v.id("claims"),
    clientName: v.optional(v.string()),
    vin: v.optional(v.string()),
    year: v.optional(v.number()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    trim: v.optional(v.string()),
    mileage: v.optional(v.number()),
    insurer: v.optional(v.string()),
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    openingOffer: v.optional(v.number()),
    targetValue: v.optional(v.number()),
    settlementAmount: v.optional(v.number()),
    assignedAgent: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    notes: v.optional(v.string()),
    outcome: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...fields }) => {
    const clean: any = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(id, { ...clean, updatedAt: Date.now() });
  },
});

export const addDocument = mutation({
  args: {
    id: v.id("claims"),
    name: v.string(),
    type: v.union(v.literal("estimate"), v.literal("photo"), v.literal("recording"), v.literal("report"), v.literal("correspondence"), v.literal("other")),
    url: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, type, url }) => {
    const claim = await ctx.db.get(id);
    if (!claim) return;
    const docs = [...claim.documents, { name, type, url }];
    await ctx.db.patch(id, { documents: docs, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("claims") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const updateDaysOpen = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db.query("claims")
      .filter(q => q.and(q.neq(q.field("stage"), "settled"), q.neq(q.field("stage"), "closed")))
      .collect();
    for (const c of open) {
      const days = Math.floor((now - c.openedAt) / 86400000);
      if (days !== c.daysOpen) await ctx.db.patch(c._id, { daysOpen: days });
    }
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("claims").collect();
    const settled = all.filter(c => c.stage === "settled" || c.stage === "closed");
    const open = all.filter(c => c.stage !== "settled" && c.stage !== "closed");
    const totalPipeline = open.reduce((s, c) => s + (c.targetValue ?? 0), 0);
    const totalRecovered = settled.reduce((s, c) => s + (c.settlementAmount ?? 0), 0);
    const avgDaysOpen = open.length ? Math.round(open.reduce((s, c) => s + c.daysOpen, 0) / open.length) : 0;
    const winRate = settled.length ? Math.round(settled.filter(c => (c.settlementAmount ?? 0) > (c.openingOffer ?? 0)).length / settled.length * 100) : 0;
    return { total: all.length, open: open.length, settled: settled.length, totalPipeline, totalRecovered, avgDaysOpen, winRate };
  },
});
