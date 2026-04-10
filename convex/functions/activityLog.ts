// ============================================================
// functions/activityLog.ts — Append-only activity log
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * append — add an activity log entry. Never edit. Never delete.
 * Also enqueues a job to sync to CASE_ACTIVITY_LOG.md in GDrive.
 */
export const append = mutation({
  args: {
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
    action: v.string(),
    party: v.union(
      v.literal("CC"), v.literal("Johnny Walker"),
      v.literal("Client"), v.literal("Insurer"),
      v.literal("System"), v.literal("Other"),
    ),
    summary: v.string(),
    visibleToOperator: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const date = new Date(now).toISOString().slice(0, 10);

    const docId = await ctx.db.insert("activityLog", {
      entityType: args.entityType,
      entityId: args.entityId,
      date,
      action: args.action,
      party: args.party,
      summary: args.summary,
      visibleToOperator: args.visibleToOperator ?? true,
      createdAt: now,
    });

    // Enqueue GDrive sync
    await ctx.db.insert("jobs", {
      jobType: "gdrive.syncActivityLog",
      parentType: args.entityType,
      parentId: args.entityId,
      status: "QUEUED",
      priority: "P2",
      attempts: 0,
      maxAttempts: 3,
      payloadJson: JSON.stringify({ logEntryId: docId }),
      scheduledAt: now,
    });

    return docId;
  },
});

export const listByEntity = query({
  args: {
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
  },
  handler: async (ctx, { entityType, entityId }) =>
    ctx.db.query("activityLog").withIndex("by_entity", (q) =>
      q.eq("entityType", entityType).eq("entityId", entityId)
    ).collect(),
});

// ============================================================
// functions/timeAndExpense.ts — T&E entries
// ============================================================

export const createTimeAndExpense = mutation({
  args: {
    matterId: v.string(),
    vendor: v.string(),
    amount: v.number(),
    description: v.string(),
    sourceEmailPath: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("timeAndExpense", { ...args, createdAt: Date.now() });
  },
});

export const listTimeAndExpense = query({
  args: { matterId: v.string() },
  handler: async (ctx, { matterId }) =>
    ctx.db.query("timeAndExpense").withIndex("by_matterId", (q) => q.eq("matterId", matterId)).collect(),
});
