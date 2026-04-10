// ============================================================
// functions/matters.ts — Matter lifecycle
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  formatMasterCaseId,
  buildMatterId,
  defaultIntegrationStatus,
  validateMatterTransition,
  validateRole,
  toDateStr,
} from "../lib/transitions";

/**
 * activateMatter — converts a QUALIFIED prospect into a matter.
 *
 * Hard-stop validations (rejects if any fail):
 *  1. Prospect must exist and be in QUALIFIED stage
 *  2. Role must be valid; OTH requires description
 *  3. Division must be AUTO or PROP
 *
 * Atomic operations:
 *  1. Increment masterCaseId counter
 *  2. Create matter record
 *  3. Mark prospect as CONVERTED
 *  4. Emit workflow events + activity log
 *  5. Enqueue GDrive, registry, Telegram jobs
 */
export const activateMatter = mutation({
  args: {
    prospectId: v.string(),
    division: v.union(v.literal("AUTO"), v.literal("PROP")),
    role: v.string(),
    roleOthDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ---- Validate prospect ----
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", args.prospectId))
      .unique();

    if (!prospect) {
      throw new Error(`🔴 HARD STOP: Prospect not found: ${args.prospectId}`);
    }
    if (prospect.stage !== "QUALIFIED") {
      throw new Error(
        `🔴 HARD STOP: Prospect ${args.prospectId} is in stage ${prospect.stage}, must be QUALIFIED to activate.`
      );
    }

    // ---- Validate role ----
    const roleCheck = validateRole(args.role, args.roleOthDescription);
    if (!roleCheck.valid) {
      throw new Error(`🔴 HARD STOP: ${roleCheck.reason}`);
    }

    // ---- Assign MasterCaseID atomically ----
    let counterRow = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", "masterCaseId"))
      .unique();

    let masterCaseId: number;
    if (!counterRow) {
      masterCaseId = 150;
      await ctx.db.insert("sequenceCounters", { name: "masterCaseId", currentValue: 150 });
    } else {
      masterCaseId = counterRow.currentValue + 1;
      await ctx.db.patch(counterRow._id, { currentValue: masterCaseId });
    }

    const masterCaseIdFormatted = formatMasterCaseId(masterCaseId);
    const year = new Date().getFullYear();
    const carrierForId = prospect.carrierNormalized.replace(/_/g, "");
    const matterId = buildMatterId({
      masterCaseId,
      year,
      division: args.division,
      role: args.role,
      lastName: prospect.lastName,
      carrier: prospect.carrierDisplayName.replace(/\s+/g, ""),
    });

    // ---- Role-specific flags ----
    const isUmp = args.role === "UMP";
    const isExp = args.role === "EXP";

    // ---- Create matter record ----
    const matterDocId = await ctx.db.insert("matters", {
      matterId,
      masterCaseId,
      masterCaseIdFormatted,
      prospectId: args.prospectId,
      year,
      division: args.division,
      role: args.role as any,
      roleOthDescription: args.roleOthDescription,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      phoneNormalized: prospect.phoneNormalized,
      emailNormalized: prospect.emailNormalized,
      vehicleYear: prospect.vehicleYear,
      vehicleMake: prospect.vehicleMake,
      vehicleModel: prospect.vehicleModel,
      vehicleTrim: prospect.vehicleTrim,
      vehicleVin: prospect.vehicleVin,
      vehicleMileage: prospect.vehicleMileage,
      carrierDisplayName: prospect.carrierDisplayName,
      carrierNormalized: prospect.carrierNormalized,
      claimNumber: prospect.claimNumber,
      insurerAcvOffer: prospect.insurerAcvOffer,
      clientTargetValue: prospect.clientTargetValue,
      appraiserOpinion: undefined,
      recoveryAmount: undefined,
      neutral: isUmp,
      advocacy: !isUmp,
      stage: "ACTIVE",
      status: "ACTIVE",
      integrationStatus: defaultIntegrationStatus(),
      sourceOfTruthVersion: 1,
      conflictCheckComplete: isExp ? false : undefined,
      activatedAt: now,
      ghlContactId: prospect.ghlContactId,
      createdBy: "Johnny Walker",
      updatedBy: "CC",
      updateSource: "MatterActivation",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    // ---- Mark prospect CONVERTED ----
    await ctx.db.patch(prospect._id, {
      stage: "CONVERTED",
      status: "CONVERTED",
      convertedToMatterId: matterId,
      revision: prospect.revision + 1,
      updatedAt: now,
      updatedBy: "CC",
      updateSource: "MatterActivation",
    });

    // ---- Workflow events ----
    const correlationId = `activation_${matterId}_${now}`;

    await ctx.db.insert("workflowEvents", {
      eventType: "prospect.converted",
      entityType: "prospect",
      entityId: args.prospectId,
      correlationId,
      payloadJson: JSON.stringify({ matterId, masterCaseId }),
      createdAt: now,
    });

    await ctx.db.insert("workflowEvents", {
      eventType: "matter.activated",
      entityType: "matter",
      entityId: matterId,
      correlationId,
      payloadJson: JSON.stringify({
        prospectId: args.prospectId,
        role: args.role,
        division: args.division,
        neutral: isUmp,
      }),
      createdAt: now,
    });

    // ---- Activity log ----
    await ctx.db.insert("activityLog", {
      entityType: "matter",
      entityId: matterId,
      date: toDateStr(now),
      action: "Matter activated",
      party: "Johnny Walker",
      summary: `MatterID ${matterId} created. Role: ${args.role}. Agreement signed. Invoice paid.${isUmp ? " UMP: neutral=true, advocacy=false." : ""}${isExp ? " EXP: conflict check required before proceeding." : ""}`,
      visibleToOperator: true,
      createdAt: now,
    });

    // ---- Enqueue jobs ----
    const jobBase = {
      parentType: "matter" as const,
      parentId: matterId,
      status: "QUEUED" as const,
      priority: "P0" as const,
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: now,
    };

    // GDrive folder creation + doc migration
    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "gdrive.createMatterFolder",
      payloadJson: JSON.stringify({
        matterId,
        prospectId: args.prospectId,
        role: args.role,
        isExp,
      }),
    });

    // Registry sync
    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "registry.activateMatter",
      priority: "P1",
      payloadJson: JSON.stringify({ matterId, prospectId: args.prospectId }),
    });

    // Workbench rename
    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "workbench.renameForMatter",
      priority: "P1",
      payloadJson: JSON.stringify({ matterId, prospectId: args.prospectId }),
    });

    // Telegram notification
    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "telegram.notifyMatterActive",
      payloadJson: JSON.stringify({ matterId }),
    });

    return { matterId, masterCaseId, masterCaseIdFormatted, _id: matterDocId };
  },
});

/**
 * transitionMatterStage — guarded stage change.
 */
export const transitionMatterStage = mutation({
  args: {
    matterId: v.string(),
    toStage: v.string(),
    reason: v.optional(v.string()),
    actor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const matter = await ctx.db
      .query("matters")
      .withIndex("by_matterId", (q) => q.eq("matterId", args.matterId))
      .unique();

    if (!matter) throw new Error(`Matter not found: ${args.matterId}`);

    // EXP guard: cannot proceed past ACTIVE without conflict check
    if (
      matter.role === "EXP" &&
      args.toStage === "REPORT_GENERATING" &&
      !matter.conflictCheckComplete
    ) {
      throw new Error(
        `🔴 HARD STOP: EXP matter ${args.matterId} cannot generate report without completed conflict check.`
      );
    }

    const check = validateMatterTransition(matter.stage, args.toStage);
    if (!check.valid) {
      const now = Date.now();
      await ctx.db.insert("workflowEvents", {
        eventType: "matter.transitionRejected",
        entityType: "matter",
        entityId: args.matterId,
        payloadJson: JSON.stringify({
          from: matter.stage,
          to: args.toStage,
          reason: check.reason,
        }),
        createdAt: now,
      });
      throw new Error(check.reason);
    }

    const now = Date.now();
    const actor = args.actor ?? "CC";
    const patches: Record<string, any> = {
      stage: args.toStage,
      revision: matter.revision + 1,
      updatedAt: now,
      updatedBy: actor,
      updateSource: "StageTransition",
    };

    // Timestamp specific stages
    if (args.toStage === "REPORT_READY") patches.reportGeneratedAt = now;
    if (args.toStage === "SUBMITTED") patches.submittedAt = now;

    await ctx.db.patch(matter._id, patches);

    await ctx.db.insert("workflowEvents", {
      eventType: "matter.stageChanged",
      entityType: "matter",
      entityId: args.matterId,
      payloadJson: JSON.stringify({ from: matter.stage, to: args.toStage }),
      createdAt: now,
    });

    await ctx.db.insert("activityLog", {
      entityType: "matter",
      entityId: args.matterId,
      date: toDateStr(now),
      action: `Stage: ${matter.stage} → ${args.toStage}`,
      party: actor as any,
      summary: args.reason ?? `Stage transitioned to ${args.toStage}.`,
      visibleToOperator: true,
      createdAt: now,
    });

    return { ok: true };
  },
});

/**
 * closeMatter — terminal action.
 */
export const closeMatter = mutation({
  args: {
    matterId: v.string(),
    outcome: v.union(
      v.literal("CLOSED_SETTLED"),
      v.literal("CLOSED_AWARDED"),
      v.literal("CLOSED_WITHDRAWN"),
      v.literal("CLOSED_OTHER"),
    ),
    recoveryAmount: v.number(),
    ghlOutcomeTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const matter = await ctx.db
      .query("matters")
      .withIndex("by_matterId", (q) => q.eq("matterId", args.matterId))
      .unique();

    if (!matter) throw new Error(`Matter not found: ${args.matterId}`);
    if (matter.stage === "CLOSED") throw new Error(`Matter ${args.matterId} is already closed.`);

    const now = Date.now();
    const outcomeLabel = args.outcome.replace("CLOSED_", "");

    await ctx.db.patch(matter._id, {
      stage: "CLOSED",
      status: args.outcome,
      recoveryAmount: args.recoveryAmount,
      closedAt: now,
      ghlOutcomeTag: args.ghlOutcomeTag ?? outcomeLabel,
      revision: matter.revision + 1,
      updatedAt: now,
      updatedBy: "Johnny Walker",
      updateSource: "MatterClosure",
    });

    await ctx.db.insert("workflowEvents", {
      eventType: "matter.closed",
      entityType: "matter",
      entityId: args.matterId,
      payloadJson: JSON.stringify({
        outcome: args.outcome,
        recoveryAmount: args.recoveryAmount,
      }),
      createdAt: now,
    });

    await ctx.db.insert("activityLog", {
      entityType: "matter",
      entityId: args.matterId,
      date: toDateStr(now),
      action: "Matter closed",
      party: "Johnny Walker",
      summary: `Outcome: ${outcomeLabel}. Recovery: $${args.recoveryAmount.toLocaleString()}. Case archived.`,
      visibleToOperator: true,
      createdAt: now,
    });

    // Enqueue closure side effects
    const jobBase = {
      parentType: "matter" as const,
      parentId: args.matterId,
      status: "QUEUED" as const,
      priority: "P0" as const,
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: now,
    };

    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "gdrive.archiveMatterFolder",
      payloadJson: JSON.stringify({ matterId: args.matterId }),
    });

    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "registry.closeMatter",
      priority: "P1",
      payloadJson: JSON.stringify({ matterId: args.matterId, outcome: args.outcome }),
    });

    await ctx.db.insert("jobs", {
      ...jobBase,
      jobType: "ghl.tagOutcome",
      priority: "P1",
      payloadJson: JSON.stringify({
        matterId: args.matterId,
        ghlContactId: matter.ghlContactId,
        tag: outcomeLabel,
      }),
    });

    if (args.outcome === "CLOSED_SETTLED" || args.outcome === "CLOSED_AWARDED") {
      await ctx.db.insert("jobs", {
        ...jobBase,
        jobType: "ghl.triggerTestimonialSequence",
        priority: "P2",
        payloadJson: JSON.stringify({ matterId: args.matterId }),
      });
    }

    return { ok: true, outcome: args.outcome };
  },
});

/**
 * setAppraiserOpinion — updates the appraiser's value opinion on a matter.
 */
export const setAppraiserOpinion = mutation({
  args: {
    matterId: v.string(),
    appraiserOpinion: v.number(),
  },
  handler: async (ctx, { matterId, appraiserOpinion }) => {
    const matter = await ctx.db
      .query("matters")
      .withIndex("by_matterId", (q) => q.eq("matterId", matterId))
      .unique();
    if (!matter) throw new Error(`Matter not found: ${matterId}`);

    await ctx.db.patch(matter._id, {
      appraiserOpinion,
      revision: matter.revision + 1,
      updatedAt: Date.now(),
      updatedBy: "Johnny Walker",
      updateSource: "OpinionUpdate",
    });
  },
});

/**
 * completeConflictCheck — EXP role gate.
 */
export const completeConflictCheck = mutation({
  args: { matterId: v.string() },
  handler: async (ctx, { matterId }) => {
    const matter = await ctx.db
      .query("matters")
      .withIndex("by_matterId", (q) => q.eq("matterId", matterId))
      .unique();
    if (!matter) throw new Error(`Matter not found: ${matterId}`);
    if (matter.role !== "EXP") throw new Error(`Conflict check only applies to EXP matters.`);

    const now = Date.now();
    await ctx.db.patch(matter._id, {
      conflictCheckComplete: true,
      revision: matter.revision + 1,
      updatedAt: now,
      updatedBy: "Johnny Walker",
      updateSource: "ConflictCheck",
    });

    await ctx.db.insert("activityLog", {
      entityType: "matter",
      entityId: matterId,
      date: toDateStr(now),
      action: "Conflict check completed",
      party: "Johnny Walker",
      summary: "Conflict check cleared. Matter may proceed to report generation.",
      visibleToOperator: true,
      createdAt: now,
    });
  },
});

// ---- Queries ----

export const getByMatterId = query({
  args: { matterId: v.string() },
  handler: async (ctx, { matterId }) =>
    ctx.db.query("matters").withIndex("by_matterId", (q) => q.eq("matterId", matterId)).unique(),
});

export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) =>
    ctx.db.query("matters").withIndex("by_status", (q) => q.eq("status", status as any)).collect(),
});

export const listActive = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("matters").withIndex("by_status", (q) => q.eq("status", "ACTIVE")).collect(),
});

export const listByStage = query({
  args: { stage: v.string() },
  handler: async (ctx, { stage }) =>
    ctx.db.query("matters").withIndex("by_stage", (q) => q.eq("stage", stage as any)).collect(),
});
