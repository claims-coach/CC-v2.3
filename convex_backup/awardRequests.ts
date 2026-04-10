import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    claimId:          v.optional(v.string()),
    claimNumber:      v.optional(v.string()),
    ownerName:        v.optional(v.string()),
    carrier:          v.optional(v.string()),
    vehicle:          v.optional(v.string()),
    vin:              v.optional(v.string()),
    acvAward:         v.number(),
    insuredAppraiser: v.optional(v.string()),
    insurerAppraiser: v.optional(v.string()),
    umpire:           v.optional(v.string()),
    dateOfLoss:       v.optional(v.string()),
    awardDate:        v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return ctx.db.insert("awardRequests", { ...args, status: "pending", sigPageToken: token });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) =>
    ctx.db.query("awardRequests").withIndex("by_token", q => q.eq("sigPageToken", token)).first(),
});

export const get = query({
  args: { id: v.id("awardRequests") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const recordSignature = mutation({
  args: { id: v.id("awardRequests"), signer: v.string(), date: v.string() },
  handler: async (ctx, { id, signer, date }) => {
    const record = await ctx.db.get(id);
    if (!record) throw new Error("Award not found");
    const patch: Record<string, string> = {};
    if (signer === "insurer") patch.insurerSigDate = date;
    if (signer === "umpire")  patch.umpireSigDate  = date;
    if (signer === "insured") patch.insuredSigDate = date;
    // Update status
    const updated = { ...record, ...patch };
    if (updated.insurerSigDate) {
      patch.status = updated.umpireSigDate ? "complete" : "insurer_signed";
    }
    await ctx.db.patch(id, patch);
  },
});

export const listByClaim = query({
  args: { claimId: v.string() },
  handler: async (ctx, { claimId }) =>
    ctx.db.query("awardRequests").withIndex("by_claim", q => q.eq("claimId", claimId)).order("desc").collect(),
});
