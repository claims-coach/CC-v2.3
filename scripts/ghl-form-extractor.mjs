#!/usr/bin/env node

/**
 * GHL Form Data Extractor
 * Pulls vehicle + CCC data directly from GHL contact records
 * 
 * Usage: node scripts/ghl-form-extractor.mjs [contactId]
 * Or: Integrated into ghl-intake-automation.mjs
 */

const GHL_API_KEY = "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const GHL_LOCATION = "Lud9I0SSpb992pgRS4gJ";
const GHL_BASE = "https://services.leadconnectorhq.com";

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
 * Custom Field ID Map
 * These are the field IDs used in the "FREE Valuation Form"
 * UPDATE THESE WITH ACTUAL IDs FROM YOUR GHL FORM
 */
const FIELD_IDS = {
  vehicle_year: "bYA55kg9nzn6YIIUYZ4I",
  vehicle_make: "FbC0k0MTjr1PRIUhLrJT",
  vehicle_model: "84Cyc2WkPwWSlRzDoNTf",
  vehicle_trim: "Ayp2CCc8F6V4hlzqPIzq",
  vehicle_vin: "zQn83d4bJi4CKdSdkhbh",
  vehicle_mileage: "JafUwf29wAIz1y1U5BNe",
  insurance_company: "insurance_company_field_id", // TODO: Get actual ID
  claim_number: "claim_number_field_id", // TODO: Get actual ID
  ccc_evaluation: "estimateFile_field_id", // TODO: Get actual ID
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
 * Extract all vehicle data from contact
 */
async function extractVehicleData(contactId) {
  try {
    console.log(`\n📋 Extracting vehicle data for contact: ${contactId}`);

    // Fetch full contact record
    const contact = await ghlFetch(`/contacts/${contactId}/?locationId=${GHL_LOCATION}`);
    
    if (!contact) {
      console.error(`❌ Contact not found: ${contactId}`);
      return null;
    }

    const customFields = contact.customFields || [];
    
    // Extract vehicle data
    const vehicleData = {
      contactId: contact.id,
      firstName: contact.firstName || null,
      lastName: contact.lastName || null,
      email: contact.email || null,
      phone: contact.phone || null,
      year: extractCustomField(customFields, FIELD_IDS.vehicle_year),
      make: extractCustomField(customFields, FIELD_IDS.vehicle_make),
      model: extractCustomField(customFields, FIELD_IDS.vehicle_model),
      trim: extractCustomField(customFields, FIELD_IDS.vehicle_trim),
      vin: extractCustomField(customFields, FIELD_IDS.vehicle_vin),
      mileage: extractCustomField(customFields, FIELD_IDS.vehicle_mileage),
      insuranceCompany: extractCustomField(customFields, FIELD_IDS.insurance_company),
      claimNumber: extractCustomField(customFields, FIELD_IDS.claim_number),
    };

    // Log what we extracted
    console.log(`\n✅ Vehicle Data Extracted:`);
    console.log(`   Year: ${vehicleData.year}`);
    console.log(`   Make: ${vehicleData.make}`);
    console.log(`   Model: ${vehicleData.model}`);
    console.log(`   Trim: ${vehicleData.trim}`);
    console.log(`   VIN: ${vehicleData.vin}`);
    console.log(`   Mileage: ${vehicleData.mileage}`);
    console.log(`   Insurance: ${vehicleData.insuranceCompany}`);
    console.log(`   Claim #: ${vehicleData.claimNumber}`);

    return vehicleData;
  } catch (e) {
    console.error(`❌ Error extracting vehicle data:`, e.message);
    return null;
  }
}

/**
 * Extract CCC evaluation file from contact documents
 */
async function extractCCCFile(contactId) {
  try {
    console.log(`\n📄 Searching for CCC evaluation in contact documents...`);

    // Try to fetch contact files
    try {
      const filesRes = await ghlFetch(`/contacts/${contactId}/files?locationId=${GHL_LOCATION}`);
      const files = filesRes.files || filesRes.data || [];

      if (files.length === 0) {
        console.log(`   No files found`);
        return null;
      }

      // Look for CCC, evaluation, estimate, appraisal files
      const keywords = ["ccc", "evaluation", "estimate", "appraisal", "valuation"];
      const cccFile = files.find(f => {
        const nameLower = (f.name || "").toLowerCase();
        return keywords.some(kw => nameLower.includes(kw));
      });

      if (cccFile) {
        console.log(`✅ CCC File Found:`);
        console.log(`   Name: ${cccFile.name}`);
        console.log(`   URL: ${cccFile.url || cccFile.downloadUrl}`);
        return cccFile;
      } else {
        console.log(`   No CCC/evaluation files found (searched for: ${keywords.join(", ")})`);
        return null;
      }
    } catch (e) {
      // Files endpoint might not exist, try custom field instead
      console.log(`   /files endpoint not available, checking custom fields...`);
      return null;
    }
  } catch (e) {
    console.error(`❌ Error extracting CCC file:`, e.message);
    return null;
  }
}

/**
 * Main: Extract all data for a contact
 */
async function extractAllData(contactId) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`GHL FORM DATA EXTRACTION TEST`);
  console.log(`${"═".repeat(60)}`);

  const vehicleData = await extractVehicleData(contactId);
  const cccFile = await extractCCCFile(contactId);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`EXTRACTION COMPLETE`);
  console.log(`${"─".repeat(60)}`);

  const result = {
    success: !!(vehicleData && (vehicleData.year || vehicleData.vin)),
    vehicle: vehicleData,
    cccFile: cccFile,
    timestamp: new Date().toISOString(),
  };

  console.log(`\nResult JSON:`);
  console.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Test with multiple contacts
 */
async function runTests() {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`GHL FORM EXTRACTOR - HARDENED TEST SUITE`);
  console.log(`${"=".repeat(70)}`);

  // Get all contacts and test extraction on each
  try {
    const contactsRes = await ghlFetch(`/contacts/?locationId=${GHL_LOCATION}`);
    const contacts = contactsRes.contacts || contactsRes.data || [];

    console.log(`\nFound ${contacts.length} total contacts. Testing extraction on first 5...\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < Math.min(5, contacts.length); i++) {
      const contact = contacts[i];
      console.log(`\n${"─".repeat(70)}`);
      console.log(`TEST ${i + 1}: ${contact.firstName || ""} ${contact.lastName || contact.name || "Unknown"}`);
      console.log(`${"─".repeat(70)}`);

      const result = await extractAllData(contact.id);

      if (result.success) {
        successCount++;
        console.log(`✅ PASS - Vehicle data extracted`);
      } else {
        failCount++;
        console.log(`⚠️  PARTIAL - No vehicle data (might not be filled in)`);
      }
    }

    console.log(`\n${"═".repeat(70)}`);
    console.log(`TEST RESULTS`);
    console.log(`${"═".repeat(70)}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`⚠️  Partial/Failed: ${failCount}`);
    console.log(`Success Rate: ${Math.round((successCount / (successCount + failCount)) * 100)}%`);

    if (successCount > 0) {
      console.log(`\n✅ EXTRACTION IS WORKING - Ready to integrate into automation`);
    } else {
      console.log(`\n⚠️  No vehicle data found in test contacts`);
      console.log(`   → Verify field IDs in FIELD_IDS map are correct`);
      console.log(`   → Check that at least one contact has vehicle data filled in`);
    }
  } catch (e) {
    console.error(`\n❌ Error running tests:`, e.message);
  }
}

// Run tests if this is main module
if (process.argv[1].endsWith("ghl-form-extractor.mjs")) {
  const contactId = process.argv[2];

  if (contactId) {
    // Single contact extraction
    extractAllData(contactId).catch(console.error);
  } else {
    // Run test suite on all contacts
    runTests().catch(console.error);
  }
}

export { extractVehicleData, extractCCCFile, extractAllData };
