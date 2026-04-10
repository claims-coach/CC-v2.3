import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const save = mutation({
  args: {
    claimId:   v.string(),
    section:   v.string(),
    fileName:  v.string(),
    mimeType:  v.string(),
    storageId: v.string(),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("caseAttachments", { ...args, uploadedAt: Date.now() });
  },
});

export const listByClaim = query({
  args: { claimId: v.string() },
  handler: async (ctx, { claimId }) => {
    const rows = await ctx.db.query("caseAttachments").withIndex("by_claim", q => q.eq("claimId", claimId)).collect();
    return Promise.all(rows.map(async r => {
      let url: string | null = null;
      try { url = await ctx.storage.getUrl(r.storageId); } catch { url = null; }
      return { ...r, url };
    }));
  },
});

export const remove = mutation({
  args: { id: v.id("caseAttachments") },
  handler: async (ctx, { id }) => {
    const rec = await ctx.db.get(id);
    if (rec) await ctx.storage.delete(rec.storageId);
    await ctx.db.delete(id);
  },
});

export const getStorageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    try { return await ctx.storage.getUrl(storageId); } catch { return null; }
  },
});
