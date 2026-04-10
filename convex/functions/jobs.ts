// ============================================================
// functions/jobs.ts — Retry-safe side-effect execution
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * claimNextJob — atomically claims the oldest QUEUED job of a given type.
 * Returns null if no jobs available.
 */
export const claimNextJob = mutation({
  args: { jobType: v.string() },
  handler: async (ctx, { jobType }) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_jobType", (q) => q.eq("jobType", jobType))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "QUEUED"), q.eq(q.field("status"), "RETRYING"))
      )
      .first();

    if (!job) return null;

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "RUNNING",
      startedAt: now,
      attempts: job.attempts + 1,
    });

    return { ...job, status: "RUNNING" as const, startedAt: now, attempts: job.attempts + 1 };
  },
});

/**
 * completeJob — mark job succeeded.
 */
export const completeJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, {
      status: "SUCCEEDED",
      completedAt: Date.now(),
    });
  },
});

/**
 * failJob — record error, schedule retry if under maxAttempts.
 */
export const failJob = mutation({
  args: {
    jobId: v.id("jobs"),
    error: v.string(),
  },
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const exhausted = job.attempts >= job.maxAttempts;
    await ctx.db.patch(jobId, {
      status: exhausted ? "FAILED" : "RETRYING",
      lastError: error,
      completedAt: exhausted ? Date.now() : undefined,
      // Exponential backoff: retry in 2^attempts * 5 seconds
      scheduledAt: exhausted ? job.scheduledAt : Date.now() + Math.pow(2, job.attempts) * 5000,
    });

    // If exhausted, emit a workflow event for operator escalation
    if (exhausted) {
      await ctx.db.insert("workflowEvents", {
        eventType: "job.exhausted",
        entityType: job.parentType,
        entityId: job.parentId,
        payloadJson: JSON.stringify({
          jobType: job.jobType,
          attempts: job.attempts,
          lastError: error,
        }),
        createdAt: Date.now(),
      });
    }

    return { exhausted };
  },
});

/**
 * enqueueJob — create a new job.
 */
export const enqueueJob = mutation({
  args: {
    jobType: v.string(),
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    priority: v.union(v.literal("P0"), v.literal("P1"), v.literal("P2")),
    payloadJson: v.string(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("jobs", {
      jobType: args.jobType,
      parentType: args.parentType,
      parentId: args.parentId,
      status: "QUEUED",
      priority: args.priority,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? 3,
      payloadJson: args.payloadJson,
      scheduledAt: Date.now(),
    });
  },
});

// ---- Queries ----

export const listByParent = query({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
  },
  handler: async (ctx, { parentType, parentId }) =>
    ctx.db.query("jobs").withIndex("by_parent", (q) =>
      q.eq("parentType", parentType).eq("parentId", parentId)
    ).collect(),
});

export const listFailed = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", "FAILED")).collect(),
});

export const listQueued = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("jobs").withIndex("by_status", (q) => q.eq("status", "QUEUED")).collect(),
});
