#!/usr/bin/env node

/**
 * Facebook Ads Sync
 * Pulls daily ad spend, impressions, clicks, conversions from Meta Ads API
 * Syncs to Convex marketingAds table
 */

import fetch from "node-fetch";

const FACEBOOK_API_VERSION = "v19.0";
const FACEBOOK_AD_ACCOUNT_ID = process.env.FACEBOOK_AD_ACCOUNT_ID || "act_1234567890"; // Replace with real ID
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";
const CONVEX_DEPLOYMENT_URL = process.env.CONVEX_URL || CONVEX_URL;

/**
 * Fetch Facebook campaign data for date range
 */
async function fetchFacebookCampaigns(startDate, endDate) {
  if (!FACEBOOK_ACCESS_TOKEN) {
    console.warn("⚠️  FACEBOOK_ACCESS_TOKEN not set. Skipping Facebook sync.");
    return [];
  }

  try {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${FACEBOOK_AD_ACCOUNT_ID}/campaigns`;

    const params = new URLSearchParams({
      access_token: FACEBOOK_ACCESS_TOKEN,
      fields: "id,name,status,insights.date_start(${startDate}).date_stop(${endDate}){spend,impressions,clicks,actions}",
      limit: "100",
    });

    const res = await fetch(`${url}?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Facebook API error: ${res.status} ${error}`);
      return [];
    }

    const data = await res.json();
    const campaigns = data.data || [];

    console.log(`✅ Fetched ${campaigns.length} Facebook campaigns`);

    // Parse campaigns into spend records
    const records = [];
    for (const campaign of campaigns) {
      if (campaign.insights && campaign.insights.data.length > 0) {
        const insight = campaign.insights.data[0];
        records.push({
          date: new Date(startDate).getTime(),
          platform: "Facebook",
          campaignId: campaign.id,
          campaignName: campaign.name,
          spend: parseFloat(insight.spend) || 0,
          impressions: parseInt(insight.impressions) || 0,
          clicks: parseInt(insight.clicks) || 0,
          ctr: insight.impressions > 0 ? (parseInt(insight.clicks) / parseInt(insight.impressions)) * 100 : 0,
          conversions: insight.actions ? parseInt(insight.actions[0]?.value) || 0 : 0,
          source: "facebook_ads_api",
        });
      }
    }

    return records;
  } catch (e) {
    console.error("Error fetching Facebook campaigns:", e.message);
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

    console.log(`✅ Synced ${records.length} Facebook ad spend records to Convex`);
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

  console.log(`[Facebook Ads Sync] ${startDate} → ${endDate}`);

  const campaigns = await fetchFacebookCampaigns(startDate, endDate);
  await syncToConvex(campaigns);
}

main().catch(console.error);
