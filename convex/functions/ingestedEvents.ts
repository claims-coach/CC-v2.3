// ============================================================
// functions/ingestedEvents.ts — Idempotency + duplicate protection
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * checkAndRecord — idempotency gate.
 * Returns { isDuplicate: true } if this event was already processed.
 * Otherwise records it as RECEIVED and returns { isDuplicate: false, eventDocId }.
 */
export const checkAndRecord = mutation({
  args: {
    source: v.union(v.literal("GHL"), v.literal("Telegram"), v.literal("Gmail"), v.literal("System")),
    externalEventId: v.string(),
    eventType: v.string(),
    entityType: v.optional(v.union(v.literal("prospect"), v.literal("matter"))),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing event with same source + externalEventId
    const existing = await ctx.db
      .query("ingestedEvents")
      .withIndex("by_source_event", (q) =>
        q.eq("source", args.source).eq("externalEventId", args.externalEventId)
      )
      .first();

    if (existing) {
      // Log as duplicate, don't reprocess
      if (existing.status !== "IGNORED_DUPLICATE") {
        // First duplicate detection — mark it
        await ctx.db.insert("ingestedEvents", {
          source: args.source,
          externalEventId: args.externalEventId,
          eventType: args.eventType,
          entityType: args.entityType,
          entityId: args.entityId,
          receivedAt: Date.now(),
          status: "IGNORED_DUPLICATE",
        });
      }
      return { isDuplicate: true };
    }

    const docId = await ctx.db.insert("ingestedEvents", {
      source: args.source,
      externalEventId: args.externalEventId,
      eventType: args.eventType,
      entityType: args.entityType,
      entityId: args.entityId,
      receivedAt: Date.now(),
      status: "RECEIVED",
    });

    return { isDuplicate: false, eventDocId: docId };
  },
});

/**
 * markProcessed — call after successful processing.
 */
export const markProcessed = mutation({
  args: { eventDocId: v.id("ingestedEvents") },
  handler: async (ctx, { eventDocId }) => {
    await ctx.db.patch(eventDocId, {
      processedAt: Date.now(),
      status: "PROCESSED",
    });
  },
});

/**
 * markFailed — call on processing failure.
 */
export const markFailed = mutation({
  args: {
    eventDocId: v.id("ingestedEvents"),
    error: v.string(),
  },
  handler: async (ctx, { eventDocId, error }) => {
    await ctx.db.patch(eventDocId, {
      status: "FAILED",
      error,
    });
  },
});
