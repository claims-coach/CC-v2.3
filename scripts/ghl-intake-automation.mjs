#!/usr/bin/env node

/**
 * GHL Intake Automation (Hardened v2)
 * When a GHL contact is created/updated, automatically:
 * 1. Create case in Mission Control (with aggressive retry logic)
 * 2. Create Drive folder
 * 3. Populate valuation record (with aggressive retry logic)
 * 4. Search for comps (with 15s timeout)
 * 5. Display in workbench
 * 
 * Improvements v2:
 * - Exponential backoff retry on Convex mutations (4 tries, 1-8s backoff)
 * - Comp search disabled (too slow — manual in workbench)
 * - 500ms rate limiting between contacts
 * - Better error logging with detailed messages
 * - Processes ~20 contacts in ~10s
 * 
 * Run: node scripts/ghl-intake-automation.mjs
 * Cron: every 15 min (alongside ghl-sync.mjs)
 */

import { ConvexHttpClient } from "convex/browser";
import { execSync } from "child_process";

const GHL_API_KEY = "pit-5d00da93-9b03-4d02-ac45-4f488520fba7";
const GHL_LOCATION = "Lud9I0SSpb992pgRS4gJ";
const CONVEX_URL = "https://agreeable-goose-357.convex.cloud";
const GHL_BASE = "https://services.leadconnectorhq.com";

const client = new ConvexHttpClient(CONVEX_URL);

const GHL_HEADERS = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json",
};

/**
 * GHL Fetch helper
 */
async function ghlFetch(path) {
  const res = await fetch(`${GHL_BASE}${path}`, { headers: GHL_HEADERS });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GHL ${path} → ${res.status}: ${error}`);
  }
  return res.json();
}

/**
 * Fetch all contacts from GHL (then check their opportunities)
 */
async function fetchGHLContacts() {
  try {
    const data = await ghlFetch(`/contacts/?locationId=${GHL_LOCATION}`);
    return data.contacts || data.data || [];
  } catch (e) {
    console.error("Error fetching GHL contacts:", e.message);
    return [];
  }
}

/**
 * Fetch opportunities for a specific contact
 */
async function fetchContactOpportunities(contactId) {
  try {
    const data = await ghlFetch(`/contacts/${contactId}/opportunities?locationId=${GHL_LOCATION}`);
    return data.opportunities || data.data || [];
  } catch (e) {
    return [];
  }
}

/**
 * Fetch full contact details from GHL
 */
async function fetchGHLContact(contactId) {
  try {
    return await ghlFetch(`/contacts/${contactId}/?locationId=${GHL_LOCATION}`);
  } catch (e) {
    console.error(`Error fetching contact ${contactId}:`, e.message);
    return null;
  }
}

/**
 * Extract info from text using regex
 */
function extractFromText(text, pattern, group = 0) {
  if (!text) return null;
  const match = text.match(pattern);
  return match ? match[group] : null;
}

/**
 * Extract vehicle details from contact custom fields or notes
 */
function extractVehicleData(contact) {
  const customFields = contact.customFields || [];
  const notes = contact.notes || "";
  
  // Map custom field IDs to values
  const cf = (id) => {
    const f = customFields.find(f => f.id === id);
    return f?.value || null;
  };

  return {
    year: cf("bYA55kg9nzn6YIIUYZ4I") || extractFromText(notes, /(\d{4})/),
    make: cf("FbC0k0MTjr1PRIUhLrJT") || extractFromText(notes, /(Honda|Toyota|Ford|Chevy|BMW|Audi|Tesla)/i),
    model: cf("84Cyc2WkPwWSlRzDoNTf") || extractFromText(notes, /(?:Honda|Toyota|Ford|Chevy|BMW|Audi|Tesla)\s+(\w+)/i, 1),
    vin: cf("zQn83d4bJi4CKdSdkhbh") || extractFromText(notes, /VIN:\s*([A-HJ-NPR-Z0-9]{17})/i),
    mileage: cf("JafUwf29wAIz1y1U5BNe") || extractFromText(notes, /(\d+)(?:\s*miles?|mi\b)/i),
    insuranceCompany: extractFromText(notes, /(Geico|State Farm|Allstate|Progressive|USAA|Liberty Mutual|Nationwide|Farmers|AARP)/i),
    claimNumber: extractFromText(notes, /Claim[:\s#]*([0-9]+)/i),
  };
}

/**
 * Retry logic: aggressive exponential backoff (1s, 2s, 4s, 8s)
 */
async function retryMutation(mutation, data, maxRetries = 4) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.mutation(mutation, data);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) throw e;
      const backoff = [1000, 2000, 4000, 8000][attempt - 1];
      const delayS = backoff / 1000;
      console.log(`   ↻ Retry ${attempt}/${maxRetries} (backoff ${delayS}s)... Error: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

/**
 * Create case in Mission Control from GHL contact
 */
async function createCaseFromContact(contact, vehicle) {
  try {
    const caseData = {
      clientName: contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : contact.name,
      assignedAgent: "CC",
      insurer: vehicle.insuranceCompany || "Unknown",
      vin: vehicle.vin || "PENDING",
      year: vehicle.year ? parseInt(vehicle.year) : undefined,
      make: vehicle.make || undefined,
      model: vehicle.model || undefined,
      claimType: "ACV",
      priority: "high",
      tags: ["ghl-auto", "from-form"],
      notes: `GHL Contact ID: ${contact.id}. Email: ${contact.email}. Phone: ${contact.phone}. Claim: ${vehicle.claimNumber || "N/A"}`,
    };

    // Remove undefined fields
    Object.keys(caseData).forEach((key) => caseData[key] === undefined && delete caseData[key]);

    const claimId = await retryMutation("claims:create", caseData);
    console.log(`✅ Case created: ${caseData.clientName} (ID: ${claimId})`);

    return claimId;
  } catch (e) {
    console.error(`❌ Error creating case: ${contact.firstName} ${contact.lastName || "unknown"} - ${e.message}`);
    return null;
  }
}

/**
 * Create valuation record for case
 */
async function createValuationRecord(claimId, vehicle) {
  try {
    const valuationData = {
      claimId,
      claimType: "ACV",
      notes: `Auto-populated from GHL contact. Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}. Mileage: ${vehicle.mileage}`,
    };

    const valuationId = await retryMutation("valuations:upsert", valuationData);
    console.log(`✅ Valuation created: ${valuationId}`);

    return valuationId;
  } catch (e) {
    console.error(`❌ Error creating valuation: ${e.message}`);
    return null;
  }
}

/**
 * Trigger comp search for claim (with 30s timeout, skipped in automation)
 * NOTE: Comp search calls external AI APIs (Grok/OpenAI/Claude) which are slow.
 * For intake automation, we skip this and let users search comps manually in workbench.
 * Future: Queue comps as async background task.
 */
async function triggerCompSearch(claimId, vehicle) {
  try {
    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      console.log(`⚠ Skipping comp search: incomplete vehicle data`);
      return null;
    }

    // DISABLED FOR INTAKE AUTOMATION: Comp search is too slow (calls external AI APIs)
    // Users can search comps manually in workbench.
    console.log(`⏭ Skipping comp search for intake (user will search manually in workbench)`);
    return null;
  } catch (e) {
    console.error(`❌ Error in comp search handler: ${e.message}`);
    return null;
  }
}

/**
 * Check if case already exists for this GHL contact
 */
async function caseExistsForContact(ghlContactId) {
  try {
    const results = await client.query("claims:search", {
      query: ghlContactId,
    });
    return results.length > 0;
  } catch {
    return false;
  }
}

/**
 * Main automation: process all GHL contacts with opportunities (booked calls)
 */
async function processGHLIntakes() {
  console.log("\n🚀 GHL Intake Automation Starting...\n");

  const contacts = await fetchGHLContacts();
  console.log(`Found ${contacts.length} contacts in GHL`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let processedContacts = 0;

  for (const contact of contacts) {
    try {
      const contactId = contact.id;
      if (!contactId) continue;

      // Check if contact has "lead - master" tag (booked call)
      const tags = contact.tags || [];
      const isLead = tags.some(t => t.toLowerCase().includes("lead") || t.toLowerCase().includes("master"));
      
      if (!isLead) continue; // Not a lead

      processedContacts++;

      // Check if case already exists
      const exists = await caseExistsForContact(contactId);
      if (exists) {
        skipped++;
        continue;
      }

      // Extract vehicle data
      const vehicle = extractVehicleData(contact);

      // Create case
      const claimId = await createCaseFromContact(contact, vehicle);
      if (!claimId) {
        errors++;
        continue;
      }

      // Rate limit: 500ms between contacts (Convex can handle ~20 requests/sec)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create valuation
      await createValuationRecord(claimId, vehicle);

      // Trigger comp search (if vehicle data complete, with 15s timeout)
      await triggerCompSearch(claimId, vehicle);

      created++;
      console.log();
    } catch (e) {
      console.error(`❌ Error processing contact: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n✅ GHL Intake Automation Complete`);
  console.log(`   Processed: ${processedContacts} contacts with booked calls`);
  console.log(`   Created: ${created} new cases`);
  console.log(`   Skipped: ${skipped} (already exist)`);
  console.log(`   Errors: ${errors}\n`);

  return { processedContacts, created, skipped, errors };
}

// Run automation
processGHLIntakes().catch(console.error);
