#!/usr/bin/env node

/**
 * Google Ads Sync
 * Pulls daily ad spend, impressions, clicks, conversions from Google Ads API
 * Syncs to Convex marketingAds table
 */

import fetch from "node-fetch";

const GOOGLE_ADS_API_VERSION = "v15";
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "1234567890"; // Replace with real customer ID
const GOOGLE_ADS_ACCESS_TOKEN = process.env.GOOGLE_ADS_ACCESS_TOKEN;

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";
const CONVEX_DEPLOYMENT_URL = process.env.CONVEX_URL || CONVEX_URL;

/**
 * Fetch Google Ads campaign data for date range
 * Uses Google Ads API with GAQL (Google Ads Query Language)
 */
async function fetchGoogleAdsCampaigns(startDate, endDate) {
  if (!GOOGLE_ADS_ACCESS_TOKEN) {
    console.warn("⚠️  GOOGLE_ADS_ACCESS_TOKEN not set. Skipping Google Ads sync.");
    return [];
  }

  try {
    const gaqlQuery = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = ENABLED
      ORDER BY metrics.cost_micros DESC
    `;

    const res = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GOOGLE_ADS_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: gaqlQuery,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Google Ads API error: ${res.status} ${error}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    console.log(`✅ Fetched ${results.length} Google Ads campaigns`);

    // Parse results into spend records
    const records = [];
    for (const result of results) {
      const campaign = result.campaign;
      const metrics = result.metrics;

      records.push({
        date: new Date(startDate).getTime(),
        platform: "Google",
        campaignId: campaign.id,
        campaignName: campaign.name,
        spend: metrics.cost_micros ? metrics.cost_micros / 1_000_000 : 0, // Convert micros to dollars
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
        conversions: metrics.conversions || 0,
        source: "google_ads_api",
      });
    }

    return records;
  } catch (e) {
    console.error("Error fetching Google Ads campaigns:", e.message);
    return [];
  }
}

/**
 * Sync records to Convex
 */
async function syncToConvex(records) {
  if (records.length === 0) return;

  try {
    for (const record of records) {
      const res = await fetch(`${CONVEX_DEPLOYMENT_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "marketingAds:upsertAdSpend",
          args: record,
          format: "json",
        }),
      });

      if (!res.ok) {
        console.error(`Convex sync error: ${res.status}`);
      }
    }

    console.log(`✅ Synced ${records.length} Google Ads spend records to Convex`);
  } catch (e) {
    console.error("Error syncing to Convex:", e.message);
  }
}

/**
 * Main
 */
async function main() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const startDate = yesterday.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  console.log(`[Google Ads Sync] ${startDate} → ${endDate}`);

  const campaigns = await fetchGoogleAdsCampaigns(startDate, endDate);
  await syncToConvex(campaigns);
}

main().catch(console.error);
