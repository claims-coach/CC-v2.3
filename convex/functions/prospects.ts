// ============================================================
// functions/prospects.ts — Prospect lifecycle
// ============================================================

import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  normalizeCarrier,
  normalizePhone,
  normalizeEmail,
  buildProspectId,
  defaultIntegrationStatus,
  validateProspectTransition,
  deriveProspectStatus,
  toDateStr,
} from "../lib/transitions";

// ---- Input validator (shared shape) ----
const prospectInput = {
  firstName: v.string(),
  lastName: v.string(),
  phoneRaw: v.string(),
  emailRaw: v.string(),
  vehicleYear: v.number(),
  vehicleMake: v.string(),
  vehicleModel: v.string(),
  vehicleTrim: v.optional(v.string()),
  vehicleVin: v.optional(v.string()),
  vehicleMileage: v.optional(v.number()),
  carrierDisplayName: v.string(),
  claimNumber: v.optional(v.string()),
  insurerAcvOffer: v.optional(v.number()),
  clientTargetValue: v.optional(v.number()),
  callDateTime: v.optional(v.number()),
  ghlContactId: v.optional(v.string()),
  cccPdfPresent: v.optional(v.boolean()),
  source: v.string(), // "GHL", "Telegram", "Manual"
};

/**
 * createProspect — Stage 0 canonical write.
 *
 * 1. Assigns prospect ID atomically
 * 2. Writes canonical prospect record
 * 3. Emits workflow event
 * 4. Writes activity log entry
 * 5. Enqueues side-effect jobs (GDrive folder, registry sync, Telegram notify)
 *
 * Returns: { prospectId, _id }
 */
export const createProspect = mutation({
  args: prospectInput,
  handler: async (ctx, args) => {
    const now = Date.now();
    const year = new Date().getFullYear();
    const carrierNorm = normalizeCarrier(args.carrierDisplayName);

    // ---- Atomic sequence ----
    const yy = String(year).slice(-2);
    const seqName = `prospectSeq_${yy}`;
    let seqRow = await ctx.db
      .query("sequenceCounters")
      .withIndex("by_name", (q) => q.eq("name", seqName))
      .unique();

    let seq: number;
    if (!seqRow) {
      seq = 1;
      await ctx.db.insert("sequenceCounters", { name: seqName, currentValue: 1 });
    } else {
      seq = seqRow.currentValue + 1;
      await ctx.db.patch(seqRow._id, { currentValue: seq });
    }

    const prospectId = buildProspectId({
      year,
      seq,
      lastName: args.lastName,
      carrier: carrierNorm,
    });

    // ---- Canonical record ----
    const docId = await ctx.db.insert("prospects", {
      prospectId,
      year,
      prospectSeq: seq,
      firstName: args.firstName,
      lastName: args.lastName,
      phoneRaw: args.phoneRaw,
      phoneNormalized: normalizePhone(args.phoneRaw),
      emailRaw: args.emailRaw,
      emailNormalized: normalizeEmail(args.emailRaw),
      vehicleYear: args.vehicleYear,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleTrim: args.vehicleTrim,
      vehicleVin: args.vehicleVin,
      vehicleMileage: args.vehicleMileage,
      carrierDisplayName: args.carrierDisplayName,
      carrierNormalized: carrierNorm,
      claimNumber: args.claimNumber,
      insurerAcvOffer: args.insurerAcvOffer,
      clientTargetValue: args.clientTargetValue,
      callDateTime: args.callDateTime,
      stage: "INTAKE_CREATED",
      status: "PROSPECT",
      eligibilityFlag: undefined,
      cccPdfParsed: false,
      cccExtractJsonPath: undefined,
      plodSummaryInjected: false,
      prelimAcv: undefined,
      compCount: undefined,
      compResearchComplete: false,
      integrationStatus: defaultIntegrationStatus(),
      sourceOfTruthVersion: 1,
      ghlContactId: args.ghlContactId,
      createdBy: "CC",
      updatedBy: "CC",
      updateSource: args.source,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    // ---- Workflow event ----
    await ctx.db.insert("workflowEvents", {
      eventType: "prospect.created",
      entityType: "prospect",
      entityId: prospectId,
      payloadJson: JSON.stringify({
        lastName: args.lastName,
        carrier: carrierNorm,
        vehicleYear: args.vehicleYear,
        vehicleMake: args.vehicleMake,
        vehicleModel: args.vehicleModel,
        cccPdfPresent: args.cccPdfPresent ?? false,
      }),
      createdAt: now,
    });

    // ---- Activity log ----
    await ctx.db.insert("activityLog", {
      entityType: "prospect",
      entityId: prospectId,
      date: toDateStr(now),
      action: "Prospect created from intake",
      party: "CC",
      summary: `New prospect ${prospectId}. ${args.vehicleYear} ${args.vehicleMake} ${args.vehicleModel}. Carrier: ${args.carrierDisplayName}. CCC PDF: ${args.cccPdfPresent ? "received" : "not received"}.`,
      visibleToOperator: true,
      createdAt: now,
    });

    // ---- Enqueue side-effect jobs ----
    const jobDefaults = {
      parentType: "prospect" as const,
      parentId: prospectId,
      status: "QUEUED" as const,
      priority: "P0" as const,
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: now,
    };

    await ctx.db.insert("jobs", {
      ...jobDefaults,
      jobType: "gdrive.createProspectFolder",
      payloadJson: JSON.stringify({ prospectId }),
    });

    await ctx.db.insert("jobs", {
      ...jobDefaults,
      jobType: "registry.syncProspect",
      priority: "P1",
      payloadJson: JSON.stringify({ prospectId }),
    });

    await ctx.db.insert("jobs", {
      ...jobDefaults,
      jobType: "telegram.notifyNewProspect",
      payloadJson: JSON.stringify({ prospectId }),
    });

    if (args.cccPdfPresent) {
      await ctx.db.insert("jobs", {
        ...jobDefaults,
        jobType: "ccc.parsePdf",
        payloadJson: JSON.stringify({ prospectId }),
      });
    }

    return { prospectId, _id: docId };
  },
});

/**
 * transitionProspectStage — guarded stage change with event + log.
 */
export const transitionProspectStage = mutation({
  args: {
    prospectId: v.string(),
    toStage: v.string(),
    reason: v.optional(v.string()),
    actor: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", args.prospectId))
      .unique();

    if (!prospect) throw new Error(`Prospect not found: ${args.prospectId}`);

    const check = validateProspectTransition(prospect.stage, args.toStage);
    if (!check.valid) {
      // Log the rejected transition
      const now = Date.now();
      await ctx.db.insert("workflowEvents", {
        eventType: "prospect.transitionRejected",
        entityType: "prospect",
        entityId: args.prospectId,
        payloadJson: JSON.stringify({
          from: prospect.stage,
          to: args.toStage,
          reason: check.reason,
        }),
        createdAt: now,
      });
      throw new Error(check.reason);
    }

    const now = Date.now();
    const newStatus = deriveProspectStatus(args.toStage);
    const actor = args.actor ?? "CC";

    await ctx.db.patch(prospect._id, {
      stage: args.toStage as any,
      status: newStatus as any,
      updatedBy: actor,
      updateSource: args.source ?? "System",
      revision: prospect.revision + 1,
      updatedAt: now,
    });

    await ctx.db.insert("workflowEvents", {
      eventType: "prospect.stageChanged",
      entityType: "prospect",
      entityId: args.prospectId,
      payloadJson: JSON.stringify({
        from: prospect.stage,
        to: args.toStage,
        reason: args.reason,
      }),
      createdAt: now,
    });

    await ctx.db.insert("activityLog", {
      entityType: "prospect",
      entityId: args.prospectId,
      date: toDateStr(now),
      action: `Stage: ${prospect.stage} → ${args.toStage}`,
      party: actor as any,
      summary: args.reason ?? `Stage transitioned to ${args.toStage}.`,
      visibleToOperator: true,
      createdAt: now,
    });

    return { ok: true, newStage: args.toStage, newStatus: newStatus };
  },
});

/**
 * updateProspectResearch — called after comp research completes.
 */
export const updateProspectResearch = mutation({
  args: {
    prospectId: v.string(),
    prelimAcv: v.number(),
    compCount: v.number(),
    compResearchComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", args.prospectId))
      .unique();
    if (!prospect) throw new Error(`Prospect not found: ${args.prospectId}`);

    const now = Date.now();
    await ctx.db.patch(prospect._id, {
      prelimAcv: args.prelimAcv,
      compCount: args.compCount,
      compResearchComplete: args.compResearchComplete,
      revision: prospect.revision + 1,
      updatedAt: now,
      updatedBy: "CC",
      updateSource: "CompResearch",
    });
  },
});

/**
 * setEligibility — post-call qualification decision.
 */
export const setEligibility = mutation({
  args: {
    prospectId: v.string(),
    flag: v.union(v.literal("QUALIFIES"), v.literal("DOES_NOT_QUALIFY"), v.literal("NEEDS_REVIEW")),
  },
  handler: async (ctx, { prospectId, flag }) => {
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", prospectId))
      .unique();
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const now = Date.now();
    await ctx.db.patch(prospect._id, {
      eligibilityFlag: flag,
      revision: prospect.revision + 1,
      updatedAt: now,
      updatedBy: "CC",
      updateSource: "EligibilityCheck",
    });
  },
});

// ---- Queries ----

export const getByProspectId = query({
  args: { prospectId: v.string() },
  handler: async (ctx, { prospectId }) => {
    return ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", prospectId))
      .unique();
  },
});

export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    return ctx.db
      .query("prospects")
      .withIndex("by_status", (q) => q.eq("status", status as any))
      .collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("prospects")
      .withIndex("by_status", (q) => q.eq("status", "PROSPECT"))
      .collect();
  },
});
