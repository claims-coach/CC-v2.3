#!/usr/bin/env node

/**
 * GHL + CCC Data Reconciliation
 * 
 * Two sources of truth:
 * 1. GHL Contact Custom Fields (year, make, model, trim, VIN, mileage)
 * 2. CCC Evaluation PDF (extracted via Gemini OCR)
 * 
 * This script:
 * - Extracts vehicle data from GHL contact
 * - Extracts vehicle data from CCC PDF (via Gemini)
 * - Compares and flags discrepancies
 * - Returns MERGED + VALIDATED data
 * 
 * Usage: node scripts/ghl-ccc-reconciliation.mjs [contactId] [cccFileUrl]
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GHL_API_KEY = "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const GHL_LOCATION = "Lud9I0SSpb992pgRS4gJ";
const GHL_BASE = "https://services.leadconnectorhq.com";

const GHL_HEADERS = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json",
};

const client = new ConvexHttpClient(CONVEX_URL);

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
 * Custom Field ID Map
 */
const FIELD_IDS = {
  vehicle_year: "bYA55kg9nzn6YIIUYZ4I",
  vehicle_make: "FbC0k0MTjr1PRIUhLrJT",
  vehicle_model: "84Cyc2WkPwWSlRzDoNTf",
  vehicle_trim: "Ayp2CCc8F6V4hlzqPIzq",
  vehicle_vin: "zQn83d4bJi4CKdSdkhbh",
  vehicle_mileage: "JafUwf29wAIz1y1U5BNe",
};

/**
 * Extract custom field value by ID
 */
function extractCustomField(customFields, fieldId) {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find(f => f.id === fieldId);
  return field?.value || null;
}

/**
 * Source 1: Extract vehicle data from GHL Contact
 */
async function extractFromGHL(contactId) {
  console.log(`\n📋 SOURCE 1: Extracting from GHL Contact...`);

  try {
    const contact = await ghlFetch(`/contacts/${contactId}/?locationId=${GHL_LOCATION}`);
    
    if (!contact) {
      console.log(`   ❌ Contact not found`);
      return null;
    }

    const customFields = contact.customFields || [];

    const ghlData = {
      source: "GHL",
      year: extractCustomField(customFields, FIELD_IDS.vehicle_year),
      make: extractCustomField(customFields, FIELD_IDS.vehicle_make),
      model: extractCustomField(customFields, FIELD_IDS.vehicle_model),
      trim: extractCustomField(customFields, FIELD_IDS.vehicle_trim),
      vin: extractCustomField(customFields, FIELD_IDS.vehicle_vin),
      mileage: extractCustomField(customFields, FIELD_IDS.vehicle_mileage),
      contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    };

    console.log(`   ✅ GHL Data:`);
    console.log(`      Year: ${ghlData.year}`);
    console.log(`      Make: ${ghlData.make}`);
    console.log(`      Model: ${ghlData.model}`);
    console.log(`      Trim: ${ghlData.trim}`);
    console.log(`      VIN: ${ghlData.vin}`);
    console.log(`      Mileage: ${ghlData.mileage}`);

    return ghlData;
  } catch (e) {
    console.error(`   ❌ Error:`, e.message);
    return null;
  }
}

/**
 * Source 2: Extract vehicle data from CCC PDF (via Gemini)
 */
async function extractFromCCC(cccFileUrl) {
  console.log(`\n📄 SOURCE 2: Extracting from CCC PDF...`);

  if (!cccFileUrl) {
    console.log(`   ⚠️  No CCC file URL provided`);
    return null;
  }

  try {
    // Download PDF from URL
    console.log(`   Downloading PDF...`);
    const pdfRes = await fetch(cccFileUrl);
    if (!pdfRes.ok) {
      console.log(`   ❌ Could not download PDF (${pdfRes.status})`);
      return null;
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const base64PDF = Buffer.from(pdfBuffer).toString("base64");

    // Use Gemini to extract text from PDF
    console.log(`   Analyzing PDF with Gemini...`);
    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GOOGLE_API_KEY || "",
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            {
              text: `Extract the vehicle information from this CCC evaluation. Return ONLY a JSON object with these fields (or null if not found):
{
  "year": number or null,
  "make": string or null,
  "model": string or null,
  "trim": string or null,
  "vin": string or null,
  "mileage": number or null
}

Be precise with VIN (17 characters, uppercase) and mileage (numeric only).`,
            },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64PDF,
              },
            },
          ],
        }],
      }),
    });

    if (!geminiRes.ok) {
      console.log(`   ❌ Gemini API error: ${geminiRes.status}`);
      return null;
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`   ⚠️  Could not parse vehicle data from CCC`);
      return null;
    }

    const cccData = {
      source: "CCC_PDF",
      ...JSON.parse(jsonMatch[0]),
    };

    console.log(`   ✅ CCC Data:`);
    console.log(`      Year: ${cccData.year}`);
    console.log(`      Make: ${cccData.make}`);
    console.log(`      Model: ${cccData.model}`);
    console.log(`      Trim: ${cccData.trim}`);
    console.log(`      VIN: ${cccData.vin}`);
    console.log(`      Mileage: ${cccData.mileage}`);

    return cccData;
  } catch (e) {
    console.error(`   ❌ Error:`, e.message);
    return null;
  }
}

/**
 * Compare two data sources and flag discrepancies
 */
function compareAndReconcile(ghlData, cccData) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`RECONCILIATION COMPARISON`);
  console.log(`${"─".repeat(70)}`);

  const discrepancies = [];
  const reconciled = {};

  const fields = ["year", "make", "model", "trim", "vin", "mileage"];

  for (const field of fields) {
    const ghlValue = ghlData?.[field];
    const cccValue = cccData?.[field];

    console.log(`\n${field.toUpperCase()}:`);
    console.log(`   GHL:  ${ghlValue || "(empty)"}`);
    console.log(`   CCC:  ${cccValue || "(empty)"}`);

    // Determine reconciled value
    if (ghlValue === cccValue) {
      console.log(`   ✅ MATCH`);
      reconciled[field] = ghlValue;
    } else if (ghlValue && cccValue) {
      console.log(`   ⚠️  MISMATCH - Both sources have different values`);
      discrepancies.push({
        field,
        ghlValue,
        cccValue,
        severity: "HIGH",
        recommendation: `Verify which is correct. GHL: "${ghlValue}", CCC: "${cccValue}"`,
      });
      // Use GHL value as primary, flag for review
      reconciled[field] = ghlValue;
    } else if (ghlValue) {
      console.log(`   ℹ️  GHL only`);
      reconciled[field] = ghlValue;
    } else if (cccValue) {
      console.log(`   ℹ️  CCC only`);
      reconciled[field] = cccValue;
    } else {
      console.log(`   ❌ MISSING - Not in either source`);
      discrepancies.push({
        field,
        severity: "MEDIUM",
        recommendation: `Data missing from both sources. Requires manual entry.`,
      });
      reconciled[field] = null;
    }
  }

  return {
    reconciled,
    discrepancies,
    requiresReview: discrepancies.length > 0,
  };
}

/**
 * Main: Full reconciliation workflow
 */
async function reconcileData(contactId, cccFileUrl) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`GHL + CCC DATA RECONCILIATION`);
  console.log(`${"═".repeat(70)}`);

  // Extract from both sources
  const ghlData = await extractFromGHL(contactId);
  const cccData = cccFileUrl ? await extractFromCCC(cccFileUrl) : null;

  // Compare and reconcile
  if (ghlData || cccData) {
    const result = compareAndReconcile(ghlData, cccData);

    console.log(`\n${"═".repeat(70)}`);
    console.log(`FINAL RECONCILED DATA`);
    console.log(`${"═".repeat(70)}`);
    console.log(JSON.stringify(result.reconciled, null, 2));

    if (result.discrepancies.length > 0) {
      console.log(`\n${"!".repeat(70)}`);
      console.log(`⚠️  DISCREPANCIES FOUND - REQUIRES REVIEW`);
      console.log(`${"!".repeat(70)}`);
      for (const disc of result.discrepancies) {
        console.log(`\n❌ ${disc.field.toUpperCase()}`);
        if (disc.ghlValue !== undefined && disc.cccValue !== undefined) {
          console.log(`   GHL: "${disc.ghlValue}"`);
          console.log(`   CCC: "${disc.cccValue}"`);
        }
        console.log(`   → ${disc.recommendation}`);
      }
    } else {
      console.log(`\n✅ NO DISCREPANCIES - All sources agree`);
    }

    return result;
  } else {
    console.log(`\n❌ Could not extract data from either source`);
    return null;
  }
}

// Run if main module
if (process.argv[1].endsWith("ghl-ccc-reconciliation.mjs")) {
  const contactId = process.argv[2];
  const cccFileUrl = process.argv[3];

  if (!contactId) {
    console.error(`Usage: node ghl-ccc-reconciliation.mjs [contactId] [cccFileUrl]`);
    process.exit(1);
  }

  reconcileData(contactId, cccFileUrl).catch(console.error);
}

export { extractFromGHL, extractFromCCC, compareAndReconcile, reconcileData };
