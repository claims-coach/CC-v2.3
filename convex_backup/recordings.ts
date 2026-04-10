import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { clientName: v.optional(v.string()) },
  handler: async (ctx, { clientName }) => {
    const all = await ctx.db.query("recordings").order("desc").collect();
    return clientName ? all.filter(r => r.clientName === clientName) : all;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    if (!q.trim()) return ctx.db.query("recordings").order("desc").collect();
    return ctx.db.query("recordings")
      .withSearchIndex("search_recordings", s => s.search("transcript", q))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("recordings") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const ingest = mutation({
  args: {
    source: v.union(v.literal("plaud"), v.literal("manual"), v.literal("upload")),
    externalId: v.optional(v.string()),
    title: v.string(),
    transcript: v.string(),
    summary: v.optional(v.string()),
    duration: v.optional(v.number()),
    clientName: v.optional(v.string()),
    claimId: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    speakers: v.optional(v.array(v.string())),
    tags: v.array(v.string()),
    category: v.optional(v.string()),
    recordedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Dedup by externalId
    if (args.externalId) {
      const existing = await ctx.db.query("recordings")
        .filter(q => q.eq(q.field("externalId"), args.externalId))
        .first();
      if (existing) return existing._id;
    }
    const now = Date.now();
    const id = await ctx.db.insert("recordings", {
      ...args,
      recordedAt: args.recordedAt ?? now,
      processed: true,
      createdAt: now,
    });

    // Auto-create a memory entry for the recording
    await ctx.db.insert("memories", {
      title: args.title,
      content: args.summary ?? args.transcript.slice(0, 2000),
      type: "conversation",
      tags: [...args.tags, "recording", args.source],
      clientName: args.clientName,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activity", {
      agentName: "CC",
      action: `Recording ingested: ${args.title}`,
      details: args.clientName ? `Client: ${args.clientName}` : args.source,
      type: "memory",
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("recordings"),
    summary: v.optional(v.string()),
    clientName: v.optional(v.string()),
    claimId: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const clean: any = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) clean[k] = v;
    await ctx.db.patch(id, clean);
  },
});

export const remove = mutation({
  args: { id: v.id("recordings") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("recordings").order("desc").collect();
    const now = Date.now();

    const DAY  = 86400_000;
    const WEEK = 7 * DAY;

    const todayStart     = new Date(); todayStart.setHours(0,0,0,0);
    const weekStart      = now - WEEK;
    const monthStart     = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const yearStart      = new Date(); yearStart.setMonth(0,1); yearStart.setHours(0,0,0,0);

    const today   = all.filter(r => r.createdAt >= todayStart.getTime()).length;
    const week    = all.filter(r => r.createdAt >= weekStart).length;
    const month   = all.filter(r => r.createdAt >= monthStart.getTime()).length;
    const year    = all.filter(r => r.createdAt >= yearStart.getTime()).length;
    const total   = all.length;

    // Build daily buckets for the last 30 days
    const daily: Record<string, number> = {};
    for (let d = 0; d < 30; d++) {
      const dt = new Date(now - d * DAY);
      dt.setHours(0,0,0,0);
      const key = dt.toISOString().slice(0, 10);
      daily[key] = 0;
    }
    for (const r of all) {
      if (r.createdAt < now - 30 * DAY) continue;
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (key in daily) daily[key]++;
    }

    // Build weekly buckets for last 12 weeks
    const weekly: Record<string, number> = {};
    for (let w = 0; w < 12; w++) {
      const dt = new Date(now - w * WEEK);
      dt.setHours(0,0,0,0);
      const sun = new Date(dt);
      sun.setDate(dt.getDate() - dt.getDay());
      const key = sun.toISOString().slice(0, 10);
      weekly[key] = (weekly[key] || 0);
    }
    for (const r of all) {
      if (r.createdAt < now - 12 * WEEK) continue;
      const dt = new Date(r.createdAt);
      const sun = new Date(dt);
      sun.setDate(dt.getDate() - dt.getDay());
      sun.setHours(0,0,0,0);
      const key = sun.toISOString().slice(0, 10);
      if (key in weekly) weekly[key]++;
    }

    // Build monthly buckets for last 12 months
    const monthly: Record<string, number> = {};
    for (let m = 0; m < 12; m++) {
      const dt = new Date(now);
      dt.setDate(1); dt.setHours(0,0,0,0);
      dt.setMonth(dt.getMonth() - m);
      const key = dt.toISOString().slice(0, 7);
      monthly[key] = 0;
    }
    for (const r of all) {
      const key = new Date(r.createdAt).toISOString().slice(0, 7);
      if (key in monthly) monthly[key]++;
    }

    // Source breakdown
    const bySource: Record<string, number> = {};
    for (const r of all) bySource[r.source] = (bySource[r.source] || 0) + 1;

    // Top clients
    const byClient: Record<string, number> = {};
    for (const r of all) if (r.clientName) byClient[r.clientName] = (byClient[r.clientName] || 0) + 1;
    const topClients = Object.entries(byClient).sort((a,b) => b[1]-a[1]).slice(0, 5);

    return { total, today, week, month, year, daily, weekly, monthly, bySource, topClients };
  },
});

export const setCategory = mutation({
  args: { id: v.id("recordings"), category: v.string() },
  handler: async (ctx, { id, category }) => ctx.db.patch(id, { category }),
});
