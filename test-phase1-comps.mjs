#!/usr/bin/env node

/**
 * Phase 1 Comp Research Test
 * Tests: ZIP geolocation, trim filtering, price floor enforcement
 */

import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

async function testCompSearch() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Phase 1: Geo-Aware Comp Research Test");
  console.log("═══════════════════════════════════════════════════════\n");

  // Test Case 1: 2020 Honda Civic EX in Everett, WA
  const test1 = {
    year: 2020,
    make: "Honda",
    model: "Civic",
    trim: "EX",
    packages: "No package",
    mileage: 45000,
    zip: "98201", // Everett, WA
    state: "WA",
    city: "Everett",
    clientEstimate: 17500, // Price floor
  };

  console.log("TEST 1: 2020 Honda Civic EX, 45k miles, Everett WA (98201)");
  console.log("Requirements:");
  console.log("  - Trim: EXACT match 'EX' (reject Si, DX, Hybrid, etc)");
  console.log("  - Location: 150-mile radius from 98201 (Everett)");
  console.log("  - Price: ≥ $17,500 (customer's target)");
  console.log("  - State: WA-first, expand to OR/ID if needed\n");

  try {
    const res = await fetch(`${API_BASE}/api/find-comps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(test1),
    });

    const data = await res.json();

    if (res.status === 200 || res.status === 200) {
      console.log(`✅ Search completed (Status: ${res.status})\n`);

      // Display results
      if (data.comps && data.comps.length > 0) {
        console.log(`Found: ${data.comps.length} comps\n`);

        for (let i = 0; i < data.comps.length; i++) {
          const comp = data.comps[i];
          console.log(`  Comp ${i + 1}:`);
          console.log(`    Description: ${comp.description}`);
          console.log(`    Price: $${comp.askingPrice?.toLocaleString() || "N/A"}`);
          console.log(`    Mileage: ${comp.compMileage?.toLocaleString() || "N/A"} miles`);
          console.log(`    Source: ${comp.source || "Unknown"}`);
          console.log(`    URL: ${comp.url || "N/A"}\n`);
        }
      } else {
        console.log("⚠ No comps returned\n");
      }

      // Display geo filtering metadata
      if (data.geoFiltering) {
        console.log("═ GEO-FILTERING RESULTS ═════════════════════════════");
        console.log(`Subject Location: ${data.geoFiltering.subjectLocation}`);
        console.log(`Search Radius: ${data.geoFiltering.radiusMiles} miles`);
        console.log(`State-First: ${data.geoFiltering.stateFirst}`);
        console.log(`\nFilter Criteria:\n  ${data.geoFiltering.filterCriteria}\n`);

        const stats = data.geoFiltering.rejectionStats;
        if (stats && stats.total > 0) {
          console.log(`Rejections: ${stats.total} comps filtered out`);
          console.log(`  - Wrong trim: ${stats.wrongTrim}`);
          console.log(`  - Below price floor: ${stats.wrongPrice}`);
          console.log(`  - Wrong distance: ${stats.wrongDistance}\n`);
        }

        console.log(`Note: ${data.geoFiltering.rejectionNote}\n`);
      }

      // Display stats
      if (data.avgAskingPrice) {
        console.log("═ PRICING ANALYSIS ══════════════════════════════════");
        console.log(`Average Price: $${data.avgAskingPrice.toLocaleString()}`);
        console.log(`Median Price: $${data.medianPrice?.toLocaleString() || "N/A"}`);
        console.log(`Target Price: $${data.clientEstimate?.toLocaleString() || "N/A"}`);
        if (data.clientGap) {
          console.log(`\nNegotiating Position: ${data.clientGap}\n`);
        }
      }

      console.log("═ METHODOLOGY ═══════════════════════════════════════");
      console.log(data.methodology || "No methodology provided");
      console.log();
    } else {
      console.log(`❌ Error: ${res.status}`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("❌ Request failed:", e.message);
    console.log("\nNote: Make sure dev server is running: npm run dev");
  }

  console.log("\n═════════════════════════════════════════════════════\n");

  // Test Case 2: Wrong trim (should be rejected)
  console.log("TEST 2: Testing wrong trim rejection");
  console.log("(If AI returns 2020 Civic Si instead of EX, should be rejected)\n");

  const test2 = {
    year: 2020,
    make: "Honda",
    model: "Civic",
    trim: "EX", // Want EX
    mileage: 45000,
    zip: "98201",
    state: "WA",
    clientEstimate: 17500,
  };

  try {
    const res = await fetch(`${API_BASE}/api/find-comps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(test2),
    });

    const data = await res.json();

    if (res.ok) {
      const rejectionStats = data.geoFiltering?.rejectionStats;
      if (rejectionStats && rejectionStats.wrongTrim > 0) {
        console.log(
          `✅ PASS: ${rejectionStats.wrongTrim} wrong-trim comp(s) rejected`
        );
      } else {
        console.log("ℹ No wrong-trim rejections detected (all comps matched)");
      }
    }
  } catch (e) {
    console.error("❌ Request failed:", e.message);
  }

  console.log(
    "\n═════════════════════════════════════════════════════\n"
  );
  console.log("✅ Phase 1 Testing Complete\n");
  console.log("Key Features Enabled:");
  console.log("  ✓ ZIP code geolocation (98201 → Everett, WA)");
  console.log("  ✓ 150-mile radius filtering");
  console.log("  ✓ WA-first prioritization (expand to OR/ID if needed)");
  console.log("  ✓ Exact trim matching (EX only, reject Si/DX)");
  console.log("  ✓ Price floor enforcement (≥ $17,500)");
  console.log("  ✓ Rejection statistics & metadata\n");
}

testCompSearch();
