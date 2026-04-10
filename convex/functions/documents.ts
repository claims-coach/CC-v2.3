// ============================================================
// functions/documents.ts — Document registry
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const registerDocument = mutation({
  args: {
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
    documentType: v.string(),
    fileName: v.string(),
    storagePath: v.string(),
    mimeType: v.string(),
    checksum: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("documents", { ...args, createdAt: Date.now() });
  },
});

export const listByEntity = query({
  args: {
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
  },
  handler: async (ctx, { entityType, entityId }) =>
    ctx.db.query("documents").withIndex("by_entity", (q) =>
      q.eq("entityType", entityType).eq("entityId", entityId)
    ).collect(),
});
