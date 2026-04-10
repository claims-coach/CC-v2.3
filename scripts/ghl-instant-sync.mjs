#!/usr/bin/env node

/**
 * GHL Instant Sync — Catch NEW Contacts & Bookings in Real-Time
 * 
 * Problem: 15-min cron job misses new contacts that book calls
 * Solution: Run this script via GHL webhook OR run it every 1 minute
 * 
 * Usage:
 * node scripts/ghl-instant-sync.mjs [contactId]  (sync one contact)
 * node scripts/ghl-instant-sync.mjs               (sync ALL recent contacts)
 */

const GHL_API_KEY = "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const GHL_LOCATION = "Lud9I0SSpb992pgRS4gJ";
const CONVEX_URL = "https://calm-warbler-536.convex.cloud";
const GHL_BASE = "https://services.leadconnectorhq.com";

const GHL_HEADERS = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json",
};

const FIELD_IDS = {
  vehicle_year: "bYA55kg9nzn6YIIUYZ4I",
  vehicle_make: "FbC0k0MTjr1PRIUhLrJT",
  vehicle_model: "84Cyc2WkPwWSlRzDoNTf",
  vehicle_trim: "Ayp2CCc8F6V4hlzqPIzq",
  vehicle_vin: "zQn83d4bJi4CKdSdkhbh",
  vehicle_mileage: "JafUwf29wAIz1y1U5BNe",
  claimValue: "5McVrjyMZLO4twt3aVbz",
  notes: "jfnPb04ubsbuAJ5bmzSk",
};

async function ghlFetch(path) {
  const res = await fetch(`${GHL_BASE}${path}`, { headers: GHL_HEADERS });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GHL ${path} → ${res.status}: ${error}`);
  }
  return res.json();
}

function extractCustomField(customFields, fieldId) {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find(f => f.id === fieldId);
  return field?.value || null;
}

async function convexMutation(mutationName, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: mutationName, args }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Convex ${mutationName} → ${res.status}: ${error}`);
  }
  return res.json();
}

async function syncContact(contactId) {
  console.log(`\n[GHL Instant Sync] Processing contact: ${contactId}`);

  try {
    // Fetch contact from GHL
    const contact = await ghlFetch(`/contacts/${contactId}/?locationId=${GHL_LOCATION}`);

    if (!contact) {
      console.log(`   ❌ Contact not found in GHL`);
      return null;
    }

    const firstName = contact.firstName || "";
    const lastName = contact.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();

    console.log(`   📍 Contact: ${fullName}`);
    console.log(`   📧 Email: ${contact.email || "N/A"}`);
    console.log(`   📱 Phone: ${contact.phone || "N/A"}`);

    // Extract vehicle info from custom fields
    const customFields = contact.customFields || [];
    const year = extractCustomField(customFields, FIELD_IDS.vehicle_year);
    const make = extractCustomField(customFields, FIELD_IDS.vehicle_make);
    const model = extractCustomField(customFields, FIELD_IDS.vehicle_model);
    const trim = extractCustomField(customFields, FIELD_IDS.vehicle_trim);
    const vin = extractCustomField(customFields, FIELD_IDS.vehicle_vin);
    const mileage = extractCustomField(customFields, FIELD_IDS.vehicle_mileage);
    const claimValue = extractCustomField(customFields, FIELD_IDS.claimValue);
    const notes = extractCustomField(customFields, FIELD_IDS.notes);

    if (year || make || model) {
      console.log(`   🚗 Vehicle: ${year || "?"} ${make || ""} ${model || ""} ${trim || ""}`.trim());
      console.log(`   📊 Mileage: ${mileage || "N/A"}`);
      console.log(`   🔢 VIN: ${vin || "N/A"}`);
    }

    // Check if contact already has a case in Mission Control
    const existingRes = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "claims:search",
        args: { query: fullName },
      }),
    });

    const existing = await existingRes.json();
    const existingClaim = existing.value?.find((c) => c.ghlId === contactId);

    if (existingClaim) {
      console.log(`   ℹ️  Case already exists: ${existingClaim._id}`);
      console.log(`   ✅ Skipping (already synced)`);
      return existingClaim._id;
    }

    // CREATE NEW CASE
    console.log(`   ➕ Creating new case in Mission Control...`);

    const createRes = await convexMutation("claims:create", {
      clientName: fullName,
      clientEmail: contact.email || "",
      clientPhone: contact.phone || "",
      status: "intake",
      stage: "intake",
      claimType: "ACV",
      carrier: "Unknown",
      year: year ? parseInt(year) : undefined,
      make: make,
      model: model,
      vin: vin,
      daysOpen: 0,
      nextAction: "Review vehicle data and estimate",
      priority: "high",
      ghlId: contactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`   ✅ Case created: ${createRes._id}`);
    return createRes._id;
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return null;
  }
}

async function syncRecentContacts() {
  console.log(`\n[GHL Instant Sync] Fetching recent contacts from GHL...`);

  try {
    // Get contacts updated in last 24 hours
    const yesterday = Date.now() - 86400000;
    const url = `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION}&limit=100`;

    const res = await fetch(url, { headers: GHL_HEADERS });
    const data = await res.json();
    const contacts = data.contacts || [];

    console.log(`   Found ${contacts.length} contacts total`);

    let synced = 0;
    let skipped = 0;

    for (const contact of contacts) {
      // Only sync contacts with vehicle data or notes (likely claims)
      const customFields = contact.customFields || [];
      const hasVehicleData =
        customFields.some((f) =>
          ["bYA55kg9nzn6YIIUYZ4I", "FbC0k0MTjr1PRIUhLrJT", "84Cyc2WkPwWSlRzDoNTf"].includes(f.id)
        ) || contact.notes?.toLowerCase().includes("claim");

      if (!hasVehicleData) {
        skipped++;
        continue;
      }

      const result = await syncContact(contact.id);
      if (result) synced++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(
      `\n[GHL Instant Sync] ✅ Complete: ${synced} synced, ${skipped} skipped`
    );
  } catch (e) {
    console.error(`[GHL Instant Sync] Error:`, e.message);
  }
}

// Main
const contactId = process.argv[2];

if (contactId) {
  console.log(`[GHL Instant Sync] Syncing single contact: ${contactId}`);
  syncContact(contactId).then(() => process.exit(0));
} else {
  console.log(`[GHL Instant Sync] Running full sync of recent contacts...`);
  syncRecentContacts().then(() => process.exit(0));
}
