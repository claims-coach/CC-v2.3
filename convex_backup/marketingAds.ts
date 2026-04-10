import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Marketing Ads Tracking
 * 
 * Tables:
 * - adSpend: Daily ad spend by platform/campaign
 * - marketingLeads: Lead submissions with source tracking
 * - marketingMetrics: Daily aggregated metrics (for dashboard)
 */

// ── MUTATIONS ──────────────────────────────────────────────────

export const upsertAdSpend = mutation({
  args: {
    date: v.number(),
    platform: v.union(v.literal("Google"), v.literal("Facebook")),
    campaignId: v.string(),
    campaignName: v.string(),
    spend: v.number(),
    impressions: v.number(),
    clicks: v.number(),
    ctr: v.number(),
    conversions: v.optional(v.number()),
    source: v.union(v.literal("google_ads_api"), v.literal("facebook_ads_api"), v.literal("manual")),
  },
  async handler(ctx, args) {
    // Upsert: if exists, update; if not, create
    const existing = await ctx.db
      .query("adSpend")
      .filter(
        q =>
          q.and(
            q.eq(q.field("date"), args.date),
            q.eq(q.field("platform"), args.platform),
            q.eq(q.field("campaignId"), args.campaignId)
          )
      )
      .first();

    const doc = {
      ...args,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { _id: existing._id, ...doc };
    } else {
      const newId = await ctx.db.insert("adSpend", doc);
      return { _id: newId, ...doc };
    }
  },
});

export const upsertMarketingLead = mutation({
  args: {
    date: v.number(),
    source: v.union(v.literal("Facebook"), v.literal("Google"), v.literal("Organic"), v.literal("Direct")),
    campaignId: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    leadName: v.string(),
    leadEmail: v.string(),
    leadPhone: v.string(),
    vehicleInfo: v.optional(v.string()),
    qualityScore: v.union(v.literal("High"), v.literal("Medium"), v.literal("Low")),
    qualityReason: v.optional(v.string()),
    ghlContactId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    return await ctx.db.insert("marketingLeads", {
      ...args,
      converted: false,
      createdAt: Date.now(),
    });
  },
});

export const updateLeadConversion = mutation({
  args: {
    leadId: v.id("marketingLeads"),
    converted: v.boolean(),
    caseId: v.optional(v.id("claims")),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.leadId, {
      converted: args.converted,
      convertedCaseId: args.caseId,
      conversionDate: args.converted ? Date.now() : undefined,
    });
  },
});

export const upsertMarketingMetrics = mutation({
  args: {
    date: v.number(),
    totalSpend: v.number(),
    totalImpressions: v.number(),
    totalClicks: v.number(),
    totalLeads: v.number(),
    costPerLead: v.number(),
    roi: v.number(),
    highQualityLeads: v.number(),
    convertedLeads: v.number(),
    conversionRate: v.number(),
    byPlatform: v.any(),
    byCampaign: v.any(),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query("marketingMetrics")
      .filter(q => q.eq(q.field("date"), args.date))
      .first();

    const doc = {
      ...args,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { _id: existing._id, ...doc };
    } else {
      const newId = await ctx.db.insert("marketingMetrics", doc);
      return { _id: newId, ...doc };
    }
  },
});

// ── QUERIES ────────────────────────────────────────────────────

export const getAdSpendByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    platform: v.optional(v.union(v.literal("Google"), v.literal("Facebook"))),
  },
  async handler(ctx, args) {
    let query = ctx.db.query("adSpend").filter(q =>
      q.and(
        q.gte(q.field("date"), args.startDate),
        q.lte(q.field("date"), args.endDate)
      )
    );

    if (args.platform) {
      query = query.filter(q => q.eq(q.field("platform"), args.platform));
    }

    return await query.collect();
  },
});

export const getMarketingLeadsByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    source: v.optional(v.string()),
  },
  async handler(ctx, args) {
    let query = ctx.db.query("marketingLeads").filter(q =>
      q.and(
        q.gte(q.field("date"), args.startDate),
        q.lte(q.field("date"), args.endDate)
      )
    );

    if (args.source) {
      query = query.filter(q => q.eq(q.field("source"), args.source));
    }

    return await query.collect();
  },
});

export const getMetricsByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("marketingMetrics")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();
  },
});

export const getLatestMetrics = query({
  async handler(ctx) {
    const latest = await ctx.db
      .query("marketingMetrics")
      .order("desc")
      .first();
    return latest;
  },
});

export const getCampaignPerformance = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  async handler(ctx, args) {
    const spends = await ctx.db
      .query("adSpend")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    const leads = await ctx.db
      .query("marketingLeads")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    // Group by campaign
    const campaigns: Record<string, any> = {};

    for (const spend of spends) {
      const key = spend.campaignId;
      if (!campaigns[key]) {
        campaigns[key] = {
          campaignId: spend.campaignId,
          campaignName: spend.campaignName,
          platforms: {},
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalLeads: 0,
        };
      }
      campaigns[key].platforms[spend.platform] = {
        spend: spend.spend,
        clicks: spend.clicks,
        impressions: spend.impressions,
        ctr: spend.ctr,
      };
      campaigns[key].totalSpend += spend.spend;
      campaigns[key].totalImpressions += spend.impressions;
      campaigns[key].totalClicks += spend.clicks;
    }

    // Add lead counts
    for (const lead of leads) {
      if (lead.campaignId && campaigns[lead.campaignId]) {
        campaigns[lead.campaignId].totalLeads++;
      }
    }

    // Calculate metrics
    const result = Object.values(campaigns).map((c: any) => ({
      ...c,
      cpl: c.totalLeads > 0 ? c.totalSpend / c.totalLeads : 0,
      ctr: c.totalClicks > 0 ? (c.totalClicks / c.totalImpressions) * 100 : 0,
    }));

    return result.sort((a: any, b: any) => b.totalSpend - a.totalSpend);
  },
});

export const getPlatformComparison = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  async handler(ctx, args) {
    const spends = await ctx.db
      .query("adSpend")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    const leads = await ctx.db
      .query("marketingLeads")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    const platforms: Record<string, any> = {
      Google: { spend: 0, impressions: 0, clicks: 0, leads: 0 },
      Facebook: { spend: 0, impressions: 0, clicks: 0, leads: 0 },
    };

    // Aggregate spend
    for (const spend of spends) {
      if (platforms[spend.platform]) {
        platforms[spend.platform].spend += spend.spend;
        platforms[spend.platform].impressions += spend.impressions;
        platforms[spend.platform].clicks += spend.clicks;
      }
    }

    // Count leads by source
    for (const lead of leads) {
      const platform = lead.source === "Facebook" ? "Facebook" : lead.source === "Google" ? "Google" : null;
      if (platform && platforms[platform]) {
        platforms[platform].leads++;
      }
    }

    // Calculate metrics
    return Object.entries(platforms).map(([name, data]: [string, any]) => ({
      platform: name,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : "0",
      leads: data.leads,
      cpl: data.leads > 0 ? (data.spend / data.leads).toFixed(2) : "0",
    }));
  },
});

export const getLeadQualityBreakdown = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  async handler(ctx, args) {
    const leads = await ctx.db
      .query("marketingLeads")
      .filter(q =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    const breakdown = {
      High: 0,
      Medium: 0,
      Low: 0,
      total: leads.length,
    };

    for (const lead of leads) {
      breakdown[lead.qualityScore]++;
    }

    const converted = leads.filter(l => l.converted).length;

    return {
      ...breakdown,
      converted,
      conversionRate: breakdown.total > 0 ? ((converted / breakdown.total) * 100).toFixed(1) : "0",
      highQualityConversionRate:
        breakdown.High > 0
          ? ((leads.filter(l => l.qualityScore === "High" && l.converted).length / breakdown.High) * 100).toFixed(1)
          : "0",
    };
  },
});
