import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({ handler: async (ctx) => ctx.db.query("projects").order("desc").collect() });

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").collect();
    if (existing.length > 0) return;
    const now = Date.now();
    const projects = [
      { name: "Claims.Coach Growth", description: "Regional and national expansion of the core public adjusting business. New client acquisition, partnerships, and market penetration.", status: "active" as const, priority: "high" as const, emoji: "🏆", progress: 25, owner: "Johnny", nextActions: ["Set up GHL pipeline", "Launch Google Ads campaign", "Close first 10 national clients"], createdAt: now, updatedAt: now },
      { name: "Walker Appraisal", description: "Advanced DV and loss of use expert reports brand. Positioning as the go-to expert witness firm for attorneys and insurance defense.", status: "active" as const, priority: "high" as const, emoji: "⚖️", progress: 15, owner: "CC", nextActions: ["Build DV calculator tool", "Create expert witness intake form", "Draft service menu PDF"], createdAt: now, updatedAt: now },
      { name: "Claim Automation Pipeline", description: "Full end-to-end automation: Plaud intake → valuation → report → negotiation. Zero manual steps once triggered.", status: "active" as const, priority: "high" as const, emoji: "⚡", progress: 10, owner: "CC", nextActions: ["Connect Plaud API", "Build valuation engine (VIN → ACV)", "Wire report generator"], createdAt: now, updatedAt: now },
      { name: "Content & Marketing Engine", description: "Auto-research trending topics, write scripts, generate thumbnails, post to TikTok/IG/YouTube/FB. Daily pipeline running.", status: "active" as const, priority: "medium" as const, emoji: "📣", progress: 40, owner: "Marketing Agent", nextActions: ["Set up auto-posting API keys", "Build thumbnail generator", "Launch first 5 videos"], createdAt: now, updatedAt: now },
      { name: "Self-Learning Case Database", description: "RAG system trained on thousands of past reports. Provides hints, comps, and precedents for every new claim.", status: "paused" as const, priority: "medium" as const, emoji: "🧬", progress: 5, owner: "Database Agent", nextActions: ["Upload first 100 reports", "Configure vector embeddings", "Build search interface"], createdAt: now, updatedAt: now },
    ];
    for (const p of projects) await ctx.db.insert("projects", p);
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.string(), status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed")), priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")), emoji: v.string(), nextActions: v.array(v.string()), progress: v.number(), owner: v.string() },
  handler: async (ctx, args) => { const now = Date.now(); return ctx.db.insert("projects", { ...args, createdAt: now, updatedAt: now }); },
});

export const update = mutation({
  args: { id: v.id("projects"), progress: v.optional(v.number()), status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("completed"))), nextActions: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => { const { id, ...rest } = args; return ctx.db.patch(id, { ...rest, updatedAt: Date.now() }); },
});
