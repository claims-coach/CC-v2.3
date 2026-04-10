// ============================================================
// functions/jobDispatcher.ts — Cron-driven job processor
//
// Deploy as a Convex cron job running every 10 seconds.
// Claims jobs by type and dispatches to the appropriate worker action.
// ============================================================

import { cronJobs } from "convex/server";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// ---- The main dispatch loop ----
export const processJobQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    // Process each job type in priority order
    const jobTypes = [
      // P0 — blocking
      "gdrive.createProspectFolder",
      "gdrive.createMatterFolder",
      "gdrive.archiveMatterFolder",
      "telegram.notifyNewProspect",
      "telegram.notifyMatterActive",
      "ccc.parsePdf",
      // P1 — important
      "registry.syncProspect",
      "registry.activateMatter",
      "registry.closeMatter",
      "workbench.renameForMatter",
      "ghl.tagOutcome",
      "email.extractTimeAndExpense",
      // P2 — deferred
      "gdrive.syncActivityLog",
      "ghl.triggerTestimonialSequence",
    ];

    for (const jobType of jobTypes) {
      // Claim up to 3 jobs per type per cycle
      for (let i = 0; i < 3; i++) {
        const job = await ctx.runMutation(internal.functions.jobDispatcher.claimJob, { jobType });
        if (!job) break;

        try {
          await ctx.runAction(internal.functions.workers.executeJob, {
            jobId: job._id,
            jobType: job.jobType,
            parentType: job.parentType,
            parentId: job.parentId,
            payloadJson: job.payloadJson,
          });
        } catch (err: any) {
          // Worker threw — failJob handles retry logic
          await ctx.runMutation(internal.functions.jobDispatcher.failJobMutation, {
            jobId: job._id,
            error: err.message || "Worker threw unhandled error",
          });
        }
      }
    }
  },
});

// ---- Internal mutation wrappers (actions can't query DB directly) ----

export const claimJob = internalMutation({
  args: { jobType: v.string() },
  handler: async (ctx, { jobType }) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_jobType", (q) => q.eq("jobType", jobType))
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "QUEUED"),
            q.eq(q.field("status"), "RETRYING")
          ),
          q.lte(q.field("scheduledAt"), Date.now())
        )
      )
      .first();

    if (!job) return null;

    await ctx.db.patch(job._id, {
      status: "RUNNING",
      startedAt: Date.now(),
      attempts: job.attempts + 1,
    });

    return { ...job, status: "RUNNING" as const, attempts: job.attempts + 1 };
  },
});

export const completeJobMutation = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, { status: "SUCCEEDED", completedAt: Date.now() });
  },
});

export const failJobMutation = internalMutation({
  args: { jobId: v.id("jobs"), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    const exhausted = job.attempts >= job.maxAttempts;
    await ctx.db.patch(jobId, {
      status: exhausted ? "FAILED" : "RETRYING",
      lastError: error,
      completedAt: exhausted ? Date.now() : undefined,
      scheduledAt: exhausted
        ? job.scheduledAt
        : Date.now() + Math.pow(2, job.attempts) * 5000,
    });

    if (exhausted) {
      // Escalation event
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

      // Enqueue Telegram escalation
      await ctx.db.insert("jobs", {
        jobType: "telegram.escalateFailure",
        parentType: job.parentType,
        parentId: job.parentId,
        status: "QUEUED",
        priority: "P0",
        attempts: 0,
        maxAttempts: 3,
        payloadJson: JSON.stringify({
          failedJobType: job.jobType,
          error,
          entityId: job.parentId,
        }),
        scheduledAt: Date.now(),
      });
    }
  },
});

// ---- Update integration status on parent entity ----
export const updateIntegrationStatus = internalMutation({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    integration: v.string(), // "gdrive" | "registry" | "workbench" | "telegram"
    status: v.union(v.literal("PENDING"), v.literal("SYNCED"), v.literal("FAILED"), v.literal("SENT")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const table = args.parentType === "prospect" ? "prospects" : "matters";
    const indexName = args.parentType === "prospect" ? "by_prospectId" : "by_matterId";
    const idField = args.parentType === "prospect" ? "prospectId" : "matterId";

    const entity = await ctx.db
      .query(table)
      .withIndex(indexName, (q) => q.eq(idField, args.parentId))
      .unique();

    if (!entity) return;

    const newIntStatus = { ...entity.integrationStatus };
    (newIntStatus as any)[args.integration] = args.status;

    const patches: Record<string, any> = {
      integrationStatus: newIntStatus,
      lastSyncAttemptAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (args.error) patches.lastSyncError = args.error;

    await ctx.db.patch(entity._id, patches);
  },
});
