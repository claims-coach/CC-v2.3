import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// CC Claims.Coach — Convex Backend Schema
// Version: 2.3
// Date: 2026-04-09
// ============================================================

const integrationStatus = v.object({
  gdrive: v.union(v.literal("PENDING"), v.literal("SYNCED"), v.literal("FAILED")),
  registry: v.union(v.literal("PENDING"), v.literal("SYNCED"), v.literal("FAILED")),
  workbench: v.union(v.literal("PENDING"), v.literal("SYNCED"), v.literal("FAILED")),
  telegram: v.union(v.literal("PENDING"), v.literal("SENT"), v.literal("FAILED")),
});

export default defineSchema({
  prospects: defineTable({
    prospectId: v.string(),
    year: v.number(),
    prospectSeq: v.number(),
    firstName: v.string(),
    lastName: v.string(),
    phoneRaw: v.string(),
    phoneNormalized: v.optional(v.string()),
    emailRaw: v.string(),
    emailNormalized: v.optional(v.string()),
    vehicleYear: v.number(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleTrim: v.optional(v.string()),
    vehicleVin: v.optional(v.string()),
    vehicleMileage: v.optional(v.number()),
    carrierDisplayName: v.string(),
    carrierNormalized: v.string(),
    claimNumber: v.optional(v.string()),
    insurerAcvOffer: v.optional(v.number()),
    clientTargetValue: v.optional(v.number()),
    callDateTime: v.optional(v.number()),
    stage: v.union(
      v.literal("INTAKE_CREATED"),
      v.literal("RESEARCH_RUNNING"),
      v.literal("RESEARCH_COMPLETE"),
      v.literal("CALL_COMPLETE"),
      v.literal("QUALIFIED"),
      v.literal("NEEDS_REVIEW"),
      v.literal("CLOSED_NQ"),
      v.literal("CLOSED_LOST"),
      v.literal("CONVERTED"),
    ),
    status: v.union(
      v.literal("PROSPECT"),
      v.literal("QUALIFIED"),
      v.literal("NEEDS_REVIEW"),
      v.literal("CONVERTED"),
      v.literal("CLOSED_NQ"),
      v.literal("CLOSED_LOST"),
    ),
    eligibilityFlag: v.optional(v.union(
      v.literal("QUALIFIES"),
      v.literal("DOES_NOT_QUALIFY"),
      v.literal("NEEDS_REVIEW"),
    )),
    cccPdfParsed: v.boolean(),
    cccExtractJsonPath: v.optional(v.string()),
    plodSummaryInjected: v.boolean(),
    prelimAcv: v.optional(v.number()),
    compCount: v.optional(v.number()),
    compResearchComplete: v.boolean(),
    integrationStatus,
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    sourceOfTruthVersion: v.number(),
    ghlContactId: v.optional(v.string()),
    convertedToMatterId: v.optional(v.string()),
    createdBy: v.string(),
    updatedBy: v.string(),
    updateSource: v.string(),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_prospectId", ["prospectId"])
    .index("by_year_seq", ["year", "prospectSeq"])
    .index("by_status", ["status"])
    .index("by_lastName", ["lastName"])
    .index("by_carrier", ["carrierNormalized"]),

  matters: defineTable({
    matterId: v.string(),
    masterCaseId: v.number(),
    masterCaseIdFormatted: v.string(),
    prospectId: v.optional(v.string()),
    year: v.number(),
    division: v.union(v.literal("AUTO"), v.literal("PROP")),
    role: v.union(
      v.literal("DV"), v.literal("AC"), v.literal("UMP"),
      v.literal("EXP"), v.literal("CON"), v.literal("LIT"), v.literal("OTH"),
    ),
    roleOthDescription: v.optional(v.string()),
    firstName: v.string(),
    lastName: v.string(),
    phoneNormalized: v.optional(v.string()),
    emailNormalized: v.optional(v.string()),
    vehicleYear: v.number(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleTrim: v.optional(v.string()),
    vehicleVin: v.optional(v.string()),
    vehicleMileage: v.optional(v.number()),
    carrierDisplayName: v.string(),
    carrierNormalized: v.string(),
    claimNumber: v.optional(v.string()),
    insurerAcvOffer: v.optional(v.number()),
    clientTargetValue: v.optional(v.number()),
    appraiserOpinion: v.optional(v.number()),
    recoveryAmount: v.optional(v.number()),
    neutral: v.boolean(),
    advocacy: v.boolean(),
    stage: v.union(
      v.literal("ACTIVE"), v.literal("REPORT_GENERATING"),
      v.literal("REPORT_READY"), v.literal("SUBMITTED"),
      v.literal("AWAITING_RESPONSE"), v.literal("CLOSED"),
    ),
    status: v.union(
      v.literal("ACTIVE"), v.literal("CLOSED_SETTLED"),
      v.literal("CLOSED_AWARDED"), v.literal("CLOSED_WITHDRAWN"),
      v.literal("CLOSED_OTHER"), v.literal("VOIDED"),
    ),
    gdriveFolderUrl: v.optional(v.string()),
    caseActivityLogPath: v.optional(v.string()),
    acvWorkbenchUrl: v.optional(v.string()),
    reportBundleUrl: v.optional(v.string()),
    integrationStatus,
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    sourceOfTruthVersion: v.number(),
    conflictCheckComplete: v.optional(v.boolean()),
    activatedAt: v.number(),
    reportGeneratedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    responseDeadline: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    ghlContactId: v.optional(v.string()),
    ghlOutcomeTag: v.optional(v.string()),
    createdBy: v.string(),
    updatedBy: v.string(),
    updateSource: v.string(),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_matterId", ["matterId"])
    .index("by_masterCaseId", ["masterCaseId"])
    .index("by_status", ["status"])
    .index("by_stage", ["stage"])
    .index("by_lastName", ["lastName"])
    .index("by_carrier", ["carrierNormalized"]),

  comparables: defineTable({
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    compNumber: v.number(),
    listingUrl: v.string(),
    sourceName: v.string(),
    askingPrice: v.number(),
    mileage: v.number(),
    vin: v.string(),
    vehicleYear: v.number(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleTrim: v.string(),
    dealerName: v.string(),
    dealerCity: v.string(),
    dealerState: v.string(),
    distanceMiles: v.number(),
    mileageAdjustmentRate: v.number(),
    mileageAdjustmentAmount: v.number(),
    adjustedValue: v.number(),
    listingVerifiedLiveAt: v.number(),
    pdfPath: v.optional(v.string()),
    isValid: v.boolean(),
    invalidReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_parent", ["parentType", "parentId"])
    .index("by_vin", ["vin"])
    .index("by_parent_compNumber", ["parentType", "parentId", "compNumber"]),

  workflowEvents: defineTable({
    eventType: v.string(),
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
    causationId: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    payloadJson: v.string(),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_eventType", ["eventType"]),

  activityLog: defineTable({
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
    date: v.string(),
    action: v.string(),
    party: v.union(
      v.literal("CC"), v.literal("Johnny Walker"),
      v.literal("Client"), v.literal("Insurer"),
      v.literal("System"), v.literal("Other"),
    ),
    summary: v.string(),
    visibleToOperator: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_date", ["date"]),

  documents: defineTable({
    entityType: v.union(v.literal("prospect"), v.literal("matter")),
    entityId: v.string(),
    documentType: v.optional(v.string()),
    fileName: v.string(),
    storagePath: v.string(),
    mimeType: v.string(),
    checksum: v.optional(v.string()),
    source: v.string(),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_documentType", ["documentType"]),

  emails: defineTable({
    matterId: v.string(),
    externalMessageId: v.string(),
    threadId: v.optional(v.string()),
    sender: v.string(),
    recipients: v.array(v.string()),
    subject: v.string(),
    receivedAt: v.number(),
    containsTimeAndExpenseFlag: v.boolean(),
    pdfStoragePath: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_matterId", ["matterId"])
    .index("by_externalMessageId", ["externalMessageId"]),

  commands: defineTable({
    source: v.union(v.literal("Telegram"), v.literal("System")),
    rawText: v.string(),
    commandName: v.string(),
    parsedArgsJson: v.string(),
    entityType: v.optional(v.union(v.literal("prospect"), v.literal("matter"))),
    entityId: v.optional(v.string()),
    status: v.union(
      v.literal("RECEIVED"), v.literal("PARSED"),
      v.literal("EXECUTED"), v.literal("FAILED"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_commandName", ["commandName"]),

  ingestedEvents: defineTable({
    source: v.union(
      v.literal("GHL"), v.literal("Telegram"),
      v.literal("Gmail"), v.literal("System"),
    ),
    externalEventId: v.string(),
    eventType: v.string(),
    entityType: v.optional(v.union(v.literal("prospect"), v.literal("matter"))),
    entityId: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    status: v.union(
      v.literal("RECEIVED"), v.literal("PROCESSED"),
      v.literal("FAILED"), v.literal("IGNORED_DUPLICATE"),
    ),
    error: v.optional(v.string()),
  })
    .index("by_source_event", ["source", "externalEventId"])
    .index("by_status", ["status"]),

  jobs: defineTable({
    jobType: v.string(),
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    status: v.union(
      v.literal("QUEUED"), v.literal("RUNNING"),
      v.literal("SUCCEEDED"), v.literal("FAILED"), v.literal("RETRYING"),
    ),
    priority: v.union(v.literal("P0"), v.literal("P1"), v.literal("P2")),
    attempts: v.number(),
    maxAttempts: v.number(),
    payloadJson: v.string(),
    lastError: v.optional(v.string()),
    scheduledAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_parent", ["parentType", "parentId"])
    .index("by_status", ["status"])
    .index("by_jobType", ["jobType"]),

  sequenceCounters: defineTable({
    name: v.string(),
    currentValue: v.number(),
  }).index("by_name", ["name"]),

  timeAndExpense: defineTable({
    matterId: v.string(),
    vendor: v.string(),
    amount: v.number(),
    description: v.string(),
    sourceEmailPath: v.string(),
    date: v.string(),
    createdAt: v.number(),
  }).index("by_matterId", ["matterId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.string(),
    assignee: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_status", ["status"]),
});
// v2.3 production cutover complete
