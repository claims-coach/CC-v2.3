#!/usr/bin/env node
/**
 * GHL → Mission Control Sync
 * Pulls GHL contacts + opportunities and upserts into Convex claims table.
 * Run manually: node scripts/ghl-sync.mjs
 * Run via cron: openclaw cron (see README)
 */

import { execSync } from "child_process";

const GHL_API_KEY    = "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const GHL_LOCATION   = "Lud9I0SSpb992pgRS4gJ";
const CONVEX_URL     = "https://calm-warbler-536.convex.cloud";
const GHL_BASE       = "https://services.leadconnectorhq.com";
const GHL_HEADERS    = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json",
};

// ── Custom field ID map ──────────────────────────────────────────────────────
const F = {
  make:         "FbC0k0MTjr1PRIUhLrJT",
  model:        "84Cyc2WkPwWSlRzDoNTf",
  trim:         "Ayp2CCc8F6V4hlzqPIzq",   // submodel/trim (e.g. "S", "GT")
  year:         "bYA55kg9nzn6YIIUYZ4I",
  vin:          "zQn83d4bJi4CKdSdkhbh",   // VIN field (stored as number — use string regex fallback)
  mileage:      "JafUwf29wAIz1y1U5BNe",
  claimValue:   "5McVrjyMZLO4twt3aVbz",
  notes:        "jfnPb04ubsbuAJ5bmzSk",   // vehicle notes / description (also contains VIN sometimes)
  altNotes:     "yPlztXHcK16EksU7us51",   // alternate notes field (may contain VIN)
  accidentDate: "vURmeXQ8WLvzell9gbly",
  estimateFile: "qi9zy4jnBRSQvgBNQ2L2",
  referralSrc:  "ERhIG8T6dcru7a6D9DN8",
};

// ── GHL stage → MC stage ─────────────────────────────────────────────────────
const STAGE_MAP = {
  "dedf0a23-93b8-4f3d-8fc3-28e261351547": "intake",
  "9e26eacf-9c64-4a3f-9c15-3a7b2ea588c9": "intake",
  "82aa65d0-8540-4a8f-b330-9e952c02cdf3": "intake",
  "d67bd63e-20b2-4b86-862f-6d8504eb07a9": "intake",
  "c2dbdf9b-2802-4110-9fee-4a9d8c293735": "intake",
  "e7c8613f-77ff-4563-86a0-294719e3a5a5": "intake",
  "0b65d872-0149-4bdc-8de4-5adb75c6df2d": "valuation",
  "ee6207a6-8240-4ce6-999f-5611b0806e10": "valuation",
  "6fc5baba-816f-4bbc-9e9f-775fcc17d56f": "valuation",
  "883df3a0-990d-4866-9d2d-c159040e8083": "negotiation",
  "5fcf438f-786d-41d5-817e-95935bb1bb70": "settled",
  "40c7bd72-d926-4f65-8f93-bd4cba5b49e0": "settled",
  "7c0032e0-d364-4ecb-a424-73a252fd28b4": "closed",
  // Acquisition pipeline
  "7a7fa738-273d-4cf8-b336-e8b381471d5a": "closed",   // Completed
  "d9c0312c-6223-4d57-88de-d15774df3342": "closed",   // Nurture - Old/Lost/Follow up
  // Other Projects pipeline
  "4b1f3fd2-75ae-4df0-bf57-f27b54ac6eb0": "closed",   // Closed
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function cf(fields, id) {
  const f = fields?.find(f => f.id === id);
  return f?.value ?? null;
}

function parseNumber(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

async function ghlFetch(path) {
  const res = await fetch(`${GHL_BASE}${path}`, { headers: GHL_HEADERS });
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function convexMutation(name, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: name, args }),
  });
  if (!res.ok) throw new Error(`Convex ${name} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Fetch all contacts (paginated) ───────────────────────────────────────────
async function fetchAllContacts() {
  const contacts = [];
  let url = `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION}&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: GHL_HEADERS });
    const data = await res.json();
    if (data.contacts) contacts.push(...data.contacts);
    url = data.meta?.nextPageUrl || null;
    if (url) await new Promise(r => setTimeout(r, 200)); // rate limit
  }
  return contacts;
}

// ── Fetch opportunities for a contact ───────────────────────────────────────
async function fetchOpportunities(contactId) {
  try {
    const data = await ghlFetch(
      `/contacts/${contactId}/opportunities?locationId=${GHL_LOCATION}`
    );
    return data.opportunities || data.data || [];
  } catch {
    return [];
  }
}

// ── Fetch ALL opportunities from a pipeline ──────────────────────────────────
async function fetchPipelineOpportunities(pipelineId) {
  const opps = [];
  let startAfter = null;
  while (true) {
    let endpoint = `/opportunities/search?location_id=${GHL_LOCATION}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfter) endpoint += `&startAfter=${startAfter}`;
    try {
      const data = await ghlFetch(endpoint);
      const batch = data.opportunities || [];
      opps.push(...batch);
      if (batch.length < 100) break;
      startAfter = opps[opps.length - 1].id;
      await new Promise(r => setTimeout(r, 200));
    } catch { break; }
  }
  return opps;
}

// ── Active case definition ────────────────────────────────────────────────────
const ACTIVE_STAGES = new Set([
  "dedf0a23-93b8-4f3d-8fc3-28e261351547", // intake
  "9e26eacf-9c64-4a3f-9c15-3a7b2ea588c9", // intake
  "82aa65d0-8540-4a8f-b330-9e952c02cdf3", // intake
  "d67bd63e-20b2-4b86-862f-6d8504eb07a9", // intake
  "c2dbdf9b-2802-4110-9fee-4a9d8c293735", // intake
  "e7c8613f-77ff-4563-86a0-294719e3a5a5", // intake
  "0b65d872-0149-4bdc-8de4-5adb75c6df2d", // valuation
  "ee6207a6-8240-4ce6-999f-5611b0806e10", // valuation
  "6fc5baba-816f-4bbc-9e9f-775fcc17d56f", // valuation
  "883df3a0-990d-4866-9d2d-c159040e8083", // negotiation
]);

// ── Main sync ────────────────────────────────────────────────────────────────
async function sync() {
  console.log(`[${new Date().toISOString()}] GHL sync starting...`);

  // Only pull from Claims pipeline (not Sales which has leads/prospects)
  const CLAIMS_PIPELINE = "DO3kzp0BU4LysvXQK0M2";
  const pipelineOpps = await fetchPipelineOpportunities(CLAIMS_PIPELINE);
  
  // Filter to only ACTIVE stages with vehicle data
  let activeOppCount = 0;
  const oppByContact = {};
  for (const opp of pipelineOpps) {
    const cid = opp.contact?.id || opp.contactId;
    if (cid) oppByContact[cid] = opp;
  }
  console.log(`Fetched ${pipelineOpps.length} opportunities from Claims pipeline`);

  const contacts = await fetchAllContacts();
  console.log(`Fetched ${contacts.length} contacts from GHL`);

  let created = 0, updated = 0, skipped = 0, errors = 0;
  let oppWithVehicle = 0;

  for (const contact of contacts) {
    try {
      // Skip contacts with no vehicle data (non-claim contacts) — use list fields first
      const listFields = contact.customFields || [];
      const make = cf(listFields, F.make);
      if (!make) { skipped++; continue; }
      
      // Check if this contact has an active opportunity (Claims pipeline)
      const opp = oppByContact[contact.id];
      if (!opp || !ACTIVE_STAGES.has(opp.pipelineStageId)) { skipped++; continue; }
      oppWithVehicle++;

      // Fetch full contact detail to get file upload fields (not returned by list API)
      let fields = listFields;
      try {
        const detailRes = await fetch(`${GHL_BASE}/contacts/${contact.id}`, { headers: GHL_HEADERS });
        const detailData = await detailRes.json();
        if (detailData.contact?.customFields) fields = detailData.contact.customFields;
      } catch { /* fall back to list fields */ }

      // Parse vehicle fields
      const year    = parseNumber(cf(fields, F.year));
      const mileage = parseNumber(cf(fields, F.mileage));
      const model   = cf(fields, F.model)?.trim() || undefined;
      const trim    = cf(fields, F.trim)?.trim() || undefined;
      const notes   = cf(fields, F.notes) || cf(fields, F.altNotes) || undefined;

      // VIN: GHL stores as number (precision loss for 17-char VINs).
      // Strategy: 1) regex extract from notes fields, 2) fall back to raw field as string.
      const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
      const vinFromNotes = [cf(fields, F.altNotes), cf(fields, F.notes)]
        .map(s => String(s || "").match(VIN_RE)?.[1])
        .find(Boolean);
      const vinRaw = cf(fields, F.vin);
      const vin = vinFromNotes || (vinRaw ? String(vinRaw) : undefined);

      // Address fields (standard GHL contact fields)
      const address1   = contact.address1 || undefined;
      const city       = contact.city     || undefined;
      const state      = contact.state    || undefined;
      const postalCode = contact.postalCode || undefined;

      // Opening offer — GHL's claimValue field is NOT reliable as insurer's offer.
      // Only set openingOffer from GHL if it looks like a plausible vehicle value (>$5,000).
      // The real offer comes from the workbench intake (entered manually or parsed from eval PDF).
      const claimValueRaw = cf(fields, F.claimValue);
      const claimValueNum = parseNumber(claimValueRaw);
      const openingOffer  = claimValueNum >= 5000 ? claimValueNum : undefined;

      // Estimate/document files — GHL stores as object: { uuid: { meta, documentId, url } }
      // Extract ALL files, not just the first one
      const ghlDocuments = [];
      const estimateField = cf(fields, F.estimateFile);
      if (estimateField) {
        if (typeof estimateField === "string" && estimateField.startsWith("http")) {
          ghlDocuments.push({ name: "Uploaded File", url: estimateField, type: "estimate" });
        } else if (Array.isArray(estimateField)) {
          estimateField.forEach(f => {
            const url = f?.url || (typeof f === "string" ? f : null);
            if (url) ghlDocuments.push({ name: f?.meta?.originalname || "File", url, type: "estimate" });
          });
        } else if (typeof estimateField === "object" && estimateField !== null) {
          // Format: { uuid: { meta: { originalname, size, mimetype }, documentId, url } }
          Object.values(estimateField).forEach(f => {
            if (f?.url) {
              ghlDocuments.push({
                name: f.meta?.originalname || "File",
                url:  f.url,
                type: f.meta?.mimetype === "application/pdf" ? "estimate" : "document",
                size: f.meta?.size,
              });
            }
          });
        }
      }
      // Legacy single URL for backward compat
      const estimateUrl = ghlDocuments[0]?.url;

      // Client name
      const clientName = contact.contactName ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        contact.phone || "Unknown";

      // Get opportunity for stage — use pre-loaded Claims pipeline map first, then fall back to per-contact lookup
      let stage = "unassigned";
      let ghlOpportunityId, ghlPipelineId, ghlStageId;

      const pipelineOpp = oppByContact[contact.id];
      if (pipelineOpp) {
        ghlOpportunityId = pipelineOpp.id;
        ghlPipelineId    = pipelineOpp.pipelineId;
        ghlStageId       = pipelineOpp.pipelineStageId;
        stage            = STAGE_MAP[ghlStageId] ?? "intake";
      } else {
        // Fall back to per-contact lookup (catches opps in other pipelines)
        const opps = await fetchOpportunities(contact.id);
        if (opps.length > 0) {
          const opp = opps[0];
          ghlOpportunityId = opp.id;
          ghlPipelineId    = opp.pipelineId;
          ghlStageId       = opp.pipelineStageId;
          stage            = STAGE_MAP[ghlStageId] ?? "intake";
        }
      }

      // Opened at
      const openedAt = contact.dateAdded ? new Date(contact.dateAdded).getTime() : Date.now();

      const result = await convexMutation("ghl:upsertFromGHL", {
        ghlContactId:     contact.id,
        ghlOpportunityId,
        ghlPipelineId,
        ghlStageId,
        clientName,
        phone:            contact.phone || undefined,
        email:            contact.email || undefined,
        address1,
        city,
        state,
        postalCode,
        vin:              vin?.trim() || undefined,
        year,
        make:             make?.trim() || undefined,
        model,
        trim,
        mileage,
        ...(openingOffer !== undefined ? { openingOffer } : {}),
        notes,
        tags:             contact.tags || [],
        stage,
        estimateUrl,
        ghlDocuments: ghlDocuments.length > 0 ? JSON.stringify(ghlDocuments) : undefined,
        openedAt,
      });

      if (result.value?.action === "created") created++;
      else updated++;

    } catch (err) {
      console.error(`Error processing contact ${contact.id}: ${err.message}`);
      errors++;
    }

    // Small delay to avoid hammering Convex
    await new Promise(r => setTimeout(r, 50));
  }

  const summary = `GHL sync complete — ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors | Active cases with vehicle: ${oppWithVehicle}`;
  console.log(summary);
  return { created, updated, skipped, errors, total: contacts.length, activeWithVehicle: oppWithVehicle };
}

sync().then(async r => {
  console.log("Done:", r);

  // ── Post-sync: flush active cases to memory ──────────────────────────────
  try {
    console.log("\n🧠 Running memory flush...");
    const { execSync } = await import("child_process");
    execSync(`node ${new URL("./memory-flush.mjs", import.meta.url).pathname}`, { stdio: "inherit" });
  } catch (err) {
    console.warn("⚠️  Memory flush failed (non-fatal):", err.message);
  }

  process.exit(0);
}).catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
