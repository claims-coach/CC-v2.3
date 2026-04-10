#!/usr/bin/env node

import { GoogleAdsApi } from "google-ads-api";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} = process.env;

console.log("\n🧪 Testing Google Ads API Connection\n");
console.log("Config:");
console.log(`  Developer Token: ${GOOGLE_ADS_DEVELOPER_TOKEN?.substring(0, 10)}...`);
console.log(`  Customer ID: ${GOOGLE_ADS_CUSTOMER_ID}`);
console.log(`  Client ID: ${GOOGLE_OAUTH_CLIENT_ID?.substring(0, 20)}...`);
console.log(`  Refresh Token: ${GOOGLE_OAUTH_REFRESH_TOKEN?.substring(0, 20)}...`);
console.log("");

const client = new GoogleAdsApi({
  developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  client_id: GOOGLE_OAUTH_CLIENT_ID,
  client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
  refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
});

async function test() {
  try {
    console.log("📡 Fetching campaigns from Google Ads...\n");

    const report = await client.report({
      entity: "campaign",
      attributes: ["campaign.id", "campaign.name", "campaign.status"],
      from_date: "2024-01-01",
      to_date: new Date().toISOString().split("T")[0],
      limit: 10,
    });

    if (report && report.length > 0) {
      console.log(`✅ Connection successful! Found ${report.length} campaigns:\n`);
      report.forEach((c, i) => {
        console.log(`${i + 1}. ${c.campaign.name} (ID: ${c.campaign.id}) - ${c.campaign.status}`);
      });
    } else {
      console.log("✅ Connection successful! No campaigns found yet.");
    }

    console.log("\n✅ Google Ads API is working!\n");
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    console.log("Details:", e);
  }
}

test();
