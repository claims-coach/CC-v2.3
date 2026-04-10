#!/usr/bin/env node
/**
 * CC v2.2 → v2.3 Data Migration
 * ==============================
 * Runs locally on mc-prod. No Convex dependency — pure JSON transformation.
 *
 * Steps:
 *   1. You run: npx convex export --path v22_backup.zip
 *   2. You run: node migrate_offline.mjs v22_backup.zip v23_import.zip
 *   3. You run: npx convex deploy  (deploys v2.3 schema to empty DB)
 *   4. You run: npx convex import --replace v23_import.zip
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ============================================================
// TRANSFORM FUNCTIONS
// ============================================================

function normalizeCarrier(raw) {
  if (!raw) return "UNKNOWN";
  const aliases = {
    "state farm": "STATE_FARM", "statefarm": "STATE_FARM",
    "geico": "GEICO", "progressive": "PROGRESSIVE",
    "allstate": "ALLSTATE", "usaa": "USAA",
    "liberty mutual": "LIBERTY_MUTUAL", "nationwide": "NATIONWIDE",
    "farmers": "FARMERS", "pemco": "PEMCO", "safeco": "SAFECO",
    "american family": "AMERICAN_FAMILY", "amfam": "AMERICAN_FAMILY",
  };
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return aliases[key] ?? raw.trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizePhone(raw) {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

const PROSPECT_STAGE_MAP = {
  0: "INTAKE_CREATED",
  1: "RESEARCH_COMPLETE",
  2: "CALL_COMPLETE",
  3: "CLOSED_NQ",
};

const MATTER_STAGE_MAP = {
  3: "ACTIVE",
  4: "REPORT_READY",
  5: "SUBMITTED",
  6: "CLOSED",
};

const DEFAULT_INT_STATUS = {
  gdrive: "SYNCED",
  registry: "SYNCED",
  workbench: "SYNCED",
  telegram: "SENT",
};

function transformProspect(old) {
  const now = Date.now();
  const carrier = old.carrier ?? old.carrierDisplayName ?? "UNKNOWN";

  let stage = old.stage;
  if (typeof stage === "number") stage = PROSPECT_STAGE_MAP[stage] ?? "INTAKE_CREATED";
  if (!stage) stage = "INTAKE_CREATED";

  let status = old.status ?? "PROSPECT";
  const validStatuses = ["PROSPECT", "QUALIFIED", "NEEDS_REVIEW", "CONVERTED", "CLOSED_NQ", "CLOSED_LOST"];
  if (!validStatuses.includes(status)) status = "PROSPECT";

  return {
    prospectId: old.prospectId,
    year: typeof old.year === "string" ? parseInt(old.year, 10) : (old.year ?? 2026),
    prospectSeq: old.prospectSeq ?? 0,
    firstName: old.firstName ?? "",
    lastName: old.lastName ?? "",
    phoneRaw: old.phone ?? old.phoneRaw ?? "",
    phoneNormalized: old.phoneNormalized ?? normalizePhone(old.phone ?? old.phoneRaw),
    emailRaw: old.email ?? old.emailRaw ?? "",
    emailNormalized: old.emailNormalized || (old.email ?? old.emailRaw ?? "").trim().toLowerCase() || undefined,
    vehicleYear: typeof old.vehicleYear === "string" ? parseInt(old.vehicleYear, 10) : (old.vehicleYear ?? 0),
    vehicleMake: old.vehicleMake ?? "",
    vehicleModel: old.vehicleModel ?? "",
    vehicleTrim: old.vehicleTrim ?? undefined,
    vehicleVin: old.vehicleVin ?? undefined,
    vehicleMileage: old.vehicleMileage ?? undefined,
    carrierDisplayName: carrier,
    carrierNormalized: old.carrierNormalized ?? normalizeCarrier(carrier),
    claimNumber: old.claimNumber ?? undefined,
    insurerAcvOffer: old.insurerAcvOffer ?? undefined,
    clientTargetValue: old.clientTargetValue ?? undefined,
    callDateTime: typeof old.callDateTime === "string" ? new Date(old.callDateTime).getTime() : (old.callDateTime ?? undefined),
    stage,
    status,
    eligibilityFlag: old.eligibilityFlag ?? undefined,
    cccPdfParsed: old.cccPdfParsed ?? false,
    cccExtractJsonPath: old.cccExtractJsonPath ?? undefined,
    plodSummaryInjected: old.plodSummaryInjected ?? false,
    prelimAcv: old.prelimAcv ?? undefined,
    compCount: old.compCount ?? undefined,
    compResearchComplete: old.compResearchComplete ?? false,
    integrationStatus: old.integrationStatus ?? DEFAULT_INT_STATUS,
    lastSyncAttemptAt: undefined,
    lastSyncError: undefined,
    sourceOfTruthVersion: old.sourceOfTruthVersion ?? 1,
    ghlContactId: old.ghlContactId ?? undefined,
    convertedToMatterId: old.convertedToMatterId ?? undefined,
    createdBy: old.createdBy ?? "Migration",
    updatedBy: old.updatedBy ?? "Migration",
    updateSource: old.updateSource ?? "v22_migration",
    revision: old.revision ?? 1,
    createdAt: old.createdAt ?? now,
    updatedAt: old.updatedAt ?? now,
  };
}

function transformMatter(old) {
  const now = Date.now();
  const carrier = old.carrier ?? old.carrierDisplayName ?? "UNKNOWN";

  let stage = old.stage;
  if (typeof stage === "number") stage = MATTER_STAGE_MAP[stage] ?? "ACTIVE";
  if (!stage) stage = "ACTIVE";

  const validStatuses = ["ACTIVE", "CLOSED_SETTLED", "CLOSED_AWARDED", "CLOSED_WITHDRAWN", "CLOSED_OTHER", "VOIDED"];
  let status = old.status ?? "ACTIVE";
  if (!validStatuses.includes(status)) status = "ACTIVE";

  return {
    matterId: old.matterId,
    masterCaseId: old.masterCaseId,
    masterCaseIdFormatted: old.masterCaseIdFormatted ?? String(old.masterCaseId).padStart(6, "0"),
    prospectId: old.prospectId ?? undefined,
    year: typeof old.year === "string" ? parseInt(old.year, 10) : (old.year ?? 2026),
    division: old.division ?? "AUTO",
    role: old.role ?? "AC",
    roleOthDescription: old.roleOthDescription ?? undefined,
    firstName: old.firstName ?? "",
    lastName: old.lastName ?? "",
    phoneNormalized: old.phoneNormalized ?? normalizePhone(old.phone),
    emailNormalized: old.emailNormalized || (old.email ?? "").trim().toLowerCase() || undefined,
    vehicleYear: typeof old.vehicleYear === "string" ? parseInt(old.vehicleYear, 10) : (old.vehicleYear ?? 0),
    vehicleMake: old.vehicleMake ?? "",
    vehicleModel: old.vehicleModel ?? "",
    vehicleTrim: old.vehicleTrim ?? undefined,
    vehicleVin: old.vehicleVin ?? undefined,
    vehicleMileage: old.vehicleMileage ?? undefined,
    carrierDisplayName: carrier,
    carrierNormalized: old.carrierNormalized ?? normalizeCarrier(carrier),
    claimNumber: old.claimNumber ?? undefined,
    insurerAcvOffer: old.insurerAcvOffer ?? undefined,
    clientTargetValue: old.clientTargetValue ?? undefined,
    appraiserOpinion: old.appraiserOpinion ?? undefined,
    recoveryAmount: old.recoveryAmount ?? undefined,
    neutral: old.neutral ?? false,
    advocacy: old.advocacy ?? true,
    stage,
    status,
    gdriveFolderUrl: old.gdriveFolderUrl ?? undefined,
    caseActivityLogPath: old.caseActivityLogPath ?? undefined,
    acvWorkbenchUrl: old.acvWorkbenchUrl ?? undefined,
    reportBundleUrl: old.reportBundleUrl ?? undefined,
    integrationStatus: old.integrationStatus ?? DEFAULT_INT_STATUS,
    lastSyncAttemptAt: undefined,
    lastSyncError: undefined,
    sourceOfTruthVersion: old.sourceOfTruthVersion ?? 1,
    conflictCheckComplete: old.conflictCheckComplete ?? undefined,
    activatedAt: old.activatedAt ?? old.createdAt ?? now,
    reportGeneratedAt: old.reportGeneratedAt ?? undefined,
    submittedAt: typeof old.submittedAt === "string" ? new Date(old.submittedAt).getTime() : (old.submittedAt ?? undefined),
    responseDeadline: typeof old.responseDeadline === "string" ? new Date(old.responseDeadline).getTime() : (old.responseDeadline ?? undefined),
    closedAt: old.closedAt ?? undefined,
    ghlContactId: old.ghlContactId ?? undefined,
    ghlOutcomeTag: old.ghlOutcomeTag ?? undefined,
    createdBy: old.createdBy ?? "Migration",
    updatedBy: old.updatedBy ?? "Migration",
    updateSource: old.updateSource ?? "v22_migration",
    revision: old.revision ?? 1,
    createdAt: old.createdAt ?? now,
    updatedAt: old.updatedAt ?? now,
  };
}

function transformComparable(old) {
  const now = Date.now();
  return {
    parentType: old.parentType ?? "prospect",
    parentId: old.parentId ?? old.prospectId ?? "",
    compNumber: old.compNumber ?? 0,
    vin: old.vin ?? old.vehicleVin ?? undefined,
    year: typeof old.year === "string" ? parseInt(old.year, 10) : (old.year ?? undefined),
    make: old.make ?? old.vehicleMake ?? undefined,
    model: old.model ?? old.vehicleModel ?? undefined,
    trim: old.trim ?? old.vehicleTrim ?? undefined,
    mileage: old.mileage ?? old.vehicleMileage ?? undefined,
    location: old.location ?? undefined,
    askingPrice: old.askingPrice ?? undefined,
    adjustments: old.adjustments ?? [],
    adjustedValue: old.adjustedValue ?? undefined,
    notes: old.notes ?? undefined,
    source: old.source ?? "manual",
    listingUrl: old.listingUrl ?? undefined,
    listingScreenshot: old.listingScreenshot ?? undefined,
    status: old.status ?? "ACCEPTED",
    rejectedReason: old.rejectedReason ?? undefined,
    createdBy: old.createdBy ?? "Migration",
    createdAt: old.createdAt ?? now,
  };
}

function transformSequenceCounter(old) {
  return {
    name: old.name,
    currentValue: old.currentValue ?? 0,
  };
}

// ============================================================
// MAIN MIGRATION
// ============================================================

async function main() {
  const zipInputPath = process.argv[2];
  const zipOutputPath = process.argv[3] || "v23_import.zip";

  if (!zipInputPath) {
    console.error("Usage: node migrate_offline.mjs <v22_export.zip> [v23_import.zip]");
    process.exit(1);
  }

  console.log(`📦 Reading v2.2 export from: ${zipInputPath}`);
  
  // Unzip
  const tempDir = `/tmp/cc_migration_${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });
  execSync(`unzip -q "${zipInputPath}" -d "${tempDir}"`, { stdio: "inherit" });

  // Read metadata.json to find data dir
  const metadataPath = path.join(tempDir, "metadata.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const dataDir = path.join(tempDir, metadata.data ?? "data");

  console.log(`\n📂 Data directory: ${dataDir}`);

  // Load and transform
  const v23Data = {};
  const tables = ["prospects", "matters", "comparables", "sequenceCounters"];

  for (const table of tables) {
    const filePath = path.join(dataDir, `${table}.jsonl`);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${table}: not found (skipping)`);
      v23Data[table] = [];
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(l => l.trim());
    let transformed = [];

    if (table === "prospects") {
      transformed = lines.map(l => transformProspect(JSON.parse(l)));
    } else if (table === "matters") {
      transformed = lines.map(l => transformMatter(JSON.parse(l)));
    } else if (table === "comparables") {
      transformed = lines.map(l => transformComparable(JSON.parse(l)));
    } else if (table === "sequenceCounters") {
      transformed = lines.map(l => transformSequenceCounter(JSON.parse(l)));
    }

    v23Data[table] = transformed;
    console.log(`✅ ${table}: ${transformed.length} records transformed`);
  }

  // Write new JSONL files
  const outDataDir = path.join(tempDir, "data_v23");
  fs.mkdirSync(outDataDir, { recursive: true });

  for (const [table, records] of Object.entries(v23Data)) {
    const outPath = path.join(outDataDir, `${table}.jsonl`);
    const jsonl = records.map(r => JSON.stringify(r)).join("\n");
    fs.writeFileSync(outPath, jsonl);
  }

  // Update metadata for v2.3
  metadata.data = "data_v23";
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Re-zip
  console.log(`\n📦 Creating v2.3 import zip: ${zipOutputPath}`);
  execSync(`cd "${tempDir}" && zip -q -r "${path.resolve(zipOutputPath)}" .`, { stdio: "inherit" });

  // Cleanup
  execSync(`rm -rf "${tempDir}"`);

  console.log(`\n✅ Migration complete! Ready to deploy.`);
  console.log(`\nNext steps:`);
  console.log(`  1. npx convex deploy --yes  (deploys v2.3 schema to PROD)`);
  console.log(`  2. npx convex import --replace "${zipOutputPath}"`);
}

main().catch(err => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
