// ============================================================
// functions/emails.ts — Email capture + T&E extraction
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const captureEmail = mutation({
  args: {
    matterId: v.string(),
    externalMessageId: v.string(),
    threadId: v.optional(v.string()),
    sender: v.string(),
    recipients: v.array(v.string()),
    subject: v.string(),
    receivedAt: v.number(),
    bodyText: v.string(), // used to detect [T&E]
    pdfStoragePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotency: check if already captured
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_externalMessageId", (q) => q.eq("externalMessageId", args.externalMessageId))
      .first();
    if (existing) return { _id: existing._id, duplicate: true };

    const containsTnE = args.bodyText.includes("[T&E]") || args.subject.includes("[T&E]");
    const now = Date.now();

    const docId = await ctx.db.insert("emails", {
      matterId: args.matterId,
      externalMessageId: args.externalMessageId,
      threadId: args.threadId,
      sender: args.sender,
      recipients: args.recipients,
      subject: args.subject,
      receivedAt: args.receivedAt,
      containsTimeAndExpenseFlag: containsTnE,
      pdfStoragePath: args.pdfStoragePath,
      createdAt: now,
    });

    // If T&E detected, enqueue extraction job
    if (containsTnE) {
      await ctx.db.insert("jobs", {
        jobType: "email.extractTimeAndExpense",
        parentType: "matter",
        parentId: args.matterId,
        status: "QUEUED",
        priority: "P1",
        attempts: 0,
        maxAttempts: 3,
        payloadJson: JSON.stringify({
          emailDocId: docId,
          matterId: args.matterId,
          subject: args.subject,
        }),
        scheduledAt: now,
      });
    }

    return { _id: docId, duplicate: false, containsTnE };
  },
});

export const listByMatter = query({
  args: { matterId: v.string() },
  handler: async (ctx, { matterId }) =>
    ctx.db.query("emails").withIndex("by_matterId", (q) => q.eq("matterId", matterId)).collect(),
});
